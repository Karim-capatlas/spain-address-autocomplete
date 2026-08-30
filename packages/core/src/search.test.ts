import { describe, expect, test, vi } from 'vitest'
import { searchAddresses, buildFilter } from './search.js'
import { createSearchClient } from './search-client.js'
import type { TypesenseClient, TypesenseSearchResponse } from './typesense.js'
import type { AddressRecord } from './types.js'

function fakeClient(response: TypesenseSearchResponse, captured?: { params?: Record<string, string | number | boolean | undefined> }): TypesenseClient {
  return {
    health: () => Promise.resolve(true),
    collectionExists: () => Promise.resolve(true),
    createCollection: () => Promise.resolve({ name: '', fields: [] }),
    dropCollection: () => Promise.resolve(),
    importDocuments: () => Promise.resolve({ success: 0, failed: 0 }),
    search: async (_collection: string, params) => {
      if (captured) captured.params = params
      return response
    },
    getDocument: () => Promise.resolve(null),
  }
}

function makeDoc(overrides: Partial<AddressRecord> = {}): Record<string, unknown> {
  return {
    id: 'abc1',
    via_nombre: 'Gran Vía',
    via_tipo: 'Calle',
    via_nombre_completo: 'Calle Gran Vía',
    municipio: 'Madrid',
    municipio_id: '28079',
    provincia: 'Madrid',
    provincia_id: '28',
    comunidad_autonoma: 'Comunidad de Madrid',
    comunidad_autonoma_id: '13',
    codigo_postal: '28013',
    label: 'Calle Gran Vía, Madrid (28013)',
    ...overrides,
  }
}

