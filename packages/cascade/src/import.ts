/** Import the cascade model into the `cascade_es` Typesense collection over HTTP.

Usage:
  pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz [--drop] [--batch-size 500] [--host 127.0.0.1] [--port 8108] …

Design notes:
- Reuses the schema + collection name from `schema.ts`.
- Provincia / municipio / CP docs are derived from the SAME snapshot the street
  index uses (`generator.ts`), so cascade data never drifts from `callejero_es`.
- `--drop` drops the collection first; re-creating is idempotent (409 ignored).
- `cmum` (municipio ordinal) is intentionally dropped — the cascade lookups key
  off `id`/`cpro`/`municipios`, and `cmum` isn't a stored field.
- A doc's Typesense `id` is the code itself ("01", "28079", "28001"), so
  re-runs are idempotent upserts even without `--drop`.

Env defaults (same conventions as `@spain-address/core`):
  TYPESENSE_HOST / TYPESENSE_PORT / TYPESENSE_PROTOCOL / TYPESENSE_API_KEY
*/

import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createTypesenseClient } from '@spain-address/core'
import { cascadeSchema, CASCADE_COLLECTION } from './schema.js'
import {
  buildProvinciaDocs,
  buildMunicipioDocsFromSnapshot,
  buildCPDocsFromSnapshot,
} from './generator.js'
import type { CPDoc, MunicipioDoc, ProvinciaDoc } from './types.js'

const WORKSPACE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

interface CliOptions {
  snapshot: string
  collection: string
  drop: boolean
  batchSize: number
  host: string
  port: number
  protocol: 'http' | 'https'
  apiKey: string
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    snapshot: '',
    collection: CASCADE_COLLECTION,
    drop: false,
    batchSize: 500,
    host: process.env.TYPESENSE_HOST ?? '127.0.0.1',
    port: Number(process.env.TYPESENSE_PORT ?? '8108'),
    protocol: (process.env.TYPESENSE_PROTOCOL ?? 'http') as 'http' | 'https',
    apiKey: process.env.TYPESENSE_API_KEY ?? 'xyz',
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case '--snapshot':
        opts.snapshot = next ?? ''
        i++
        break
      case '--collection':
        opts.collection = next ?? opts.collection
        i++
        break
      case '--batch-size':
        opts.batchSize = next ? Number(next) : opts.batchSize
        i++
        break
      case '--drop':
        opts.drop = true
        break
      case '--host':
        opts.host = next ?? opts.host
        i++
        break
      case '--port':
        opts.port = next ? Number(next) : opts.port
        i++
        break
      case '--protocol':
        opts.protocol = (next as CliOptions['protocol']) ?? opts.protocol
        i++
        break
      case '--api-key':
        opts.apiKey = next ?? opts.apiKey
        i++
        break
      case '--':
        break
      default:
        break
    }
  }
  if (!opts.snapshot) throw new Error('--snapshot is required (.jsonl or .jsonl.gz)')
  return opts
}

/** Project a generator doc onto the `cascade_es` schema.
 * - `id` (Typesense reserved) = `type:code` so CP and municipio codes that share
 *   digits never collide on upsert.
 * - `code` = the bare INE/postal code, what the API returns to clients.
 * `cmum` is intentionally dropped — not a stored field (keyed by `id`/`cpro`). */
function cascadeDocument(doc: ProvinciaDoc | MunicipioDoc | CPDoc): Record<string, unknown> {
  const code = String(doc.id)
  const out: Record<string, unknown> = { id: `${doc.type}:${code}`, type: doc.type, code }
  switch (doc.type) {
    case 'provincia':
      out.name = doc.name
      out.ccaa_id = doc.ccaa_id
      out.ccaa_name = doc.ccaa_name
      break
    case 'municipio':
      out.cpro = doc.cpro
      out.name = doc.name
      out.ccaa_id = doc.ccaa_id
      out.ccaa_name = doc.ccaa_name
      break
    case 'cp':
      out.municipios = doc.municipios
      break
  }
  return out
}

function resolveSnapshotPath(snapshot: string): string {
  return isAbsolute(snapshot) ? snapshot : join(WORKSPACE_ROOT, snapshot)
}

async function run(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  const snapshot = resolveSnapshotPath(opts.snapshot)

  const client = createTypesenseClient({
    config: { host: opts.host, port: opts.port, protocol: opts.protocol, apiKey: opts.apiKey },
  })
  const ok = await client.health()
  if (!ok) {
    console.error('Typesense server is not healthy. Is it running on the configured host/port?')
    process.exit(1)
  }
  console.log('✓ Typesense server is healthy')

  if (opts.drop && (await client.collectionExists(opts.collection))) {
    console.log(`Dropping existing collection ${opts.collection}...`)
    await client.dropCollection(opts.collection)
    console.log('✓ Dropped')
  }

  try {
    await client.createCollection({ ...cascadeSchema, name: opts.collection })
    console.log(`✓ Created collection ${opts.collection}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('409')) {
      console.error(`Failed to create collection: ${msg}`)
      process.exit(1)
    }
    console.log(`Collection ${opts.collection} already exists; upserting documents.`)
  }

  console.log(`Building generator input from ${snapshot}…`)
  // Provincias are static (52); municipios/CPs derive from the snapshot stream.
  const provincias = buildProvinciaDocs()
  const [municipios, cps] = await Promise.all([
    buildMunicipioDocsFromSnapshot(snapshot),
    buildCPDocsFromSnapshot(snapshot),
  ])
  const input: Array<ProvinciaDoc | MunicipioDoc | CPDoc> = [...provincias, ...municipios, ...cps]
  console.log(`Derived: ${provincias.length} provincias | ${municipios.length} municipios | ${cps.length} CPs`)

  let indexed = 0
  let buffer: string[] = []
  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return
    const ndjson = buffer.join('\n') + '\n'
    const res = await client.importDocuments(opts.collection, ndjson, {
      batchSize: opts.batchSize,
      action: 'upsert',
    })
    indexed += res.success
    if (res.failed > 0) console.warn(`  ! ${res.failed} documents failed in a batch`)
    buffer = []
  }

  for (const doc of input) {
    buffer.push(JSON.stringify(cascadeDocument(doc)))
    if (buffer.length >= opts.batchSize) await flush()
  }
  await flush()

  console.log('\n=== Import complete ===')
  console.log(`  Records read:    ${input.length.toLocaleString()}`)
  console.log(`  Indexed:         ${indexed.toLocaleString()}`)
  if (indexed !== input.length) process.exitCode = 1
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
