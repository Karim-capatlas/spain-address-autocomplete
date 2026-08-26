/**
 * Live import + verification against a local RediSearch (redis-stack) container
 * on 127.0.0.1:6379. Uses the same schema/query builders as packages/upstash.
 *
 *   pnpm exec tsx scripts/redis-import-verify.ts [--snapshot <path>] [--limit N]
 */

import fs from 'node:fs'
import readline from 'node:readline'
import net from 'node:net'
import { createGunzip } from 'node:zlib'
import { CALLEJERO_ES_SCHEMA, UPSTASH_INDEX } from '../packages/upstash/src/schema.js'
import { buildSearchArgs, parseSearchReply } from '../packages/upstash/src/search.js'

// ---- minimal RESP client (no deps) -----------------------------------------
class RespClient {
  private sock = net.createConnection({ host: '127.0.0.1', port: 6379 })
  private queue: Array<(v: unknown) => void> = []
  private buf: Buffer = Buffer.alloc(0)

  constructor() {
    this.sock.on('data', (d) => {
      this.buf = Buffer.concat([this.buf, d])
      while (true) {
        const before = this.buf.length
        const [value, rest] = RespClient.parse(this.buf)
        if (value === undefined && rest === this.buf) break
        this.buf = rest
        const resolve = this.queue.shift()
        if (resolve) resolve(value)
        if (this.buf.length === before && this.queue.length === 0) break
      }
    })
    this.sock.on('error', (e) => {
      for (const r of this.queue.splice(0)) r(new Error(String(e)))
    })
  }

  static parse(buf: Buffer): [unknown, Buffer] {
    if (!buf.length) return [undefined, buf]
    const type = String.fromCharCode(buf[0])
    const nl = buf.indexOf('\r\n')
    if (nl === -1) return [undefined, buf]
    if (type === '+' || type === '-' || type === ':' || (type === ',' || type === '#')) {
      const line = buf.subarray(1, nl).toString()
      const v = type === ':' ? Number(line) : type === '-' ? new Error(line) : line
      return [v, buf.subarray(nl + 2)]
    }
    if (type === '$' || type === '*') {
      const n = Number(buf.subarray(1, nl).toString())
      let rest = buf.subarray(nl + 2)
      if (n === -1) return [null, rest]
      if (type === '$') {
        if (rest.length < n + 2) return [undefined, buf]
        return [rest.subarray(0, n).toString(), rest.subarray(n + 2)]
      }
      const arr: unknown[] = []
      for (let i = 0; i < n; i++) {
        const [v, r] = RespClient.parse(rest)
        if (v === undefined && r === rest) return [undefined, buf]
        arr.push(v)
        rest = r
      }
      return [arr, rest]
    }
    throw new Error(`Unsupported RESP type: ${type}`)
  }

  command(args: string[]): Promise<unknown> {
    const parts: string[] = [`*${args.length}\r\n`]
    for (const a of args) parts.push(`$${Buffer.byteLength(a)}\r\n${a}\r\n`)
    return new Promise((resolve, reject) => {
      this.queue.push((v) => (v instanceof Error ? reject(v) : resolve(v)))
      this.sock.write(parts.join(''))
    })
  }
}

// ---- helpers ---------------------------------------------------------------
function flattenDoc(obj: Record<string, string>): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) out.push(k, v)
  return out
}

async function* readJsonl(path: string): AsyncGenerator<string> {
  const stream = path.endsWith('.gz')
    ? fs.createReadStream(path).pipe(createGunzip())
    : fs.createReadStream(path)
  stream.setEncoding('utf8')
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) if (line.trim()) yield line
}

// ---- main ------------------------------------------------------------------
async function main(): Promise<void> {
  const argSnapshotIdx = process.argv.indexOf('--snapshot')
  const snapshot =
    argSnapshotIdx > -1
      ? process.argv[argSnapshotIdx + 1]
      : 'packages/data/snapshots/callejero_2026-01.jsonl.gz'
  const limitIdx = process.argv.indexOf('--limit')

  const redis = new RespClient()
  console.log('PING:', await redis.command(['PING']))

  // Create index with the shared schema
  const createArgs: string[] = [
    'FT.CREATE', UPSTASH_INDEX, 'ON', 'HASH', 'PREFIX', '1', 'callejero:', 'SCHEMA',
  ]
  for (const f of CALLEJERO_ES_SCHEMA) {
    createArgs.push(f.name, f.type)
    if (f.weight !== undefined) createArgs.push('WEIGHT', String(f.weight))
  }
  try {
    console.log('FT.CREATE:', await redis.command(createArgs))
  } catch (e) {
    console.log('index exists?', String(e).slice(0, 80))
    await redis.command(['FT.DROPINDEX', UPSTASH_INDEX, 'DD'])
    console.log('re-created:', await redis.command(createArgs))
  }

  // Import (pipeline batches of 200)
  let read = 0
  const t0 = Date.now()
  let batch: string[][] = []
  async function flush(): Promise<void> {
    if (!batch.length) return
    for (const cmd of batch) await redis.command(cmd)
    batch = []
  }
  for await (const line of readJsonl(snapshot)) {
    if (limitIdx > -1 && read >= Number(process.argv[limitIdx + 1])) break
    const rec = JSON.parse(line) as Record<string, unknown>
    const doc: Record<string, string> = {}
    for (const [k, v] of Object.entries(rec)) doc[k] = v == null ? '' : String(v)
    batch.push(['HSET', `callejero:${String(rec.id)}`, ...flattenDoc(doc)])
    await flush()
    read++
    if (read % 50000 === 0) console.log(`  …${read.toLocaleString()} (${Math.round((Date.now()-t0)/1000)}s)`)
  }
  await flush()
  console.log(`Indexed ${read.toLocaleString()} docs in ${((Date.now()-t0)/1000).toFixed(1)}s`)

  // Verify searches — same queries as the Typesense baseline in AGENTS.md
  const queries: Array<{ label: string; args: string[] }> = [
    { label: '"Gran Vía" (national)', args: buildSearchArgs({ query: 'Gran Vía', perPage: 5 }) },
    { label: '"Gran Via" typo-free variant', args: buildSearchArgs({ query: 'Gran Via', perPage: 3 }) },
    { label: '"gr via" fuzzy/prefix', args: buildSearchArgs({ query: 'gr vía', perPage: 3 }) },
    { label: 'Madrid CP filter 28013', args: buildSearchArgs({ query: 'mayor', filterByCP: '28013', perPage: 3 }) },
    { label: 'normalize-style query "Calle Mayor 12 Madrid"', args: buildSearchArgs({ query: 'Calle Mayor Madrid', perPage: 3 }) },
  ]
  for (const q of queries) {
    const reply = await redis.command(q.args)
    const { total, records } = parseSearchReply(reply)
    console.log(`\n▶ ${q.label} → total=${total.toLocaleString()}`)
    for (const r of records.slice(0, 3)) {
      console.log(`   ${r.via_nombre_completo} | ${r.municipio} | ${r.codigo_postal} | ${r.provincia}`)
    }
  }
  redis['sock' as keyof RespClient] // keep TS quiet about unused private
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
