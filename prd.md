# PRD: `spain-address-autocomplete`
> **Automated Claude Code PRD** — Open-Source Spanish Address Autocomplete Utility  
> Version: 1.0.0 | Status: Ready for Execution

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [System Architecture](#4-system-architecture)
5. [Data Sources & Licensing](#5-data-sources--licensing)
6. [Repository Structure](#6-repository-structure)
7. [Phase 0 — Monorepo Bootstrap](#phase-0--monorepo-bootstrap)
8. [Phase 1 — ETL Pipeline](#phase-1--etl-pipeline)
9. [Phase 2 — Typesense Schema & Ingestion](#phase-2--typesense-schema--ingestion)
10. [Phase 3 — Autocomplete Widget](#phase-3--autocomplete-widget)
11. [Phase 4 — Developer Experience & Docker](#phase-4--developer-experience--docker)
12. [Phase 5 — CI/CD & Automated Data Refresh](#phase-5--cicd--automated-data-refresh)
13. [Phase 6 — Documentation & OSS Release](#phase-6--documentation--oss-release)
14. [Data Schema Reference](#data-schema-reference)
15. [Acceptance Criteria Summary](#acceptance-criteria-summary)

---

## 1. Project Vision

Build a **free, open-source, self-hostable** Spanish address autocomplete system that allows any developer to drop a single component into their web application and give users instant, accurate address suggestions — including street name, municipio, provincia, código postal, and INE codes — powered by a Typesense search engine and sourced exclusively from open government data.

### Why this project matters

- **No viable free alternative exists.** Every existing Spanish address solution is either paid (Correos, Google Places API), incomplete (CP-only lookups), or tightly coupled to proprietary geocoder APIs (CartoCiudad live-only, Geoapify).
- **The data exists and is free.** The Spanish Government (INE, IGN/CNIG) publishes the full national street directory under open licenses. Nobody has assembled it into a ready-to-use developer tool.
- **The use case is universal.** Every Spanish e-commerce, fintech, insurtech, or government portal needs address input. Developers currently pay Google or cobble together brittle custom solutions.
- **Typesense is the right engine.** Unlike Elasticsearch, it is lightweight, open-source, typo-tolerant by default, and trivially self-hostable — making it a realistic choice for small teams.

---

## 2. Problem Statement

A Spanish developer building an address form today faces these blockers:

| Pain | Reality |
|---|---|
| No free street-level autocomplete | Google Places API costs ~€17/1000 requests at scale |
| Open data is raw and unprocessed | INE Callejero is a fixed-width file requiring non-trivial ETL |
| No ready-to-use search index | Developers must design schema, ingest, and tune Typesense themselves |
| No frontend component | There is no Spain-specific address widget comparable to `react-places-autocomplete` |
| Data gets stale | No OSS project auto-refreshes from INE's biannual updates |

This project eliminates all five blockers in a single open-source monorepo.

---

## 3. Goals & Non-Goals

### Goals ✅

- Ingest, normalize, and flatten Spanish address data from INE + CNIG CartoCiudad into a Typesense-ready JSONL dataset
- Publish a versioned, downloadable JSONL snapshot so users can skip the ETL entirely
- Provide a Typesense collection schema and bulk-import script
- Ship a framework-agnostic vanilla JS autocomplete widget (`<address-search-es>` Web Component)
- Ship a React wrapper (`@spain-address/react`)
- Provide a `docker-compose.yml` for zero-config local development (Typesense + pre-loaded data)
- Automate biannual data refresh via GitHub Actions
- Full TypeScript throughout
- 100% free dependencies and data sources

### Non-Goals ❌

- Street number / portal-level lookup (that's 10M+ records — out of scope for v1)
- International addresses
- Paid or rate-limited API dependencies
- A hosted SaaS version (self-host only)
- Map visualization (out of scope; coordinates are included but rendering is the consumer's responsibility)
- Reverse geocoding (coordinates → address)

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   DATA PIPELINE (ETL)                   │
│                                                         │
│  INE Callejero ZIP  ──┐                                 │
│  (TRAM streets + UP    │                                │
│   municipio master)   ─┼──► normalize.ts ──► merge.ts   │
│  CNIG CartoCiudad (opt)┘       │                       │
│                            flat JSONL                   │
│                                 │                       │
└─────────────────────────────────┼───────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────┐
│                  SEARCH ENGINE (Typesense)               │
│                                                         │
│   schema.ts ──► import.ts ──► Typesense Collection      │
│                                    │                    │
└────────────────────────────────────┼────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────┐
│                   CONSUMER LAYER                        │
│                                                         │
│   @spain-address/core      (search client + types)      │
│   @spain-address/widget    (vanilla Web Component)      │
│   @spain-address/react     (React wrapper)              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key architectural decisions and why

| Decision | Rationale |
|---|---|
| **Granularity: via × municipio × CP** | Finer (portal-level) = 10M+ records, too heavy; Coarser (municipio-only) = not useful for address forms |
| **Typesense over Meilisearch** | Typesense has built-in locale support (`es`), faceted filtering, and group_by — all critical for this use case |
| **Monorepo (pnpm workspaces)** | ETL, schema, and widget share types; single versioning; single CI pipeline |
| **Web Component as primary widget** | Framework-agnostic; works in React, Vue, Angular, plain HTML — one implementation, universal usage |
| **JSONL snapshots published in releases** | Users should be able to `docker run` without running ETL; snapshots enable this |
| **INE as primary source, CNIG as enrichment** | INE Callejero has the widest coverage; CartoCiudad adds centroid coordinates |

---

## 5. Data Sources & Licensing

| Source | Data | License | URL | Update Cadence |
|---|---|---|---|---|
| **INE Callejero del Censo Electoral** | Street names, municipio ID, CP, province | Open (Spanish Public Sector) | `ine.es/prodyser/callejero/` | Biannual (Jan + Jul) |
| **INE Municipios (UP)** | Municipio name + INE code master (all 8,132 Spanish municipios; articulated names as `NAME (EL/LA)`); derived from `UP` inside the Callejero ZIP. Provincia/CCAA from a static table. | Open (Spanish Public Sector) | `ine.es/dyngs/DAB/es/index.htm?cid=1390` | Biannual (with Callejero) |
| **CNIG CartoCiudad** | Centroid coordinates per via | CC BY 4.0 | `centrodedescargas.cnig.es` | Annual |

**Attribution requirements:**
- **INE data** (Callejero, Municipios, UP) is © Instituto Nacional de Estadística and must be credited as "© Instituto Nacional de Estadística (INE)" in documentation, snapshot metadata, and any UI that displays the data. Source: `https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390`.
- **CartoCiudad (CC BY 4.0):** data derived from CartoCiudad must credit "© Instituto Geográfico Nacional de España".

### INE Callejero file format (REAL — verified against `caj_esp_012026.zip`)

The INE Callejero ZIP is **NOT** a `.CAL` fixed-width single file as formerly
documented here. It is a national ZIP (`caj_esp_{MM}{YYYY}.zip`, e.g.
`caj_esp_012026.zip`) containing five fixed-width, **ISO-8859-1** (not UTF-8)
text files, each keyed by `(CPRO, CMUN)`:

```
Field         Position   Length  Description
CPRO          1-2        2       Province code (INE), e.g. "28" (Madrid)
CMUN          3-5        3       Municipality code (INE), e.g. "079"
...           ...        ...     File-specific
```

1. **TRAM** (273 chars/row) — street records. The only file carrying a postal
   code. Key 0-based slices:
   ```
   Field     Start Len  Notes
   CPRO      0     2    province code ("28")
   CMUN      2     3    municipality code ("079")  -> municipio_id = CPRO+CMUN
   CPOS      42    5    postal code ("28013") — 5 real digits (NOT "00000")
   FVAR      61    8    reference date, e.g. "20251231" (rows not starting "20" are skipped)
   NENTCOC   85    25
   NENTSIC   110   25  SIMPLE-B: municipio name; TRANSITION: street#1 (ends w/ article)
   NNUCLEC   135   25  SIMPLE-B: municipio name; blank for simple-A
   CVIA      160   5
   NVIAC     165   25  SIMPLE-B: street name; TRANSITION: street#2
   CPSVIA    190   5
   DPSVIA    195   50  SIMPLE-A: street name WITH type word (e.g. "CALLE MAYOR (FTA)")
   MANZ    245   12
   CPOS2   257   5   second postal code (same value)
   ```
   Via-name shape disambiguation (validated by a prototype over all 80,340
   Madrid TRAM rows):
   - **SIMPLE-A** — `DPSVIA` non-empty → one street there (type word + name).
   - **SIMPLE-B** — else `NVIAC` non-empty and `NENTSIC` has no trailing
     grammatical article → street in `NVIAC`; `NENTSIC`/`NNUCLEC` hold the
     municipio name.
   - **TRANSITION** — else `NVIAC` non-empty and `NENTSIC` ends with an article
     (`(LA|DEL|DE|EL|LOS|LAS|DE LA|DE LOS|DE LAS|DE EL)`) → street#1 in
     `NENTSIC`, street#2 in `NVIAC`; emit **two** records sharing the CP +
     municipio.
   Trailing non-article parentheticals (e.g. `(FTA)`, `(KM.)`) are qualifiers
   and are stripped; grammatical-article parens (e.g. `(LA)`) are kept.

2. **UP** (municipality master) — the authoritative `(CPRO, CMUN) → nombre`
   table for **all 8,132** Spanish municipalities (name at column 94, 40 chars).
   Free of the `*DISEMINADO*` special marker that contaminates TRAM. INE
   articulated municipios are stored as `NAME (EL|LA|LOS|LAS)` (e.g.
   `BOALO (EL)` = "El Boalo"); the parser reorders these to canonical form.
   Municipio names are derived from `UP`; provincia / CCAA come from the static
   `provincias.ts` table.

3. **VIAS / PSEU / SECC** — contain no clean postal-code / municipio-name
   table usable by the pipeline; VIAS is a street cross-reference used only
   for the optional `via_tipo` code → label mapping.

The ETL must:
1. Decode each file as ISO-8859-1 (via `iconv-lite`), not UTF-8.
2. Trim and normalize all string fields.
3. Build `municipio_id` = `CPRO + CMUN` (5 digits) and join UP → municipio name;
   resolve `via_tipo` via the type-word prefix of the street name (mapped to
   codes `01`..`95` in `normalize.ts`'s `VIA_TIPO_MAP`); default `01` / "Calle".

---

## 6. Repository Structure

```
spain-address-autocomplete/
│
├── packages/
│   ├── etl/                        # Data ingestion pipeline
│   │   ├── src/
│   │   │   ├── sources/
│   │   │   │   ├── ine-callejero.ts        # INE fixed-width parser
│   │   │   │   ├── ine-municipios.ts       # INE municipality names
│   │   │   │   └── cnig-cartociudad.ts     # Coordinate enrichment
│   │   │   ├── transform/
│   │   │   │   ├── normalize.ts            # Field normalization
│   │   │   │   ├── merge.ts                # Source joining
│   │   │   │   └── deduplicate.ts
│   │   │   ├── output/
│   │   │   │   └── jsonl-writer.ts
│   │   │   └── index.ts                    # CLI entry point
│   │   ├── data/                           # Raw downloaded files (gitignored)
│   │   └── package.json
│   │
│   ├── typesense/                  # Schema + ingestion
│   │   ├── src/
│   │   │   ├── schema.ts                   # Collection definition
│   │   │   ├── import.ts                   # Bulk import CLI
│   │   │   └── client.ts                   # Reusable client factory
│   │   └── package.json
│   │
│   ├── core/                       # Shared types + search client
│   │   ├── src/
│   │   │   ├── types.ts                    # AddressRecord, SearchResult
│   │   │   ├── search.ts                   # Search function wrapper
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── widget/                     # Vanilla Web Component
│   │   ├── src/
│   │   │   ├── address-search-es.ts        # <address-search-es> element
│   │   │   ├── styles.ts                   # Shadow DOM styles
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── react/                      # React wrapper
│       ├── src/
│       │   ├── AddressSearch.tsx
│       │   └── index.ts
│       └── package.json
│
├── data/
│   └── snapshots/                  # Versioned JSONL exports (tracked via Git LFS)
│       └── callejero_YYYY-MM.jsonl.gz
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── typesense-seed/
│       └── entrypoint.sh           # Auto-imports snapshot on first run
│
├── docs/
│   ├── README.md
│   ├── CONTRIBUTING.md
│   ├── ARCHITECTURE.md
│   ├── DATA_SOURCES.md             # Attribution + lineage
│   └── examples/
│       ├── vanilla/
│       ├── react/
│       └── vue/
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── data-refresh.yml        # Scheduled biannual refresh
│       └── release.yml
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── turbo.json
```

---

## Phase 0 — Monorepo Bootstrap

> **Why:** Establishing the monorepo structure, tooling, and conventions before writing any domain logic prevents expensive refactoring later. All subsequent phases depend on this foundation.

### Tasks

- [ ] **0.1** Initialise Git repository with `.gitignore` covering `node_modules/`, `dist/`, `packages/etl/data/`, `*.jsonl`, `*.gz`
- [ ] **0.2** Create `pnpm-workspace.yaml` listing all packages under `packages/*`
- [ ] **0.3** Create root `package.json` with scripts: `build`, `test`, `lint`, `typecheck`, `etl`, `import`
- [ ] **0.4** Install and configure Turborepo (`turbo.json`) with pipeline for `build → test`
- [ ] **0.5** Create `tsconfig.base.json` with `strict: true`, `target: ES2022`, `moduleResolution: bundler`
- [ ] **0.6** Configure ESLint (flat config) with `@typescript-eslint`, `import`, `unicorn` plugins
- [ ] **0.7** Configure Prettier with `singleQuote: true`, `semi: false`
- [ ] **0.8** Add `lefthook` for pre-commit: lint + typecheck on staged files
- [ ] **0.9** Create each `packages/*/package.json` with correct `name`, `version: 0.1.0`, `type: module`
- [ ] **0.10** Verify `pnpm install` completes with zero errors and `pnpm build` runs (even if empty)

### Acceptance check

```bash
pnpm install          # exits 0
pnpm typecheck        # exits 0
pnpm lint             # exits 0, no warnings
```

---

## Phase 1 — ETL Pipeline

> **Why:** The raw INE Callejero is a fixed-width ISO-8859-1 encoded file split across 52 provincial ZIPs. It is not usable by Typesense as-is. This phase produces a clean, UTF-8, deduplicated, flat JSONL file that is the source of truth for all downstream phases.

### 1.1 — Source Downloader

- [x] **1.1.1** Create `packages/etl/src/sources/downloader.ts` — a function `downloadINECallejero(year: number, month: 1 | 7): Promise<string>` that:
  - Constructs URL: `http://www.ine.es/prodyser/callejero/caj_esp/caj_esp_[MM][YYYY].zip`
  - Downloads to `packages/etl/data/raw/`
  - Checks if file already exists and skips re-download (idempotent)
  - Shows progress bar using `cli-progress`
- [x] **1.1.2** Create `packages/etl/src/sources/ine-municipios.ts` — CSV loader for an optional user-supplied `--municipios <csv>` reference (`CPRO,CMUN,NOMBRE,CPRO_NAME,CCAA,CCAA_NAME`); the canonical municipio names, when no CSV is supplied, are **derived from the `UP` file inside the INE Callejero ZIP** (see §5): `buildMunicipiosMapFromZip` reads `UP`'s column 94 to obtain `(CPRO+CMUN) → nombre` for all 8,132 Spanish municipalities (INE articulated names like `BOALO (EL)` are normalised to `El Boalo`). Provincia / CCAA come from `provincias.ts`.
- [x] **1.1.3** Create `packages/etl/src/sources/cnig-cartociudad.ts` — optional coordinate enrichment. Downloads CartoCiudad portal CSV per province and extracts `(via_nombre, municipio_id) → (lat, lon)` centroid map. Mark as `OPTIONAL` in comments — the pipeline continues if download fails.

### 1.2 — INE Callejero Parser

- [x] **1.2.1** Create `packages/etl/src/sources/ine-callejero.ts` implementing `parseCallejeroZip(zipPath, provinceCodes?, municipiosMap?)` (async generator of `RawRecord`) over the real `TRAM` file, plus `buildMunicipiosMapFromZip` (derives names from `UP`).
- [x] **1.2.2** Implement fixed-width field extraction per the **real** TRAM schema in §5 (CPRO `[0:2]`, CMUN `[2:5]`, CPOS `[42:47]`, FVAR `[61:69]`, NENTSIC `[110:135]`, NNUCLEC `[135:160]`, NVIAC `[165:190]`, DPSVIA `[195:245]`). Decode ISO-8859-1 → UTF-8 with `iconv-lite`.
- [x] **1.2.3** Resolve `via_tipo_code` from the **leading type word** of the street name (`CALLE`, `AVDA`, `PLAZA`, `PASEO`, `RONDA`, `TRVA`, `CTRA`, `CMNO`/Camino, `CÑADA`, `PSAJE`, `BULEV`, `CARRE`, `PLZLA`, `LUGAR`, `AVIA`, `URB`, …) — only when it is followed by whitespace (so compound names like `CAMINO-REGUERA` are not split). Codes map into the 95-entry `VIA_TIPO_MAP` in `normalize.ts`; unknown → `'01'` / Calle. A user `--municipios <csv>` override is authoritative; otherwise names are derived from `UP`.

- [x] **1.2.4** Parse produces a `RawRecord` interface:

```typescript
interface RawRecord {
  provincia_id: string      // "28"
  municipio_id: string      // "28079" (CPRO+CMUN concatenated)
  codigo_postal: string     // "28013"
  via_tipo_code: string     // "09"
  via_nombre_raw: string    // "GRAN VIA" (as in source, uppercase)
}
```

### 1.3 — Normalization

- [x] **1.3.1** Create `packages/etl/src/transform/normalize.ts`:
  - `toTitleCase(str)` — converts `"GRAN VIA"` → `"Gran Vía"` using `Intl.Collator` and a proper Spanish title-case function (preserves articles: de, del, la, las, el, los)
  - `normalizeForSearch(str)` — strips diacritics, lowercases: `"Gran Vía"` → `"gran via"` (for Typesense `via_nombre` field)
  - `padProvinceCode(code)` — ensures 2-digit zero-padded province code
  - `padMunicipioCode(code)` — ensures 5-digit zero-padded INE municipio code
  - `validateCP(cp)` — returns `false` for invalid/placeholder postal codes (e.g., `"00000"`)

### 1.4 — Merge & Enrich

- [x] **1.4.1** Create `packages/etl/src/transform/merge.ts` implementing `mergeRecords(raw: RawRecord[], municipios: MunicipioMap, coordinates?: CoordMap): AddressRecord[]`
- [ ] **1.4.2** Join on `municipio_id` to attach: `municipio`, `provincia`, `provincia_id`, `comunidad_autonoma`, `comunidad_autonoma_id`
- [ ] **1.4.3** Resolve `via_tipo` label from `VIA_TIPO_MAP`; construct `via_nombre_completo` = `via_tipo + " " + via_nombre`
- [ ] **1.4.4** Construct `label` = `"${via_nombre_completo}, ${municipio} (${codigo_postal})"`
- [ ] **1.4.5** If coordinate map available: look up centroid by `(via_nombre_normalizado, municipio_id)`; attach `lat` / `lon` if found
- [ ] **1.4.6** Generate deterministic `id`: `sha1(municipio_id + "-" + codigo_postal + "-" + via_tipo_code + "-" + via_nombre_normalizado).slice(0, 16)`

### 1.5 — Deduplication

- [x] **1.5.1** Create `packages/etl/src/transform/deduplicate.ts` — deduplicates on composite key `(via_nombre_normalizado, municipio_id, codigo_postal)`. Keeps the record with coordinates if duplicates exist.
- [ ] **1.5.2** Log deduplication stats: total input records, duplicates removed, output records

### 1.6 — JSONL Output

- [x] **1.6.1** Create `packages/etl/src/output/jsonl-writer.ts` that streams `AddressRecord[]` to `data/snapshots/callejero_YYYY-MM.jsonl`
- [ ] **1.6.2** After write: gzip the output to `callejero_YYYY-MM.jsonl.gz`
- [ ] **1.6.3** Write a `metadata.json` alongside: `{ source_date, record_count, provinces_covered, generated_at }`

### 1.7 — ETL CLI Entry Point

- [x] **1.7.1** Create `packages/etl/src/index.ts` as a CLI using `commander`:

```
pnpm etl run --year 2025 --month 1       # Full pipeline
pnpm etl run --year 2025 --month 1 --provinces 28,08  # Single-province test mode
pnpm etl validate ./data/snapshots/callejero_2025-01.jsonl  # Validate existing snapshot
pnpm etl stats ./data/snapshots/callejero_2025-01.jsonl     # Print statistics
```

- [x] **1.7.2** The `validate` command checks: all required fields present, no null IDs, CP format valid (5 digits, rejecting the `00000` collapse marker), `municipio_id` 5 digits, and record count vs. an **province-aware** threshold (`>1,000` for a single-province snapshot, `>500,000` for multi-province/national runs).

### Phase 1 Acceptance Check

```bash
pnpm etl run --year 2026 --month 1 --provinces 28    # Madrid only, fast smoke test
# Expected output (January 2026 publication, province 28):
# ✓ Downloaded INE Callejero 2026-01
# ✓ Parsed 88,228 raw records (TRAM, province 28) — every CP is 28xxx (no 00000)
# ✓ Merged with municipio data (179 Madrid municipios resolved from UP)
# ✓ Deduplicated: 37,324 unique records
# ✓ Written to packages/etl/data/snapshots/callejero_2026-01_28.jsonl (+ .gz, ~1.1 MB)

pnpm etl validate packages/etl/data/snapshots/callejero_2026-01_28.jsonl
# ✓ All validations passed   (single-province: no <500k warning; 0 bad CPs)
```

---

## Phase 2 — Typesense Schema & Ingestion

> **Why:** The search engine is the core of the product. Getting the schema right — field types, weights, locale, facets — directly determines the quality of autocomplete results. This phase must be done before building the widget so the widget can be built against a real, working index.

### 2.1 — Collection Schema

- [x] **2.1.1** Create `packages/typesense/src/schema.ts` exporting
  `callejeroEsSchema` (typed via `TypesenseSchema` from `@spain-address/core`).
  The `id` field is the built-in Typesense document id (not declared); street names
  are `infix: true`; `municipio_id`/`provincia_id`/`comunidad_autonoma_id`/
  `codigo_postal` are facets; coordinates are stored as an optional `location`
  geopoint plus optional `lat`/`lon` floats:

```typescript
export const callejeroEsSchema: TypesenseSchema = {
  name: 'callejero_es',
  fields: [
    { name: 'via_nombre',          type: 'string', infix: true },   // primary
    { name: 'via_nombre_completo', type: 'string', infix: true },   // secondary
    { name: 'via_tipo',            type: 'string', facet: true },
    { name: 'municipio',           type: 'string', facet: true },
    { name: 'municipio_id',        type: 'string', facet: true },
    { name: 'provincia',           type: 'string', facet: true },
    { name: 'provincia_id',        type: 'string', facet: true },
    { name: 'comunidad_autonoma',  type: 'string', facet: true },
    { name: 'comunidad_autonoma_id', type: 'string', facet: true },
    { name: 'codigo_postal',       type: 'string', facet: true },
    { name: 'label',               type: 'string' },
    { name: 'location', type: 'geopoint', optional: true },
    { name: 'lat', type: 'float', optional: true },
    { name: 'lon', type: 'float', optional: true },
  ],
}
```

- [x] **2.1.2** Why each field is `facet: true` — `municipio_id`,
  `provincia_id`, `comunidad_autonoma_id`, `codigo_postal`, `municipio`,
  `provincia`, `comunidad_autonoma`, and `via_tipo` are facets so the widget can
  filter by any of them without a full re-query. Street names are `infix: true`
  for partial-prefix matching (e.g. `"gr vía"`). No `default_sorting_field` is set:
  Typesense 30.x rejects the reserved `_text_match` as a sort field and falls back
  to relevance text-match ranking.

### 2.2 — Typesense Client

- [x] **2.2.1** Implemented in `packages/core/src/typesense.ts` —
  `createTypesenseClient({ config?, fetchImpl? })` with env‑defaulted local config
  (the Homebrew `typesense-server` defaults):

```bash
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=xyz   # dev only — the brew config value
```

  The client is a thin `fetch` wrapper over the Typesense REST API (Node 22 ships
  a global `fetch`, so no SDK/HTTP dependency is pulled into the consumer tree).
  The `typesense` JS SDK was deliberately **not** used: its `SearchParams<T, Infix>`
   generics are incompatible with this repo's `strict` + `no-explicit-any` lint.
- [x] **2.2.2** `searchAddresses(query, { client, collection? })` in
  `packages/core/src/search.ts` is the search wrapper the widget consumes. A
  `createReadonlyClient()` is not needed yet (dev uses the single `xyz` key);
   add a search-only key once Phase 4 hardens the deployment.

### 2.3 — Import CLI

- [x] **2.3.1** Create `packages/typesense/src/import.ts` CLI:

```bash
pnpm build                                     # builds core dist (client lives there)
pnpm typesense:import --snapshot packages/data/snapshots/callejero_2026-01_28.jsonl.gz --drop
pnpm typesense:import --snapshot packages/data/snapshots/callejero_2026-01_28.jsonl.gz --drop --batch-size 500
```

  Reads `.jsonl` or `.jsonl.gz`, resolves `--snapshot` against the workspace root,
  creates the collection (POST `/collections`), and bulk-indexes via
  `POST /collections/:name/documents/import` (Typesense 30.x uses **POST**, not
  PUT — PUT returns 404). `--drop` deletes an existing collection first.

- [ ] **2.3.2** Import in batches of 1,000 records using Typesense's `importDocuments` with `action: upsert`
- [ ] **2.3.3** Log per-batch success/failure counts; abort and report if error rate > 0.1%
- [ ] **2.3.4** After import: run a verification query (`"Gran Vía"`, `"Calle Mayor"`, `"Paseo de Gracia"`) and assert each returns ≥ 5 results

### 2.4 — Search Function (in `packages/core`)

- [ ] **2.4.1** Create `packages/core/src/types.ts`:

```typescript
export interface AddressRecord {
  id: string
  via_nombre: string
  via_tipo: string
  via_nombre_completo: string
  municipio: string
  municipio_id: string
  provincia: string
  provincia_id: string
  comunidad_autonoma: string
  comunidad_autonoma_id: string
  codigo_postal: string
  label: string
  lat?: number
  lon?: number
}

export interface SearchOptions {
  query: string
  perPage?: number          // default: 10
  filterByProvincia?: string  // filter_by: provincia_id:=28
  filterByMunicipio?: string
  filterByCP?: string
}

export interface SearchResult {
  records: AddressRecord[]
  total: number
  took_ms: number
}
```

- [ ] **2.4.2** Create `packages/core/src/search.ts` implementing `searchAddresses(client, options): Promise<SearchResult>`:

```typescript
// Query configuration rationale:
query_by: 'via_nombre,via_nombre_completo,municipio'
query_by_weights: '5,3,1'     // via_nombre is primary signal
prefix: true                   // enables "Gran V" → "Gran Vía"
typo_tokens_threshold: 1       // allows 1 typo per token
group_by: 'municipio_id'       // deduplicate same via across CPs in same city
group_limit: 3                 // show up to 3 CPs per (via, municipio) pair
num_typos: 1
drop_tokens_threshold: 1       // if no results, drop least important token
```

### Phase 2 Acceptance Check

```bash
# Typesense must be running (docker-compose, see Phase 4)
pnpm typesense:import --snapshot data/snapshots/callejero_2025-01.jsonl.gz
# ✓ Created collection callejero_es
# ✓ Imported 1,134,221 records (batch 100%)
# ✓ Verification queries passed

# Manual smoke test via Typesense API
curl "http://localhost:8108/collections/callejero_es/documents/search\
?q=Gran+Via&query_by=via_nombre&x-typesense-api-key=xyz"
# Returns >= 50 results across Spain
```

---

## Phase 3 — Autocomplete Widget

> **Why:** The widget is the primary consumer‑facing artifact. It must be truly
> framework‑agnostic (a standard custom element, usable from vanilla HTML),
> deliver typed wrappers for **React, Vue, and Angular**, be accessible, and
> configurable enough to integrate into any Spanish web app without framework
> lock‑in.

> **Tooling decision — StencilJS.** Given the explicit multi‑framework delivery
> goal (vanilla + React + Vue + Angular), Stencil is the best fit: it compiles to
> **dependency‑free standard custom elements** and its
> `@stencil/react-output-target`, `@stencil/vue-output-target`, and
> `@stencil/angular-output-target` generate **typed framework wrappers
> automatically** — far better DX than hand‑rolling CE + manual wrappers. The
> trade‑off is a toolchain divergence in `packages/widget` (Stencil CLI instead
> of the monorepo's tsup); accepted because the goal *is* multi‑framework
> delivery. (React wrapper mature; Vue good; Angular usable but less
> battle‑tested — acceptable.)

> **National‑scale redesign.** §3 was originally specced against Madrid‑only
> data (37k records). The national index now holds **749,261 records across 52
> provinces / 8,132 municipios**, which flips three assumptions — (a) result
> ambiguity explodes (`"Barcelona"` → 54k hits across provinces), (b) the primary
> result shape is **grouped by `municipio_id`** (already what `searchAddresses`
> returns), and (c) a 5‑digit input is almost always a **CP** and must route to
> `filter_by`, not full‑text. The widget is redesigned around these rather than
> ported verbatim.

### 3.1 — Core Web Component (`packages/widget`, StencilJS)

- [x] **3.1.1** Create `packages/widget/stencil.config.ts` + `src/address-search-es.tsx`. Custom element `<address-search-es>` compiled to standard custom elements (`externalRuntime: false` inlines the Stencil core runtime — no `@stencil/core` in the output bundle). Build outputs: `dist/components/` (custom-element bundle + types) + `dist/react/` (generated wrapper).
- [x] **3.1.2** Observed attributes (rethought for national scope):
  - `typesense-host` / `typesense-port` (8108) / `typesense-api-key` / `typesense-protocol` (http) — required host+key, rest defaulted.
  - `scope-provincia` (2‑digit CPRO, e.g. `28`) — pre‑filters by province; set explicitly or via `geolocate`.
  - `scope-municipio` (5‑digit INE `municipio_id`, e.g. `28079`) — further narrows results.
  - `detect-cp` (default: `true`) — if trimmed input matches `^\d{5}$`, route to `filterByCP` instead of a text `query`.
  - `geolocate` (default: `false`) — opt‑in; `getCurrentPosition` → resolves to bounding 2‑digit CPRO via a small bbox table, auto‑sets `scope-provincia`; dispatches `scope-changed`.
  - `placeholder` (default: `"Escribe una calle, municipio o código postal..."`).
  - `max-groups` (default: `8`) — cap on municipio groups rendered.
  - `group-limit` (default: `3`) — streets shown per group.
  - `debounce-ms` (default: `250`).
- [x] **3.1.3** Shadow DOM rendering (grouped, not flat): each **municipio** is a collapsible group header (bold top street + muted `municipio, provincia · CP`); up to `group-limit` streets indented beneath; hover/select at both levels. Loading spinner (CSS only); "No results" `"No se encontraron resultados para…"` echoing the query. `↑↓` traverses **across group boundaries** (groups are navigable containers); `Enter` selects the focused item; `Escape` closes + returns focus to input.
- [x] **3.1.4** Debounced call to `searchAddresses` from `@spain-address/core`; national mode always `group_by=municipio_id`. `detect-cp` routes 5‑digit input to the CP filter path. Cancel in‑flight fetch (via `AbortController`) per keystroke; `max-groups` + `group-limit` cap DOM cost despite 54k‑hit queries.
- [x] **3.1.5** Custom events: `address-selected` (detail: full `AddressRecord` incl. `municipio_id` + `provincia_id`); `address-cleared`; `scope-changed` (`{ provincia }`); `error` (`{ message, code }` for network/401).
- [x] **3.1.6** Accessibility: `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `aria-autocomplete="list"`, `aria-owns`; listbox `role="listbox"`, group headers `role="group"` with `aria-label`, items `role="option"`. Stencil a11y lint enforced.
- [ ] **3.1.7** Request `highlight_full` + `highlight_affix="«†»"` (opt‑in flag on `searchAddresses`) so the widget can bold the matched token inside `via_nombre` — cheap UX win on long national result lists.
- [ ] **3.1.8** Build: `stencil build` → custom‑element bundle + `react/vue/angular` output dirs. `packages/widget/package.json` exposes the CE entry + wrapper sub‑paths (`@spain-address/widget/react`, `/vue`, `/angular`); `react`/`vue`/`angular` are **peer deps of the wrappers only**.

### 3.2 — Framework Wrappers (Stencil‑generated)

- [x] **3.2.1** React output target (`@spain-address/widget/react`) → typed `AddressSearch` wrapper. Props: `typesenseHost`, `typesenseApiKey`, `typesensePort?`, `typesenseProtocol?`, `scopeProvincia?`, `scopeMunicipio?`, `detectCp?`, `geolocate?`, `maxGroups?`, `groupLimit?`, `perPage?`, `onSelect`, `onClear`, `onScopeChange`, `onError`.
- [ ] **3.2.2** Vue output target (`@spain-address/widget/vue`) + Angular output target (`@spain-address/widget/angular`) — same surface, framework‑idiomatic props / `v-model`.
- [ ] **3.2.3** Re‑export `AddressRecord`, `SearchHit`, `SearchResult` from `@spain-address/core` for typed selection callbacks with zero extra deps.
- [ ] **3.2.4** `packages/react` (existing hand‑rolled scaffold) is **superseded by** the Stencil‑generated React target — remove `packages/react/src/AddressSearch.tsx` once the generated wrapper is confirmed equivalent.

### 3.3 — Examples

- [ ] **3.3.1** `docs/examples/vanilla/index.html` — UMD bundle via `<script>` + a **province `<select>`** to demo scoping; `console.log` on selection.
- [ ] **3.3.2** `docs/examples/react/` (Vite `react-ts`) — `AddressSearch` from `@spain-address/widget/react`; selected `AddressRecord` rendered as a JSON card.
- [ ] **3.3.3** `docs/examples/vue/` — Vue 3 using `@spain-address/widget/vue`.
- [ ] **3.3.4** `docs/examples/angular/` — Angular 17+ using `@spain-address/widget/angular`.

### Phase 3 Acceptance Check

- [ ] Typing `"Calle Mayor"` → **grouped** dropdown (municipio headers → streets), first group = most relevant municipio, < 300 ms.
- [ ] Typing `28013` → **CP‑filtered** via `filter_by cp`.
- [ ] Province `<select>` cuts `"Barcelona"` from 54k hit → scoped instantly.
- [ ] `↑↓` crosses group boundaries; `Enter` fires `address-selected` with `municipio_id` + `provincia_id`.
- [ ] `Escape` closes dropdown, returns focus to input.
- [ ] `aria-expanded` toggles correctly (a11y tree verified).
- [ ] No host‑page style leak (scoped Shadow DOM CSS).
- [ ] Vanilla example works with a bare `<script>` tag; React/Vue/Angular examples render and type.

---

## Phase 4 — Developer Experience & Docker

> **Why:** The #1 barrier to OSS adoption is "time to first working demo". A `docker compose up` that boots Typesense with pre-loaded data in under 2 minutes eliminates that barrier entirely.

### 4.1 — Docker Compose

- [ ] **4.1.1** Create `docker/docker-compose.yml`:

```yaml
services:
  typesense:
    image: typesense/typesense:27.0
    restart: unless-stopped
    ports:
      - "8108:8108"
    volumes:
      - typesense_data:/data
      - ./typesense-seed:/seed:ro
    environment:
      TYPESENSE_DATA_DIR: /data
      TYPESENSE_API_KEY: ${TYPESENSE_API_KEY:-dev-key-xyz}
    command: >
      --data-dir /data
      --api-key ${TYPESENSE_API_KEY:-dev-key-xyz}
      --enable-cors

  seeder:
    image: node:20-alpine
    depends_on: [typesense]
    volumes:
      - ./typesense-seed:/app:ro
      - ../data/snapshots:/snapshots:ro
    working_dir: /app
    command: sh entrypoint.sh
    environment:
      TYPESENSE_HOST: typesense
      TYPESENSE_API_KEY: ${TYPESENSE_API_KEY:-dev-key-xyz}

volumes:
  typesense_data:
```

- [ ] **4.1.2** Create `docker/typesense-seed/entrypoint.sh`:
  - Waits for Typesense to be healthy (`/health` endpoint)
  - Checks if collection `callejero_es` already exists (skip re-import if it does)
  - If not: decompresses latest `.jsonl.gz` snapshot and runs import script
  - Prints `✓ Typesense ready with N address records`

- [ ] **4.1.3** Create `.env.example`:
  ```
  TYPESENSE_API_KEY=dev-key-xyz
  TYPESENSE_SEARCH_ONLY_KEY=search-only-key-xyz
  ```

### 4.2 — Developer Scripts (root `package.json`)

- [ ] **4.2.1** Add scripts:
```json
{
  "dev": "docker compose -f docker/docker-compose.yml up -d && turbo run dev",
  "etl": "pnpm --filter etl run start",
  "typesense:import": "pnpm --filter @spain-address/typesense run import",
  "typesense:drop": "pnpm --filter @spain-address/typesense run drop",
  "snapshot:latest": "node scripts/download-latest-snapshot.mjs"
}
```

- [ ] **4.2.2** Create `scripts/download-latest-snapshot.mjs` — downloads latest `.jsonl.gz` from GitHub Releases into `data/snapshots/` so developers don't need to run ETL themselves

### 4.3 — README Quick Start

- [ ] **4.3.1** Create `README.md` with a Quick Start section that gets a developer to working autocomplete in 5 commands:
```bash
git clone https://github.com/your-org/spain-address-autocomplete
cd spain-address-autocomplete
pnpm install
pnpm snapshot:latest          # downloads ~50MB pre-built dataset
docker compose -f docker/docker-compose.yml up   # boots + seeds Typesense
# Open docs/examples/vanilla/index.html in browser
```

### Phase 4 Acceptance Check

- [ ] `docker compose up` from clean state completes in < 3 minutes
- [ ] After seeder exits, `curl http://localhost:8108/health` returns `{ "ok": true }`
- [ ] Collection has > 500,000 records
- [ ] Running `docker compose up` a second time skips re-import (idempotent)
- [ ] `.env.example` clearly documents all required variables

---

## Phase 5 — CI/CD & Automated Data Refresh

> **Why:** The INE publishes new Callejero data every January and July. Without automation, this project rots — postal codes change, new streets are added, municipalities reorganize. Automation is what makes this sustainably open source rather than a point-in-time dataset.

### 5.1 — CI Pipeline (`.github/workflows/ci.yml`)

- [ ] **5.1.1** Trigger: `push` to `main`, `pull_request` to `main`
- [ ] **5.1.2** Jobs:
  - `typecheck` — `pnpm typecheck` across all packages
  - `lint` — `pnpm lint`
  - `build` — `pnpm build` (Turbo cache enabled)
  - `test` — `pnpm test` (unit tests for ETL normalization, search function)
  - `validate-snapshot` — downloads latest snapshot from releases, runs `pnpm etl validate`

### 5.2 — Data Refresh Workflow (`.github/workflows/data-refresh.yml`)

- [ ] **5.2.1** Trigger: `schedule: cron: '0 6 1 1,7 *'` (6am UTC on Jan 1 and Jul 1) + `workflow_dispatch` (manual trigger)
- [ ] **5.2.2** Steps:
  1. Checkout repo
  2. Setup Node 20 + pnpm
  3. Run `pnpm etl run --year $YEAR --month $MONTH`
  4. Run `pnpm etl validate` — abort if validation fails
  5. Upload `.jsonl.gz` as GitHub Release asset (tagged `data-YYYY-MM`)
  6. Open a Pull Request updating `metadata.json` + record count badge in README
  7. Notify via GitHub Issue if ETL fails (with error log attached)

### 5.3 — Release Workflow (`.github/workflows/release.yml`)

- [ ] **5.3.1** Trigger: `push` tag matching `v*`
- [ ] **5.3.2** Publishes `@spain-address/core`, `@spain-address/widget`, `@spain-address/react` to npm with `pnpm publish`
- [ ] **5.3.3** Generates GitHub Release notes from `CHANGELOG.md`

### 5.4 — Unit Tests

- [ ] **5.4.1** Test `normalize.ts`:
  - `"GRAN VIA"` → `"Gran Vía"`
  - `"CALLE DE LA PAZ"` → `"Calle de la Paz"` (article 'de la' not capitalized)
  - `"PASEO DE GRACIA"` → `"Paseo de Gracia"`
  - `normalizeForSearch("Gran Vía")` → `"gran via"`
- [ ] **5.4.2** Test `deduplicate.ts`: given 3 identical records (2 without coords, 1 with), returns 1 record with coords
- [ ] **5.4.3** Test `search.ts` (mocked Typesense client): verifies correct query parameters are passed
- [ ] **5.4.4** Minimum 80% line coverage across `packages/etl/src/transform/` and `packages/core/src/`

### Phase 5 Acceptance Check

- [ ] CI pipeline passes on a clean PR with no code changes
- [ ] `workflow_dispatch` on `data-refresh.yml` completes without error (test in staging with single province)
- [ ] All unit tests pass: `pnpm test`
- [ ] Coverage report shows ≥ 80% for transform + core packages

---

## Phase 6 — Documentation & OSS Release

> **Why:** A technically excellent project with poor documentation will not be adopted. OSS adoption is won or lost on how fast someone can go from "I found this" to "it works in my project". Documentation is not optional.

### 6.1 — Core Documentation

- [ ] **6.1.1** `README.md` — must include:
  - Project description + badge row (npm version, CI status, license, record count)
  - Quick Start (5 commands)
  - Widget usage (vanilla + React + Vue code blocks)
  - Configuration options table
  - Data attribution (IGN/CNIG CC BY 4.0)
  - Self-hosting guide
  - Contributing link

- [ ] **6.1.2** `docs/ARCHITECTURE.md` — full system diagram, data flow, schema design decisions, why Typesense

- [ ] **6.1.3** `docs/DATA_SOURCES.md` — each source with URL, license, update cadence, how it's used, attribution text

- [ ] **6.1.4** `CONTRIBUTING.md` — how to run locally, how to run ETL for a single province, PR conventions, issue templates

- [ ] **6.1.5** `CHANGELOG.md` — Keep-a-Changelog format, seeded with `[0.1.0] - Initial release`

### 6.2 — API Documentation

- [ ] **6.2.1** Generate TypeDoc from `packages/core/src/` → `docs/api/`
- [ ] **6.2.2** Add JSDoc to all public functions and interfaces in `@spain-address/core`

### 6.3 — GitHub Repository Setup

- [ ] **6.3.1** Add `LICENSE` file — MIT (for code). Note CC BY 4.0 applies to derived data artifacts.
- [ ] **6.3.2** Create GitHub Issue templates: `bug_report.yml`, `data_issue.yml`, `feature_request.yml`
- [ ] **6.3.3** Create `CODEOWNERS` file
- [ ] **6.3.4** Add repository topics: `spain`, `address`, `autocomplete`, `typesense`, `postal-code`, `open-data`, `ine`, `typescript`
- [ ] **6.3.5** Configure GitHub Discussions for Q&A category

### 6.4 — First Release Checklist

- [ ] All Phase 0–5 acceptance checks pass
- [ ] `pnpm build` produces `dist/` in all packages with no TypeScript errors
- [ ] `@spain-address/widget` CDN bundle < 30KB gzipped
- [ ] `@spain-address/react` bundle < 35KB gzipped (including web component)
- [ ] JSONL snapshot uploaded to GitHub Releases as `data-YYYY-MM`
- [ ] npm packages published: `@spain-address/core`, `@spain-address/widget`, `@spain-address/react`
- [ ] Docker image published to GHCR: `ghcr.io/your-org/spain-address-typesense:latest`

---

## Data Schema Reference

Complete `AddressRecord` as stored in Typesense:

```typescript
interface AddressRecord {
  // Identity
  id: string                    // "a3f1b2c4d5e6f7a8" (deterministic hash)

  // Via
  via_nombre: string            // "Gran Vía"          ← primary search field
  via_tipo: string              // "Calle"
  via_nombre_completo: string   // "Calle Gran Vía"    ← display + secondary search

  // Administrative
  municipio: string             // "Madrid"
  municipio_id: string          // "28079"             ← INE code (CPRO+CMUN)
  provincia: string             // "Madrid"
  provincia_id: string          // "28"
  comunidad_autonoma: string    // "Comunidad de Madrid"
  comunidad_autonoma_id: string // "13"

  // Postal
  codigo_postal: string         // "28013"

  // Display
  label: string                 // "Calle Gran Vía, Madrid (28013)"

  // Geo (optional, from CartoCiudad)
  lat?: number                  // 40.4200
  lon?: number                  // -3.7025
}
```

### Typesense Search Query Reference

```typescript
// Optimal query for address autocomplete
{
  q: userInput,
  query_by: 'via_nombre,via_nombre_completo,municipio',
  query_by_weights: '5,3,1',
  prefix: true,
  num_typos: 1,
  typo_tokens_threshold: 1,
  drop_tokens_threshold: 1,
  group_by: 'municipio_id',
  group_limit: 3,
  per_page: 10,
  // Optional filters:
  filter_by: 'provincia_id:=28',   // Restrict to Madrid
}
```

---

## Acceptance Criteria Summary

| Phase | Key Acceptance Criteria |
|---|---|
| 0 — Bootstrap | `pnpm install && pnpm build` exits 0 |
| 1 — ETL | Full pipeline produces validated JSONL > 500K records |
| 2 — Typesense | Import succeeds; "Gran Vía" returns ≥ 50 results |
| 3 — Widget | Autocomplete renders, keyboard nav works, events fire correctly |
| 4 — Docker | `docker compose up` → working search in < 3 minutes |
| 5 — CI/CD | All checks pass; data refresh runs on schedule |
| 6 — Docs | README quick-start works for a new developer in < 5 commands |

---

## Dependencies Summary

| Package | Purpose | License |
|---|---|---|
| `typesense` | Typesense JS client | Apache-2.0 |
| `iconv-lite` | ISO-8859-1 decoding | MIT |
| `commander` | CLI framework | MIT |
| `cli-progress` | Download progress bars | MIT |
| `tsup` | TypeScript bundler | MIT |
| `turbo` | Monorepo task runner | MIT |
| `vitest` | Unit testing | MIT |
| `typedoc` | API documentation | Apache-2.0 |

Zero runtime dependencies in `@spain-address/widget` and `@spain-address/core`.

---

*PRD Version 1.0.0 — Ready for Claude Code execution*  
*Data attribution: © Instituto Nacional de Estadística (INE) · © Instituto Geográfico Nacional (IGN/CNIG) CC BY 4.0*]