describe('searchAddresses', () => {
  test('returns mapped records with total + timing', async () => {
    const response: TypesenseSearchResponse = {
      found: 2,
      hits: [{ document: makeDoc({ id: 'a' }) }, { document: makeDoc({ id: 'b' }) }],
    }
    const captured: { params?: Record<string, string | number | boolean | undefined> } = {}
    const result = await searchAddresses({ query: 'gran via' }, { client: fakeClient(response, captured) })

    expect(result.total).toBe(2)
    expect(result.records).toHaveLength(2)
    expect(result.records[0]).toMatchObject({ id: 'a', via_nombre: 'Gran Vía', municipio_id: '28079' })
    expect(captured.params?.q).toBe('gran via')
    expect(captured.params?.query_by).toBe('via_nombre,via_nombre_completo,municipio,provincia')
    expect(captured.params?.per_page).toBe(10) // default
  })

  test('forwards perPage and default group_limit', async () => {
    const captured: { params?: Record<string, string | number | boolean | undefined> } = {}
    const result = await searchAddresses({ query: 'x', perPage: 7 }, {
      client: fakeClient({ found: 0, hits: [] }, captured),
    })
    expect(captured.params?.per_page).toBe(7)
    expect(captured.params?.group_limit).toBe(3) // default SEARCH_GROUP_LIMIT
    expect(result.records).toEqual([])
    expect(result.total).toBe(0)
  })

  test('forwards a custom groupLimit as group_limit', async () => {
    const captured: { params?: Record<string, string | number | boolean | undefined> } = {}
    await searchAddresses({ query: 'x', groupLimit: 5 }, {
      client: fakeClient({ found: 0, hits: [] }, captured),
    })
    expect(captured.params?.group_limit).toBe(5)
  })

  test('builds a filter_by from the structured options', () => {
    expect(buildFilter({ query: 'x' })).toBeUndefined()
    expect(buildFilter({ query: 'x', filterByCP: '28013' })).toBe(
      'codigo_postal:=["28013"]',
    )
    expect(buildFilter({ query: 'x', filterByMunicipio: '28079' })).toBe(
      'municipio_id:=["28079"]',
    )
    expect(buildFilter({ query: 'x', filterByProvincia: '28' })).toBe(
      'provincia_id:=["28"]',
    )
    expect(
      buildFilter({ query: 'x', filterByProvincia: '28', filterByCP: '28001' }),
    ).toBe('provincia_id:=["28"] && codigo_postal:=["28001"]')
  })

  test('passes filter_by as undefined when no filters', async () => {
    const captured: { params?: Record<string, string | number | boolean | undefined> } = {}
    await searchAddresses({ query: 'x' }, { client: fakeClient({ found: 0, hits: [] }, captured) })
    expect(captured.params?.filter_by).toBeUndefined()
  })

  test('uses a custom collection name when provided', async () => {
    let seen = ''
    const client: TypesenseClient = {
      health: () => Promise.resolve(true),
      collectionExists: () => Promise.resolve(true),
      createCollection: () => Promise.resolve({ name: '', fields: [] }),
      dropCollection: () => Promise.resolve(),
      importDocuments: () => Promise.resolve({ success: 0, failed: 0 }),
      search: async (collection) => {
        seen = collection
        return { found: 0, hits: [] }
      },
      getDocument: () => Promise.resolve(null),
    }
    await searchAddresses({ query: 'x' }, { client, collection: 'custom' })
    expect(seen).toBe('custom')
  })

  test('flattens top-level grouped_hits (group_by responses)', async () => {
    const response: TypesenseSearchResponse = {
      found: 1,
      found_docs: 3,
      grouped_hits: [
        {
          group_key: ['28172'],
          found: 3,
          hits: [
            { document: makeDoc({ id: 'g1' }) },
            { document: makeDoc({ id: 'g2' }) },
            { document: makeDoc({ id: 'g3' }) },
          ],
        },
      ],
    }
    const result = await searchAddresses({ query: 'x' }, { client: fakeClient(response) })
    expect(result.records.map((r) => r.id)).toEqual(['g1', 'g2', 'g3'])
    expect(result.total).toBe(3) // found_docs wins over found
    // grouped tree is preserved for the widget
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].municipio_id).toBe('28172') // group_key[0]
    expect(result.groups[0].municipio).toBe('Madrid')   // from top hit
    expect(result.groups[0].provincia).toBe('Madrid')
    expect(result.groups[0].codigo_postal).toBe('28013')
    expect(result.groups[0].found).toBe(3)
    expect(result.groups[0].items.map((r) => r.id)).toEqual(['g1', 'g2', 'g3'])
  })

  test('builds a group even when its hits are empty', async () => {
    const response: TypesenseSearchResponse = {
      found: 1,
      found_docs: 0,
      grouped_hits: [{ group_key: ['28172'], found: 0, hits: [] }],
    }
    const result = await searchAddresses({ query: 'x' }, { client: fakeClient(response) })
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].municipio_id).toBe('28172') // group_key[0]
    expect(result.groups[0].items).toEqual([])
    expect(result.groups[0].municipio).toBe('') // no hits -> defensive defaults
    expect(result.groups[0].found).toBe(0)
  })

  test('prefers found_docs for total when grouping, falls back to found', async () => {
    const client: TypesenseClient = {
      health: () => Promise.resolve(true),
      collectionExists: () => Promise.resolve(true),
      createCollection: () => Promise.resolve({ name: '', fields: [] }),
      dropCollection: () => Promise.resolve(),
      importDocuments: () => Promise.resolve({ success: 0, failed: 0 }),
      search: async () => ({ found: 5, hits: [] }),
      getDocument: () => Promise.resolve(null),
    }
    const result = await searchAddresses({ query: 'x' }, { client })
    expect(result.total).toBe(5) // no found_docs -> uses found
  })

  test('coerces lat/lon to numbers and leaves them undefined when absent', async () => {
    const response: TypesenseSearchResponse = {
      found: 1,
      hits: [{ document: { ...makeDoc({ id: 'z' }), lat: '40.42', lon: '-3.7' } }],
    }
    const result = await searchAddresses({ query: 'x' }, { client: fakeClient(response) })
    expect(result.records[0].lat).toBe(40.42)
    expect(result.records[0].lon).toBe(-3.7)
  })

  test('empty hits yields empty records', async () => {
    const result = await searchAddresses({ query: 'nothing' }, {
      client: fakeClient({ found: 0, hits: [] }),
    })
    expect(result.records).toEqual([])
    expect(result.total).toBe(0)
  })

  test('handles missing hits property', async () => {
    const result = await searchAddresses({ query: 'x' }, {
      client: fakeClient({ found: 0 } as TypesenseSearchResponse),
    })
    expect(result.records).toEqual([])
  })

  test('coerces each field via ?? defaults when the document is empty', async () => {
    // One document with every field absent exercises every `?? ''` / `!= null`
    // branch in toAddressRecord.
    const response: TypesenseSearchResponse = { found: 1, hits: [{ document: {} }] }
    const result = await searchAddresses({ query: 'x' }, { client: fakeClient(response) })
    expect(result.records).toHaveLength(1)
    const rec = result.records[0]
    expect(rec.id).toBe('')
    expect(rec.via_nombre).toBe('')
    expect(rec.municipio_id).toBe('')
    expect(rec.codigo_postal).toBe('')
    expect(rec.lat).toBeUndefined()
    expect(rec.lon).toBeUndefined()
  })

  test('requests highlights and captures snippets when options.highlight is true', async () => {
    const captured: { params?: Record<string, string | number | boolean | undefined> } = {}
    const response: TypesenseSearchResponse = {
      found: 1,
      hits: [
        {
          document: makeDoc({ id: 'h1' }),
          highlights: [
            { field: 'via_nombre_completo', snippet: '<mark>Calle</mark> Mayor', matches: 1 },
          ],
        },
      ],
    }
    const result = await searchAddresses(
      { query: 'calle', highlight: true },
      { client: fakeClient(response, captured) },
    )
    expect(captured.params?.highlight).toBe(true)
    expect(captured.params?.highlight_full).toBe(true)
    expect(result.records[0].highlights).toEqual([
      { field: 'via_nombre_completo', snippet: '<mark>Calle</mark> Mayor', matches: 1 },
    ])
  })

  test('propagates highlights into grouped items', async () => {
    const response: TypesenseSearchResponse = {
      found: 1,
      found_docs: 1,
      grouped_hits: [
        {
          group_key: ['28079'],
          found: 1,
          hits: [
            {
              document: makeDoc({ id: 'g1' }),
              highlights: [{ field: 'via_nombre', snippet: '<mark>Calle</mark>', matches: 1 }],
            },
          ],
        },
      ],
    }
    const result = await searchAddresses({ query: 'x', highlight: true }, { client: fakeClient(response) })
    expect(result.groups[0].items[0].highlights).toHaveLength(1)
    expect(result.groups[0].items[0].highlights?.[0].field).toBe('via_nombre')
    expect(result.groups[0].items[0].highlights?.[0].snippet).toBe('<mark>Calle</mark>')
  })

  test('does not request highlights by default (opt-in)', async () => {
    const captured: { params?: Record<string, string | number | boolean | undefined> } = {}
    await searchAddresses({ query: 'x' }, { client: fakeClient({ found: 0, hits: [] }, captured) })
    expect(captured.params?.highlight).toBeUndefined()
    expect(captured.params?.highlight_full).toBeUndefined()
  })
})

