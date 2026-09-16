/**
 * Spanish street-type ("tipo de vía") normalization for search queries and
 * filters.
 *
 * The INE Callejero indexes the canonical type inside `via_nombre_completo`
 * (`Calle Villanubla`) and the bare name in `via_nombre` (`Villanubla`). Users —
 * and OCR of DNI/TIE cards — type conventional abbreviations (`c/`, `C.`,
 * `Ctra`, `Avda`, `Pza`, `Plza`, `Pº`, `Baro`, …) and Catalan/Basque/Galician
 * variants that never appear in the index. A stray abbreviated token is worse
 * than a miss: Typesense fuzzily matches it against unrelated streets and then
 * drops the meaningful name token, returning noise or nothing.
 *
 * The dictionary is generated from the **AEAT** "Tabla de Tipos de Vías"
 * (see `via-tipos-data.ts`), which is the authoritative, exhaustive catalogue of
 * Spanish vía types and their abbreviations. Each code's multilingual synonyms
 * collapse to their Castilian/INE-canonical label (preferring the INE label so
 * accents are correct), then curated overrides and everyday abbreviations are
 * applied on top.
 *
 * `normalizeSearchQuery` rewrites a recognized leading type (up to four words,
 * e.g. `Gran Vía`, `Paseo Marítimo`) to its canonical full word so it matches
 * the indexed `via_nombre_completo`; `normalizeViaTipo` resolves a single
 * abbreviation/name to the canonical label for use as a `via_tipo` filter.
 */

import {
  AEAT_VIA_TIPOS_RAW,
  CODE_CANONICAL_OVERRIDES,
  EXTRA_VIA_TIPO_ALIASES,
} from './via-tipos-data.js'

/** INE Callejero canonical type labels (the `via_tipo` values the index uses). */
const INE_CANONICAL_TYPES: readonly string[] = [
  'Calle', 'Avenida', 'Plaza', 'Paseo', 'Ronda', 'Travesía', 'Carretera', 'Camino',
  'Gran Vía', 'Bulevar', 'Glorieta', 'Urbanización', 'Acceso', 'Aldea', 'Aeropuerto',
  'Alameda', 'Área', 'Arrabal', 'Autopista', 'Avenida de la Constitución', 'Barranco',
  'Barrio', 'Bloque', 'Cañada', 'Carretera de', 'Caserío', 'Colegio', 'Colonia',
  'Complejo', 'Conjunto', 'Cuesta', 'Chalet', 'Edificio', 'Entroncamento', 'Era',
  'Estación', 'Explanada', 'Ferrocarril', 'Huerta', 'Jardín', 'Jardines', 'Lado',
  'Lugar', 'Monte', 'Muelle', 'Municipio', 'Núcleo', 'Paraje', 'Parque', 'Particular',
  'Pasaje', 'Paso', 'Patio', 'Población', 'Polígono', 'Praza', 'Prolongación',
  'Puente', 'Puerto', 'Rambla', 'Rampa', 'Residencial', 'Rincón', 'Rio', 'Rúa',
  'Salida', 'Sector', 'Semáforo', 'Senda', 'Sentier', 'Separador', 'Servidumbre',
  'Valle', 'Vía', 'Vía Pública', 'Villa', 'Viñedo', 'Zona', 'Costa', 'Mar', 'Playa',
  'Campo', 'Cruz', 'Llano', 'Parada', 'Paseo Marítimo', 'Pirámide', 'Km', 'Hm', 'Dm',
  'm',
]

/** Lowercase + strip diacritics + drop trailing punctuation/separators. */
function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,;:]+$/u, '')
    .replace(/\/+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip an AEAT plural suffix (`NAVE/S` → `NAVE`, `CUEVA/S` → `CUEVA`). */
function stripSizeSuffix(name: string): string {
  return name
    .replace(/\/S$/i, '')
    .replace(/\/+$/, '')
    .trim()
}

// Spanish connectors kept lowercase inside a title-cased type name.
const LOWERCASE_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'l'])

/** Title-case an ALL-CAPS AEAT name, keeping Spanish articles lowercase. */
function titleCaseEs(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && LOWERCASE_WORDS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ')
}

const INE_BY_KEY: Readonly<Record<string, string>> = (() => {
  const map: Record<string, string> = {}
  for (const label of INE_CANONICAL_TYPES) map[normalizeKey(label)] = label
  return map
})()

interface AeatRow {
  abbr: string
  code: string
  name: string
}

