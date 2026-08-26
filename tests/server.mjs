/**
 * Dev server for the Playwright e2e suite.
 *
 * Serves the repo root statically (for examples/*.html + widget dist) AND
 * mounts the address-search proxy at /api/address-search — so the proxy-mode
 * e2e test exercises the full BFF path (widget → proxy → Typesense).
 *
 * Usage: node tests/server.mjs  (port 8000)
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
// Resolved from packages/proxy's deps (root has no direct @hono/node-server dep
// under pnpm's strict layout) — createProxyApp only needs `hono` at runtime,
// which is bundled into proxy dist. We build the delegate by hand instead:
import { createProxyApp } from '../packages/proxy/dist/index.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const port = Number(process.env.PORT ?? '8000')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
}

const proxyApp = createProxyApp()

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
    // Delegate to the Hono proxy app. Convert Node's IncomingHttpHeaders
    // (values may be string[] | undefined) into a fetch HeadersInit.
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, String(v))
      } else if (value != null) {
        headers.set(key, String(value))
      }
    }
    const proxied = await proxyApp.request(new Request(url, { headers }))
    res.writeHead(proxied.status, Object.fromEntries(proxied.headers))
    res.end(await proxied.text())
    return
  }
  try {
    const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
    const file = join(root, path === '/' || path === '\\' ? 'examples/vanilla.html' : path)
    if (!file.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`e2e server on http://127.0.0.1:${port} (static + /api/address-search proxy)`)
})
