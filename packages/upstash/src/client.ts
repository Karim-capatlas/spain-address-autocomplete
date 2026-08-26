/**
 * Minimal typed client for the Upstash Redis REST API.
 *
 * The implementation now lives in `@spain-address/core` (so core can wire the
 * default Upstash backend without a cyclic dependency on this package). It's
 * re-exported here for backward compatibility — existing imports from
 * `@spain-address/upstash` keep working unchanged.
 */

export { createUpstashClient, DEFAULT_UPSTASH_CONFIG } from '@spain-address/core'

export type {
  UpstashConfig,
  UpstashClient,
  UpstashClientOptions,
  ResponseLike,
  FetchLike,
  UpstashResponse,
  PipelineResult,
} from '@spain-address/core'
