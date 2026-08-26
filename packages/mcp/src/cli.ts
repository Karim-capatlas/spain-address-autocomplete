/**
 * MCP server entry point (stdio transport).
 *
 * Spawnable from Claude Desktop / Cursor / the parent OCR pipeline:
 *   { "mcpServers": { "spain-address": { "command": "node",
 *       "args": ["/path/to/packages/mcp/dist/cli.js"],
 *       "env": { "TYPESENSE_HOST": "127.0.0.1", ... } } } }
 *
 * Implements the MCP handshake minimally over newline-delimited JSON-RPC so it
 * works without pulling the full SDK into the build (kept dependency-light by
 * design; swap for @modelcontextprotocol/sdk when publishing).
 *
 * Backend selection uses core's `createSearchClient()` (Phase 3.5): prefers
 * Upstash/Redis Search when UPSTASH_REDIS_REST_URL/TOKEN are set, falling back
 * to the local Typesense server. Set the env vars in the MCP server block:
 *   "env": { "UPSTASH_REDIS_REST_URL": "…", "UPSTASH_REDIS_REST_TOKEN": "…" }
 */

import { createInterface } from 'node:readline'
import { dispatchTool, TOOLS } from './tools.js'
import { createSearchClient } from '@spain-address/core'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number | string
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string }
}

const SERVER_INFO = {
  name: 'spain-address-autocomplete',
  version: '0.1.0',
}

const PROTOCOL_VERSION = '2024-11-05'

export { SERVER_INFO, PROTOCOL_VERSION }

function respond(id: JsonRpcRequest['id'] | null, body: Omit<JsonRpcResponse, 'jsonrpc' | 'id'>): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: id ?? null, ...body })}\n`)
}

async function handle(req: JsonRpcRequest): Promise<void> {
  switch (req.method) {
    case 'initialize':
      respond(req.id, {
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      })
      break
    case 'notifications/initialized':
      // notification — no response
      break
    case 'ping':
      respond(req.id, { result: {} })
      break
    case 'tools/list':
      respond(req.id, { result: { tools: TOOLS } })
      break
    case 'tools/call': {
      const name = String(req.params?.name ?? '')
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>
      try {
        const deps = createSearchClient()
        const toolResult = await dispatchTool(name, args, deps)
        if (!toolResult) {
          respond(req.id, { error: { code: -32602, message: `Unknown tool: ${name}` } })
          return
        }
        respond(req.id, {
          result: { content: toolResult.content, isError: false },
        })
      } catch (err) {
        respond(req.id, {
          result: {
            content: [{ type: 'text', text: String(err) }],
            isError: true,
          },
        })
      }
      break
    }
    default:
      if (req.id !== undefined) {
        respond(req.id, { error: { code: -32601, message: `Method not found: ${req.method}` } })
      }
  }
}

export function startServer(): void {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
  rl.on('line', (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let req: JsonRpcRequest
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest
    } catch {
      respond(null, { error: { code: -32700, message: 'Parse error' } })
      return
    }
    void handle(req)
  })
}

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('cli.js')) {
  startServer()
}
