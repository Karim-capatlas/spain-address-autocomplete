# `@spain-address/mcp`

**Spanish address normalization — as an MCP server.**

A fast, privacy-first MCP (Model Context Protocol) server that turns noisy
address text — e.g. extracted from OCR'd DNI/TIE identity cards — into
structured fields: **via type, street name, provincia (+ code), municipio
(+ code), and código postal**.

Backed by a **749,261-record** index of the Spanish street map
(**INE Callejero**, 52 provinces), served by default over **Typesense** HTTP/REST
(local Docker, `127.0.0.1:8108`) — with **Upstash Redis Search** available as an
opt-in (`USE_UPSTASH=1` + `UPSTASH_REDIS_REST_URL`/`TOKEN`) — and spoken to via
the **stdio JSON-RPC** transport.

```
[Claude Desktop / Cursor / parent pipeline]
               │  JSON-RPC over stdio
               ▼
        @spain-address/mcp  ──►  searchAddresses()
                                   │  Typesense (default) / Upstash (opt-in)
                                   ▼
                            749,261 INE streets
```

---

## <img src="https://img.shields.io/badge/status-live%20verified-16a34a?style=for-the-badge&labelColor=0f172a&logoColor=white" alt="Status: live verified" /> <img src="https://img.shields.io/badge/v0.1.0-0ea5e9?style=for-the-badge&labelColor=0f172a&logoColor=white" alt="Version" /> <img src="https://img.shields.io/badge/TypeScript-3178c6?style=for-the-badge&labelColor=0f172a&logoColor=white&logo=typescript" alt="TypeScript" /> <img src="https://img.shields.io/badge/MCP-0ea5e9?style=for-the-badge&labelColor=0f172a&logoColor=white" alt="MCP" /> <img src="https://img.shields.io/badge/Node-22-878e36?style=for-the-badge&labelColor=0f172a&logoColor=white&logo=node.js" alt="Node 22" /> <img src="https://img.shields.io/badge/license-MIT-0ea5e9?style=for-the-badge&labelColor=0f172a&logoColor=white" alt="License: MIT" />

<img src="https://img.shields.io/badge/Phase_3.5-16a34a?style=flat-square&labelColor=0f172a&logoColor=white" alt="Phase 3.5" /> <img src="https://img.shields.io/badge/Privacy%20first-zero%20data%20retention-16a34a?style=flat-square&labelColor=0f172a&logoColor=white" alt="Zero data retention" /> <img src="https://img.shields.io/badge/Open%20source-%23212121?style=flat-square&labelColor=0f172a&logoColor=white" alt="Open source" /> <img src="https://img.shields.io/badge/INE%20Callejero-749K%20records-f59e0b?style=flat-square&labelColor=0f172a&logoColor=white" alt="INE Callejero data" /> <img src="https://img.shields.io/badge/Transport-stdio%20JSON--RPC-0ea5e9?style=flat-square&labelColor=0f172a&logoColor=white" alt="stdio transport" />

---

## Why?

Spanish identity cards (DNI/TIE) carry a human-readable address line that OCR
engines mangle: missing accents, glued words, swapped type prefixes
(`CRA` → `Calle`, `Av` → `Avenida`), and postal codes fused into the street.
This server normalizes that mess into something an agent (or a form) can use,
**offline-capable** and **without trusting a third-party geocoder**.

It is the address-normalization component of a larger DNI/TIE OCR pipeline
(**PaddleV6 + WebGPU**, zero data retention, SES.HOSPEDAJES-compliant).

## Features

- **Two MCP tools** — `normalize_address` (best single match) and
  `search_addresses` (ranked, municipio-grouped results).
- **Fuzzy matching** — Levenshtein distance 1–2 on street / municipio / provincia
  for OCR-typo tolerance.
- **Municipio grouping** — results roll up by town/neighborhood with a
  result count per group.
- **5-digit postal-code auto-detection** — a numeric `28013` query routes to the
  CP filter; `normalize_address` strips house numbers (`C/ Mayor 12 3ºB` →
  `Calle Mayor`).
- **Backend-agnostic dispatch** — `createSearchClient()` defaults to a **Typesense**
  server (the HTTP/REST backend reachable by Workers/cloud) and only opts into
  **Upstash Redis Search** when `USE_UPSTASH=1` + `UPSTASH_REDIS_REST_URL` are set.
  No backend lock-in.
- **Dependency-light** — minimal stdio JSON-RPC handshake written by hand
  (the `@modelcontextprotocol/sdk` is a declared peer for future publishing).
