#!/usr/bin/env node
/**
 * MCP server entry point — dual transport.
 *
 *   spain-address-mcp           # stdio JSON-RPC (default; Claude Desktop/Cursor)
 *   spain-address-mcp http      # Streamable HTTP on MCP_PORT (default 8789)
 *   spain-address-mcp --http    # same as above
 *
 * Both transports share the tools in `./tools.js` via `./server.js`
 * (`createMcpServer`), so behavior is identical. Backend selection uses core's
 * `createSearchClient()` (Typesense by default; Upstash opt-in).
 *
 * stdio client config:
 *   { "mcpServers": { "spain-address": { "command": "node",
 *       "args": ["/path/to/packages/mcp/dist/cli.js"],
 *       "env": { "TYPESENSE_HOST": "127.0.0.1" } } } }
 */

import { parseArgs } from 'node:util'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './server.js'
import { startHttpServer } from './http.js'

/** Start the stdio transport (spawned by an MCP host). */
export async function startServer(): Promise<void> {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

const USAGE = `spain-address-mcp — Spanish address normalization MCP server

Usage:
  spain-address-mcp          Start the stdio transport (default)
  spain-address-mcp http     Start the Streamable HTTP server on MCP_PORT

Options:
  -h, --help                 Show this help
      --http                 Alias for the "http" command

Env: MCP_PORT, MCP_HOST, MCP_AUTH_TOKEN, MCP_ALLOWED_HOSTS, CORS_ORIGINS,
     TYPESENSE_HOST, TYPESENSE_PORT, TYPESENSE_PROTOCOL, TYPESENSE_API_KEY
`

/** Parse argv and dispatch to the stdio or HTTP transport. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let values: { http?: boolean; help?: boolean }
  let positionals: string[]
  try {
    ;({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        http: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    }))
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err))
    console.error(USAGE)
    process.exitCode = 1
    return
  }

  if (values.help) {
    console.log(USAGE)
    return
  }

  const command = positionals[0]
  if (values.http || command === 'http') {
    await startHttpServer()
    return
  }
  if (command !== undefined) {
    console.error(`Unknown command: ${command}`)
    console.error(USAGE)
    process.exitCode = 1
    return
  }

  await startServer()
}

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('cli.js')) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
