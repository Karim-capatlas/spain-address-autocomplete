import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Widget e2e — `<address-search-es>` v2 contract.
 *
 * The search endpoint is mocked with a deterministic `SearchResult` fixture so
 * the suite is hermetic (no live Typesense/proxy required) and the assertions
 * target the UI contract, not backend data. The cascade geo endpoints are mocked
 * too, since vanilla.html also mounts `<address-cascade-es>` (which fetches
 * provincias on load).
 */

const FIXTURE = {
  records: [],
  groups: [
    {
      municipio_id: '28079',
      municipio: 'Madrid',
      provincia: 'Madrid',
      provincia_id: '28',
      codigo_postal: '28013',
      found: 2,
      items: [
        {
          id: '1',
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
          highlights: [{ field: 'via_nombre_completo', snippet: 'Calle <mark>Mayor</mark>', matches: 1 }],
        },
        {
          id: '2',
          via_nombre: 'Mayor Alta',
          via_tipo: 'Calle',
          via_nombre_completo: 'Calle Mayor Alta',
          municipio: 'Madrid',
          municipio_id: '28079',
          provincia: 'Madrid',
          provincia_id: '28',
          comunidad_autonoma: 'Comunidad de Madrid',
          comunidad_autonoma_id: '13',
          codigo_postal: '28014',
          label: 'Calle Mayor Alta, Madrid (28014)',
        },
      ],
    },
    {
      municipio_id: '28001',
      municipio: 'Alcalá de Henares',
      provincia: 'Madrid',
      provincia_id: '28',
      codigo_postal: '28801',
      found: 1,
      items: [
        {
          id: '3',
          via_nombre: 'Mayor',
          via_tipo: 'Calle',
          via_nombre_completo: 'Calle Mayor',
          municipio: 'Alcalá de Henares',
          municipio_id: '28001',
          provincia: 'Madrid',
          provincia_id: '28',
          comunidad_autonoma: 'Comunidad de Madrid',
          comunidad_autonoma_id: '13',
          codigo_postal: '28801',
          label: 'Calle Mayor, Alcalá de Henares (28801)',
        },
      ],
    },
  ],
  total: 3,
  took_ms: 4,
}

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

async function waitForWidget(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof customElements !== 'undefined' && customElements.get('address-search-es') !== undefined,
  )
}

async function search(page: Page, q = 'Calle Mayor'): Promise<void> {
  const input = page.locator('address-search-es >> #aes-input')
  await input.fill(q)
  await page.waitForSelector('address-search-es >> .aes-item', { timeout: 10000 })
}

