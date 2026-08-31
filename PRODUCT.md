# Product: `spain-address-autocomplete`

> **Open-source MCP server for Spanish address normalization — powered by Typesense (local HTTP/REST), with Upstash Redis Search available as an opt-in backend. Indexes a 749K-record INE dataset.** Live demo: https://calle.alami.es.

---

## 1. North Star

> Given noisy address text extracted from a Spanish DNI/TIE identity card,
> normalize it into structured fields — via type, street name, provincia (name +
> code), municipio (name + code), and código postal — in under 100 ms, entirely
> offline-capable, with zero data retention and SES.HOSPEDAJES compliance.

`spain-address-autocomplete` is the **address-normalization component** of a larger
**DNI/TIE OCR pipeline** (open-source, not yet publicly released). The pipeline
uses **PaddleV6 + WebGPU** to extract addresses from Spanish identity cards
in-browser (zero data retention), then calls this MCP server to normalize the
OCR-derived text into structured fields for downstream government reporting.

This repo provides:
- **Data layer** — ETL pipeline + 749,261-record JSONL snapshot from INE
- **Search layer** — **Typesense** (default, local Docker HTTP/REST) with fuzzy
  prefix + typo matching (Levenshtein 1) for OCR noise; Upstash Redis Search is
  available as an opt-in backend
- **MCP interface** — stdio MCP server exposing `normalize_address` + `search_addresses` tools
- **Cascade interface** — Hono HTTP server (`packages/cascade/`) replacing the
  external `geoapi.es` router, serving the provincia→municipio→CP dropdown
  cascade from a dedicated `cascade_es` **Typesense** collection derived from the
  same INE snapshot
- **Widget** — Stencil Web Component (`packages/widget`) for direct browser integration

---

## 2. Problem & Context

### The pain
| Problem | Current reality |
|---|---|
| **Inaccurate geocoding** | `geoapi.es` fails on OCR-derived text — too many false matches, missing municipios |
| **No offline option** | All existing Spanish address services are online APIs with rate limits and costs |
| **Privacy requirements** | DNI/TIE contains PII — the OCR pipeline must have **zero data retention** |
| **Government compliance** | SES.HOSPEDAJES requires structured address fields (via type, provincia/municipio codes, CP) |
| **No OSS tool exists** | No one has assembled INE's national street directory into a ready-to-use, self-hostable search tool |

### Why this matters
Every Spanish e-commerce checkout, fintech KYC flow, insurtech form, or
government portal needs accurate address input. Developers currently pay Google
(€17/1,000 requests) or cobble together brittle custom solutions. This project
eliminates that cost and complexity with a **free, self-hostable, offline-capable**
alternative.

### Why the MCP architecture?
The DNI/TIE OCR pipeline runs in-browser (PaddleV6 + WebGPU). Address
normalization needs to query a 749K-record database — too large to bundle
client-side. An **MCP server** provides the ideal bridge:
- No HTTP API to deploy/host separately
- Callable by any MCP-compatible agent (Claude Desktop, Cursor, etc.)
- Zero data retention is easy — the server queries a local Typesense index, the
  caller discards the result immediately

---

