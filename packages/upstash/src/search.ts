/**
 * Redis Search (FT.SEARCH / FT.AGGREGATE) query building + response parsing
 * for the `callejero_es` index. Mirrors `packages/core/src/search.ts`
 * semantics: weighted text match on via/municipio/provincia, fuzzy for OCR
 * typos, TAG filters, municipio grouping.
 */

import type { AddressRecord, SearchGroup, SearchResult } from '@spain-address/core'

export const UPSTASH_INDEX = 'callejero_es'
export const DEFAULT_PER_PAGE = 10
export const DEFAULT_GROUP_LIMIT = 3

export interface UpstashSearchOptions {
  query: string
  perPage?: number
  filterByProvincia?: string
  filterByMunicipio?: string
  filterByCP?: string
  /** Max streets returned per municipio group. */
  groupLimit?: number
}

/** Escape Redis Search special characters in a user query term. */
function escapeTerm(term: string): string {
  return term.replace(/[-@#$%^&*()+=[\]{};:'"\\|,.<>/?`~!_]/g, (c) => `\\${c}`)
}

/** Compose the TAG filter clause from the structured options. */
export function buildFilterClause(options: UpstashSearchOptions): string | undefined {
  const terms: string[] = []
  if (options.filterByProvincia) terms.push(`@provincia_id:{${options.filterByProvincia}}`)
  if (options.filterByMunicipio) terms.push(`@municipio_id:{${options.filterByMunicipio}}`)
  if (options.filterByCP) terms.push(`@codigo_postal:{${options.filterByCP}}`)
  return terms.length ? terms.join(' ') : undefined
}

/**
 * Build the FT.SEARCH argument vector.
 *
 * The raw query is split into words joined by `%term%` — the `$fuzzy`
 * operator syntax (Levenshtein distance 1) giving the same OCR-typo
 * tolerance Typesense's `num_typos:1` provided.
 */
export function buildSearchArgs(
  options: UpstashSearchOptions,
  index = UPSTASH_INDEX,
): string[] {
  const words = options.query.trim().split(/\s+/).filter(Boolean)
  const fuzzyQuery = words.map((w) => `%${escapeTerm(w)}%`).join(' ')
  const filter = buildFilterClause(options)
  const fullQuery = filter ? `${filter} ${fuzzyQuery}` : fuzzyQuery

  return [
    'FT.SEARCH',
    index,
    fullQuery,
    'LIMIT',
    '0',
    String(options.perPage ?? DEFAULT_PER_PAGE),
    'SORTBY',
    'via_nombre_completo',
    'ASC',
    'DIALECT',
    '2',
  ]
}

type RawDoc = Record<string, unknown>

/** Decode an FT.SEARCH reply `[total, key, fields, ...]` into records. */
export function parseSearchReply(reply: unknown): { total: number; records: AddressRecord[] } {
  if (!Array.isArray(reply)) return { total: 0, records: [] }
  const total = Number(reply[0] ?? 0)
  const records: AddressRecord[] = []
  // Reply shape with docs: [total, id1, doc1, id2, doc2, …]
  for (let i = 2; i < reply.length; i += 2) {
    const docRaw = reply[i]
    let doc: RawDoc
    if (Array.isArray(docRaw)) {
      // Flat [field, value, field, value] array form
      doc = {}
      for (let j = 0; j < docRaw.length; j += 2) {
        doc[String(docRaw[j])] = docRaw[j + 1]
      }
    } else if (docRaw && typeof docRaw === 'object') {
      doc = docRaw as RawDoc
    } else {
      continue
    }
    records.push(toAddressRecord(doc))
  }
  return { total, records }
}

/** Convert a stored-hash document into a typed `AddressRecord`. */
export function toAddressRecord(doc: RawDoc): AddressRecord {
  return {
    id: String(doc.id ?? ''),
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
  }
}

/**
 * Group flat records by `municipio_id`, preserving first-appearance order and
 * capping each group at `groupLimit` items — the client-side equivalent of
 * Typesense's `group_by=municipio_id`.
 */
export function groupRecords(records: AddressRecord[], groupLimit = DEFAULT_GROUP_LIMIT): SearchGroup[] {
  const groups = new Map<string, SearchGroup>()
  for (const record of records) {
    const key = record.municipio_id || ''
    let group = groups.get(key)
    if (!group) {
      group = {
        municipio_id: key,
        municipio: record.municipio,
        provincia: record.provincia,
        provincia_id: record.provincia_id,
        codigo_postal: record.codigo_postal,
        found: 0,
        items: [],
      }
      groups.set(key, group)
    }
    group.found += 1
    if (group.items.length < groupLimit) group.items.push(record)
  }
  return [...groups.values()]
}

export interface UpstashSearchDeps {
  command<T = unknown>(args: string[]): Promise<T>
  index?: string
}

/** High-level search over the Upstash-backed index. Same contract as core's `searchAddresses`. */
export async function searchAddressesUpstash(
  options: UpstashSearchOptions,
  deps: UpstashSearchDeps,
): Promise<SearchResult> {
  const start = Date.now()
  const args = buildSearchArgs(options, deps.index)
  // FT.SEARCH returns a nested array under Upstash REST (`result` is already decoded).
  const reply = await deps.command<unknown>(args)
  const parsed = parseSearchReply(reply)
  const records = parsed.records
  return {
    records,
    groups: groupRecords(records, options.groupLimit),
    total: parsed.total,
    took_ms: Date.now() - start,
  }
}