- **Typed end-to-end** — strict TypeScript, `AddressRecord` flows from ETL →
  index → core → MCP → agent with one shape.

## Tools

| Tool | Description |
|---|---|
| `normalize_address` | Normalize a noisy address string → the single best structured match. |
| `search_addresses` | Search 749K INE streets → ranked, municipio-grouped matches. |

### `normalize_address`

```jsonc
// Request
{
  "name": "normalize_address",
  "arguments": {
    "text": "C/ Gran via 12, 28013 Madrid",   // ← noisy OCR text
    "provincia_id": "28"                     // ← optional 2-digit INE province code
  }
}

// Response (single best hit)
{
  "via_tipo": "Calle",
  "via_nombre": "Gran Vía",
  "via_nombre_completo": "Calle Gran Vía",
  "municipio": "Madrid",
  "municipio_id": "28079",
  "provincia": "Madrid",
  "provincia_id": "28",
  "comunidad_autonoma": "Comunidad de Madrid",
  "codigo_postal": "28013",
  "label": "Calle Gran Vía, Madrid (28013)",
  "confidence": "exact"
}
```

### `search_addresses`

```jsonc
// Request
{
  "name": "search_addresses",
  "arguments": {
    "query": "mayor",
    "per_page": 10,             // ← optional, default 10
    "provincia_id": "28",       // ← optional INE province filter
    "municipio_id": "28079",    // ← optional 5-digit INE municipality filter
    "codigo_postal": "28013"    // ← optional 5-digit postal-code filter
  }
}

// Response
{
  "total": 5,
  "groups": [
    {
      "municipio_id": "28079",
      "municipio": "Madrid",
      "provincia": "Madrid",
      "found": 5,
      "items": [
        {
          "via_tipo": "Calle",
          "via_nombre": "Mayor",
          "via_nombre_completo": "Calle Mayor",
          "codigo_postal": "28013",
          "label": "Calle Mayor, Madrid (28013)",
          "confidence": "exact"
          /* …provincia / comunidad_autonoma / IDs… */
        }
      ]
    }
  ]
}
```

## Install

The package is published as `@spain-address/mcp`. From the monorepo it is
consumed as `packages/mcp`; for a standalone install:

```bash
# Standalone (Node 22+)
npm i @spain-address/mcp     # or: pnpm add @spain-address/mcp

# From this monorepo
pnpm install
```

Build artifacts ship to `dist/` (ESM bundle + types) and expose a `bin`
entry `spain-address-mcp` → `./dist/cli.js`.

## Run

The server speaks **stdio JSON-RPC** — it reads newline-delimited requests on
`stdin` and writes newline-delimited responses on `stdout`. Spawn it from any
MCP host:

```bash
# Dev run (no build)
pnpm --filter @spain-address/mcp start

# Production binary
node ./packages/mcp/dist/cli.js
```

### Claude Desktop

Add a server entry to your Claude Desktop config:

```jsonc
// macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
// Linux: ~/.config/claude/claude_desktop_config.json
{
  "mcpServers": {
    "spain-address": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp/dist/cli.js"],
      "env": {
        "UPSTASH_REDIS_REST_URL": "https://<db>.upstash.io",
        "UPSTASH_REDIS_REST_TOKEN": "<token>",
        "MCP_LOG_LEVEL": "info"        // optional
      }
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "spain-address": {
      "command": "node",
      "args": ["packages/mcp/dist/cli.js"],
      "env": {
        "TYPESENSE_HOST": "127.0.0.1",
        "TYPESENSE_PORT": "8108",
        "TYPESENSE_API_KEY": "xyz"
      }
    }
  }
}
```

## Backend configuration

`createSearchClient()` (from `@spain-address/core`) selects a backend from the
environment at startup:

1. **Upstash Redis Search (preferred)** — set both:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
2. **Typesense (local fallback)** — defaults to the Homebrew server:
   - `TYPESENSE_HOST` (default `127.0.0.1` — IPv4, not `localhost`)
   - `TYPESENSE_PORT` (default `8108`)
   - `TYPESENSE_API_KEY` (default `xyz`)
   - `TYPESENSE_PROTOCOL` (default `http`)

> ⚠️ If neither set of variables is present, any tool call errors with
> `searchAddresses: no backend configured`. Seed your index first — see
> [`packages/upstash`](../upstash) (Upstash import CLI) and
> [`packages/typesense`](../typesense) (Typesense import CLI).

## Architecture

