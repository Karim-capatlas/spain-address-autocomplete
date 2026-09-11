import { describe, expect, test } from 'vitest'
import { normalizeSearchQuery, VIA_TIPO_ABBREVIATIONS } from './via-tipos.js'

describe('normalizeSearchQuery', () => {
  test('expands a space-separated abbreviated type (c/ Villanubla)', () => {
    expect(normalizeSearchQuery('c/ Villanubla Valladolid')).toBe('Calle Villanubla Valladolid')
    expect(normalizeSearchQuery('C. Villanubla Valladolid')).toBe('Calle Villanubla Valladolid')
    expect(normalizeSearchQuery('C. Villanubla')).toBe('Calle Villanubla')
  })

  test('expands a slash-attached abbreviated type (c/Villanubla)', () => {
    expect(normalizeSearchQuery('c/Villanubla Valladolid')).toBe('Calle Villanubla Valladolid')
    expect(normalizeSearchQuery('c/Villanubla')).toBe('Calle Villanubla')
    expect(normalizeSearchQuery('C/MAYOR')).toBe('Calle MAYOR')
  })

  test('expands conventional abbreviations beyond Calle', () => {
    expect(normalizeSearchQuery('Avda Villanubla')).toBe('Avenida Villanubla')
    expect(normalizeSearchQuery('Av. Villanubla')).toBe('Avenida Villanubla')
    expect(normalizeSearchQuery('Ctra. Villanubla')).toBe('Carretera Villanubla')
    expect(normalizeSearchQuery('ctra Villanubla')).toBe('Carretera Villanubla')
    expect(normalizeSearchQuery('Pza Mayor')).toBe('Plaza Mayor')
    expect(normalizeSearchQuery('Pl. España')).toBe('Plaza España')
    expect(normalizeSearchQuery('RBLA. Catalunya')).toBe('Rambla Catalunya')
  })

  test('normalizes full words to canonical casing without changing ranking', () => {
    expect(normalizeSearchQuery('calle Villanubla')).toBe('Calle Villanubla')
    expect(normalizeSearchQuery('Avenida de la Constitución')).toBe('Avenida de la Constitución')
    expect(normalizeSearchQuery('Paseo de la Castellana')).toBe('Paseo de la Castellana')
    expect(normalizeSearchQuery('Plaza Mayor Madrid')).toBe('Plaza Mayor Madrid')
  })

  test('keeps the canonical type when the query is only a type', () => {
    expect(normalizeSearchQuery('c/')).toBe('Calle')
    expect(normalizeSearchQuery('C.')).toBe('Calle')
    expect(normalizeSearchQuery('ctra')).toBe('Carretera')
    expect(normalizeSearchQuery('calle')).toBe('Calle')
  })

  test('leaves plain street names and non-type queries untouched', () => {
    expect(normalizeSearchQuery('Villanubla Valladolid')).toBe('Villanubla Valladolid')
    expect(normalizeSearchQuery('Gran Vía 5')).toBe('Gran Vía 5')
    expect(normalizeSearchQuery('s/n')).toBe('s/n')
    expect(normalizeSearchQuery('28013')).toBe('28013')
  })

  test('handles empty / whitespace-only input', () => {
    expect(normalizeSearchQuery('')).toBe('')
    expect(normalizeSearchQuery('   ')).toBe('')
    expect(normalizeSearchQuery('  c/  Villanubla  ')).toBe('Calle Villanubla')
  })

  test('exposes the abbreviation table (c and Ctra included)', () => {
    expect(VIA_TIPO_ABBREVIATIONS.c).toBe('Calle')
    expect(VIA_TIPO_ABBREVIATIONS.ctra).toBe('Carretera')
    expect(VIA_TIPO_ABBREVIATIONS.avda).toBe('Avenida')
  })
})
