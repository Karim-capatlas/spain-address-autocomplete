# AGENTS.md

> **Working context.** This is the living agent guide for this repo. Read this
> file first — it contains everything you need to know about the codebase, the
> toolchain, and the current development state. Recognized by all major agent
> harnesses: GitHub Copilot, Claude Code, Cursor, etc.

## Project

`spain-address-autocomplete` — an **open-source MCP server** for Spanish address
normalization. Given noisy address text (e.g. from OCR'd DNI/TIE identity cards),
it returns structured fields: via type, street name, provincia (name + code),
municipio (name + code), and código postal.

It is the **address-normalization component** of a larger DNI/TIE OCR pipeline
(PaddleV6 + WebGPU, zero data retention, SES.HOSPEDAJES-compliant) that extracts
addresses from Spanish identity cards in-browser and normalizes them via MCP.

- **Stack:** TypeScript (strict) · ESM · pnpm 9 workspaces · Turborepo · TS 5.5 / Node 22 · Vitest 2 · tsup · ESLint (flat) · Prettier (`singleQuote`, no semis)
- **Data:** INE Callejero (`caj_esp_*.zip`) — 749,261 streets across 52 provinces, sourced from open government data
- **Current migration:** Typesense → **Upstash Redis Search** (Phase 3.5), with a new `packages/mcp/` MCP server wrapping `searchAddresses()` as `normalize_address` + `search_addresses` tools
- **State:** Phases 0–3 ✅ done & verified · **Phase 3.5 🚧 in progress** (Upstash + MCP) · Phases 4–6 🔲 not started

## Toolchain status (GREEN — do not regress)

Verified end-to-end on this machine:

```
pnpm typecheck   # 8/8 tasks (widget has no typecheck script — Stencil type-checks inside `stencil build`)
pnpm lint        # 7/7 tasks, 0 errors
pnpm build       # 8/8 tasks — widget included (`packages/widget`)
pnpm test        # 104 tests pass (10 files)
```

- Root `vitest.config.ts` (`include: packages/**/src/**/*.{test,spec}.*`, v8, thresholds 0.8)
- `eslint.config.mjs` is the flat-config version with `@typescript-eslint` + `eslint-plugin-eslint-comments`. **DO NOT** re-add `eslint-plugin-import` or `eslint-plugin-unicorn` — both were rejected: import@2.32 flat-config is incompatible with ESLint 10, and unicorn@55 `expiring-todo-comments` throws `TypeError` (109 real errors surfaced when wired). Lint stays green without them.
- `lefthook.yml` exists (pre-commit: typecheck+lint; pre-push: test). `lefthook install` has **not** been run — hooks are invoked via direct script calls instead.
- `.gitignore` excludes `packages/data/raw/` and `*.zip` (raw downloads are local-only, never committed).

## Phases

| Phase | Focus | Status |
|---|---|---|
| 0 | Monorepo bootstrap (workspaces, Turborepo, ESLint, Prettier, lefthook) | ✅ Done |
| 1 | ETL pipeline (INE parser, normalize, merge, dedupe, JSONL+gzip output) | ✅ Done & verified |
| 2 | Typesense schema + ingestion + search function (`packages/core`) | ✅ Done & verified |
| 3 | StencilJS widget (`<address-search-es>`, grouped/national‑aware) + React wrappers | ✅ Done (build green; core inlined; React target generated) |
| **3.5** | **Upstash Redis Search migration + MCP server** (`packages/mcp/`) | 🚧 In progress |
| 4 | Docker Compose + developer experience | 🔲 Not started |
| 5 | CI/CD (GitHub Actions) | 🔲 Not started |
| 6 | Documentation + OSS release | 🔲 Not started |

### Phase 3.5 — Upstash Redis Search + MCP server (IN PROGRESS)

This is the current focus. The goal: replace Typesense with Upstash Redis Search
and expose an MCP server.

**Schema migration map (Typesense → Upstash Redis Search):**
- `query_by` weights `5,3,1,1` → `TEXT via_nombre WEIGHT 5.0 ... TEXT via_nombre_completo WEIGHT 3.0 ... TEXT municipio WEIGHT 1.0 ... TEXT provincia WEIGHT 1.0`
- `infix: true` → `$smart` / `$fuzzy` query operators (Levenshtein distance 1–2 for OCR typo tolerance)
- `facet: true` on municipio_id/provincia_id/codigo_postal → `TAG` fields for exact-match filtering
- `group_by=municipio_id` → `AGGREGATE ... GROUPBY`
- `highlight: true` → `HIGHLIGHT` in SEARCH.QUERY

**MCP server plan (`packages/mcp/`):**
- stdio transport (spawnable by Claude Desktop / Cursor / parent OCR pipeline)
- Tool `normalize_address(text: string)` → single best structured match
- Tool `search_addresses(query: string, filters?)` → ranked matches
- Uses `searchAddresses()` from `@spain-address/core` (to be rewritten for Upstash)

### Phase 3 — Stencil widget (DONE)

`packages/widget` ships `<address-search-es>` as a self-contained Stencil custom
element plus generated React wrappers. `pnpm -F @spain-address/widget build` is
green and the package joins `pnpm build` (5/5).

**Key learnings / non-obvious fixes (do not redo):**

1. **`tsconfig.json` must NOT set `noEmit: true`.** The `@stencil/core@4.44.0`
   compiler drives the TS program via `ts.builder.emit` → `updateModule` (which
   populates `moduleMap`/`changedModules`) → `getComponentsFromModules`. With
   `noEmit: true` the internal emit produces **zero** files → `Transpiled
   modules: []` → empty `Components {}` → `@Component` never registered → the
   rollup `typescriptPlugin` (which only transpiles modules whose `cmps` is truthy)
   returns `null` → raw TSX reaches acorn → `Rollup: Parse Error: Expression
   expected` on `<div>`. Removing `noEmit` (Stencil type-checks via its own
   program regardless) fixed the whole pipeline.
2. The `@stencil/core@4.44.0` tarball in this environment is **stripped**: its
   CJS root is `exports.h = function () {};` and **`defineConfig` does not
   exist**. Therefore: `stencil.config.ts` must `export const config: Config = {@|
   }` (named export; Stencil unwraps `default` but `defineConfig` is absent);
   `Config` comes from `import type { Config } from '@stencil/core'`. The
   compiler/runtime (`@stencil/core/internal/client`) is intact, so builds work;
   only the public root is stubbed. If `defineConfig` is ever needed, the package
   must be re-fetched (tarball downloads here return 21-byte stubs, so the
   installed copy may be incomplete).
3. The sandbox cannot spawn Stencil's worker pool (silently yields 0 modules), so
   `maxConcurrentWorkers: 0` is set (in-process transpile/analyze).
4. `dist-custom-elements` with **`externalRuntime: false`** inlines
   `@stencil/core/internal/client` into the bundle (verified: `dist/components/index.js`
   has zero `@stencil/core` imports) — making the CE self-contained. react/react-dom
   are intentionally external (peer deps).
5. Externalization is configured via `rollupConfig.inputOptions.external` (the
   compiler reads `config.rollupConfig.inputOptions.external`), **not** `build.external`
   (the latter is ignored by `dist-custom-elements`).
6. `stencil.config.ts` MUST be **excluded** from `tsconfig.json` `include` (else
   `WARN: tsconfig.json should not reference stencil.config.ts`), and the
   component `.tsx` must use **inline `import('@spain-address/core').X`** for
   cross-package type imports (no `import type`/`export type` — the rollup TS
   plugin doesn't strip them and acorn parse-fails).
7. The widget `tsconfig.json` must declare **`experimentalDecorators: true` +
   `emitDecoratorMetadata: true`**. The stubbed `@stencil/core` root exports the
   decorators (`Component`/`Prop`/...) only as types in its `.d.ts`; `stencil build`
   injects legacy‑decorator support internally (so it type‑checks green), but a
   direct `tsc --noEmit` does not → every `@Prop`/`@State`/`@Event`/`@Element`
   fails with `TS1240: Unable to resolve signature of property decorator … undefined`.
   Adding the flags makes the widget `tsc --noEmit` clean too (editor + CLI agree).
8. `@stencil/react-output-target` (`reactOutputTarget`) is layered in; it emits
   `dist/react/components.ts` wrappers that `import React` (external peer) and
   the inlined CE from `@spain-address/widget/dist/components`.

**Current build outputs:** `dist/components/{address-search-es, index}.{js,d.ts}`
(core inlined), `dist/react/components.ts`, `dist/types/…`. `package.json` `exports`
exposes `.` (CE), `./react`, `./dist/*`.

### Phase 1 — ETL (DONE, with the real INE format)

This is the critical path that was fixed. The repo previously emitted **corrupt**
data: every `codigo_postal` was `00000`, every `municipio` was `Municipio 28xxx`,
streets were truncated to ~8 chars, and 80,337 raw TRAM rows collapsed to 1,026
records (the shared `00000` CP collapsed the dedup key).

**Two root causes were fixed:**
1. The old `parseTRAMLine` hardcoded `codigo_postal: '00000'` and read the street
   from `substring(90,120)` (wrong column → 8-char truncation). The real postal
   code is `line.slice(42, 47)` (CPOS).
2. Municipio/provincia/CCAA were placeholders because no reference file existed and
   `createMinimalMunicipiosMap()` returned an empty `Map`.

**Real INE Callejero format (verified against `caj_esp_012026.zip`, Jan 2026).** The
PRD §5 `.CAL` layout is **wrong** — the ZIP contains no `.CAL` files. It contains five
ISO-8859-1 fixed-width text files (decode with `iconv-lite`):

- **`TRAM`** (273 chars/row) — street segments, the **only** file carrying a postal
  code. 0-based slices: `CPRO[0:2]`, `CMUN[2:5]`, `CPOS[42:47]` (real 5-digit CP),
  `FVAR[61:69]` (date like `20251231`, rows not starting `20` are skipped),
  `NENTSIC[110:135]`, `NNUCLEC[135:160]`, `NVIAC[165:190]`, `DPSVIA[195:245]`.
  - `DPSVIA` non-empty → **SIMPLE-A** (street in DPSVIA, with type word).
  - else `NVIAC` non-empty & `NENTSIC` has no trailing grammatical article →
    **SIMPLE-B** (street in NVIAC; NENTSIC/NNUCLEC = municipio name).
  - else `NVIAC` non-empty & `NENTSIC` ends with an article
    `(LA|DEL|DE|EL|LOS|LAS|DE LA|DE LOS|DE LAS|DE EL)` → **TRANSITION**
    (street#1 in NENTSIC, street#2 in NVIAC → **two** records).
  - Trailing non-article parentheticals (`(FTA)`, `(KM.)`) are stripped; article
    parens (`(LA)`) are kept.
  - A via type is detected from the **leading type word** (`CALLE`, `AVDA`, `PLAZA`,
    `PASEO`, `RONDA`, `TRVA`, `CTRA`, `CMNO`/Camino, `CÑADA`, `PSAJE`, `BULEV`,
    `CARRE`, `PLZLA`, `LUGAR`, `AVIA`, `URB`, …) **only when followed by whitespace**,
    so compound names like `CAMINO-REGUERA` are not split. Codes map into the
    95-entry `VIA_TIPO_MAP` in `normalize.ts` (`01`=`Calle` …); unknown → `01`.
  - Degenerate names that are only an article group (`(DE LA)`, `(LA)`) are dropped.
- **`UP`** — the municipal master: `(CPRO, CMUN) → nombre` for **all 8,132**
  Spanish municipios (name at column 94). This is the **authoritative** municipio
  name source (TRAM's `NENTSIC/NNUCLEC` are contaminated with street tokens and the
  INE special marker `*DISEMINADO*`). Articulated names like `BOALO (EL)` are
  normalised to `El Boalo` by `formatMunicipioName`. Provincia/CCAA come from
  `provincias.ts` (`packages/etl/src/sources/provincias.ts`): Madrid (28) →
  provincia "Madrid", CCAA id `13` "Comunidad de Madrid".
- **`VIAS`/`PSEU`/`SECC`** — no clean CP/municipio table; not used for enrichment.

`buildMunicipiosMapFromZip(zipPath, provinces)` derives the full
`CPRO+CMUN → {nombre, provincia, comunidad_autonoma}` from `UP` inside the ZIP. A
user `--municipios <csv>` override (`CPRO,CMUN,NOMBRE,CPRO_NAME,CCAA,CCAA_NAME`) is
authoritative and wins; otherwise names are derived from `UP`. `createMinimalMunicipiosMap()`
was **removed** — there is no empty fallback; every record gets a real municipio name.

**Verification (Jan 2026, province 28):**
```
pnpm exec tsx packages/etl/src/index.ts run --year 2026 --month 1 --provinces 28 \
  --skip-download --output packages/etl/data/snapshots/callejero_2026-01_28.jsonl
# Parsed 88,228 raw records → 37,324 output records (>= tens of thousands)
pnpm exec tsx packages/etl/src/index.ts validate packages/etl/data/snapshots/callejero_2026-01_28.jsonl
# ✓ All validations passed  (no <500k warning for single province; 0 bad CPs)
```
Snapshot invariants (all hold):
- `codigo_postal` ∈ `28000..28991` (288 distinct), **0** `00000`/`0xx` records.
- 179 distinct `municipio` names (all real; e.g. `La Acebeda`, `Alcobendas`,
  `Alcalá de Henares`, `El Boalo`), **0** `Municipio 28xxx` placeholders, **0**
  `*DISEMINADO*` markers, **0** `Unknown` CCAA.
- Streets are full-length (no ~8-char truncation); `via_nombre` examples:
  `Acebeda (la)`, `Rozas de Madrid (Las)`, `Construcción (...)`.
- `callejero_2026-01_28.jsonl.gz` present and decompresses (1.07 MB).

**Regression guard in `validate`:** CP starting with `000` (the old collapse marker)
is now flagged as invalid. The record-count threshold is province-aware:
`>1,000` for a single-province snapshot, `>500,000` for multi-province/national.

---

### Phase 2 — Typesense backend + search function (DONE & verified)

The ETL output is now searchable. `packages/core` exposes a small Typesense
**HTTP client + `searchAddresses` wrapper**; `packages/typesense` owns the
`callejero_es` collection **schema** and the bulk-import **CLI**.

**Client design note:** the search layer talks to Typesense over its **REST API
via the Node 22 global `fetch`**, not the `typesense` JS SDK. The SDK's
`SearchParams<T, Infix>` generics are incompatible with this repo's `strict` +
`@typescript-eslint/no-explicit-any: error` lint config; a typed `fetch` wrapper
has zero transitive deps in the consumer tree and is fully mockable.

Key files:
- `packages/core/src/types.ts` — `AddressRecord`, `SearchOptions`, `SearchResult`,
  plus `SearchHit`/`SearchResponse` raw hit types.
- `packages/core/src/typesense.ts` — `createTypesenseClient` (env‑driven defaults:
  `api-key xyz` — the Homebrew `typesense-server` defaults), `host: 127.0.0.1`
  (IPv4 — `localhost`→`::1` is refused by the brew listener),
  typed `TypesenseClient` interface (health, create/drop collection, bulk import,
  search). **Caveat (Typesense 30.x):** documents are imported via `POST
  /collections/:name/documents/import` (the old `PUT` returns 404).
- `packages/core/src/search.ts` — `searchAddresses(query, {client, collection?})`
  mapping raw hits → `AddressRecord`, with `query_by=via_nombre,via_nombre_completo,municipio,provincia`
  (weights 5/3/1/1), `group_by=municipio_id`/`group_limit=3`, and a `filter_by`
  builder from `filterByProvincia`/`filterByMunicipio`/`filterByCP`.
- `packages/typesense/src/schema.ts` — `callejeroEsSchema` (facet fields on
  `municipio_id`/`provincia_id`/`codigo_postal`, `infix` on street names, a
  `location` geopoint + optional `lat`/`lon`). No `default_sorting_field`
  (Typesense 30.x rejects `_text_match`; it falls back to relevance).
- `packages/typesense/src/import.ts` — CLI: `--snapshot` (root-relative or
  absolute; `.jsonl` or `.jsonl.gz`), `--drop`, `--collection`, `--batch-size`,
  `--action`, plus `--host/--port/--protocol/--api-key`. Resolves `--snapshot`
  against the workspace root so it works from any cwd. `preimport` (`pnpm -r build`)
  guarantees a fresh core dist.

**Verified end-to-end (live brew `typesense-server` on 127.0.0.1:8108, api-key `xyz`):**
```
pnpm build                                  # fresh core dist (includes POST import fix + 127.0.0.1 host)
pnpm typesense:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop --batch-size 1000
# ✓ Created collection callejero_es | Records read: 749,261 | Indexed: 749,261 | Failed: 0   (national)
GET /collections/callejero_es  -> num_documents: 749,261  (national)
```
Search (via `searchAddresses` against the built core):
- `q:"Gran Vía"` → `total:131` (national); Madrid smoke `q:"Gran Vía"` → `total:14`,
  hits e.g. `Calle Gran Vía | Villalbilla | 28810 | Comunidad de Madrid`.
- `q:"Barcelona"` → `total:54,253`; `filterByCP:"28013"` → `93`.

## Packages

| Package | Purpose | Status |
|---|---|---|
| `packages/etl` | INE ZIP downloader, `TRAM` parser, `UP` municipio derivation, normalize/merge/dedupe, JSONL+gzip writer, CLI | ✅ Complete |
| `packages/core` | `AddressRecord`/`SearchOptions`/`SearchResult` types + Typesense REST client + `searchAddresses` | ✅ Complete (Phase 2, migrating to Upstash in Phase 3.5) |
| `packages/typesense` | `callejero_es` collection schema + bulk-import CLI (`import.ts`) | ✅ Complete (Phase 2) |
| `packages/widget` | **StencilJS** custom element `<address-search-es>` (grouped results, CP detection, province scoping) + generated React/Vue/Angular wrappers | ✅ Done |
| `packages/proxy` | Hono BFF proxy (`GET /api/address-search`, `GET /health`) — hides Typesense credentials from the browser | ✅ Complete |
| `packages/react` | **Superseded** — replaced by the Stencil‑generated React target (`@spain-address/widget/react`) | n/a |
| `packages/upstash` | **Upstash Redis Search** backend: FT.CREATE schema (TEXT weights 5/3/1/1 + TAG filters), REST client (zero-dep fetch, pipeline support), `searchAddressesUpstash` with fuzzy `%term%` queries, bulk-import CLI | 🚧 Phase 3.5 (code done, live import pending) |
| `packages/mcp` | **MCP server** — stdio JSON-RPC (`initialize`/`tools/list`/`tools/call`), `normalize_address` + `search_addresses` tools over `@spain-address/core` | 🚧 Phase 3.5 (code done, live verification pending) |

#### Phase 3.5 implementation notes (do not rediscover)

- `packages/upstash/src/search.ts` builds `FT.SEARCH <index> "@tag:{v} %word1% %word2%" …` — `%term%` is Redis Search's fuzzy operator (Levenshtein 1), standing in for Typesense's `num_typos`. Special chars in user terms are escaped.
- Upstash REST replies decode FT.SEARCH as a flat array `[total, key1, doc1, key2, doc2, …]`; docs may be flat `[field, value, …]` arrays or objects — `parseSearchReply` handles both. Grouping is done client-side (`groupRecords`) since AGGREGATE GROUPBY is deferred.
- Import stores each record as one hash (`HSET callejero:<id> data <jsonl-line>`); read path parses JSON back to `AddressRecord`.
- `packages/mcp/src/cli.ts` implements the MCP handshake minimally over newline-delimited JSON-RPC on stdio (no SDK dependency). Smoke-tested: `initialize`, `tools/list` respond correctly.
- Remaining for Phase 3.5 completion: provision Upstash (or local `redis-search` / REST server), run `pnpm upstash:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop`, verify live searches, and decide whether core's `searchAddresses` default flips from Typesense to Upstash.

### `packages/etl` — key files
- `src/index.ts` — `commander` CLI with `run` and `validate` subcommands.
- `src/sources/ine-callejero.ts` — `parseCallejeroZip` (TRAM), `parseTRAMLine`,
  `buildMunicipiosMapFromZip` (UP), `formatMunicipioName`, `RawRecord`.
- `src/sources/provincias.ts` — static `PROVINCIAS` (50 provinces + Ceuta/Melilla)
  with `getProvinciaInfo`. Madrid (28) → CCAA `13` "Comunidad de Madrid".
- `src/sources/ine-municipios.ts` — `parseMunicipiosCSV`/`loadMunicipiosFromFile`
  for the optional `--municipios` override.
- `src/sources/downloader.ts` — `downloadINECallejero` (URL
  `http://www.ine.es/prodyser/callejero/caj_esp/caj_esp_{MM}{YYYY}.zip`, idempotent).
- `src/sources/cnig-cartociudad.ts` — optional coordinate enrichment.
- `src/transform/{normalize,merge,deduplicate}.ts` — the transform layer.
- `src/output/jsonl-writer.ts` — streams `AddressRecord[]` → JSONL + `.gz`; gzip via
  `pipeline(createReadStream, createGzip, createWriteStream)`; `gzip_size_bytes`
  computed after the pipeline.

## Attribution

- **INE** (Callejero + Municipios/UP): © Instituto Nacional de Estadística. Credit
  in docs/metadata/UI: "© Instituto Nacional de Estadística (INE)". Source page:
  `https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390`.
- **CNIG CartoCiudad (CC BY 4.0):** credit "© Instituto Geográfico Nacional de España"
  in any UI displaying coordinates.

## Commands

```bash
pnpm install
pnpm typecheck      # 6/6
pnpm lint           # 0 errors
pnpm build          # 5/5
pnpm test           # 86 tests

# ETL
pnpm exec tsx packages/etl/src/index.ts run   --year 2026 --month 1 --provinces 28 \
  --skip-download --output packages/data/snapshots/callejero_2026-01_28.jsonl
pnpm exec tsx packages/etl/src/index.ts validate packages/data/snapshots/callejero_2026-01_28.jsonl

# Typesense (run `pnpm build` first — core's client ships in dist/; the
# `preimport` hook runs `pnpm -r build` automatically, so this is enough):
pnpm typesense:import -- --snapshot packages/data/snapshots/callejero_2026-01_28.jsonl.gz --drop
# then search via core: searchAddresses({ query: 'Gran Vía' }, { client: createTypesenseClient() })
```

## Important facts

- `municipio_id` is the 5-digit INE code = `CPRO` (2-digit province) + `CMUN` (3-digit
  municipality), e.g. Madrid city = `28079`.
- The `00000`-CP regression: the old parser hardcoded `00000`; `validateCP` rejects
  `000xx`, but `merge.ts` had an `&& raw.codigo_postal !== '00000'` escape hatch that
  let `00000` survive. With real CPs now, this never triggers; `validate` additionally
  flags any `000`-prefixed CP.
- Raw data (`packages/data/raw/`, `*.zip`) is gitignored and local-only in this repo.
- `data/municipios.csv` does **not** exist and no official fetchable URL was found;
  municipio names are derived from `UP` inside the INE ZIP.

## Local Typesense server setup (brew, no sudo)

The Homebrew `typesense-server@30.2` formula ships a config at
`/opt/homebrew/etc/typesense/typesense.ini` that points `data-dir` at
`/opt/homebrew/var/lib/typesense` — which is **root‑owned**, so the service
fails to start (`error 255`). Fix it **without sudo** by editing that
user‑writable config file (the formula default key is `jana`; aligned to `xyz`
to match this repo's client default):

```ini
[server]
api-address = 127.0.0.1
api-port = 8108
api-key = xyz
data-dir = /Users/<you>/typesense-data   # user-owned
log-dir = /Users/<you>/typesense-log
enable-cors = true
```
```bash
brew services restart typesense-server@30.2
curl -s http://127.0.0.1:8108/health   # {"ok":true}
```
The client defaults to `127.0.0.1:8108` (IPv4 — `localhost` resolves to IPv6
`::1` and gets `ECONNREFUSED` against the brew listener), key `xyz`, overridable
via `TYPESENSE_HOST`/`TYPESENSE_PORT`/`TYPESENSE_API_KEY`.
