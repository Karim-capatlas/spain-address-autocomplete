/**
 * Address-unit parser ("datos del domicilio") — input-side only.
 *
 * The INE Callejero indexes street *vías* (no portal numbers), so the unit part
 * of an address (número, piso, puerta, portal, bloque, escalera, Km) can never
 * be searched — it only ever appears in the **input** (OCR'd DNI/TIE text or a
 * user's typing). `parseDomicilio` extracts it deterministically (no runtime
 * deps, offline) and returns the remaining street-line `query` for
 * `searchAddresses`, keeping a lossless `unidad_raw` sidecar.
 *
 * `normalizeDomicilio` composes parse → search → merge into a
 * `DireccionNormalizada` (the `normalize_address` payload).
 */

import type { AddressRecord, DomicilioUnit, DireccionNormalizada, SearchOptions } from './types.js'
import { searchAddresses } from './search.js'
import type { SearchDependencies } from './search.js'

/* ===== matching normalization (display never uses this) ===== */

/**
 * Lowercase + strip diacritics (NFD) + unify ordinal markers (`ª°` → `º`) +
 * strip trailing periods (abbreviation dots: `n.` `km.` `esc.` `pl.`) and
 * surrounding `,;` separators. Internal `,`/`.` survive so decimal numbers
 * like `12,5` stay one token.
 */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[ª°]/g, 'º')
    .replace(/\.+$/, '')
    .replace(/^[;,]+|[;,]+$/g, '')
    .trim()
}

interface Token {
  raw: string
  norm: string
}

function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: norm(raw) }))
}

/* ===== token classification (on normalized form) ===== */

// "4ºB" / "4ªB" / "4ob" → ordinal + letter
const ORDINAL_LETTER_RE = /^(\d+)[ºª°oa]([a-zñ])$/
// "4º" / "4ª" / "4°" / "4o" / "4a" → ordinal
const ORDINAL_RE = /^(\d+)[ºª°oa]$/
// "259d" / "4b" → number + letter (letter is not an ordinal marker)
const NUM_LETTER_RE = /^(\d+(?:[.,]\d+)?)([a-zñ])$/
// "12" / "12,5" → bare number
const NUM_RE = /^\d+(?:[.,]\d+)?$/
// "b" / "d" → single letter
const LETTER_RE = /^[a-zñ]$/
// "28013" → postal code (never a unit)
const CP_RE = /^\d{5}$/

/* ===== abbreviation dictionary (normalized keys) ===== */

const NUMERO_MARKERS = new Set(['nº', 'n', 'num', 'no', 'nro', 'numero'])
const PISO_MARKERS = new Set(['planta', 'piso', 'pl', 'plta', 'pl'])
const PUERTA_MARKERS = new Set(['puerta', 'pta', 'p'])
const BLOQUE_MARKERS = new Set(['bloque', 'blq', 'bl'])
const PORTAL_MARKERS = new Set(['portal', 'prtl', 'ptal'])
const ESCALERA_MARKERS = new Set(['escalera', 'esc'])
const KM_MARKERS = new Set(['km', 'kilometros'])

/** Self-contained piso values (never number tokens). */
const PISO_WORD_CANON: Record<string, string> = {
  bajo: 'Bajo',
  baj: 'Bajo',
  bjo: 'Bajo',
  entresuelo: 'Entresuelo',
  entlo: 'Entresuelo',
  atico: 'Ático',
  ati: 'Ático',
  sobreatico: 'Sobreatico',
  sotano: 'Sótano',
  st: 'Sótano',
  principal: 'Principal',
}

/** Self-contained puerta side values. */
const PUERTA_SIDE_CANON: Record<string, string> = {
  dcha: 'Dcha',
  derecha: 'Derecha',
  dr: 'Dcha',
  der: 'Dcha',
  izq: 'Izq',
  izquierda: 'Izquierda',
  iz: 'Izq',
}

