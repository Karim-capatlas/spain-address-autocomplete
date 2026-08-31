# Roadmap

## North Star

> **Privacy-first Spanish ID address extraction: OCR a DNI/TIE card in-browser → normalize the address via MCP → structured fields (via, municipio, provincia, CP) — powered by Typesense (local HTTP/REST) at 749K-record scale, with Upstash Redis Search available as an opt-in backend. Live demo: https://calle.alami.es.**

> **Numbering note:** this file is the weekly ship plan (Week 1 → 5+). The engineering phase numbers used in commits and the other docs — Phase 0–3 (bootstrap/ETL/Typesense/widget), Phase 3.5 (MCP + opt-in Upstash) — are tracked in [PRODUCT.md](./PRODUCT.md) §5.

## Guardrails ("Road-Rails")

| Rule                         | What it means                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| One MVP, two repos           | The MVP spans both repos but is ONE outcome: "OCR → normalized address" |
| Ship in 2 weeks, not 3 months | Each phase must produce a runnable, demoable artifact             |
| Every artifact ships to GitHub | No local-only work. If it's not pushed, it doesn't count.          |
| Phase gates, not parallel work | Finish Phase 1 before starting Phase 2.                            |
| Weekly checkpoint            | Every Friday: "What shipped? What's the demo?"                      |

---

## Week 1 (DONE): Repository Setup & Public Foundation

**Goal:** Get `spain-address-autocomplete` live and public on GitHub.

- [x] `git init` + commit all phases 0–3
- [x] Push to `github.com/Karim-capatlas/spain-address-autocomplete` (public)
- [x] Write `README.md` (system context + quick start)
- [x] Fix `package.json` (name, description, license, author, repo)
- [x] Fix pre-existing proxy test failure (non-deterministic `took_ms`, mismatched mock)

**Success:** Repo is live at https://github.com/Karim-capatlas/spain-address-autocomplete — **138 tests passing** (13 files), typecheck 9/9 green, lint 0 errors.

---

## Week 2 (DONE): MCP Server + Typesense-Default Store

**Goal:** `normalize_address("Calle Mayor, Madrid")` → `{ via_tipo: "Calle", via_nombre: "Mayor", provincia: "Madrid", … }`

- [x] Define `FT.CREATE` schema in `packages/upstash/` (TEXT weights 5/3/1/1 + TAG filters) — retained as the **opt-in** Upstash backend
- [x] Write bulk-import CLI (`pnpm upstash:import`) for the Upstash path
- [x] Write `packages/mcp/` stdio MCP server with `normalize_address` + `search_addresses` tools
- [x] Upstash Redis Search client in `packages/upstash/src/{client,search}.ts` (zero-dep fetch; REST path unit-tested only — no live cloud creds in repo)
- [x] **All 138 tests pass**; street search live-verified against local Typesense with the full 749,261-record dataset ("Gran Vía" → **131** national hits; CP-28013 + "mayor" → exactly `Calle Mayor, Madrid`)
- [x] **Cascade server** (`packages/cascade/`) — Hono app replacing the external `geoapi.es` router, backed by a `cascade_es` **Typesense** collection (HTTP/REST, so it's Worker- and Worker-Tunnel-reachable); 52 provincias, 8,106 municipios, 10,127 CPs; all 4 endpoints live-verified
- [x] `core`'s `createSearchClient()` set **Typesense as the default**; Upstash engaged only when `USE_UPSTASH=1` + `UPSTASH_REDIS_REST_URL`/`TOKEN` are set

**Success:** Standalone MCP server normalizes address strings against the real 749,261-record INE dataset using the default local Typesense store. ✅ Achieved (`docker compose up -d typesense` → `pnpm --filter @spain-address/mcp start`).

---

## Week 3: DNI/TIE OCR Integration MVP

**Goal:** The parent project calls the MCP server to get structured addresses.

- [ ] Parent project: integrate MCP client
- [ ] Mock OCR → real OCR integration (PaddleV6 + WebGPU)
- [ ] End-to-end: OCR → MCP → structured address
- [ ] README demo screenshot/GIF

**Success:** Screenshot showing: DNI/TIE image → OCR text → structured address fields.

---

## Week 4 (DONE): Docker + Deploy + Visibility

**Goal:** Anyone can run the MCP server with one command; publicly discoverable.

- [x] `docker-compose.yml` for the **Typesense** backend (named volume, healthcheck) — `callejero_es` (749,261) + `cascade_es` (18,285)
- [x] Cascade server `Dockerfile` + systemd unit (`spain-cascade`, :5978) on the VPS
- [x] Proxy BFF `Dockerfile` + systemd unit (`spain-proxy`, :8787)
- [x] Cloudflare Tunnel on `calle.alami.es` (dashboard-managed, CNAME auto-provisioned) — see `docs/vps-deploy.md`
- [x] Claude Desktop / Cursor config examples in `README.md`
- [ ] GitHub Actions CI (lint + test + build)
- [ ] Blog post: "Spanish address normalization with Typesense + MCP"

**Success:** One-command local setup (`docker compose up -d typesense` → MCP + cascade) and a live, public demo on `calle.alami.es`.

---

## Week 5+: Polish & Portfolio

**Goal:** Portfolio-quality showcase.

- [ ] More test coverage (OCR noise simulation)
- [ ] CI + biannual INE data-refresh cron (Jan 1 + Jul 1)
- [ ] npm publish (`@spain-address/core`, `@spain-address/mcp`)
- [ ] Portfolio packaging (projects section on personal site)
