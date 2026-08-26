# spain-address-autocomplete

Open-source MCP server for Spanish address normalization. Given free-text
address input (e.g. from OCR'd DNI/TIE cards), it returns structured fields:
via type, street name, provincia (name + code), municipio (name + code),
and código postal.

Powered by **Upstash Redis Search** (migrating from Typesense) with a
**749,261-record** dataset sourced from Spain's INE open government data.

## System Context

`spain-address-autocomplete` is the **address normalization component** of a
larger **DNI/TIE OCR pipeline** (open-source, not yet publicly released).

The parent pipeline uses **PaddleV6 + WebGPU** to extract address text from
Spanish identity cards entirely in-browser (**zero data retention**), then
calls this MCP server to normalize the OCR-derived text into structured
fields. This replaces the insufficiently accurate `geoapi.es` service with
a local, offline-capable, privacy-first alternative — compliant with
Spain's **SES.HOSPEDAJES** requirements.

```
[Browser]                    [MCP Server (this repo)]      [Upstash Redis Search]
  │                                │                             │
  ├─ PaddleV6 + WebGPU OCR ─────→  │                             │
  │   (address text, zero retention)                          │
  │                                ├─ normalize_address() ──→ │
  │                                │   $fuzzy + $smart          │
  │                                ←── structured fields ────  │
  │  { via_type, via_name,          │                             │
  │    provincia, municipio, CP }   │                             │
```

## Tools (MCP)

| Tool | Description |
|---|---|
| `normalize_address(text)` | Takes OCR-derived address text; returns the single best structured match |
| `search_addresses(query, filters?)` | Ranked address matches by via name, municipio, provincia |

## Quick Start

```bash
# Clone + install
git clone https://github.com/Karim-capatlas/spain-address-autocomplete
cd spain-address-autocomplete
pnpm install

# Verify (Phase 0-3 + 3.5 code — all green)
pnpm typecheck    # 8 packages, green
pnpm test         # 104 tests, passing
pnpm build        # 8 packages, builds

# MCP server (Phase 3.5) — stdio JSON-RPC
pnpm --filter @spain-address/mcp start

# Load a snapshot into Upstash Redis Search (needs UPSTASH_REDIS_REST_URL/TOKEN)
pnpm upstash:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop
```

> Data snapshots are in `packages/data/snapshots/`. The live 749,261-record
> dataset is loaded into a Typesense/Redis Search collection.
> **Full product doc:** [PRODUCT.md](./PRODUCT.md)
> **Development context:** [AGENTS.md](./AGENTS.md)

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the phased plan:
- Phase 0-3 (done): ETL pipeline, Typesense schema, Stencil widget
- Phase 3.5 (code done, live-verified): Upstash Redis Search migration + MCP server —
  `normalize_address` / `search_addresses` served over stdio, 749K docs running in a local
  RediSearch container (`docker compose up -d redisearch`)
- Next: flip core's default backend to Redis Search; Dockerfile for the MCP server
- Then: CI/CD, npm publish, docs + blog post

## License

MIT
