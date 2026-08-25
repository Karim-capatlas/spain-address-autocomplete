import { describe, expect, it, vi } from 'vitest'
import { createApp } from './index.js'
import type { SearchResult, TypesenseClient } from '@spain-address/core'

const fakeResult: SearchResult = {
  records: [],
  groups: [
    {
      municipio_id: '28079',
      municipio: 'Madrid',
      provincia: 'Madrid',
      provincia_id: '28',
      codigo_postal: '28013',
      found: 1,
      items: [],
    },
  ],
  total: 1,
  took_ms: 1,
}

function makeClient(search = vi.fn().mockResolvedValue({ found_docs: 1, grouped_hits: [] })) {
  return { health: vi.fn(), search } as unknown as TypesenseClient & { search: ReturnType<typeof vi.fn> }
}

function app() {
  const client = makeClient()
  return { app: createApp({ client }), client }
}

describe('GET /api/address-search', () => {
  it('400 when neither q nor cp is provided', async () => {
    const { app: a } = app()
    const res = await a.request('/api/address-search')
    expect(res.status).toBe(400)
  })

  it('400 when the query exceeds the max length', async () => {
    const { app: a } = app()
    const res = await a.request(`/api/address-search?q=${'x'.repeat(101)}`)
    expect(res.status).toBe(400)
  })

  it('forwards text queries and returns the SearchResult JSON', async () => {
    const { app: a, client } = app()
    const res = await a.request('/api/address-search?q=gran%20v%C3%ADa&per_page=5&group_limit=2')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(fakeResult)
    const params = (client.search as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<string, unknown>
    expect(params.q).toBe('gran vía')
    expect(params.per_page).toBe(5)
    expect(params.group_limit).toBe(2)
    expect(params.highlight).toBe(true)
  })

  it('routes a 5-digit cp to filter_by and empty q', async () => {
    const { app: a, client } = app()
    const res = await a.request('/api/address-search?q=&cp=28013')
    expect(res.status).toBe(200)
    const params = (client.search as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<string, unknown>
    expect(params.q).toBe('')
    expect(params.filter_by).toContain('28013')
  })

  it('caps per_page/group_limit to sane maxima', async () => {
    const { app: a, client } = app()
    await a.request('/api/address-search?q=madrid&per_page=9999&group_limit=9999')
    const params = (client.search as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as Record<string, unknown>
    expect(params.per_page).toBe(25)
    expect(params.group_limit).toBe(10)
  })

  it('502 when the upstream search fails', async () => {
    const client = {
      health: vi.fn(),
      search: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as TypesenseClient
    const res = await createApp({ client }).request('/api/address-search?q=x')
    expect(res.status).toBe(502)
  })
})
