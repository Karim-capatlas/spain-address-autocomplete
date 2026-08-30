import { describe, it, expect } from 'vitest'
import { filterToTypeSense, createTypesenseCascadeStore } from './typesense.js'
import type { TypesenseClient, TypesenseSearchResponse } from '@spain-address/core'

function fakeClient(
  hits: TypesenseSearchResponse['hits'] = [],
  getResult: Record<string, unknown> | null = null,
  captured?: { params?: Record<string, unknown>; id?: string },
): TypesenseClient {
  const search = async (_collection: string, params: Record<string, string | number | boolean | undefined>): Promise<TypesenseSearchResponse> => {
    if (captured) captured.params = params
    return { found: hits.length, hits }
  }
  const getDocument = async (_collection: string, documentId: string): Promise<Record<string, unknown> | null> => {
    if (captured) captured.id = documentId
    return getResult
  }
  return { search, getDocument } as unknown as TypesenseClient
}

describe('filterToTypeSense', () => {
  it('emits a bare type filter', () => {
    expect(filterToTypeSense({ type: 'provincia' })).toBe('type:=provincia')
  })

  it('joins cpro as a string', () => {
    expect(filterToTypeSense({ type: 'municipio', cpro: '28' })).toBe('type:=municipio && cpro:=28')
  })

  it('joins municipios as an array-member filter', () => {
    expect(filterToTypeSense({ type: 'cp', municipios: '28079' })).toBe('type:=cp && municipios:=28079')
  })

  it('never puts `id` in the filter_by (Typesense id is reserved)', () => {
    expect(filterToTypeSense({ type: 'cp', id: '28001' })).toBe('type:=cp')
  })
})

describe('createTypesenseCascadeStore', () => {
  it('translates a type+cpro filter into a match-all Typesense search', async () => {
    const captured: { params?: Record<string, unknown> } = {}
    const store = createTypesenseCascadeStore({
      client: fakeClient(
        [{ document: { code: '28079', name: 'Madrid', ccaa_name: 'Comunidad de Madrid' } }, { document: { code: '28013', name: 'Alcorcón', ccaa_name: 'Comunidad de Madrid' } }],
        null,
        captured,
      ),
    })
    const docs = await store.search({ type: 'municipio', cpro: '28' }, ['code', 'name', 'ccaa_name'], 10000)

    expect(captured.params).toMatchObject({
      q: '*',
      filter_by: 'type:=municipio && cpro:=28',
      per_page: 250,
      page: 1,
      include_fields: 'code,name,ccaa_name',
    })
    expect(docs).toEqual([
      { id: 'cascade:municipio:0', fields: { code: '28079', name: 'Madrid', ccaa_name: 'Comunidad de Madrid' } },
      { id: 'cascade:municipio:1', fields: { code: '28013', name: 'Alcorcón', ccaa_name: 'Comunidad de Madrid' } },
    ])
  })

  it('uses a direct id lookup (getDocument) for /validate-cp', async () => {
    const captured: { id?: string } = {}
    const store = createTypesenseCascadeStore({
      client: fakeClient(
        [],
        { id: '28001', type: 'cp', municipios: ['28079', '28078'] },
        captured,
      ),
    })
    const docs = await store.search({ type: 'cp', id: '28001' }, ['municipios'])

    expect(captured.id).toBe('cp:28001')
    expect(docs).toEqual([{ id: 'cascade:cp:0', fields: { municipios: '28079,28078' } }])
  })

  it('returns [] when the id lookup misses (404 → null)', async () => {
    const store = createTypesenseCascadeStore({
      client: fakeClient([], null),
    })
    const docs = await store.search({ type: 'cp', id: '00000' }, ['municipios'])
    expect(docs).toEqual([])
  })

  it('paginates match-all queries past Typesense\'s 250 per_page cap', async () => {
    // Barcelona province has ~311 municipios → exceeds one 250-hit page.
    const calls: number[] = []
    const client = {
      search: async (_c: string, params: Record<string, string | number | boolean | undefined>): Promise<TypesenseSearchResponse> => {
        const page = Number(params.page ?? 1)
        calls.push(page)
        const hits =
          page === 1
            ? Array.from({ length: 250 }, (_, i) => ({ document: { id: String(i), name: `M${i}`, ccaa_name: 'X' } }))
            : [{ document: { id: '250', name: 'M250', ccaa_name: 'X' } }]
        return { found: 251, hits: hits as TypesenseSearchResponse['hits'] }
      },
      getDocument: async () => null,
    } as unknown as TypesenseClient
    const store = createTypesenseCascadeStore({ client })
    const docs = await store.search({ type: 'municipio', cpro: '08' }, ['id', 'name', 'ccaa_name'])
    expect(calls).toEqual([1, 2])
    expect(docs).toHaveLength(251)
    expect(docs[250].fields.id).toBe('250')
  })
})
