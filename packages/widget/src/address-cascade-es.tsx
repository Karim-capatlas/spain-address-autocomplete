/**
 * address-cascade-es — typo-tolerant Spanish-administration address form.
 *
 * A vertical Provincia → Municipio → Código postal → Calle cascade. Every step
 * is now a first-class typo-tolerant autocomplete: the geo dropdowns (Provincia /
 * Municipio / CP) match client-side via the dependency-free `fuzzy` matcher
 * (accent- and particle-aware), and the Calle step reuses the shared
 * `SearchController` (Typesense `num_typos` + prefix + infix). The 5-digit INE
 * municipio code (CPRO+CMUN) is computed in the background — never shown as a
 * field — and surfaced via `cascadeChanged` events plus optional hidden form
 * inputs (`name-prefix`).
 *
 * Shares the search controller, option-list rendering, icons, and provincia
 * table with `<address-search-es>` (see `./utils/*`).
 *
 * Stencil compiler constraints (AGENTS.md Phase 3): `h` from the non-public
 * internal/client subpath; cross-package types via inline `import()`.
 */
import {
  Component,
  Prop,
  State,
  Event,
  EventEmitter,
  Element,
  Method,
  Watch,
} from '@stencil/core'
/* eslint-disable @typescript-eslint/no-unused-vars -- `h` is the JSX factory (jsxFactory); consumed by the JSX→h() emit */
// @ts-expect-error -- no public .d.ts; global.d.ts declares a loose `h` + permissive JSX
import { h } from '@stencil/core/internal/client'
/* eslint-enable @typescript-eslint/no-unused-vars */
import { SearchController } from './utils/search-controller'
import { getProvinciaName, getProvinciaInfo } from './utils/provincias'
import { iconClear, iconCheck, iconRetry } from './utils/icons'
import { flatItems, activeOptionId, renderOptionGroups } from './utils/option-list'
import { fuzzyMatch, normalize } from './utils/fuzzy'

type AddressRecord = import('@spain-address/core').AddressRecord
type SearchGroup = import('@spain-address/core').SearchGroup

/** A `{ code, name, ccaa }` row from the cascade `/provincias` + `/municipios`
 *  endpoints. For municipios, `code` is already the 5-digit INE id (CPRO+CMUN). */
interface GeoOption {
  code: string
  name: string
  ccaa?: string
}

/** Max options rendered in a geo combobox (empty query returns all; typed queries
 *  are capped to keep the DOM lean — the lists are tiny anyway). */
const GEO_LIMIT = 100

export type CascadeStep = 'provincia' | 'municipio' | 'cp' | 'street'

/** Keys of the "datos del domicilio" unit fields. */
type UnitKey = 'numero' | 'piso' | 'puerta' | 'portal' | 'bloque' | 'escalera'

export interface CascadeState {
  provincia_id: string
  provincia: string
  municipio_id: string
  municipio: string
  codigo_postal: string
  ccaa: string
  numero: string
  piso: string
  puerta: string
  portal: string
  bloque: string
  escalera: string
}

export interface CascadeChangedDetail extends CascadeState {
  step: CascadeStep
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Render-time descriptor for one geo combobox (Provincia/Municipio/CP share the
 *  exact same markup + ARIA contract; this removes the triplication). */
interface GeoFieldConfig {
  id: string
  listboxId: string
  label: string
  placeholder: string
  ariaLabel: string
  clearLabel: string
  loading: boolean
  disabled: boolean
  open: boolean
  focused: number
  query: string
  /** Whether a value is committed (drives the inline ✓). */
  committed: boolean
  error: string
  /** Filtered + capped options, already mapped to display key/label. */
  options: { key: string; label: string }[]
  inputRef: (el: HTMLInputElement | undefined) => void
  onInput: (e: Event) => void
  onKeyDown: (e: KeyboardEvent) => void
  onFocus: () => void
  onBlur: () => void
  onClear: () => void
  onSelectKey: (key: string) => void
}

@Component({
  tag: 'address-cascade-es',
  styleUrl: 'address-cascade-es.css',
  shadow: true,
})
export class AddressCascadeEs {
  @Element() el!: HTMLElement
  private streetInput?: HTMLInputElement
  private provinciaInput?: HTMLInputElement
  private municipioInput?: HTMLInputElement
  private cpInput?: HTMLInputElement
  private debounceHandle: ReturnType<typeof setTimeout> | undefined
  private controller = new SearchController(() => ({
    endpoint: this.endpoint,
    typesenseHost: this.typesenseHost,
    typesensePort: this.typesensePort,
    typesenseApiKey: this.typesenseApiKey,
    typesenseProtocol: this.typesenseProtocol,
  }))

