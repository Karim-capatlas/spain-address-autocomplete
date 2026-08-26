import { describe, expect, test, vi } from 'vitest'
import {
  createUpstashClient,
  buildSearchArgs,
  buildFilterClause,
  groupRecords,
  parseSearchReply,
  searchAddressesUpstash,
  type FetchLike,
} from './redis.js'
import type { AddressRecord } from './types.js'

function mockFetch(
  result: unknown,
  calls?: { lastUrl?: string; lastBody?: string },
): FetchLike {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (calls) {
      calls.lastUrl = url
      calls.lastBody = String(init?.body ?? '')
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ result }),
      text: async () => JSON.stringify({ result }),
    }
  }) as unknown as FetchLike
}

describe('createUpstashClient', () => {
  test('health true on PONG, false on transport error', async () => {
    const ok = createUpstashClient({
      config: { url: 'https://example.test', token: 't' },
      fetchImpl: mockFetch('PONG'),
    })
    await expect(ok.health()).resolves.toBe(true)

    const down = createUpstashClient({
      config: { url: 'https://example.test', token: 't' },
      fetchImpl: (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as FetchLike,
    })
    await expect(down.health()).resolves.toBe(false)
  })

  test('command sends bearer auth + JSON array body and decodes result', async () => {
    const spy = { lastUrl: '', lastBody: '' }
    const client = createUpstashClient({
      config: { url: 'https://example.test', token: 'secret' },
      fetchImpl: mockFetch(['a', 'b'], spy),
    })
    const result = await client.command<string[]>(['LRANGE', 'k', '0', '-1'])
    expect(result).toEqual(['a', 'b'])
    expect(spy.lastUrl).toBe('https://example.test/')
    expect(spy.lastBody).toBe(JSON.stringify(['LRANGE', 'k', '0', '-1']))
  })

  test('command throws on Redis ERR result unless allowErrorResult', async () => {
    const client = createUpstashClient({
      config: { url: 'https://example.test', token: 't' },
      fetchImpl: mockFetch('ERR unknown command'),
    })
    await expect(client.command(['NOPE'])).rejects.toThrow('ERR unknown command')
    await expect(client.command(['NOPE'], { allowErrorResult: true })).resolves.toBe(
      'ERR unknown command',
    )
  })

  test('throws when config is incomplete', () => {
    expect(() =>
      createUpstashClient({ config: { url: '', token: '' }, fetchImpl: mockFetch('PONG') }),
    ).toThrow(/config incomplete/)
  })
})

const sampleDoc = {
  id: 'abc123',
  via_nombre: 'Mayor',
  via_tipo: 'Calle',
  via_nombre_completo: 'Calle Mayor',
  municipio: 'Madrid',
  municipio_id: '28079',
  provincia: 'Madrid',
  provincia_id: '28',
  comunidad_autonoma: 'Comunidad de Madrid',
  comunidad_autonoma_id: '13',
  codigo_postal: '28013',
  label: 'Calle Mayor, Madrid (28013)',
}

describe('redis search building + parsing', () => {
  test('buildSearchArgs wraps words in fuzzy operators and applies filters', () => {
    const args = buildSearchArgs({
      query: 'Gran Via',
      filterByProvincia: '28',
      filterByCP: '28013',
    })
    expect(args[0]).toBe('FT.SEARCH')
    expect(args[1]).toBe('callejero_es')
    expect(args[2]).toContain('@provincia_id:{28}')
    expect(args[2]).toContain('@codigo_postal:{28013}')
    expect(args[2]).toContain('%Gran%')
    expect(args[2]).toContain('%Via%')
  })

  test('buildFilterClause joins TAG clauses with spaces', () => {
    expect(buildFilterClause({ query: 'x', filterByMunicipio: '28079' })).toBe(
      '@municipio_id:{28079}',
    )
    expect(buildFilterClause({ query: 'x' })).toBeUndefined()
  })

  test('parseSearchReply decodes [total, key, doc-array, …] replies', () => {
    const reply = [
      2,
      'callejero:abc123',
      ['id', 'abc123', 'via_nombre_completo', 'Calle Mayor', 'municipio_id', '28079'],
      'callejero:def456',
      sampleDoc,
    ]
    const { total, records } = parseSearchReply(reply)
    expect(total).toBe(2)
    expect(records).toHaveLength(2)
    expect(records[0]?.via_nombre_completo).toBe('Calle Mayor')
    expect(records[0]?.municipio_id).toBe('28079')
    expect(records[1]?.codigo_postal).toBe('28013')
  })

  test('parseSearchReply guards non-array / empty replies', () => {
    expect(parseSearchReply(null)).toEqual({ total: 0, records: [] })
    expect(parseSearchReply([0])).toEqual({ total: 0, records: [] })
  })

  test('groupRecords caps items at groupLimit and preserves order', () => {
    const madrid: AddressRecord = { ...sampleDoc, codigo_postal: '28001' } as AddressRecord
    const madrid2: AddressRecord = { ...sampleDoc, codigo_postal: '28002' } as AddressRecord
    const alcala: AddressRecord = {
      ...sampleDoc,
      municipio: 'Alcalá de Henares',
      municipio_id: '28005',
    } as AddressRecord
    const groups = groupRecords([madrid, madrid2, alcala], 1)
    expect(groups).toHaveLength(2)
    expect(groups[0]?.items).toHaveLength(1)
    expect(groups[0]?.found).toBe(2)
    expect(groups[1]?.municipio).toBe('Alcalá de Henares')
  })

  test('searchAddressesUpstash runs FT.SEARCH through the injected command fn', async () => {
    const seen: string[][] = []
    const deps = {
      command: async (args: string[]): Promise<unknown> => {
        seen.push(args)
        return [1, 'callejero:abc123', ['id', 'abc123', 'via_nombre_completo', 'Calle Mayor']]
      },
    }
    const result = await searchAddressesUpstash({ query: 'Mayor' }, deps)
    expect(seen[0]?.[0]).toBe('FT.SEARCH')
    expect(result.total).toBe(1)
    expect(result.records[0]?.via_nombre_completo).toBe('Calle Mayor')
    expect(result.groups[0]?.municipio_id).toBe('')
    expect(result.took_ms).toBeGreaterThanOrEqual(0)
  })
})
