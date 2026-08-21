// Core package: shared types + Typesense search function wrapper.
// Phase 2 implementation (Phase 0/1 were monorepo bootstrap + ETL).

export type {
  AddressRecord,
  SearchOptions,
  SearchResult,
  SearchGroup,
  SearchHit,
  SearchResponse,
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
  SEARCH_QUERY_BY,
  SEARCH_QUERY_BY_WEIGHTS,
  SEARCH_GROUP_BY,
  SEARCH_GROUP_LIMIT,
  type SearchDependencies,
} from './search.js'