/* ===== result builders ===== */

function emptyUnit(): DomicilioUnit {
  return {
    numero: null,
    piso: null,
    puerta: null,
    escalera: null,
    bloque: null,
    portal: null,
    kilometros: null,
    sin_numero: false,
    unidad_raw: '',
  }
}

function upper(s: string): string {
  return s.toUpperCase()
}

/** Digits → piso numeric form: ordinals become `Nº`, bare numbers stay as typed. */
function pisoFromDigits(digits: string, ordinal: boolean): string {
  return ordinal ? `${digits}º` : digits
}

export interface ParseDomicilioResult {
  /** The street-line remainder to pass to `searchAddresses` (CP stays in it). */
  query: string
  /** Parsed unit fields. */
  unidad: DomicilioUnit
  /** True when positional heuristics (no explicit marker) drove the parse. */
  heuristic: boolean
}

/**
 * Parse a noisy address string into `{ query, unidad }`.
 *
 * Algorithm: normalize for matching (display keeps originals), walk the token
 * stream with (1) explicit marker keywords, then (2) positional fallbacks:
 * first bare number → `numero` (letter suffix stays), following number/ordinal →
 * `piso`, isolated letter after a piso → `puerta`, `s/n` → `sin_numero`, and
 * `Bajo`/`Entresuelo`/`Ático`/`Sótano` are treated as piso values (never
 * numbers). A 5-digit token is a postal code and is left in `query`.
 */
