/**
 * Redis Search (Upstash REST) backend for `callejero_es` (Phase 3.5).
 *
 * Moved into `core` (from `packages/upstash`) so core can own the default
 * backend switch without creating a cyclic dependency (`upstash` already
 * depends on `core`). The transport here is a zero-dependency `fetch` client
 * — same philosophy as `./typesense.ts` — so it's safe to tree-shake out of the
 * browser widget bundle and never touches `node:` builtins.
 *
 * Query semantics mirror `search.ts` (the Typesense path): weighted text hit on
 * via/municipio/provincia, fuzzy `%term%` for OCR typos, TAG filters, municipio
 * grouping. The search primitives are transport-agnostic (they take a `command`
 * fn), so they work against Upstash Cloud REST or any REDIS-SEARCH-compatible
 * endpoint.
 */

import type { AddressRecord, SearchGroup, SearchResult } from './types.js'
import { toAddressRecord } from './record.js'

export const UPSTASH_INDEX = 'callejero_es'
export const DEFAULT_PER_PAGE = 10
export const DEFAULT_GROUP_LIMIT = 3

/** Safe `process.env` read — works under Node and in a browser bundle (no `process`). */
const env = (name: string): string | undefined =>
  (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env?.[name]

export interface UpstashConfig {
  url: string // e.g. https://xxx.upstash.io
  token: string // bearer token (Upstash REST auth)
}

/** Defaults read from env (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN), browser-safe. */
export const DEFAULT_UPSTASH_CONFIG: UpstashConfig = {
  url: env('UPSTASH_REDIS_REST_URL') ?? '',
  token: env('UPSTASH_REDIS_REST_TOKEN') ?? '',
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<ResponseLike>

export interface ResponseLike {
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}

/** Raw Upstash REST response envelope. */
export interface UpstashResponse<T = unknown> {
  result: T // command result; string "ERR…" or null on error
  error?: string
}

/** Result of one pipelined command (Upstash pipeline returns an array). */
export type PipelineResult = { ok: true; value: unknown } | { ok: false; error: string }

export interface UpstashClientOptions {
  config?: Partial<UpstashConfig>
  fetchImpl?: FetchLike
}

export interface UpstashClient {
  /** Run a single Redis command; returns its decoded `result`. Throws on errors unless allowErrorResult. */
  command<T = unknown>(args: string[], opts?: { allowErrorResult?: boolean }): Promise<T>
  /** Run several commands in one HTTP round-trip (Upstash pipeline endpoint). */
  pipeline(commands: string[][]): Promise<PipelineResult[]>
  /** Ping the database (true when Redis answers PONG). */
  health(): Promise<boolean>
  config: UpstashConfig
}

function resolveConfig(options: UpstashClientOptions): UpstashConfig {
  const merged = { ...DEFAULT_UPSTASH_CONFIG, ...options.config }
  if (!merged.url || !merged.token) {
    throw new Error(
      'Upstash config incomplete: set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (or pass config.url / config.token)',
    )
  }
  return { url: merged.url.replace(/\/+$/, ''), token: merged.token }
}

/**
 * Minimal typed Upstash Redis REST client. Commands are sent as JSON arrays
 * (`["FT.SEARCH", "callejero_es", "..."]`) to `https://<host>/`, which is how
 * Upstash exposes arbitrary Redis commands. Node 22 ships a global `fetch`.
 */
export function createUpstashClient(options: UpstashClientOptions = {}): UpstashClient {
  const config = resolveConfig(options)
  const doFetch: FetchLike = options.fetchImpl ?? fetch

  async function post(path: string, body: unknown): Promise<UpstashResponse> {
    const res = await doFetch(`${config.url}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`Upstash REST ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    return (await res.json()) as UpstashResponse
  }

  async function command<T = unknown>(
    args: string[],
    opts?: { allowErrorResult?: boolean },
  ): Promise<T> {
    const payload = await post('/', args)
    if (payload.error) throw new Error(`Upstash error: ${payload.error}`)
    const result = payload.result
    if (!opts?.allowErrorResult && typeof result === 'string' && result.startsWith('ERR')) {
      throw new Error(`Redis error: ${result}`)
    }
    return result as T
  }

  async function pipeline(commands: string[][]): Promise<PipelineResult[]> {
    const payload = await post('/pipeline', commands)
    if (payload.error) throw new Error(`Upstash pipeline error: ${payload.error}`)
    const arr = Array.isArray(payload.result) ? payload.result : []
    return arr.map((entry) => {
      const item = entry as { result?: unknown; error?: string } | null
      if (item?.error) return { ok: false as const, error: String(item.error) }
      const value = item?.result
      if (typeof value === 'string' && value.startsWith('ERR')) {
        return { ok: false as const, error: value }
      }
      return { ok: true as const, value }
    })
  }

  return {
    config,
    command,
    pipeline,
    health: async () => {
      try {
        return (await command<string>(['PING'], { allowErrorResult: false })) === 'PONG'
      } catch {
        return false
      }
    },
  }
}

/** A Redis command function: args vector → decoded result (transport-agnostic). */
export type SearchCommand = (args: string[]) => Promise<unknown>

export interface UpstashSearchOptions {
  query: string
  perPage?: number
  filterByProvincia?: string
  filterByMunicipio?: string
  filterByCP?: string
  /** Max streets returned per municipio group. */
  groupLimit?: number
}

export interface UpstashSearchDeps {
  command: SearchCommand
  index?: string
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
export function buildSearchArgs(options: UpstashSearchOptions, index = UPSTASH_INDEX): string[] {
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

/** Decode an FT.SEARCH reply `[total, key, doc-array, …]` into records. */
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

/** High-level search over the Upstash-backed index. Same contract as core's `searchAddresses`. */
export async function searchAddressesUpstash(
  options: UpstashSearchOptions,
  deps: UpstashSearchDeps,
): Promise<SearchResult> {
  const start = Date.now()
  const args = buildSearchArgs(options, deps.index)
  const reply = await deps.command(args)
  const parsed = parseSearchReply(reply)
  const records = parsed.records
  return {
    records,
    groups: groupRecords(records, options.groupLimit),
    total: parsed.total,
    took_ms: Date.now() - start,
  }
}