test.describe('address-search-es widget (v2)', () => {
  test.beforeEach(async ({ page }) => {
    // Hermetic cascade geo (vanilla.html mounts <address-cascade-es>).
    await page.route('**/api/geo/**', (route: Route) => route.fulfill(json([])))
    // Deterministic search results.
    await page.route('**/api/address-search*', (route: Route) => route.fulfill(json(FIXTURE)))
    await page.goto('/examples/vanilla.html')
    await waitForWidget(page)
  })

  test('renders with a visible search input', async ({ page }) => {
    await expect(page.locator('address-search-es >> #aes-input')).toBeVisible()
  })

  test('street name query returns grouped municipio results', async ({ page }) => {
    await search(page)
    const groups = page.locator('address-search-es >> .aes-group')
    await expect(groups).toHaveCount(2)
    await expect(page.locator('address-search-es >> .aes-group-header').first()).toContainText('Madrid')
  })

  test('5-digit query triggers CP mode', async ({ page }) => {
    const input = page.locator('address-search-es >> #aes-input')
    await input.fill('28013')
    await page.waitForSelector('address-search-es >> .aes-item', { timeout: 10000 })
    await expect(input).toHaveAttribute('aria-label', 'Código postal')
  })

  test('clear button empties results', async ({ page }) => {
    await search(page)
    await page.locator('address-search-es >> .aes-clear').click()
    await expect(page.locator('address-search-es >> .aes-group')).toHaveCount(0)
    await expect(page.locator('address-search-es >> #aes-input')).toHaveValue('')
  })

  test('selection fills the input with the label (detail=none default)', async ({ page }) => {
    await search(page)
    await page.locator('address-search-es >> .aes-item').first().click()
    // No chip by default — the label fills the input and the menu closes.
    await expect(page.locator('address-search-es >> #aes-input')).toHaveValue(
      'Calle Mayor, Madrid (28013)',
    )
    await expect(page.locator('address-search-es >> .aes-selected-chip')).toHaveCount(0)
  })

  test('detail="chip" renders the legacy confirmation chip', async ({ page }) => {
    const box = page.locator('address-search-es')
    await box.evaluate((el: Element) => el.setAttribute('detail', 'chip'))
    await search(page)
    await page.locator('address-search-es >> .aes-item').first().click()
    const chip = page.locator('address-search-es >> .aes-selected-label')
    await expect(chip).toBeVisible()
    await expect(chip).toHaveText('Calle Mayor, Madrid (28013)')
    await expect(page.locator('address-search-es >> button[aria-label*="Quitar"]')).toBeVisible()
  })

  test('detail="inline-card" renders the structured address card', async ({ page }) => {
    const box = page.locator('address-search-es')
    await box.evaluate((el: Element) => el.setAttribute('detail', 'inline-card'))
    await search(page)
    await page.locator('address-search-es >> .aes-item').first().click()
    const card = page.locator('address-search-es >> .aes-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Calle Mayor')
    await expect(card).toContainText('28013')
    await expect(card).toContainText('Comunidad de Madrid')
    // CPRO·CMUN·CCAA meta tags
    await expect(card.locator('.aes-tag')).toHaveCount(3)
  })

  test('error keeps the menu open with a visible error row + retry', async ({ page }) => {
    // Registered after beforeEach → takes precedence and fails the request.
    await page.route('**/api/address-search*', (route: Route) => route.abort())
    const input = page.locator('address-search-es >> #aes-input')
    await input.fill('Calle Mayor')
    await page.waitForSelector('address-search-es >> .aes-error', { timeout: 10000 })
    await expect(page.locator('address-search-es >> .aes-error')).toBeVisible()
    await expect(page.locator('address-search-es >> .aes-retry')).toBeVisible()
  })

  test('footer shows the "Powered by" backlink and no "Ver todo"', async ({ page }) => {
    await search(page)
    const footer = page.locator('address-search-es >> .aes-footer')
    await expect(footer).toBeVisible()
    const link = footer.locator('a.aes-powered')
    await expect(link).toHaveAttribute('href', 'https://calle.alami.es')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener')
    await expect(link).toContainText('Powered by')
    await expect(footer).toContainText('Datos © INE')
    // "Ver todo" is gone; the footer has no button.
    await expect(footer.locator('button')).toHaveCount(0)
    await expect(page.locator('address-search-es >> text=Ver todo')).toHaveCount(0)
  })

  test('size="lg" increases the rendered input row height', async ({ page }) => {
    const box = page.locator('address-search-es')
    const row = page.locator('address-search-es >> .aes-input-row')
    const smHeight = (await row.boundingBox())?.height ?? 0
    await box.evaluate((el: Element) => el.setAttribute('size', 'lg'))
    await expect(box).toHaveAttribute('size', 'lg')
    const lgHeight = (await row.boundingBox())?.height ?? 0
    expect(lgHeight).toBeGreaterThan(smHeight)
    expect(lgHeight).toBeGreaterThanOrEqual(46)
  })

  test('group headers are role="group" labels — no role="button" in the listbox', async ({
    page,
  }) => {
    await search(page)
    await expect(page.locator('address-search-es >> .aes-group').first()).toHaveAttribute(
      'role',
      'group',
    )
    const listbox = page.locator('address-search-es >> #aes-listbox')
    await expect(listbox.locator('[role="button"]')).toHaveCount(0)
    // Options carry aria-selected; the focused one is true.
    await expect(page.locator('address-search-es >> .aes-item[role="option"]').first()).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('public clear() empties the listbox and input (host imperative API)', async ({ page }) => {
    const box = page.locator('address-search-es')
    await search(page)
    await box.evaluate((el: Element) => (el as unknown as { clear: () => Promise<void> }).clear())
    await expect(box.locator('.aes-group')).toHaveCount(0)
    await expect(box.locator('#aes-input')).toHaveValue('')
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
    await expect(input).toHaveValue('Calle Mayor, Madrid (28013)')
    const picked = await box.evaluate((el: Element) =>
      (el as unknown as { getSelection: () => Promise<unknown> }).getSelection(),
    )
    expect(picked).toMatchObject({ municipio_id: '28079' })

    await setSelection(null)
    await expect(input).toHaveValue('')
  })
})
