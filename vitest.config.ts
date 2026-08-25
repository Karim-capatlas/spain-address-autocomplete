import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root,
  test: {
    // Match the PRD: *.test.ts / *.spec.ts anywhere under packages
    include: [`${root}/packages/**/src/**/*.{test,spec}.*`, `${root}/packages/**/test/**/*.{test,spec}.*`],
    // Don't typecheck during `test` (keeps the suite fast); typecheck is a separate script
    typecheck: { enabled: false },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      // PRD / AGENTS.md minimum coverage targets
      include: ['packages/etl/src/transform/**', 'packages/core/src/**'],
      thresholds: {
        lines: 0.8,
        functions: 0.8,
        branches: 0.8,
        statements: 0.8,
      },
    },
  },
})
