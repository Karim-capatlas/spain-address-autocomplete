/**
 * Backend-for-frontend (BFF) proxy for the Spanish address search.
 *
 * The browser widget (`<address-search-es endpoint="…">`) talks to THIS server,
 * never to the search backend directly — so backend credentials stay
 * server-side and are resolved by core's `createSearchClient()`, which defaults
 * to Typesense (TYPESENSE_HOST / TYPESENSE_PORT / TYPESENSE_PROTOCOL /
 * TYPESENSE_API_KEY — HTTP-reachable from a Cloudflare Worker) and opts into
 * Upstash Redis Search only when `USE_UPSTASH=1` (+ UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN).
 *
 * Contract: GET /api/address-search?q=…[&cp=&per_page=&group_limit=&provincia=&municipio=]
 * → JSON `SearchResult` (same shape as @spain-address/core's searchAddresses).
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createSearchClient, searchAddresses } from '@spain-address/core'
import type { SearchDependencies, SearchOptions, SearchResult } from '@spain-address/core'

export type ProxyDependencies = SearchDependencies

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

  // CORS: reflect the request `Origin` so the browser widget (served from any
  // demo host) can reach this BFF over the public Tunnel. Configure an explicit
  // allow-list with `CORS_ORIGINS=a,b,c` in production.
  const raw = process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN
  const list = raw ? raw.split(',').map((s: string) => s.trim()).filter(Boolean) : []
  const originPolicy = (origin: string) =>
    list.length === 0 ? origin ?? null : origin && list.includes(origin) ? origin : null
  app.use('*', cors({ origin: originPolicy }))

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
      const result: SearchResult = await searchAddresses(options, deps)
      return c.json(result)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return c.json({ error: message }, 502)
    }
  })

  app.get('/health', (c) => c.json({ ok: true }))

  return app
}

/** Convenience factory used by the CLI: env-driven default backend + app. */
export function createProxyApp(): Hono {
  return createApp(createSearchClient())
}