  /* ===== observed attributes (public API) ===== */
  /** Base URL of the cascade BFF, e.g. "/api/geo" (required). The element fetches
   *  `{base}/provincias`, `{base}/municipios?provincia=`, `{base}/cps?municipio=`. */
  @Prop({ reflect: true }) cascadeEndpoint = ''
  /** Street-search BFF URL (proxy mode), e.g. "/api/address-search". */
  @Prop({ reflect: true }) endpoint = ''
  @Prop({ reflect: true }) typesenseHost = ''
  @Prop({ reflect: true }) typesensePort = 8108
  @Prop({ reflect: true }) typesenseApiKey = ''
  @Prop({ reflect: true }) typesenseProtocol: 'http' | 'https' = 'http'
  /** Control size — MUI Joy Input metrics. Default `sm` (32px / 0.875rem). */
  @Prop({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'sm'
  /** Footer "Powered by" backlink href. */
  @Prop({ reflect: true }) poweredByHref = 'https://calle.alami.es'
  /** Footer "Powered by" backlink label. */
  @Prop({ reflect: true }) poweredByLabel = 'calle.alami.es'
  /**
   * When set, renders hidden `<input>`s named `{prefix}_provincia_id`,
   * `{prefix}_municipio_id`, `{prefix}_codigo_postal`, `{prefix}_via`,
   * `{prefix}_ccaa`, kept in sync with state so the background INE codes are
   * carried alongside the selection.
   */
  @Prop({ reflect: true }) namePrefix = ''
  /** Street-input debounce in ms. */
  @Prop({ reflect: true }) debounceMs = 250
  /** Street-input placeholder. */
  @Prop({ reflect: true }) placeholder = 'Escribe una calle…'
  /** CP is an explicit form field here, so query→CP detection defaults OFF. */
  @Prop({ reflect: true }) detectCp = false
  /** Max municipio groups rendered in the street dropdown. */
  @Prop({ reflect: true }) maxGroups = 3
  /** Max streets per group in the street dropdown. */
  @Prop({ reflect: true }) groupLimit = 3

  /* ===== events ===== */
  @Event() cascadeChanged!: EventEmitter<CascadeChangedDetail>
  @Event() addressSelected!: EventEmitter<AddressRecord>
  @Event() addressCleared!: EventEmitter<void>
  @Event() error!: EventEmitter<{ message: string; code?: number }>

  /* ===== geo state ===== */
  @State() provincias: GeoOption[] = []
  @State() municipios: GeoOption[] = []
  @State() cps: string[] = []
  @State() provinciaId = ''
  @State() provinciaName = ''
  @State() municipioId = ''
  @State() municipioName = ''
  @State() cp = ''
  @State() ccaa = ''
  @State() numero = ''
  @State() piso = ''
  @State() puerta = ''
  @State() portal = ''
  @State() bloque = ''
  @State() escalera = ''
  @State() loadingProvincias = false
  @State() loadingMunicipios = false
  @State() loadingCps = false
  @State() errorProvincias = ''
  @State() errorMunicipios = ''
  @State() errorCps = ''

  /* ===== autocomplete state ===== */
  @State() provinciaOpen = false
  @State() provinciaFocused = -1
  @State() provinciaQuery = ''
  @State() municipioOpen = false
  @State() municipioFocused = -1
  @State() municipioQuery = ''
  @State() cpOpen = false
  @State() cpFocused = -1
  @State() cpQuery = ''

  /* ===== street state ===== */
  @State() streetQuery = ''
  @State() streetGroups: SearchGroup[] = []
  @State() streetTotal = 0
  @State() streetLoading = false
  @State() streetOpen = false
  @State() streetFocused = -1
  @State() streetSelected: AddressRecord | null = null
  @State() streetError = ''

  @Watch('cascadeEndpoint')
  onCascadeEndpointChange(): void {
    void this.loadProvincias()
  }

  componentWillLoad(): void {
    void this.loadProvincias()
  }

  disconnectedCallback(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.controller.cancel()
    this.provinciaOpen = false
    this.municipioOpen = false
    this.cpOpen = false
  }

  /* ===== geo fetching ===== */
  private async fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
    const base = this.cascadeEndpoint.replace(/\/+$/, '')
    const url = new URL(`${base}${path}`, window.location.href)
    if (params) {
      for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v)
    }
    const res = await fetch(url.toString(), { headers: { accept: 'application/json' } })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw Object.assign(new Error(`cascade ${res.status}: ${body.slice(0, 200)}`), {
        status: res.status,
      })
    }
    return (await res.json()) as T
  }

