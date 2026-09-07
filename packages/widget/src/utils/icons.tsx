/**
 * Inline SVG icon helpers shared by both widget components.
 *
 * Replaces the old text glyphs (✕ ✓ ▾ 📍) so the UI renders crisply at every
 * size and inherits `currentColor`. Each helper returns a single `<svg>` VNode;
 * callers wrap them in a button/span and own the accessible label.
 *
 * Stencil compiler constraint (AGENTS.md Phase 3): `h` is imported from the
 * non-public `@stencil/core/internal/client` subpath because the sandbox
 * compiler's synthetic `h`-injection is dormant. The eslint/ts-expect-error
 * dance below is required in every `.tsx`.
 */
/* eslint-disable @typescript-eslint/no-unused-vars -- `h` is the JSX factory (jsxFactory); consumed by the JSX→h() emit, not referenced as a value in TS source */
// @ts-expect-error -- no public .d.ts; global.d.ts declares a loose `h` + permissive JSX
import { h } from '@stencil/core/internal/client'
/* eslint-enable @typescript-eslint/no-unused-vars */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
} as const

/** ✕ — clear / dismiss. */
export function iconClear(): JSX.Element {
  return (
    <svg {...base} class="aes-icon">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

/** ✓ — selection confirmed. */
export function iconCheck(): JSX.Element {
  return (
    <svg {...base} class="aes-icon">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/** 📍 — geographic scope. */
export function iconPin(): JSX.Element {
  return (
    <svg {...base} class="aes-icon">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

/** ↻ — retry after an error. */
export function iconRetry(): JSX.Element {
  return (
    <svg {...base} class="aes-icon">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}
