/**
 * Typesense bulk-import CLI.
 *
 * Usage:
 *   pnpm typesense:import --snapshot packages/data/snapshots/callejero_2026-01_28.jsonl.gz [--drop] [--collection callejero_es] [--batch-size 1000]
 *
 * `import` is run via `tsx` (see packages/typesense/package.json), so it reads
 * ES modules straight from `src/`. It depends on `@spain-address/core`'s
 * `createTypesenseClient` — run `pnpm build` first so the core dist is fresh.
 *
 * Reads newline-delimited JSON (optional `.gz`) and streams it into Typesense
 * via `PUT /collections/:name/documents/import` in batches.
 */

import { createReadStream } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTypesenseClient } from '@spain-address/core'
import type { AddressRecord } from '@spain-address/core'
import { callejeroEsSchema } from './schema.js'

/** Repository root, derived from this file so `--snapshot` works as a
 *  root-relative path regardless of the caller's working directory. */
const WORKSPACE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const DEFAULT_BATCH = 1000

interface CliOptions {
  snapshot: string
  collection: string
  drop: boolean
  batchSize: number
  action: 'create' | 'upsert' | 'update'
  host: string
  port: number
  protocol: 'http' | 'https'
  apiKey: string
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    snapshot: '',
    collection: callejeroEsSchema.name,
    drop: false,
    batchSize: DEFAULT_BATCH,
    action: 'upsert',
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
      case '--action':
        opts.action = (next as CliOptions['action']) ?? opts.action
        i++
        break
      case '--drop':
        opts.drop = true
        break
      case '--':
        // pnpm/node argv separator — ignore.
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
      default:
        break
    }
  }
  return opts
}

// Port/flag parsing is handled inline in parseArgs via Number(...).

function buildQueryDocument(record: Record<string, unknown>): Record<string, unknown> {
  // Typesense geopoint field format is "lat,lon".
  const lat = record.lat
  const lon = record.lon
  const doc: Record<string, unknown> = { ...record }
  if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
    doc.location = `${lat},${lon}`
  }
  return doc
}

async function run(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))

  if (!opts.snapshot) {
    console.error('Missing required --snapshot <path>')
    process.exit(1)
  }
  // Allow root-relative paths (e.g. packages/data/snapshots/...) from any cwd.
  if (!isAbsolute(opts.snapshot)) {
    opts.snapshot = join(WORKSPACE_ROOT, opts.snapshot)
  }

  console.log(`Snapshot: ${opts.snapshot}`)
  console.log(`Collection: ${opts.collection}`)

  const client = createTypesenseClient({
    config: { host: opts.host, port: opts.port, protocol: opts.protocol, apiKey: opts.apiKey },
  })

  // Step 1: ensure the server is reachable.
  const ok = await client.health()
  if (!ok) {
    console.error('Typesense server is not healthy. Is it running on the configured host/port?')
    process.exit(1)
  }
  console.log('✓ Typesense server is healthy')

  // Step 2: optionally drop an existing collection.
  if (opts.drop && (await client.collectionExists(opts.collection))) {
    console.log(`Dropping existing collection ${opts.collection}...`)
    await client.dropCollection(opts.collection)
    console.log('✓ Dropped')
  }

  // Step 3: create the collection (ignore 409 "already exists" unless --drop).
  try {
    await client.createCollection({ ...callejeroEsSchema, name: opts.collection })
    console.log(`✓ Created collection ${opts.collection}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('409')) {
      console.error(`Failed to create collection: ${msg}`)
      process.exit(1)
    }
    console.log(`Collection ${opts.collection} already exists; appending/upserting documents.`)
  }

  // Step 4: stream the snapshot as NDJSON and bulk-import in batches.
  const input = createReadStream(opts.snapshot)
  const stream = opts.snapshot.endsWith('.gz') ? input.pipe(createGunzip()) : input

  let fileRecords = 0
  let indexed = 0
  let failed = 0
  let buffer: string[] = []

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return
    const ndjson = buffer.join('\n') + '\n'
    const res = await client.importDocuments(opts.collection, ndjson, {
      batchSize: opts.batchSize,
      action: opts.action,
    })
    indexed += res.success
    failed += res.failed
    buffer = []
  }

  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let record: unknown
    try {
      record = JSON.parse(trimmed) as AddressRecord
    } catch {
      failed++
      continue
    }
    fileRecords++
    buffer.push(JSON.stringify(buildQueryDocument(record as Record<string, unknown>)))
    if (buffer.length >= opts.batchSize) {
      await flush()
    }
  }
  await flush()

  console.log('\n=== Import complete ===')
  console.log(`  Records read:    ${fileRecords.toLocaleString()}`)
  console.log(`  Indexed:         ${indexed.toLocaleString()}`)
  console.log(`  Failed:          ${failed.toLocaleString()}`)
  if (failed > 0) {
    process.exitCode = 1
  }
}

void run()
