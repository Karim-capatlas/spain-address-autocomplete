/**
 * Default search-client factory (Phase 3.5).
 *
 * Returns a `SearchDependencies` wired for whichever backend is configured by
 * the environment, preferring **Upstash / Redis Search** and falling back to
 * Typesense:
 *
 *   1. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → Upstash REST command
 *   2. TYPESENSE_HOST (or the local default 127.0.0.1:8108) → Typesense client
 *
 * Callers that inject their own backend (widget direct-mode tests, MCP/proxy
 * unit tests) bypass this factory entirely and pass `{ client }` or `{ command }`
 * directly — `searchAddresses` dispatches on whichever is present.
 *
 * Reads env via a browser-safe helper so importing core never crashes on a
 * bare `process` reference in a browser bundle.
 */

import { createUpstashClient } from './redis.js'
import { createTypesenseClient } from './typesense.js'
import type { SearchDependencies } from './search.js'
import type { SearchCommand } from './redis.js'

const env = (name: string): string | undefined =>
  (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env?.[name]

/** Build the default search dependencies, preferring the Upstash/Redis backend. */
export function createSearchClient(): SearchDependencies {
  const url = env('UPSTASH_REDIS_REST_URL')
  const token = env('UPSTASH_REDIS_REST_TOKEN')
  if (url && token) {
    const client = createUpstashClient({ config: { url, token } })
    // Wrap so the returned command fn matches `SearchCommand` (drop the generic opts).
    const command: SearchCommand = (args: string[]): Promise<unknown> => client.command(args)
    return { command, index: undefined }
  }
  return { client: createTypesenseClient() }
}
