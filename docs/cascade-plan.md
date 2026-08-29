# Cascade Server Plan

> **Status: ✅ Implemented.** Shipped as `packages/cascade/` in Phase 3.5. This document is
> kept for design history — see [`packages/cascade/README.md`](../packages/cascade/README.md)
> for the living documentation.

> **Standalone `provincia → municipio → código postal` cascade server**, backed by a
> dedicated `cascade_es` RediSearch index, replacing the external `geoapi.es` router
> the parent DNI/TIE form currently calls.
>
> Baseline: the old code this replaces is a Hono `geo` router (`export default geo`,
> mounted at `/geo`, reading `c.env.GEOAPI_KEY`) with four endpoints. It is **not in
> this repo's working tree** — it ships in the parent project. This plan builds the
> in-repo replacement and points the parent at it (new host/port; **no proxy changes**).

---

## 1. What we replace (the external geoapi.es router)

The parent form today calls these four routes, all proxying to `apiv1.geoapi.es`
with an API key and a 24h in-memory cache:

| Route | Returns | Notes |
|---|---|---|
| `GET /geo/provincias` | `[{ code:"01", name:"Álava" }]` | `code` = CPRO |
| `GET /geo/municipios?provincia=05` | `[{ code, name, cp:[] }]` | `code` = CPRO+CMUM (5-digit INE) |
| `GET /geo/cps?municipio=28079` | `[ "28001", … ]` | CPOS strings |
| `GET /geo/validate-cp?municipio=28079&cp=28001` | `{ valid, ineCode }` | `ineCode = municipio` when valid |

Problems with the old setup:

- External HTTP call on every cache miss; geoapi.es rate-limits (1 req/sec in
  sandbox) and needs a `GEOAPI_KEY` + sandbox/paid tier.
- 24h in-memory cache is lost on restart and serves stale data inside the TTL.
- No offline capability; the form cascade breaks without internet.
- We already hold the same underlying INE Callejero data the service proxies —
  the 2026-01 snapshot is more recent than geoapi.es's `update_date: 2024.01`.

---

## 2. Data sources (all in-repo already — no new downloads)

| Cascade doc | Source in repo | Cardinality (measured) |
|---|---|---|
| Provincia | `PROVINCIAS` in `packages/etl/src/sources/provincias.ts` | **52** |
| Municipio | `municipio_id` set from the JSONL snapshot (derive `name`/`provincia` from the same record) | **8,108** |
| CP → municipios | `codigo_postal` → `municipio_id` mapping built in one pass over the snapshot | **10,127** |

Snapshot: `packages/data/snapshots/callejero_2026-01.jsonl.gz` (749,261 records).

> **Counts are measured, not estimated.** Derived by streaming the real snapshot:
> `distinct provincia_id = 52`, `distinct municipio_id = 8,108`, `distinct
> codigo_postal = 10,127`. Earlier drafts quoting `8,132` municipios (the INE `UP`
> master total) and `~28K` CPs are wrong for this data set and are superseded.

> **Municipio-source note (evidence, not opinion).** The snapshot yields 8,108
> municipios with street records; the INE `UP` master lists 8,132 (24 have zero
> callejero records — e.g. Ceuta/Melilla and tiny rural municipios). We derive the
> cascade municipio list **from the snapshot** so the dropdown exactly matches
> searchable street data — a municipio with no streets is a dead end in the form.
> If you later want all 8,132, switch the source to `buildMunicipiosMapFromZip()`
> (authoritative, from `UP`); the gap is the 24 municipios with no street records.

---

## 3. Target: `cascade_es` index

A dedicated RediSearch index, separate from `callejero_es` (different hash prefix,
different schema, ~18K docs vs 749K — no collision, tiny footprint).

All docs share a `type` field. Hash key prefix `cascade:`.

#### Provincia (52 docs)
```json
{ "type": "provincia", "id": "01", "name": "Álava", "ccaa_id": "17", "ccaa_name": "País Vasco" }
```
Key: `cascade:p:01`

#### Municipio (8,108 docs)
```json
{ "type": "municipio", "id": "28079", "cpro": "28", "cmum": "079",
  "name": "Madrid", "ccaa_id": "13", "ccaa_name": "Comunidad de Madrid" }
```
Key: `cascade:m:28079`

#### CP (10,127 docs) — `municipios` is a multi-value TAG
```json
{ "type": "cp", "id": "28001", "municipios": ["28079", "28078"] }
```
Key: `cascade:cp:28001`

