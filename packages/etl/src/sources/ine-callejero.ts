/**
 * INE Callejero del Censo Electoral parser.
 *
 * REAL file format (verified against the official `caj_esp_*.zip`, January 2026
 * publication). The PRD's documented `.CAL` fixed-width layout does NOT exist
 * in the downloaded ZIP — only `TRAM`, `UP`, `VIAS`, `PSEU`, `SECC` files are
 * present (ASCII, ISO-8859-1, fixed-width). The authoritative field
 * dictionary is the INE `Dis_nuevo.xlsx` ("TRAM" sheet), from which the
 * 0-based slices below are derived. Source:
 * https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390  (© Instituto Nacional
 * de Estadística).
 *
 * TRAM record: 273 chars/row. Key 0-based slices:
 *   CPRO   [0:2]   province code     (e.g. "28")
 *   CMUN   [2:5]   municipality code (e.g. "079")
 *   CPOS   [42:47] postal code       (5 digits, e.g. "28001") — VALID, not "00000"
 *   FVAR   [61:69] reference date   ("20251231")
 *   NENTCOC[85:110]
 *   NENTSIC[110:135]  (municipio name for SIMPLE-B; street#1 for TRANSITION)
 *   NNUCLEC[135:160]  (municipio name for SIMPLE-B; blank/simple-A street#2)
 *   CVIA   [160:165]  via code
 *   NVIAC   [165:190] via name        (street#2 for TRANSITION; simple-B)
 *   CPSVIA  [190:195]
 *   DPSVIA  [195:245] via name w/ type ("CALLE MAYOR (FTA)" for SIMPLE-A)
 *   MANZ    [245:257]
 *   CPOS2   [257:262] second postal code (same value)
 *
 * Via names come in three shapes (disambiguated by a Python prototype over all
 * 80,337 Madrid records — 88,269 vías emitted, 0 bad CPs, 37,811 unique
 * (municipio, CP, via) tuples):
 *   - SIMPLE-A : DPSVIA[195:245] non-empty  -> one street there (type word + name)
 *   - SIMPLE-B : else NVIAC[165:190] non-empty AND NENTSIC[110:135] has no
 *                trailing grammatical article -> street in NVIAC; NENTSIC/NNUCLEC
 *                hold the municipio name.
 *   - TRANSITION: else NVIAC non-empty AND NENTSIC ends with an article
 *                (LA|DEL|DE|EL|LOS|LAS|DE LA|DE LOS|DE LAS|DE EL) -> street#1 in
 *                NENTSIC, street#2 in NVIAC; emit TWO records sharing the
 *                record's CP/municipio.
 *
 * Municipio names are NOT carried by the TRAM CP/municipality fields (TRAM's
 * NENTSIC/NNUCLEC are contaminated by street tokens and the INE special
 * marker `*DISEMINADO*`), so `buildMunicipiosMapFromZip` derives
 * (CPRO+CMUN) -> name from the official INE municipality master file `UP`
 * (column 94, 0-based, 40 chars); this yields all 8,132 Spanish municipios
 * with 0 `*`-markers and 0 conflicts. `provincias.ts` supplies provincia /
 * CCAA; a user `--municipios <csv>` override is authoritative. INE articulated
 * municipios are stored as "NAME (EL/LA/LOS/LAS)" (e.g. "BOALO (EL)");
 * `formatMunicipioName` reorders these to the canonical display form ("El
 * Boalo"). Source: https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390
 * (© Instituto Nacional de Estadística).
 */

import iconv from 'iconv-lite'
import JSZip from 'jszip'
import { readFileSync } from 'fs'
import type { MunicipioMap } from './ine-municipios.js'
import { getProvinciaInfo } from './provincias.js'
import { toTitleCase } from '../transform/normalize.js'

export interface RawRecord {
  provincia_id: string
  municipio_id: string
  codigo_postal: string
  via_tipo_code: string
  via_nombre_raw: string
}

/** TRAM line length. */
const TRAM_LEN = 273

/** UP (municipality master) file: municipio name at [94:134], 0-based. */
const UP_NAME_START = 94
const UP_NAME_END = 134

/** Reference date prefix that validates a TRAM row ("20251231" -> starts "20"). */
const DATE_PREFIX = '20'