function parseRows(): AeatRow[] {
  const rows: AeatRow[] = []
  for (const line of AEAT_VIA_TIPOS_RAW.split('\n')) {
    if (!line.trim()) continue
    const first = line.indexOf('|')
    const second = line.indexOf('|', first + 1)
    if (first < 0 || second < 0) continue
    rows.push({
      abbr: line.slice(0, first).trim(),
      code: line.slice(first + 1, second).trim(),
      name: line.slice(second + 1).trim(),
    })
  }
  return rows
}

/**
 * Build the canonical label per AEAT code: an explicit override wins, else the
 * first multilingual synonym whose normalized form matches an INE canonical
 * label (giving correct accents), else the title-cased first name.
 */
function buildCanonicalByCode(rows: AeatRow[]): Record<string, string> {
  const namesByCode: Record<string, string[]> = {}
  for (const row of rows) {
    ;(namesByCode[row.code] ??= []).push(stripSizeSuffix(row.name))
  }
  const canonicalByCode: Record<string, string> = {}
  for (const [code, names] of Object.entries(namesByCode)) {
    const override = CODE_CANONICAL_OVERRIDES[code]
    if (override) {
      canonicalByCode[code] = override
      continue
    }
    const ine = names
      .map((name) => INE_BY_KEY[normalizeKey(name)])
      .find((label): label is string => label !== undefined)
    canonicalByCode[code] = ine ?? titleCaseEs(names[0] ?? code)
  }
  return canonicalByCode
}

/**
 * The runtime dictionary: normalized abbreviation *and* name → canonical label.
 * Built once at module load from the AEAT table + curated aliases.
 */
export const VIA_TIPO_ABBREVIATIONS: Readonly<Record<string, string>> = (() => {
  const rows = parseRows()
  const canonicalByCode = buildCanonicalByCode(rows)
  const dictionary: Record<string, string> = {}
  for (const row of rows) {
    const canonical = canonicalByCode[row.code]
    if (!canonical) continue
    for (const key of [row.abbr, row.name, stripSizeSuffix(row.name)]) {
      const normalized = normalizeKey(key)
      if (normalized) dictionary[normalized] = canonical
    }
  }
  for (const [alias, canonical] of Object.entries(EXTRA_VIA_TIPO_ALIASES)) {
    const normalized = normalizeKey(alias)
    if (normalized) dictionary[normalized] = canonical
  }
  return dictionary
})()

/**
 * Resolve any vía type — an AEAT abbreviation, a Castilian/Catalan/Basque/
 * Galician synonym, or a full canonical name — to its canonical label, e.g.
 * `PLZA.` → `Plaza`, `BARRO` → `Barrio`, `carretra` → `Carretera`.
 * Returns `undefined` when the input is not a recognized type.
 */
export function normalizeViaTipo(value: string): string | undefined {
  if (!value) return undefined
  return VIA_TIPO_ABBREVIATIONS[normalizeKey(value)]
}

/** Join non-empty, trimmed parts with single spaces. */
function join(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
}

/** Longest leading type phrase matched against the dictionary, in words. */
const MAX_TYPE_WORDS = 4

/**
 * Normalize a free-text address query for the search backend.
 *
 * The longest leading phrase that resolves to a known vía type is rewritten to
 * its canonical full word so abbreviations match the indexed
 * `via_nombre_completo`:
 *   `c/ Villanubla`      → `Calle Villanubla`
 *   `c/Villanubla`       → `Calle Villanubla`
 *   `Ctra. Villanubla`   → `Carretera Villanubla`
 *   `PLZA. de las A.`    → `Plaza de las A.`
 *   `gran via 5`         → `Gran Vía 5`
 *
 * Full words (`calle`, `paseo`, `plaza`, …) are canonicalized in place; unknown
 * leading words (plain street names) pass through untouched.
 */
export function normalizeSearchQuery(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return ''

  // Slash-attached form: "c/Villanubla" / "C/MAYOR".
  const slash = trimmed.match(/^(\S*?)\/(\S+)(?:\s+([\s\S]*))?$/)
  if (slash) {
    const prefix = slash[1] ? VIA_TIPO_ABBREVIATIONS[normalizeKey(slash[1])] : undefined
    if (prefix) return join(prefix, slash[2], slash[3] ?? '')
  }

  const words = trimmed.split(/\s+/)
  const max = Math.min(MAX_TYPE_WORDS, words.length)
  for (let length = max; length >= 1; length--) {
    const canonical = VIA_TIPO_ABBREVIATIONS[normalizeKey(words.slice(0, length).join(' '))]
    if (canonical) return join(canonical, words.slice(length).join(' '))
  }
  return trimmed
}
