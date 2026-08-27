/**
 * Redis Search access for the cascade index.
 *
 * The cascade server talks to Redis over RESP (`ioredis`) — NOT the Upstash
 * REST client — so it runs against the local `redisearch` container
 * (`redis://127.0.0.1:6379`) and, via Upstash's RESP endpoint
 * (`rediss://<id>.upstash.io:6380`, token as password), in production too.
 *
 * Handlers depend on the narrow `CascadeStore` interface so they are
 * unit-testable with a fake store (no live Redis needed).
 */

import { Command, Redis } from 'ioredis'
import { CASCADE_INDEX } from './schema.js'

/** A lightweight contract for what the handlers need from storage. */
export interface SearchDoc {
  /** Redis hash key, e.g. `cascade:cp:28001`. Handlers prefer `fields`. */
  id: string
  /** Returned hash fields keyed by field name. */
  fields: Record<string, string>
}

export interface CascadeStore {
  /**
   * Run a RediSearch query against `cascade_es` and return the matched docs
   * with the requested fields populated (`RETURN`).
   *
   * `limit` overrides RediSearch's default 10-result cap (relevant for the
   * municipios endpoint, which needs all ~178 municipios for a province).
   */
  search(query: string, returnFields: readonly string[], limit?: number): Promise<SearchDoc[]>
}

/**
 * Minimal surface of the Redis client we rely on, so the real ioredis client
 * can be swapped in tests without dragging the concrete type around.
 */
export interface CascadeRedisClient {
  call(command: string, ...args: (string | number)[]): Promise<unknown>
}

/**
 * Parse a RediSearch `FT.SEARCH ... RETURN` reply (flat array
 * `[total, key, [field, value, …], key, [field, value, …], …]`). Values that
 * arrive as Buffers (from `decodeBuffers`-style clients) are coerced to
 * strings. Field/value pairs may also come back as a flat `{ field: value }`
 * object in some clients.
 */
export function parseFtSearchReply(reply: unknown): { total: number; docs: SearchDoc[] } {
  if (!Array.isArray(reply) || reply.length < 1) return { total: 0, docs: [] }
  const total = Number(reply[0])
  const docs: SearchDoc[] = []
  for (let i = 1; i + 1 < reply.length; i += 2) {
    const raw: unknown = reply[i + 1]
    let fields: Record<string, string> = {}
    if (Array.isArray(raw)) {
      fields = {}
      for (let j = 0; j + 1 < raw.length; j += 2) {
        fields[String(raw[j])] = String(raw[j + 1])
      }
    } else if (raw !== null && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        fields[k] = String(v)
      }
    }
    docs.push({ id: String(reply[i]), fields })
  }
  return { total, docs }
}

/**
 * Live `CascadeStore` backed by `ioredis`. The client is created lazily from
 * `CASCADE_REDIS_URL` (default `redis://127.0.0.1:6379`).
 */
export function createRedisCascadeClient(url?: string): CascadeRedisClient {
  const theUrl = url ?? process.env.CASCADE_REDIS_URL ?? 'redis://127.0.0.1:6379'
  return new Redis(theUrl) as CascadeRedisClient
}

export function createRedisCascadeStore(client: CascadeRedisClient = createRedisCascadeClient()): CascadeStore {
  return {
    async search(query: string, returnFields: readonly string[], limit = 10000): Promise<SearchDoc[]> {
      const args = [CASCADE_INDEX, query]
      if (returnFields.length > 0) {
        args.push('RETURN', String(returnFields.length), ...returnFields)
      }
      args.push('LIMIT', '0', String(limit))
      const reply: unknown = await client.call('FT.SEARCH', ...args)
      return parseFtSearchReply(reply).docs
    },
  }
}

// The hand-rolled ioredis call surface uses Command's REPLY encoding by default
// (utf8) so doc values come back as strings. Keep the Command import used for
// documentation/type clarity even though we dispatch through `call`.
void Command