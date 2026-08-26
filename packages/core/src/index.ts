// Core package: shared types + backend-agnostic address search.
// Phase 2 = Typesense backend; Phase 3.5 adds the Upstash / Redis Search backend
// and flips the default preference to Upstash via `createSearchClient()`.

export type {
  AddressRecord,
  SearchOptions,
  SearchResult,
  SearchGroup,
  SearchHit,
  SearchResponse,
  Highlight,
} from './types.js'

export {
  DEFAULT_TYPESENSE_CONFIG,
  TYPESENSE_COLLECTION,
  createTypesenseClient,
} from './typesense.js'

export type {
  TypesenseConfig,
  TypesenseClient,
  TypesenseClientOptions,
  TypesenseSchema,
  TypesenseSearchHit,
  TypesenseSearchResponse,
  TypesenseImportAction,
} from './typesense.js'

export {
  searchAddresses,
  searchAddressesTypesense,
  SEARCH_QUERY_BY,
  SEARCH_QUERY_BY_WEIGHTS,
  SEARCH_GROUP_BY,
  SEARCH_GROUP_LIMIT,
  buildFilter,
  type SearchDependencies,
} from './search.js'

export { toAddressRecord } from './record.js'

// Upstash / Redis Search backend (Phase 3.5) — moved into core so the default
// backend switch is owned by core (upstash package re-exports these for compat).
export {
  UPSTASH_INDEX,
  DEFAULT_PER_PAGE,
  DEFAULT_GROUP_LIMIT,
  DEFAULT_UPSTASH_CONFIG,
  createUpstashClient,
  buildSearchArgs,
  buildFilterClause,
  parseSearchReply,
  groupRecords,
  searchAddressesUpstash,
} from './redis.js'

export type {
  UpstashConfig,
  UpstashClient,
  UpstashClientOptions,
  ResponseLike,
  FetchLike,
  UpstashResponse,
  PipelineResult,
  SearchCommand,
  UpstashSearchDeps,
  UpstashSearchOptions,
} from './redis.js'

// Default backend factory: prefers Upstash, falls back to Typesense.
export { createSearchClient } from './search-client.js'
