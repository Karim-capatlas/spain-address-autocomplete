/**
 * Streamable HTTP transport for @spain-address/mcp.
 *
 * Mounts a stateful MCP endpoint at `POST|GET|DELETE /mcp` plus `GET /health`
 * on a Hono app, served by `@hono/node-server`. Uses the SDK's web-standard
 * transport directly — `transport.handleRequest(c.req.raw)` returns a `Response`,
 * so there is no Node `IncomingMessage`/`ServerResponse` bridging.
 *
 * Sessions are stateful: the first `initialize` POST creates one and stores it
 * in an in-memory `Map` keyed by `Mcp-Session-Id`; `DELETE` (or transport close)
 * removes it. Sessions do not survive a restart — clients re-initialize.
 *
 * Env:
 *   MCP_PORT           — listen port (default 8789).
 *   MCP_HOST           — listen host (default 0.0.0.0).
 *   MCP_AUTH_TOKEN     — if set, require `Authorization: Bearer <token>`.
 *   MCP_ALLOWED_HOSTS  — comma list for DNS-rebinding protection
 *                        (default localhost,127.0.0.1 + those with MCP_PORT).
 *                        Set to an empty string to disable host validation.
 *   CORS_ORIGINS       — comma list of browser origins (default: reflect any).
 *
 * Backend selection is core's `createSearchClient()` (Typesense default;
 * Upstash opt-in), same as the stdio transport.
 */

import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createMcpServer } from './server.js'
import type { ToolDeps } from './tools.js'

const DEFAULT_PORT = 8789

type CorsOrigin = NonNullable<Parameters<typeof cors>[0]>['origin']

/** Mirror the proxy/cascade CORS policy: reflect any Origin unless a list is set. */
function corsOrigin(): CorsOrigin {
  const raw = process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN
  const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
  return (origin: string) => {
    if (list.length === 0) return origin ?? null
    return origin && list.includes(origin) ? origin : null
  }
}

/** Explicit CORS origin list (used for the transport's origin validation). */
function corsOriginList(): string[] {
  const raw = process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN
  return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
}

/**
 * DNS-rebinding allow-list. `MCP_ALLOWED_HOSTS` matches the `Host` header
 * exactly (port included); when unset we allow localhost with and without the
 * configured port so `curl localhost:8789` and the client both pass.
 */
function allowedHosts(port: number): string[] {
  const raw = process.env.MCP_ALLOWED_HOSTS
  if (raw !== undefined) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  const hosts = ['localhost', '127.0.0.1']
  return [...hosts, ...hosts.map((h) => `${h}:${port}`)]
}

function rpcError(message: string, status: 400 | 403 | 404): Response {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32000, message }, id: null },
    { status },
  )
}

function isInitializeRequest(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { method?: unknown }).method === 'initialize'
  )
}

export interface McpHttpServiceOptions {
  /** Search dependencies for tests; defaults to the env-driven backend. */
  deps?: ToolDeps
  /** Used for the default DNS-rebinding allow-list; defaults to `MCP_PORT`. */
  port?: number
}

export interface McpHttpService {
  app: Hono
  sessions: Map<string, WebStandardStreamableHTTPServerTransport>
  close: () => Promise<void>
}

/**
 * Build the Hono app + session registry. `createMcpHttpApp()` returns just the
 * app (for mounting); the service object additionally exposes `close()` for a
 * graceful shutdown.
 */
export function createMcpHttpService(options: McpHttpServiceOptions = {}): McpHttpService {
  const port = options.port ?? Number(process.env.MCP_PORT ?? DEFAULT_PORT)
  const app = new Hono()
  const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>()

  app.use('*', cors({ origin: corsOrigin() }))
  app.get('/health', (c) => c.json({ ok: true }))

  const token = process.env.MCP_AUTH_TOKEN
  if (token) {
    app.use('/mcp', async (c, next) => {
      if (c.req.header('authorization') !== `Bearer ${token}`) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      return next()
    })
  }

  app.all('/mcp', async (c) => {
    const sessionId = c.req.header('mcp-session-id')

    if (sessionId) {
      const existing = sessions.get(sessionId)
      if (!existing) return rpcError('Session not found', 404)
      return existing.handleRequest(c.req.raw)
    }

    if (c.req.method !== 'POST') {
      return rpcError('Bad Request: Mcp-Session-Id header is required', 400)
    }

    let parsedBody: unknown
    try {
      parsedBody = await c.req.json()
    } catch {
      return rpcError('Parse error', 400)
    }
    if (!isInitializeRequest(parsedBody)) {
      return rpcError('Bad Request: Mcp-Session-Id header is required', 400)
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport)
      },
      onsessionclosed: (id) => {
        sessions.delete(id)
      },
      enableDnsRebindingProtection: true,
      allowedHosts: allowedHosts(port),
      allowedOrigins: corsOriginList(),
    })
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId)
    }

    await createMcpServer(options.deps ? { deps: options.deps } : {}).connect(transport)
    return transport.handleRequest(c.req.raw, { parsedBody })
  })

  const close = async (): Promise<void> => {
    await Promise.all(
      [...sessions.values()].map((transport) => transport.close().catch(() => undefined)),
    )
    sessions.clear()
  }

  return { app, sessions, close }
}

/** The Hono app only (session state stays internal). */
export function createMcpHttpApp(options: McpHttpServiceOptions = {}): Hono {
  return createMcpHttpService(options).app
}

/** Start the standalone HTTP service (used by `spain-address-mcp http`). */
export async function startHttpServer(): Promise<void> {
  const port = Number(process.env.MCP_PORT ?? DEFAULT_PORT)
  const host = process.env.MCP_HOST ?? '0.0.0.0'
  const service = createMcpHttpService({ port })

  const server = serve({ fetch: service.app.fetch, port, hostname: host }, (info) => {
    console.log(`✓ MCP Streamable HTTP listening on http://${host}:${info.port}/mcp`)
    console.log(`✓ Health: http://${host}:${info.port}/health`)
    if (process.env.MCP_AUTH_TOKEN) console.log('✓ Bearer auth enabled (MCP_AUTH_TOKEN)')
  })

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down MCP HTTP server…')
    await service.close()
    server.close(() => process.exit(0))
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())
}