export function parseDomicilio(text: string): ParseDomicilioResult {
  const tokens = tokenize(text)
  const unit = emptyUnit()
  const consumed = new Array<boolean>(tokens.length).fill(false)
  const take = (i: number): void => {
    consumed[i] = true
  }

  let heuristic = false
  let numeroAssigned = false

  /** Index of the next unconsumed token strictly after `from`, or -1. */
  const next = (from: number): number => {
    for (let j = from + 1; j < tokens.length; j++) if (!consumed[j]) return j
    return -1
  }

  const assignSimple = (
    slot: 'numero' | 'bloque' | 'portal' | 'escalera',
    value: string,
  ): void => {
    unit[slot] = value
  }

  /* ---- pass 1: explicit markers ---- */
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue
    const n = tokens[i].norm

    // "s/n", "sn", "sin número", "sin numero", "sin num"
    if (n === 's/n' || n === 'sn') {
      unit.sin_numero = true
      unit.numero = null
      take(i)
      continue
    }
    if (n === 'sin') {
      const nx = next(i)
      if (nx >= 0 && (tokens[nx].norm === 'numero' || tokens[nx].norm === 'num')) {
        unit.sin_numero = true
        unit.numero = null
        take(i)
        take(nx)
        i = nx
        continue
      }
    }

    // Marker keywords: consume the marker + (when present) its following value.
    if (NUMERO_MARKERS.has(n) && !unit.sin_numero) {
      const j = next(i)
      if (j >= 0) {
        const v = tokens[j].norm
        const nl = v.match(NUM_LETTER_RE)
        if (NUM_RE.test(v)) {
          unit.numero = v
          take(i); take(j); i = j; numeroAssigned = true
          continue
        }
        if (nl) {
          unit.numero = `${nl[1]} ${upper(nl[2])}`
          take(i); take(j); i = j; numeroAssigned = true
          continue
        }
      }
      continue
    }

    if (PISO_MARKERS.has(n)) {
      const j = next(i)
      if (j >= 0) {
        const v = tokens[j].norm
        const nl = v.match(NUM_LETTER_RE)
        const ord = v.match(ORDINAL_RE)
        if (nl) {
          unit.piso = pisoFromDigits(nl[1], false)
          unit.puerta = upper(nl[2])
          take(i); take(j); i = j
        } else if (ord) {
          unit.piso = pisoFromDigits(ord[1], true)
          take(i); take(j); i = j
        } else if (NUM_RE.test(v)) {
          unit.piso = pisoFromDigits(v, false)
          take(i); take(j); i = j
        } else if (PISO_WORD_CANON[v]) {
          unit.piso = PISO_WORD_CANON[v]
          take(i); take(j); i = j
        }
      }
      continue
    }

    if (PUERTA_MARKERS.has(n)) {
      const j = next(i)
      if (j >= 0) {
        const v = tokens[j].norm
        if (PUERTA_SIDE_CANON[v]) {
          unit.puerta = PUERTA_SIDE_CANON[v]
          take(i); take(j); i = j
        } else if (LETTER_RE.test(v)) {
          unit.puerta = upper(tokens[j].raw)
          take(i); take(j); i = j
        } else if (NUM_RE.test(v)) {
          unit.puerta = tokens[j].raw
          take(i); take(j); i = j
        }
      }
      continue
    }

    if (BLOQUE_MARKERS.has(n)) {
      const j = next(i)
      if (j >= 0) {
        const v = tokens[j].norm
        if (NUM_RE.test(v)) {
          assignSimple('bloque', v)
          take(i); take(j); i = j
        } else if (LETTER_RE.test(v)) {
          assignSimple('bloque', upper(tokens[j].raw))
          take(i); take(j); i = j
        }
      }
      continue
    }

    if (PORTAL_MARKERS.has(n)) {
      const j = next(i)
      if (j >= 0) {
        const v = tokens[j].norm
        if (NUM_RE.test(v)) {
          assignSimple('portal', v)
          take(i); take(j); i = j
        } else if (LETTER_RE.test(v)) {
          assignSimple('portal', upper(tokens[j].raw))
          take(i); take(j); i = j
        }
      }
      continue
    }

    if (ESCALERA_MARKERS.has(n)) {
      const j = next(i)
      if (j >= 0) {
        const v = tokens[j].norm
        if (NUM_RE.test(v)) {
          assignSimple('escalera', v)
          take(i); take(j); i = j
        } else if (LETTER_RE.test(v)) {
          assignSimple('escalera', upper(tokens[j].raw))
          take(i); take(j); i = j
        }
      }
      continue
    }

    if (KM_MARKERS.has(n)) {
      const j = next(i)
      if (j >= 0 && NUM_RE.test(tokens[j].norm)) {
        unit.kilometros = tokens[j].norm
        take(i); take(j); i = j
      }
      continue
    }
  }

  /* ---- pass 2: positional fallbacks over remaining tokens ---- */
  let expectNumeroLetter = false
  let expectPisoLetter = false

  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue
    const t = tokens[i]
    const v = t.norm

    // Postal code — leave in query (never a unit).
    if (CP_RE.test(v) && NUM_RE.test(v)) {
      expectNumeroLetter = false
      expectPisoLetter = false
      continue
    }

    const ol = v.match(ORDINAL_LETTER_RE)
    if (ol) {
      unit.piso = pisoFromDigits(ol[1], true)
      unit.puerta = upper(ol[2])
      take(i)
      heuristic = true
      expectNumeroLetter = false
      expectPisoLetter = true
      continue
    }

    const ord = v.match(ORDINAL_RE)
    if (ord) {
      unit.piso = pisoFromDigits(ord[1], true)
      take(i)
      heuristic = true
      expectNumeroLetter = false
      expectPisoLetter = true
      continue
    }

    const nl = v.match(NUM_LETTER_RE)
    if (nl) {
      if (!numeroAssigned && !unit.numero && !unit.sin_numero) {
        unit.numero = `${nl[1]} ${upper(nl[2])}`
        numeroAssigned = true
        expectNumeroLetter = false
        take(i)
      } else {
        unit.piso = pisoFromDigits(nl[1], false)
        unit.puerta = upper(nl[2])
        expectPisoLetter = true
        expectNumeroLetter = false
        take(i)
      }
      heuristic = true
      continue
    }

    if (NUM_RE.test(v)) {
      if (!numeroAssigned && !unit.numero && !unit.sin_numero) {
        unit.numero = v
        numeroAssigned = true
        expectNumeroLetter = true
        take(i)
      } else {
        unit.piso = pisoFromDigits(v, false)
        expectPisoLetter = true
        expectNumeroLetter = false
        take(i)
      }
      heuristic = true
      continue
    }

    if (LETTER_RE.test(v)) {
      if (expectNumeroLetter && unit.numero) {
        unit.numero = `${unit.numero} ${upper(t.raw)}`
        expectNumeroLetter = false
        take(i)
        continue
      }
      if (expectPisoLetter || (unit.piso && !unit.puerta)) {
        unit.puerta = upper(t.raw)
        expectPisoLetter = false
        expectNumeroLetter = false
        take(i)
        continue
      }
      continue
    }

    if (PISO_WORD_CANON[v]) {
      unit.piso = PISO_WORD_CANON[v]
      expectPisoLetter = true
      expectNumeroLetter = false
      take(i)
      heuristic = true
      continue
    }

    if (PUERTA_SIDE_CANON[v]) {
      unit.puerta = PUERTA_SIDE_CANON[v]
      expectPisoLetter = false
      expectNumeroLetter = false
      take(i)
      heuristic = true
      continue
    }

    // anything else: street / municipio / provincia text — stays in the query
    expectNumeroLetter = false
    expectPisoLetter = false
  }

  const query = tokens.filter((_, i) => !consumed[i]).map((t) => t.raw).join(' ')
  unit.unidad_raw = tokens.filter((_, i) => consumed[i]).map((t) => t.raw).join(' ')

  return { query, unidad: unit, heuristic }
}

