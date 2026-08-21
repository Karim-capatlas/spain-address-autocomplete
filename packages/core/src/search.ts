/**
 * High-level address search over the Typesense `callejero_es` collection.
 *
 * `searchAddresses` is the single entry point consumed by the widget packages.
 * It depends on the abstract `TypesenseClient` (see `./typesense.ts`), so it can
 * be unit-tested by injecting a fake client — no live Typesense required.
 */

import type { TypesenseClient, TypesenseSearchResponse } from './typesense.js'
import type { AddressRecord, Highlight, SearchGroup, SearchOptions, SearchResult } from './types.js'

// Mirrors the schema in packages/typesense/src/schema.ts (the indexed fields
// must match what `typesense:import` writes).
export const SEARCH_QUERY_BY = 'via_nombre,via_nombre_completo,municipio,provincia'
export const SEARCH_QUERY_BY_WEIGHTS = '5,3,1,1'
export const SEARCH_GROUP_BY = 'municipio_id'
export const SEARCH_GROUP_LIMIT = 3

/**
 * Extract the municipio groups from a Typesense `group_by=municipio_id`
 * response. Each group carries its `group_key` (the municipio_id), the
 * representative municipio/provincia/CP from its top hit, and up to
 * `group_limit` `AddressRecord` items. Returns `[]` for non-grouped responses.
 */
function extractGroups(response: TypesenseSearchResponse): SearchGroup[] {
  if (!response.grouped_hits) return []
  return response.grouped_hits.map((group) => {
    const items = group.hits.map((hit) => toAddressRecord(hit.document, hit.highlights))
    const first = items[0] ?? ({} as AddressRecord)
    return {
      municipio_id: String(group.group_key?.[0] ?? first.municipio_id ?? ''),
      municipio: first.municipio ?? '',
      provincia: first.provincia ?? '',
      provincia_id: first.provincia_id ?? '',
      codigo_postal: first.codigo_postal ?? '',
      found: group.found,
      items,
    }
  })
}

export interface SearchDependencies {
  client: TypesenseClient
  collection?: string
}

/**
 * Convert a Typesense hit document (`Record<string, unknown>`) into a typed
 * `AddressRecord`. Typesense returns every value as a string; we pass them
 * through unchanged — consumers coerce `lat`/`lon` lazily if needed.
 */
function toAddressRecord(doc: Record<string, unknown>, highlights?: Highlight[]): AddressRecord {
  const id = String(doc.id ?? '')
  return {
    id,
    via_nombre: String(doc.via_nombre ?? ''),
    via_tipo: String(doc.via_tipo ?? ''),
    via_nombre_completo: String(doc.via_nombre_completo ?? ''),
    municipio: String(doc.municipio ?? ''),
    municipio_id: String(doc.municipio_id ?? ''),
    provincia: String(doc.provincia ?? ''),
    provincia_id: String(doc.provincia_id ?? ''),
    comunidad_autonoma: String(doc.comunidad_autonoma ?? ''),
    comunidad_autonoma_id: String(doc.comunidad_autonoma_id ?? ''),
    codigo_postal: String(doc.codigo_postal ?? ''),
    label: String(doc.label ?? ''),
    lat: doc.lat != null ? Number(doc.lat) : undefined,
    lon: doc.lon != null ? Number(doc.lon) : undefined,
    highlights,
  }
}

/** Compose a Typesense `filter_by` expression from the structured options. */
export function buildFilter(options: SearchOptions): string | undefined {
  const terms: string[] = []
  if (options.filterByProvincia) {
    terms.push(`provincia_id:=["${options.filterByProvincia}"]`)
  }
  if (options.filterByMunicipio) {
    terms.push(`municipio_id:=["${options.filterByMunicipio}"]`)
  }
  if (options.filterByCP) {
    terms.push(`codigo_postal:=["${options.filterByCP}"]`)
  }
  return terms.length ? terms.join(' && ') : undefined
}

/**
 * Extract `AddressRecord`s from a Typesense search response, handling both the
 * plain (`hits[].document`) and grouped (`grouped_hits[].hits[].document`)
 * shapes that the `group_by=municipio_id` option produces.
 */
function extractRecords(response: TypesenseSearchResponse): AddressRecord[] {
  const records: AddressRecord[] = []
  if (response.grouped_hits) {
    for (const group of response.grouped_hits) {
      for (const hit of group.hits) {
        records.push(toAddressRecord(hit.document, hit.highlights))
      }
    }
  } else {
    for (const hit of response.hits ?? []) {
      records.push(toAddressRecord(hit.document, hit.highlights))
    }
  }
  return records
}

export async function searchAddresses(
  options: SearchOptions,
  deps: SearchDependencies,
): Promise<SearchResult> {
  const collection = deps.collection ?? 'callejero_es'
  const params: Record<string, string | number | boolean | undefined> = {
    q: options.query,
    query_by: SEARCH_QUERY_BY,
    query_by_weights: SEARCH_QUERY_BY_WEIGHTS,
    per_page: options.perPage ?? 10,
    group_by: SEARCH_GROUP_BY,
    group_limit: options.groupLimit ?? SEARCH_GROUP_LIMIT,
    sort: '_text_match:desc',
    prefix: true,
    num_typos: 1,
    filter_by: buildFilter(options),
    // §3.1.7: opt-in matched-token highlighting. The live Typesense server returns
    // `<mark>`-wrapped snippets by default (it ignores a custom `highlight_affix`),
    // so the widget renders the default markup directly.
    ...(options.highlight ? { highlight: true, highlight_full: true } : {}),
  }

  const start = Date.now()
  const response = await deps.client.search(collection, params)
  const records = extractRecords(response)
  return {
    records,
    groups: extractGroups(response),
    total: response.found_docs ?? response.found ?? 0,
    took_ms: Date.now() - start,
  }
}
