import { test, expect, type Page } from '@playwright/test'

async function waitForWidget(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    typeof customElements !== 'undefined' &&
    customElements.get('address-search-es') !== undefined,
  )
}

test.describe('address-search-es widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/widget-example.html')
    await waitForWidget(page)
  })

  test('renders with a visible search input', async ({ page }) => {
    await expect(page.locator('address-search-es >> #aes-input')).toBeVisible()
  })

  test('street name query returns grouped municipio results', async ({ page }) => {
    const input = page.locator('address-search-es >> #aes-input')
    await input.fill('Calle Mayor')

    // 250ms debounce + network round-trip to Typesense
    await page.waitForSelector('address-search-es >> .aes-group', { timeout: 10000 })

    const headers = page.locator('address-search-es >> .aes-group-header')
    expect(await headers.count()).toBeGreaterThan(0)
  })

  test('5-digit query triggers CP mode', async ({ page }) => {
    const input = page.locator('address-search-es >> #aes-input')
    await input.fill('28013')

    await page.waitForSelector('address-search-es >> .aes-group', { timeout: 10000 })

    // The aria-label switches to "Código postal" in CP mode (render() line 342)
    await expect(input).toHaveAttribute('aria-label', 'Código postal')
  })

  test('clear button empties results', async ({ page }) => {
    const input = page.locator('address-search-es >> #aes-input')
    await input.fill('Calle Mayor')
    await page.waitForSelector('address-search-es >> .aes-group', { timeout: 10000 })

    await page.locator('address-search-es >> .aes-clear').click()
    await expect(page.locator('address-search-es >> .aes-group')).toHaveCount(0)
  })
})
