import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { createApp, type CascadeDependencies } from './index.js'
import type { CascadeStore } from './types.js'

type FakeRow = { fields: Record<string, string> }

/** A fake store keyed by doc `type`, mirroring the real store's contract but
 * ignoring the structured filter details (handlers are tested by their query
 * params, not the store internals — see `typesense.test.ts` for the store). */
function fakeStore(rows: Record<string, FakeRow[]>): CascadeStore {
  return {
    async search(filter) {
      const list = rows[filter.type] ?? []
      return list.map((d, i) => ({ id: `cascade:doc:${i}`, fields: d.fields }))
    },
  }
}

function makeApp(deps: CascadeDependencies): Hono {
  return createApp(deps)
}

const PROVINCIAS = makeApp({
  store: fakeStore({
    provincia: [
      { fields: { code: '01', name: 'Álava', ccaa_name: 'País Vasco' } },
      { fields: { code: '28', name: 'Madrid', ccaa_name: 'Comunidad de Madrid' } },
    ],
  }),
})

const MUNICIPIOS = makeApp({
  store: fakeStore({
    municipio: [
      { fields: { code: '28079', name: 'Madrid', ccaa_name: 'Comunidad de Madrid' } },
      { fields: { code: '28013', name: 'Alcorcón', ccaa_name: 'Comunidad de Madrid' } },
    ],
  }),
})

const CPS = makeApp({
  store: fakeStore({
    cp: [{ fields: { code: '28001' } }, { fields: { code: '28002' } }, { fields: { code: '28010' } }],
  }),
})

const VALIDATE_OK = makeApp({
  store: fakeStore({ cp: [{ fields: { municipios: '28079,28078' } }] }),
})
const VALIDATE_NO = makeApp({
  store: fakeStore({ cp: [{ fields: { municipios: '99999' } }] }),
})
const VALIDATE_NONE = makeApp({ store: fakeStore({ cp: [] }) })

function json(res: Response): Promise<unknown> {
  return res.clone().json()
}

describe('cascade server endpoints (with fake store)', () => {
  it('GET /api/geo/provincias → sorted list with code/name/ccaa', async () => {
    const res = await PROVINCIAS.request('/api/geo/provincias')
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body).toEqual([
      { code: '01', name: 'Álava', ccaa: 'País Vasco' },
      { code: '28', name: 'Madrid', ccaa: 'Comunidad de Madrid' },
    ])
  })

  it('GET /api/geo/municipios?provincia=28 → list of code/name/ccaa', async () => {
    const res = await MUNICIPIOS.request('/api/geo/municipios?provincia=28')
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body).toEqual([
      { code: '28079', name: 'Madrid', ccaa: 'Comunidad de Madrid' },
      { code: '28013', name: 'Alcorcón', ccaa: 'Comunidad de Madrid' },
    ])
  })

  it('GET /api/geo/municipios — pads single-digit province, rejects non-numeric', async () => {
    const ok = await MUNICIPIOS.request('/api/geo/municipios?provincia=5')
    expect(ok.status).toBe(200)
    const bad = await MUNICIPIOS.request('/api/geo/municipios?provincia=abc')
    expect(bad.status).toBe(400)
  })

  it('GET /api/geo/municipios — 400 when provincia missing', async () => {
    const res = await MUNICIPIOS.request('/api/geo/municipios')
    expect(res.status).toBe(400)
  })

  it('GET /api/geo/cps?municipio=28079 → array of CP strings', async () => {
    const res = await CPS.request('/api/geo/cps?municipio=28079')
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body).toEqual(['28001', '28002', '28010'])
  })

  it('GET /api/geo/cps — 400 when municipio is not 5 digits', async () => {
    const bad = await CPS.request('/api/geo/cps?municipio=2807')
    expect(bad.status).toBe(400)
    const missing = await CPS.request('/api/geo/cps')
    expect(missing.status).toBe(400)
  })

  it('GET /api/geo/validate-cp valid → { valid:true, ineCode }', async () => {
    const res = await VALIDATE_OK.request('/api/geo/validate-cp?municipio=28079&cp=28001')
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body).toEqual({ valid: true, ineCode: '28079' })
  })

  it('GET /api/geo/validate-cp wrong CP → { valid:false, ineCode:null }', async () => {
    const res = await VALIDATE_NO.request('/api/geo/validate-cp?municipio=28079&cp=99999')
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body).toEqual({ valid: false, ineCode: null })
  })

  it('GET /api/geo/validate-cp unknown CP → { valid:false }', async () => {
    const res = await VALIDATE_NONE.request('/api/geo/validate-cp?municipio=28079&cp=28001')
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body).toEqual({ valid: false })
  })

  it('GET /api/geo/validate-cp — 400 when params missing/malformed', async () => {
    expect((await VALIDATE_OK.request('/api/geo/validate-cp?municipio=2807&cp=28001')).status).toBe(400)
    expect((await VALIDATE_OK.request('/api/geo/validate-cp?municipio=28079')).status).toBe(400)
  })

  it('sets CORS headers (browser demo on another origin)', async () => {
    const res = await PROVINCIAS.request('/api/geo/provincias', { headers: { origin: 'http://example.test' } })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://example.test')
  })
})
