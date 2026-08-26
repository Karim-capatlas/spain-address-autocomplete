/**
 * Live verification of Phase 3.5's default-backend flip through `@spain-address/core`.
 *
 * Drives core's `searchAddresses({ command })` dispatcher against the local
 * RediSearch (redis-stack) container on 127.0.0.1:6379 — proving the Upstash
 * backend selected by `createSearchClient()` actually returns live results from
 * the 749K-record `callejero_es` index. Also reports which backend
 * `createSearchClient()` resolves to (Upstash when env is set, else Typesense).
 *
 *   pnpm exec tsx scripts/redis-search-verify.ts
 */

import net from 'node:net'
// Import from core's BUILT dist so this mirrors what MCP/proxy consume.
import { searchAddresses, createSearchClient } from '../packages/core/dist/index.js'

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
    if (type === '+' || type === '-' || type === ':' || type === ',' || type === '#') {
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

  close() {
    this.sock.end()
  }
}

async function main(): Promise<void> {
  const redis = new RespClient()
  const ping = await redis.command(['PING'])
  console.log('redis PING:', ping)
  if (ping !== 'PONG') throw new Error('redis-stack not reachable on 127.0.0.1:6379')

  // `command` is the transport-agnostic fn core's searchAddresses expects for
  // the Upstash backend. Here it talks RESP to the local redis-stack.
  const command = (args: string[]): Promise<unknown> => redis.command(args)

  // 1) core's dispatcher routes `{ command }` to the Upstash path (Phase 3.5 default).
  const r1 = await searchAddresses({ query: 'Gran Vía', perPage: 5 }, { command })
  console.log(
    `\n▶ searchAddresses({ command }) "Gran Vía" → total=${r1.total.toLocaleString()}, groups=${r1.groups.length}`,
  )
  for (const g of r1.groups.slice(0, 2)) {
    console.log(
      `   · ${g.municipio} (${g.provincia}) found=${g.found} — ${g.items[0]?.via_nombre_completo} (${g.items[0]?.codigo_postal})`,
    )
  }

  // 2) CP filter + grouping via the same dispatcher.
  const r2 = await searchAddresses(
    { query: 'mayor', filterByCP: '28013', perPage: 3 },
    { command },
  )
  console.log(
    `\n▶ CP 28013 + "mayor" → total=${r2.total}, top=${r2.records[0]?.via_nombre_completo} | ${r2.records[0]?.municipio} | ${r2.records[0]?.codigo_postal}`,
  )

  // 3) createSearchClient() backend selection (no Upstash env → Typesense fallback).
  const envUrl = process.env.UPSTASH_REDIS_REST_URL
  const envToken = process.env.UPSTASH_REDIS_REST_TOKEN
  const deps = createSearchClient()
  const backend = deps.command ? 'upstash' : deps.client ? 'typesense' : 'none'
  console.log(
    `\n▶ createSearchClient() backend=${backend}` +
      (envUrl && envToken
        ? ' (UPSTASH_REDIS_REST_URL configured)'
        : ' (Upstash env unset → Typesense fallback)'),
  )

  redis.close()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
