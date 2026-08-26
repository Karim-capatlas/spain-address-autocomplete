/**
 * MCP server tools for Spanish address normalization (Phase 3.5).
 *
 * Two stdio tools backed by `searchAddresses()` from `@spain-address/core`:
 * - `normalize_address(text)` → single best structured match
 * - `search_addresses(query, filters?)` → ranked matches
 */

import type { AddressRecord, SearchOptions, SearchResult } from '@spain-address/core'
import type { SearchDependencies } from '@spain-address/core'
import { searchAddresses } from '@spain-address/core'

/** Search function injection point — tests swap this for a fake. */
export interface ToolDeps extends Partial<SearchDependencies> {
  search?: typeof searchAddresses
}

export const NORMALIZE_ADDRESS_TOOL = {
  name: 'normalize_address',
  description:
    'Normalize a noisy Spanish address string (e.g. from DNI/TIE OCR) into structured fields: via type, street name, municipio (name + INE code), provincia (name + code), and código postal. Returns the single best match.',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Noisy address text, e.g. "calle gran via 12 madrid"',
      },
      provincia_id: {
        type: 'string',
        description: 'Optional 2-digit INE province code to narrow the search (e.g. "28" = Madrid)',
      },
    },
    required: ['text'],
  },
} as const

export const SEARCH_ADDRESSES_TOOL = {
  name: 'search_addresses',
  description:
    'Search the Spanish street index (749K records from INE Callejero). Returns ranked matches with municipio grouping.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Address search text' },
      per_page: { type: 'number', description: 'Max results (default 10)' },
      provincia_id: { type: 'string', description: 'Filter by INE province code' },
      municipio_id: { type: 'string', description: 'Filter by 5-digit INE municipality code' },
      codigo_postal: { type: 'string', description: 'Filter by 5-digit postal code' },
    },
    required: ['query'],
  },
} as const

/** Strip a trailing house-number / floor token ("C/ Mayor 12 3ºB") for street matching. */
function stripHouseNumber(text: string): string {
  return text
    .replace(/[,;]+/g, ' ')
    .replace(/\b(n[ºo°.]?\s*)?\d+\s*[a-zº°]{0,3}\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Shape the normalized output: only the fields the OCR pipeline consumes. */
function toNormalized(record: AddressRecord) {
  return {
    via_tipo: record.via_tipo,
    via_nombre: record.via_nombre,
    via_nombre_completo: record.via_nombre_completo,
    municipio: record.municipio,
    municipio_id: record.municipio_id,
    provincia: record.provincia,
    provincia_id: record.provincia_id,
    comunidad_autonoma: record.comunidad_autonoma,
    codigo_postal: record.codigo_postal,
    label: record.label,
    confidence: 'exact' as const,
  }
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
}

function jsonContent(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

export interface NormalizeDeps {
  search?: typeof searchAddresses
  deps?: ToolDeps
}

/**
 * Implement `normalize_address`: search with the cleaned street query,
 * optionally narrowed by provincia, and return the top hit.
 */
export async function normalizeAddress(
  args: { text: string; provincia_id?: string },
  deps: ToolDeps,
): Promise<ToolResult> {
  const query = stripHouseNumber(args.text)
  if (!query) {
    return jsonContent({ error: 'empty_query', message: 'No usable street text in input' })
  }
  const options: SearchOptions = {
    query,
    perPage: 5,
    filterByProvincia: args.provincia_id,
  }
  const run = deps.search ?? searchAddresses
  const result = await run(options, {
    client: deps.client as SearchDependencies['client'],
    ...(deps.collection != null && { collection: deps.collection }),
  })
  if (!result.records.length) {
    return jsonContent({ error: 'no_match', query })
  }
  return jsonContent(toNormalized(result.records[0] as AddressRecord))
}

/** Implement `search_addresses`: pass-through to the backend with structured options. */
export async function searchAddressesTool(
  args: {
    query: string
    per_page?: number
    provincia_id?: string
    municipio_id?: string
    codigo_postal?: string
  },
  deps: ToolDeps,
): Promise<ToolResult> {
  const run = deps.search ?? searchAddresses
  const result: SearchResult = await run(
    {
      query: args.query,
      perPage: args.per_page,
      filterByProvincia: args.provincia_id,
      filterByMunicipio: args.municipio_id,
      filterByCP: args.codigo_postal,
    },
    {
      client: deps.client as SearchDependencies['client'],
      ...(deps.collection != null && { collection: deps.collection }),
    },
  )
  return jsonContent({
    total: result.total,
    groups: result.groups.map((g) => ({
      municipio_id: g.municipio_id,
      municipio: g.municipio,
      provincia: g.provincia,
      found: g.found,
      items: g.items.map(toNormalized),
    })),
  })
}

/** MCP tool manifest (name + schema pairs) served by cli.ts over stdio. */
export const TOOLS = [NORMALIZE_ADDRESS_TOOL, SEARCH_ADDRESSES_TOOL]

/** Dispatch a tool call by name. Returns null for unknown tools. */
export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  deps: ToolDeps,
): Promise<ToolResult | null> {
  switch (name) {
    case 'normalize_address':
      return normalizeAddress(
        {
          text: String(args.text ?? ''),
          ...(args.provincia_id != null && { provincia_id: String(args.provincia_id) }),
        },
        deps,
      )
    case 'search_addresses':
      return searchAddressesTool(
        {
          query: String(args.query ?? ''),
          ...(args.per_page != null && { per_page: Number(args.per_page) }),
          ...(args.provincia_id != null && { provincia_id: String(args.provincia_id) }),
          ...(args.municipio_id != null && { municipio_id: String(args.municipio_id) }),
          ...(args.codigo_postal != null && { codigo_postal: String(args.codigo_postal) }),
        },
        deps,
      )
    default:
      return null
  }
}
