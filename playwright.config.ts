import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:8000',
    ...devices['Desktop Chrome'],
    headless: true,
  },
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:8000/examples/vanilla.html',
    timeout: 5000,
    reuseExistingServer: true,
  },
})
