import { describe, it, expect } from 'vitest'
import { parseTRAMLine, formatMunicipioName } from './ine-callejero'
import type { MunicipioMap } from '../sources/ine-municipios'

/** Total TRAM record length (INE `Dis_nuevo.xlsx` TRAM sheet spec). */
const TRAM_LEN = 273

/** Build a 273-char TRAM line from a sparse field map of [start,end,value). */
function tramLine(
  fields: { start: number; end: number; value: string }[],
  length = TRAM_LEN,
): string {
  const arr = Array.from({ length }, () => ' ').fill(' ')
  for (const { start, end, value } of fields) {
    let v = value
    if (v.length > end - start) v = v.slice(0, end - start)
    else if (v.length < end - start) v = v.padEnd(end - start)
    for (let i = 0; i < v.length; i++) arr[start + i] = v[i]
  }
  return arr.join('')
}

const CPRO = (c: string) => ({ start: 0, end: 2, value: c })
const CMUN = (c: string) => ({ start: 2, end: 5, value: c })
const CP = (c: string) => ({ start: 42, end: 47, value: c })
const FVAR = (v = '20251231') => ({ start: 61, end: 69, value: v })
const NENTSIC = (v: string) => ({ start: 110, end: 135, value: v })
const NNUCLEC = (v: string) => ({ start: 135, end: 160, value: v })
const NVIAC = (v: string) => ({ start: 165, end: 190, value: v })
const DPSVIA = (v: string) => ({ start: 195, end: 245, value: v })

/**
 * Build a MunicipioMap from the project's CSV schema
 * (CPRO,CMUN,NOMBRE,CPRO_NAME,CCAA,CCAA_NAME).
 */
function municipiosFromCsv(csv: string): MunicipioMap {
  const map = new Map<string, Record<string, string>>()
  const lines = csv.split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].split(',').map((s) => s.trim())
    if (f.length < 6 || !f[0] || !f[1] || !f[2]) continue
    const [provincia_id, municipio_code, nombre, provincia_nombre, ccaa_id, ccaa] = f
    map.set(provincia_id + municipio_code, {
      provincia_id,
      municipio_code,
      municipio_id: provincia_id + municipio_code,
      nombre,
      provincia_nombre,
      comunidad_autonoma_id: ccaa_id,
      comunidad_autonoma: ccaa,
    })
  }
  return map as unknown as MunicipioMap
}

