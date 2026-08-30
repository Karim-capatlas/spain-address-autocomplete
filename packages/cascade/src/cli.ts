#!/usr/bin/env tsx
/** CLI entry for `@spain-address/cascade`.

Starts the Hono HTTP server (via `@hono/node-server`) listening on
`CASCADE_PORT` (default 5978), backed by **Typesense over HTTP** (the default
backend, also used by Cloudflare Workers), with the four `/api/geo` endpoints
defined in `index.ts`.

Env:
  TYPESENSE_HOST      — Typesense host (default `127.0.0.1`).
  TYPESENSE_PORT      — Typesense port (default `8108`).
  TYPESENSE_PROTOCOL  — `http` | `https` (default `http`).
  TYPESENSE_API_KEY   — API key (default `xyz`, the Homebrew/local default).
  CASCADE_COLLECTION  — collection name (default `cascade_es`).
  CASCADE_PORT        — listen port (default 5978).
  CASCADE_HOST        — listen host (default `0.0.0.0`).
  CORS_ORIGINS        — comma-separated browser origins (default localhost dev).
*/
import { serve } from '@hono/node-server'
import { createTypesenseClient } from '@spain-address/core'
import { createApp } from './index.js'
import { createTypesenseCascadeStore } from './typesense.js'
import { CASCADE_COLLECTION } from './schema.js'

async function main(): Promise<void> {
  const port = Number(process.env.CASCADE_PORT ?? 5978)
  const host = process.env.CASCADE_HOST ?? '0.0.0.0'
  const collection = process.env.CASCADE_COLLECTION ?? CASCADE_COLLECTION

  const client = createTypesenseClient()
  const healthy = await client.health()
  if (!healthy) {
    console.error('Typesense server is not healthy. Is it running on the configured host/port?')
    process.exit(1)
  }
  console.log(`✓ Connected to Typesense (${process.env.TYPESENSE_HOST ?? '127.0.0.1'}:${process.env.TYPESENSE_PORT ?? '8108'})`)

  const app = createApp({ store: createTypesenseCascadeStore({ client, collection }) })

  console.log(`✓ Cascade server starting on ${host}:${port}`)
  console.log(`✓ Cascade collection: ${collection}`)
  console.log(`✓ Endpoints: /api/geo/provincias | /municipios?provincia=XX | /cps?municipio=XXXXX | /validate-cp?municipio=XXXXX&cp=XXXXX`)

  serve({ fetch: app.fetch, port, hostname: host }, (info) => {
    console.log(`✓ Server listening on http://${host}:${info.port}`)
  })

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down cascade server…')
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
