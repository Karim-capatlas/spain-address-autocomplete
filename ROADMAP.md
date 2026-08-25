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

**Success:** Repo is live at https://github.com/Karim-capatlas/spain-address-autocomplete — 86 tests passing, typecheck green, lint clean.

---

## Phase 1 (Week 2): Upstash Redis Search + MCP Server MVP

**Goal:** `normalize_address("Calle Mayor, Madrid")` → `{ via_type: "Calle", via_name: "Mayor", provincia: "Madrid", ... }`

- [ ] Define Redis Search schema (`SEARCH.CREATE`)
- [ ] Write bulk-import script (JSONL → Redis JSON)
- [ ] Write `packages/mcp/` MCP server with `normalize_address` tool
- [ ] Migrate `packages/core/src/search.ts` to use Upstash Redis
- [ ] All 77 tests pass with Redis Search backend

**Success:** Standalone MCP server normalizes address strings using the real 749K-record dataset.

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

- [ ] `Dockerfile` for MCP server
- [ ] `docker-compose.yml` (MCP + Redis Search)
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
