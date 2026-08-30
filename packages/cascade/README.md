# `@spain-address/cascade`

**Standalone provincia → municipio → código postal cascade server** — replaces
the external `geoapi.es` router with a local **Typesense** collection.

A small Hono app that serves the four address-cascade endpoints the parent DNI/TIE
form needs, backed by a dedicated `cascade_es` Typesense collection built from the
same **INE Callejero** data as the rest of this monorepo.

## Why

The parent form currently calls an external `geoapi.es` router for the four
provincia/municipio/CP cascade endpoints, proxying to `apiv1.geoapi.es` with an
API key and a 24h in-memory cache:

| Route | Returns |
|---|---|
| `GET /api/geo/provincias` | `[{ code:"01", name:"Álava", ccaa }]` |
| `GET /api/geo/municipios?provincia=05` | `[{ code, name, ccaa }]` (5-digit INE code) |
| `GET /api/geo/cps?municipio=28079` | `["28001", …]` |
| `GET /api/geo/validate-cp?municipio=28079&cp=28001` | `{ valid, ineCode }` |

That approach has problems, all solved here:

- **External HTTP call** on every cache miss → replaced by a local Typesense lookup
  (sub-ms, no network).
- **24h in-memory cache** → gone; data lives in Typesense (survives restarts).
- **No offline capability** → server + Typesense only; fully offline.
- **Stale data** → built from the current 2026-01 INE snapshot.
- **Worker-unreachable backend** → Typesense speaks HTTP/REST, so this BFF can be
  called by a Cloudflare Worker through a Tunnel (raw Redis/RESP cannot).

---

## How it works

```
packages/cascade/
├── package.json       # deps: hono, @hono/node-server, @spain-address/core
├── tsconfig.json
├── Dockerfile
└── src/
    ├── index.ts       # Hono app + 4 route handlers (createApp(deps) for tests)
    ├── cli.ts         # HTTP server entry (serve via @hono/node-server, port 5978)
    ├── typesense.ts   # Typesense-backed CascadeStore (HTTP/REST)
    ├── schema.ts      # cascade_es collection schema (TypesenseSchema)
    ├── types.ts       # ProvinciaDoc / MunicipioDoc / CPDoc + CascadeStore iface
    ├── generator.ts   # builds the 3 doc types from the JSONL snapshot
    ├── import.ts      # upsert bulk importer (runImport + CLI main)
    └── index.test.ts  # route-handler tests (fake store)
    └── typesense.test.ts  # store translation tests
```

### Transport: HTTP/REST via `hono` + `@spain-address/core`

The cascade store (`src/typesense.ts`) is a thin `CascadeStore` over
`@spain-address/core`'s **Typesense client** — HTTP/REST, identical to the street
search path. There is **no `ioredis` / RESP dependency**: every call is a REST
`SEARCH`/`GET /documents/:id`, so the BFF is reachable from a Cloudflare Worker
over a Tunnel (Workers only speak `fetch()`).

