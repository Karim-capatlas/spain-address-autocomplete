/**
 * Typesense `callejero_es` collection schema.
 *
 * Field types mirror the `AddressRecord` shape produced by the ETL. `via_nombre`
 * and `via_nombre_completo` are `infix: true` so partial street-name prefixes
 * (e.g. "gr vía") match; `location` is a geopoint derived from lat/lon at import
 * time.
 */

import type { TypesenseSchema } from '@spain-address/core'

export const TYPESENSE_COLLECTION = 'callejero_es'

export const callejeroEsSchema: TypesenseSchema = {
  name: TYPESENSE_COLLECTION,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'via_nombre', type: 'string', infix: true },
    { name: 'via_nombre_completo', type: 'string', infix: true },
    { name: 'via_tipo', type: 'string', facet: true },
    { name: 'municipio', type: 'string', facet: true },
    { name: 'municipio_id', type: 'string', facet: true },
    { name: 'provincia', type: 'string', facet: true },
    { name: 'provincia_id', type: 'string', facet: true },
    { name: 'comunidad_autonoma', type: 'string', facet: true },
    { name: 'comunidad_autonoma_id', type: 'string', facet: true },
    { name: 'codigo_postal', type: 'string', facet: true },
    { name: 'label', type: 'string' },
    // geopoint for geo queries; lat/lon are also kept (optional) for display.
    { name: 'location', type: 'geopoint', optional: true },
    { name: 'lat', type: 'float', optional: true },
    { name: 'lon', type: 'float', optional: true },
  ],
  // No `default_sorting_field`: Typesense falls back to `_text_match` (relevance)
  // when one isn't supplied, which is exactly what we want for street search.
}
