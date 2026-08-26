import { test, expect, type Page } from '@playwright/test'

async function waitForWidget(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    typeof customElements !== 'undefined' &&
    customElements.get('address-search-es') !== undefined,
  )
}

test.describe('address-search-es widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/vanilla.html')
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

  test('address selection shows a confirmation chip', async ({ page }) => {
    const input = page.locator('address-search-es >> #aes-input')
    await input.fill('Calle Mayor')
    await page.waitForSelector('address-search-es >> .aes-group', { timeout: 10000 })

    await page.locator('address-search-es >> .aes-item').first().click()
    // Chip carries the selected address label + remove affordance
    await expect(page.locator('address-search-es >> .aes-selected-label')).toBeVisible()
    await expect(page.locator('address-search-es >> .aes-selected-label')).toHaveText(
      /Calle Mayor/,
    )
    await expect(page.locator('address-search-es >> button[aria-label*="Quitar"]')).toBeVisible()
  })

  test('public clear() empties the listbox and input (host imperative API)', async ({ page }) => {
    const box = page.locator('address-search-es')
    const input = box.locator('#aes-input')
    await input.fill('Calle Mayor')
    await page.waitForSelector('address-search-es >> .aes-group', { timeout: 10000 })

    // Hosts must be able to reset the widget without poking its internals.
    // Stencil @Method returns a Promise — Playwright awaits the returned promise.
    await box.evaluate((el: Element) =>
      (el as unknown as { clear: () => Promise<void> }).clear(),
    )
    await expect(box.locator('.aes-group')).toHaveCount(0)
    await expect(input).toHaveValue('')
  })

  test('host can set + clear the selection via the imperative API', async ({ page }) => {
    const box = page.locator('address-search-es')
    const input = box.locator('#aes-input')
    const setSelection = (record: unknown) =>
      box.evaluate(
        (el: Element, r: unknown) =>
          (el as unknown as { setSelection: (r: unknown) => Promise<void> }).setSelection(r),
        record,
      )

    const fake = {
      id: 'test-1',
      via_nombre: 'Mayor',
      via_tipo: 'Calle',
      via_nombre_completo: 'Calle Mayor',
      municipio: 'Madrid',
      municipio_id: '28079',
      provincia: 'Madrid',
      provincia_id: '28',
      comunidad_autonoma: 'Comunidad de Madrid',
      comunidad_autonoma_id: '13',
      codigo_postal: '28013',
      label: 'Calle Mayor, Madrid (28013)',
    }

    await setSelection(fake)
    // Selection surfaces as an inline chip and the input mirrors the label.
    await expect(box.locator('.aes-selected-label')).toHaveText('Calle Mayor, Madrid (28013)')
    await expect(input).toHaveValue('Calle Mayor, Madrid (28013)')

    // A null selection clears the chip + input, same as clear().
    await setSelection(null)
    await expect(box.locator('.aes-selected-chip')).toHaveCount(0)
    await expect(input).toHaveValue('')
  })
})