#### `FT.CREATE`
```
FT.CREATE cascade_es ON HASH PREFIX 1 cascade: SCHEMA
  TAG     id         // exact lookup by id — TAG, NOT TEXT (query syntax is @id:{…})
  TAG     type       // doc discriminator (provincia/municipio/cp)
  TEXT    name       // display name
  TAG     cpro       // municipios: filter by province
  TAG     ccaa_id    // optional region filter
  TAG     municipios // multi-value TAG on CP docs → list of municipio ids
```
- `id` is a **`TAG`**, matching the `@id:{…}` query form used by `/validate-cp`.
  (A `TEXT id` is wrong — it would be queried `@id:(…)` and allow partial matches.)
- `municipios` is a multi-value `TAG` (comma-separated values inside the hash);
  RediSearch splits it. `@municipios:{28079}` returns every CP containing that
  municipio — the same junction geoapi.es does internally.

---

## 4. Import CLI: `pnpm cascade:import`

`scripts/cascade-import.ts`. One pass over the snapshot; **reuses** the streaming
pattern already proven in `packages/upstash/src/import.ts` (gzip → readline) and the
new RESP client (see §5). No new external data.

```
For each snapshot line:
  provincias: from static PROVINCIAS (52) — emitted once
  municipios: Set<municipio_id> → {name, cpro, cmum, ccaa via provincias.ts join}
  cp-map:     Map<codigo_postal, Set<municipio_id>> → 10,127 CP docs
```

```bash
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop
# options: --url <redis://…> (default redis://127.0.0.1:6379), --batch-size <N>
```

- `--drop` → `FT.DROPINDEX cascade_es DD`.
- Batches pipelined (`multi`/pipeline) to keep round-trips low, like the upstash CLI.
- Idempotent index creation; writes hashes as **flat** fields (`HSET cascade:cp:28001 …`),
  matching how `callejero_es` is read back.

---

## 5. Standalone server: `packages/cascade/`

A small Hono app, **4 endpoints**, no fuzzy search, no `@spain-address/core`
dependency, no geoapi.es calls.

```
packages/cascade/
├── package.json      # deps: hono, ioredis
├── tsconfig.json
└── src/
    ├── index.ts      # Hono app + RESP client + 4 handlers (createApp(deps) for tests)
    └── redis.ts      # thin wrapper over ioredis `sendCommand(['FT.SEARCH', …])`
```

**Transport (RESP, decided):** the cascade server uses **`ioredis`** (new workspace
dependency) over RESP, not the Upstash REST client.
- Reads `CASCADE_REDIS_URL` (default `redis://127.0.0.1:6379`) → the docker-compose
  `redisearch` container **and** production both work.
- Bonus: Upstash Cloud exposes a RESP endpoint too (`rediss://<id>.upstash.io:6380`,
  token as password) — so the same RESP path targets Upstash Cloud in production,
  unlike the REST-only `createUpstashClient`, which cannot reach a raw RESP port.