describe('parseTRAMLine — format + shape disambiguation', () => {
  it('rejects empty / too-short lines', () => {
    expect(parseTRAMLine('')).toEqual([])
    expect(parseTRAMLine('too short')).toEqual([])
    // 100 chars -> below TRAM_LEN(273)
    expect(parseTRAMLine(tramLine([FVAR()], 100))).toEqual([])
  })

  it('drops rows whose date stamp does not start with "20"', () => {
    const line = tramLine([CPRO('28'), CMUN('079'), CP('28013'), FVAR('19990101')])
    expect(parseTRAMLine(line)).toEqual([])
  })

  it('drops rows with a non-5-digit postal code', () => {
    const line = tramLine([CPRO('28'), CMUN('079'), CP('   9'), FVAR()])
    expect(parseTRAMLine(line)).toEqual([])
  })

  it('parses a SIMPLE-A record: street in DPSVIA with type word (Calle Mayor)', () => {
    const line = tramLine([
      CPRO('28'),
      CMUN('079'),
      CP('28013'),
      FVAR(),
      NENTSIC(''),
      NNUCLEC(''),
      NVIAC(''),
      DPSVIA('CALLE MAYOR (FTA)'),
    ])
    const [r] = parseTRAMLine(line)
    expect(r.codigo_postal).toBe('28013') // real CP, NOT '00000'
    expect(r.municipio_id).toBe('28079')
    expect(r.provincia_id).toBe('28')
    expect(r.via_tipo_code).toBe('01') // Calle
    expect(r.via_nombre_raw).toBe('MAYOR') // type word + (FTA) stripped, NOT truncated
  })

  it('parses a SIMPLE-B record: street in NVIAC, municipio name in NENTSIC', () => {
    const line = tramLine([
      CPRO('28'),
      CMUN('079'),
      CP('28016'),
      FVAR(),
      NENTSIC('MADRID'), // municipio name -> no article -> SIMPLE-B
      NNUCLEC(''),
      NVIAC('ROZAS DE MADRID (LAS)'),
      DPSVIA(''),
    ])
    const records = parseTRAMLine(line)
    expect(records).toHaveLength(1)
    expect(records[0].codigo_postal).toBe('28016')
    expect(records[0].via_tipo_code).toBe('01')
    // grammatical article "(LAS)" is KEPT on the name
    expect(records[0].via_nombre_raw).toBe('ROZAS DE MADRID (LAS)')
  })

  it('parses a TRANSITION record into two vías sharing CP + municipio', () => {
    // Acebeda <-> Encerradero (both in CP 28755)
    const line = tramLine([
      CPRO('28'),
      CMUN('065'),
      CP('28755'),
      FVAR(),
      NENTSIC('ACEBADA (LA)'), // street#1, ends with article -> transition
      NNUCLEC(''),
      NVIAC('ENCERRADERO (DEL)'), // street#2
      DPSVIA(''),
    ])
    const records = parseTRAMLine(line)
    expect(records).toHaveLength(2)
    for (const r of records) {
      expect(r.codigo_postal).toBe('28755')
      expect(r.municipio_id).toBe('28065')
      expect(r.provincia_id).toBe('28')
    }
    expect(records.map((r) => r.via_nombre_raw).sort()).toEqual([
      'ACEBADA (LA)', // article kept
      'ENCERRADERO (DEL)',
    ])
  })

  it('detects non-Calle type words and strips them from the name', () => {
    const cases: [string, string, string][] = [
      ['AVDA BURGOS (KM.)', '02', 'BURGOS'],
      ['PLAZA RICLA (BLQ)', '03', 'RICLA'],
      ['TRVA TRIFON PEDRERO (FTA)', '06', 'TRIFON PEDRERO'],
      ['RONDA SEGOVIA (FTA)', '05', 'SEGOVIA'],
      ['CMNO MAGDALENA (CHA)', '08', 'MAGDALENA'],
      ['PSAJE TORTOSA (FTA)', '52', 'TORTOSA'],
      ['BULEV JOSE PRAT (FTA)', '10', 'JOSE PRAT'],
      ['CARRE SAN FRANCISCO (FTA)', '07', 'SAN FRANCISCO'],
      ['PLZLA OBRA (FTA)', '03', 'OBRA'],
      ['CÑADA REAL (CHA)', '24', 'REAL'],
    ]
    for (const [dpsvia, code, name] of cases) {
      const line = tramLine([
        CPRO('28'),
        CMUN('079'),
        CP('28001'),
        FVAR(),
        NENTSIC(''),
        NNUCLEC(''),
        NVIAC(''),
        DPSVIA(dpsvia),
      ])
      const rec = parseTRAMLine(line)
      expect(rec, `dpsvia=${dpsvia}`).toHaveLength(1)
      expect(rec[0].via_tipo_code).toBe(code)
      expect(rec[0].via_nombre_raw).toBe(name)
    }
  })

  it('keeps non-type leading tokens as part of the name (no ~8-char truncation)', () => {
    // "BARRO FOCOS" -> BARRO is a place name, not a street type
    const line = tramLine([
      CPRO('28'),
      CMUN('079'),
      CP('28025'),
      FVAR(),
      NENTSIC(''),
      NNUCLEC(''),
      NVIAC(''),
      DPSVIA('BARRO FOCOS (CHA)'),
    ])
    const [r] = parseTRAMLine(line)
    expect(r.via_tipo_code).toBe('01')
    expect(r.via_nombre_raw).toBe('BARRO FOCOS') // full name preserved
  })

  it('filters out a via whose name equals the record own municipio name', () => {
    const map = municipiosFromCsv(
      'CPRO,CMUN,NOMBRE,CPRO_NAME,CCAA,CCAA_NAME\n' +
        '28,079,Madrid,Madrid,13,Comunidad de Madrid\n',
    )
    // NVIAC is literally "MADRID" while the municipio is Madrid -> not a real street
    const line = tramLine([
      CPRO('28'),
      CMUN('079'),
      CP('28013'),
      FVAR(),
      NENTSIC('MADRID'),
      NNUCLEC(''),
      NVIAC('MADRID'),
      DPSVIA(''),
    ])
    expect(parseTRAMLine(line, map)).toEqual([])
  })

  it('does not drop real streets in the same municipio when a map is present', () => {
    const map = municipiosFromCsv(
      'CPRO,CMUN,NOMBRE,CPRO_NAME,CCAA,CCAA_NAME\n' +
        '28,079,Madrid,Madrid,13,Comunidad de Madrid\n',
    )
    const line = tramLine([
      CPRO('28'),
      CMUN('079'),
      CP('28013'),
      FVAR(),
      NENTSIC('MADRID'),
      NNUCLEC(''),
      NVIAC('MAYOR'),
      DPSVIA(''),
    ])
    const rec = parseTRAMLine(line, map)
    expect(rec).toHaveLength(1)
    expect(rec[0].via_nombre_raw).toBe('MAYOR')
  })

  it('drops degenerate transition streets whose name is only an article (e.g. "RONDA (DE)")', () => {
    // NENTSIC ends with article -> TRANSITION. r2 = NVIAC="RONDA (DE)" has no
    // street name (only the type word + article), so it must be dropped.
    const line = tramLine([
      CPRO('28'),
      CMUN('065'),
      CP('28755'),
      FVAR(),
      NENTSIC('ACEBADA (LA)'), // street#1, real name
      NNUCLEC(''),
      NVIAC('RONDA (DE)'), // type word + article only -> no name
      DPSVIA(''),
    ])
    const records = parseTRAMLine(line)
    expect(records).toHaveLength(1) // only street#1 survives
    expect(records[0].via_nombre_raw).toBe('ACEBADA (LA)')
  })

  it('keeps a transition r1 whose name carries a real article (e.g. "CONSTITUCION (DE LA)")', () => {
    const line = tramLine([
      CPRO('28'),
      CMUN('079'),
      CP('28013'),
      FVAR(),
      NENTSIC('CONSTITUCION (DE LA)'), // street#1, real name + article
      NNUCLEC(''),
      NVIAC('CALLE MAYOR'), // street#2, real name -> kept
      DPSVIA(''),
    ])
    const records = parseTRAMLine(line)
    expect(records).toHaveLength(2)
    expect(
      records.map((r) => r.via_nombre_raw).sort(),
    ).toEqual(['CONSTITUCION (DE LA)', 'MAYOR'])
  })
})

describe('formatMunicipioName — INE articulated municipios', () => {
  it('reorders a suffix article to the front', () => {
    expect(formatMunicipioName('BOALO (EL)')).toBe('El Boalo')
    expect(formatMunicipioName('ACEVEDA (LA)')).toBe('La Aceveda')
    expect(formatMunicipioName('MOLAR (EL)')).toBe('El Molar')
    expect(formatMunicipioName('MOLINOS (LOS)')).toBe('Los Molinos')
  })

  it('title-cases multi-word municipios', () => {
    expect(formatMunicipioName('SANTOS DE LA HUMOSA (LOS)')).toBe(
      'Los Santos de la Humosa',
    )
    expect(formatMunicipioName('SAN FERNANDO DE HENARES')).toBe(
      'San Fernando de Henares',
    )
  })

  it('leaves non-articulated names as plain title-case', () => {
    expect(formatMunicipioName('MADRID')).toBe('Madrid')
    expect(formatMunicipioName('AJALVIR')).toBe('Ajalvir')
    expect(formatMunicipioName('ALCALÁ DE HENARES')).toBe('Alcalá de Henares')
  })

  it('returns empty for blank input', () => {
    expect(formatMunicipioName('')).toBe('')
  })
})
