import { describe, expect, test, vi } from 'vitest'
import { createTypesenseClient, DEFAULT_TYPESENSE_CONFIG, type FetchLike } from './typesense.js'

function mockFetch(
  response: { ok?: boolean; status?: number; json?: unknown; text?: string },
  calls?: { lastUrl?: string; lastInit?: RequestInit } | ((url: string, init?: RequestInit) => void),
): FetchLike {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (typeof calls === 'function') calls(url, init)
    else if (calls) {
      calls.lastUrl = url
      calls.lastInit = init
    }
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.json ?? {},
      text: async () => response.text ?? '',
    }
  }) as unknown as FetchLike
}

describe('createTypesenseClient', () => {
  test('health resolves true when server reports ok:true', async () => {
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ json: { ok: true } }),
    })
    await expect(client.health()).resolves.toBe(true)
  })

  test('health resolves false on non-ok or missing ok flag', async () => {
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ ok: false, status: 503, json: { ok: false } }),
    })
    await expect(client.health()).resolves.toBe(false)
  })

  test('collectionExists true on 200, false on 404', async () => {
    const okFetch = mockFetch({ ok: true })
    const notFound = mockFetch({ ok: false, status: 404 })
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: okFetch,
    })
    await expect(client.collectionExists('callejero_es')).resolves.toBe(true)
    expect(okFetch).toHaveBeenCalledTimes(1)
    // 404 path
    const client2 = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: notFound,
    })
    await expect(client2.collectionExists('nope')).resolves.toBe(false)
  })

  test('createCollection POSTs schema and returns it', async () => {
    const spy = { lastUrl: '', lastInit: undefined as RequestInit | undefined }
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ json: { name: 'callejero_es', fields: [] } }, spy),
    })
    const schema = { name: 'callejero_es', fields: [{ name: 'id', type: 'string' }] }
    const result = await client.createCollection(schema)
    expect(result.name).toBe('callejero_es')
    expect(spy.lastUrl).toContain('/collections')
    expect(spy.lastInit?.method).toBe('POST')
    expect(spy.lastInit?.body).toBe(JSON.stringify(schema))
  })

  test('createCollection throws on failure', async () => {
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ ok: false, status: 409, text: 'exists' }),
    })
    await expect(client.createCollection({ name: 'x', fields: [] })).rejects.toThrow('409')
  })

  test('dropCollection DELETEs and throws on failure', async () => {
    const spy = { lastUrl: '', lastInit: undefined as RequestInit | undefined }
    const okClient = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({}, spy),
    })
    await okClient.dropCollection('callejero_es')
    expect(spy.lastUrl).toContain('/collections/callejero_es')
    expect(spy.lastInit?.method).toBe('DELETE')

    const badClient = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ ok: false, status: 404, text: 'no such' }),
    })
    await expect(badClient.dropCollection('nope')).rejects.toThrow('404')
  })

  test('importDocuments uses POST and counts success/failed from NDJSON response', async () => {
    const body = '{"success":true}\n{"success":false,"error":"dup"}\n{"success":true}\n'
    const spy = { lastUrl: '', lastInit: undefined as RequestInit | undefined }
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ text: body }, spy),
    })
    const res = await client.importDocuments('callejero_es', '{"a":1}\n{"b":2}\n', {
      batchSize: 500,
      action: 'upsert',
    })
    expect(res.success).toBe(2)
    expect(res.failed).toBe(1)
    // Typesense 30.x: documents are imported via POST, not PUT.
    expect(spy.lastInit?.method).toBe('POST')
    expect(spy.lastUrl).toContain('/documents/import')
  })

  test('importDocuments skips invalid JSON lines as failed', async () => {
    const body = '{"success":true}\nnot json\n{"success":true}\n'
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ text: body }),
    })
    const res = await client.importDocuments('c', '')
    expect(res.success).toBe(2)
    expect(res.failed).toBe(1)
  })

  test('importDocuments throws on failure', async () => {
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ ok: false, status: 400, text: 'bad' }),
    })
    await expect(client.importDocuments('c', '')).rejects.toThrow('400')
  })

  test('search GETs with query params and returns response', async () => {
    const spy = { lastUrl: '', lastInit: undefined as RequestInit | undefined }
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ json: { found: 3, hits: [] } }, spy),
    })
    const res = await client.search('callejero_es', { q: 'gran via', per_page: 5 })
    expect(res.found).toBe(3)
    expect(spy.lastUrl).toContain('/collections/callejero_es/documents/search')
    expect(spy.lastUrl).toContain('q=gran+via')
    expect(spy.lastUrl).toContain('per_page=5')
    expect(spy.lastInit?.method).toBe('GET')
  })

  test('search throws on failure', async () => {
    const client = createTypesenseClient({
      config: { host: 'example.test', port: 1, apiKey: 'k' },
      fetchImpl: mockFetch({ ok: false, status: 400, text: 'bad' }),
    })
    await expect(client.search('c', {})).rejects.toThrow('400')
  })

  test('DEFAULT_TYPESENSE_CONFIG reads env with brew defaults', () => {
    expect(DEFAULT_TYPESENSE_CONFIG.port).toBe(8108)
    expect(DEFAULT_TYPESENSE_CONFIG.host).toBe('127.0.0.1')
    expect(DEFAULT_TYPESENSE_CONFIG.apiKey).toBe('xyz')
  })
})
