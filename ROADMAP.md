# Roadmap

## North Star

> **Privacy-first Spanish ID address extraction: OCR a DNI/TIE card in-browser → normalize the address via MCP → structured fields (via, municipio, provincia, CP) — powered by Upstash Redis Search at 749K-record scale.**

## Guardrails ("Road-Rails")

| Rule                         | What it means                                                       |
| ---------------------------- | ------------------------------------------------------------------- |
| One MVP, two repos           | The MVP spans both repos but is ONE outcome: "OCR → normalized address" |
| Ship in 2 weeks, not 3 months | Each phase must produce a runnable, demoable artifact             |
| Every artifact ships to GitHub | No local-only work. If it's not pushed, it doesn't count.           |
| Phase gates, not parallel work | Finish Phase 1 before starting Phase 2.                             |
| Weekly checkpoint            | Every Friday: "What shipped? What's the demo?"                       |

---

## Phase 0 (DONE): Repository Setup & Public Foundation

**Goal:** Get `spain-address-autocomplete` live and public on GitHub.

- [x] `git init` + commit all phases 0-3
- [x] Push to `github.com/Karim-capatlas/spain-address-autocomplete` (public)
- [x] Write `README.md` with "System Context" section (MCP + DNI/TIE OCR pipeline)
- [x] Fix `package.json` (name, description, license, author, repo)
- [x] Fix pre-existing proxy test failure (non-deterministic `took_ms`, mismatched mock)

**Success:** Repo is live at https://github.com/Karim-capatlas/spain-address-autocomplete — 132 tests passing, typecheck green, lint clean.

---

## Phase 1 (Week 2): Upstash Redis Search + MCP Server MVP

**Goal:** `normalize_address("Calle Mayor, Madrid")` → `{ via_type: "Calle", via_name: "Mayor", provincia: "Madrid", ... }`

- [x] Define Redis Search schema (`FT.CREATE` — TEXT weights 5/3/1/1 + TAG filters, `packages/upstash/src/schema.ts`)
- [x] Write bulk-import script (JSONL/gzip → HSET; REST CLI + local RESP variant in `scripts/redis-import-verify.ts`)
- [x] Write `packages/mcp/` MCP server with `normalize_address` tool (+ `search_addresses`)
- [x] Upstash Redis Search backend implemented (`packages/upstash/src/{client,search}.ts`) alongside Typesense
- [x] All 132 tests pass; live-verified against a local RediSearch container with the full 749K-record dataset
- [x] **Cascade server** (`packages/cascade/`) — standalone Hono app replacing the external
  `geoapi.es` router; dedicated `cascade_es` index (52 provincias, ~8.1K municipios,
  10,127 CPs) derived from the same INE snapshot; 4 endpoints live-verified
- [x] Flip `@spain-address/core` default to the Redis Search backend (`createSearchClient()` prefers Upstash, falls back to Typesense)
- [ ] Optional: verify the REST client path with real Upstash Cloud credentials

**Success:** Standalone MCP server normalizes address strings using the real 749K-record dataset. ✅ Achieved locally (`docker compose up -d redisearch` → `pnpm --filter @spain-address/mcp start`).

---

## Phase 2 (Week 3): DNI/TIE OCR Integration MVP

**Goal:** The parent project calls the MCP server to get structured addresses.

- [ ] Parent project: integrate MCP client
- [ ] Mock OCR → real OCR integration (PaddleV6 + WebGPU)
- [ ] End-to-end: OCR → MCP → structured address
- [ ] README demo screenshot/GIF

**Success:** Screenshot showing: DNI/TIE image → OCR text → structured address fields.

---

## Phase 3 (Week 4): Docker + Visibility MVP

**Goal:** Anyone can run the MCP server with one command; publicly discoverable.

- [x] `docker-compose.yml` for the RediSearch backend (named volume, healthcheck)
- [x] `Dockerfile` for cascade server + compose service (port 3001→5978)
- [ ] `Dockerfile` for MCP server + compose service wiring
- [ ] GitHub Actions CI (lint + test + build)
- [ ] Publish to npm (optional)
- [ ] Blog post: "MCP + Upstash for Spanish ID OCR"

**Success:** One-command setup + green CI + a blog post linking to the repo.

---

## Phase 4+ (Week 5+): Polish & Job Hunt

**Goal:** Portfolio-quality showcase.

- [ ] More test coverage (OCR noise simulation)
- [ ] Claude Desktop / Cursor config examples in README
- [ ] Case study for Upstash blog (if accepted)
- [ ] Portfolio packaging ("Projects" section on resume/personal site)
