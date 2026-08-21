/**
 * Typesense schema + ingestion primitives for the `callejero_es` collection.
 *
 * The HTTP client and the high-level `searchAddresses` wrapper live in
 * `@spain-address/core`; this package owns the collection schema (see
 * `schema.ts`) and the bulk-import CLI (`import.ts`).
 */

export { callejeroEsSchema, TYPESENSE_COLLECTION } from './schema.js'
export type { TypesenseSchema } from '@spain-address/core'