> The cascade server does **not** share `@spain-address/core`'s `searchAddresses`
> (that's the fuzzy street search). It defines its own tight `CascadeStore`
> interface with a structured `filter` (`{ type, cpro?, municipios?, id? }`) — see
> `src/types.ts`.

### Index design: `cascade_es`

A dedicated collection, separate from `callejero_es` (different collection name,
different schema, ~18K docs vs 749K — no collision, no shared index).

```
# cascade_es (Typesense collection)
  type         TAG/facet  # doc discriminator: provincia | municipio | cp
  code         string     # bare INE/postal code as returned to clients
  name         string     # display name
  cpro         TAG/facet  # municipio: filter by province
  ccaa_id      TAG/facet  # optional region
  ccaa_name    string     # optional
  municipios   string[]   # multi-value on CP docs → CP ↔ municipio junction
```

**Composite doc id.** Typesense's reserved `id` is the composite `type:code`
(e.g. `cp:28013`, `municipio:28079`, `provincia:28`). A postal code and a
municipio code are both 5-digit `CPRO+xxx` strings, so a bare code would let a
CP upsert **overwrite** a same-numbered municipio. Namespacing by type makes every
id globally unique. `code` (the bare value) is a normal indexed field that the API
returns to clients, and that `validate-cp` looks up directly via
`GET /collections/:name/documents/cp:28013`.

| Doc type | Typesense `id` | Bare `code` | Count |
|---|---|---|---|
| Provincia | `provincia:01` | `01` | 52 |
| Municipio | `municipio:28079` | `28079` | 8,106 |
| CP | `cp:28013` | `28013` | 10,127 |

### Pagination

Typesense caps `per_page` at **250**. The store issues `q='*'` with
`filter_by=type:=<t> [&& cpro:=<x>] [&& municipios:=<y>]` and paginates
internally (`per_page=250`, incrementing `page`) until the page is short — so
provinces with >250 municipios (e.g. Barcelona, ~311) come back complete.

### Data derivation

The cascade data is **derived from the street snapshot** — no new downloads:

- **Provincia** (52) — static `PROVINCIAS` table inlined in `generator.ts`
  (copied from `packages/etl/src/sources/provincias.ts`): all 52 provinces incl.
  Ceuta (53) and Melilla (54).
- **Municipio** (8,106) — `SELECT DISTINCT municipio_id` from the snapshot; each
  maps to `{ name, cpro, cmum, ccaa_id, ccaa_name }`. Municipios with no street
  records are excluded (dead ends in the form dropdown).
- **CP** (10,127) — `SELECT codigo_postal → ordered set<municipio_id>` — one doc
  per unique CP, `municipios` listing all municipios that share it.

> The 24 municipios that appear in the INE `UP` master but have zero callejero
> records are intentionally absent — they would never resolve a street anyway.

---

## API

All endpoints are under `GET /api/geo/*`.

### `GET /api/geo/provincias`

All 52 provincias, sorted by code.

```json
[
  { "code": "01", "name": "Álava", "ccaa": "País Vasco" },
  { "code": "28", "name": "Madrid", "ccaa": "Comunidad de Madrid" }
]
```

### `GET /api/geo/municipios?provincia=28`

Lists municipios in a province. `provincia` is the 2-digit INE code (CPRO),
zero-padded. **400** if missing or non-numeric.

```json
[
  { "code": "28079", "name": "Madrid", "ccaa": "Comunidad de Madrid" },
  { "code": "28013", "name": "Alcorcón", "ccaa": "Comunidad de Madrid" }
]
```

### `GET /api/geo/cps?municipio=28079`

All postal codes serving a municipio. `municipio` must be exactly 5 digits.

```json
["28001", "28002", "28004", "28005", "28006", "28010", "28013"]
```

### `GET /api/geo/validate-cp?municipio=28079&cp=28013`

Validates a CP belongs to a municipio. Both params required; `municipio` and `cp`
must be 5 digits (CP allows non-`000`-prefixed).

```json
{ "valid": true, "ineCode": "28079" }
```

When the CP doesn't exist or doesn't cover the municipio → `{ "valid": false }`.

### CORS

Both BFFs reflect the request `Origin` by default (so a Pages demo works with no
config). Set `CORS_ORIGINS=a,b,c` to pin an allow-list.

---

## Install

```bash
# From the monorepo root
pnpm install
```

## Quick start (local dev)

```bash
# 1. Start a local Typesense (same engine as prod)
docker compose up -d typesense              # 127.0.0.1:8108, key xyz
curl http://127.0.0.1:8108/health          # → {"ok":true}

# 2. Import the cascade data from the existing ETL snapshot
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop

# 3. Start the cascade server (port 5978 by default)
pnpm --filter @spain-address/cascade start

# 4. Verify
curl localhost:5978/api/geo/provincias                            # → 52
curl "localhost:5978/api/geo/municipios?provincia=28"             # → 179
curl "localhost:5978/api/geo/cps?municipio=28079"                 # → ["28001",…]
curl "localhost:5978/api/geo/validate-cp?municipio=28079&cp=28013" # → {valid:true}
```

### Environment variables

These mirror `@spain-address/core`'s Typesense client plus a couple of cascade-only ones.

| Variable | Default | Description |
|---|---|---|
| `TYPESENSE_HOST` | `127.0.0.1` | Typesense HTTP host. |
| `TYPESENSE_PORT` | `8108` | Typesense HTTP port. |
| `TYPESENSE_PROTOCOL` | `http` | `http` or `https` (use `https` for Upstash/Cloudflare). |
| `TYPESENSE_API_KEY` | `xyz` | Typesense API key. |
| `CASCADE_COLLECTION` | `cascade_es` | Collection to query. |
| `CASCADE_PORT` | `5978` | HTTP listen port. |
| `CASCADE_HOST` | `0.0.0.0` | HTTP listen host. |
| `CORS_ORIGINS` | *(unset)* | Comma list of allowed browser origins. Unset → reflect the request `Origin` (demo-friendly). |

---

## Development

```bash
# From the monorepo root, or:
cd packages/cascade

pnpm --filter @spain-address/cascade typecheck  # tsc --noEmit (0 errors)
pnpm --filter @spain-address/cascade lint        # eslint src/ (0 errors)
pnpm --filter @spain-address/cascade build       # tsup → dist/ (ESM + .d.ts)
pnpm --filter @spain-address/cascade test        # vitest run
pnpm --filter @spain-address/cascade dev         # tsx watch src/cli.ts
pnpm --filter @spain-address/cascade start       # tsx src/cli.ts
```

### Import CLI reference

```
pnpm cascade:import -- --snapshot <path.jsonl|.gz> [--drop] [--batch-size <N>]
               [--host] [--port] [--protocol <http|https>] [--api-key] [--collection]

  --snapshot        Path to the ETL JSONL snapshot (.jsonl or .jsonl.gz). Required.
                    Absolute, or relative to the workspace root.
  --drop            Drop the existing cascade_es collection before importing.
  --batch-size      Upsert batch size (default 500).
  --host/--port/--protocol/--api-key  Override the Typesense connection
                    (else defaults to TYPESENSE_* env or 127.0.0.1:8108/xyz).
  --collection      Override the collection name (default cascade_es).
```

### Testing

The unit tests exercise both layers with **no live Typesense required**:

- `src/index.test.ts` — all four endpoints via `createApp({ store: fakeStore(...)})`
  (11 tests). The fake store keys rows by `filter.type`.
- `src/typesense.test.ts` — the store's `filter_by` translation, the composite-id
  direct lookup (`GET /documents/cp:<cp>`), the 404 → `[]` path, and 250-per-page
  pagination (8 tests).

```bash
pnpm --filter @spain-address/cascade test
# ✓ packages/cascade/src/index.test.ts    (11 tests)
# ✓ packages/cascade/src/typesense.test.ts (8 tests)
```

---

## Data invariants

Verified against the 749,261-record `callejero_2026-01.jsonl.gz` snapshot (and the
live local Typesense):

| Metric | Expected | Measured |
|---|---|---|
| Provincias | 52 | 52 |
| Municipios | ~8,106 | 8,106 |
| CPs | 10,127 | 10,127 |
| `000`-prefixed CPs | 0 | 0 |
| CP + municipio code collisions (e.g. `28013`) | coexist | coexist (`cp:28013` ≠ `municipio:28013`) |
| Provincia Madrid (28) present | yes | yes |
| Municipio Madrid (28079) present | yes | yes |
| Municipios for Madrid (28) | 179 (INE) | 179 |
| CPs for Madrid (28079) | > 50 | 58 |

Total docs in `cascade_es`: **18,285** (52 + 8,106 + 10,127).

---

## Architecture

```
                       packages/cascade
┌──────────────────────────────────────────────────────┐
│  cli.ts        — HTTP server (serve on CASCADE_PORT)│
│     │ builds app from createApp + createTypesenseCascadeStore │
│     │                                                  │
│  index.ts      — createApp(deps): Hono (4 GET routes) │
│     │  → deps.store.search(structured CascadeFilter)  │
│     │                                                  │
│  typesense.ts  — CascadeStore over @spain-address/core│
│     │  search(): match-all q='*' + filter_by + pag.   │
│     │  id lookup: GET /collections/:col/documents/<type>:<code> │
│     │                                                  │
│  import.ts     — upsert bulk importer (batch)         │
│  generator.ts  — buildProvinciaDocs /                 │
│                  buildMunicipioDocsFromSnapshot /      │
│                  buildCPDocsFromSnapshot               │
│  schema.ts     — cascade_es TypesenseSchema           │
│  types.ts      — ProvinciaDoc / MunicipioDoc /        │
│                  CPDoc / CascadeStore interface        │
└─────────────────────┬──────────────────────────────────┘
                      │  SEARCH / GET /documents/:id over HTTP/REST
                      ▼
                Typesense (cascade_es)
       52 provincias + 8,106 municipios + 10,127 CP docs
       (derived from callejero_2026-01.jsonl.gz — the same
        749K-record snapshot packages/etl produces)
```

The cascade server talks to Typesense via `@spain-address/core`'s Typesense
client — the **same** HTTP client the street-search proxy uses — so there is one
backend dependency for both BFFs. In production both BFFs sit behind a
Cloudflare Tunnel (see `docs/vps-deploy.md`); because everything is HTTP/REST, a
Cloudflare Worker can call `/api/geo/*` directly through the Tunnel.

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
