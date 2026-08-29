# spain-address-autocomplete

**Open-source MCP server for Spanish address normalization.** Give it noisy address text — e.g. OCR output from a Spanish DNI/TIE identity card — and get back structured fields: via type, street name, provincia (name + code), municipio (name + code), and código postal.

Powered by a **749,261-record** index of the Spanish street map ([INE Callejero](https://www.ine.es/prodyser/callejero/), open government data, snapshot 2026-01) served over **Upstash Redis Search** — self-hostable, offline-capable, zero data retention.

![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Node 22](https://img.shields.io/badge/Node-22-339933)
![MCP](https://img.shields.io/badge/protocol-MCP%20stdio-blueviolet)
![Tests](https://img.shields.io/badge/tests-132%20passing-brightgreen)

<!-- TODO: add a ~20s terminal GIF here: normalize_address("C/ Gran via 12, 28013 Madrid") → structured JSON. Nothing sells this repo faster. -->

## What it does

```jsonc
// MCP tool call
{ "name": "normalize_address",
  "arguments": { "text": "C/ Gran via 12, 28013 Madrid" } }   // ← noisy OCR text

// Response
{
  "via_tipo": "Calle",
  "via_nombre": "Gran Vía",
  "via_nombre_completo": "Calle Gran Vía",
  "municipio": "Madrid",        "municipio_id": "28079",
  "provincia": "Madrid",        "provincia_id": "28",
  "comunidad_autonoma": "Comunidad de Madrid",
  "codigo_postal": "28013",
  "label": "Calle Gran Vía, Madrid (28013)"
}
```

House numbers are stripped (`C/ Mayor 12 3ºB` → `Calle Mayor`), a 5-digit input is auto-detected as a postal code, and fuzzy matching (Levenshtein 1–2) tolerates OCR typos.

## Why it exists

- **Existing services fail on OCR text.** `geoapi.es` false-matches noisy input, rate-limits (1 req/s in sandbox), needs an API key, and ships data from `2024.01` — this repo's snapshot is `2026-01`.
- **Paid geocoding is expensive.** Google Places costs ~€17 per 1,000 requests for something Spain's open data already covers.
- **Privacy is the requirement.** DNI/TIE cards are PII. This runs against a local Redis index — no third-party API ever sees the address, and zero data retention is trivially satisfied. Built for Spain's **SES.HOSPEDAJES** reporting compliance.
- **Nobody had assembled the INE street directory into a ready-to-use tool.** The raw Callejero is a fixed-width, ISO-8859-1, five-file ZIP that needs non-trivial ETL — that work is done here.

## Verified numbers

| Metric | Value |
|---|---|
| Street records (INE Callejero 2026-01) | 749,261 |
| Provincias / municipios / postal codes | 52 / 8,106 / 10,127 |
| Full index import time (local redis-stack) | ~209 s |
| Live check: `"Gran Vía"` (national) | 134 hits |
| Live check: CP `28013` + `"mayor"` | exactly 1 hit — `Calle Mayor, Madrid` |
| Tests | 132 unit (12 files) + 7 Playwright e2e |
| Toolchain | typecheck 9/9 · lint 0 errors · build 9/9 |

## Architecture

```
[DNI/TIE OCR pipeline — parent project]
  Browser: PaddleV6 + WebGPU (in-browser OCR, zero retention)
      │
      ├── MCP stdio ──► packages/mcp        normalize_address / search_addresses
      │                    └── @spain-address/core ──► Upstash Redis Search (default)
      │                                                Typesense (fallback)
      └── HTTP ───────► packages/cascade    GET /api/geo/provincias | /municipios | /cps | /validate-cp
                           └── ioredis/RESP ──► cascade_es RediSearch index (~18K docs)

  Shared data: callejero_2026-01.jsonl.gz (749K INE records, produced by packages/etl)
```

Three ways to consume the same dataset:

| Interface | What it is | Docs |
|---|---|---|
| MCP server | stdio JSON-RPC server with `normalize_address` + `search_addresses` tools — for Claude Desktop, Cursor, or any MCP agent | [packages/mcp](./packages/mcp/README.md) |
| Cascade server | Hono HTTP API replacing geoapi.es for the provincia → municipio → CP dropdown cascade (sub-ms local lookups) | [packages/cascade](./packages/cascade/README.md) |
| Widget | Framework-agnostic `<address-search-es>` Stencil web component + React wrapper: grouped results, CP auto-detection, ARIA-complete, dark-mode theming | [packages/widget](./packages/widget/README.md) |

## Quick start

Prerequisites: Node 22+, pnpm 9+, Docker.

```bash
git clone https://github.com/Karim-capatlas/spain-address-autocomplete
cd spain-address-autocomplete
pnpm install

# 1. Generate the dataset from INE open data (the snapshot is not committed)
pnpm exec tsx packages/etl/src/index.ts run --year 2026 --month 1
#    → packages/data/snapshots/callejero_2026-01.jsonl.gz (~22 MB, 749,261 records)

# 2. Start the local RediSearch backend (same engine as Upstash Cloud)
docker compose up -d redisearch
```

### Demo A — cascade server (fully local, no cloud account)

```bash
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop
pnpm --filter @spain-address/cascade start        # → http://localhost:5978

curl localhost:5978/api/geo/provincias                              # → 52 provincias
curl "localhost:5978/api/geo/municipios?provincia=28"               # → 179 municipios
curl "localhost:5978/api/geo/validate-cp?municipio=28079&cp=28001"  # → { "valid": true, "ineCode": "28079" }
```

### Demo B — MCP server (Upstash Redis Search)

```bash
# Import the street index — Upstash Cloud (free tier):
export UPSTASH_REDIS_REST_URL="https://<db>.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="<token>"
pnpm upstash:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop

# Or against the local redis-stack container over RESP:
pnpm exec tsx scripts/redis-import-verify.ts

# Run the server (stdio JSON-RPC)
pnpm --filter @spain-address/mcp start
```

Backend selection is automatic via `createSearchClient()`: Upstash REST when `UPSTASH_REDIS_REST_URL`/`TOKEN` are set, otherwise a local Typesense fallback.

> **Status note:** the Upstash Cloud REST path is unit-tested; end-to-end search was live-verified against a local redis-stack container (the same engine Upstash Cloud runs) with all 749K docs.

### Use it from Claude Desktop

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "spain-address": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp/dist/cli.js"],
      "env": {
        "UPSTASH_REDIS_REST_URL": "https://<db>.upstash.io",
        "UPSTASH_REDIS_REST_TOKEN": "<token>"
      }
    }
  }
}
```

Cursor config and full tool schemas: [packages/mcp/README.md](./packages/mcp/README.md).

## Packages

| Package | Purpose |
|---|---|
| [`etl`](./packages/etl) | INE Callejero ETL — fixed-width ISO-8859-1 TRAM/UP parser → normalized JSONL+gzip (749K records) |
| [`core`](./packages/core) | `AddressRecord` types + backend-agnostic `searchAddresses()` (Upstash REST / Typesense dispatch) |
| [`upstash`](./packages/upstash) | `FT.CREATE` schema (TEXT weights 5/3/1/1 + TAG filters) + bulk-import CLI |
| [`typesense`](./packages/typesense) | Legacy Typesense schema + import CLI |
| [`mcp`](./packages/mcp) | stdio MCP server — `normalize_address` + `search_addresses` |
| [`cascade`](./packages/cascade) | Hono cascade server (`/api/geo/*`) + `cascade_es` index |
| [`proxy`](./packages/proxy) | BFF proxy (`GET /api/address-search`) — keeps search credentials server-side |
| [`widget`](./packages/widget) | `<address-search-es>` Stencil web component + React wrapper |
| [`data`](./packages/data) | Snapshot metadata |

## Development

```bash
pnpm typecheck    # 9/9 packages
pnpm lint         # 0 errors
pnpm build        # 9/9 packages
pnpm test         # 132 tests (12 files)
pnpm test:e2e     # 7 Playwright tests
```

Stack: TypeScript (strict, ESM) · pnpm 9 workspaces · Turborepo · Vitest · Playwright · tsup · ESLint flat config · Hono · ioredis · Stencil.

## Documentation

- [PRODUCT.md](./PRODUCT.md) — problem, design decisions, data reference
- [ROADMAP.md](./ROADMAP.md) — phased plan and current status
- [AGENTS.md](./AGENTS.md) — full development context for AI agents (also the deepest technical doc)

## Data attribution

- **INE Callejero / Municipios (UP)** — © Instituto Nacional de Estadística (INE), [ine.es](https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390)
- **CNIG CartoCiudad** (optional coordinates) — © Instituto Geográfico Nacional de España, CC BY 4.0

## License

MIT (code). CC BY 4.0 applies to data derived from CartoCiudad.
