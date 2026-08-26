/**
 * Upstash Redis Search schema for the `callejero_es` index (Phase 3.5).
 *
 * Mirrors the Typesense collection in `packages/typesense/src/schema.ts`,
 * translated per the AGENTS.md migration map:
 * - `query_by` weights 5/3/1/1 → TEXT fields with WEIGHT
 * - `infix: true` → `$fuzzy` query operator at search time (Levenshtein 1–2)
 * - `facet: true` on ids/CP → TAG fields for exact-match filtering
 */

export const UPSTASH_INDEX = 'callejero_es'

/** A single field of the Redis Search index. */
export interface UpstashField {
  name: string
  type: 'TEXT' | 'TAG' | 'NUMERIC' | 'GEO'
  weight?: number
  sortable?: boolean
}

/**
 * Field list for `FT.CREATE callejero_es ... SCHEMA`.
 *
 * Weights mirror Typesense's `query_by_weights: 5,3,1,1`
 * (via_nombre > via_nombre_completo > municipio ≈ provincia).
 * Tag fields (`municipio_id`, `provincia_id`, `codigo_postal`) back the
 * exact-match filters that Typesense handled with facets.
 */
export const CALLEJERO_ES_SCHEMA: UpstashField[] = [
  { name: 'via_nombre', type: 'TEXT', weight: 5.0 },
  { name: 'via_nombre_completo', type: 'TEXT', weight: 3.0 },
  { name: 'municipio', type: 'TEXT', weight: 1.0 },
  { name: 'provincia', type: 'TEXT', weight: 1.0 },
  // Stored-only text (no index) — returned verbatim in results:
  { name: 'via_tipo', type: 'TAG' },
  { name: 'municipio_id', type: 'TAG' },
  { name: 'provincia_id', type: 'TAG' },
  { name: 'comunidad_autonoma_id', type: 'TAG' },
  { name: 'codigo_postal', type: 'TAG' },
]

/**
 * Render the FT.CREATE argument vector for the schema. Kept as an array of
 * strings so the REST client can JSON-encode it into an Upstash pipeline
 * command without shell/quoting concerns.
 */
export function buildFtCreateArgs(index = UPSTASH_INDEX): string[] {
  const args: string[] = [index]
  for (const field of CALLEJERO_ES_SCHEMA) {
    args.push(field.name, field.type)
    if (field.weight !== undefined) args.push('WEIGHT', String(field.weight))
    if (field.sortable) args.push('SORTABLE')
  }
  return args
}