```
                     packages/mcp
┌─────────────────────────────────────────────┐
│  src/cli.ts        — stdio JSON-RPC loop    │
│     ├─ initialize / ping                     │
│     ├─ tools/list  → TOOLS manifest         │
│     └─ tools/call  → dispatchTool(name)     │
│                                               │
│  src/tools.ts      — tool implementations   │
│  src/index.ts      — public re-exports      │
└───────────────┬─────────────────────────────┘
                │  searchAddresses(options, deps)
                ▼
       @spain-address/core
┌─────────────────────────────────────────────┐
│  search.ts         — dispatches on deps.    │
│     deps.command → Upstash/Redis Search      │
│     deps.client   → Typesense (default)      │
│  search-client.ts  — createSearchClient()   │
│     defaults to Typesense (HTTP/REST),      │
│     opts into Upstash only when USE_UPSTASH=1│
│  record.ts         — shared AddressRecord   │
└───────────────┬─────────────────────────────┘
                │ indexed data
                ▼
        Typesense (default) / Upstash Redis
   749,261 street records from INE Callejero
   (52 provinces • derived from etl/packages/etl)
```

### How `normalize_address` works

1. **House-number strip** — a regex drops `/^\d+º?ª?\s*/`-style trailing tokens
   so `C/ Mayor 12 3ºB` matches `Calle Mayor`.
2. **Search** — queries `via_nombre, via_nombre_completo, municipio, provincia`
   (Upstash weights `5.0 / 3.0 / 1.0 / 1.0`) with `$fuzzy`/`$smart` term
   expansion for OCR typos; optionally narrowed by `provincia_id`.
3. **Project** — the top hit is shaped into the normalized `AddressRecord` subset
   the OCR pipeline consumes (`confidence: "exact"` is a placeholder for a future
   scoring layer).

> **Live verification (local RediSearch, all 749K docs):** query `"Gran Vía"` → 134
> hits; `codigo_postal 28013` + `"mayor"` → 1 hit (`Calle Mayor`).

## Output shape

```ts
// address-search-es  ← shared by core, MCP, proxy, widget
{
  id: string            // stable sha1-derived document id
  via_tipo: string      // "Calle", "Avenida", "Paseo", …
  via_nombre: string    // "Mayor"
  via_nombre_completo: string // "Calle Mayor"
  municipio: string     // "Madrid"
  municipio_id: string  // INE code, e.g. "28079" = CPRO(28)+CMUN(079)
  provincia: string     // "Madrid"
  provincia_id: string  // 2-digit CPRO, e.g. "28"
  comunidad_autonoma: string   // "Comunidad de Madrid"
  comunidad_autonoma_id: string
  codigo_postal: string // 5-digit CP, e.g. "28013"
  label: string         // "Calle Mayor, Madrid (28013)"
  lat?: number
  lon?: number
}
```

See [`packages/core/src/types.ts`](../core/src/types.ts) for the canonical
definition.

## Development

```bash
# Build
pnpm --filter @spain-address/mcp build        # tsup → dist/

# Type-check + lint + test
pnpm --filter @spain-address/mcp typecheck    # tsc --noEmit
pnpm --filter @spain-address/mcp lint         # eslint src/
pnpm --filter @spain-address/mcp test         # vitest run (6 tests)
```

The CI gate for this package is green: typecheck, lint, and tests pass in the
monorepo (`pnpm typecheck`, `pnpm lint`, `pnpm test`).

### Local end-to-end

```bash
# 1. Start a local RediSearch (same engine Upstash runs)
docker-compose up -d redisearch

# 2. Index 749,261 streets from an ETL snapshot
pnpm upstash:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop

# 3. Start the MCP server (it auto-picks Upstash from env)
UPSTASH_REDIS_REST_URL=http://localhost:6379 \
node packages/mcp/dist/cli.js
```

## Project context

`@spain-address/mcp` is part of the
[`spain-address-autocomplete`](https://github.com/Karim-capatlas/spain-address-autocomplete)
monorepo — the address-normalization layer of an open-source DNI/TIE OCR pipeline.
Read [`AGENTS.md`](../../AGENTS.md) for the full phase history and design notes.

## Attribution

- **Instituto Nacional de Estadística (INE)** — Callejero + Municipios data,
  © INE. Source: https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390. Credit
  "© Instituto Nacional de Estadística (INE)" in any derived UI/docs.
- **Instituto Geográfico Nacional de España (IGN)** — CartoCiudad coordinate
  enrichment (CC BY 4.0). Credit "© Instituto Geográfico Nacional de España"
  where coordinates are surfaced.

## License

MIT (declared in `package.json`) — see
<https://github.com/Karim-capatlas/spain-address-autocomplete/blob/main/LICENSE>.
Data licensing is governed by the upstream INE/IGN attributions above.