/**
 * Grammatical-article suffix that marks a TRANSITION record's first street
 * (e.g. "...ACEBADA (LA)", "...ENCERRADERO (DEL)").
 */
const ARTICLE_SUFFIX = /\((LA|DEL|DE|EL|LOS|LAS|DE LA|DE LOS|DE LAS|DE EL)\)\s*$/i

/**
 * Parenthetical tokens that are grammatical articles and must be KEPT on the
 * via name (e.g. "(LA)", "(DE LA)"). Anything else in trailing parens
 * (e.g. "(FTA)") is a qualifier and is stripped.
 */
const ARTICLE_TOKENS = new Set([
  'LA', 'DEL', 'DE', 'EL', 'LOS', 'LAS', 'DE LA', 'DE LOS', 'DE LAS', 'DE EL',
])

function endsWithArticle(token: string): boolean {
  return ARTICLE_SUFFIX.test(token)
}

function isArticleToken(token: string): boolean {
  return ARTICLE_TOKENS.has(token.trim().toUpperCase())
}

/**
 * Matches an INE articulated municipio name stored as "NAME (ARTICLE)".
 * e.g. "BOALO (EL)" → canonical "El Boalo".
 */
const MUN_ARTICLE_SUFFIX = /^(.+?)\s*\((LA|EL|LOS|LAS|DE|DEL|DE LA|DE LOS|DE LAS|DE EL)\)\s*$/i

/** Canonical (display) casing for each article token. */
const ARTICLE_DISPLAY: Record<string, string> = {
  EL: 'El',
  LA: 'La',
  LOS: 'Los',
  LAS: 'Las',
  DE: 'De',
  DEL: 'Del',
  'DE LA': 'De la',
  'DE LOS': 'De los',
  'DE LAS': 'De las',
  'DE EL': 'De el',
}

/**
 * Normalises an INE municipio name to canonical display form:
 * "BOALO (EL)" -> "El Boalo", "SANTOS DE LA HUMOSA (LOS)" -> "Los Santos de la Humosa".
 * Names without an article suffix ("MADRID", "AJALVIR") are simply title-cased.
 */
export function formatMunicipioName(raw: string): string {
  if (!raw) return ''
  const m = raw.match(MUN_ARTICLE_SUFFIX)
  if (m) {
    const art = m[2].toUpperCase()
    const display = ARTICLE_DISPLAY[art] ?? toTitleCase(m[2])
    const name = toTitleCase(m[1].trim())
    return `${display} ${name}`.trim()
  }
  return toTitleCase(raw)
}

/**
 * Leading street-type word -> INE numeric type code. Codes chosen so each is a
 * key of `normalize.VIA_TIPO_MAP` (01..95). Defaults applied in the caller.
 */
const VIA_TYPE_WORDS: Record<string, string> = {
  CALLE: '01',
  AVENIDA: '02',
  AVDA: '02',
  AVGDA: '02',
  PLAZA: '03',
  PLZLA: '03',
  PASEO: '04',
  RONDA: '05',
  RNDA: '05',
  TRAVA: '06',
  TRAVESIA: '06',
  TRAV: '06',
  TRVA: '06',
  CTRA: '07',
  CARRE: '07',
  CARR: '07',
  CAMINO: '08',
  CMNO: '08',
  BULEV: '10',
  BULEVAR: '10',
  BLVD: '10',
  GLORIETA: '11',
  GLTA: '11',
  ALAMEDA: '16',
  ALAM: '16',
  AVIA: '19',
  BLOQUE: '23',
  BLQUE: '23',
  CÑADA: '24',
  LUGAR: '44',
  PSAJE: '52',
  URBANIZACION: '76',
  URB: '76',
  URBN: '76',
}

/**
 * Splits a raw via name into a (type code, cleaned name).
 * - Detects a leading type word (CALLE, AVDA, ...).
 * - Strips trailing non-article parentheticals (e.g. "(FTA)") while keeping
 *   grammatical-article parens like "(LA)".
 */
