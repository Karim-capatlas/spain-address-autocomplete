import type { Config } from '@stencil/core'
import { reactOutputTarget } from '@stencil/react-output-target'

/**
 * Stencil config — Phase 3.
 *
 * `maxConcurrentWorkers: 0` runs the compiler's transpile/analyze in-process
 * (no worker threads) for reliability in sandboxed CI.
 *
 * `externalRuntime: false` on `dist-custom-elements` inlines the Stencil core
 * runtime (`@stencil/core/internal/client`) into the bundle, so the published
 * Custom Elements are self-contained (the consumer does NOT need @stencil/core).
 *
 * React wrappers are generated into `dist/react` (react/react-dom stay external
 * peers — they're imported by the generated wrappers, not bundled into the CE).
 */
export const config: Config = {
  maxConcurrentWorkers: 0,
  outputTargets: [
    { type: 'dist-custom-elements', externalRuntime: false },
    reactOutputTarget({
      outDir: 'dist/react',
      stencilPackageName: '@spain-address/widget',
    }),
  ],
}

export default config
