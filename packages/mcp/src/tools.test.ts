import { describe, expect, test } from 'vitest'
import type { AddressRecord, SearchResult } from '@spain-address/core'
import {
  dispatchTool,
  normalizeAddress,
  searchAddressesTool,
  TOOLS,
} from './tools.js'

const hit: AddressRecord = {
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

function fakeDeps(records: AddressRecord[], total = records.length) {
  const search = async (): Promise<SearchResult> => ({
    records,
    groups: [],
    total,
    took_ms: 1,
  })
  return { deps: {}, search } as never
}

describe('normalize_address', () => {
  test('returns the single best structured match', async () => {
    const result = await normalizeAddress({ text: 'C/ Mayor 12 3ºB, Madrid' }, fakeDeps([hit]))
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>
    expect(parsed.via_tipo).toBe('Calle')
    expect(parsed.via_nombre).toBe('Mayor')
    expect(parsed.municipio_id).toBe('28079')
    expect(parsed.codigo_postal).toBe('28013')
  })

  test('reports no_match on empty results', async () => {
    const result = await normalizeAddress({ text: 'zzz nonexistent' }, fakeDeps([]))
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as { error?: string }
    expect(parsed.error).toBe('no_match')
  })

  test('strips house numbers before searching (verified via injected spy)', async () => {
    let seenQuery = ''
    const deps = {
      search: async (options: { query: string }) => {
        seenQuery = options.query
        return { records: [hit], groups: [], total: 1, took_ms: 1 }
      },
    } as never
    await normalizeAddress({ text: 'Gran Via 12' }, deps)
    expect(seenQuery).toBe('Gran Via')
  })
})

describe('search_addresses', () => {
  test('wraps results in grouped shape with totals', async () => {
    const result = await searchAddressesTool(
      { query: 'mayor', provincia_id: '28' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { search: (async () => ({ records: [hit], groups: [{ ...hitGroup() }], total: 5, took_ms: 2 })) as any } as never,
    )
    const parsed = JSON.parse(result.content[0]?.text ?? '{}') as {
      total: number
      groups: Array<{ items: Array<{ label: string }> }>
    }
    expect(parsed.total).toBe(5)
    expect(parsed.groups[0]?.items[0]?.label).toContain('Calle Mayor')
  })
})

function hitGroup(): Record<string, unknown> {
  return {
    municipio_id: '28079',
    municipio: 'Madrid',
    provincia: 'Madrid',
    provincia_id: '28',
    codigo_postal: '28013',
    found: 1,
    items: [hit],
  }
}

describe('dispatchTool', () => {
  test('routes by name and returns null for unknown tools', async () => {
    const ok = await dispatchTool('normalize_address', { text: 'mayor madrid' }, fakeDeps([hit]))
    expect(ok?.content[0]?.text).toContain('"via_tipo": "Calle"')
    expect(await dispatchTool('nope', {}, fakeDeps([]))).toBeNull()
  })

  test('TOOLS manifest exposes both tools with required inputs', () => {
    expect(TOOLS.map((t) => t.name)).toEqual(['normalize_address', 'search_addresses'])
    for (const tool of TOOLS) {
      expect(tool.inputSchema.required.length).toBeGreaterThan(0)
    }
  })
})
