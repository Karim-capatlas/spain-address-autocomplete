/**
 * Redis Search query building + response parsing for `callejero_es`.
 *
 * Phase 3.5 moved the canonical implementations into `@spain-address/core`
 * (so core owns the default backend switch) — this module re-exports them for
 * backward compatibility. The Upstash REST transport (`createUpstashClient`)
 * and the bulk-import CLI remain Upstash-specific.
 */

export {
  UPSTASH_INDEX,
  DEFAULT_PER_PAGE,
  DEFAULT_GROUP_LIMIT,
  buildSearchArgs,
  buildFilterClause,
  groupRecords,
  parseSearchReply,
  searchAddressesUpstash,
} from '@spain-address/core'

export type {
  SearchCommand,
  UpstashSearchOptions,
  UpstashSearchDeps,
} from '@spain-address/core'
