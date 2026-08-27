#!/usr/bin/env tsx
/** CLI entry for `@spain-address/cascade`.

Starts the Hono HTTP server (via `@hono/node-server`) listening on
`CASCADE_PORT` (default 5978), backed by Redis over RESP (`ioredis`), with the
four `/api/geo` endpoints defined in `index.ts`.

Env:
  CASCADE_REDIS_URL  — Redis/RESP URL (default `redis://127.0.0.1:6379`). Upstash
    Cloud exposes a RESP endpoint at `rediss://<id>.upstash.io:6380` (token as
    password) — ioredis enables TLS automatically for the `rediss://` scheme, so
    no manual TLS config is needed.
  CASCADE_PORT       — listen port (default 5978).
  CASCADE_HOST       — listen host (default `0.0.0.0`).
*/
import { serve } from '@hono/node-server'
import Redis from 'ioredis'
import { createApp } from './index.js'
import { createRedisCascadeStore } from './redis.js'

async function main(): Promise<void> {
  const port = Number(process.env.CASCADE_PORT ?? 5978)
  const host = process.env.CASCADE_HOST ?? '0.0.0.0'

  const redisUrl = process.env.CASCADE_REDIS_URL ?? 'redis://127.0.0.1:6379'
  const redis = new Redis(redisUrl)
  await redis.ping()
  console.log(`✓ Connected to Redis at ${redisUrl}`)

  const app = createApp({ store: createRedisCascadeStore(redis) })

  console.log(`✓ Cascade server starting on ${host}:${port}`)
  console.log(`✓ Cascade index: cascade_es, hash prefix: cascade:`)
  console.log(`✓ Endpoints: /api/geo/provincias | /municipios?provincia=XX | /cps?municipio=XXXXX | /validate-cp?municipio=XXXXX&cp=XXXXX`)

  serve({ fetch: app.fetch, port, hostname: host }, (info) => {
    console.log(`✓ Server listening on http://${host}:${info.port}`)
  })

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down cascade server…')
    await redis.quit()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