  private emitError(e: unknown): void {
    const message = errMsg(e)
    const code = (e as { status?: number })?.status
    this.error.emit({ message, code })
  }

  private async loadProvincias(): Promise<void> {
    if (!this.cascadeEndpoint) {
      this.errorProvincias = 'attribute "cascade-endpoint" is required'
      return
    }
    this.loadingProvincias = true
    this.errorProvincias = ''
    try {
      const list = await this.fetchJson<GeoOption[]>('/provincias')
      this.provincias = [...list].sort((a, b) => a.code.localeCompare(b.code))
    } catch (e) {
      this.errorProvincias = errMsg(e)
      this.emitError(e)
    } finally {
      this.loadingProvincias = false
    }
  }

  private async loadMunicipios(cpro: string): Promise<void> {
    this.loadingMunicipios = true
    this.errorMunicipios = ''
    try {
      // `code` is already the 5-digit INE id (CPRO+CMUN) — store, never display.
      this.municipios = await this.fetchJson<GeoOption[]>('/municipios', { provincia: cpro })
    } catch (e) {
      this.errorMunicipios = errMsg(e)
      this.emitError(e)
    } finally {
      this.loadingMunicipios = false
    }
  }

  private async loadCps(municipioId: string): Promise<void> {
    this.loadingCps = true
    this.errorCps = ''
    try {
      const list = await this.fetchJson<string[]>('/cps', { municipio: municipioId })
      this.cps = list
      // Exactly one CP → auto-select it and resolve the cp step.
      if (list.length === 1) {
        this.cp = list[0]
        this.cpQuery = list[0]
        this.emitCascade('cp')
      }
    } catch (e) {
      this.errorCps = errMsg(e)
      this.emitError(e)
    } finally {
      this.loadingCps = false
    }
  }

  private emitCascade(step: CascadeStep): void {
    this.cascadeChanged.emit({
      step,
      provincia_id: this.provinciaId,
      provincia: this.provinciaName,
      municipio_id: this.municipioId,
      municipio: this.municipioName,
      codigo_postal: this.cp,
      ccaa: this.ccaa,
      numero: this.numero,
      piso: this.piso,
      puerta: this.puerta,
      portal: this.portal,
      bloque: this.bloque,
      escalera: this.escalera,
    })
  }

  /* ===== typo-tolerant option matching ===== */
  private provinciaMatches(): GeoOption[] {
    return fuzzyMatch(this.provinciaQuery, this.provincias, (o) => o.name, (o) => o.code, GEO_LIMIT)
  }

  private municipioMatches(): GeoOption[] {
    return fuzzyMatch(this.municipioQuery, this.municipios, (o) => o.name, (o) => o.code, GEO_LIMIT)
  }

  private cpMatches(): string[] {
    return fuzzyMatch(this.cpQuery, this.cps, (c) => c, (c) => c, GEO_LIMIT)
  }

  /* ===== reset helpers (downstream cascade semantics) ===== */
  /** Clear everything below the provincia step (municipio → CP → street). */
  private resetDownstream(): void {
    this.municipios = []
    this.municipioId = ''
    this.municipioName = ''
    this.municipioQuery = ''
    this.municipioOpen = false
    this.municipioFocused = -1
    this.resetAfterMunicipio()
  }

  /** Clear everything below the municipio step (CP → street). */
  private resetAfterMunicipio(): void {
    this.cps = []
    this.cp = ''
    this.cpQuery = ''
    this.cpOpen = false
    this.cpFocused = -1
    this.resetStreet()
  }

  /* ===== street combobox ===== */
  private resetStreet(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.controller.cancel()
    this.streetQuery = ''
    this.clearStreetResults()
    this.streetSelected = null
    this.streetOpen = false
    this.streetFocused = -1
    this.streetLoading = false
  }

  private clearStreetResults(): void {
    this.streetGroups = []
    this.streetTotal = 0
    this.streetError = ''
  }

  private scheduleStreetSearch(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.streetLoading = true
    this.debounceHandle = setTimeout(() => {
      this.debounceHandle = undefined
      void this.doStreetSearch()
    }, this.debounceMs)
  }

