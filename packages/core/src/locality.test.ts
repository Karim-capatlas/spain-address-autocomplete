import { describe, expect, test } from 'vitest'
import { applyLocalityHints } from './locality.js'
import { findProvincia, findProvinciaSuffix, normalizeName } from './provincias.js'
import type { TypesenseClient, TypesenseSearchResponse } from './typesense.js'

type MunicipioDoc = { municipio: string; municipio_id: string }

/** Strip accents + punctuation and lowercase (mirrors the index tokenizer). */
function normalize(value: string): string {
  return normalizeName(value)
}

/**
 * Fake index: the `query_by=municipio` lookup honours the provincia filter and
 * matches a municipio when any query token equals one of its name tokens (the
 * OR-matching Typesense does). The street search returns an empty result.
 */
function fakeClient(byProvincia: Record<string, MunicipioDoc[]>): {
  client: TypesenseClient
  calls: Array<Record<string, string | number | boolean | undefined>>
} {
  const calls: Array<Record<string, string | number | boolean | undefined>> = []
  const client = {
    health: () => Promise.resolve(true),
    collectionExists: () => Promise.resolve(true),
    createCollection: () => Promise.resolve({ name: '', fields: [] }),
    dropCollection: () => Promise.resolve(),
    importDocuments: () => Promise.resolve({ success: 0, failed: 0 }),
    getDocument: () => Promise.resolve(null),
    search: async (
      _collection: string,
      params: Record<string, string | number | boolean | undefined>,
    ): Promise<TypesenseSearchResponse> => {
      calls.push(params)
      if (params.query_by !== 'municipio') return { found: 0, hits: [] }
      const code = String(params.filter_by ?? '').match(/\d{2}/)?.[0] ?? ''
      const queryTokens = normalize(String(params.q ?? ''))
        .split(/\s+/)
        .filter(Boolean)
      const hits = (byProvincia[code] ?? [])
        .filter((m) => {
          const nameTokens = normalize(m.municipio).split(/\s+/)
          return queryTokens.some((t) => nameTokens.includes(t))
        })
        .map((m) => ({ document: m }))
      return { found: hits.length, hits }
    },
  } as unknown as TypesenseClient
  return { client, calls }
}

const CANTABRIA: MunicipioDoc[] = [
  { municipio: 'Torrelavega', municipio_id: '39087' },
  { municipio: 'Santander', municipio_id: '39075' },
  { municipio: 'Reocín', municipio_id: '39063' },
]
const MADRID: MunicipioDoc[] = [
  { municipio: 'Madrid', municipio_id: '28079' },
  { municipio: 'San Sebastián de los Reyes', municipio_id: '28134' },
]

describe('findProvinciaSuffix', () => {
  test('matches single and multi-word province names + aliases', () => {
    expect(findProvinciaSuffix(['torrelavega', 'cantabria'])?.info.code).toBe('39')
    expect(findProvinciaSuffix(['ferrol', 'a', 'coruna'])?.info.code).toBe('15')
    expect(findProvinciaSuffix(['palma', 'illes', 'balears'])?.info.code).toBe('07')
    expect(findProvinciaSuffix(['vitoria', 'alava'])?.info.code).toBe('01')
  })

  test('returns undefined when the tail is not a province', () => {
    expect(findProvinciaSuffix(['calle', 'mayor'])).toBeUndefined()
    expect(findProvinciaSuffix(['gran', 'via', '12'])).toBeUndefined()
  })
})

describe('findProvincia', () => {
  test('resolves by code, name and alias', () => {
    expect(findProvincia('39')?.name).toBe('Cantabria')
    expect(findProvincia('CANTABRIA')?.code).toBe('39')
    expect(findProvincia('La Coruña')?.code).toBe('15')
  })
})

describe('applyLocalityHints', () => {
  test('resolves the DNI-style address to its municipio without touching the query', async () => {
    const { client } = fakeClient({ 39: CANTABRIA })
    const query = 'PLZA. DE LAS AUTONOMIAS 13 P05 C TORRELAVEGA, CANTABRIA'
    const result = await applyLocalityHints({ query }, client, 'callejero_es')
    expect(result.filterByProvincia).toBe('39')
    expect(result.filterByMunicipio).toBe('39087')
    expect(result.query).toBe(query)
  })

  test('resolves a city-province (municipio == provincia) via the fallback', async () => {
    const { client } = fakeClient({ 28: MADRID })
    const result = await applyLocalityHints({ query: 'Gran Vía 12 Madrid' }, client, 'callejero_es')
    expect(result.filterByProvincia).toBe('28')
    expect(result.filterByMunicipio).toBe('28079')
  })

  test('resolves a multi-word municipio', async () => {
    const { client } = fakeClient({ 28: MADRID })
    const result = await applyLocalityHints(
      { query: 'Calle Real 5, San Sebastián de los Reyes, Madrid' },
      client,
      'callejero_es',
    )
    expect(result.filterByMunicipio).toBe('28134')
  })

  test('adds only the provincia filter when no municipio matches', async () => {
    const { client } = fakeClient({ 27: [] })
    const result = await applyLocalityHints({ query: 'Calle Falsa 123 Lugo' }, client, 'callejero_es')
    expect(result.filterByProvincia).toBe('27')
    expect(result.filterByMunicipio).toBeUndefined()
  })

  test('leaves plain street queries untouched (no province tail)', async () => {
    const { client, calls } = fakeClient({ 39: CANTABRIA })
    const options = { query: 'Gran Vía 12' }
    expect(await applyLocalityHints(options, client, 'callejero_es')).toEqual(options)
    expect(calls).toHaveLength(0)
  })

  test('skips short non-address queries ending in a province name', async () => {
    const { client, calls } = fakeClient({ 28: MADRID })
    const options = { query: 'Calle Madrid' }
    expect(await applyLocalityHints(options, client, 'callejero_es')).toEqual(options)
    expect(calls).toHaveLength(0)
  })

  test('respects an explicit municipio filter (no lookup)', async () => {
    const { client, calls } = fakeClient({ 39: CANTABRIA })
    const options = { query: 'Autonomias Torrelavega, Cantabria', filterByMunicipio: '39087' }
    expect(await applyLocalityHints(options, client, 'callejero_es')).toEqual(options)
    expect(calls).toHaveLength(0)
  })

  test('honours a caller-provided provincia over the detected one', async () => {
    const { client } = fakeClient({ 39: CANTABRIA, 28: MADRID })
    const result = await applyLocalityHints(
      { query: 'Autonomias 13, Cantabria', filterByProvincia: 'Madrid' },
      client,
      'callejero_es',
    )
    expect(result.filterByProvincia).toBe('Madrid')
  })

  test('ignores a bare province query', async () => {
    const { client } = fakeClient({ 39: CANTABRIA })
    const options = { query: 'Cantabria' }
    expect(await applyLocalityHints(options, client, 'callejero_es')).toEqual(options)
  })
})
