# Product: `spain-address-autocomplete`

> **Open-source MCP server for Spanish address normalization — powered by Upstash Redis Search, serving a 749K-record INE dataset.**

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
- **Search layer** — Upstash Redis Search (migrating from Typesense) with `$fuzzy`
  / `$smart` typo tolerance for OCR noise
- **MCP interface** — stdio MCP server exposing `normalize_address` + `search_addresses` tools
- **Widget (legacy)** — Stencil Web Component (`packages/widget`) for direct browser integration

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
- Zero data retention is easy — the server queries a local Redis index, the
  caller discards the result immediately

---

## 3. Solution Architecture

```
┌─────────────────────────────────────────────────────────┐
│              DNI/TIE OCR PIPELINE (Parent Project)       │
│                                                          │
│  [Browser]                                               │
│   PaddleV6 + WebGPU                                      │
│   (identity card image)                                  │
│       │                                                  │
│       ▼                                                  │
│   OCR-extracted text:                                    │
│   "Calle Mayor, 28013 Madrid"                            │
│       │                                                  │
│       ▼ (MCP stdio call)                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ packages/mcp/    ← THIS REPO (MCP SERVER)          │  │
│  │  normalize_address("Calle Mayor, 28013 Madrid")   │  │
│  │  → calls →                                        │  │
│  │  searchAddresses()  (packages/core)              │  │
│  │  → queries →                                      │  │
│  └─────────────────┬──────────────────────────────────┘  │
│                    ▼                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Upstash Redis Search                                │  │
│  │  - 749,261 records                                 │  │
│  │  - $fuzzy / $smart for OCR typo tolerance            │  │
│  │  - WEIGHT on via_nombre (5) > via_nombre_completo (3) │  │
│  │  - KEYWORD filters: provincia_id, municipio_id, CP  │  │
│  │  - AGGREGATE for municipio grouping                 │  │
│  └─────────────────┬──────────────────────────────────┘  │
│                    │                                     │
│                    ▼                                     │
│  Structured result:                                    │
│  { via_type: "Calle",                              │
│    via_name: "Mayor",                              │
│    provincia: "Madrid", provincia_id: "28",      │
│    municipio: "Madrid", municipio_id: "28079",   │
│    codigo_postal: "28013" }                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key design decisions
| Decision | Rationale |
|---|---|
| **MCP over REST API** | No separate server to deploy; callable by any MCP client |
| **Upstash Redis Search over Typesense** | `$fuzzy` + `$smart` better handles OCR noise; HTTP-native (no TCP); global replicas for low latency |
| **Redis JSON / Hashes** | Data stored as Redis JSON docs; indexed via `SEARCH.CREATE` with Tantivy text analyzer + Spanish stemmer |
| **Offline-capable** | Docker Compose bundles Redis Search locally; no external API calls |
| **Stencil widget kept** | As a legacy/secondary integration for direct browser use |

---

## 4. Current State

### What's done (✅)
- **Phase 0** — Monorepo bootstrap (pnpm workspaces, Turborepo, ESLint, Prettier, lefthook)
- **Phase 1** — ETL pipeline (INE parser → normalized JSONL, 749,261 records)
- **Phase 2** — Typesense schema + ingestion + search function (`packages/core`)
- **Phase 3** — Stencil widget + React wrapper (`packages/widget`)
- **Phase 3.5 (code)** — `packages/upstash` (schema + REST client + import CLI) and
  `packages/mcp` (stdio JSON-RPC server with `normalize_address` / `search_addresses`),
  plus a local RediSearch backend via `docker-compose.yml`
- **Phase 3.5 (live verification)** — 749,261 docs indexed into the local
  redis-stack container in ~209 s; searches verified against the Typesense
  baseline ("Gran Vía" → 134 national; CP-28013 filter → exactly `Calle Mayor,
  Madrid`). Toolchain: typecheck 8/8 · lint 0 errors · build 8/8 · **104 tests pass**

### Live state
- **RediSearch (local):** `docker compose up -d redisearch` → redis-stack container on
  `127.0.0.1:6379`, index `callejero_es` with **749,261 documents** (named volume persists it)
- **Typesense:** also available at `127.0.0.1:8108` (`callejero_es`, same dataset) — legacy backend
- **Snapshot:** `packages/data/snapshots/callejero_2026-01.jsonl.gz` (22 MB, 749,261 records)
- **Repo:** https://github.com/Karim-capatlas/spain-address-autocomplete (public)

### Data reference
| Field | Type | Description |
|---|---|---|
| `id` | string | 16-hex deterministic hash |
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
| **3.5** | **Upstash Redis Search migration + MCP server** | 🚧 Code done & live-verified; wrap-up pending |
| 4 | Docker Compose + Claude Desktop demo | 🔶 Partially done (search backend composed) |
| 5 | CI/CD (GitHub Actions) | 🔲 Next |
| 6 | Docs + blog post | 🔲 Next |
| 7 | Full DNI/TIE OCR pipeline integration | 🔲 Future |

### Phase 3.5 (current): Upstash Redis Search + MCP Server

**Goal:** `normalize_address("Calle Mayor, 28013 Madrid")` → structured `{ via_type, via_name, provincia, municipio, CP, codes }` via MCP, powered by Upstash Redis Search.

- [x] Define `FT.CREATE` schema (TEXT fields with WEIGHT 5/3/1/1, TAG exact-match filters)
- [x] Write bulk-import (JSONL/gzip → HSET via REST pipeline; local RESP variant in `scripts/redis-import-verify.ts`)
- [x] Create `packages/mcp/` with stdio MCP server (minimal JSON-RPC, no SDK dep)
  - `normalize_address(text)` — single best match (house-number stripping for OCR input)
  - `search_addresses(query, filters?)` — ranked matches with municipio grouping
- [x] Upstash Redis Search client in `packages/upstash/src/client.ts` (zero-dep fetch; REST path pending live cloud test)
- [x] Local backend: `docker-compose.yml` (redis-stack-server, RediSearch module), 749K docs imported & verified
- [ ] Flip `@spain-address/core` default backend from Typesense to Upstash
- [ ] Test REST client against real Upstash Cloud credentials (or decide local-first is the ship target)
- [ ] Optional: improve multi-word OCR recall (OR'd fuzzy terms or prefix operators)

### Phase 4: Docker + Demo (partially started)

- [x] `docker-compose.yml` for the RediSearch backend (named volume, healthcheck)
- [ ] `Dockerfile` for MCP server + compose service wiring
- [ ] Claude Desktop / Cursor config examples in README
- [ ] One-command demo: `docker compose up && echo '{"text":"Calle Mayor, Madrid"}' | spain-address-mcp`

### Phase 5: CI/CD

- [ ] GitHub Actions: lint + typecheck + test + docker build
- [ ] Biannual data refresh workflow (cron: Jan 1 + Jul 1)

### Phase 6: Visibility

- [ ] Publish npm packages (`@spain-address/core`, `@spain-address/mcp`)
- [ ] Blog post: "Migrating from Typesense to Upstash Redis Search for Spanish address normalization"
- [ ] Upstash OSS co-marketing post

---

## 6. Search Semantics Reference

**Typesense (current → being migrated):**
```typescript
query_by: 'via_nombre,via_nombre_completo,municipio,provincia'
query_by_weights: '5,3,1,1'
prefix: true
num_typos: 1
group_by: 'municipio_id'
group_limit: 3
```

**Upstash Redis Search (target):**
```javascript
// SEARCH.CREATE
TEXT via_nombre WEIGHT 5.0 NOSTEM    // primary
TEXT via_nombre_completo WEIGHT 3.0 NOSTEM
TEXT municipio WEIGHT 1.0
TEXT provincia WEIGHT 1.0
TAG provincia_id, municipio_id, codigo_postal    // exact-match filters
LANGUAGE spanish    // Spanish stemmer + stop words