  private async doStreetSearch(): Promise<void> {
    const q = this.streetQuery.trim()
    if (q.length < 2 || !this.cp) {
      this.clearStreetResults()
      this.streetOpen = false
      this.streetLoading = false
      return
    }
    this.streetLoading = true
    const outcome = await this.controller.search({
      query: q,
      perPage: this.maxGroups,
      groupLimit: this.groupLimit,
      detectCp: this.detectCp,
      municipio: this.municipioId || undefined,
      cp: this.cp || undefined,
    })
    if (outcome.status === 'superseded') return
    this.streetLoading = false
    if (outcome.status === 'error') {
      this.streetError = outcome.message
      this.error.emit({ message: outcome.message, code: outcome.code })
      this.streetOpen = true
      return
    }
    this.streetGroups = outcome.result.groups
    this.streetTotal = outcome.result.total
    this.streetOpen = true
    this.streetFocused = outcome.result.groups.length ? 0 : -1
    this.streetError = ''
  }

  private onStreetInput = (e: Event): void => {
    const value = (e.target as HTMLInputElement).value
    this.streetQuery = value
    this.streetSelected = null
    if (value.trim().length >= 2) {
      this.scheduleStreetSearch()
    } else {
      this.clearStreetResults()
      this.streetOpen = false
      this.streetFocused = -1
    }
  }

  private onStreetFocus = (): void => {
    if (this.streetQuery.trim().length >= 2 || this.streetGroups.length) this.streetOpen = true
  }

  private onStreetBlur = (): void => {
    setTimeout(() => {
      if (!this.el.contains(document.activeElement as Node)) this.streetOpen = false
    }, 120)
  }

