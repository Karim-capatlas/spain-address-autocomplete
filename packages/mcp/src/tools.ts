/**
 * MCP server tools for Spanish address normalization (Phase 3.5).
 *
 * Two stdio tools backed by `searchAddresses()` / `normalizeDomicilio()` from
 * `@spain-address/core`:
 * - `normalize_address(text)` → single best structured match + parsed "datos del
 *   domicilio" unit (número, piso, puerta, portal, bloque, escalera, Km)
 * - `search_addresses(query, filters?)` → ranked street matches, plus the same
 *   parsed unit alongside (the unit is input-side; it never filters the index)
 */

import type { AddressRecord, SearchResult } from '@spain-address/core'
import type { SearchDependencies } from '@spain-address/core'
import {
  extractCp,
  normalizeDomicilio,
  parseDomicilio,
  searchAddresses,
} from '@spain-address/core'

/** Search function injection point — tests swap this for a fake. */
export interface ToolDeps extends Partial<SearchDependencies> {
  search?: typeof searchAddresses
}

/**
 * Project only the backend fields of `ToolDeps` into a concrete
 * `SearchDependencies` — so an injected Upstash `command` (or a Typesense
 * `client`) is forwarded to `searchAddresses`, not just `client`.
 */
function backendDeps(deps: ToolDeps): SearchDependencies {
  return {
    client: deps.client,
    collection: deps.collection,
    command: deps.command,
    index: deps.index,
  }
}

export const NORMALIZE_ADDRESS_TOOL = {
  name: 'normalize_address',
  description:
    'Normalize a noisy Spanish address string (e.g. from DNI/TIE OCR) into structured "datos del domicilio": via type, street name, número, piso, puerta, portal, bloque, escalera, Km, municipio (name + INE code), provincia (name + code), and código postal. Returns the single best match with a categorical confidence ("exact" | "parcial").',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Noisy address text, e.g. "calle gran via 12 4º B madrid"',
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
    'Search the Spanish street index (749K records from INE Callejero). Returns ranked street matches with municipio grouping. A full address is accepted: número/piso/puerta/portal/bloque/escalera/Km and a trailing postal code are parsed out (returned in `unidad`) and only the street line is searched.',
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

/** Street-only projection (no unit fields — the index never carries them). */
function toStreetFields(record: AddressRecord) {
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
  }
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
}

function jsonContent(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

/**
 * Implement `normalize_address`: parse the unit out of the input, search the
 * street line, and return the top hit merged with the parsed "datos del
 * domicilio" (`DireccionNormalizada`).
 */
export async function normalizeAddress(
  args: { text: string; provincia_id?: string },
  deps: ToolDeps,
): Promise<ToolResult> {
  const search = deps.search ?? searchAddresses
  const normalized = await normalizeDomicilio(
    args.text,
    { ...deps, search },
    { filterByProvincia: args.provincia_id },
  )
  if (!normalized) {
    const { query, unidad } = parseDomicilio(args.text)
    return jsonContent({ error: 'no_match', query, unidad })
  }
  return jsonContent(normalized)
}

/**
 * Implement `search_addresses`: parse the "datos del domicilio" out of the
 * query, search the street line (falling back to the raw query if the cleaned
 * one returns nothing), and return the ranked groups plus the parsed `unidad`.
 * An explicit `codigo_postal` argument wins over a CP found in the query.
 */
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
  const parsed = parseDomicilio(args.query)
  const { query: street, cp } = extractCp(parsed.query)
  const raw = args.query.trim()
  const cleaned = street || raw

  const search = (query: string, codigoPostal?: string): Promise<SearchResult> =>
    run(
      {
        query,
        perPage: args.per_page,
        filterByProvincia: args.provincia_id,
        filterByMunicipio: args.municipio_id,
        filterByCP: codigoPostal,
      },
      backendDeps(deps),
    )

  let used = cleaned
  let result = await search(cleaned, args.codigo_postal ?? cp)
  // If stripping the unit (or a CP found in the query) left nothing, retry raw.
  if (result.total === 0 && cleaned !== raw) {
    used = raw
    result = await search(raw, args.codigo_postal)
  }

  return jsonContent({
    query: used,
    unidad: parsed.unidad,
    total: result.total,
    groups: result.groups.map((g) => ({
      municipio_id: g.municipio_id,
      municipio: g.municipio,
      provincia: g.provincia,
      found: g.found,
      items: g.items.map(toStreetFields),
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
