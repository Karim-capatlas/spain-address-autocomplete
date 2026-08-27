/** Build the `GeneratorInput` (provincias / municipios / cps) for the cascade index.

Throughput target: a single pass over the JSONL snapshot, in-process on one core.
Municipios are derived from the 5-digit `municipio_id` that already appears in the
street records (a municipio without any street records is excluded — a dead end in
the form dropdown).

Both paths run from a plain Node process (tsx / tsup output) — no Redis dependency
at generation time, so the generator itself is fast and side-effect-free.
*/
import fs from 'node:fs'
import readline from 'node:readline'
import zlib from 'node:zlib'

import type { GeneratorInput, ProvinciaDoc, MunicipioDoc, CPDoc } from './types.js'

// ---- 52-provincia INE reference (inlined) ----

/** Built-in 52-provincia INE reference (Ceuta/Melilla included).
 * Copied from `packages/etl/src/sources/provincias.ts` so the cascade server
 * is self-contained and doesn't import the etl package at runtime.
 *
 * Attribution: © Instituto Nacional de Estadística (INE) / DGT.
 * License on data: public-sector / open government — no restriction on reuse
 * for this project's purpose (address normalization, not redistributing the
 * geographic dataset).
 */
const PROVINCIAS: {
  provincia_id: string
  provincia_nombre: string
  comunidad_autonoma_id: string
  comunidad_autonoma: string
}[] = [
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

const PROVINCIA_BY_CPRO = new Map(PROVINCIAS.map((p) => [p.provincia_id, p]))

/** Returns province/CCA info for a 2-digit CPRON, or undefined if unknown. */
function getProvinciaInfo(provinciaId: string) {
  return PROVINCIA_BY_CPRO.get(provinciaId)
}

/** All 52 provincias from the INE reference (Ceuta/Melilla included). */
export function buildProvinciaDocs(): ProvinciaDoc[] {
  return PROVINCIAS.map((p) => ({
    type: 'provincia',
    id: p.provincia_id,
    name: p.provincia_nombre,
    ccaa_id: p.comunidad_autonoma_id,
    ccaa_name: p.comunidad_autonoma,
  }))
}

// ---- municipio doc ----

type MunKey = string // 5-digit id

/** Derive municipio docs from a stream of street records. A municipio with no
 * street records in the snapshot is absent — call `buildMunicipioDocsFromSnapshot`
 * with a single-province snapshot if you need only that subset.
 */
export async function buildMunicipioDocsFromSnapshot(
  snapshotPath: string,
): Promise<MunicipioDoc[]> {
  const munMap = new Map<MunKey, {
    name: string
    cpro: string
    cmum: string
    ccaa_id: string
    ccaa_name: string
  }>()

  await forEachLine(snapshotPath, (line) => {
    const r = JSON.parse(line) as Record<string, unknown>
    const id = String(r.municipio_id ?? '')
    if (!id || id.length !== 5) return
    const cpro = id.slice(0, 2)
    const cmum = id.slice(2, 5)
    const prov = getProvinciaInfo(cpro)
    if (!prov) return
    if (munMap.has(id)) {
      // keep first name encountered (they should all agree per municipio_id)
      return
    }
    munMap.set(id, {
      name: String(r.municipio ?? ''),
      cpro,
      cmum,
      ccaa_id: prov.comunidad_autonoma_id,
      ccaa_name: prov.comunidad_autonoma,
    })
  })

  return [...munMap.values()].map((m) => ({
    type: 'municipio',
    id: `${m.cpro}${m.cmum}`,
    cpro: m.cpro,
    cmum: m.cmum,
    name: m.name,
    ccaa_id: m.ccaa_id,
    ccaa_name: m.ccaa_name,
  }))
}

// ---- cp doc ----

/** Build CP docs from a stream of street records: map CPOS → set of municipio_id. */
export async function buildCPDocsFromSnapshot(
  snapshotPath: string,
): Promise<CPDoc[]> {
  const cpMap = new Map<string, Set<string>>()

  await forEachLine(snapshotPath, (line) => {
    const r = JSON.parse(line) as Record<string, unknown>
    const cp = String(r.codigo_postal ?? '')
    if (!cp || cp.length !== 5 || cp.startsWith('000')) return
    const id = String(r.municipio_id ?? '')
    if (!id || id.length !== 5) return
    let set = cpMap.get(cp)
    if (!set) {
      set = new Set()
      cpMap.set(cp, set)
    }
    set.add(id)
  })

  return [...cpMap.entries()].map(([id, municipios]) => ({
    type: 'cp',
    id,
    municipios: [...municipios].sort(),
  }))
}

// ---- combined ----

/** Convenience: produce the full `GeneratorInput` in one call. */
export async function buildGeneratorInput(
  snapshotPath: string,
): Promise<GeneratorInput> {
  const [municipios, cps] = await Promise.all([
    buildMunicipioDocsFromSnapshot(snapshotPath),
    buildCPDocsFromSnapshot(snapshotPath),
  ])
  return {
    provincias: buildProvinciaDocs(),
    municipios,
    cps,
  }
}

// ---- helpers ----

async function forEachLine(path: string, fn: (line: string) => void): Promise<void> {
  const stream = fs
    .createReadStream(path)
    .pipe(zlib.createGunzip().on('error', () => {}))
    .setEncoding('utf8')
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    if (line.trim()) fn(line)
  }
}
