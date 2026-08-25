/**
 * Backend-for-frontend (BFF) proxy for the Spanish address search.
 *
 * The browser widget (`<address-search-es endpoint="…">`) talks to THIS server,
 * never to Typesense directly — so the Typesense host/port/api-key stay
 * server-side and are read from env vars (TYPESENSE_HOST / TYPESENSE_PORT /
 * TYPESENSE_API_KEY / TYPESENSE_PROTOCOL), exactly like `createTypesenseClient`
 * defaults.
 *
 * Contract: GET /api/address-search?q=…[&cp=&per_page=&group_limit=&provincia=&municipio=]
 * → JSON `SearchResult` (same shape as @spain-address/core's searchAddresses).
 */

import { Hono } from 'hono'
import { createTypesenseClient, searchAddresses } from '@spain-address/core'
import type { SearchOptions, SearchResult, TypesenseClient } from '@spain-address/core'

export interface ProxyDependencies {
  client: TypesenseClient
}

/** Max accepted query length — keeps the URL sane and blocks abuse. */
const MAX_QUERY_LENGTH = 100

function intParam(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/**
 * Build a Hono app exposing `GET /api/address-search`. Injecting the client via
 * `deps` keeps the handler unit-testable without a live Typesense.
 */
export function createApp(deps: ProxyDependencies): Hono {
  const app = new Hono()

  app.get('/api/address-search', async (c) => {
    const q = (c.req.query('q') ?? '').trim()
    const cp = (c.req.query('cp') ?? '').trim()
    if (!q && !cp) return c.json({ error: 'missing q or cp parameter' }, 400)
    if (q.length > MAX_QUERY_LENGTH || cp.length > MAX_QUERY_LENGTH) {
      return c.json({ error: 'query too long' }, 400)
    }
    // CP must be exactly 5 digits; anything else is treated as text.
    const filterByCP = /^\d{5}$/.test(cp) ? cp : undefined

    const options: SearchOptions = {
      query: q,
      perPage: Math.min(intParam(c.req.query('per_page'), 10), 25),
      groupLimit: Math.min(intParam(c.req.query('group_limit'), 3), 10),
      filterByCP,
      filterByProvincia: c.req.query('provincia') || undefined,
      filterByMunicipio: c.req.query('municipio') || undefined,
      highlight: true,
    }

    try {
      const result: SearchResult = await searchAddresses(options, { client: deps.client })
      return c.json(result)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return c.json({ error: message }, 502)
    }
  })

  app.get('/health', (c) => c.json({ ok: true }))

  return app
}

/** Convenience factory used by the CLI: env-driven Typesense client + app. */
export function createProxyApp(): Hono {
  return createApp({ client: createTypesenseClient() })
}
