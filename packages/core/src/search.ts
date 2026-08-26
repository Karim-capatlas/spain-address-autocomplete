/**
 * Address search entry point (backend-agnostic).
 *
 * `searchAddresses` is the single entry point consumed by the widget, MCP
 * server, and proxy. As of Phase 3.5 it dispatches to whichever backend a
 * caller provides:
 *  - Upstash / Redis Search: when `deps.command` (a transport-agnostic command
 *    fn) is supplied — the preferred backend.
 *  - Typesense: when `deps.client` (a `TypesenseClient`) is supplied — kept for
 *    backward compatibility and the widget's direct mode.
 *
 * Inject a fake `command`/`client` to unit-test without a live server.
 */

import type { TypesenseClient, TypesenseSearchResponse } from './typesense.js'
import { toAddressRecord } from './record.js'
import type { SearchCommand } from './redis.js'
import type { Highlight, AddressRecord, SearchGroup, SearchOptions, SearchResult } from './types.js'

// Mirrors the schema in packages/typesense/src/schema.ts (the indexed fields
// must match what `typesense:import` writes).
export const SEARCH_QUERY_BY = 'via_nombre,via_nombre_completo,municipio,provincia'
export const SEARCH_QUERY_BY_WEIGHTS = '5,3,1,1'
export const SEARCH_GROUP_BY = 'municipio_id'
export const SEARCH_GROUP_LIMIT = 3

export interface SearchDependencies {
  /** Typesense backend (widget direct mode + local fallback). */
  client?: TypesenseClient
  /** Collection name override for the Typesense backend. */
  collection?: string
  /** Upstash / Redis Search backend (Phase 3.5 default when configured). */
  command?: SearchCommand
  /** Index override for the Upstash / Redis Search backend. */
  index?: string
}

/**
 * Convert a Typesense hit document into a typed `AddressRecord`, attaching the
 * `<mark>`-wrapped highlight snippets Typesense returns per hit.
 */
function toTypesenseRecord(
  doc: Record<string, unknown>,
  highlights?: Highlight[],
): AddressRecord {
  return toAddressRecord(doc, highlights)
}

/** Extract the municipio groups from a Typesense `group_by=municipio_id` response. */
function extractGroups(response: TypesenseSearchResponse): SearchGroup[] {
  if (!response.grouped_hits) return []
  return response.grouped_hits.map((group) => {
    const items = group.hits.map((hit) =>
      toTypesenseRecord(hit.document, hit.highlights),
    )
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
        records.push(toTypesenseRecord(hit.document, hit.highlights))
      }
    }
  } else {
    for (const hit of response.hits ?? []) {
      records.push(toTypesenseRecord(hit.document, hit.highlights))
    }
  }
  return records
}

/** Extract the Upstash search deps from the dispatch-style `SearchDependencies`. */
function upstashDeps(deps: SearchDependencies): { command: SearchCommand; index?: string } {
  const command = deps.command
  if (!command) throw new Error('Upstash backend requires a deps.command function')
  return { command, index: deps.index }
}


export async function searchAddresses(
  options: SearchOptions,
  deps: SearchDependencies,
): Promise<SearchResult> {
  // Phase 3.5 default: prefer Upstash / Redis Search when a command fn is wired.
  // The Upstash implementation is lazy-imported so backends that only use
  // Typesense (e.g. the browser widget's direct mode) never pull the Upstash
  // REST client into their bundle.
  if (deps.command) {
    const { searchAddressesUpstash } = await import('./redis.js')
    return searchAddressesUpstash(options, upstashDeps(deps))
  }
  if (deps.client) {
    return searchAddressesTypesense(options, deps)
  }
  throw new Error(
    'searchAddresses: no backend configured — provide deps.command (Upstash) or deps.client (Typesense)',
  )
}

export async function searchAddressesTypesense(
  options: SearchOptions,
  deps: SearchDependencies,
): Promise<SearchResult> {
  const collection = deps.collection ?? 'callejero_es'
  const client = deps.client as TypesenseClient
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
  const response = await client.search(collection, params)
  const records = extractRecords(response)
  return {
    records,
    groups: extractGroups(response),
    total: response.found_docs ?? response.found ?? 0,
    took_ms: Date.now() - start,
  }
}
