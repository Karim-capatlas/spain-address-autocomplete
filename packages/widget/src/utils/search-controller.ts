/**
 * Shared search controller for both widget components.
 *
 * Extracted from `address-search-es.tsx` so `<address-cascade-es>`'s street step
 * reuses the exact same debounce/race-guard/backend-resolution logic:
 *  - monotonic `searchSeq` + `AbortController` so only the newest query commits
 *    (autocomplete race guard);
 *  - endpoint (proxy/BFF) vs. direct Typesense client resolution;
 *  - `searchAddressesTypesense` for the direct path.
 *
 * The controller never throws: it returns a discriminated `SearchOutcome` so the
 * calling component can distinguish a real error (render an error row, keep the
 * menu open) from a superseded/aborted request (ignore, leave `loading` to the
 * newer call).
 */
import { createTypesenseClient, searchAddressesTypesense } from '@spain-address/core'

/** @stencil/core's published types, referenced inline so the rollup TS plugin
 *  strips them (no top-level `import type` in widget sources — AGENTS.md §3). */
type TypesenseClient = import('@spain-address/core').TypesenseClient
type SearchResult = import('@spain-address/core').SearchResult

const CP_RE = /^\d{5}$/

/** Backend wiring, read fresh on every search (props may change between calls). */
export interface SearchBackendConfig {
  /** Proxy/BFF URL. When set, the controller fetches JSON instead of Typesense. */
  endpoint: string
  typesenseHost: string
  typesensePort: number
  typesenseApiKey: string
  typesenseProtocol: 'http' | 'https'
}

/** A single search request. */
export interface SearchRequest {
  /** Raw user query (street text, or a 5-digit CP when `detectCp`). */
  query: string
  /** Max municipio groups (Typesense `per_page` / proxy `per_page`). */
  perPage: number
  /** Max streets per group (Typesense `group_limit`). */
  groupLimit: number
  /** Route a 5-digit `query` to the CP filter instead of text search. */
  detectCp: boolean
  /** 2-digit CPRO filter. */
  provincia?: string
  /** 5-digit INE municipio_id filter. */
  municipio?: string
  /** Explicit 5-digit CP filter (cascade street step). Overrides `detectCp`. */
  cp?: string
}

export type SearchOutcome =
  | { status: 'ok'; result: SearchResult }
  | { status: 'superseded' }
  | { status: 'error'; message: string; code?: number }

function isAbort(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  const msg = e instanceof Error ? e.message : String(e)
  return msg === 'AbortError' || msg.includes('aborted')
}

export class SearchController {
  private seq = 0
  private abortCtrl: AbortController | undefined
  private cachedClient: TypesenseClient | null = null
  private cachedClientKey = ''

  constructor(private readonly backend: () => SearchBackendConfig) {}

  /** Abort any in-flight request and invalidate pending sequence numbers. */
  cancel(): void {
    this.abortCtrl?.abort()
    this.seq++
  }

  /**
   * Run a search with the race guard. Resolves to:
   *  - `ok` + result when this is still the newest request;
   *  - `superseded` when a newer request replaced it (or it was aborted);
   *  - `error` when the newest request failed.
   */
  async search(req: SearchRequest): Promise<SearchOutcome> {
    this.abortCtrl?.abort()
    const ctrl = new AbortController()
    this.abortCtrl = ctrl
    const mySeq = ++this.seq

    try {
      const result = await this.execute(req, ctrl.signal)
      if (mySeq !== this.seq) return { status: 'superseded' }
      return { status: 'ok', result }
    } catch (e: unknown) {
      if (isAbort(e) || mySeq !== this.seq) return { status: 'superseded' }
      const message = e instanceof Error ? e.message : String(e)
      const code = (e as { status?: number })?.status
      return { status: 'error', message, code }
    }
  }

  private async execute(req: SearchRequest, signal: AbortSignal): Promise<SearchResult> {
    const backend = this.backend()
    const q = req.query.trim()
    // A 5-digit query is treated as a CP lookup only when `detectCp` is on (the
    // search widget). `req.cp` is a pure background FILTER (the cascade street
    // step) and must NOT swallow the street text query — otherwise typing a
    // street name in the cascade would be ignored and the search would return
    // arbitrary streets for the CP instead of matches for the typed text.
    const cpDetected = req.detectCp && CP_RE.test(q)
    const cpFilter = req.cp ?? (cpDetected ? q : undefined)
    const textQuery = cpDetected ? '' : q

    if (backend.endpoint) {
      return this.searchViaEndpoint(backend, req, textQuery, cpFilter, signal)
    }
    const client = this.directClient(backend)
    return searchAddressesTypesense(
      {
        query: textQuery,
        perPage: req.perPage,
        groupLimit: req.groupLimit,
        filterByCP: cpFilter,
        filterByProvincia: req.provincia || undefined,
        filterByMunicipio: req.municipio || undefined,
        highlight: true,
      },
      { client },
    )
  }

  /** Proxy-mode search: GET `${endpoint}?q=…` returning a `SearchResult` JSON. */
  private async searchViaEndpoint(
    backend: SearchBackendConfig,
    req: SearchRequest,
    q: string,
    cp: string | undefined,
    signal: AbortSignal,
  ): Promise<SearchResult> {
    const url = new URL(backend.endpoint, window.location.href)
    url.searchParams.set('q', q)
    if (cp) url.searchParams.set('cp', cp)
    url.searchParams.set('per_page', String(req.perPage))
    url.searchParams.set('group_limit', String(req.groupLimit))
    if (req.provincia) url.searchParams.set('provincia', req.provincia)
    if (req.municipio) url.searchParams.set('municipio', req.municipio)

    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw Object.assign(new Error(`proxy ${res.status}: ${body.slice(0, 200)}`), {
        status: res.status,
      })
    }
    return (await res.json()) as SearchResult
  }

  /** Resolve (and cache) the direct Typesense client, or throw a config error. */
  private directClient(backend: SearchBackendConfig): TypesenseClient {
    if (!backend.typesenseHost) {
      throw new Error(
        'either attribute "endpoint" (proxy mode) or "typesense-host" + "typesense-api-key" (direct mode) is required',
      )
    }
    if (!backend.typesenseApiKey) {
      throw new Error('attribute "typesense-api-key" is required in direct mode')
    }
    const key = `${backend.typesenseHost}:${backend.typesensePort}:${backend.typesenseProtocol}:${backend.typesenseApiKey}`
    if (this.cachedClient && this.cachedClientKey === key) return this.cachedClient
    this.cachedClient = createTypesenseClient({
      config: {
        host: backend.typesenseHost,
        port: backend.typesensePort,
        protocol: backend.typesenseProtocol,
        apiKey: backend.typesenseApiKey,
      },
    })
    this.cachedClientKey = key
    return this.cachedClient
  }
}
