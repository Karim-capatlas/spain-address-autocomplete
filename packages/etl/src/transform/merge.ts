/**
 * Merge and enrichment module.
 * Combines raw INE records with municipality data and optional coordinates.
 */

import { createHash } from 'crypto'
import type { AddressRecord } from '@spain-address/core'
import type { RawRecord } from '../sources/ine-callejero.js'
import type { MunicipioMap } from '../sources/ine-municipios.js'
import type { CoordMap } from '../sources/cnig-cartociudad.js'
import {
  toTitleCase,
  normalizeForSearch,
  validateCP,
  VIA_TIPO_MAP,
} from './normalize.js'
import { lookupCoordinates } from '../sources/cnig-cartociudad.js'

/**
 * Generates a deterministic ID from record fields.
 * Uses SHA1 hash of composite key, truncated to 16 chars.
 */
function generateId(
  provinciaId: string,
  municipioId: string,
  codigoPostal: string,
  viaTipoCode: string,
  viaNombreNormalized: string,
): string {
  const key = `${provinciaId}-${municipioId}-${codigoPostal}-${viaTipoCode}-${viaNombreNormalized}`
  return createHash('sha1').update(key).digest('hex').slice(0, 16)
}

/**
 * Resolves the via_tipo label from the INE code.
 * Falls back to "Calle" if code is unknown.
 */
function resolveViaTipo(code: string): string {
  return VIA_TIPO_MAP[code] ?? 'Calle'
}

/**
 * Merges and enriches a raw record with municipality data and coordinates.
 */
function enrichRecord(
  raw: RawRecord,
  municipios: MunicipioMap,
  coordinates?: CoordMap,
): AddressRecord | null {
  // Look up municipality data
  const municipioData = municipios.get(raw.municipio_id)

  // If municipio not found, we can still use the code as fallback name
  // This allows the pipeline to work without full INE reference data
  const municipioNombre = municipioData?.nombre ?? `Municipio ${raw.municipio_id}`
  const provinciaNombre = municipioData?.provincia_nombre ?? `Provincia ${raw.provincia_id}`
  const comunidadAutonoma = municipioData?.comunidad_autonoma ?? 'Unknown'
  const comunidadAutonomaId = municipioData?.comunidad_autonoma_id ?? raw.provincia_id

  // Skip records with invalid postal code (only if CP is not 00000)
  if (!validateCP(raw.codigo_postal) && raw.codigo_postal !== '00000') {
    return null
  }

  // Normalize street name
  const viaNombreTitle = toTitleCase(raw.via_nombre_raw)
  const viaNombreNormalized = normalizeForSearch(viaNombreTitle)
  const viaTipo = resolveViaTipo(raw.via_tipo_code)
  const viaNombreCompleto = `${viaTipo} ${viaNombreTitle}`

  // Look up coordinates if available
  let lat: number | undefined
  let lon: number | undefined

  if (coordinates) {
    const coords = lookupCoordinates(coordinates, viaNombreTitle, raw.municipio_id)
    if (coords) {
      lat = coords.lat
      lon = coords.lon
    }
  }

  // Generate deterministic ID
  const id = generateId(
    raw.provincia_id,
    raw.municipio_id,
    raw.codigo_postal,
    raw.via_tipo_code,
    viaNombreNormalized,
  )

  // Build display label
  const label = `${viaNombreCompleto}, ${municipioNombre} (${raw.codigo_postal})`

  return {
    id,
    via_nombre: viaNombreTitle,
    via_tipo: viaTipo,
    via_nombre_completo: viaNombreCompleto,
    municipio: municipioNombre,
    municipio_id: raw.municipio_id,
    provincia: provinciaNombre,
    provincia_id: raw.provincia_id,
    comunidad_autonoma: comunidadAutonoma,
    comunidad_autonoma_id: comunidadAutonomaId,
    codigo_postal: raw.codigo_postal,
    label,
    lat,
    lon,
  }
}

/**
 * Merges raw records with municipality data and optional coordinates.
 * Returns enriched AddressRecord array.
 */
export function mergeRecords(
  rawRecords: RawRecord[],
  municipios: MunicipioMap,
  coordinates?: CoordMap,
): AddressRecord[] {
  const enriched: AddressRecord[] = []

  for (const raw of rawRecords) {
    const record = enrichRecord(raw, municipios, coordinates)
    if (record) {
      enriched.push(record)
    }
  }

  return enriched
}

/**
 * Async generator version for memory-efficient processing.
 */
export async function* mergeRecordsAsync(
  rawRecords: AsyncGenerator<RawRecord>,
  municipios: MunicipioMap,
  coordinates?: CoordMap,
): AsyncGenerator<AddressRecord> {
  for await (const raw of rawRecords) {
    const record = enrichRecord(raw, municipios, coordinates)
    if (record) {
      yield record
    }
  }
}
