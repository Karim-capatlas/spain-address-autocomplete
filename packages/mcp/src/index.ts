export {
  NORMALIZE_ADDRESS_TOOL,
  SEARCH_ADDRESSES_TOOL,
  TOOLS,
  normalizeAddress,
  searchAddressesTool,
  dispatchTool,
  type ToolDeps,
  type ToolResult,
} from './tools.js'

export { createMcpServer, SERVER_INFO, type CreateMcpServerOptions } from './server.js'

export {
  createMcpHttpApp,
  createMcpHttpService,
  startHttpServer,
  type McpHttpService,
  type McpHttpServiceOptions,
} from './http.js'

export { startServer, main } from './cli.js'
