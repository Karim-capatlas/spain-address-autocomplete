/**
 * Minimal typed client for the Upstash Redis REST API (Phase 3.5).
 *
 * Same design philosophy as the Typesense client in `packages/core`: talk to
 * the service over plain HTTP via the global `fetch` — zero transitive deps,
 * fully mockable by injecting a `fetchImpl`. Commands are sent as JSON arrays
 * (`["FT.SEARCH", "callejero_es", "..."]`) to `https://<host>/<pipeline>`,
 * which is how Upstash exposes arbitrary Redis commands.
 */

export interface UpstashConfig {
  url: string // e.g. https://xxx.upstash.io (or http://127.0.0.1:8080 for local rest-server)
  token: string // bearer token (Upstash REST default auth)
}

export const DEFAULT_UPSTASH_CONFIG: UpstashConfig = {
  url: process.env.UPSTASH_REDIS_REST_URL ?? '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
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
  result: T // command result; string "ERR..." or null on error
  error?: string
}

/** Result of one pipelined command (Upstash pipeline returns an array). */
export type PipelineResult = { ok: true; value: unknown } | { ok: false; error: string }

export interface UpstashClientOptions {
  config?: Partial<UpstashConfig>
  fetchImpl?: FetchLike
}

export interface UpstashClient {
  /** Run a single Redis command; returns its decoded `result`. Throws on transport or Redis-level errors unless `allowErrorResult`. */
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

export function createUpstashClient(options: UpstashClientOptions = {}): UpstashClient {
  const config = resolveConfig(options)
  const doFetch = options.fetchImpl ?? fetch

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