## 3. Solution Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  DNI/TIE OCR PIPELINE (Parent Project — open-source)                          │
│                                                                              │
│  [Browser]                                                                     │
│   PaddleV6 + WebGPU (identity card image)                                      │
│       │                                                                        │
│       ▼                                                                        │
│   OCR text: "Calle Mayor, 28013 Madrid"                                        │
│       │                                                                        │
│       ├──── (1) MCP stdio call ───► packages/mcp/                              │
│       │    normalize_address("Calle Mayor, 28013 Madrid")                      │
│       │    → @spain-address/core → Typesense (default @127.0.0.1:8108)        │
│       │                           Upstash Redis Search (opt-in: USE_UPSTASH=1) │
│       │    ←── { via_tipo, via_name, provincia, municipio, CP }                │
│       │                                                                        │
│       └──── (2) HTTP call ───► packages/cascade/                               │
│          GET /api/geo/provincias                                               │
│          GET /api/geo/municipios?provincia=28                                  │
│          GET /api/geo/cps?municipio=28079                                      │
│          GET /api/geo/validate-cp?municipio=28079&cp=28001                     │
│          → cascade_es (Typesense collection, HTTP/REST)                       │
│          ←── dropdown options for the form                                     │
│                                                                              │
│  Shared data source: callejero_2026-01.jsonl.gz (749,261 INE rows)             │
│                                                                              │
│  [OVH VPS-1]──Cloudflare Tunnel──► calle.alami.es                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key design decisions
| Decision | Rationale |
|---|---|
| **MCP over REST API** | No separate server to deploy; callable by any MCP client |
| **Typesense (default) over Upstash** | Self-hostable, HTTP-native REST (no TCP/RESP), simplest ops — a single Docker container is the whole backend. `typesense/typesense:30.2` is the only runtime dependency on the VPS. |
| **HTTP/REST for the cascade** | Cloudflare Workers call upstreams with `fetch()` only. Typesense speaks HTTP/REST, so the cascade is Worker-reachable. (The original redis-stack/RESP design was rejected: raw RESP/TCP isn't reachable from a Worker — this is why `packages/cascade` was ported to a Typesense HTTP store.) |
| **Typesense HTTP store for cascade** | `cascade_es` is a dedicated Typesense collection (~18,285 docs: 52 provincias / 8,106 municipios / 10,127 CPs). Doc ids are composite (`type:code`, e.g. `cp:28013`, `municipio:28079`) so a CP code and a municipio INE code that share digits never overwrite each other. |
| **Upstash Redis Search (opt-in)** | Retained for parity with the open-source narrative and serverless-cloud deployments. Engaged only when `USE_UPSTASH=1` + `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set. |
| **Separate cascade index** | The provincia→municipio→CP dropdown needs only provincia/municipio/CP data — not the full 749K street index. A dedicated `cascade_es` collection (~18K docs) is far cheaper to query and keeps the dropdown fast. |
| **Offline-capable** | Docker Compose bundles Typesense locally; no external API calls |
| **Stencil widget** | First-class browser integration (not legacy) — see `packages/widget` |

---

## 4. Current State

### What's done (✅)
- **Phase 0** — Monorepo bootstrap (pnpm workspaces, Turborepo, ESLint, Prettier, lefthook)
- **Phase 1** — ETL pipeline (INE parser → normalized JSONL, 749,261 records)
- **Phase 2** — Typesense schema (`callejero_es`) + ingestion + `searchAddresses()` in `packages/core`
- **Phase 3** — Stencil widget + React wrapper (`packages/widget`)
- **Phase 3.5** — `packages/mcp` (stdio JSON-RPC server with `normalize_address` / `search_addresses`), `packages/upstash` (opt-in Redis Search schema/client/import CLI), `packages/cascade` (Typesense HTTP store), `packages/proxy` (CORS-enabled BFF). `core`'s `createSearchClient()` **defaults to Typesense**; Upstash is opt-in.
- **Phase 3.5 (live verification)** — 749,261 docs indexed into local Typesense (`typesense/typesense:30.2`) in ~5–7 min on 2 vCores; searches verified against the street index ("Gran Vía" → **131** national hits; CP-28013 + "mayor" → exactly `Calle Mayor, Madrid`). Toolchain: typecheck 9/9 · lint 0 errors · build 9/9 · **138 tests pass (13 files)**
- **Cascade server (live-verified, on `calle.alami.es`)** — `packages/cascade/` Hono app replaces the
  external `geoapi.es` router for the provincia→municipio→CP form dropdown, backed by the
  `cascade_es` Typesense collection: **52 provincias, 8,106 municipios, 10,127 CPs** derived
  from the same INE snapshot in one pass (`pnpm cascade:import`). All 4 endpoints
  verified live: 52 provinces · 179 municipios for Madrid · 58 CPs for Madrid city
  · `validate-cp` correct on valid + invalid + unknown CPs.

### Live state (VPS-1 behind `calle.alami.es`)
- **Typesense (local):** `docker compose up -d typesense` → `callejero_es` (749,261 docs) + `cascade_es` (18,285 docs) on `127.0.0.1:8108`, key `xyz`, image `typesense/typesense:30.2` (named volume persists data)
- **Upstash (opt-in):** not configured in this deployment — set `USE_UPSTASH=1` + `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` and use `pnpm upstash:import` to seed it
- **Snapshot:** `packages/data/snapshots/callejero_2026-01.jsonl.gz` (21 MB, 749,261 records)
- **BFFs (systemd):** `spain-cascade` (:5978) + `spain-proxy` (:8787)
- **Tunnel:** `cloudflared` service, public hostnames `calle.alami.es/api/geo`→:5978, catch-all→:8787
- **Repo:** https://github.com/Karim-capatlas/spain-address-autocomplete (public)

### Data reference
| Field | Type | Description |
|---|---|---|
| `id` | string | Typesense document id |
| `via_nombre` | string | Title-cased street name (primary search) |
| `via_tipo` | string | "Calle", "Avenida", "Paseo", etc. |
| `via_nombre_completo` | string | Full name: "Calle Gran Vía" |
| `municipio` | string | "Madrid", "Barcelona", etc. |
| `municipio_id` | string | INE code: CPRO+CMUN (e.g. "28079") |
| `provincia` | string | "Madrid", "Barcelona", etc. |
| `provincia_id` | string | INE province code (e.g. "28") |
| `codigo_postal` | string | 5-digit postal code |
| `label` | string | Display: "Calle Gran Vía, Madrid (28013)" |
| `lat`/`lon` | number? | Optional coordinates (from CNIG CartoCiudad) |

---

## 5. Roadmap

| Phase | Focus | Status |
|---|---|---|
| 0 | Monorepo bootstrap | ✅ Done |
| 1 | ETL pipeline (INE → JSONL) | ✅ Done & verified |
| 2 | Search schema + core search function | ✅ Done (Typesense) |
| 3 | Stencil widget + React wrapper | ✅ Done & built |
| **3.5** | **MCP server + opt-in Upstash backend + Typesense-default port** | ✅ Done & live-verified (Typesense default) |
| 4 | Docker Compose + developer experience | ✅ Done (docker-compose.yml → `typesense`; see docs/vps-deploy.md for VPS systemd deploy) |
| 5 | CI/CD (GitHub Actions) | 🔲 Next |
| 6 | Docs + OSS release | 🔲 Next |
| 7 | Full DNI/TIE OCR pipeline integration | 🔲 Future |

### Phase 3.5: MCP server + Typesense-default store
`normalize_address("Calle Mayor, 28013 Madrid")` → structured `{ via_tipo, via_nombre, via_nombre_completo, municipio, municipio_id, provincia, provincia_id, comunidad_autonoma, codigo_postal, label }` via MCP, served by Typesense by default:

- [x] `packages/mcp/` stdio JSON-RPC server (minimal, no SDK dep): `normalize_address(text)`, `search_addresses(query, filters?)`
- [x] `packages/upstash/` opt-in: `FT.CREATE` schema (TEXT weights 5/3/1/1 + TAG filters), REST client + import CLI
- [x] `packages/cascade/` ported off redis-stack to a Typesense HTTP store (Worker-reachable), composite `type:code` ids, internal 250-doc pagination
- [x] `core`'s `createSearchClient()` defaults to Typesense; Upstash only when `USE_UPSTASH=1` + `UPSTASH_REDIS_REST_URL`/`TOKEN`
- [x] Live-verified on `calle.alami.es`: 749,261 street docs searchable ("Gran Vía"→131), 18,285 cascade docs (52/8,106/10,127)
- [ ] Optional: real Upstash Cloud e2e test (upstash path is unit-tested only; no cloud creds in this repo)
- [ ] Optional: improve multi-word OCR recall (OR'd fuzzy terms or prefix operators)

### Phase 4: Docker + Demo (done)
- [x] `docker-compose.yml` for the Typesense backend (named volume, healthcheck)
- [x] VPS systemd deploy of cascade + proxy BFFs (see `docs/vps-deploy.md`)
- [x] Cloudflare Tunnel on `calle.alami.es`

### Phase 5: CI/CD
- [ ] GitHub Actions: lint + typecheck + test + docker build
- [ ] Biannual data refresh workflow (cron: Jan 1 + Jul 1)

### Phase 6: Visibility
- [ ] Publish npm packages (`@spain-address/core`, `@spain-address/mcp`)
- [ ] Blog post: "Spanish address normalization with Typesense + MCP"

---

## 6. Search Semantics Reference

**Typesense (default):**
```typescript
query_by: 'via_nombre,via_nombre_completo,municipio,provincia'
query_by_weights: '5,3,1,1'
prefix: true                // prefix/fuzzy for OCR tokens
num_typos: 1
group_by: 'municipio_id'
group_limit: 3
infix: true                // substring tolerance for OCR fragments
filter_by: 'provincia_id:=28 && codigo_postal:=28013'   // exact-match facets
```

**Upstash Redis Search (opt-in):**
```javascript
// FT.CREATE
TEXT via_nombre WEIGHT 5.0 NOSTEM    // primary
TEXT via_nombre_completo WEIGHT 3.0 NOSTEM
TEXT municipio WEIGHT 1.0
TEXT provincia WEIGHT 1.0
TAG provincia_id, municipio_id, codigo_postal    // exact-match filters
LANGUAGE spanish    // Spanish stemmer + stop words

// FT.SEARCH (for normalize_address)
// fuzzy %term% expansion on via_nombre / via_nombre_completo for OCR noise,
// plus TAG filters (@provincia_id:{28}, @codigo_postal:{28013});
// municipio grouping is done client-side
```

---

## 7. Running Locally

```bash
# Prerequisites: pnpm 9+, Docker, Node 22+

# 1. Install
git clone https://github.com/Karim-capatlas/spain-address-autocomplete
cd spain-address-autocomplete
pnpm install --frozen-lockfile

# Verify (Phase 0–3.5 — all green)
pnpm typecheck    # 9 packages, green
pnpm test         # 138 tests (13 files), passing
pnpm build        # 9 packages, builds

# 2. Generate the INE dataset (snapshot is not committed)
cd packages/etl
pnpm exec tsx src/index.ts run --year 2026 --month 1
#    → packages/data/snapshots/callejero_2026-01.jsonl.gz (~21 MB, 749,261 records)

# 3. Local search backend (Typesense HTTP/REST @127.0.0.1:8108, key xyz)
docker compose up -d typesense
curl http://127.0.0.1:8108/health    # → {"ok":true}

# 4. Import the street index into Typesense (~5–7 min on 2 vCores)
pnpm typesense:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop --batch-size 1000

# 5. MCP server (stdio JSON-RPC)
pnpm --filter @spain-address/mcp start

# 6. Cascade server (provincia → municipio → CP dropdown)
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop
pnpm --filter @spain-address/cascade start   # → localhost:5978/api/geo/provincias
```

---

## 8. Data Attribution

- **INE Callejero** — © Instituto Nacional de Estadística (INE). Source: `ine.es/prodyser/callejero/`
- **INE Municipios (UP)** — © Instituto Nacional de Estadística (INE)
- **CNIG CartoCiudad** — © Instituto Geográfico Nacional de España (CC BY 4.0)

---

## 9. License

MIT for code (see [LICENSE](./LICENSE)). CC BY 4.0 applies to data derived from CartoCiudad.