// SEARCH QUERY (for normalize_address)
@via_nombre:(Calle Mayor) $fuzzy
// $smart combines phrase + term + fuzzy matching for OCR noise
```

---

## 7. Running Locally

```bash
# Prerequisites: pnpm 9+, Docker, Node 22+

# 1. Install
git clone https://github.com/Karim-capatlas/spain-address-autocomplete
cd spain-address-autocomplete
pnpm install

# Verify (Phase 0–3.5 — all green)
pnpm typecheck    # 8 packages, green
pnpm test         # 104 tests, passing
pnpm build        # 8 packages, builds

# 3. Local search backend (RediSearch — same engine as Upstash Cloud)
docker compose up -d redisearch
pnpm exec tsx scripts/redis-import-verify.ts   # import 749K docs + live verification

# 4. MCP server (stdio JSON-RPC)
pnpm --filter @spain-address/mcp start
```

---

## 8. Data Attribution

- **INE Callejero** — © Instituto Nacional de Estadística (INE). Source: `ine.es/prodyser/callejero/`
- **INE Municipios (UP)** — © Instituto Nacional de Estadística (INE)
- **CNIG CartoCiudad** — © Instituto Geográfico Nacional de España (CC BY 4.0)

---

## 9. License

MIT for code. CC BY 4.0 applies to data derived from CartoCiudad.
