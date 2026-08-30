/**
 * Typesense-backed `CascadeStore` for the `cascade_es` collection.
 *
 * Replaces the old ioredis/RESP store. The cascade server only ever performs
 * exact lookups — provincia list, municipios-by-provincia, CPs-by-municipio, and
 * CP-by-id — all expressible as a `filter_by` expression with `q='*'` (match-all).
 * Because Typesense speaks HTTP/REST, this store is reachable from a Cloudflare
 * Worker (over a Tunnel), which a raw-Redis/RESP store is not.
 *
 * Note: Typesense's document `id` is reserved and not filterable via
 * `filter_by`. An `id` lookup (`/validate-cp`) therefore uses a direct
 * `GET /collections/:name/documents/:id` instead.
 */

import type { TypesenseClient } from '@spain-address/core'
import { CASCADE_COLLECTION } from './schema.js'
import type { CascadeFilter, CascadeStore, SearchDoc } from './types.js'

export interface TypesenseCascadeStoreOptions {
  client: TypesenseClient
  /** Collection to query (defaults to `cascade_es`). */
  collection?: string
}

/** Compose the Typesense `filter_by` expression for a structured `CascadeFilter`.
 * Does not include `id` (Typesense treats `id` as a reserved, non-filterable
 * field — id lookups go through `client.getDocument`). */
export function filterToTypeSense(filter: CascadeFilter): string {
  const terms: string[] = [`type:=${filter.type}`]
  if (filter.cpro) terms.push(`cpro:=${filter.cpro}`)
  // `municipios` is a `string[]` field: `:=` tests array membership.
  if (filter.municipios) terms.push(`municipios:=${filter.municipios}`)
  return terms.join(' && ')
}

export function createTypesenseCascadeStore(opts: TypesenseCascadeStoreOptions): CascadeStore {
  const collection = opts.collection ?? CASCADE_COLLECTION
  return {
    async search(filter, returnFields, limit) {
      // Direct id lookup (CP validation): fetch by the composite doc id
      // `type:code` (Typesense treats `id` as reserved, not filterable). The
      // handler passes the bare `code` (e.g. "28013"); we scope it by type so a
      // CP and a municipio that share a 5-digit code never collide.
      if (filter.id) {
        const doc = await opts.client.getDocument(collection, `${filter.type}:${filter.id}`)
        if (!doc) return []
        return [
          {
            id: `cascade:${filter.type}:0`,
            fields: stringifyFields(doc, returnFields),
          },
        ]
      }

      // Match-all query by type (+ optional cpro/municipios). Typesense caps
      // `per_page` at 250 (a 422 otherwise), so paginate internally — some
      // provinces have >250 municipios (e.g. Barcelona ~311).
      const PAGE_SIZE = 250
      const max = limit ?? Number.MAX_SAFE_INTEGER
      const out: SearchDoc[] = []
      let page = 1
      for (;;) {
        const params: Record<string, string | number | boolean | undefined> = {
          q: '*',
          filter_by: filterToTypeSense(filter),
          per_page: PAGE_SIZE,
          page,
        }
        if (returnFields.length > 0) {
          params.include_fields = returnFields.join(',')
        }
        const res = await opts.client.search(collection, params)
        for (const h of res.hits ?? []) {
          out.push({
            id: `cascade:${filter.type}:${out.length}`,
            fields: stringifyFields(h.document, returnFields),
          })
          if (out.length >= max) return out
        }
        // Stop when we've collected enough, or when a page is short / empty.
        if (out.length >= max) return out
        if (!res.hits || res.hits.length < PAGE_SIZE) break
        page++
      }
      return out
    },
  }
}

/** Project a Typesense hit down to the requested string fields. Array values
 * (e.g. `municipios`) are comma-joined to match the `CascadeStore` contract
 * (`fields.municipios.split(',')` in the validate-cp handler). */
function stringifyFields(doc: Record<string, unknown>, returnFields: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of returnFields) {
    if (Object.prototype.hasOwnProperty.call(doc, f)) {
      out[f] = stringifyValue(doc[f])
    }
  }
  return out
}

function stringifyValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(stringifyValue).join(',')
  if (v == null) return ''
  return String(v)
}
