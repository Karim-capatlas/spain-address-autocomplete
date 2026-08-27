/** Shape produced by the data generators (provincia / municipio / cp).
 *
 * These fields are consumed by `import.ts` to emit Redis hashes + `FT.CREATE`.
 * They are **not** the same as `AddressRecord` (which is the street-search doc
 * shape in core) — the cascade index is separate (`cascade_es`, ~18K docs).
 */

/** One provincia doc for the `cascade_es` index. */
export interface ProvinciaDoc {
  type: 'provincia'
  id: string          // CPRO, 2-digit (e.g. "01")
  name: string        // "Álava"
  ccaa_id: string     // e.g. "17"
  ccaa_name: string   // "País Vasco"
}

/** One municipio doc for the `cascade_es` index. */
export interface MunicipioDoc {
  type: 'municipio'
  id: string          // 5-digit INE code: CPRO + CMUN (e.g. "28079")
  cpro: string        // 2-digit province (e.g. "28")
  cmum: string        // 3-digit municipality ordinal (e.g. "079")
  name: string        // "Madrid"
  ccaa_id: string
  ccaa_name: string
}

/** One CP doc for the `cascade_es` index. `municipios` is multi-value
 * (a CP can span several municipios in rural dissemination zones). */
export interface CPDoc {
  type: 'cp'
  id: string          // 5-digit CP (e.g. "28001")
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
