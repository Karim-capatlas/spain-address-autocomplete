/**
 * Shared domain types for spain-address.
 *
 * The search surface is intentionally framework-agnostic: `packages/widget`
 * and `packages/react` both wrap `searchAddresses` from this package.
 */

export interface AddressRecord {
  id: string // sha1-derived 16-hex, e.g. "a3f1b2c4d5e6f7a8"
  via_nombre: string // title-cased, primary search field
  via_tipo: string // "Calle"
  via_nombre_completo: string // "Calle Gran Vía"
  municipio: string // "Madrid"
  municipio_id: string // "28079" (INE CPRO+CMUN)
  provincia: string // "Madrid"
  provincia_id: string // "28"
  comunidad_autonoma: string // "Comunidad de Madrid"
  comunidad_autonoma_id: string // "13"
  codigo_postal: string // "28013"
  label: string // "Calle Gran Vía, Madrid (28013)"
  lat?: number // optional, from CartoCiudad or INE geopoint
  lon?: number
  /** Typesense highlight snippets for this hit (present only when the `highlight`
   *  SearchOption was requested). Each entry wraps a matched field's matched
   *  tokens in `<mark>…</mark>`, e.g. `"<mark>Calle</mark> Mayor"`. */
  highlights?: Highlight[]
}

/** A Typesense highlight entry: a field's text with `<mark>`-wrapped matched tokens. */
export interface Highlight {
  field: string
  snippet: string
  matches: number
}

/**
 * Parsed unit ("datos del domicilio") extracted from the *input* address text.
 *
 * The INE Callejero carries no portal numbers, so these fields can never be
 * indexed — they only exist on the input side and are produced by
 * `parseDomicilio` (deterministic rule-based parser, zero runtime deps).
 */
export interface DomicilioUnit {
  /** Street number, e.g. `"12"`, `"259 D"` (letter suffix kept on `numero`). */
  numero: string | null
  /** Floor/planta, e.g. `"4º"`, `"Bajo"`, `"Entresuelo"`, `"Ático"`, `"Sótano"`. */
  piso: string | null
  /** Door, e.g. `"B"`, `"Izq"`, `"Dcha"`. */
  puerta: string | null
  /** Stairwell, e.g. `"1"`, `"A"`. */
  escalera: string | null
  /** Block, e.g. `"3"`. */
  bloque: string | null
  /** Portal, e.g. `"2"`. */
  portal: string | null
  /** Road Km point, e.g. `"4"`. */
  kilometros: string | null
  /** True when the input declares "S/N" / "s/n" / "sin número". */
  sin_numero: boolean
  /** Lossless original unit substring (e.g. `"12 4º B"`) — never normalized. */
  unidad_raw: string
}

/**
 * A matched street (`AddressRecord`) merged with the parsed unit. This is the
 * payload returned by `normalize_address` and the `addressNormalized` event.
 */
export interface DireccionNormalizada extends AddressRecord {
  numero: string | null
  piso: string | null
  puerta: string | null
  escalera: string | null
  bloque: string | null
  portal: string | null
  kilometros: string | null
  sin_numero: boolean
  unidad_raw: string
  /** `'exact'` when driven by explicit markers; `'parcial'` for positional heuristics. */
  confidence: 'exact' | 'parcial'
}

export interface SearchOptions {
  query: string
  perPage?: number
  filterByProvincia?: string
  filterByMunicipio?: string
  filterByCP?: string
  /** Max streets returned per municipio group (forwarded to Typesense `group_limit`). */
  groupLimit?: number
  /** Request Typesense highlights (`highlight:true` + `highlight_full:true`) so
   *  matched tokens are wrapped in `<mark>` snippets on each hit (§3.1.7). */
  highlight?: boolean
}

/** A municipio group from a `group_by=municipio_id` search. */
export interface SearchGroup {
  /** INE municipality id (`group_key[0]`), e.g. `28079`. */
  municipio_id: string
  municipio: string
  provincia: string
  provincia_id: string
  /** Representative postal code (first hit's `codigo_postal`). */
  codigo_postal: string
  /** Number of documents matched within the group. */
  found: number
  /** Up to `group_limit` records in this group. */
  items: AddressRecord[]
}

export interface SearchResult {
  records: AddressRecord[]
  /** Municipio groups (present only when `group_by=municipio_id`). Empty otherwise. */
  groups: SearchGroup[]
  total: number
  took_ms: number
}

/** Raw hit shape returned by the Typesense `/documents/search` REST endpoint. */
export interface SearchHit {
  document: Record<string, unknown>
  highlights?: Highlight[]
  text_match?: number
}

/** Raw response from the Typesense search REST endpoint. */
export interface SearchResponse {
  found: number
  hits?: SearchHit[]
  search_time_ms?: number
  request_params?: Record<string, unknown>
}
