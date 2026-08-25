/**
 * CLI entry: `tsx packages/proxy/src/cli.ts` (or the built dist/cli.js).
 * Env vars: PORT (default 8787), TYPESENSE_HOST/PORT/PROTOCOL/API_KEY.
 */

import { serve } from '@hono/node-server'
import { createProxyApp } from './index.js'

const port = Number(process.env.PORT ?? '8787')
const app = createProxyApp()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`address-search-proxy listening on http://127.0.0.1:${info.port}`)
  console.log(`  GET /api/address-search?q=<text>`)
})