function splitViaName(rawName: string): { code: string; name: string } | null {
  let nome = rawName.trim()
  if (!nome) return null

  let code = '01'
  // First all-caps token, but ONLY when followed by whitespace or end-of-string
  // — so "CALLE MAYOR" -> type Calle, while "CAMINO-REGUERA" (compound name,
  // no space after the word) is left intact.
  const head = nome.match(/^([A-ZÑÁÉÍÓÚÜ]+)(?:\s+|$)/)
  if (head && head[1].length > 0) {
    const mapped = VIA_TYPE_WORDS[head[1]]
    if (mapped) {
      code = mapped
      nome = nome.slice(head[0].length).trim()
    }
  }

  // Drop trailing parenthetical that is NOT a grammatical article (e.g. "(FTA)"),
  // keeping grammatical-article parens like "(LA)" — and preserve their spacing.
  nome = nome.replace(/\s*\(([^()]+)\)\s*$/, (_m, g1: string) =>
    isArticleToken(g1) ? ` (${g1})` : '',
  )

  nome = nome.replace(/\s+/g, ' ').trim()
  if (!nome) return null
  // Drop degenerate names that are only a grammatical-article group (e.g.
  // "(DE LA)", "(LA)") with no actual street name — these arise from
  // TRANSITION r2 fields like "RONDA (DE)" where the street name is absent.
  const base = nome.replace(/\s*\([^()]*\)\s*$/, '').trim()
  if (!base) return null
  return { code, name: nome }
}

/**
 * Builds a RawRecord for one (CPRO+CMUN, CP, viaName).
 */
function makeRawRecord(
  cpro: string,
  municipioId: string,
  cp: string,
  rawName: string,
): RawRecord | null {
  const split = splitViaName(rawName)
  if (!split) return null
  return {
    provincia_id: cpro,
    municipio_id: municipioId,
    codigo_postal: cp,
    via_tipo_code: split.code,
    via_nombre_raw: split.name,
  }
}

/**
 * Parses a single TRAM line into 0, 1 or 2 RawRecords (TRANSITION emits two).
 */
export function parseTRAMLine(
  line: string,
  municipiosMap?: MunicipioMap,
): RawRecord[] {
  if (!line || line.length < TRAM_LEN) return []
  if (!line.slice(61, 69).trim().startsWith(DATE_PREFIX)) return []

  const cpro = line.slice(0, 2).trim()
  const cmun = line.slice(2, 5).trim()
  if (!cpro || !cmun) return []

  // Postal code: the only field in the callejero that actually carries it.
  const cp = line.slice(42, 47).trim()
  if (!/^\d{5}$/.test(cp)) return [] // drop malformed rows (e.g. trailing blanks)

  const nentsic = line.slice(110, 135).trim()
  const nviac = line.slice(165, 190).trim()
  const dpsvia = line.slice(195, 245).trim()

  const municipioId = cpro + cmun
  const out: RawRecord[] = []

  if (dpsvia) {
    // SIMPLE-A: one street in DPSVIA (with type word).
    const rec = makeRawRecord(cpro, municipioId, cp, dpsvia)
    if (rec) out.push(rec)
  } else if (nviac) {
    if (endsWithArticle(nentsic)) {
      // TRANSITION: street#1 in NENTSIC (article), street#2 in NVIAC. Both share CP+municipio.
      const r1 = makeRawRecord(cpro, municipioId, cp, nentsic)
      const r2 = makeRawRecord(cpro, municipioId, cp, nviac)
      if (r1) out.push(r1)
      if (r2) out.push(r2)
    } else {
      // SIMPLE-B: street in NVIAC; NENTSIC/NNUCLEC hold the municipio name.
      const rec = makeRawRecord(cpro, municipioId, cp, nviac)
      if (rec) out.push(rec)
    }
  }

  // Guard against the municipio-name leak: a via name that is exactly the
  // record's own municipio name (seen ~0.25% of rows) is not a real street.
  if (municipiosMap && out.length > 0) {
    const m = municipiosMap.get(municipioId)
    if (m && m.nombre) {
      const target = m.nombre.toUpperCase()
      return out.filter((r) => r.via_nombre_raw.trim().toUpperCase() !== target)
    }
  }
  return out
}

/**
 * Parses an INE Callejero ZIP file and yields raw records from TRAM entries.
 *
 * `municipiosMap` (optional) is only used to filter out municipio-name leaks;
 * it does NOT need to be complete — records whose municipality is absent are
 * still emitted (the merge step falls back to "Municipio {id}").
 */
