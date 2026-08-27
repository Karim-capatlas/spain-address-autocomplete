# `@spain-address/cascade`

**Standalone provincia → municipio → código postal cascade server** — replaces
the external `geoapi.es` router with a local RediSearch index.

A small Hono app that serves the four address-cascade endpoints the parent DNI/TIE
form needs, backed by a dedicated `cascade_es` RediSearch index built from the same
**INE Callejero** data as the rest of this monorepo.

## Why

The parent form currently calls an external `geoapi.es` router for the four
provincia/municipio/CP cascade endpoints, proxying to `apiv1.geoapi.es` with an
API key and a 24h in-memory cache:

| Route | Returns |
|---|---|
| `GET /geo/provincias` | `[{ code:"01", name:"Álava" }]` |
| `GET /geo/municipios?provincia=05` | `[{ code, name }]` (5-digit INE code) |
| `GET /geo/cps?municipio=28079` | `["28001", …]` |
| `GET /geo/validate-cp?municipio=28079&cp=28001` | `{ valid, ineCode }` |

That approach has problems:

- **External HTTP call** on every cache miss — geoapi.es rate-limits (1 req/sec in
  sandbox) and needs a `GEOAPI_KEY` + sandbox/paid tier.
- **24h in-memory cache** — lost on restart, stale inside the TTL.
- **No offline capability** — the form cascade breaks without internet.
- **Stale data** — geoapi.es's `update_date: 2024.01` vs our 2026-01 INE snapshot.

This package solves all four: a local Redis lookup (sub-ms, no network), no API
key, always-current data in Redis (survives restarts), and fully offline-capable
(server + Redis only).

---

## How it works

```
packages/cascade/
├── package.json      # deps: hono, ioredis, @hono/node-server
├── tsconfig.json
├── Dockerfile
└── src/
    ├── index.ts      # Hono app + 4 route handlers (createApp(deps) for tests)
    ├── cli.ts        # HTTP server entry (serve via @hono/node-server, port 5978)
    ├── redis.ts      # ioredis-backed CascadeStore + parseFtSearchReply()
    ├── schema.ts     # FT.CREATE schema + hash-key helpers (cascade:, cascade_es)
    ├── types.ts      # ProvinciaDoc / MunicipioDoc / CPDoc / GeneratorInput
    ├── generator.ts  # builds the 3 doc types from the JSONL snapshot
    ├── import.ts     # pipelined HSET bulk importer (runImport + CLI main)
    └── index.test.ts # 13 unit tests for the route handlers (fake store)
```

### Transport: RESP via `ioredis`

The cascade server uses **ioredis** (RESP protocol) over the local
`redis://127.0.0.1:6379` — the same `redis-stack-server` container that backs
`callejero_es`. In production, Upstash Cloud also exposes a RESP endpoint
(`rediss://<id>.upstash.io:6380`, token as password), so the same code targets
both.

This is **intentionally different** from the Upstash REST client in
`@spain-address/core` — the cascade server needs raw RESP access to run locally
without Upstash credentials, and ioredis handles TLS automatically via the
`rediss://` URL scheme.

### Index design: `cascade_es`

A dedicated index, separate from `callejero_es` (different hash prefix
`cascade:` vs `callejero:`, different schema, ~18K docs vs 749K — no collision).

```
FT.CREATE cascade_es ON HASH PREFIX 1 cascade: SCHEMA
  id           TAG      // exact lookup (@id:{…})
  type         TAG      // doc discriminator (provincia/municipio/cp)
  name         TEXT     // display name
  cpro         TAG      // municipio: filter by province
  ccaa_id      TAG      // optional region filter
  municipios   TAG      // multi-value on CP docs → CP ↔ municipio junction
```

All docs share a `type` field. Hash keys are namespaced:

| Doc type | Key pattern | Count |
|---|---|---|
| Provincia | `cascade:p:01` | 52 |
| Municipio | `cascade:m:28079` | ~8,106 |
| CP | `cascade:cp:28001` | 10,127 |

### Data derivation

The cascade data is **derived from the street snapshot** — no new downloads:

- **Provincia** (52) — static `PROVINCIAS` table inlined in `generator.ts`
  (copied from `packages/etl/src/sources/provincias.ts`), covering all 52
  provinces including Ceuta (53) and Melilla (54).
