import { createHash } from 'node:crypto'
import { test, expect, describe } from 'vitest'
import { mergeRecords, mergeRecordsAsync } from './merge.js'
import { toTitleCase, normalizeForSearch } from './normalize.js'
import type { RawRecord } from '../sources/ine-callejero.js'
import type { MunicipioMap } from '../sources/ine-municipios.js'
import { parseCartoCiudadCSV } from '../sources/cnig-cartociudad.js'

function expectedId(r: RawRecord): string {
  const viaTitle = toTitleCase(r.via_nombre_raw)
  const viaNormalized = normalizeForSearch(viaTitle)
  const key = `${r.provincia_id}-${r.municipio_id}-${r.codigo_postal}-${r.via_tipo_code}-${viaNormalized}`
  return createHash('sha1').update(key).digest('hex').slice(0, 16)
}

const MADRID_RAW: RawRecord = {
  provincia_id: '28',
  municipio_id: '28079',
  codigo_postal: '28013',
  via_tipo_code: '01',
  via_nombre_raw: 'GRAN VIA',
}

function municipiosWithMadrid(): MunicipioMap {
  return new Map([
    [
      '28079',
      {
        provincia_id: '28',
        municipio_code: '079',
        municipio_id: '28079',
        nombre: 'Madrid',
        provincia_nombre: 'Madrid',
        comunidad_autonoma_id: '13',
        comunidad_autonoma: 'Comunidad de Madrid',
      },
    ],
  ])
}

describe('mergeRecords', () => {
  test('enriches records with full municipio reference data', () => {
    const out = mergeRecords([MADRID_RAW], municipiosWithMadrid())
    expect(out).toHaveLength(1)
    const rec = out[0]

    expect(rec.municipio).toBe('Madrid')
    expect(rec.provincia).toBe('Madrid')
    expect(rec.comunidad_autonoma).toBe('Comunidad de Madrid')
    expect(rec.comunidad_autonoma_id).toBe('13')
    expect(rec.via_tipo).toBe('Calle')
    expect(rec.via_nombre).toBe('Gran Via')
    expect(rec.via_nombre_completo).toBe('Calle Gran Via')
    expect(rec.label).toBe('Calle Gran Via, Madrid (28013)')
    expect(rec.id).toBe(expectedId(MADRID_RAW))
    expect(rec.id).toMatch(/^[0-9a-f]{16}$/)
    // no coords supplied
    expect(rec.lat).toBeUndefined()
    expect(rec.lon).toBeUndefined()
  })

  test('falls back to placeholder names when municipio is unknown', () => {
    const out = mergeRecords([MADRID_RAW], new Map())
    const rec = out[0]
    expect(rec.municipio).toBe('Municipio 28079')
    expect(rec.provincia).toBe('Provincia 28')
    expect(rec.comunidad_autonoma).toBe('Unknown')
    expect(rec.comunidad_autonoma_id).toBe('28')
    expect(rec.label).toBe('Calle Gran Via, Municipio 28079 (28013)')
  })

  test('resolves via_tipo from the code map', () => {
    const raw: RawRecord = { ...MADRID_RAW, via_tipo_code: '07' }
    const out = mergeRecords([raw], municipiosWithMadrid())
    expect(out[0].via_tipo).toBe('Carretera')
    expect(out[0].via_nombre_completo).toBe('Carretera Gran Via')
  })

  test('falls back to Calle for unknown via_tipo_code', () => {
    const raw: RawRecord = { ...MADRID_RAW, via_tipo_code: '99' }
    const out = mergeRecords([raw], municipiosWithMadrid())
    expect(out[0].via_tipo).toBe('Calle')
  })

  test('drops records with an invalid (non-placeholder) postal code', () => {
    const raw: RawRecord = { ...MADRID_RAW, codigo_postal: 'abc' }
    const out = mergeRecords([raw], municipiosWithMadrid())
    expect(out).toHaveLength(0)
  })

  test('keeps records whose postal code is the 00000 placeholder', () => {
    const raw: RawRecord = { ...MADRID_RAW, codigo_postal: '00000' }
    const out = mergeRecords([raw], municipiosWithMadrid())
    expect(out).toHaveLength(1)
  })
})

describe('mergeRecords coordinate enrichment', () => {
  test('attaches lat/lon when coordinate map matches', () => {
    const coords = parseCartoCiudadCSV('Gran Via;28079;40.42;-3.70')
    const out = mergeRecords([MADRID_RAW], municipiosWithMadrid(), coords)
    expect(out[0].lat).toBe(40.42)
    expect(out[0].lon).toBe(-3.7)
  })

  test('leaves lat/lon undefined when no coordinate match', () => {
    const coords = parseCartoCiudadCSV('Other Street;28079;40.42;-3.70')
    const out = mergeRecords([MADRID_RAW], municipiosWithMadrid(), coords)
    expect(out[0].lat).toBeUndefined()
  })

  test('lookupCoordinates normalizes the via name before matching', () => {
    const coords = parseCartoCiudadCSV('GRAN VÍA;28079;40.42;-3.70')
    const out = mergeRecords([MADRID_RAW], municipiosWithMadrid(), coords)
    expect(out[0].lat).toBe(40.42)
  })
})

describe('mergeRecordsAsync', () => {
  test('yields the same enriched records as mergeRecords', async () => {
    const raw = [
      MADRID_RAW,
      { ...MADRID_RAW, via_tipo_code: '02', via_nombre_raw: 'AVENIDA DE EUROPA' },
    ]
    const expected = mergeRecords(raw, municipiosWithMadrid())

    async function* reader(): AsyncGenerator<RawRecord> {
      for (const r of raw) yield r
    }

    const yielded: typeof expected = []
    for await (const rec of mergeRecordsAsync(reader(), municipiosWithMadrid())) {
      yielded.push(rec)
    }

    expect(yielded).toEqual(expected)
  })
})
