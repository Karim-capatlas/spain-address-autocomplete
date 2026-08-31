# spain-address-autocomplete

**Servidor MCP de código abierto para la normalización de direcciones españolas.**
Dale texto de dirección ruidoso — p. ej. extraído por OCR de una tarjeta DNI/TIE —
y obtén campos estructurados: tipo de vía, nombre de calle, provincia (nombre +
código), municipio (nombre + código) y código postal.

Alimentado por un índice de **749.261 calles** del mapa español
([INE Callejero](https://www.ine.es/prodyser/callejero/), datos de dominio público,
snapshot 2026-01). El backend por defecto, auto-hospedable, es **Typesense**
(Docker local, HTTP/REST); **Upstash Redis Search** está disponible como opción
alternativa.

Demo en vivo: **https://calle.alami.es** (VPS OVH-1 detrás de un túnel de
Cloudflare: cascada provincia→municipio→CP en `:5978`, búsqueda difusa en `:8787`).

![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Node 22](https://img.shields.io/badge/Node-22-339933)
![MCP](https://img.shields.io/badge/protocol-MCP%20stdio-blueviolet)
![Tests](https://img.shields.io/badge/tests-138%20passing-brightgreen)
![Live demo](https://img.shields.io/badge/demo-calle.alami.es-33cc77)

> Aún no hay GIF — ejecuta `curl "https://calle.alami.es/api/address-search?q=gran%20via"` y verás 131 coincidencias para `Calle Gran Vía, …` en toda España. Esa es toda la funcionalidad en una sola petición.

_¿Inglés? [Leer este README en inglés](./README.en.md)._

## Qué hace

```jsonc
// Llamada a la herramienta MCP
{ "name": "normalize_address",
  "arguments": { "text": "C/ Gran via 12, 28013 Madrid" } }   // ← texto ruidoso de OCR

// Respuesta
{
  "via_tipo": "Calle",
  "via_nombre": "Gran Vía",
  "via_nombre_completo": "Calle Gran Vía",
  "municipio": "Madrid",        "municipio_id": "28079",
  "provincia": "Madrid",        "provincia_id": "28",
  "comunidad_autonoma": "Comunidad de Madrid",
  "codigo_postal": "28013",
  "label": "Calle Gran Vía, Madrid (28013)"
}
```

Se separan los números de portal (`C/ Mayor 12 3ºB` → `Calle Mayor`), un código
de 5 dígitos se detecta automáticamente como código postal, y la búsqueda difusa
(Levenshtein 1–2) tolera errores de OCR como `Grn Via` o `2801A`.

## Por qué existe

- **La geocodificación existente falla con OCR.** `geoapi.es` genera demasiados falsos positivos
  con texto ruidoso: ratea (1 req/s en el sandbox), necesita clave API y sirve datos de `2024.01`;
  el snapshot de INE de este repo es `2026-01`.
- **La geocodificación de pago es cara.** Google Places cuesta ~17 € por 1.000 peticiones por algo
  que los datos abiertos de España ya cubren.
- **La privacidad es un requisito.** El DNI/TIE contiene datos PII. Este servicio consulta un
  índice Typesense local — nunca se envía la dirección a ningún servicio externo, y la retención
  de datos es cero. Construido para cumplir **SES.HOSPEDAJES**.
- **Nadie había reunido el directorio callejero de INE en una herramienta lista para usar.**
  El Callejero INE es un ZIP de ancho fijo, ISO-8859-1, de cinco ficheros, que requiere un ETL
  no trivial — y ese trabajo está hecho aquí.

## Números verificados

| Métrica | Valor |
|---|---|
| Registros de calles (INE Callejero 2026-01) | 749.261 |
| Provincias / municipios / códigos postales | 52 / 8.106 / 10.127 |
| Importación de `callejero_es` (Typesense, 2 vCores — VPS OVH-1) | ~5–7 min |
| Verificación en vivo: `"Gran Vía"` (nacional) | 131 coincidencias |
| Verificación en vivo: CP `28013` + `"mayor"` | exactamente 1 — `Calle Mayor, Madrid` |
| Demo en vivo | https://calle.alami.es (Typesense + túnel Cloudflare) |
| Tests | 138 (13 archivos) |
| Toolchain | typecheck 9/9 · lint 0 errores · build 9/9 |

## Arquitectura

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  DNI/TIE OCR PIPELINE (proyecto padre — código abierto)                       │
│                                                                              │
│  [Navegador]                                                                  │
│   PaddleV6 + WebGPU (imagen de tarjeta de identidad)                          │
│       │                                                                        │
│       ▼                                                                        │
│   Texto OCR: "Calle Mayor, 28013 Madrid"                                       │
│       │                                                                        │
│       ├──── (1) Llamada MCP stdio ──► packages/mcp/                            │
│       │    normalize_address("Calle Mayor, 28013 Madrid")                      │
│       │    → @spain-address/core → Typesense (por defecto @127.0.0.1:8108)    │
│       │                           Upstash Redis Search (opcional: USE_UPSTASH=1)│
│       │    ←── { via_tipo, via_name, provincia, municipio, CP }                │
│       │                                                                        │
│       └──── (2) Llamada HTTP ───► packages/cascade/                            │
│          GET /api/geo/provincias                                               │
│          GET /api/geo/municipios?provincia=28                                  │
│          GET /api/geo/cps?municipio=28079                                      │
│          GET /api/geo/validate-cp?municipio=28079&cp=28001                     │
│          → cascade_es (colección Typesense, HTTP/REST)                         │
│          ←── opciones del desplegable                                          │
│                                                                              │
│  Fuente compartida: callejero_2026-01.jsonl.gz (749.261 filas INE)            │
│                                                                              │
│  [VPS OVH-1]──Túnel Cloudflare──► calle.alami.es                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

Tres formas de consumir el mismo dataset:

| Interfaz | Qué es | Docs |
|---|---|---|
| Servidor MCP | servidor MCP stdio con las herramientas `normalize_address` + `search_addresses` — para Claude Desktop, Cursor o cualquier agente MCP | [packages/mcp](./packages/mcp/README.md) |
| Servidor de cascada | API HTTP Hono (`packages/cascade/`) que reemplaza al router externo `geoapi.es`, sirviendo la cascada provincia→municipio→CP (búsquedas de sub-ms) | [packages/cascade](./packages/cascade/README.md) |
| Widget | Web Component Stencil `<address-search-es>` + wrapper React: resultados agrupados, detección automática de CP, ARIA completo, tema oscuro | [packages/widget](./packages/widget/README.md) |

## Inicio rápido

Requisitos: Node 22+, pnpm 9+, Docker.

```bash
git clone https://github.com/Karim-capatlas/spain-address-autocomplete
cd spain-address-autocomplete
pnpm install --frozen-lockfile

# 1. Generar el dataset desde datos abiertos del INE (el snapshot no está en git)
pnpm exec tsx packages/etl/src/index.ts run --year 2026 --month 1
#    → packages/data/snapshots/callejero_2026-01.jsonl.gz (~21 MB, 749.261 registros)

# 2. Iniciar el backend Typesense local (HTTP @127.0.0.1:8108, clave xyz)
docker compose up -d typesense
curl http://127.0.0.1:8108/health   # → {"ok":true}

# Selección de backend (automática): Typesense es el por defecto. Solo configura lo
# siguiente para cambiar el MCP/proxy a Upstash Redis Search (opcional):
#   export USE_UPSTASH=1
#   export UPSTASH_REDIS_REST_URL="https://<db>.upstash.io"
#   export UPSTASH_REDIS_REST_TOKEN="<token>"
```

### Demo A — servidor de cascada (todo local, sin cuenta cloud)

```bash
pnpm cascade:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop
pnpm --filter @spain-address/cascade start       # → http://localhost:5978

curl "localhost:5978/api/geo/provincias"                               # → 52 provincias
curl -G "localhost:5978/api/geo/municipios" --data-urlencode "provincia=28"   # → 179 municipios
curl "localhost:5978/api/geo/validate-cp?municipio=28079&cp=28013"     # → {"valid":true,"ineCode":"28079"}
```

### Demo B — servidor MCP (Typesense por defecto)

```bash
# Importar el índice de calles en Typesense (~5–7 min)
pnpm typesense:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop --batch-size 1000

# Ejecutar el servidor (JSON-RPC stdio por stdin/stdout)
pnpm --filter @spain-address/mcp start
```

`createSearchClient()` elige **Typesense** (local Docker en `127.0.0.1:8108`) por defecto;
Upstash solo cuando se define `USE_UPSTASH=1` **y** `UPSTASH_REDIS_REST_URL`/`TOKEN`.
La ruta Typesense está verificada en vivo contra `callejero_es` (749.261 documentos);
la ruta Upstash está cubierta por tests unitarios.

### Úsalo desde Claude Desktop

Por defecto = Typesense local (ejecuta `docker compose up -d typesense` en el equipo):

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "spain-address": {
      "command": "pnpm",
      "args": ["--filter", "@spain-address/mcp", "start"],
      "cwd": "/ruta/absoluta/a/spain-address-autocomplete",
      "env": {
        "TYPESENSE_HOST": "127.0.0.1",
        "TYPESENSE_PORT": "8108",
        "TYPESENSE_PROTOCOL": "http",
        "TYPESENSE_API_KEY": "xyz"
      }
    }
  }
}
```

Para usar **Upstash Redis Search** (nube) en su lugar, define `USE_UPSTASH=1` junto
con `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` en `env` y omite las claves
`TYPESENSE_*`; luego ejecuta `pnpm upstash:import` para poblar el índice.

Configuración de Cursor y esquemas completas de herramientas: [packages/mcp/README.md](./packages/mcp/README.md).

## Paquetes

| Paquete | Propósito |
|---|---|
| [`etl`](./packages/etl) | ETL del Callejero INE — parser ISO-8859-1 de ancho fijo (TRAM/UP) → JSONL+gzip normalizado (749K registros) |
| [`core`](./packages/core) | tipos `AddressRecord` + `searchAddresses()` (Typesense por defecto; Upstash opcional) + fábrica `createSearchClient()` |
| [`typesense`](./packages/typesense) | **Backend por defecto**: esquema Typesense + CLI de importación por lotes (`pnpm typesense:import`) |
| [`upstash`](./packages/upstash) | Esquema + CLI de importación para Upstash Redis Search (opt-in vía `USE_UPSTASH=1`, `pnpm upstash:import`) |
| [`mcp`](./packages/mcp) | servidor MCP stdio — `normalize_address` + `search_addresses` |
| [`cascade`](./packages/cascade) | servidor Hono (`/api/geo/*`) respaldado por la colección `cascade_es` de Typesense (HTTP/REST) |
| [`proxy`](./packages/proxy) | proxy BFF (`GET /api/address-search`) — mantiene las credenciales de búsqueda en el servidor |
| [`widget`](./packages/widget) | componente web Stencil `<address-search-es>` + wrapper React |
| [`data`](./packages/data) | Metadatos de snapshots |

## Desarrollo

```bash
pnpm typecheck   # 9/9 paquetes
pnpm lint        # 0 errores
pnpm build        # 9/9 paquetes
pnpm test         # 138 tests (13 archivos)
pnpm test:e2e     # Playwright (widget)
```

Stack: TypeScript (strict, ESM) · pnpm 9 workspaces · Turborepo · TS 5.5 / Node 22 ·
Vitest 2 · tsup · ESLint flat config · Prettier · Hono (BFFs) · Stencil (widget) ·
Typesense (almacen). Upstash Redis Search se mantiene como backend **opcional**
(`packages/upstash`).

## Documentación

- [docs/vps-deploy.md](./docs/vps-deploy.md) — **desplegar la demo en un VPS detrás de un túnel Cloudflare** (`calle.alami.es`)
- [PRODUCT.md](./PRODUCT.md) — enunciado del problema, decisiones de diseño, referencia de datos
- [ROADMAP.md](./ROADMAP.md) — plan fase por fase y estado actual
- [AGENTS.md](./AGENTS.md) — contexto técnico profundo para agentes de IA

## Atribución de datos

- **INE Callejero / Municipios (UP)** — © Instituto Nacional de Estadística (INE), [ine.es](https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390)
- **CNIG CartoCiudad (CC BY 4.0):** mencionar "© Instituto Geográfico Nacional de España" en cualquier UI que muestre coordenadas.

## Licencia

MIT (código). CC BY 4.0 para los datos derivados de CartoCiudad.
