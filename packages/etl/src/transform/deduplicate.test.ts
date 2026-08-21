import { test, expect, describe, vi } from 'vitest'
import { deduplicate, logDeduplicationStats } from './deduplicate.js'
import type { AddressRecord } from '@spain-address/core'

// Minimal record builder for dedup tests (key = normalizeForSearch(via_nombre)|municipio_id|codigo_postal)
function mk(overrides: Partial<AddressRecord> = {}): AddressRecord {
  return {
    id: 'x',
    via_nombre: 'Gran Via',
    via_tipo: 'Calle',
    via_nombre_completo: 'Calle Gran Via',
    municipio: 'Madrid',
    municipio_id: '28079',
    provincia: 'Madrid',
    provincia_id: '28',
    comunidad_autonoma: 'Comunidad de Madrid',
    comunidad_autonoma_id: '13',
    codigo_postal: '28013',
    label: 'Calle Gran Via, Madrid (28013)',
    ...overrides,
  }
}

describe('deduplicate', () => {
  test('collapses identical (via, municipio, cp) records to one', () => {
    const a = mk({ id: '1' })
    const b = mk({ id: '2' }) // same key as a
    const c = mk({ id: '3' }) // same key as a
    const { deduplicated, stats } = deduplicate([a, b, c])
    expect(deduplicated).toHaveLength(1)
    expect(deduplicated[0].id).toBe('1') // first-seen wins by default
    expect(stats).toEqual({ inputCount: 3, duplicatesRemoved: 2, outputCount: 1 })
  })

  test('prefers the record that has coordinates when a duplicate lacks them', () => {
    const noCoords = mk({ id: 'no-coords', lat: undefined, lon: undefined })
    const withCoords = mk({ id: 'with-coords', lat: 40.42, lon: -3.7 })
    const { deduplicated } = deduplicate([noCoords, withCoords])
    expect(deduplicated[0].id).toBe('with-coords')
    expect(deduplicated[0].lat).toBe(40.42)
  })

  test('keeps the first-seen record when both duplicates have coordinates', () => {
    const first = mk({ id: 'first', lat: 40.4, lon: -3.7 })
    const second = mk({ id: 'second', lat: 40.5, lon: -3.8 })
    const { deduplicated } = deduplicate([first, second])
    expect(deduplicated[0].id).toBe('first')
  })

  test('keeps both records when the via name differs (even if CP+municipio match)', () => {
    const a = mk({ id: '1', via_nombre: 'Gran Via' })
    const b = mk({ id: '2', via_nombre: 'Calle Mayor' })
    const { deduplicated, stats } = deduplicate([a, b])
    expect(deduplicated).toHaveLength(2)
    expect(stats.duplicatesRemoved).toBe(0)
  })

  test('treats differently-cased/strip-diacritic names as duplicates', () => {
    const a = mk({ id: '1', via_nombre: 'Gran Vía' })
    const b = mk({ id: '2', via_nombre: 'Gran Via' }) // normalizes the same
    const { deduplicated } = deduplicate([a, b])
    expect(deduplicated).toHaveLength(1)
  })

  test('returns empty input as empty with zeroed stats', () => {
    const { deduplicated, stats } = deduplicate([])
    expect(deduplicated).toHaveLength(0)
    expect(stats).toEqual({ inputCount: 0, duplicatesRemoved: 0, outputCount: 0 })
  })

  test('logDeduplicationStats prints a formatted summary', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logDeduplicationStats({ inputCount: 1000, duplicatesRemoved: 10, outputCount: 990 })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
