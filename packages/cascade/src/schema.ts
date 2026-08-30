/**
 * Typesense collection schema for the dedicated `cascade_es` index.
 *
 * Separate from `callejero_es` (street search) — different collection, a smaller
 * schema, ~18K docs vs 749K. All docs carry a `type` discriminator so one
 * collection holds provincia / municipio / cp records. `id` doubles as the
 * document id (the code itself: "01", "28079", "28001").
 *
 * The cascade server talks to this collection over **HTTP** (Typesense REST),
 * so it is reachable from a Cloudflare Worker over a Tunnel — unlike a
 * self-hosted RediSearch index, which only speaks RESP/TCP and is not
 * Worker-reachable.
 */

import type { TypesenseSchema } from '@spain-address/core'
import type { CascadeDocType } from './types.js'

export const CASCADE_COLLECTION = 'cascade_es'

/** INE discriminator stored on every cascade doc (re-exported for convenience). */
export type { CascadeDocType }

// NOTE: the document `id` is reserved by Typesense (set in the doc body / used as
// the record id, always returned) — it must NOT be declared as a schema field.
// The bare code lives in a separate `code` field, and the reserved `id` is the
// composite `type:code` (e.g. "cp:28013", "municipio:28079") so that a CP code
// and a municipio code that share digits (both are `CPRO+xxx`) never collide on
// upsert — a bare `id` would let a CP overwrite a municipio of the same code.
export const cascadeSchema: TypesenseSchema = {
  name: CASCADE_COLLECTION,
  fields: [
    { name: 'type', type: 'string', facet: true },
    { name: 'code', type: 'string' },
    { name: 'name', type: 'string', optional: true },
    { name: 'cpro', type: 'string', facet: true, optional: true },
    { name: 'ccaa_id', type: 'string', facet: true, optional: true },
    { name: 'ccaa_name', type: 'string', optional: true },
    // Multi-value: the CP ↔ municipio junction (a CP can span several municipios).
    { name: 'municipios', type: 'string[]', facet: true, optional: true },
  ],
}
