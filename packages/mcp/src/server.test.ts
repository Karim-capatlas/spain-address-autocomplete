import { describe, expect, test } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { AddressRecord, SearchResult } from '@spain-address/core'
import { createMcpServer } from './server.js'

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

async function connect(records: AddressRecord[] = [hit]) {
  const server = createMcpServer({ deps: fakeDeps(records) })
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, server }
}

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content
  return content?.[0]?.text ?? ''
}

describe('createMcpServer', () => {
  test('lists both tools from the shared TOOLS manifest', async () => {
    const { client, server } = await connect()
    try {
      const { tools } = await client.listTools()
      expect(tools.map((t) => t.name)).toEqual(['normalize_address', 'search_addresses'])
      expect(tools[0]?.inputSchema.required).toContain('text')
    } finally {
      await client.close()
      await server.close()
    }
  })

  test('calls normalize_address over the transport', async () => {
    const { client, server } = await connect()
    try {
      const result = await client.callTool({
        name: 'normalize_address',
        arguments: { text: 'C/ Mayor 12 3ºB, Madrid' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(textOf(result)) as Record<string, unknown>
      expect(parsed.via_nombre).toBe('Mayor')
      expect(parsed.municipio_id).toBe('28079')
    } finally {
      await client.close()
      await server.close()
    }
  })

  test('returns an isError result for unknown tools', async () => {
    const { client, server } = await connect()
    try {
      const result = await client.callTool({ name: 'nope', arguments: {} })
      expect(result.isError).toBe(true)
      expect(textOf(result)).toContain('Unknown tool')
    } finally {
      await client.close()
      await server.close()
    }
  })
})
