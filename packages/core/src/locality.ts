/**
 * Free-text locality auto-detection for the street search.
 *
 * A DNI/TIE address typed as it is written on the card —
 * `PLZA. DE LAS AUTONOMIAS 13 P05 C TORRELAVEGA, CANTABRIA` — ends with the
 * municipio and the provincia, and its (possibly wrong) vía type is glued to
 * the street name. Searching that text unconstrained loses to common
 * `Plaza de las…` streets in other provinces, so the smart autocomplete must
 * recognise the locality itself and constrain the search to it.
 *
 * This runs server-side (and in the widget's direct mode) inside the Typesense
 * path: when the query ends with a known province and looks like an address, we
 * resolve the trailing municipio against the province's municipios in the same
 * collection and add `filterByProvincia` / `filterByMunicipio`. The query text
 * itself is left untouched (the filters are what disambiguate).
 */

import { findProvincia, findProvinciaSuffix, normalizeName } from './provincias.js'
import type { ProvinciaInfo } from './provincias.js'
import type { SearchOptions } from './types.js'
import type { TypesenseClient } from './typesense.js'

/** Tokens of the tail used to query the municipio index. */
const CANDIDATE_WORDS = 5
/** Typesense caps `per_page` at 250; a province never has more municipios than that. */
const MUNICIPIO_LOOKUP_PER_PAGE = 250

interface MunicipioCandidate {
  name: string
  id: string
}

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

/** Does `haystack` end with the exact token sequence `needle`? */
function endsWithTokens(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false
  const offset = haystack.length - needle.length
  return needle.every((token, index) => haystack[offset + index] === token)
}

/** Look up municipios of a province matching `text` (matched against `municipio`). */
async function lookupMunicipios(
  text: string,
  provinciaCode: string,
  client: TypesenseClient,
  collection: string,
): Promise<MunicipioCandidate[]> {
  if (!text.trim()) return []
  const response = await client.search(collection, {
    q: text,
    query_by: 'municipio',
    filter_by: `provincia_id:=["${provinciaCode}"]`,
    per_page: MUNICIPIO_LOOKUP_PER_PAGE,
    prefix: false,
    include_fields: 'municipio,municipio_id',
  })
  const seen = new Set<string>()
  const found: MunicipioCandidate[] = []
  for (const hit of response.hits ?? []) {
    const name = String(hit.document?.municipio ?? '')
    const id = String(hit.document?.municipio_id ?? '')
    if (!name || !id || seen.has(id)) continue
    seen.add(id)
    found.push({ name, id })
  }
  return found
}

/**
 * Pick the municipio whose name is the longest token-suffix of the address
 * (checked against both the province-stripped and the full token list, so
 * city-provinces like `… MADRID` still resolve to their municipio).
 */
function pickMunicipio(
  municipios: MunicipioCandidate[],
  strippedNorm: string[],
  originalNorm: string[],
): MunicipioCandidate | undefined {
  let best: { candidate: MunicipioCandidate; words: number } | undefined
  for (const candidate of municipios) {
    const nameTokens = normalizeName(candidate.name).split(' ').filter(Boolean)
    const isSuffix =
      endsWithTokens(strippedNorm, nameTokens) || endsWithTokens(originalNorm, nameTokens)
    if (isSuffix && (!best || nameTokens.length > best.words)) {
      best = { candidate, words: nameTokens.length }
    }
  }
  return best?.candidate
}

/**
 * Add province/municipio filters derived from a free-text address. Returns the
 * options unchanged when the query does not end with a province, already has a
 * municipio filter, or looks like a bare street/province search.
 */
export async function applyLocalityHints(
  options: SearchOptions,
  client: TypesenseClient,
  collection: string,
): Promise<SearchOptions> {
  const query = options.query
  if (!query.trim() || options.filterByMunicipio) return options

  const tokens = tokenize(query)
  // Only treat it as an address when there is something before the province:
  // a number/unit, a comma, or at least three tokens ("Gran Vía Madrid").
  if (!/[\d,]/.test(query) && tokens.length < 3) return options

  const provincia = findProvinciaSuffix(tokens)
  if (!provincia) return options

  const stripped = tokens.slice(0, tokens.length - provincia.tokenCount)
  if (!stripped.length) return options

  const code = resolveProvinciaCode(options.filterByProvincia, provincia.info)
  const strippedNorm = stripped.map(normalizeName)
  const originalNorm = tokens.map(normalizeName)

  let best: MunicipioCandidate | undefined
  try {
    best = pickMunicipio(
      await lookupMunicipios(stripped.slice(-CANDIDATE_WORDS).join(' '), code, client, collection),
      strippedNorm,
      originalNorm,
    )
    // City-provinces: `Gran Vía 12 Madrid` — the province token is the municipio.
    if (!best) {
      const provinceName = normalizeName(provincia.info.name)
      best = pickMunicipio(
        (await lookupMunicipios(provincia.info.name, code, client, collection)).filter(
          (m) => normalizeName(m.name) === provinceName,
        ),
        strippedNorm,
        originalNorm,
      )
    }
  } catch {
    // Locality detection is best-effort: never fail the search over it.
    best = undefined
  }

  return {
    ...options,
    filterByProvincia: options.filterByProvincia ?? code,
    ...(best ? { filterByMunicipio: best.id } : {}),
  }
}

/** Caller-provided province (code/name) wins; otherwise the detected one. */
function resolveProvinciaCode(provided: string | undefined, detected: ProvinciaInfo): string {
  if (provided) {
    const info = findProvincia(provided)
    if (info) return info.code
  }
  return detected.code
}
