import { test, expect, type Page, type Route } from '@playwright/test'

/**
 * Cascade e2e — `<address-cascade-es>` typo-tolerant combobox contract.
 *
 * All backend calls are mocked with deterministic fixtures so the suite is
 * hermetic: the geo cascade (`/api/geo/provincias|municipios|cps`) and the
 * scoped street search (`/api/address-search`). Every step is now an autocomplete
 * `<input>` (no `<select>`): typo/particle/accent tolerance, the CP gate,
 * single-CP auto-select, `cascadeChanged` codes, and `name-prefix` hidden inputs.
 */

const PROVINCIAS = [
  { code: '28', name: 'Madrid', ccaa: 'Comunidad de Madrid' },
  { code: '29', name: 'Málaga', ccaa: 'Andalucía' },
  { code: '08', name: 'Barcelona', ccaa: 'Cataluña' },
]

const MUNICIPIOS_28 = [
  { code: '28079', name: 'Madrid', ccaa: 'Comunidad de Madrid' },
  { code: '28001', name: 'Alcalá de Henares', ccaa: 'Comunidad de Madrid' },
  { code: '28127', name: 'Las Rozas de Madrid', ccaa: 'Comunidad de Madrid' },
]

const STREET_FIXTURE = {
  records: [],
  groups: [
    {
      municipio_id: '28079',
      municipio: 'Madrid',
      provincia: 'Madrid',
      provincia_id: '28',
      codigo_postal: '28013',
      found: 1,
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
        },
      ],
    },
  ],
  total: 1,
  took_ms: 3,
}

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

const sel = (id: string) => `address-cascade-es >> ${id}`

async function waitForCascade(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof customElements !== 'undefined' && customElements.get('address-cascade-es') !== undefined,
  )
}

async function recordCascadeEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __cascadeEvents: unknown[] }
    w.__cascadeEvents = []
    document
      .getElementById('address-cascade')
      ?.addEventListener('cascadeChanged', (e) => w.__cascadeEvents.push((e as CustomEvent).detail))
  })
}

async function cascadeEvents(page: Page): Promise<Array<Record<string, string>>> {
  return page.evaluate(
    () => (window as unknown as { __cascadeEvents: Array<Record<string, string>> }).__cascadeEvents,
  )
}

