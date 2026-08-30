/**
 * Default search-client factory.
 *
 * Returns a `SearchDependencies` wired for the deployment's chosen backend.
 *
 * **Default: Typesense.** The Worker/VPS deployment speaks to its data store
 * over HTTP (a Cloudflare Worker can `fetch` a Typesense instance tunneled from
 * the VPS, but cannot speak raw RESP to a self-hosted Redis). Typesense is
 * therefore the default backend whenever one is reachable.
 *
 * **Upstash / Redis Search (managed, REST)** is still supported, but only as an
 * explicit opt-in: set `USE_UPSTASH=1` alongside `UPSTASH_REDIS_REST_URL` /
 * `UPSTASH_REDIS_REST_TOKEN`. It is never chosen automatically, so a stray
 * Upstash env var can't silently hijack a Typesense deployment.
 *
 * Callers that inject their own backend (widget direct-mode tests, proxy/MCP
 * unit tests) bypass this factory entirely and pass `{ client }` or `{ command }`
 * directly — `searchAddresses` dispatches on whichever is present.
 */

import { createUpstashClient } from './redis.js'
import { createTypesenseClient } from './typesense.js'
import type { SearchDependencies } from './search.js'
import type { SearchCommand } from './redis.js'

/** Safe `process.env` read — works under Node and in a browser bundle (no `process`). */
const env = (name: string): string | undefined =>
  (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env?.[name]

/** Build the default search dependencies, defaulting to Typesense. Upstash /
 * Redis Search is opt-in (`USE_UPSTASH=1` + REST credentials). */
export function createSearchClient(): SearchDependencies {
  const url = env('UPSTASH_REDIS_REST_URL')
  const token = env('UPSTASH_REDIS_REST_TOKEN')
  if (env('USE_UPSTASH') === '1' && url && token) {
    const client = createUpstashClient({ config: { url, token } })
    // Wrap so the returned command fn matches `SearchCommand` (drop the generic opts).
    const command: SearchCommand = (args: string[]): Promise<unknown> => client.command(args)
    return { command, index: undefined }
  }
  return { client: createTypesenseClient() }
}
