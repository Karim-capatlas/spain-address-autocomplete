/**
 * Static 52-provincia INE reference (Ceuta/Melilla included) for the widget.
 *
 * This is the 4th copy of the same small table (after `packages/etl`,
 * `packages/cascade/generator`, and the cascade index). It is duplicated here
 * deliberately so the browser bundle stays self-contained and never imports a
 * workspace package at runtime (the widget only pulls `@spain-address/core`).
 *
 * Used for: the search widget's scope-chip name (CPRO "28" → "Madrid") and the
 * cascade element's provincia fallbacks.
 *
 * Attribution: © Instituto Nacional de Estadística (INE) / DGT.
 */

export interface ProvinciaInfo {
  /** CPRO, 2-digit zero-padded (e.g. "28"). */
  provincia_id: string
  provincia_nombre: string
  comunidad_autonoma_id: string
  comunidad_autonoma: string
}

const PROVINCIAS: ProvinciaInfo[] = [
  { provincia_id: '01', provincia_nombre: 'Álava', comunidad_autonoma_id: '17', comunidad_autonoma: 'País Vasco' },
  { provincia_id: '02', provincia_nombre: 'Albacete', comunidad_autonoma_id: '08', comunidad_autonoma: 'Castilla-La Mancha' },
  { provincia_id: '03', provincia_nombre: 'Alicante', comunidad_autonoma_id: '10', comunidad_autonoma: 'Comunidad Valenciana' },
  { provincia_id: '04', provincia_nombre: 'Almería', comunidad_autonoma_id: '01', comunidad_autonoma: 'Andalucía' },
  { provincia_id: '05', provincia_nombre: 'Ávila', comunidad_autonoma_id: '14', comunidad_autonoma: 'Castilla y León' },
  { provincia_id: '06', provincia_nombre: 'Badajoz', comunidad_autonoma_id: '07', comunidad_autonoma: 'Extremadura' },
  { provincia_id: '07', provincia_nombre: 'Baleares', comunidad_autonoma_id: '04', comunidad_autonoma: 'Illes Balears' },
  { provincia_id: '08', provincia_nombre: 'Barcelona', comunidad_autonoma_id: '09', comunidad_autonoma: 'Cataluña' },
  { provincia_id: '09', provincia_nombre: 'Burgos', comunidad_autonoma_id: '14', comunidad_autonoma: 'Castilla y León' },
  { provincia_id: '10', provincia_nombre: 'Cáceres', comunidad_autonoma_id: '07', comunidad_autonoma: 'Extremadura' },
  { provincia_id: '11', provincia_nombre: 'Cádiz', comunidad_autonoma_id: '01', comunidad_autonoma: 'Andalucía' },
  { provincia_id: '12', provincia_nombre: 'Castellón', comunidad_autonoma_id: '10', comunidad_autonoma: 'Comunidad Valenciana' },
  { provincia_id: '13', provincia_nombre: 'Ciudad Real', comunidad_autonoma_id: '08', comunidad_autonoma: 'Castilla-La Mancha' },
  { provincia_id: '14', provincia_nombre: 'Córdoba', comunidad_autonoma_id: '01', comunidad_autonoma: 'Andalucía' },
  { provincia_id: '15', provincia_nombre: 'A Coruña', comunidad_autonoma_id: '15', comunidad_autonoma: 'Galicia' },
  { provincia_id: '16', provincia_nombre: 'Guadalajara', comunidad_autonoma_id: '08', comunidad_autonoma: 'Castilla-La Mancha' },
  { provincia_id: '17', provincia_nombre: 'Girona', comunidad_autonoma_id: '09', comunidad_autonoma: 'Cataluña' },
  { provincia_id: '18', provincia_nombre: 'Granada', comunidad_autonoma_id: '01', comunidad_autonoma: 'Andalucía' },
  { provincia_id: '19', provincia_nombre: 'Gipuzkoa', comunidad_autonoma_id: '17', comunidad_autonoma: 'País Vasco' },
  { provincia_id: '20', provincia_nombre: 'Bizkaia', comunidad_autonoma_id: '17', comunidad_autonoma: 'País Vasco' },
  { provincia_id: '21', provincia_nombre: 'León', comunidad_autonoma_id: '14', comunidad_autonoma: 'Castilla y León' },
  { provincia_id: '22', provincia_nombre: 'Huesca', comunidad_autonoma_id: '02', comunidad_autonoma: 'Aragón' },
  { provincia_id: '23', provincia_nombre: 'Huelva', comunidad_autonoma_id: '01', comunidad_autonoma: 'Andalucía' },
  { provincia_id: '24', provincia_nombre: 'Jaén', comunidad_autonoma_id: '01', comunidad_autonoma: 'Andalucía' },
  { provincia_id: '25', provincia_nombre: 'Lleida', comunidad_autonoma_id: '09', comunidad_autonoma: 'Cataluña' },
  { provincia_id: '26', provincia_nombre: 'La Rioja', comunidad_autonoma_id: '11', comunidad_autonoma: 'La Rioja' },
  { provincia_id: '27', provincia_nombre: 'Lugo', comunidad_autonoma_id: '15', comunidad_autonoma: 'Galicia' },
  { provincia_id: '28', provincia_nombre: 'Madrid', comunidad_autonoma_id: '13', comunidad_autonoma: 'Comunidad de Madrid' },
  { provincia_id: '29', provincia_nombre: 'Málaga', comunidad_autonoma_id: '01', comunidad_autonoma: 'Andalucía' },
  { provincia_id: '30', provincia_nombre: 'Murcia', comunidad_autonoma_id: '12', comunidad_autonoma: 'Región de Murcia' },
  { provincia_id: '31', provincia_nombre: 'Navarra', comunidad_autonoma_id: '16', comunidad_autonoma: 'Comunidad Foral de Navarra' },
  { provincia_id: '32', provincia_nombre: 'Ourense', comunidad_autonoma_id: '15', comunidad_autonoma: 'Galicia' },
  { provincia_id: '33', provincia_nombre: 'Asturias', comunidad_autonoma_id: '03', comunidad_autonoma: 'Asturias' },
  { provincia_id: '34', provincia_nombre: 'Segovia', comunidad_autonoma_id: '14', comunidad_autonoma: 'Castilla y León' },
  { provincia_id: '35', provincia_nombre: 'Las Palmas', comunidad_autonoma_id: '05', comunidad_autonoma: 'Canarias' },
  { provincia_id: '36', provincia_nombre: 'Pontevedra', comunidad_autonoma_id: '15', comunidad_autonoma: 'Galicia' },
  { provincia_id: '37', provincia_nombre: 'Soria', comunidad_autonoma_id: '14', comunidad_autonoma: 'Castilla y León' },
  { provincia_id: '38', provincia_nombre: 'Santa Cruz de Tenerife', comunidad_autonoma_id: '05', comunidad_autonoma: 'Canarias' },
  { provincia_id: '39', provincia_nombre: 'Cantabria', comunidad_autonoma_id: '06', comunidad_autonoma: 'Cantabria' },
  { provincia_id: '40', provincia_nombre: 'Toledo', comunidad_autonoma_id: '08', comunidad_autonoma: 'Castilla-La Mancha' },
  { provincia_id: '41', provincia_nombre: 'Sevilla', comunidad_autonoma_id: '01', comunidad_autonoma: 'Andalucía' },
  { provincia_id: '42', provincia_nombre: 'Salamanca', comunidad_autonoma_id: '14', comunidad_autonoma: 'Castilla y León' },
  { provincia_id: '43', provincia_nombre: 'Tarragona', comunidad_autonoma_id: '09', comunidad_autonoma: 'Cataluña' },
  { provincia_id: '44', provincia_nombre: 'Teruel', comunidad_autonoma_id: '02', comunidad_autonoma: 'Aragón' },
  { provincia_id: '45', provincia_nombre: 'Cuenca', comunidad_autonoma_id: '08', comunidad_autonoma: 'Castilla-La Mancha' },
  { provincia_id: '46', provincia_nombre: 'Valencia', comunidad_autonoma_id: '10', comunidad_autonoma: 'Comunidad Valenciana' },
  { provincia_id: '47', provincia_nombre: 'Valladolid', comunidad_autonoma_id: '14', comunidad_autonoma: 'Castilla y León' },
  { provincia_id: '48', provincia_nombre: 'Palencia', comunidad_autonoma_id: '14', comunidad_autonoma: 'Castilla y León' },
  { provincia_id: '49', provincia_nombre: 'Zamora', comunidad_autonoma_id: '14', comunidad_autonoma: 'Castilla y León' },
  { provincia_id: '50', provincia_nombre: 'Zaragoza', comunidad_autonoma_id: '02', comunidad_autonoma: 'Aragón' },
  { provincia_id: '53', provincia_nombre: 'Ceuta', comunidad_autonoma_id: '18', comunidad_autonoma: 'Ceuta' },
  { provincia_id: '54', provincia_nombre: 'Melilla', comunidad_autonoma_id: '19', comunidad_autonoma: 'Melilla' },
]

const BY_CPRO = new Map(PROVINCIAS.map((p) => [p.provincia_id, p]))

/** Province/CCAA info for a 2-digit CPRO, or undefined when unknown. */
export function getProvinciaInfo(provinciaId: string): ProvinciaInfo | undefined {
  return BY_CPRO.get(provinciaId.padStart(2, '0'))
}

/** Human-readable province name for a CPRO; falls back to the raw code. */
export function getProvinciaName(provinciaId: string): string {
  return getProvinciaInfo(provinciaId)?.provincia_nombre ?? provinciaId
}

/** All 52 provincias, ordered by CPRO. */
export function listProvincias(): ProvinciaInfo[] {
  return PROVINCIAS
}