  private onStreetKeyDown = (e: KeyboardEvent): void => {
    if (!this.streetOpen) return
    const items = flatItems(this.streetGroups)
    if (items.length === 0) {
      if (e.key === 'Escape') {
        this.streetOpen = false
        this.streetFocused = -1
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.streetFocused = (this.streetFocused + 1) % items.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.streetFocused = (this.streetFocused - 1 + items.length) % items.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = this.streetFocused >= 0 ? this.streetFocused : 0
      const item = items[idx]
      if (item) this.selectStreet(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this.streetOpen = false
      this.streetFocused = -1
    }
  }

  private selectStreet(item: AddressRecord): void {
    this.addressSelected.emit(item)
    this.streetSelected = item
    this.streetQuery = item.label ?? ''
    this.clearStreetResults()
    this.streetOpen = false
    this.streetFocused = -1
    this.emitCascade('street')
    this.streetInput?.focus()
  }

  private onStreetClear = (): void => {
    this.resetStreet()
    this.addressCleared.emit()
    this.streetInput?.focus()
  }

  private onStreetRetry = (): void => {
    this.streetError = ''
    void this.doStreetSearch()
  }

  /* ===== "datos del domicilio" unit inputs ===== */
  private onUnitInput = (e: Event, key: UnitKey): void => {
    this[key] = (e.target as HTMLInputElement).value
  }

  private onUnitBlur = (): void => {
    this.emitCascade('street')
  }

  private streetActiveId(): string | undefined {
    return activeOptionId(this.streetGroups, this.streetFocused, 'ace')
  }

  componentDidUpdate(): void {
    // Sync DOM property values for the autocomplete inputs (Stencil's one-way
    // `value` binding plus `type="search"` quirk: keep the DOM value in lockstep).
    if (this.provinciaInput) this.provinciaInput.value = this.provinciaQuery
    if (this.municipioInput) this.municipioInput.value = this.municipioQuery
    if (this.cpInput) this.cpInput.value = this.cpQuery

    const id = this.streetActiveId()
    if (id) {
      const el = this.el.shadowRoot?.getElementById(id)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }

  /* ===== public imperative API ===== */
  /** Reset all four steps + the "datos del domicilio" unit fields. */
  @Method()
  async clear(): Promise<void> {
    this.provinciaId = ''
    this.provinciaName = ''
    this.provinciaQuery = ''
    this.ccaa = ''
    this.numero = ''
    this.piso = ''
    this.puerta = ''
    this.portal = ''
    this.bloque = ''
    this.escalera = ''
    this.resetDownstream()
    this.addressCleared.emit()
    this.provinciaInput?.focus()
  }

  /** Background INE codes + the selected street record + "datos del domicilio". */
  @Method()
  async getState(): Promise<CascadeState & { street: AddressRecord | null }> {
    return {
      provincia_id: this.provinciaId,
      provincia: this.provinciaName,
      municipio_id: this.municipioId,
      municipio: this.municipioName,
      codigo_postal: this.cp,
      ccaa: this.ccaa,
      numero: this.numero,
      piso: this.piso,
      puerta: this.puerta,
      portal: this.portal,
      bloque: this.bloque,
      escalera: this.escalera,
      street: this.streetSelected,
    }
  }

  /** Best-effort back-fill: derive provincia/municipio/CP from the record. */
  @Method()
  async setSelection(record: AddressRecord | null): Promise<void> {
    if (!record) {
      await this.clear()
      return
    }
    this.provinciaId = record.provincia_id ?? ''
    this.provinciaName = record.provincia ?? getProvinciaName(this.provinciaId)
    this.provinciaQuery = record.provincia ?? ''
    this.municipioId = record.municipio_id ?? ''
    this.municipioName = record.municipio ?? ''
    this.municipioQuery = record.municipio ?? ''
    this.cp = record.codigo_postal ?? ''
    this.cpQuery = record.codigo_postal ?? ''
    this.ccaa =
      record.comunidad_autonoma ?? getProvinciaInfo(this.provinciaId)?.comunidad_autonoma ?? ''
    this.streetSelected = record
    this.streetQuery = record.label ?? ''
    // Load the option lists so the selects can display the back-filled values.
    if (this.provinciaId) void this.loadMunicipios(this.provinciaId)
    if (this.municipioId) void this.loadCps(this.municipioId)
    this.emitCascade('street')
  }

  /* ===== geo combobox behaviour ===== */
  private closeProvincia(): void {
    this.provinciaOpen = false
    this.provinciaFocused = -1
  }

  private closeMunicipio(): void {
    this.municipioOpen = false
    this.municipioFocused = -1
  }

  private closeCp(): void {
    this.cpOpen = false
    this.cpFocused = -1
  }

  private selectProvincia(opt: GeoOption): void {
    this.provinciaId = opt.code
    this.provinciaName = opt.name
    this.ccaa = opt.ccaa ?? getProvinciaInfo(opt.code)?.comunidad_autonoma ?? ''
    this.provinciaQuery = opt.name
    this.closeProvincia()
    this.resetDownstream()
    this.emitCascade('provincia')
    void this.loadMunicipios(opt.code)
    this.municipioInput?.focus()
  }

  private selectMunicipio(opt: GeoOption): void {
    this.municipioId = opt.code
    this.municipioName = opt.name
    this.municipioQuery = opt.name
    this.closeMunicipio()
    this.resetAfterMunicipio()
    this.emitCascade('municipio')
    void this.loadCps(opt.code)
    this.cpInput?.focus()
  }

  private selectCp(cp: string): void {
    this.cp = cp
    this.cpQuery = cp
    this.closeCp()
    this.resetStreet()
    this.emitCascade('cp')
    this.streetInput?.focus()
  }

  private onProvinciaInput = (e: Event): void => {
    const val = (e.target as HTMLInputElement).value
    this.provinciaQuery = val
    this.provinciaOpen = true
    this.provinciaFocused = -1
    const match = this.provincias.find((p) => normalize(p.name) === normalize(val))
    if (match && val.trim().length > 0) {
      this.selectProvincia(match)
    } else {
      this.provinciaId = ''
      this.provinciaName = ''
      this.resetDownstream()
    }
  }

  private onMunicipioInput = (e: Event): void => {
    const val = (e.target as HTMLInputElement).value
    this.municipioQuery = val
    this.municipioOpen = true
    this.municipioFocused = -1
    this.municipioId = ''
    this.municipioName = ''
    this.resetAfterMunicipio()
  }

  private onCpInput = (e: Event): void => {
    const val = (e.target as HTMLInputElement).value
    this.cpQuery = val
    this.cpOpen = true
    this.cpFocused = -1
    this.cp = ''
    this.resetStreet()
  }

  private geoKeyDown(
    e: KeyboardEvent,
    open: boolean,
    count: number,
    focused: number,
    setFocused: (n: number) => void,
    select: (idx: number) => void,
    close: () => void,
  ): void {
    if (!open || count === 0) {
      if (e.key === 'Escape') close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocused(Math.min(focused + 1, count - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocused(Math.max(focused - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focused >= 0 && focused < count) select(focused)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  private onProvinciaKeyDown = (e: KeyboardEvent): void => {
    const opts = this.provinciaMatches()
    this.geoKeyDown(
      e,
      this.provinciaOpen,
      opts.length,
      this.provinciaFocused,
      (n) => { this.provinciaFocused = n },
      (i) => this.selectProvincia(opts[i]),
      () => this.closeProvincia(),
    )
  }

  private onMunicipioKeyDown = (e: KeyboardEvent): void => {
    const opts = this.municipioMatches()
    this.geoKeyDown(
      e,
      this.municipioOpen,
      opts.length,
      this.municipioFocused,
      (n) => { this.municipioFocused = n },
      (i) => this.selectMunicipio(opts[i]),
      () => this.closeMunicipio(),
    )
  }

  private onCpKeyDown = (e: KeyboardEvent): void => {
    const opts = this.cpMatches()
    this.geoKeyDown(
      e,
      this.cpOpen,
      opts.length,
      this.cpFocused,
      (n) => { this.cpFocused = n },
      (i) => this.selectCp(opts[i]),
      () => this.closeCp(),
    )
  }

  private onProvinciaClear = (): void => {
    this.provinciaId = ''
    this.provinciaName = ''
    this.provinciaQuery = ''
    this.closeProvincia()
    this.resetDownstream()
    this.provinciaInput?.focus()
  }

  private onMunicipioClear = (): void => {
    this.municipioId = ''
    this.municipioName = ''
    this.municipioQuery = ''
    this.closeMunicipio()
    this.resetAfterMunicipio()
    this.municipioInput?.focus()
  }

  private onCpClear = (): void => {
    this.cp = ''
    this.cpQuery = ''
    this.closeCp()
    this.resetStreet()
    this.cpInput?.focus()
  }

  private onSelectProvinciaKey = (key: string): void => {
    const opt = this.provincias.find((p) => p.code === key)
    if (opt) this.selectProvincia(opt)
  }

  private onSelectMunicipioKey = (key: string): void => {
    const opt = this.municipios.find((m) => m.code === key)
    if (opt) this.selectMunicipio(opt)
  }

  private onSelectCpKey = (key: string): void => {
    this.selectCp(key)
  }

  /* ===== render ===== */
  private renderGeoField(cfg: GeoFieldConfig) {
    return (
      <div class="ace-field">
        <label class="ace-label" htmlFor={cfg.id}>
          {cfg.label}
        </label>
        <div class={{ 'ace-combobox': true, open: cfg.open }}>
          <div class={{ 'aes-input-row': true, loading: cfg.loading }}>
            <input
              ref={cfg.inputRef}
              id={cfg.id}
              class="aes-input"
              type="search"
              inputMode="search"
              placeholder={cfg.placeholder}
              value={cfg.query}
              disabled={cfg.disabled}
              onInput={cfg.onInput}
              onKeyDown={cfg.onKeyDown}
              onFocus={cfg.onFocus}
              onBlur={cfg.onBlur}
              aria-autocomplete="list"
              aria-expanded={cfg.open}
              aria-controls={cfg.listboxId}
              aria-activedescendant={cfg.focused >= 0 ? `${cfg.id}-i-${cfg.focused}` : undefined}
              aria-label={cfg.ariaLabel}
              autoComplete="off"
            />
            <div class="aes-trailing">
              {cfg.committed && !cfg.loading ? (
                <span class="aes-check" aria-hidden="true">{iconCheck()}</span>
              ) : null}
              {cfg.loading ? <span class="aes-spinner" aria-hidden="true" /> : null}
              {cfg.query ? (
                <button class="aes-clear" aria-label={cfg.clearLabel} type="button" onClick={cfg.onClear}>
                  {iconClear()}
                </button>
              ) : null}
            </div>
          </div>
          {cfg.open && cfg.options.length > 0 ? (
            <div class="aes-menu" aria-hidden={!cfg.open} onMouseDown={(e: MouseEvent) => e.preventDefault()}>
              <div class="aes-listbox" id={cfg.listboxId} role="listbox" aria-label={cfg.label}>
                {cfg.options.map((opt, idx) => (
                  <div
                    key={opt.key}
                    id={`${cfg.id}-i-${idx}`}
                    class={{ 'aes-item': true, hi: cfg.focused === idx }}
                    role="option"
                    aria-selected={cfg.focused === idx ? 'true' : 'false'}
                    onClick={() => cfg.onSelectKey(opt.key)}
                  >
                    <span class="aes-label">{opt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {cfg.error ? <span class="ace-field-error" role="alert">{cfg.error}</span> : null}
      </div>
    )
  }

  render() {
    const streetDisabled = !this.cp
    const p = this.namePrefix
    const showStreetFooter = this.streetOpen && !this.streetError && this.streetGroups.length > 0
    const showStreetProgress = this.streetLoading && this.streetGroups.length > 0

    const provinciaOptions = this.provinciaMatches().map((o) => ({ key: o.code, label: o.name }))
    const municipioOptions = this.municipioMatches().map((o) => ({ key: o.code, label: o.name }))
    const cpOptions = this.cpMatches().map((c) => ({ key: c, label: c }))

    return (
      <div class="ace">
        {this.renderGeoField({
          id: 'ace-provincia',
          listboxId: 'ace-listbox-provincia',
          label: 'Provincia',
          placeholder: 'Buscar provincia…',
          ariaLabel: 'Buscar provincia',
          clearLabel: 'Borrar provincia',
          loading: this.loadingProvincias,
          disabled: this.loadingProvincias,
          open: this.provinciaOpen,
          focused: this.provinciaFocused,
          query: this.provinciaQuery,
          committed: this.provinciaName !== '',
          error: this.errorProvincias,
          options: provinciaOptions,
          inputRef: (el: HTMLInputElement | undefined) => (this.provinciaInput = el),
          onInput: this.onProvinciaInput,
          onKeyDown: this.onProvinciaKeyDown,
          onFocus: () => { this.provinciaOpen = true; this.provinciaFocused = -1 },
          onBlur: () => setTimeout(() => this.closeProvincia(), 200),
          onClear: this.onProvinciaClear,
          onSelectKey: this.onSelectProvinciaKey,
        })}

        {this.renderGeoField({
          id: 'ace-municipio',
          listboxId: 'ace-listbox-municipio',
          label: 'Municipio',
          placeholder: 'Buscar municipio…',
          ariaLabel: 'Buscar municipio',
          clearLabel: 'Borrar municipio',
          loading: this.loadingMunicipios,
          disabled: !this.provinciaId || this.loadingMunicipios,
          open: this.municipioOpen,
          focused: this.municipioFocused,
          query: this.municipioQuery,
          committed: this.municipioName !== '',
          error: this.errorMunicipios,
          options: municipioOptions,
          inputRef: (el: HTMLInputElement | undefined) => (this.municipioInput = el),
          onInput: this.onMunicipioInput,
          onKeyDown: this.onMunicipioKeyDown,
          onFocus: () => { this.municipioOpen = true; this.municipioFocused = -1 },
          onBlur: () => setTimeout(() => this.closeMunicipio(), 200),
          onClear: this.onMunicipioClear,
          onSelectKey: this.onSelectMunicipioKey,
        })}

        {this.renderGeoField({
          id: 'ace-cp',
          listboxId: 'ace-listbox-cp',
          label: 'Código postal',
          placeholder: 'Buscar código postal…',
          ariaLabel: 'Buscar código postal',
          clearLabel: 'Borrar código postal',
          loading: this.loadingCps,
          disabled: !this.municipioId || this.loadingCps,
          open: this.cpOpen,
          focused: this.cpFocused,
          query: this.cpQuery,
          committed: this.cp !== '',
          error: this.errorCps,
          options: cpOptions,
          inputRef: (el: HTMLInputElement | undefined) => (this.cpInput = el),
          onInput: this.onCpInput,
          onKeyDown: this.onCpKeyDown,
          onFocus: () => { this.cpOpen = true; this.cpFocused = -1 },
          onBlur: () => setTimeout(() => this.closeCp(), 200),
          onClear: this.onCpClear,
          onSelectKey: this.onSelectCpKey,
        })}

        {/* Calle — scoped street combobox */}
        <div class="ace-field">
          <label class="ace-label" htmlFor="ace-street-input">
            Calle
          </label>
          <div class={{ 'ace-combobox': true, open: this.streetOpen }}>
            <div class={{ 'aes-input-row': true, loading: this.streetLoading }}>
              <input
                ref={(el: HTMLInputElement | undefined) => (this.streetInput = el)}
                id="ace-street-input"
                class="aes-input"
                type="search"
                inputMode="search"
                placeholder={this.placeholder}
                value={this.streetQuery}
                disabled={streetDisabled}
                onInput={this.onStreetInput}
                onKeyDown={this.onStreetKeyDown}
                onFocus={this.onStreetFocus}
                onBlur={this.onStreetBlur}
                aria-autocomplete="list"
                aria-expanded={this.streetOpen}
                aria-controls="ace-listbox"
                aria-activedescendant={this.streetActiveId()}
                aria-label="Buscar calle"
                autoComplete="off"
              />
              <div class="aes-trailing">
                {this.streetSelected && !this.streetLoading ? (
                  <span class="aes-check" aria-hidden="true">
                    {iconCheck()}
                  </span>
                ) : null}
                {this.streetLoading ? <span class="aes-spinner" aria-hidden="true" /> : null}
                {!this.streetLoading && this.streetQuery ? (
                  <button
                    class="aes-clear"
                    aria-label="Borrar calle"
                    type="button"
                    onClick={this.onStreetClear}
                  >
                    {iconClear()}
                  </button>
                ) : null}
              </div>
            </div>

            {showStreetProgress ? (
              <div class="aes-progress" aria-hidden="true">
                <span />
              </div>
            ) : null}

            <div class="aes-menu" aria-hidden={!this.streetOpen}>
              {this.streetError ? (
                <div class="aes-error" role="alert">
                  <span class="aes-error-msg">{this.streetError}</span>
                  <button class="aes-retry" type="button" onClick={this.onStreetRetry}>
                    {iconRetry()}
                    <span>Reintentar</span>
                  </button>
                </div>
              ) : (
                <div
                  class="aes-listbox"
                  id="ace-listbox"
                  role="listbox"
                  aria-label="Calles"
                >
                  {this.streetLoading && this.streetGroups.length === 0
                    ? this.renderSkeleton()
                    : this.streetGroups.length === 0 && this.streetOpen
                      ? this.streetQuery.trim()
                        ? (
                          <div class="aes-empty" role="presentation">
                            No se encontraron calles para <b>{this.streetQuery.trim()}</b>.
                          </div>
                        )
                        : null
                      : renderOptionGroups(
                          this.streetGroups,
                          this.streetFocused,
                          (it) => this.selectStreet(it),
                          'ace',
                        )}
                </div>
              )}

              {showStreetFooter ? (
                <div class="aes-footer">
                  <span class="aes-footer-count">
                    {this.streetTotal > this.streetGroups.length
                      ? `Mostrando los ${this.streetGroups.length} primeros de ${this.streetTotal}`
                      : `${this.streetTotal} resultado${this.streetTotal === 1 ? '' : 's'}`}
                  </span>
                  <span class="aes-footer-right">
                    <a
                      class="aes-powered"
                      href={this.poweredByHref}
                      target="_blank"
                      rel="noopener"
                    >
                      Powered by {this.poweredByLabel}
                    </a>
                    <span class="aes-ine">Datos © INE</span>
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* "Datos del domicilio" — free-text unit inputs (never indexed) */}
        <div class="ace-unit-grid">
          {this.renderUnitInput('numero', 'Número', '12')}
          {this.renderUnitInput('piso', 'Piso', '4º')}
          {this.renderUnitInput('puerta', 'Puerta', 'B')}
          {this.renderUnitInput('portal', 'Portal', '2')}
          {this.renderUnitInput('bloque', 'Bloque', '3')}
          {this.renderUnitInput('escalera', 'Escalera', '1')}
        </div>

        {/* Hidden inputs carrying the background INE codes (name-prefix set) */}
        {p ? (
          <div class="ace-hidden" aria-hidden="true">
            <input type="hidden" name={`${p}_provincia_id`} value={this.provinciaId} />
            <input type="hidden" name={`${p}_municipio_id`} value={this.municipioId} />
            <input type="hidden" name={`${p}_codigo_postal`} value={this.cp} />
            <input type="hidden" name={`${p}_via`} value={this.streetSelected?.label ?? ''} />
            <input type="hidden" name={`${p}_ccaa`} value={this.ccaa} />
            <input type="hidden" name={`${p}_numero`} value={this.numero} />
            <input type="hidden" name={`${p}_piso`} value={this.piso} />
            <input type="hidden" name={`${p}_puerta`} value={this.puerta} />
            <input type="hidden" name={`${p}_portal`} value={this.portal} />
            <input type="hidden" name={`${p}_bloque`} value={this.bloque} />
            <input type="hidden" name={`${p}_escalera`} value={this.escalera} />
          </div>
        ) : null}
      </div>
    )
  }

  private renderSkeleton() {
    return (
      <div class="aes-skel-area" role="presentation">
        <div class="skel-row">
          <span class="skel-line lab" />
        </div>
        <div class="skel-row">
          <span class="skel-line lab" />
        </div>
        <div class="skel-row">
          <span class="skel-line lab" />
        </div>
      </div>
    )
  }

  private renderUnitInput(key: UnitKey, label: string, placeholder: string) {
    return (
      <div class="ace-field">
        <label class="ace-label">{label}</label>
        <div class="aes-input-row">
          <input
            class="aes-input"
            type="text"
            value={this[key]}
            placeholder={placeholder}
            onInput={(e: Event) => this.onUnitInput(e, key)}
            onBlur={this.onUnitBlur}
            aria-label={label}
          />
        </div>
      </div>
    )
  }
}
