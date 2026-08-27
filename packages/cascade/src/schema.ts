/**
 * RediSearch schema for the dedicated `cascade_es` index.
 *
 * Separate from `callejero_es` (street search): different hash prefix
 * (`cascade:`), different schema, ~18K docs vs 749K. All docs carry a `type`
 * discriminator. `id` is a TAG (queried with `@id:{…}`, exact match), `name` is
 * the only indexed TEXT, and `municipios` on CP docs is a multi-value TAG
 * (comma-joined in the hash, split by RediSearch) for the CP ↔ municipio
 * junction.
 */

export const CASCADE_INDEX = 'cascade_es'

export const CASCADE_PREFIX = 'cascade:'

export type CascadeDocType = 'provincia' | 'municipio' | 'cp'

interface CascadeField {
  name: string
  type: 'TEXT' | 'TAG'
}

export const CASCADE_SCHEMA: CascadeField[] = [
  { name: 'id', type: 'TAG' },
  { name: 'type', type: 'TAG' },
  { name: 'name', type: 'TEXT' },
  { name: 'cpro', type: 'TAG' },
  { name: 'ccaa_id', type: 'TAG' },
  { name: 'municipios', type: 'TAG' },
]

/**
 * Render the full FT.CREATE argument vector for `cascade_es`, including the
 * `ON HASH PREFIX 1 cascade:` scoping so it never indexes the `callejero:`
 * street hashes.
 */
export function buildCascadeFtCreateArgs(): string[] {
  const args = [CASCADE_INDEX, 'ON', 'HASH', 'PREFIX', '1', CASCADE_PREFIX, 'SCHEMA']
  for (const f of CASCADE_SCHEMA) args.push(f.name, f.type)
  return args
}

/** Sensible hash key helpers (used by the import CLI and the store). */
export function provinciaKey(id: string): string {
  return `${CASCADE_PREFIX}p:${id}`
}

export function municipioKey(id: string): string {
  return `${CASCADE_PREFIX}m:${id}`
}

export function cpKey(id: string): string {
  return `${CASCADE_PREFIX}cp:${id}`
}