/**
 * Standalone cascade server — the four provincia/municipio/CP endpoints that
 * replace the external geoapi.es router.
 *
 * Contract: matches the old router byte-for-byte except `/municipios` drops the
 * always-empty `cp: []` field and `/provincias` + `/municipios` gain `ccaa`.
 *
 *   GET /api/geo/provincias
 *   GET /api/geo/municipios?provincia=28
 *   GET /api/geo/cps?municipio=28079
 *   GET /api/geo/validate-cp?municipio=28079&cp=28001
 */

import { Hono } from 'hono'
import { createRedisCascadeStore, type CascadeStore } from './redis.js'

export type CascadeDependencies = {
  store: CascadeStore
}

/** 5-digit INE municipio id (CPRO + CMUN), e.g. "28079". */
function isMunicipioCode(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{5}$/.test(value)
}

/** 2-digit province code (CPRO). Padded, e.g. "05". */
function normalizeProvincia(value: string | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2 || /^\d{1,2}$/.test(value) === false) {
    return null
  }
  return value.padStart(2, '0')
}

export function createApp(deps: CascadeDependencies): Hono {
  const app = new Hono()

  // GET /api/geo/provincias → [{ code, name, ccaa }] (52, sorted by id)
  app.get('/api/geo/provincias', async (c) => {
    try {
      const docs = await deps.store.search('@type:{provincia}', ['id', 'name', 'ccaa_name'])
      const list = docs.map((d) => ({ code: d.fields.id, name: d.fields.name, ccaa: d.fields.ccaa_name }))
      list.sort((a, b) => a.code.localeCompare(b.code))
      return c.json(list)
    } catch (err) {
      console.error('Error fetching provincias:', err)
      return c.json({ error: 'Failed to fetch provincias' }, 500)
    }
  })

  // GET /api/geo/municipios?provincia=28 → [{ code, name, ccaa }]
  app.get('/api/geo/municipios', async (c) => {
    const provinciaCode = normalizeProvincia(c.req.query('provincia'))
    if (provinciaCode === null) {
      return c.json({ error: 'Provincia code required' }, 400)
    }
    try {
      const docs = await deps.store.search(`@type:{municipio} @cpro:{${provinciaCode}}`, ['id', 'name', 'ccaa_name'])
      return c.json(docs.map((d) => ({ code: d.fields.id, name: d.fields.name, ccaa: d.fields.ccaa_name })))
    } catch (err) {
      console.error('Error fetching municipios:', err)
      return c.json({ error: 'Failed to fetch municipios' }, 500)
    }
  })

  // GET /api/geo/cps?municipio=28079 → ["28001", …]
  app.get('/api/geo/cps', async (c) => {
    const municipioCode = c.req.query('municipio')
    if (!isMunicipioCode(municipioCode)) {
      return c.json({ error: 'Valid 5-digit Municipio code required' }, 400)
    }
    try {
      const docs = await deps.store.search(`@type:{cp} @municipios:{${municipioCode}}`, ['id'])
      return c.json(docs.map((d) => d.fields.id))
    } catch (err) {
      console.error('Error fetching CPs:', err)
      return c.json({ error: 'Failed to fetch CPs' }, 500)
    }
  })

  // GET /api/geo/validate-cp?municipio=28079&cp=28001 → { valid, ineCode }
  app.get('/api/geo/validate-cp', async (c) => {
    const municipioCode = c.req.query('municipio')
    const cp = c.req.query('cp')
    if (!isMunicipioCode(municipioCode) || !cp) {
      return c.json({ error: 'Valid 5-digit Municipio code and CP required' }, 400)
    }
    try {
      const docs = await deps.store.search(`@type:{cp} @id:{${cp}}`, ['municipios'])
      if (docs.length === 0) return c.json({ valid: false })
      const municipios = (docs[0].fields.municipios ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const valid = municipios.includes(municipioCode)
      return c.json({ valid, ineCode: valid ? municipioCode : null })
    } catch (err) {
      console.error('Error validating CP:', err)
      return c.json({ valid: false, error: 'CP validation failed' }, 500)
    }
  })

  return app
}

/** Convenience factory: live Redis-backed store + app. */
export function createCascadeApp(): Hono {
  return createApp({ store: createRedisCascadeStore() })
}