test.describe('address-cascade-es', () => {
  let lastSearchUrl = ''

  test.beforeEach(async ({ page }) => {
    lastSearchUrl = ''
    await page.route('**/api/geo/provincias', (route: Route) => route.fulfill(json(PROVINCIAS)))
    await page.route('**/api/geo/municipios*', (route: Route) => route.fulfill(json(MUNICIPIOS_28)))
    await page.route('**/api/geo/cps*', (route: Route) => {
      const url = new URL(route.request().url())
      const municipio = url.searchParams.get('municipio')
      // 28001 (Alcalá) has a single CP → auto-select; others have several.
      const cps = municipio === '28001' ? ['28801'] : ['28001', '28013', '28014']
      route.fulfill(json(cps))
    })
    await page.route('**/api/address-search*', (route: Route) => {
      lastSearchUrl = route.request().url()
      route.fulfill(json(STREET_FIXTURE))
    })
    await page.goto('/examples/vanilla.html')
    await waitForCascade(page)
    await recordCascadeEvents(page)
  })

  test('provincias populate on load', async ({ page }) => {
    await page.locator(sel('#ace-provincia')).click()
    await expect(page.locator(sel('.aes-item'))).toHaveCount(3, { timeout: 10000 })
    await expect(page.locator(sel('.aes-item')).first()).toContainText('Barcelona')
  })

  test('provincia combobox is typo-tolerant and accent-insensitive', async ({ page }) => {
    const input = page.locator(sel('#ace-provincia'))
    await input.fill('malga')
    await expect(page.locator(sel('.aes-item'), { hasText: 'Málaga' })).toBeVisible()
  })

  test('selecting provincia auto-selects an exact match and enables municipio', async ({ page }) => {
    const input = page.locator(sel('#ace-provincia'))
    await input.fill('madrid')
    await expect(input).toHaveValue('Madrid')
    const municipio = page.locator(sel('#ace-municipio'))
    await expect(municipio).toBeEnabled()
    await municipio.click()
    await expect(page.locator(sel('.aes-item'))).toHaveCount(3, { timeout: 10000 })
  })

  test('municipio combobox ignores particles (stop words)', async ({ page }) => {
    await page.locator(sel('#ace-provincia')).fill('madrid')
    const municipio = page.locator(sel('#ace-municipio'))
    await municipio.fill('rozas')
    await expect(page.locator(sel('.aes-item'), { hasText: 'Las Rozas' })).toBeVisible()
  })

  test('municipio combobox is typo-tolerant (edit distance)', async ({ page }) => {
    await page.locator(sel('#ace-provincia')).fill('madrid')
    const municipio = page.locator(sel('#ace-municipio'))
    await municipio.fill('madriz')
    await expect(page.locator(sel('.aes-item'), { hasText: 'Madrid' })).toBeVisible()
  })

  test('single CP auto-selects and enables the street input', async ({ page }) => {
    await page.locator(sel('#ace-provincia')).fill('madrid')
    const municipio = page.locator(sel('#ace-municipio'))
    await municipio.fill('alcala')
    await page.locator(sel('.aes-item'), { hasText: 'Alcalá de Henares' }).click()

    const cp = page.locator(sel('#ace-cp'))
    await expect(cp).toHaveValue('28801', { timeout: 10000 })
    await expect(page.locator(sel('#ace-street-input'))).toBeEnabled()
  })

  test('street input stays disabled until a CP is resolved', async ({ page }) => {
    const street = page.locator(sel('#ace-street-input'))
    await expect(street).toBeDisabled()

    await page.locator(sel('#ace-provincia')).fill('madrid')
    const municipio = page.locator(sel('#ace-municipio'))
    await municipio.fill('madrid')
    await page.locator(sel('.aes-item'), { hasText: /^Madrid$/ }).click()

    // Municipio Madrid → several CPs → none auto-selected → still disabled.
    await expect(street).toBeDisabled()

    const cp = page.locator(sel('#ace-cp'))
    await cp.fill('28013')
    await page.locator(sel('.aes-item'), { hasText: '28013' }).click()
    await expect(street).toBeEnabled()
  })

  test('street search is scoped to the selected municipio + CP', async ({ page }) => {
    await page.locator(sel('#ace-provincia')).fill('madrid')
    await page.locator(sel('#ace-municipio')).fill('madrid')
    await page.locator(sel('.aes-item'), { hasText: /^Madrid$/ }).click()
    await page.locator(sel('#ace-cp')).fill('28013')
    await page.locator(sel('.aes-item'), { hasText: '28013' }).click()

    const street = page.locator(sel('#ace-street-input'))
    await expect(street).toBeEnabled()
    await street.fill('Calle Mayor')
    await page.waitForSelector(sel('.aes-item'), { timeout: 10000 })

    expect(lastSearchUrl).toContain('municipio=28079')
    expect(lastSearchUrl).toContain('cp=28013')
    // The street text must be forwarded too (regression: it used to be dropped
    // when a CP filter was present, returning arbitrary streets for the CP).
    expect(lastSearchUrl).toContain('q=Calle')
  })

  test('cascadeChanged carries the 5-digit municipio_id and ccaa', async ({ page }) => {
    await page.locator(sel('#ace-provincia')).fill('madrid')
    await page.locator(sel('#ace-municipio')).fill('madrid')
    await page.locator(sel('.aes-item'), { hasText: /^Madrid$/ }).click()

    await expect
      .poll(async () => {
        const events = await cascadeEvents(page)
        const mun = events.find((e) => e.step === 'municipio')
        return mun?.municipio_id ?? ''
      })
      .toBe('28079')

    const events = await cascadeEvents(page)
    const prov = events.find((e) => e.step === 'provincia')
    expect(prov).toMatchObject({
      provincia_id: '28',
      provincia: 'Madrid',
      ccaa: 'Comunidad de Madrid',
    })
  })

  test('name-prefix renders hidden inputs synced with each step', async ({ page }) => {
    const hidden = (name: string) =>
      page.locator(`address-cascade-es >> input[type="hidden"][name="${name}"]`)

    await expect(hidden('addr_provincia_id')).toHaveCount(1)

    await page.locator(sel('#ace-provincia')).fill('madrid')
    await expect(hidden('addr_provincia_id')).toHaveValue('28')
    await expect(hidden('addr_ccaa')).toHaveValue('Comunidad de Madrid')

    await page.locator(sel('#ace-municipio')).fill('madrid')
    await page.locator(sel('.aes-item'), { hasText: /^Madrid$/ }).click()
    await expect(hidden('addr_municipio_id')).toHaveValue('28079')

    await page.locator(sel('#ace-cp')).fill('28013')
    await page.locator(sel('.aes-item'), { hasText: '28013' }).click()
    await expect(hidden('addr_codigo_postal')).toHaveValue('28013')

    const street = page.locator(sel('#ace-street-input'))
    await expect(street).toBeEnabled()
    await street.fill('Calle Mayor')
    await page.waitForSelector(sel('.aes-item'), { timeout: 10000 })
    await page.locator(sel('.aes-item')).first().click()
    await expect(hidden('addr_via')).toHaveValue('Calle Mayor, Madrid (28013)')
  })
})