export async function* parseCallejeroZip(
  zipPath: string,
  provinceCodes?: string[],
  municipiosMap?: MunicipioMap,
): AsyncGenerator<RawRecord> {
  const buffer = readFileSync(zipPath)
  const zip = await JSZip.loadAsync(buffer)

  const tramFileName = Object.keys(zip.files).find((f) => f.includes('TRAM'))
  if (!tramFileName) {
    console.warn('No TRAM file found in ZIP')
    return
  }

  const content = await zip.files[tramFileName].async('nodebuffer')
  const decoded = iconv.decode(content, 'iso-8859-1')
  const lines = decoded.split(/\r?\n/)

  const want =
    provinceCodes && provinceCodes.length > 0
      ? new Set(provinceCodes.map((p) => p.padStart(2, '0')))
      : null

  let count = 0
  for (const line of lines) {
    if (!line.trim()) continue
    if (line.length < TRAM_LEN) continue
    const prov = line.slice(0, 2)
    if (want && !want.has(prov)) continue

    for (const record of parseTRAMLine(line, municipiosMap)) {
      yield record
      count++
    }
  }
  console.log(`  Parsed ${count} records from TRAM`)
}

/**
 * Derives a MunicipioMap (CPRO+CMUN -> name, provincia, CCAA) from the official
 * INE municipality master file `UP` inside the callejero ZIP. UP carries the
 * authoritative (CPRO, CMUN, NAME) triple for all 8,132 Spanish municipios
 * (column 94, 40 chars), free of the `*DISEMINADO*` marker and of the street
 * tokens that contaminate TRAM's NENTSIC/NNUCLEC. INE articulated municipios
 * ("BOALO (EL)") are normalised by `formatMunicipioName` to canonical form
 * ("El Boalo"). Provincia / CCAA come from the static `provincias.ts` table.
 */
export async function buildMunicipiosMapFromZip(
  zipPath: string,
  provinceCodes?: string[],
): Promise<MunicipioMap> {
  const buffer = readFileSync(zipPath)
  const zip = await JSZip.loadAsync(buffer)

  const upFileName = Object.keys(zip.files).find((f) => f.includes('UP'))
  if (!upFileName) {
    console.warn('No UP file found in callejero ZIP; municipality names unavailable')
    return new Map()
  }

  const content = await zip.files[upFileName].async('nodebuffer')
  const decoded = iconv.decode(content, 'iso-8859-1')
  const lines = decoded.split(/\r?\n/)

  const want =
    provinceCodes && provinceCodes.length > 0
      ? new Set(provinceCodes.map((p) => p.padStart(2, '0')))
      : null

  // (CPRO+CMUN) -> NAME -> count
  const freq = new Map<string, Map<string, number>>()
  for (const line of lines) {
    if (!line || line.length < UP_NAME_END) continue
    const cpro = line.slice(0, 2)
    if (!/^\d{2}$/.test(cpro)) continue
    if (want && !want.has(cpro)) continue

    const cmun = line.slice(2, 5).trim()
    if (!/^\d{3}$/.test(cmun)) continue
    const municipioId = cpro + cmun

    const name = line.slice(UP_NAME_START, UP_NAME_END).trim()
    // Skip INE special markers (e.g. *DISEMINADO*) and empty/blank entries.
    if (!name || name.startsWith('*')) continue

    let m = freq.get(municipioId)
    if (!m) {
      m = new Map()
      freq.set(municipioId, m)
    }
    m.set(name, (m.get(name) ?? 0) + 1)
  }

  const map: MunicipioMap = new Map()
  for (const [municipioId, tokenFreq] of freq) {
    let best = ''
    let bestCount = -1
    // Modal name per municipality (ties broken alphabetically for determinism).
    for (const [token, count] of tokenFreq) {
      if (count > bestCount || (count === bestCount && (best === '' || token < best))) {
        best = token
        bestCount = count
      }
    }
    if (!best) continue
    const cpro = municipioId.slice(0, 2)
    const prov = getProvinciaInfo(cpro)
    map.set(municipioId, {
      provincia_id: cpro,
      municipio_code: municipioId.slice(2),
      municipio_id: municipioId,
      nombre: formatMunicipioName(best),
      provincia_nombre: prov?.provincia_nombre ?? '',
      comunidad_autonoma_id: prov?.comunidad_autonoma_id ?? '',
      comunidad_autonoma: prov?.comunidad_autonoma ?? '',
    })
  }
  return map
}
