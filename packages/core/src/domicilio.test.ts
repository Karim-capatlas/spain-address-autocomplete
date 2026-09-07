import { describe, expect, test } from 'vitest'
import { parseDomicilio } from './domicilio.js'
import type { DomicilioUnit } from './types.js'

function empty(): DomicilioUnit {
  return {
    numero: null,
    piso: null,
    puerta: null,
    escalera: null,
    bloque: null,
    portal: null,
    kilometros: null,
    sin_numero: false,
    unidad_raw: '',
  }
}

/** Shorthand: parse `text` and return `{ query, unidad }` with a clean empty baseline. */
function parse(text: string): { query: string; unidad: DomicilioUnit; heuristic: boolean } {
  return parseDomicilio(text)
}

describe('parseDomicilio — sin número', () => {
  test.each(['S/N', 's/n', 'sn', 'sin número', 'sin numero', 'sin num'])('%s', (text) => {
    const { unidad } = parse(`calle mayor ${text} madrid`)
    expect(unidad.sin_numero).toBe(true)
    expect(unidad.numero).toBeNull()
  })

  test('sin número wins over a trailing bare number', () => {
    const { unidad } = parse('calle mayor s/n 12')
    expect(unidad.sin_numero).toBe(true)
    expect(unidad.numero).toBeNull()
  })
})

describe('parseDomicilio — número + letter suffix', () => {
  test('bare number becomes numero', () => {
    const { query, unidad } = parse('calle gran via 12')
    expect(unidad.numero).toBe('12')
    expect(unidad.unidad_raw).toBe('12')
    expect(query).toBe('calle gran via')
  })

  test('letter suffix stays on numero (space-separated)', () => {
    const { unidad } = parse('calle gran via 259 D')
    expect(unidad.numero).toBe('259 D')
    expect(unidad.puerta).toBeNull()
  })

  test('letter suffix stays on numero (attached)', () => {
    const { unidad } = parse('ps castellana 259d 28046')
    expect(unidad.numero).toBe('259 D')
    expect(unidad.puerta).toBeNull()
  })
})

describe('parseDomicilio — piso / puerta', () => {
  test('ordinal + letter → piso + puerta', () => {
    const { unidad } = parse('calle gran via 12 4º B')
    expect(unidad.numero).toBe('12')
    expect(unidad.piso).toBe('4º')
    expect(unidad.puerta).toBe('B')
  })

  test('ordinal alone → piso', () => {
    const { unidad } = parse('calle mayor 4º')
    expect(unidad.piso).toBe('4º')
    expect(unidad.numero).toBeNull()
  })

  test('second bare number → piso', () => {
    const { unidad } = parse('calle mayor 12 4')
    expect(unidad.numero).toBe('12')
    expect(unidad.piso).toBe('4')
  })

  test('Planta 12 → piso', () => {
    const { unidad } = parse('calle mayor planta 12')
    expect(unidad.piso).toBe('12')
  })

  test('PISO 2 PUERTA C → piso + puerta', () => {
    const { unidad } = parse('PISO 2 PUERTA C')
    expect(unidad.piso).toBe('2')
    expect(unidad.puerta).toBe('C')
  })

  test('ordinal synonyms normalize to º', () => {
    expect(parse('calle mayor 4a').unidad.piso).toBe('4º')
    expect(parse('calle mayor 4o').unidad.piso).toBe('4º')
    expect(parse('calle mayor 4ª').unidad.piso).toBe('4º')
  })

  test('Bajo / Entresuelo / Ático / Sótano are piso values, not numbers', () => {
    expect(parse('calle mayor bajo').unidad.piso).toBe('Bajo')
    expect(parse('calle mayor entresuelo').unidad.piso).toBe('Entresuelo')
    expect(parse('calle mayor atico').unidad.piso).toBe('Ático')
    expect(parse('calle mayor sotano').unidad.piso).toBe('Sótano')
    expect(parse('calle mayor principal').unidad.piso).toBe('Principal')
  })
})

describe('parseDomicilio — bloque / portal / escalera / km', () => {
  test('BLOQUE 3 PORTAL 2 ESC 1 4º D', () => {
    const { unidad } = parse('BLOQUE 3 PORTAL 2 ESC 1 4º D')
    expect(unidad.bloque).toBe('3')
    expect(unidad.portal).toBe('2')
    expect(unidad.escalera).toBe('1')
    expect(unidad.piso).toBe('4º')
    expect(unidad.puerta).toBe('D')
  })

  test('KM 4 → kilometros, no numero', () => {
    const { unidad } = parse('ctra valencia KM 4')
    expect(unidad.kilometros).toBe('4')
    expect(unidad.numero).toBeNull()
  })

  test('km. 12,5 → kilometros decimal', () => {
    const { unidad } = parse('ctra valencia km. 12,5')
    expect(unidad.kilometros).toBe('12,5')
  })
})

describe('parseDomicilio — abbreviation dictionary', () => {
  test('pta / dcha / izq / blq / esc / prtl', () => {
    expect(parse('calle mayor pta dcha').unidad.puerta).toBe('Dcha')
    expect(parse('calle mayor pta izq').unidad.puerta).toBe('Izq')
    expect(parse('calle mayor blq 2').unidad.bloque).toBe('2')
    expect(parse('calle mayor esc 1').unidad.escalera).toBe('1')
    expect(parse('calle mayor prtl 2').unidad.portal).toBe('2')
  })
})

describe('parseDomicilio — no unit', () => {
  test('street text only leaves every field null', () => {
    const { query, unidad, heuristic } = parse('calle gran via madrid')
    expect(unidad).toEqual(empty())
    expect(query).toBe('calle gran via madrid')
    expect(heuristic).toBe(false)
  })
})

describe('parseDomicilio — postal code stays in query', () => {
  test('5-digit CP is not a unit', () => {
    const { query, unidad } = parse('calle gran via 12 28013 madrid')
    expect(unidad.numero).toBe('12')
    expect(query).toBe('calle gran via 28013 madrid')
  })
})

describe('parseDomicilio — heuristic flag', () => {
  test('explicit markers are exact', () => {
    expect(parse('PISO 2').heuristic).toBe(false)
  })

  test('positional number is heuristic', () => {
    expect(parse('calle mayor 12').heuristic).toBe(true)
  })
})