describe('searchAddresses (Upstash dispatch)', () => {
  test('routes to the Upstash command fn and groups by municipio', async () => {
    const seen: string[][] = []
    const command = async (args: string[]): Promise<unknown> => {
      seen.push(args)
      return [
        2,
        'callejero:abc',
        [
          'id', 'abc', 'via_nombre_completo', 'Calle Mayor', 'municipio_id', '28079',
          'municipio', 'Madrid', 'provincia', 'Madrid', 'provincia_id', '28',
          'codigo_postal', '28013', 'label', 'Calle Mayor, Madrid (28013)',
        ],
        'callejero:def',
        {
          id: 'def',
          via_nombre_completo: 'Calle Menor',
          municipio_id: '28005',
          municipio: 'Alcalá de Henares',
          provincia: 'Madrid',
          provincia_id: '28',
          codigo_postal: '28005',
          label: 'Calle Menor, Alcalá (28005)',
        },
      ]
    }
    const result = await searchAddresses({ query: 'Mayor', perPage: 5 }, { command })

    expect(seen[0]?.[0]).toBe('FT.SEARCH')
    expect(seen[0]?.[1]).toBe('callejero_es')
    expect(seen[0]?.[2]).toContain('%Mayor%')
    expect(seen[0]?.[4]).toBe('0') // LIMIT 0
    expect(seen[0]?.[5]).toBe('5') // per_page override
    expect(result.total).toBe(2)
    expect(result.records.map((r) => r.id)).toEqual(['abc', 'def'])
    expect(result.groups).toHaveLength(2)
    expect(result.groups[0].items[0].via_nombre_completo).toBe('Calle Mayor')
    expect(result.groups[1].municipio).toBe('Alcalá de Henares')
  })

  test('prefers the Upstash command when both command and client are provided', async () => {
    const command = async (): Promise<unknown> => [0]
    const search = vi.fn().mockResolvedValue({ found: 0, hits: [] })
    await searchAddresses({ query: 'x' }, {
      command,
      client: { search } as unknown as TypesenseClient,
    })
    expect(search).not.toHaveBeenCalled()
  })

  test('throws when no backend is configured', async () => {
    await expect(searchAddresses({ query: 'x' }, {})).rejects.toThrow('no backend configured')
  })
})

describe('createSearchClient', () => {
  test('defaults to Typesense even when Upstash env is present (opt-in required)', () => {
    vi.stubEnv('USE_UPSTASH', '')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.test')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token')
    try {
      const deps = createSearchClient()
      expect(deps.client).toBeDefined()
      expect(deps.command).toBeUndefined()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  test('uses Upstash only when explicitly opted in (USE_UPSTASH=1) with env configured', () => {
    vi.stubEnv('USE_UPSTASH', '1')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.test')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token')
    try {
      const deps = createSearchClient()
      expect(typeof deps.command).toBe('function')
      expect(deps.client).toBeUndefined()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