- Redis Search commands go through `sendCommand`; the wrapper parses the flat
  `[total, key, doc, key, doc, …]` reply into records (reuse the parse logic from
  `packages/upstash/src/search.ts`'s `parseSearchReply`, adapted for the doc shape).

`createApp(deps)` mirrors the proxy's testability pattern: inject the Redis wrapper,
so the four handlers are unit-testable without a live Redis.

#### Endpoints — same contract as the old router (see §1)

**`GET /api/geo/provincias`**
```
FT.SEARCH cascade_es "@type:{provincia}" RETURN 3 id name ccaa_name
→ [{ code, name, ccaa }]   // 52, sorted by id
```

**`GET /api/geo/municipios?provincia=28`** — pad to 2 digits; 400 if missing.
```
FT.SEARCH cascade_es "@type:{municipio} @cpro:{28}" RETURN 2 id name
→ [{ code, name, ccaa }]   // ccaa resolved from provincia doc or cached map
```

**`GET /api/geo/cps?municipio=28079`** — 5-digit check; 400 otherwise.
```
FT.SEARCH cascade_es "@type:{cp} @municipios:{28079}" RETURN 1 id
→ [ "28001", … ]
```

**`GET /api/geo/validate-cp?municipio=28079&cp=28001`**
```
FT.SEARCH cascade_es "@type:{cp} @id:{28001}" RETURN 1 municipios
→ valid = municipios.includes("28079"); ineCode = valid ? municipio : null
```

**Contract deltas vs the old router (call this out in the parent's PR):**
- `/municipios` previously returned a `cp: []` field (always empty). **Dropped.**
- `/provincias` and `/municipios` now add a `ccaa` field (additive, safe).
- `/cps` and `/validate-cp` shapes are identical.

---

## 6. What changes and what stays

**Changes**
1. Add `packages/cascade/` (server) + `scripts/cascade-import.ts` (import CLI).
2. Add root scripts: `cascade:import`.
3. Add `ioredis` to the workspace (`packages/cascade`).
4. Add `cascade` service to docker-compose.
5. Parent project points its form at `http://cascade:3000/api/geo/…` directly.
   **No proxy changes** (proxy keeps its single job: `/api/address-search`).

**Stays**
- `packages/proxy/` — unchanged, single responsibility (fuzzy street search).
- `packages/etl/` — unchanged; already produces the snapshot the cascade needs.
- `@spain-address/core` / `packages/upstash` — untouched (cascade has no dep on them).
- The Upstash REST client is *not* reused here (transport mismatch, §5); the RESP
  import/verify pattern in `scripts/redis-import-verify.ts` is the precedent for the
  RESP path.

---

## 7. Deployment

### Docker Compose (recommended)
Add a `cascade` service sharing the existing `redisearch` container:
```yaml
services:
  redisearch:   # existing — 749K-street index (callejero_es)
  cascade:      # NEW — cascade server (cascade_es index)
    build: ./packages/cascade
    ports: ["3001:3000"]
    environment:
      CASCADE_REDIS_URL: redis://redisearch:6379
    depends_on: [redisearch]
  proxy:        # existing — fuzzy search proxy (unchanged)
```
Distinct hash prefixes (`callejero:` vs `cascade:`) and index names mean no collision.

### Standalone
`pnpm --filter @spain-address/cascade start` — reads `CASCADE_REDIS_URL`; run it
anywhere Redis/RESP is reachable (incl. Upstash Cloud `rediss://…:6380`).

---

## 8. Why this beats the old geoapi.es approach

| Before (geoapi.es via parent router) | After (cascade server + local Redis) |
|---|---|
| External HTTP call on every cache miss | Local Redis lookup — sub-ms, no network |
| `GEOAPI_KEY` + sandbox/paid tier required | No API key, no external service, free |
| 24h in-memory cache — stale inside TTL, lost on restart | Data in Redis — always current, survives restarts |
| No offline capability | Fully offline-capable (server + Redis only) |
| CP validation: fetch all CPs for a municipio, then `includes()` | Fetch the single CP doc, check `municipios` — fewer bytes |
| geoapi.es data freshness: `update_date 2024.01` | Our snapshot: **2026-01** — newer |
| geoapi.es rate limit 1 req/sec (sandbox) | No rate limit — your own Redis |

---

## 9. Optional enhancements (later)

**9.1 In-memory cache for provincias + municipios.** 52 + 8,108 static docs — load
once at startup, serve from memory; only `/cps` and `/validate-cp` hit Redis.

**9.2 Single JSON blob (corrected for real size).** Store the CP→municipios map as
one key (`cascade:cp-map`, **~10K** entries — trivially small) plus a precomputed
reverse map. `/cps` → one `GET`; `/validate-cp` → O(1). Simpler and faster than
10K search docs if you drop the TAG-query path.

**9.3 Static JSON files (zero-Redis cascade).** Dump `provincias.json`,
`municipios_by_cpro.json`, `cps_by_municipio.json` from the import; `readFileSync`
at startup. Pure static-file HTTP service. Re-import when the INE data refreshes
(biannual, same cadence as the street snapshot).

---

## 10. Out of scope

Deeper geoapi.es endpoints the form cascade doesn't need:

| endpoint | Why excluded |
|---|---|
| `GET /calles` | Street enumeration — proxy's fuzzy search covers this |
| `GET /poblaciones` | Populations within a municipio — not needed for the CP cascade |
| `GET /nucleos` | Urban cores / dissemination zones — not needed |
| `GET /comunidades` | CCAA derived from provincia data already |
| `GET /codigos_postales` | `/cps?municipio=` covers the cascade use case |

Same replacement pattern would apply later if any of these become needed:
derive from the INE data we hold, serve from our own index.

---

## 11. Verification

**Unit** — handlers via injected mock Redis wrapper: the four endpoint shapes, the
400 paths (missing/invalid `provincia`, non-5-digit `municipio`, missing `cp`), and
`/validate-cp` true+false.

**Live** — with `docker compose up -d redisearch`:
```bash
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop
# → 52 provincias | 8,108 municipios | 10,127 CPs
pnpm --filter @spain-address/cascade start
curl localhost:3001/api/geo/provincias            # → 52
curl "localhost:3001/api/geo/municipios?provincia=28"  # → >150 municipios
curl "localhost:3001/api/geo/cps?municipio=28079"      # → ["28001",…]
curl "localhost:3001/api/geo/validate-cp?municipio=28079&cp=28001"  # → {valid:true}
```

**Data invariants (guard in `validate`):** distinct counts match the snapshot
(52 / 8,108 / 10,127); every CP's `municipios` ids are 5-digit and exist in the
municipio set; no `00000` CPs.