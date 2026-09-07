# `@spain-address/widget`

Two **zero-runtime-dependency, framework-agnostic** Spanish address web
components, built with StencilJS:

- **`<address-search-es>`** — a first-class address **combobox**. Normalizes noisy
  address text (e.g. OCR'd DNI/TIE cards) into structured results grouped by
  municipio, backed by the INE Callejero (749k streets / 52 provinces).
- **`<address-cascade-es>`** — a classical Spanish-administration **form**:
  Provincia → Municipio → Código postal → Calle, with the 5-digit INE municipio
  code computed in the background (never shown as a field).

Both share the same design tokens, three sizes, search controller, option-list
rendering, and "Powered by" + "Datos © INE" footer.

## Install

```bash
pnpm add @spain-address/widget
```

The package is self-contained: the Stencil runtime is **inlined** into the bundle
(`externalRuntime: false`), so consumers do **not** need `@stencil/core` at
runtime. `react` / `react-dom` are external peer dependencies (used only by the
generated React wrappers).

## Usage

### Vanilla (define the custom element)

Each component ships its own entry file with a `defineCustomElement()` that
registers just that element:

```html
<script type="module">
  import { defineCustomElement } from '@spain-address/widget/dist/components/address-search-es.js'
  defineCustomElement()
</script>

<address-search-es endpoint="/api/address-search"></address-search-es>
```

```html
<script type="module">
  import { defineCustomElement } from '@spain-address/widget/dist/components/address-cascade-es.js'
  defineCustomElement()
</script>

<address-cascade-es
  cascade-endpoint="/api/geo"
  endpoint="/api/address-search"
  name-prefix="addr"
></address-cascade-es>
```

> The package root entry (`@spain-address/widget`) currently auto-registers only
> `<address-search-es>`; import the per-component file (above) to register
> `<address-cascade-es>`. The generated React wrappers already import the
> per-component files, so they register both correctly.

### React (generated wrappers)

```tsx
import { AddressSearchEs, AddressCascadeEs } from '@spain-address/widget/react'

<AddressSearchEs
  endpoint="/api/address-search"
  size="md"
  detail="inline-card"
  onAddressSelected={(e) => console.log(e.detail)}
/>

<AddressCascadeEs
  cascade-endpoint="/api/geo"
  endpoint="/api/address-search"
  name-prefix="addr"
  onCascadeChanged={(e) => console.log(e.detail)}
  onAddressSelected={(e) => console.log(e.detail)}
/>
```

## Sizes

Both elements take `size="sm|md|lg"` (default **`sm`** = MUI Joy *small*),
reflected to the host. Input height / font / padding and menu row density scale
from size tokens.

| `size` | Input height | Font size |
|---|---|---|
| `sm` (default) | 32px | 0.875rem |
| `md` | 40px | 1rem |
| `lg` | 48px | 1rem |

---

## `<address-search-es>`

### Modes

| Mode | Attributes | When to use |
|---|---|---|
| **Proxy** ⚠️ recommended | `endpoint="/api/address-search"` | Production. The widget talks to your BFF (see `packages/proxy`), which holds the Typesense credentials server-side. |
| **Direct** | `typesense-host`, `typesense-port`, `typesense-api-key`, `typesense-protocol` | Local dev / trusted intranet. The API key is visible in page source — **never** ship to production. |

Proxy mode takes precedence whenever `endpoint` is set.

### Attributes

All attributes are reflected to the host (`reflect: true`).

| Attribute | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | `''` | Proxy BFF URL. Accepts `?q=&cp=&per_page=&group_limit=&provincia=&municipio=` and returns a `SearchResult` JSON. |
| `typesense-host` | `string` | `''` | Typesense host (direct mode). |
| `typesense-port` | `number` | `8108` | Typesense port (direct mode). |
| `typesense-api-key` | `string` | `''` | Typesense API key (direct mode only). |
| `typesense-protocol` | `'http' \| 'https'` | `'http'` | Direct-mode protocol. |
| `scope-provincia` | `string` | `''` | 2-digit CPRO to pre-scope (e.g. `"28"`). The scope chip shows the province **name**. |
| `scope-municipio` | `string` | `''` | 5-digit INE `municipio_id` to pre-scope. |
| `detect-cp` | `boolean` | `true` | A 5-digit query routes to the CP filter instead of text search. |
| `placeholder` | `string` | `'Escribe una calle...'` | Input placeholder. |
| `max-groups` | `number` | `3` | Max municipio groups rendered (Typesense `per_page`). |
| `group-limit` | `number` | `3` | Max streets per group (Typesense `group_limit`). |
| `debounce-ms` | `number` | `250` | Input debounce before issuing a search. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'sm'` | Control size (see Sizes). |
| `detail` | `'none' \| 'chip' \| 'inline-card'` | `'none'` | How the accepted selection is surfaced (see below). |
| `powered-by-href` | `string` | `'https://calle.alami.es'` | Footer backlink href (`target="_blank" rel="noopener"`). |
| `powered-by-label` | `string` | `'calle.alami.es'` | Footer backlink label. |

### Selection model & `detail`

Selecting an option **fills the input** with the record's `label` and shows an
inline ✓ (consistent with `setSelection`). The `detail` attribute then controls
what else is rendered:

- **`none`** (default) — just the filled input + inline ✓.
- **`chip`** — the legacy green confirmation chip below the input (with its own
  dismiss ✕).
- **`inline-card`** — a structured normalized-address card inside the widget:
  Calle / Número / Piso / Puerta / Portal / Bloque / Escalera / Municipio /
  Provincia / Código postal / Comunidad autónoma fields plus CPRO·CMUN·CCAA meta
  tags, with a dismiss ✕ that calls `clear()`. The Número/Piso/… rows only render
  when the typed query carried a "datos del domicilio" unit.

### Events

| Event | `detail` | Fires when |
|---|---|---|
| `addressSelected` | `AddressRecord` | A street is chosen. |
| `addressNormalized` | `DireccionNormalizada` | A street is chosen; carries the parsed "datos del domicilio" unit merged onto the `AddressRecord` (see below). |
| `addressCleared` | `void` | The query/selection is cleared. |
| `scopeChanged` | `{ provincia: string }` | The scope chip is removed. |
| `error` | `{ message: string; code?: number }` | A search/proxy error occurs. The menu **stays open** with an error row + "Reintentar". |

### "Datos del domicilio" (unit parsing)

The INE Callejero indexes street *vías* only — portal numbers are **not**
indexed. So when a street is selected, `<address-search-es>` runs core's
`parseDomicilio` over the typed query and merges the extracted unit onto the
match, emitting it via `addressNormalized` and rendering it in the inline-card:

- **`numero`** — e.g. `"12"`, `"259 D"` (a letter suffix stays on the number).
- **`piso`** — `"4º"`, `"Bajo"`, `"Entresuelo"`, `"Ático"`, `"Sótano"`.
- **`puerta`** — `"B"`, `"Izq"`, `"Dcha"`.
- **`portal` / `bloque` / `escalera` / `kilometros`** — e.g. `"2"`, `"3"`, `"1"`, `"4"`.
- **`sin_numero`** — true for `S/N` / `s/n` / `sin número`.
- **`unidad_raw`** — the lossless original unit substring (never normalized).
- **`confidence`** — `"exact"` (explicit markers) or `"parcial"` (positional
  heuristics).

`DireccionNormalizada` is `AddressRecord` plus these fields (all optional unit
values default to `null`, `sin_numero` to `false`).

### Public methods (`@Method`)

```ts
const el = document.querySelector('address-search-es')
await el.clear()                       // reset query, results, selection; refocus
const picked = await el.getSelection() // AddressRecord | null
await el.setSelection(record /* | null */) // host-driven set/clear (fills input)
```

---

## `<address-cascade-es>`

A vertical, label-above-control admin form. Every step is a typo-tolerant
autocomplete combobox; each step gates the next and changing an upstream step
resets everything downstream and fires `cascadeChanged`.

```
Provincia  →  Municipio  →  Código postal  →  Calle (scoped combobox)
```

- **Provincia** — autocomplete combobox from `GET {cascade-endpoint}/provincias`
  on load (sorted by code).
- **Municipio** — autocomplete combobox from
  `GET {cascade-endpoint}/municipios?provincia={CPRO}`. The returned `code` is
  **already the 5-digit INE id (CPRO+CMUN)** — stored in state, never displayed.
- **Código postal** — autocomplete combobox from
  `GET {cascade-endpoint}/cps?municipio={5-digit}`. If a municipio has exactly one
  CP, it is auto-selected.
- **Calle** — the shared street combobox (Typesense fuzzy search), disabled until
  a CP is resolved; searches hit `endpoint` with `municipio={id}` and `cp={cp}`
  filters.
- **Datos del domicilio** — free-text inputs for Número, Piso, Puerta, Portal,
  Bloque y Escalera (never indexed; carried in `cascadeChanged` / `getState` and
  the hidden inputs).

### Typo tolerance

The Provincia / Municipio / CP comboboxes match client-side with a
dependency-free fuzzy matcher (`src/utils/fuzzy.ts`) over the (tiny) fetched
lists, so every keystroke resolves instantly with no extra network calls:

- **Accent-insensitive** — `málaga`/`Málaga`/`malaga` all match `Málaga`.
- **Particle/stop-word aware** — `rozas` matches `Las Rozas de Madrid`;
  `boalo` matches `El Boalo`.
- **Typo tolerant** — `madriz` matches `Madrid`; `de la frntera` matches
  `De la Frontera` (Damerau-Levenshtein within a length-scaled threshold).
- **Prefix + code** — `barce` matches `Barcelona`; typing `28` or `28079`
  matches by INE code (leading-zero tolerant).

The Calle step uses the same Typesense fuzzy search as `<address-search-es>`
(`num_typos`, `prefix`, `infix`).

### Attributes

| Attribute | Type | Default | Description |
|---|---|---|---|
| `cascade-endpoint` | `string` | `''` | **Required.** Base URL of the cascade BFF, e.g. `/api/geo`. |
| `endpoint` | `string` | `''` | Street-search BFF URL (proxy mode) for the Calle step. |
| `typesense-host` / `-port` / `-api-key` / `-protocol` | — | — | Direct-mode Typesense for the Calle step (same as the search widget). |
| `size` | `'sm' \| 'md' \| 'lg'` | `'sm'` | Control size. |
| `name-prefix` | `string` | `''` | When set, renders hidden inputs (see below). |
| `powered-by-href` / `powered-by-label` | `string` | see search widget | Footer backlink on the Calle dropdown. |
| `debounce-ms` | `number` | `250` | Calle input debounce. |
| `placeholder` | `string` | `'Escribe una calle…'` | Calle input placeholder. |
| `detect-cp` | `boolean` | `false` | CP is an explicit field here, so query→CP detection is off by default. |
| `max-groups` / `group-limit` | `number` | `3` / `3` | Calle dropdown caps. |

### Events

| Event | `detail` | Fires when |
|---|---|---|
| `cascadeChanged` | `{ step, provincia_id, provincia, municipio_id, municipio, codigo_postal, ccaa, numero, piso, puerta, portal, bloque, escalera }` | After each step resolves (and when a unit field blurs). `step` is `'provincia' \| 'municipio' \| 'cp' \| 'street'`. |
| `addressSelected` | `AddressRecord` | A street is chosen (Calle step). |
| `addressCleared` | `void` | The Calle selection is cleared, or `clear()` is called. |
| `error` | `{ message: string; code?: number }` | A geo fetch or street search fails (also rendered inline per field). |

`cascadeChanged` always carries every code known so far, e.g. after the municipio
step:

```json
{
  "step": "municipio",
  "provincia_id": "28",
  "provincia": "Madrid",
  "municipio_id": "28079",
  "municipio": "Madrid",
  "codigo_postal": "",
  "ccaa": "Comunidad de Madrid",
  "numero": "",
  "piso": "",
  "puerta": "",
  "portal": "",
  "bloque": "",
  "escalera": ""
}
```

### Hidden inputs (`name-prefix`)

When `name-prefix="addr"` is set, the element renders these hidden inputs, kept
in sync with state:

```html
<input type="hidden" name="addr_provincia_id"  value="28" />
<input type="hidden" name="addr_municipio_id"  value="28079" />
<input type="hidden" name="addr_codigo_postal" value="28013" />
<input type="hidden" name="addr_via"           value="Calle Mayor, Madrid (28013)" />
<input type="hidden" name="addr_ccaa"          value="Comunidad de Madrid" />
<input type="hidden" name="addr_numero"        value="12" />
<input type="hidden" name="addr_piso"          value="4º" />
<input type="hidden" name="addr_puerta"        value="B" />
<input type="hidden" name="addr_portal"        value="" />
<input type="hidden" name="addr_bloque"        value="" />
<input type="hidden" name="addr_escalera"      value="" />
```

> **Shadow-DOM caveat:** these inputs live inside the element's shadow root, so
> they are **not** automatically submitted with an outer native `<form>`. Read
> them via `getState()` / the `cascadeChanged` event, or mirror them into
> light-DOM inputs on the host, if you need classic form POST submission.

### Public methods (`@Method`)

```ts
const el = document.querySelector('address-cascade-es')

await el.clear()                 // reset all four steps + the unit fields
const state = await el.getState()
// { provincia_id, provincia, municipio_id, municipio, codigo_postal, ccaa,
//   numero, piso, puerta, portal, bloque, escalera,
//   street: AddressRecord | null }
await el.setSelection(record)    // best-effort back-fill from an AddressRecord
```

---

## `AddressRecord` shape

```ts
{
  id: string
  via_tipo: string              // "Calle", "Avenida", …
  via_nombre: string            // "Mayor"
  via_nombre_completo: string   // "Calle Mayor"
  municipio: string             // "Madrid"
  municipio_id: string          // INE code, e.g. "28079"
  provincia: string             // "Madrid"
  provincia_id: string          // 2-digit CPRO, e.g. "28"
  comunidad_autonoma: string    // "Comunidad de Madrid"
  comunidad_autonoma_id: string
  codigo_postal: string         // 5-digit CP
  label: string                 // "Calle Mayor, Madrid (28013)"
  lat?: number
  lon?: number
  highlights?: { field: string; snippet: string; matches: number }[]
}
```

## Theming

Style either component with CSS custom properties on `:host` / the host element.
Dark mode is opt-in via `data-theme="dark"`.

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

Size tokens (`--aes-input-h`, `--aes-fs`, `--aes-pad`, `--aes-row-py`) are set by
the `size` attribute and can be overridden directly.

## Accessibility

- Combobox: `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant` for roving keyboard nav (ArrowUp/Down, Enter, Escape).
- Results are a `role="listbox"` of `role="group"` sections (sticky,
  **non-interactive** `aria-labelledby` headers) containing `role="option"` items
  with correct `aria-selected`.
- The footer "Powered by" link is tab-reachable and sits **outside** the listbox.
- An `aria-live="polite"` region announces the result count.
- Errors render in a `role="alert"` row with a "Reintentar" button (the menu stays
  open).

## Breaking changes (v2)

- **Selection no longer renders a chip by default.** The selected label now fills
  the input; the green chip is opt-in via `detail="chip"`. The structured card is
  `detail="inline-card"`.
- **"Ver todo" removed.** The footer no longer grows the result cap; `per_page`
  is always `max-groups`. The footer now shows the count + "Powered by" backlink +
  "Datos © INE".
- **Group headers are non-interactive** section labels (collapse toggling removed).
- Text glyphs (✕ ✓ ▾ 📍) replaced with inline SVG icons.

## Attribution

Data © Instituto Nacional de Estadística (INE). The footer renders the required
"Datos © INE" attribution alongside the configurable "Powered by" backlink.

## Development

```bash
pnpm --filter @spain-address/widget build   # stencil build (type-check + emit)
pnpm --filter @spain-address/widget dev     # stencil dev server
pnpm test:e2e                               # Playwright (needs Typesense + proxy up)
```

The Stencil compiler here is configured with `maxConcurrentWorkers: 0`
(in-process) and `externalRuntime: false` — see `AGENTS.md` §Phase 3 for the
rationale and gotchas (stripped `@stencil/core` root, `noEmit`, the `h`-from
-internal-client dance, inline `import()` types, etc.).
