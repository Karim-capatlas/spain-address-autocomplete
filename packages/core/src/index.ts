// Core package: shared types + backend-agnostic address search.
// Typesense is the default backend (`createSearchClient()` resolves to it first,
// since it is HTTP-native and reachable from Cloudflare Workers over a Tunnel).
// Upstash / Redis Search (managed, REST) remains supported as an explicit opt-in
// via `USE_UPSTASH=1` + `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

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

// Default backend factory: Typesense by default; Upstash / Redis Search is an
// explicit opt-in (`USE_UPSTASH=1` + REST credentials).
export { createSearchClient } from './search-client.js'
