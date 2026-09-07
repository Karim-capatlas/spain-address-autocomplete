import { describe, expect, test } from 'vitest'
import {
  compactTokens,
  editDistance,
  fuzzyMatch,
  normalize,
  score,
  tokenize,
} from './fuzzy'

describe('normalize', () => {
  test('strips diacritics and lowercases', () => {
    expect(normalize('Málaga')).toBe('malaga')
    expect(normalize('CÓRDOBA')).toBe('cordoba')
    expect(normalize('Álava')).toBe('alava')
    expect(normalize('A Coruña')).toBe('a coruna')
  })

  test('misplaced accents still normalize equal', () => {
    expect(normalize('málaga')).toBe(normalize('Málaga'))
  })
})

describe('tokenize / compactTokens', () => {
  test('tokenizes on whitespace/punctuation', () => {
    expect(tokenize('De la Frontera')).toEqual(['de', 'la', 'frontera'])
    expect(tokenize('Las Rozas')).toEqual(['las', 'rozas'])
  })

  test('drops Spanish stop words', () => {
    expect(compactTokens('Las Rozas')).toEqual(['rozas'])
    expect(compactTokens('El Boalo')).toEqual(['boalo'])
    expect(compactTokens('De la Frontera')).toEqual(['frontera'])
  })
})

describe('editDistance', () => {
  test('measures typos and transpositions', () => {
    expect(editDistance('frntera', 'frontera')).toBe(1)
    expect(editDistance('madriz', 'madrid')).toBe(1)
    expect(editDistance('madrid', 'madrid')).toBe(0)
  })
})

describe('score', () => {
  test('exact match ranks highest', () => {
    expect(score('Málaga', 'Málaga')).toBe(1000)
    expect(score('malaga', 'Málaga')).toBe(1000)
  })

  test('particles/stop-words are ignored for exact match', () => {
    expect(score('rozas', 'Las Rozas')).toBe(960)
    expect(score('boalo', 'El Boalo')).toBe(960)
  })

  test('typos still match (fuzzy tier)', () => {
    expect(score('frntera', 'De la Frontera')).toBeGreaterThan(0)
    expect(score('madriz', 'Madrid')).toBeGreaterThan(0)
    expect(score('barcelo', 'Barcelona')).toBeGreaterThan(0)
  })

  test('prefix autocomplete', () => {
    const s = score('barce', 'Barcelona')
    expect(s).toBeGreaterThanOrEqual(800)
    expect(s).toBeLessThan(1000)
  })

  test('code prefix matches (leading-zero tolerant)', () => {
    expect(score('28', 'Madrid', '28')).toBeGreaterThanOrEqual(900)
    expect(score('28079', 'Madrid', '28079')).toBeGreaterThanOrEqual(900)
    expect(score('8', 'Barcelona', '08')).toBeGreaterThanOrEqual(900)
  })

  test('no match returns 0', () => {
    expect(score('zzzzz', 'Madrid')).toBe(0)
  })
})

describe('fuzzyMatch', () => {
  const items = [
    { code: '28', name: 'Madrid' },
    { code: '29', name: 'Málaga' },
    { code: '14', name: 'Córdoba' },
    { code: '08', name: 'Barcelona' },
  ]

  test('empty query returns all in original order', () => {
    expect(fuzzyMatch('', items, (i) => i.name)).toEqual(items)
  })

  test('accent-insensitive ranking', () => {
    const out = fuzzyMatch('malaga', items, (i) => i.name, (i) => i.code)
    expect(out[0]).toBe(items[1])
  })

  test('prefix and code lookups', () => {
    expect(fuzzyMatch('barce', items, (i) => i.name, (i) => i.code)[0]).toBe(items[3])
    expect(fuzzyMatch('08', items, (i) => i.name, (i) => i.code)[0]).toBe(items[3])
  })

  test('respects limit on typed queries', () => {
    const out = fuzzyMatch('ma', items, (i) => i.name, (i) => i.code, 1)
    expect(out).toHaveLength(1)
    expect(out[0]).toBe(items[0]) // Madrid (tie broken by original order)
  })
})
