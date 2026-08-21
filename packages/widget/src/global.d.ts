/**
 * Global JSX surface for the Stencil widget component.
 *
 * The installed `@stencil/core` (4.44.0) only re-exports the JSX `h` pragma and
 * module‑scoped types; it does not provide a GLOBAL `JSX` namespace + global
 * `h` factory here. Stencil's built‑in type‑check compiles the component TSX with
 * the project tsconfig (`jsx:"react"`, `jsxFactory:"h"`), which needs exactly
 * those globals. We declare a minimal, permissive version so `<div>`,
 * `<input ref={...}>`, etc. type‑check without importing anything.
 *
 * `@types/react` is intentionally NOT listed in `tsconfig.json` `types`, so its
 * global `JSX` namespace is not loaded here — avoiding a duplicate‑namespace
 * clash and keeping the widget framework‑agnostic.
 */
import type { VNode } from '@stencil/core'

declare global {
  namespace JSX {
    type Element = VNode | VNode[] | null
    interface ElementChildrenAttribute {
      children: { type: unknown }
    }
    interface IntrinsicElements {
      [elemName: string]: Record<string, unknown> | null
    }
  }
  function h(
    sel: unknown,
    data?: Record<string, unknown> | null,
    ...children: unknown[]
  ): VNode
}

export {}
