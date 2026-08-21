import { test, expect, describe, beforeAll, afterAll } from 'vitest'
import { writeJsonl, writeMetadata } from '../output/jsonl-writer.js'
import { readFileSync, existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { gunzipSync } from 'zlib'
import type { AddressRecord } from '@spain-address/core'

const outDir = join(tmpdir(), `es-street-finder-jsonl-test-${process.pid}`)
const outPath = join(outDir, 'sample.jsonl')

function makeRecords(n: number): AddressRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    via_nombre: 'Gran Via',
    via_tipo: 'Calle',
    via_nombre_completo: 'Calle Gran Via',
    municipio: 'Madrid',
    municipio_id: '28079',
    provincia: 'Madrid',
    provincia_id: '28',
    comunidad_autonoma: 'Comunidad de Madrid',
    comunidad_autonoma_id: '13',
    codigo_postal: `2801${(i % 9) + 1}`,
    label: `Calle Gran Via, Madrid (2801${(i % 9) + 1})`,
    lat: 40.42,
    lon: -3.7,
  }))
}

describe('writeJsonl', () => {
  beforeAll(() => {
    mkdirSync(outDir, { recursive: true })
  })

  test('writes a JSONL file and a gzip copy plus metadata', async () => {
    const records = makeRecords(9)
    const stats = await writeJsonl(records, outPath, { gzip: true })

    // raw JSONL
    expect(existsSync(outPath)).toBe(true)
    const rawLines = readFileSync(outPath, 'utf-8').split('\n').filter((l) => l.trim())
    expect(rawLines).toHaveLength(9)
    expect(JSON.parse(rawLines[0])).toHaveProperty('id', 'id-0')

    // gzip copy
    const gzPath = outPath + '.gz'
    expect(existsSync(gzPath)).toBe(true)
    const decompressed = gunzipSync(readFileSync(gzPath)).toString('utf-8')
    expect(decompressed.split('\n').filter((l) => l.trim())).toHaveLength(9)

    // metadata file
    const metaPath = outPath.replace('.jsonl', '_metadata.json')
    expect(existsSync(metaPath)).toBe(true)
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
    expect(meta.record_count).toBe(9)
    expect(meta.provinces_covered).toEqual(['28'])
    expect(meta.gzip_size_bytes).toBeGreaterThan(0)
    // INE attribution MUST travel with the data (licensing requirement)
    expect(meta.data_source).toBe('INE Callejero del Censo Electoral')
    expect(meta.attribution).toContain('Instituto Nacional de Estadística (INE)')
    expect(stats.record_count).toBe(9)
    expect(stats.provinces_covered).toEqual(['28'])
    expect(stats.gzip_size_bytes).toBeGreaterThan(0)
    expect(stats.data_source).toBe('INE Callejero del Censo Electoral')
    expect(stats.attribution).toContain('Instituto Nacional de Estadística (INE)')
  })

  test('writeMetadata writes a readable metadata file', () => {
    const metaPath = join(outDir, 'meta.jsonl')
    writeMetadata(
      {
        source_date: '2026-01',
        record_count: 5,
        provinces_covered: ['28'],
        generated_at: 'now',
        data_source: 'INE Callejero del Censo Electoral',
        attribution: '© Instituto Nacional de Estadística (INE)',
      },
      metaPath,
    )
    const written = JSON.parse(readFileSync(metaPath.replace('.jsonl', '_metadata.json'), 'utf-8'))
    expect(written.record_count).toBe(5)
  })

  afterAll(() => {
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
  })
})
