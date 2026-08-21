/**
 * CNIG CartoCiudad coordinate enrichment.
 * Downloads and parses CartoCiudad centroid coordinates per province.
 *
 * This enrichment is OPTIONAL - the pipeline continues if this fails.
 *
 * Coordinate map key: `${normalized_via_nombre}|${municipio_id}`
 * Example: "gran via|28079" → { lat: 40.4205, lon: -3.7025 }
 */

export interface CoordinateRecord {
  via_nombre_normalized: string
  municipio_id: string
  lat: number
  lon: number
}

export type CoordMap = Map<string, CoordinateRecord>

/**
 * Normalizes a via_nombre for coordinate lookup.
 * Uses the same normalization as search normalization.
 */
function normalizeViaNombre(viaNombre: string): string {
  return viaNombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^\w\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Creates a lookup key for coordinate matching.
 */
function createCoordKey(normalizedVia: string, municipioId: string): string {
  return `${normalizedVia}|${municipioId}`
}

/**
 * Parses CartoCiudad CSV content.
 * Expected format: via_nombre;municipio_id;lat;lon
 * or via_nombre,municipio_id,lat,lon
 */
export function parseCartoCiudadCSV(content: string): CoordMap {
  const map = new Map<string, CoordinateRecord>()

  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Semicolon or comma separated
    const delimiter = trimmed.includes(';') ? ';' : ','
    const fields = trimmed.split(delimiter).map((f) => f.trim())

    if (fields.length < 4) continue

    const [via_nombre, municipio_id, latStr, lonStr] = fields

    if (!via_nombre || !municipio_id) continue

    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)

    if (isNaN(lat) || isNaN(lon)) continue
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue

    const normalizedVia = normalizeViaNombre(via_nombre)
    const key = createCoordKey(normalizedVia, municipio_id)

    map.set(key, {
      via_nombre_normalized: normalizedVia,
      municipio_id,
      lat,
      lon,
    })
  }

  return map
}

/**
 * Loads coordinates from a CSV file path.
 */
export async function loadCoordinatesFromFile(filePath: string): Promise<CoordMap> {
  const { readFile } = await import('fs/promises')
  const content = await readFile(filePath, 'utf-8')
  return parseCartoCiudadCSV(content)
}

/**
 * Looks up coordinates for a given via and municipio.
 */
export function lookupCoordinates(
  coordMap: CoordMap,
  viaNombre: string,
  municipioId: string,
): { lat: number; lon: number } | null {
  const normalizedVia = normalizeViaNombre(viaNombre)
  const key = createCoordKey(normalizedVia, municipioId)
  const record = coordMap.get(key)
  if (record) {
    return { lat: record.lat, lon: record.lon }
  }
  return null
}
