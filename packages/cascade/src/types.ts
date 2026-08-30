/** Shape produced by the data generators (provincia / municipio / cp).
 *
 * These fields are consumed by `import.ts` to emit Typesense documents into the
 * `cascade_es` collection. They are **not** the same as `AddressRecord` (which is
 * the street-search doc shape in core) — the cascade collection is separate
 * (~18K docs: 52 provincias / ~8.1K municipios / ~10.1K CPs).
 */

/** One provincia doc for the `cascade_es` index. */
export interface ProvinciaDoc {
  type: 'provincia'
  id: string // CPRO, 2-digit (e.g. "01")
  name: string // "Álava"
  ccaa_id: string // e.g. "17"
  ccaa_name: string // "País Vasco"
}

/** One municipio doc for the `cascade_es` index. */
export interface MunicipioDoc {
  type: 'municipio'
  id: string // 5-digit INE code: CPRO + CMUN (e.g. "28079")
  cpro: string // 2-digit province (e.g. "28")
  cmum: string // 3-digit municipality ordinal (e.g. "079")
  name: string // "Madrid"
  ccaa_id: string
  ccaa_name: string
}

/** One CP doc for the `cascade_es` index. `municipios` is multi-value
 * (a CP can span several municipios in rural dissemination zones). */
export interface CPDoc {
  type: 'cp'
  id: string // 5-digit CP (e.g. "28001")
  municipios: string[] // list of municipio ids that contain this CP
}

/** The flat set of docs fed to `import.ts` (or replayed locally for tests). */
export type GeneratorInput = {
  provincias: ProvinciaDoc[]
  municipios: MunicipioDoc[]
  cps: CPDoc[]
}

/** Return from `/api/geo/validate-cp`. */
export interface ValidateCPResult {
  valid: boolean
  ineCode: string | null
}

/** Return shape for `GET /api/geo/provincias`. */
export interface ProvinciaListItem {
  code: string
  name: string
  ccaa: string
}

/** Return shape for `GET /api/geo/municipios`. */
export interface MunicipioListItem {
  code: string
  name: string
  ccaa: string
}

/** A single doc returned by the store — id + the projected hash fields. */
export interface SearchDoc {
  /** Store-local doc reference (e.g. a hash key). */
  id: string
  /** Projected fields, stringified. */
  fields: Record<string, string>
}

/** 5-digit INE municipio id (CPRO + CMUN), e.g. "28079". */
export type CascadeDocType = 'provincia' | 'municipio' | 'cp'

/** Structured filter carried to the store — a typed replacement for the old
 * REDISEARCH `@type:{x} @cpro:{y}` query strings. Maps directly onto a
 * Typesense `filter_by` expression. */
export interface CascadeFilter {
  type: CascadeDocType
  /** CPRO province code (2-digit, padded). */
  cpro?: string
  /** Municipio id used as a multi-value member test on CP docs. */
  municipios?: string
  /** Exact doc id (used by `/validate-cp`). */
  id?: string
}

/** Storage seam for the cascade server — backend-agnostic so handlers stay
 * unit-testable with a fake store (no live Typesense needed). */
export interface CascadeStore {
  search(
    filter: CascadeFilter,
    returnFields: readonly string[],
    limit?: number,
  ): Promise<SearchDoc[]>
}
