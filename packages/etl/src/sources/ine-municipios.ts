/**
 * INE Municipios parser.
 * Downloads and parses the INE municipalities reference table.
 *
 * Expected CSV format:
 * CPRO,CMUN,NOMBRE,CPRO_NAME,CCAA,CCAA_NAME
 * 28,001,Alcobendas,Madrid,13,Comunidad de Madrid
 */

export interface MunicipioRecord {
  provincia_id: string         // "28"
  municipio_code: string       // "001"
  municipio_id: string         // "28001" (CPRO+CMUN)
  nombre: string              // "Alcobendas"
  provincia_nombre: string     // "Madrid"
  comunidad_autonoma_id: string // "13"
  comunidad_autonoma: string  // "Comunidad de Madrid"
}

export type MunicipioMap = Map<string, MunicipioRecord>

/**
 * Parses the INE municipios CSV file.
 * Returns a Map keyed by municipio_id (5-digit INE code).
 */
export function parseMunicipiosCSV(content: string): MunicipioMap {
  const map = new Map<string, MunicipioRecord>()

  const lines = content.split(/\r?\n/)

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // CSV might be semicolon or comma separated
    const delimiter = line.includes(';') ? ';' : ','
    const fields = line.split(delimiter).map((f) => f.trim())

    if (fields.length < 6) continue

    const [provincia_id, municipio_code, nombre, provincia_nombre, ccaa_id, ccaa] = fields

    if (!provincia_id || !municipio_code || !nombre) continue

    const municipioId = provincia_id + municipio_code

    map.set(municipioId, {
      provincia_id,
      municipio_code,
      municipio_id: municipioId,
      nombre,
      provincia_nombre,
      comunidad_autonoma_id: ccaa_id,
      comunidad_autonoma: ccaa,
    })
  }

  return map
}

/**
 * Loads municipios from a CSV file path.
 */
export async function loadMunicipiosFromFile(filePath: string): Promise<MunicipioMap> {
  const { readFile } = await import('fs/promises')
  const content = await readFile(filePath, 'utf-8')
  return parseMunicipiosCSV(content)
}
