# spain-address-autocomplete

**Open-source MCP server for Spanish address normalization.** Give it noisy address text — e.g. OCR output from a Spanish DNI/TIE identity card — and get back structured fields: via type, street name, provincia (name + code), municipio (name + code), and código postal.

Powered by a **749,261-record** index of the Spanish street map
([INE Callejero](https://www.ine.es/prodyser/callejero/), open government data,
snapshot 2026-01). The default, self-hostable backend is **Typesense** (local
Docker, HTTP/REST); **Upstash Redis Search** is available as an opt-in.

Live demo: **https://calle.alami.es** (OVH VPS-1 fronted by a Cloudflare Tunnel —
provincia → municipio → CP cascade on `:5978`, fuzzy street search on `:8787`).

![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Node 22](https://img.shields.io/badge/Node-22-339933)
![MCP](https://img.shields.io/badge/protocol-MCP%20stdio-blueviolet)
![Tests](https://img.shields.io/badge/tests-138%20passing-brightgreen)
![Live demo](https://img.shields.io/badge/demo-calle.alami.es-33cc77)

_This README is also available in [español](./README.md)._)

> No GIF yet — run `curl "https://calle.alami.es/api/address-search?q=gran%20via"` and see 131 hits for `Calle Gran Vía, …` across Spain. That's the whole product in one request.

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

House numbers are stripped (`C/ Mayor 12 3ºB` → `Calle Mayor`), a 5-digit input is
auto-detected as a postal code, and fuzzy matching (Levenshtein 1–2) tolerates OCR
typos like `Grn Via` or `2801A`.

## Why it exists

- **Existing services fail on OCR text.** `geoapi.es` false-matches noisy input, rate-limits (1 req/s in the sandbox), needs an API key, and serves data from `2024.01` — this repo's INE snapshot is `2026-01`.
- **Paid geocoding is expensive.** Google Places costs ~€17 per 1,000 requests for something Spain's open data already covers.
- **Privacy is the requirement.** DNI/TIE cards are PII. This runs against a local Typesense index — no third-party API ever sees the address, and zero data retention is trivially satisfied. Built for Spain's **SES.HOSPEDAJES** reporting compliance.
- **Nobody had assembled the INE street directory into a ready-to-use tool.** The raw Callejero is a fixed-width, ISO-8859-1, five-file ZIP that needs non-trivial ETL — that work is done here.

## Verified numbers

| Metric | Value |
|---|---|
| Street records (INE Callejero 2026-01) | 749,261 |
| Provincias / municipios / postal codes | 52 / 8,106 / 10,127 |
| `callejero_es` import (Typesense, 2 vCores — OVH VPS-1) | ~5–7 min |
| Live check: `"Gran Vía"` (national) | 131 hits |
| Live check: CP `28013` + `"mayor"` | exactly 1 hit — `Calle Mayor, Madrid` |
| Live demo | https://calle.alami.es (Typesense + Cloudflare Tunnel) |
| Tests | 138 unit (13 files) |
| Toolchain | typecheck 9/9 · lint 0 errors · build 9/9 |

## Architecture

```
[DNI/TIE OCR pipeline — parent project]
  Browser: PaddleV6 + WebGPU (in-browser OCR, zero retention)
      │
      ├── MCP stdio ──► packages/mcp        normalize_address / search_addresses
      │                    └── @spain-address/core ──► Typesense (default @127.0.0.1:8108)
      │                                       Upstash Redis Search (opt-in: USE_UPSTASH=1)
      └── HTTP ───────► packages/cascade    GET /api/geo/provincias | /municipios | /cps | /validate-cp
                           └── HTTP/REST ──► cascade_es Typesense collection (~18K docs)

                                           [OVH VPS-1]──Cloudflare Tunnel──► calle.alami.es
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
pnpm install --frozen-lockfile

# 1. Generate the dataset from INE open data (the snapshot is not committed).
pnpm exec tsx packages/etl/src/index.ts run --year 2026 --month 1
#    → packages/data/snapshots/callejero_2026-01.jsonl.gz (~21 MB, 749,261 records)

# 2. Start the local Typesense backend (HTTP @127.0.0.1:8108, key xyz)
docker compose up -d typesense
curl http://127.0.0.1:8108/health   # → {"ok":true}

# Backend selection (automatic): Typesense is default. Only set the following to
# switch the MCP/proxy to Upstash Redis Search (opt-in):
#   export USE_UPSTASH=1
#   export UPSTASH_REDIS_REST_URL="https://<db>.upstash.io"
#   export UPSTASH_REDIS_REST_TOKEN="<token>"
```

### Demo A — cascade server (fully local, no cloud account)

```bash
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop
pnpm --filter @spain-address/cascade start       # → http://localhost:5978

curl "localhost:5978/api/geo/provincias"                               # → 52 provincias
curl -G "localhost:5978/api/geo/municipios" --data-urlencode "provincia=28"   # → 179 municipios
curl "localhost:5978/api/geo/validate-cp?municipio=28079&cp=28013"     # → {"valid":true,"ineCode":"28079"}
```

### Demo B — MCP server (Typesense by default)

```bash
# Import the street index into Typesense (~5–7 min):
pnpm typesense:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop --batch-size 1000

# Run the server (stdio JSON-RPC on stdin/stdout):
pnpm --filter @spain-address/mcp start
```

`createSearchClient()` picks Typesense (local Docker on `127.0.0.1:8108`) by default;
Upstash is used only when `USE_UPSTASH=1` **and** `UPSTASH_REDIS_REST_URL`/`TOKEN`
are set. The Typesense path is live-verified against `callejero_es` (749,261 docs);
the Upstash path is unit-tested.

### Use it from Claude Desktop

Default = local Typesense (run `docker compose up -d typesense` on the host):

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "spain-address": {
      "command": "pnpm",
      "args": ["--filter", "@spain-address/mcp", "start"],
      "cwd": "/absolute/path/to/spain-address-autocomplete",
      "env": {
        "TYPESENSE_HOST": "127.0.0.1",
        "TYPESENSE_PORT": "8108",
        "TYPESENSE_PROTOCOL": "http",
        "TYPESENSE_API_KEY": "xyz"
      }
    }
  }
}
```

For the **Upstash Redis Search** (cloud) path instead, set `USE_UPSTASH=1` plus
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` in `env` and omit the
`TYPESENSE_*` keys — then run `pnpm upstash:import` to seed the Upstash index.

Cursor config and full tool schemas: [packages/mcp/README.md](./packages/mcp/README.md).

## Packages

| Package | Purpose |
|---|---|
| [`etl`](./packages/etl) | INE Callejero ETL — fixed-width ISO-8859-1 TRAM/UP parser → normalized JSONL+gzip (749K records) |
| [`core`](./packages/core) | `AddressRecord` types + backend-agnostic `searchAddresses()` + `createSearchClient()` (Typesense default; Upstash opt-in) |
| [`typesense`](./packages/typesense) | **Default** Typesense schema + bulk-import CLI (`pnpm typesense:import`) |
| [`upstash`](./packages/upstash) | Upstash Redis Search schema + import CLI (opt-in via `USE_UPSTASH=1`, `pnpm upstash:import`) |
| [`mcp`](./packages/mcp) | stdio MCP server — `normalize_address` + `search_addresses` |
| [`cascade`](./packages/cascade) | Hono cascade server (`/api/geo/*`) backed by the `cascade_es` Typesense collection (HTTP, Worker-reachable) |
| [`proxy`](./packages/proxy) | BFF proxy (`GET /api/address-search`) — keeps search credentials server-side |
| [`widget`](./packages/widget) | `<address-search-es>` Stencil web component + React wrapper |
| [`data`](./packages/data) | Snapshot metadata |

## Development

```bash
pnpm typecheck   # 9/9 packages
pnpm lint        # 0 errors
pnpm build        # 9/9 packages
pnpm test         # 138 tests (13 files)
pnpm test:e2e     # Playwright (widget)
```

Stack: TypeScript (strict, ESM) · pnpm 9 workspaces · Turborepo · TS 5.5 / Node 22 ·
Vitest 2 · tsup · ESLint flat config · Prettier · Hono (BFFs) · Stencil (widget) ·
Typesense (store). Upstash Redis Search is retained as an **opt-in** backend
(`packages/upstash`); it is not on the default code path.

## Documentation

- [docs/vps-deploy.md](./docs/vps-deploy.md) — **deploy the demo to a VPS behind a Cloudflare Tunnel** (`calle.alami.es`)
- [PRODUCT.md](./PRODUCT.md) — problem statement, design decisions, data reference
- [ROADMAP.md](./ROADMAP.md) — phased plan and current status
- [AGENTS.md](./AGENTS.md) — full development context for AI agents (deepest technical doc)

## Data attribution

- **INE Callejero / Municipios (UP)** — © Instituto Nacional de Estadística (INE), [ine.es](https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390)
- **CNIG CartoCiudad** (optional coordinates) — © Instituto Geográfico Nacional de España, CC BY 4.0

## License

MIT (code). CC BY 4.0 applies to data derived from CartoCiudad.