- **Municipio** (~8,106) — `SELECT DISTINCT municipio_id` from the snapshot;
  each maps to `{ name, cpro, cmum, ccaa_id, ccaa_name }`. Municipios with no
  street records are excluded (they're dead ends in the form dropdown).
- **CP** (10,127) — `SELECT codigo_postal → SET<municipio_id>` — one doc per
  unique CP, with a comma-joined multi-value TAG listing all municipios that
  share it.

> **Counts are measured, not estimated.** The plan's §2 documents the derivation:
> 52 distinct `provincia_id`, ~8,108 distinct `municipio_id`, 10,127 distinct
> `codigo_postal`.

---

## API

All endpoints are under `GET /api/geo/*`.

### `GET /api/geo/provincias`

Returns all 52 provincias, sorted by code.

```json
[
  { "code": "01", "name": "Álava", "ccaa": "País Vasco" },
  { "code": "28", "name": "Madrid", "ccaa": "Comunidad de Madrid" }
]
```

### `GET /api/geo/municipios?provincia=28`

Lists all municipios in the given province. The `provincia` param is a 2-digit
INE province code (CPRO), zero-padded. Returns **400** if missing or non-numeric.

```json
[
  { "code": "28079", "name": "Madrid", "ccaa": "Comunidad de Madrid" },
  { "code": "28013", "name": "Alcorcón", "ccaa": "Comunidad de Madrid" }
]
```

### `GET /api/geo/cps?municipio=28079`

Returns all 5-digit postal codes that serve the given municipio. The `municipio`
param must be exactly 5 digits (CPRO+CMUM). Returns **400** otherwise.

```json
["28001", "28002", "28004", "28005", "28006", "28010", "28013"]
```

### `GET /api/geo/validate-cp?municipio=28079&cp=28001`

Validates that a CP belongs to the given municipio. Both params required;
`municipio` must be 5 digits, `cp` must be 5 digits.

```json
{ "valid": true, "ineCode": "28079" }
```

When the CP doesn't exist or doesn't cover the municipio:

```json
{ "valid": false }
```

### Contract deltas vs the old `geoapi.es` router

| Endpoint | Before | After |
|---|---|---|
| `/provincias` | `[{code, name}]` | adds `ccaa` (additive, safe) |
| `/municipios` | `[{code, name, cp:[]}]` | drops always-empty `cp:[]`, adds `ccaa` |
| `/cps` | identical | identical |
| `/validate-cp` | identical | identical |

---

## Install

```bash
# From the monorepo root
pnpm install
```

## Quick start (local dev)

```bash
# 1. Start a local RediSearch (redis-stack — same engine as Upstash Cloud)
docker-compose up -d redisearch

# 2. Import the cascade data from the existing ETL snapshot
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop

# 3. Start the cascade server (port 5978 by default)
pnpm --filter @spain-address/cascade start

# 4. Verify
curl localhost:5978/api/geo/provincias                            # → 52
curl "localhost:5978/api/geo/municipios?provincia=28"             # → 179
curl "localhost:5978/api/geo/cps?municipio=28079"                 # → ["28001",…]
curl "localhost:5978/api/geo/validate-cp?municipio=28079&cp=28001" # → {valid:true}
```

### Docker Compose (recommended)

The `cascade` service is defined in the root `docker-compose.yml`:

```yaml
cascade:
  build: ./packages/cascade          # multi-stage Node 22 Docker build
  ports: ["3001:5978"]                # host 3001 → container 5978
  environment:
    CASCADE_REDIS_URL: redis://redisearch:6379
  depends_on:
    redisearch:
      condition: service_healthy
```

```bash
docker-compose up -d redisearch cascade
# Import data (runs on the host, talks to the shared redisearch container):
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop
# Test:
curl localhost:3001/api/geo/provincias
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `CASCADE_REDIS_URL` | `redis://127.0.0.1:6379` | Redis/RESP URL. For Upstash Cloud RESP, use `rediss://<id>.upstash.io:6380` (token as password). |
| `CASCADE_PORT` | `5978` | HTTP listen port. |
| `CASCADE_HOST` | `0.0.0.0` | HTTP listen host. |

---

## Development

```bash
# From the monorepo root, or:
cd packages/cascade

pnpm --filter @spain-address/cascade typecheck  # tsc --noEmit (0 errors)
pnpm --filter @spain-address/cascade lint        # eslint src/ (0 errors)
pnpm --filter @spain-address/cascade build       # tsup → dist/ (ESM + .d.ts)
pnpm --filter @spain-address/cascade test        # vitest run (13 tests)
pnpm --filter @spain-address/cascade dev         # tsx watch src/cli.ts
pnpm --filter @spain-address/cascade start       # tsx src/cli.ts
```

### Import CLI reference

```
pnpm cascade:import -- --snapshot <path.jsonl|.gz> [--drop] [--batch-size <N>] [--url <redis://…>]

  --snapshot       Path to the ETL JSONL snapshot (.jsonl or .jsonl.gz). Required.
  --drop           Drop the existing cascade_es index before importing.
  --batch-size     HSET pipeline batch size (default 500).
  --url            Redis URL (default: redis://127.0.0.1:6379).
```

### Testing

The 13 unit tests in `src/index.test.ts` exercise all four endpoints via the
`createApp({ store: fakeStore(...) })` factory — no live Redis required. The fake
store maps by the leading clause of the FT.SEARCH query (e.g.
`@type:{provincia}`).

```bash
pnpm --filter @spain-address/cascade test
# ✓ packages/cascade/src/index.test.ts (13 tests)
```

---

## Data invariants

Verified against the 749,261-record `callejero_2026-01.jsonl.gz` snapshot:

| Metric | Expected | Measured |
|---|---|---|
| Provincias | 52 | 52 |
| Municipios | ~8,108 | 8,106 |
| CPs | 10,127 | 10,127 |
| `000`-prefixed CPs | 0 | 0 |
| Provincias with Madrid (28) | yes | yes |
| Municipio Madrid (28079) present | yes | yes |
| CPs for Madrid (28079) | > 50 | 58 |

The 2-municipio gap vs. the plan's §2 note (8,108) is because the snapshot
derives municipios from street records — the INE `UP` master lists 8,132 total,
24 have zero callejero records, and the remaining delta is within normal
snapshot variance. The generator filters `000`-prefixed CPs at build time, so
they never enter the index.

---

## Architecture

```
                        packages/cascade
┌──────────────────────────────────────────────────────┐
│  cli.ts            — HTTP server (serve on port)    │
│     │ creates App from createApp + RedisCascadeStore │
│     │                                                  │
│  index.ts          — createApp(deps): Hono            │
│     │  4 GET routes → deps.store.search(FT.SEARCH)   │
│     │                                                  │
│  redis.ts          — CascadeStore (ioredis FT.SEARCH) │
│     │  parseFtSearchReply(flat array → docs)         │
│     │                                                  │
│  import.ts         — runImport(pipeline HSET)        │
│  generator.ts      — buildProvinciaDocs /             │
│                      buildMunicipioDocsFromSnapshot /  │
│                      buildCPDocsFromSnapshot           │
│  schema.ts         — FT.CREATE args + hash key helpers │
│  types.ts          — ProvinciaDoc / MunicipioDoc /    │
│                      CPDoc / GeneratorInput            │
└─────────────────────┬──────────────────────────────────┘
                      │  FT.SEARCH on cascade_es (cascade: prefix)
                      ▼
              redis-stack (local) / Upstash RESP (prod)
         52 provincias + 8,106 municipios + 10,127 CP docs
         (derived from callejero_2026-01.jsonl.gz — the same
          749K-record snapshot packages/etl produces)
```

The cascade server has **no dependency on `@spain-address/core`** — it speaks
RESP directly via `ioredis`, keeping the bundle minimal and avoiding any
Upstash REST code. It shares only the INE data, not the import path.

---

## Attribution

- **Instituto Nacional de Estadística (INE)** — Callejero + Municipios/UP data,
  © INE. Source: https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390. Credit
  "© Instituto Nacional de Estadística (INE)" in any derived UI/docs.

## License

MIT — see [`LICENSE`](https://github.com/Karim-capatlas/spain-address-autocomplete/blob/main/LICENSE).
Data licensing is governed by the upstream INE attributions.

---

*Part of the [`spain-address-autocomplete`](https://github.com/Karim-capatlas/spain-address-autocomplete)
monorepo — the provincia→municipio→CP cascade layer of an open-source DNI/TIE OCR
pipeline. Read [`AGENTS.md`](../../AGENTS.md) for the full phase history and design notes.*
