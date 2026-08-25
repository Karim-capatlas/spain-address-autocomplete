/**
 * Minimal Typesense HTTP client (REST API).
 *
 * Implemented against the Typesense HTTP API rather than the `typesense` JS SDK:
 * the SDK's `SearchParams<T, Infix>` generics are incompatible with this repo's
 * `strict` + `no-explicit-any` lint rules, while a small `fetch` wrapper is fully
 * typed by its own interfaces, has zero transitive dependencies in the consumer
 * tree, and is trivially mockable for unit tests.
 *
 * Node 22 ships a global `fetch`, so no HTTP dependency is required.
 */

export interface TypesenseConfig {
  /** e.g. "localhost" or "127.0.0.1" */
  host: string
  port: number
  protocol: 'http' | 'https'
  /** API key read from the server's `typesense.ini`. */
  apiKey: string
  /** Per-request timeout in seconds. */
  timeoutSeconds?: number
}

/** Safe `process.env` read — works under Node and in a browser bundle (no `process`). */
const env = (name: string): string | undefined =>
  (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env?.[name]

/** Defaults for a local `typesense-server` installed via Homebrew. */
export const DEFAULT_TYPESENSE_CONFIG: TypesenseConfig = {
  // Use the IPv4 literal so Node doesn't fall back to ::1 (ECONNREFUSED) when
  // the server binds 127.0.0.1 (the Homebrew formula default).
  host: env('TYPESENSE_HOST') ?? '127.0.0.1',
  port: Number(env('TYPESENSE_PORT') ?? '8108'),
  protocol: (env('TYPESENSE_PROTOCOL') ?? 'http') as 'http' | 'https',
  // Homebrew formula default api-key is "jana"; aligned to "xyz" in the local
  // typesense.ini (see AGENTS.md).
  apiKey: env('TYPESENSE_API_KEY') ?? 'xyz',
}

export const TYPESENSE_COLLECTION = 'callejero_es'

export type TypesenseImportAction = 'create' | 'upsert' | 'update'

export interface TypesenseClient {
  /** True once the server responds with `{"ok":true}`. */
  health(): Promise<boolean>
  /** `GET /collections/:name` — resolves true if the collection exists. */
  collectionExists(name: string): Promise<boolean>
  /** `POST /collections` — create a collection from a schema object. */
  createCollection(schema: TypesenseSchema): Promise<TypesenseSchema>
  /** `DELETE /collections/:name` — drop a collection. */
  dropCollection(name: string): Promise<void>
  /**
   * `PUT /collections/:name/documents/import` — bulk import.
   * `ndjson` is the raw newline-delimited JSON string (one doc per line).
   * Returns the count of successfully indexed vs. failed documents.
   */
  importDocuments(
    collection: string,
    ndjson: string,
    options?: { batchSize?: number; action?: TypesenseImportAction },
  ): Promise<{ success: number; failed: number }>
  /** `GET /collections/:name/documents/search` — run a search query. */
  search(
    collection: string,
    params: Record<string, string | number | boolean | undefined>,
  ): Promise<TypesenseSearchResponse>
}

/** Subset of the Typesense collection-create schema (REST `POST /collections`). */
export interface TypesenseSchema {
  name: string
  fields: Array<{
    name: string
    type: string
    optional?: boolean
    facet?: boolean
    [key: string]: unknown
  }>
  default_sorting_field?: string
}

export interface TypesenseSearchHit {
  document: Record<string, unknown>
  highlights?: Array<{ field: string; snippet: string; matches: number }>
  text_match?: number
  group_key?: string[]
  grouped_hits?: TypesenseSearchHit[]
}

export interface TypesenseSearchResponse {
  found: number // number of groups when `group_by` is used, else total hits
  found_docs?: number // total matching documents (present when `group_by` is used)
  hits?: TypesenseSearchHit[]
  grouped_hits?: Array<{
    found: number
    group_key: string[]
    hits: TypesenseSearchHit[]
  }>
  search_time_ms?: number
  request_params?: Record<string, unknown>
}

export interface TypesenseClientOptions {
  config?: Partial<TypesenseConfig>
  /** Inject a fetch implementation (used by tests). */
  fetchImpl?: FetchLike
}

/** Shape of `globalThis.fetch` we actually rely on (so mocks stay light). */
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}>

