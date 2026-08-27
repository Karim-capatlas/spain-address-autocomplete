/** Import `GeneratorInput` into the `cascade_es` RediSearch index via ioredis/RESP.

Usage:
  pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz [--drop] [--batch-size 500] [--url <redis://…>]

Design notes:
- Writes hashes under the `cascade:` prefix with FLAT fields (not a single JSON blob)
  so the server's FT.SEARCH RETURN path reads individual fields without JSON parsing.
- CP docs store `municipios` as a single comma-separated TAG value in the hash;
  RediSearch splits multi-value TAG fields on commas, matching `@municipios:{28079}`
  query syntax.
- Hash keys follow `schema.ts` conventions: `cascade:p:28`, `cascade:m:28079`,
  `cascade:cp:28001` (so the key namespace is self-describing).
- Reuses the schema definition, index name, and FT.CREATE args from `schema.ts`.
*/
import fs from 'node:fs'
import type { Redis } from 'ioredis'

import type { GeneratorInput, ProvinciaDoc, MunicipioDoc, CPDoc } from './types.js'
import {
  CASCADE_INDEX,
  CASCADE_PREFIX,
  provinciaKey,
  municipioKey,
  cpKey,
} from './schema.js'
import { buildProvinciaDocs, buildMunicipioDocsFromSnapshot, buildCPDocsFromSnapshot } from './generator.js'

/** Render the FT.CREATE SCHEMA argument vector (prefix + schema fields).
 * The caller prepends `FT.CREATE <index>` via `redis.call('FT.CREATE', index, ...)`. */
export function createFtCreateArgs(): string[] {
  return [
    'ON', 'HASH', 'PREFIX', '1', CASCADE_PREFIX,
    'SCHEMA',
    'id', 'TAG',
    'type', 'TAG',
    'name', 'TEXT',
    'cpro', 'TAG',
    'ccaa_id', 'TAG',
    'municipios', 'TAG',
  ]
}

export function provinciaHashFields(doc: ProvinciaDoc): string[] {
  return [
    'id', doc.id,
    'type', 'provincia',
    'name', doc.name,
    'cpro', doc.id,
    'ccaa_id', doc.ccaa_id,
    'ccaa_name', doc.ccaa_name,
  ]
}

export function municipioHashFields(doc: MunicipioDoc): string[] {
  return [
    'id', doc.id,
    'type', 'municipio',
    'name', doc.name,
    'cpro', doc.cpro,
    'ccaa_id', doc.ccaa_id,
    'ccaa_name', doc.ccaa_name,
  ]
}

export function cpHashFields(doc: CPDoc): string[] {
  return [
    'id', doc.id,
    'type', 'cp',
    'municipios', doc.municipios.join(','),
  ]
}

/**
 * Pipelined import of the full `cascade_es` index. Creates the index first
 * (idempotent — if it already exists the CREATE returns an error which we
 * log and skip), then pipelines HSETs in batches.
 *
 * Returns counts of docs read / indexed / failed.
 */
export async function runImport(
  redis: Redis,
  input: GeneratorInput,
  options: {
    drop?: boolean
    batchSize?: number
    log?: (msg: string) => void
  } = {},
): Promise<{ read: number; indexed: number; failed: number }> {
  const { drop, batchSize = 500, log = console.log } = options
  const index = CASCADE_INDEX

  if (drop) {
    log(`Dropping index ${index}…`)
    try {
      await redis.call('FT.DROPINDEX', index, 'DD')
    } catch (err) {
      // Index may not exist yet — that's fine.
      log(`  (drop skipped: ${String(err)})`)
    }
    log(`✓ Dropped index ${index}`)
  }

  log('Creating index…')
  try {
    const reply = await redis.call('FT.CREATE', index, ...createFtCreateArgs())
    log(`✓ Created index ${index} (${String(reply)})`)
  } catch (err) {
    // Index already exists — expected on re-runs without --drop.
    log(`• Index ${index} already exists (${String(err)})`)
  }

  const batch: Array<[string, ...string[]]> = []
  let indexed = 0
  let failed = 0

  async function flush(): Promise<void> {
    if (batch.length === 0) return
    const pipeline = redis.pipeline()
    for (const [key, ...fields] of batch) {
      pipeline.hset(key, ...fields)
    }
    const results = await pipeline.exec()
    if (results) {
      for (const result of results) {
        if (result[0]) {
          failed++
        } else {
          indexed++
        }
      }
    }
    batch.length = 0
  }

  // Provincias first (small, 52).
  let read = 0
  for (const doc of input.provincias) {
    batch.push([provinciaKey(doc.id), ...provinciaHashFields(doc)])
    read++
    if (batch.length >= batchSize) await flush()
  }
  await flush()
  log(`✓ Provincias imported: ${input.provincias.length}`)

  // Municipios.
  for (const doc of input.municipios) {
    batch.push([municipioKey(doc.id), ...municipioHashFields(doc)])
    read++
    if (batch.length >= batchSize) await flush()
  }
  await flush()
  log(`✓ Municipios imported: ${input.municipios.length}`)

  // CPs.
  for (const doc of input.cps) {
    batch.push([cpKey(doc.id), ...cpHashFields(doc)])
    read++
    if (batch.length >= batchSize) await flush()
  }
  await flush()
  log(`✓ CPs imported: ${input.cps.length}`)

  return { read, indexed, failed }
}

// ---- CLI ------------------------------------------------------------------

interface CliFlags {
  snapshot: string
  drop?: boolean
  batchSize: number
  url?: string
}

function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = { snapshot: '', batchSize: 500 }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--snapshot':
        flags.snapshot = argv[++i] ?? ''
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
      default:
        throw new Error(`Unknown flag: ${arg}`)
    }
  }
  if (!flags.snapshot) throw new Error('--snapshot is required (.jsonl or .jsonl.gz)')
  if (!fs.existsSync(flags.snapshot)) throw new Error(`Snapshot not found: ${flags.snapshot}`)
  return flags
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2))
  const log = (msg: string) => console.log(msg)

  log(`Building generator input from ${flags.snapshot}…`)
  const [provincias, municipios, cps] = await Promise.all([
    Promise.resolve(buildProvinciaDocs()),
    buildMunicipioDocsFromSnapshot(flags.snapshot),
    buildCPDocsFromSnapshot(flags.snapshot),
  ])

  log(`Derived: ${provincias.length} provincias | ${municipios.length} municipios | ${cps.length} CPs`)

  const Redis = (await import('ioredis')).default
  const redis = flags.url ? new Redis(flags.url) : new Redis()
  await redis.ping()
  log(`✓ Connected to Redis at ${flags.url ?? 'default'}`)

  const result = await runImport(redis, { provincias, municipios, cps }, {
    drop: flags.drop,
    batchSize: flags.batchSize,
    log,
  })
  log(`✓ Import complete: read=${result.read}, indexed=${result.indexed}, failed=${result.failed}`)
  await redis.quit()
  process.exit(0)
}

// Only run CLI if invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
