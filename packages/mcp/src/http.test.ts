import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { serve } from '@hono/node-server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { AddressRecord, SearchResult } from '@spain-address/core'
import { createMcpHttpService } from './http.js'

const hit: AddressRecord = {
  id: 'abc123',
  via_nombre: 'Mayor',
  via_tipo: 'Calle',
  via_nombre_completo: 'Calle Mayor',
  municipio: 'Madrid',
  municipio_id: '28079',
  provincia: 'Madrid',
  provincia_id: '28',
  comunidad_autonoma: 'Comunidad de Madrid',
  comunidad_autonoma_id: '13',
  codigo_postal: '28013',
  label: 'Calle Mayor, Madrid (28013)',
}

function fakeDeps(records: AddressRecord[]) {
  const search = async (): Promise<SearchResult> => ({
    records,
    groups: [],
    total: records.length,
    took_ms: 1,
  })
  return { search } as never
}

async function startService() {
  const service = createMcpHttpService({ deps: fakeDeps([hit]), port: 0 })
  const started = await new Promise<{ port: number; server: ReturnType<typeof serve> }>(
    (resolve) => {
      const server = serve(
        { fetch: service.app.fetch, port: 0, hostname: '127.0.0.1' },
        (info) => resolve({ port: info.port, server }),
      )
    },
  )
  return {
    base: `http://127.0.0.1:${started.port}`,
    service,
    close: async () => {
      await service.close()
      await new Promise<void>((resolve) => started.server.close(() => resolve()))
    },
  }
}

const ORIGINAL_HOSTS = process.env.MCP_ALLOWED_HOSTS
const ORIGINAL_TOKEN = process.env.MCP_AUTH_TOKEN

beforeEach(() => {
  // Disable host validation (the ephemeral port is unknown up front).
  process.env.MCP_ALLOWED_HOSTS = ''
  delete process.env.MCP_AUTH_TOKEN
})

afterEach(() => {
  if (ORIGINAL_HOSTS === undefined) delete process.env.MCP_ALLOWED_HOSTS
  else process.env.MCP_ALLOWED_HOSTS = ORIGINAL_HOSTS
  if (ORIGINAL_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = ORIGINAL_TOKEN
})

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content
  return content?.[0]?.text ?? ''
}

describe('MCP Streamable HTTP', () => {
  test('serves GET /health', async () => {
    const s = await startService()
    try {
      const res = await fetch(`${s.base}/health`)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
    } finally {
      await s.close()
    }
  })

  test('initializes a session and calls a tool over HTTP', async () => {
    const s = await startService()
    const transport = new StreamableHTTPClientTransport(new URL(`${s.base}/mcp`))
    const client = new Client({ name: 'http-test-client', version: '1.0.0' })
    try {
      await client.connect(transport)
      expect(transport.sessionId).toBeTruthy()

      const { tools } = await client.listTools()
      expect(tools.map((t) => t.name)).toEqual(['normalize_address', 'search_addresses'])

      const result = await client.callTool({
        name: 'normalize_address',
        arguments: { text: 'C/ Mayor 12 3ºB, Madrid' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result)) as Record<string, unknown>
      expect(parsed.municipio_id).toBe('28079')
      expect(s.service.sessions.size).toBe(1)
    } finally {
      await client.close()
      await s.close()
    }
  })

  test('rejects unauthenticated requests when MCP_AUTH_TOKEN is set', async () => {
    process.env.MCP_AUTH_TOKEN = 'secret'
    const s = await startService()
    try {
      const init = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'probe', version: '1.0.0' },
        },
      }
      const unauthorized = await fetch(`${s.base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(init),
      })
      expect(unauthorized.status).toBe(401)

      const authorized = await fetch(`${s.base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer secret' },
        body: JSON.stringify(init),
      })
      expect(authorized.status).not.toBe(401)
    } finally {
      await s.close()
    }
  })
})
