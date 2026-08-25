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

# Verify (Phase 0-3 — all green)
pnpm typecheck    # 6 packages, green
pnpm test         # 86 tests, passing
pnpm build        # 5 packages, builds

# Run MCP server (Phase 3.5 — coming soon)
# See packages/mcp/README.md for Docker setup
```

> Data snapshots are in `packages/data/snapshots/`. The live 749,261-record
> dataset is loaded into a Typesense/Redis Search collection.
> **Full product doc:** [PRODUCT.md](./PRODUCT.md)
> **Development context:** [AGENTS.md](./AGENTS.md)

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the phased plan:
- Phase 0-3 (done): ETL pipeline, Typesense schema, Stencil widget
- Phase 3.5 (next): Upstash Redis Search migration + MCP server
- Phase 4-6: Docker, CI/CD, docs + blog post

## License

MIT
