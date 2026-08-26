# `@spain-address/widget`

`<address-search-es>` — a **zero-runtime-dependency, framework-agnostic**
Spanish address autocomplete web component, built with StencilJS and generated
from a single source component.

It normalizes noisy address text (e.g. OCR'd DNI/TIE cards) into structured
results **via type, street name, provincia + code, municipio + code, and
código postal**, backed by the INE Callejero (749k streets / 52 provinces).

Results are **grouped by municipio**; a 5-digit query is auto-routed to the CP
filter; groups are expandable and capped by `maxGroups`, growable via "Ver
todo".

## Install

```bash
pnpm add @spain-address/widget
# React wrappers are generated into @spain-address/widget/react
```

The package is self-contained: the Stencil runtime is **inlined** into the
bundle (`externalRuntime: false`), so consumers do **not** need `@stencil/core`
at runtime. `react` / `react-dom` are external peer dependencies (used only by
the generated React wrappers).

## Usage

### Vanilla (define the custom element)

```html
<script type="module">
  import { defineCustomElement } from '@spain-address/widget'
  defineCustomElement()
</script>

<address-search-es
  endpoint="/api/address-search"
  placeholder="Buscar calle, municipio o código postal…"
></address-search-es>
```

### React (generated wrapper)

```tsx
import { AddressSearchEs } from '@spain-address/widget/react'

<AddressSearchEs
  endpoint="/api/address-search"
  onAddressSelected={(e) => console.log(e.detail)}
/>
```

## Modes

| Mode | Attributes | When to use |
|---|---|---|
| **Direct** | `typesense-host`, `typesense-port`, `typesense-api-key`, `typesense-protocol` | Local dev / trusted intranet. The API key is visible in page source — **never** ship this to production. |
| **Proxy** ⚠️ recommended | `endpoint="/api/address-search"` | Production. The widget talks to your BFF (see `packages/proxy`), which holds the Typesense credentials server-side. The proxy returns the same JSON shape as `@spain-address/core`'s `SearchResult`. |

Direct mode takes precedence only when `endpoint` is **unset**; set `endpoint`
to switch to proxy mode.

## Attributes (props)

All attributes are reflected to the host (`reflect: true`) and configurable as
HTML attributes or property assignments.

| Attribute | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | `''` | Proxy BFF URL (proxy mode). When set, the widget fetches `?q=&cp=&per_page=&group_limit=&provincia=&municipio=` instead of hitting Typesense directly. |
| `typesense-host` | `string` | `''` | Typesense host (direct mode). |
| `typesense-port` | `number` | `8108` | Typesense port (direct mode). |
| `typesense-api-key` | `string` | `''` | Typesense API key (direct mode only). |
| `typesense-protocol` | `'http' \| 'https'` | `'http'` | Direct-mode protocol. |
| `scope-provincia` | `string` | `''` | 2-digit CPRO to pre-scope (e.g. `"28"`). |
| `scope-municipio` | `string` | `''` | 5-digit INE `municipio_id` to pre-scope (e.g. `"28079"`). |
| `detect-cp` | `boolean` | `true` | When `true`, a 5-digit query routes to the CP filter instead of text search. |
| `placeholder` | `string` | `'Escribe una calle...'` | Input placeholder. |
| `max-groups` | `number` | `8` | Max municipio groups rendered (Typesense `per_page`). |
| `group-limit` | `number` | `3` | Max streets per group (Typesense `group_limit`). |
| `debounce-ms` | `number` | `250` | Input debounce before issuing a search. |

## Events

| Event | `detail` | Fires when |
|---|---|---|
| `addressSelected` | `AddressRecord` | A street is chosen. |
| `addressCleared` | `void` | The query/selection is cleared. |
| `scopeChanged` | `{ provincia: string }` | The scope chip ("Quitar filtro") is removed. |
| `error` | `{ message: string; code?: number }` | A search/proxy error occurs. |

### `AddressRecord` shape

```ts
{
  id: string            // stable document id
  via_tipo: string      // "Calle", "Avenida", … (VIA_TIPO_MAP)
  via_nombre: string    // street name, e.g. "Mayor"
  via_nombre_completo: string // "Calle Mayor"
  municipio: string     // "Madrid"
  municipio_id: string  // INE code, e.g. "28079"
  provincia: string     // "Madrid"
  provincia_id: string  // 2-digit CPRO, e.g. "28"
  comunidad_autonoma: string   // "Comunidad de Madrid"
  comunidad_autonoma_id: string
  codigo_postal: string // 5-digit CP
  label: string         // human-readable, e.g. "Calle Mayor, Madrid (28013)"
  lat?: number
  lon?: number
  highlights?: { field: string; snippet: string }[]
}
```

## Public methods (`@Method`)

Host frameworks can drive the widget imperatively (no DOM poking internals):

```ts
const el = document.querySelector('address-search-es')

// Reset query, results, and selection; restore focus to the input.
await el.clear()

// Read the last accepted selection (null if none).
const picked = await el.getSelection() // AddressRecord | null

// Set/clear the selection programmatically (mirrors selecting an option,
// surfaces the confirmation chip, and mirrors the label into the input).
await el.setSelection(record /* AddressRecord | null */)
```

> `@Method` calls are async — Playwright's `locator.evaluate` and host code both
> await the returned promise. `clear()` emits `addressCleared`; `setSelection`
> is host-driven and does not re-emit `addressSelected` (the host already knows
> what it set).

## Modes: Typesense vs RedisSearch (RediSearch)

The `endpoint` (proxy) mode is **backend-agnostic**. The widget posts the same
`?q=…&cp=…&per_page=…` query and expects a `SearchResult`-shaped JSON body —
whether the BFF wraps Typesense or a RediSearch/Upstash index, the widget code
path is identical. So there is deliberately **no** `backend="redis"` attribute:
point `endpoint` at the proxy and the proxy owns the backend:

```html
<!-- Same attribute works whether the proxy hits Typesense or RedisSearch. -->
<address-search-es endpoint="/api/address-search"></address-search-es>
```

| Mode | Attributes | Backend | When |
|---|---|---|---|
| Direct | `typesense-host` / `-port` / `-api-key` / `-protocol` | Typesense (local) | Dev only — key is visible in page source. |
| Proxy | `endpoint="/api/address-search"` | Typesense **or** Upstash/RedisSearch (via `packages/proxy`) | Production. No credentials in the client. |

## Theming

Style the component with CSS custom properties on `:host` or the host element.
Dark mode is opt-in via `data-theme="dark"`:

```html
<address-search-es data-theme="dark" endpoint="/api/address-search"></address-search-es>
```

| Variable | Default (light) | Dark |
|---|---|---|
| `--joy-primary` | `67 90 210` | (shared) |
| `--joy-surface` | `#ffffff` | `#1f2531` |
| `--joy-surface-sub` | `rgba(0,0,0,.03)` | (shared) |
| `--joy-border` | `rgba(0,0,0,.12)` | `rgba(255,255,255,.14)` |
| `--joy-border-f` | `rgb(67 90 210 / .5)` | `rgb(147 197 255 / .45)` |
| `--joy-fg` | `#121826` | `#f1f5f9` |
| `--joy-fg-muted` | `#64748b` | `#94a3b8` |
| `--joy-skel` | `rgba(0,0,0,.06)` | `rgba(255,255,255,.12)` |
| `--joy-hover-bg` | `rgba(0,0,0,.03)` | `rgba(255,255,255,.06)` |

## Accessibility

- `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant` for roving keyboard navigation (ArrowUp/Down, Enter,
  Escape).
- An `aria-live="polite"` region announces the result count.
- Group headers are `role="button"` toggles (`aria-expanded`); expandable option
  lists are `<ul role="presentation">` containing `<li role="option">` — valid
  nesting under the `role="listbox"` menu.
- The menu is `aria-hidden` when closed and focuses the input on Escape.

## Development

```bash
pnpm --filter @spain-address/widget build   # stencil build (type-check + emit)
pnpm --filter @spain-address/widget dev     # stencil dev server
pnpm test:e2e                               # Playwright (needs typesense-server up)
```

The Stencil compiler in this repo is configured with `maxConcurrentWorkers: 0`
(in-process) and `externalRuntime: false` — see `AGENTS.md` §Phase 3 for the
rationale and gotchas (stripped `@stencil/core` root, `noEmit`, etc.).
