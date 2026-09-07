/**
 * Shared dropdown option-list rendering for both widget components.
 *
 * `<address-search-es>` and `<address-cascade-es>`'s street step render the same
 * grouped result list (sticky non-interactive municipio section labels +
 * single-line options with a muted trailing CP). Extracting it here keeps the
 * markup, ARIA roles, and `<mark>` highlight parsing in one place.
 *
 * The `aes-*` class names are styled in BOTH component CSS files (each shadow
 * root needs its own copy — Stencil `styleUrl` is per-component).
 *
 * Stencil compiler constraint (AGENTS.md Phase 3): `h` from the non-public
 * internal/client subpath; cross-package types via inline `import()`.
 */
/* eslint-disable @typescript-eslint/no-unused-vars -- `h` is the JSX factory (jsxFactory); consumed by the JSX→h() emit */
// @ts-expect-error -- no public .d.ts; global.d.ts declares a loose `h` + permissive JSX
import { h } from '@stencil/core/internal/client'
/* eslint-enable @typescript-eslint/no-unused-vars */

type AddressRecord = import('@spain-address/core').AddressRecord
type SearchGroup = import('@spain-address/core').SearchGroup

/** Flatten all group items into a single option list (keyboard-nav order). */
export function flatItems(groups: SearchGroup[]): AddressRecord[] {
  const out: AddressRecord[] = []
  for (const g of groups) for (const it of g.items) out.push(it)
  return out
}

/** DOM id of the focused option (for `aria-activedescendant`), or undefined. */
export function activeOptionId(
  groups: SearchGroup[],
  focused: number,
  prefix: string,
): string | undefined {
  if (focused < 0) return undefined
  let flat = 0
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]
    for (let i = 0; i < g.items.length; i++) {
      if (flat === focused) return `${prefix}-i-${gi}-${i}`
      flat++
    }
  }
  return undefined
}

/** Render `via_nombre_completo` with Typesense's `<mark>`-wrapped matched tokens
 *  bolded. Falls back to the plain name when the hit carries no highlights. */
export function renderHighlighted(item: AddressRecord): (string | JSX.Element)[] {
  const snippet = item.highlights?.find((hl) => hl.field === 'via_nombre_completo')?.snippet
  if (!snippet) return [item.via_nombre_completo]
  const parts: (string | JSX.Element)[] = []
  const re = /<mark>(.*?)<\/mark>/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(snippet)) !== null) {
    if (m.index > last) parts.push(snippet.slice(last, m.index))
    parts.push(<mark>{m[1] ?? ''}</mark>)
    last = m.index + m[0].length
  }
  if (last < snippet.length) parts.push(snippet.slice(last))
  return parts
}

/**
 * Render the grouped option list.
 * @param groups   municipio groups from a search result
 * @param focused  flat index of the keyboard-focused option (-1 = none)
 * @param onSelect click/Enter handler for an option
 * @param prefix   id prefix (`aes` for the search widget, `ace` for the cascade)
 */
export function renderOptionGroups(
  groups: SearchGroup[],
  focused: number,
  onSelect: (item: AddressRecord) => void,
  prefix: string,
): JSX.Element[] {
  let flat = 0
  return groups.map((g, gi) => {
    const headerId = `${prefix}-h-${gi}`
    return (
      <div class="aes-group" key={`g-${gi}`} role="group" aria-labelledby={headerId}>
        <div id={headerId} class="aes-group-header" role="presentation">
          <span class="aes-group-via">{g.municipio || g.municipio_id}</span>
          <span class="aes-group-sub">
            {g.provincia}
            {g.codigo_postal ? ` · ${g.codigo_postal}` : ''}
          </span>
        </div>
        {g.items.map((it, i) => {
          const idx = flat++
          const isFocused = idx === focused
          return (
            <div
              key={`it-${gi}-${i}`}
              id={`${prefix}-i-${gi}-${i}`}
              class={{ 'aes-item': true, hi: isFocused }}
              role="option"
              aria-selected={isFocused ? 'true' : 'false'}
              aria-label={
                it.label || `${it.via_nombre_completo}, ${it.municipio} (${it.codigo_postal})`
              }
              onClick={() => onSelect(it)}
            >
              <span class="aes-label">{renderHighlighted(it)}</span>
              <span class="aes-item-cp">{it.codigo_postal}</span>
            </div>
          )
        })}
      </div>
    )
  })
}