/** Strip a 5-digit postal code from the text query (it routes to `filterByCP`). */
function extractCp(query: string): { query: string; cp?: string } {
  const m = query.match(/\b\d{5}\b/)
  if (!m) return { query }
  return { query: query.replace(/\b\d{5}\b/g, ' ').replace(/\s+/g, ' ').trim(), cp: m[0] }
}

/** Normalize deps: only what `normalizeDomicilio` needs beyond search. */
export interface NormalizeDomicilioDeps extends SearchDependencies {
  /** Injectable search fn (tests swap for a fake). */
  search?: typeof searchAddresses
}

/**
 * Compose `parseDomicilio` → `searchAddresses` → merge the top hit with the
 * parsed unit into a `DireccionNormalizada`. Returns `null` when the query
 * yields no street match.
 */
export async function normalizeDomicilio(
  text: string,
  deps: NormalizeDomicilioDeps = {},
  opts?: { filterByProvincia?: string },
): Promise<DireccionNormalizada | null> {
  const { query: rawQuery, unidad, heuristic } = parseDomicilio(text)
  const { query, cp } = extractCp(rawQuery)
  if (!query) return null

  const options: SearchOptions = {
    query,
    perPage: 5,
    filterByCP: cp,
    filterByProvincia: opts?.filterByProvincia,
  }
  const run = deps.search ?? searchAddresses
  const result = await run(options, deps)
  const record = result.records[0]
  if (!record) return null

  return merge(record, unidad, heuristic ? 'parcial' : 'exact')
}

/** Merge a matched street record with a parsed unit into `DireccionNormalizada`. */
export function merge(
  record: AddressRecord,
  unidad: DomicilioUnit,
  confidence: 'exact' | 'parcial',
): DireccionNormalizada {
  return {
    ...record,
    numero: unidad.numero,
    piso: unidad.piso,
    puerta: unidad.puerta,
    escalera: unidad.escalera,
    bloque: unidad.bloque,
    portal: unidad.portal,
    kilometros: unidad.kilometros,
    sin_numero: unidad.sin_numero,
    unidad_raw: unidad.unidad_raw,
    confidence,
  }
}
