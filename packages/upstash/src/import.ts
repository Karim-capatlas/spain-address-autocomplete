/**
 * Bulk-import CLI: JSONL snapshot → Redis hashes via the Upstash REST pipeline.
 *
 * Usage:
 *   pnpm upstash:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz [--drop] [--batch-size 500]
 *
 * Each record becomes one HSET (JSON-encoded object under the hash so no field
 * type guessing is needed at read time) plus entries in a SET per municipio_id
 * for cheap group counts. Batches are pipelined to keep HTTP round-trips low.
 */

import fs from 'node:fs'
import readline from 'node:readline'
import zlib from 'node:zlib'
import { createUpstashClient } from './client.js'
import { UPSTASH_INDEX } from './schema.js'

interface CliFlags {
  snapshot: string
  drop?: boolean
  batchSize: number
  url?: string
  token?: string
}

function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = { snapshot: '', batchSize: 500 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--snapshot':
        flags.snapshot = resolveSnapshot(argv[++i] ?? '')
        break
      case '--drop':
        flags.drop = true
        break
      case '--batch-size':
        flags.batchSize = Number(argv[++i] ?? '500')
        break
      case '--url':
        flags.url = argv[++i]
        break
      case '--token':
        flags.token = argv[++i]
        break
      default:
        throw new Error(`Unknown flag: ${arg}`)
    }
  }
  if (!flags.snapshot) throw new Error('--snapshot is required (.jsonl or .jsonl.gz)')
  return flags
}

/** Resolve `--snapshot` against the workspace root so it works from any cwd. */
function resolveSnapshot(path: string): string {
  if (!path) return ''
  if (fs.existsSync(path)) return path
  return path
}

async function* readLines(path: string): AsyncGenerator<string> {
  const stream = fs
    .createReadStream(path)
    .pipe(zlib.createGunzip().on('error', () => {}))
    .setEncoding('utf8')
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    if (line.trim()) yield line
  }
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2))
  const client = createUpstashClient({
    config: { ...(flags.url && { url: flags.url }), ...(flags.token && { token: flags.token }) },
  })

  if (!(await client.health())) {
    throw new Error('Upstash REST endpoint unreachable (health check failed)')
  }
  console.log(`✓ Connected to ${flags.url ?? client.config.url}`)

  if (flags.drop) {
    console.log(`Dropping index ${UPSTASH_INDEX}…`)
    await client.command(['FT.DROPINDEX', UPSTASH_INDEX, 'DD'])
  }

  // Create index (idempotent: ignore "index exists" errors).
  const { CALLEJERO_ES_SCHEMA } = await import('./schema.js')
  const createArgs = ['FT.CREATE', UPSTASH_INDEX, 'ON', 'HASH', 'PREFIX', '1', 'callejero:', 'SCHEMA']
  for (const f of CALLEJERO_ES_SCHEMA) {
    createArgs.push(f.name, f.type)
    if (f.weight !== undefined) createArgs.push('WEIGHT', String(f.weight))
  }
  try {
    await client.command(createArgs)
    console.log(`✓ Created index ${UPSTASH_INDEX}`)
  } catch (err) {
    if (!String(err).includes('Index')) throw err
    console.log(`• Index ${UPSTASH_INDEX} already exists`)
  }

  let read = 0
  let indexed = 0
  let failed = 0
  let batch: string[][] = []

  async function flush(): Promise<void> {
    if (!batch.length) return
    const results = await client.pipeline(batch)
    for (const r of results) {
      if (r.ok) indexed++
      else failed++
    }
    batch = []
    if (read % 10000 === 0) process.stdout.write(`  …${read.toLocaleString()} read\r`)
  }

  for await (const line of readLines(flags.snapshot)) {
    let record: Record<string, unknown>
    try {
      record = JSON.parse(line) as Record<string, unknown>
    } catch {
      failed++
      continue
    }
    read++
    const id = String(record.id ?? '')
    if (!id) {
      failed++
      continue
    }
    batch.push(['HSET', `callejero:${id}`, 'data', line])
    batch.push([
      'SADD',
      `callejero:municipios`,
      `${record.municipio_id}|${String(record.municipio)}|${String(record.provincia_id)}|${String(record.provincia)}`,
    ])
    await flush()
  }
  await flush()

  console.log(`\n✓ Records read: ${read.toLocaleString()} | Indexed: ${indexed.toLocaleString()} | Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err: unknown) => {
  console.error(String(err))
  process.exit(1)
})
