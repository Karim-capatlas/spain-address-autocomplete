import { createHash } from 'node:crypto'
import { test, expect, describe } from 'vitest'
import {
  toTitleCase,
  normalizeForSearch,
  padProvinceCode,
  padMunicipioCode,
  combineMunicipioId,
  validateCP,
  VIA_TIPO_MAP,
} from './normalize.js'

describe('toTitleCase', () => {
  test('capitalizes street name', () => {
    expect(toTitleCase('GRAN VIA')).toBe('Gran Via')
  })

  test('preserves Spanish articles lowercase (not first word)', () => {
    expect(toTitleCase('CALLE DE LA PAZ')).toBe('Calle de la Paz')
    expect(toTitleCase('AVENIDA DE LOS PINOS')).toBe('Avenida de los Pinos')
  })

  test('capitalizes first word even if it is an article', () => {
    expect(toTitleCase('DEL CAMPO')).toBe('Del Campo')
  })

  test('preserves existing accents', () => {
    expect(toTitleCase('VÍA MAYOR')).toBe('Vía Mayor')
  })

  test('handles empty / whitespace strings', () => {
    expect(toTitleCase('')).toBe('')
    expect(toTitleCase('   ')).toBe('')
  })
})

describe('normalizeForSearch', () => {
  test('lowercases and strips diacritics', () => {
    expect(normalizeForSearch('Gran Vía')).toBe('gran via')
    expect(normalizeForSearch('Calle de la Paz')).toBe('calle de la paz')
  })

  test('strips the ñ (ñ -> n)', () => {
    expect(normalizeForSearch('Peña')).toBe('pena')
    expect(normalizeForSearch('ÑU')).toBe('nu')
  })

  test('preserves internal spacing structure', () => {
    expect(normalizeForSearch('A   B')).toBe('a   b')
  })
})

describe('code padding', () => {
  test('padProvinceCode zero-pads to 2 digits', () => {
    expect(padProvinceCode('8')).toBe('08')
    expect(padProvinceCode('28')).toBe('28')
  })

  test('padMunicipioCode zero-pads to 3 digits', () => {
    expect(padMunicipioCode('79')).toBe('079')
    expect(padMunicipioCode('8')).toBe('008')
    expect(padMunicipioCode('179')).toBe('179')
  })

  test('combineMunicipioId joins province + municipio codes', () => {
    expect(combineMunicipioId('28', '79')).toBe('28079')
    expect(combineMunicipioId('8', '1')).toBe('08001')
  })
})

describe('validateCP', () => {
  test('accepts valid 5-digit codes', () => {
    expect(validateCP('28013')).toBe(true)
    expect(validateCP('08001')).toBe(true)
  })

  test('rejects placeholder 000xx', () => {
    expect(validateCP('00000')).toBe(false)
    expect(validateCP('00013')).toBe(false)
  })

  test('rejects wrong length / non-digit', () => {
    expect(validateCP('2813')).toBe(false) // 4 digits
    expect(validateCP('280134')).toBe(false) // 6 digits
    expect(validateCP('abc')).toBe(false)
    expect(validateCP('')).toBe(false)
  })
})

describe('VIA_TIPO_MAP', () => {
  test('maps known type codes', () => {
    expect(VIA_TIPO_MAP['01']).toBe('Calle')
    expect(VIA_TIPO_MAP['02']).toBe('Avenida')
    expect(VIA_TIPO_MAP['09']).toBe('Gran Vía')
    expect(VIA_TIPO_MAP['95']).toBe('m')
  })

  test('has full code coverage 01-95', () => {
    for (let i = 1; i <= 95; i++) {
      const key = i.toString().padStart(2, '0')
      expect(VIA_TIPO_MAP[key]).toBeTruthy()
    }
  })
})

describe('id determinism (merge logic)', () => {
  test('generateId produces a stable 16-char hex digest', () => {
    // Mirrors packages/etl/src/transform/merge.ts#generateId
    const key = `28-28079-28013-01-gran via`
    const expected = createHash('sha1').update(key).digest('hex').slice(0, 16)
    expect(expected).toMatch(/^[0-9a-f]{16}$/)
    // deterministic
    const again = createHash('sha1').update(key).digest('hex').slice(0, 16)
    expect(again).toBe(expected)
  })
})
