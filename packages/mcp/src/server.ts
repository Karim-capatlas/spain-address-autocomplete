/**
 * Shared MCP server definition (Phase 3.5 → HTTP transport).
 *
 * A single low-level `Server` instance drives BOTH transports: stdio
 * (`./cli.js`) and Streamable HTTP (`./http.js`). Tools are the existing
 * `TOOLS` manifest + `dispatchTool`, so the JSON-Schema definitions in
 * `tools.ts` stay the single source of truth (no zod rewrite).
 *
 * `deps` is injectable for tests; in production it defaults to core's
 * `createSearchClient()` (Typesense by default, Upstash opt-in).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { createSearchClient } from '@spain-address/core'
import { dispatchTool, TOOLS, type ToolDeps } from './tools.js'

export const SERVER_INFO: { name: string; version: string } = {
  name: 'spain-address-autocomplete',
  version: '0.1.0',
}

export interface CreateMcpServerOptions {
  /** Search dependencies; defaults to `createSearchClient()` per tool call. */
  deps?: ToolDeps
}

/** Build an MCP `Server` wired to the Spanish address tools. */
export function createMcpServer(options: CreateMcpServerOptions = {}): Server {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOLS as unknown as Tool[],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name
    const args = (request.params.arguments ?? {}) as Record<string, unknown>
    try {
      const deps = options.deps ?? createSearchClient()
      const result = await dispatchTool(name, args, deps)
      if (!result) {
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        }
      }
      return { content: result.content, isError: false }
    } catch (err) {
      return {
        content: [{ type: 'text', text: String(err) }],
        isError: true,
      }
    }
  })

  return server
}