function buildUrl(config: TypesenseConfig, path: string): string {
  const base = `${config.protocol}://${config.host}:${config.port}`
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

function authHeaders(config: TypesenseConfig): Record<string, string> {
  return {
    'X-TYPESENSE-API-KEY': config.apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

function importHeaders(config: TypesenseConfig): Record<string, string> {
  return { 'X-TYPESENSE-API-KEY': config.apiKey, 'Content-Type': 'application/octet-stream' }
}

/** AbortController that automatically fires after `timeoutSeconds`. */
function timeoutSignal(config: TypesenseConfig): AbortSignal {
  const controller = new AbortController()
  const ms = (config.timeoutSeconds ?? 10) * 1000
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

export function createTypesenseClient(options: TypesenseClientOptions = {}): TypesenseClient {
  const config: TypesenseConfig = { ...DEFAULT_TYPESENSE_CONFIG, ...options.config }
  const fetchFn: FetchLike = options.fetchImpl ?? fetch

  return {
    async health(): Promise<boolean> {
      const res = await fetchFn(buildUrl(config, '/health'), {
        headers: authHeaders(config),
        signal: timeoutSignal(config),
      })
      if (!res.ok) return false
      const body = (await res.json()) as { ok?: boolean }
      return body.ok === true
    },

    async collectionExists(name: string): Promise<boolean> {
      const res = await fetchFn(buildUrl(config, `/collections/${encodeURIComponent(name)}`), {
        headers: authHeaders(config),
        method: 'GET',
        signal: timeoutSignal(config),
      })
      return res.ok
    },

    async createCollection(schema: TypesenseSchema): Promise<TypesenseSchema> {
      const res = await fetchFn(buildUrl(config, '/collections'), {
        headers: authHeaders(config),
        method: 'POST',
        body: JSON.stringify(schema),
        signal: timeoutSignal(config),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to create collection ${schema.name}: ${res.status} ${text}`)
      }
      return (await res.json()) as TypesenseSchema
    },

    async dropCollection(name: string): Promise<void> {
      const res = await fetchFn(buildUrl(config, `/collections/${encodeURIComponent(name)}`), {
        headers: authHeaders(config),
        method: 'DELETE',
        signal: timeoutSignal(config),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to drop collection ${name}: ${res.status} ${text}`)
      }
    },

    async importDocuments(collection, ndjson, options) {
      const params = new URLSearchParams()
      params.set('batch_size', String(options?.batchSize ?? 1000))
      params.set('action', options?.action ?? 'upsert')
      params.set('return_doc', 'false')
      const res = await fetchFn(
        buildUrl(config, `/collections/${encodeURIComponent(collection)}/documents/import?${params}`),
        {
          headers: importHeaders(config),
          method: 'POST',
          body: ndjson,
          signal: timeoutSignal(config),
        },
      )
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Import failed: ${res.status} ${text}`)
      }
      const body = await res.text()
      let success = 0
      let failed = 0
      for (const line of body.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(trimmed)
        } catch {
          failed++
          continue
        }
        const rec = parsed as { success?: boolean }
        if (rec.success === true) success++
        else failed++
      }
      return { success, failed }
    },

    async search(collection, params) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue
        qs.set(k, String(v))
      }
      const res = await fetchFn(
        buildUrl(config, `/collections/${encodeURIComponent(collection)}/documents/search?${qs}`),
        { headers: authHeaders(config), method: 'GET', signal: timeoutSignal(config) },
      )
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Search failed: ${res.status} ${text}`)
      }
      return (await res.json()) as TypesenseSearchResponse
    },
  }
}
