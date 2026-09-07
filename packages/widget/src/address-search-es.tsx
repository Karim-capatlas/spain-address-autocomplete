/**
 * address-search-es — StencilJS Web Component for Spanish address autocomplete.
 *
 * Framework-agnostic: drops into any page as `<address-search-es>`. Stencil's
 * `@stencil/react-output-target` (configured in stencil.config.ts) generates the
 * typed React / Vue / Angular wrappers from this single component.
 *
 * v2 redesign: first-class combobox — selection fills the input, optional inline
 * structured address card (`detail`), three sizes (`size`, default Joy *small*),
 * sticky non-interactive group labels, error row with retry, and a footer
 * "Powered by" backlink + "Datos © INE" attribution (replaces "Ver todo").
 */
import {
  Component,
  Prop,
  State,
  Event,
  EventEmitter,
  Element,
  Method,
} from '@stencil/core'
// `h` is the JSX factory; the sandbox compiler's `syntheticRender` h-injection is
// dormant, so we import it from the non-public `@stencil/core/internal/client`
// subpath — rollup inlines+renames the real factory and links render() to it.
/* eslint-disable @typescript-eslint/no-unused-vars -- `h` is the JSX factory (jsxFactory); consumed by the JSX→h() emit, not referenced as a value in TS source */
// @ts-expect-error -- no public .d.ts; global.d.ts declares a loose `h` + permissive JSX so custom attrs stay typed
import { h } from '@stencil/core/internal/client'
/* eslint-enable @typescript-eslint/no-unused-vars */
import { SearchController } from './utils/search-controller'
import { getProvinciaName } from './utils/provincias'
import { iconClear, iconCheck, iconPin, iconRetry } from './utils/icons'
import { flatItems, activeOptionId, renderOptionGroups } from './utils/option-list'
import { parseDomicilio, merge } from '@spain-address/core'

/** @stencil/core's published types for the records this component renders. */
type AddressRecord = import('@spain-address/core').AddressRecord
type SearchGroup = import('@spain-address/core').SearchGroup
type DomicilioUnit = import('@spain-address/core').DomicilioUnit
type DireccionNormalizada = import('@spain-address/core').DireccionNormalizada

@Component({
  tag: 'address-search-es',
  styleUrl: 'address-search-es.css',
  shadow: true,
})
export class AddressSearchEs {
  @Element() el!: HTMLElement
  private input?: HTMLInputElement
  private debounceHandle: ReturnType<typeof setTimeout> | undefined
  /** Shared search engine (debounce stays here; abort/race-guard in the controller). */
  private controller = new SearchController(() => ({
    endpoint: this.endpoint,
    typesenseHost: this.typesenseHost,
    typesensePort: this.typesensePort,
    typesenseApiKey: this.typesenseApiKey,
    typesenseProtocol: this.typesenseProtocol,
  }))
  /** Last accepted selection (drives the inline ✓ + detail card/chip). */
  @State() selected: AddressRecord | null = null
  /** Parsed "datos del domicilio" unit from the last typed query (input-side only). */
  @State() unidad: DomicilioUnit | null = null

  /* ===== observed attributes (public API) ===== */
  /**
   * URL of a search proxy (BFF) that wraps Typesense server-side, e.g.
   * "/api/address-search". When set, the widget fetches JSON from this
   * endpoint instead of talking to Typesense directly — so no credentials
   * are exposed to the client. The endpoint must accept `?q=&cp=&per_page=
   * &group_limit=&provincia=&municipio=` and return the same shape as
   * `SearchResult` from @spain-address/core.
   */
  @Prop({ reflect: true }) endpoint = ''
  @Prop({ reflect: true }) typesenseHost = ''
  @Prop({ reflect: true }) typesensePort = 8108
  @Prop({ reflect: true }) typesenseApiKey = ''
  @Prop({ reflect: true }) typesenseProtocol: 'http' | 'https' = 'http'
  /** 2-digit CPRO (e.g. "28") to pre-scope the search. */
  @Prop({ reflect: true }) scopeProvincia = ''
  /** 5-digit INE municipio_id to pre-scope the search. */
  @Prop({ reflect: true }) scopeMunicipio = ''
  /** When true, a 5-digit query routes to the CP filter instead of text search. */
  @Prop({ reflect: true }) detectCp = true
  @Prop({ reflect: true }) placeholder = 'Escribe una calle, municipio o código postal…'
  /** Max municipio groups rendered (Typesense `per_page`). */
  @Prop({ reflect: true }) maxGroups = 3
  /** Max streets per group (Typesense `group_limit`). */
  @Prop({ reflect: true }) groupLimit = 3
  /** Input debounce in ms before issuing a search. */
  @Prop({ reflect: true }) debounceMs = 250
  /** Control size — MUI Joy Input metrics. Default `sm` (32px / 0.875rem). */
  @Prop({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'sm'
  /**
   * How the accepted selection is surfaced:
   *  - `none` (default): the selected label fills the input, inline ✓ only;
   *  - `chip`: legacy green confirmation chip below the input;
   *  - `inline-card`: structured normalized-address breakdown inside the widget.
   */
  @Prop({ reflect: true }) detail: 'none' | 'chip' | 'inline-card' = 'none'
  /** Footer "Powered by" backlink href. */
  @Prop({ reflect: true }) poweredByHref = 'https://calle.alami.es'
  /** Footer "Powered by" backlink label. */
  @Prop({ reflect: true }) poweredByLabel = 'calle.alami.es'

  /* ===== events ===== */
  @Event() addressSelected!: EventEmitter<AddressRecord>
  @Event() addressNormalized!: EventEmitter<DireccionNormalizada>
  @Event() addressCleared!: EventEmitter<void>
  @Event() scopeChanged!: EventEmitter<{ provincia: string }>
  @Event() error!: EventEmitter<{ message: string; code?: number }>

  /* ===== UI state ===== */
  @State() query = ''
  @State() groups: SearchGroup[] = []
  @State() total = 0
  @State() loading = false
  @State() open = false
  @State() focused = -1
  @State() errorMsg = ''

  private static readonly CP_RE = /^\d{5}$/

  private isFiveDigits(v: string): boolean {
    return AddressSearchEs.CP_RE.test(v.trim())
  }

  private scheduleSearch(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.loading = true
    this.debounceHandle = setTimeout(() => {
      this.debounceHandle = undefined
      void this.doSearch()
    }, this.debounceMs)
  }

  private async doSearch(): Promise<void> {
    const q = this.query.trim()
    if (q.length < 2) {
      this.clearResults()
      this.open = false
      this.loading = false
      return
    }
    this.loading = true
    const outcome = await this.controller.search({
      query: q,
      perPage: this.maxGroups,
      groupLimit: this.groupLimit,
      detectCp: this.detectCp,
      provincia: this.scopeProvincia || undefined,
      municipio: this.scopeMunicipio || undefined,
    })
    // A newer search superseded this one (or it was aborted) — leave `loading`
    // and the result state to the newest call.
    if (outcome.status === 'superseded') return
    this.loading = false
    if (outcome.status === 'error') {
      this.handleError(outcome.message, outcome.code)
      return
    }
    this.groups = outcome.result.groups
    this.total = outcome.result.total
    this.open = true
    this.focused = outcome.result.groups.length ? 0 : -1
    this.errorMsg = ''
  }

  /** Keep the menu OPEN on failure and render an error row + retry (finding #1). */
  private handleError(message: string, code?: number): void {
    this.errorMsg = message
    this.error.emit({ message, code })
    this.open = true
  }

  private clearResults(): void {
    this.groups = []
    this.total = 0
    this.errorMsg = ''
  }

  /* ===== event handlers ===== */
  private onInput = (e: Event): void => {
    const value = (e.target as HTMLInputElement).value
    this.query = value
    this.selected = null
    this.unidad = null
    if (value.trim().length >= 2) {
      this.scheduleSearch()
    } else {
      this.clearResults()
      this.open = false
      this.focused = -1
      this.addressCleared.emit()
    }
  }

  private onFocus = (): void => {
    if (this.query.trim().length >= 2 || this.groups.length) this.open = true
  }

  private onBlur = (): void => {
    // Close only when focus leaves the whole component (not a menu/footer click).
    // `document.activeElement` is the host while focus sits inside the shadow
    // root, so `el.contains(activeElement)` stays true for internal moves.
    setTimeout(() => {
      if (!this.el.contains(document.activeElement as Node)) this.open = false
    }, 120)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.open) return
    const items = flatItems(this.groups)
    if (items.length === 0) {
      if (e.key === 'Escape') {
        this.open = false
        this.focused = -1
        this.input?.focus()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.focused = (this.focused + 1) % items.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.focused = (this.focused - 1 + items.length) % items.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = this.focused >= 0 ? this.focused : 0
      const item = items[idx]
      if (item) this.selectItem(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this.open = false
      this.focused = -1
      this.input?.focus()
    }
  }

  /** ==== Public imperative API (host-facing) ====
   *  Exposed via `@Method` so host frameworks can drive the widget without DOM
   *  poking its internals:
   *    await el.clear()
   *    const picked = await el.getSelection()
   */
  @Method()
  async clear(): Promise<void> {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.controller.cancel()
    this.query = ''
    this.clearResults()
    this.selected = null
    this.unidad = null
    this.open = false
    this.focused = -1
    this.loading = false
    this.addressCleared.emit()
    this.input?.focus()
  }

  @Method()
  async getSelection(): Promise<AddressRecord | null> {
    return this.selected
  }

  /** Host-driven set/clear of the current selection (complements `clear()`). */
  @Method()
  async setSelection(record: AddressRecord | null): Promise<void> {
    this.selected = record
    this.unidad = null
    this.query = record ? record.label ?? '' : ''
    this.clearResults()
    this.open = false
    this.focused = -1
  }

  private onClear = (): void => {
    void this.clear()
  }

  private onUnselect = (): void => {
    this.selected = null
    this.unidad = null
    this.query = ''
    this.addressCleared.emit()
    this.input?.focus()
  }

  private onUnscope = (): void => {
    this.scopeProvincia = ''
    this.scopeMunicipio = ''
    this.scopeChanged.emit({ provincia: '' })
    void this.doSearch()
  }

  private onRetry = (): void => {
    this.errorMsg = ''
    void this.doSearch()
  }

  private selectItem(item: AddressRecord): void {
    const typed = this.query
    this.addressSelected.emit(item)
    this.selected = item
    // Parse the unit ("datos del domicilio") out of the typed query and merge it
    // onto the matched street record — input-side only, never indexed.
    const { unidad, heuristic } = parseDomicilio(typed)
    this.unidad = unidad
    this.addressNormalized.emit(
      merge(item, unidad, heuristic ? 'parcial' : 'exact'),
    )
    // Selection fills the input with the label (consistent with `setSelection`).
    this.query = item.label ?? ''
    this.clearResults()
    this.open = false
    this.focused = -1
    this.input?.focus()
  }

  /* ===== navigation (flat options only — headers are non-interactive) ===== */
  private activeId(): string | undefined {
    return activeOptionId(this.groups, this.focused, 'aes')
  }

  /** Scroll the focused option into view after each re-render. */
  componentDidUpdate(): void {
    const id = this.activeId()
    if (id) {
      const el = this.el.shadowRoot?.getElementById(id)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }

  disconnectedCallback(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.controller.cancel()
  }

  render() {
    const cpMode = this.detectCp && this.isFiveDigits(this.query.trim())
    const count = this.groups.length
    const showFooter = this.open && !this.errorMsg && count > 0
    const showProgress = this.loading && count > 0

    return (
      <div class={{ aes: true, open: this.open }}>
        <label class="aes-sr" htmlFor="aes-input">
          Buscar calle, municipio o código postal
        </label>

        <div class={{ 'aes-input-row': true, loading: this.loading }} id="input-row">
          <input
            ref={(el: HTMLInputElement | undefined) => (this.input = el)}
            id="aes-input"
            class="aes-input"
            type="search"
            inputMode="search"
            placeholder={this.placeholder}
            value={this.query}
            onInput={this.onInput}
            onKeyDown={this.onKeyDown}
            onFocus={this.onFocus}
            onBlur={this.onBlur}
            aria-autocomplete="list"
            aria-expanded={this.open}
            aria-controls="aes-listbox"
            aria-activedescendant={this.activeId()}
            aria-label={cpMode ? 'Código postal' : 'Buscar dirección'}
            autoComplete="off"
          />
          <div class="aes-trailing">
            {this.selected && !this.loading ? (
              <span class="aes-check" aria-hidden="true">
                {iconCheck()}
              </span>
            ) : null}
            {this.loading ? <span class="aes-spinner" aria-hidden="true" /> : null}
            {!this.loading && this.query ? (
              <button class="aes-clear" aria-label="Borrar" type="button" onClick={this.onClear}>
                {iconClear()}
              </button>
            ) : null}
          </div>
        </div>

        {showProgress ? (
          <div class="aes-progress" aria-hidden="true">
            <span />
          </div>
        ) : null}

        {this.selected && this.detail === 'chip' ? (
          <div class="aes-selected-chip" role="status">
            <span class="aes-selected-check" aria-hidden="true">
              {iconCheck()}
            </span>
            <span class="aes-selected-label">{this.selected.label}</span>
            <button
              aria-label="Quitar dirección seleccionada"
              type="button"
              onClick={this.onUnselect}
            >
              {iconClear()}
            </button>
          </div>
        ) : null}

        {this.selected && this.detail === 'inline-card' ? this.renderCard(this.selected) : null}

        {this.scopeProvincia ? (
          <div class="aes-scope-chip">
            <span class="aes-scope-pin" aria-hidden="true">
              {iconPin()}
            </span>
            <span>{getProvinciaName(this.scopeProvincia)}</span>
            <button aria-label="Quitar filtro de provincia" type="button" onClick={this.onUnscope}>
              {iconClear()}
            </button>
          </div>
        ) : null}

        <div class="aes-status aes-sr" role="status" aria-live="polite">
          {this.open ? `${this.total} resultados` : ''}
        </div>

        <div class="aes-menu" aria-hidden={!this.open}>
          {this.errorMsg ? (
            <div class="aes-error" role="alert">
              <span class="aes-error-msg">{this.errorMsg}</span>
              <button class="aes-retry" type="button" onClick={this.onRetry}>
                {iconRetry()}
                <span>Reintentar</span>
              </button>
            </div>
          ) : (
            <div
              class="aes-listbox"
              id="aes-listbox"
              role="listbox"
              aria-label="Resultados de dirección"
            >
              {this.loading && count === 0
                ? this.renderSkeleton()
                : count === 0 && this.open
                  ? this.query.trim()
                    ? (
                      <div class="aes-empty" role="presentation">
                        No se encontraron resultados para <b>{this.query.trim()}</b>.
                      </div>
                    )
                    : null
                  : renderOptionGroups(this.groups, this.focused, (it) => this.selectItem(it), 'aes')}
            </div>
          )}

          {showFooter ? (
            <div class="aes-footer">
              <span class="aes-footer-count">
                {this.total > count
                  ? `Mostrando los ${count} primeros de ${this.total}`
                  : `${this.total} resultado${this.total === 1 ? '' : 's'}`}
                {cpMode ? ' (CP)' : ''}
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
    )
  }

  /** Structured normalized-address breakdown (ported from examples/vanilla.html). */
  private renderCard(r: AddressRecord) {
    const u = this.unidad
    return (
      <div class="aes-card" role="status">
        <div class="aes-card-header">
          <span class="aes-card-title">
            <span class="aes-card-check" aria-hidden="true">
              {iconCheck()}
            </span>
            Dirección seleccionada
          </span>
          <button
            class="aes-card-close"
            aria-label="Quitar dirección seleccionada"
            type="button"
            onClick={this.onUnselect}
          >
            {iconClear()}
          </button>
        </div>
        <div class="aes-card-body">
          <div class="aes-card-field">
            <span class="aes-card-label">Calle</span>
            <span class="aes-card-value">{r.via_nombre_completo}</span>
          </div>
          {u?.sin_numero ? (
            <div class="aes-card-field">
              <span class="aes-card-label">Número</span>
              <span class="aes-card-value">S/N</span>
            </div>
          ) : u?.numero ? (
            <div class="aes-card-field">
              <span class="aes-card-label">Número</span>
              <span class="aes-card-value">{u.numero}</span>
            </div>
          ) : null}
          {u?.piso ? (
            <div class="aes-card-field">
              <span class="aes-card-label">Piso</span>
              <span class="aes-card-value">{u.piso}</span>
            </div>
          ) : null}
          {u?.puerta ? (
            <div class="aes-card-field">
              <span class="aes-card-label">Puerta</span>
              <span class="aes-card-value">{u.puerta}</span>
            </div>
          ) : null}
          {u?.portal ? (
            <div class="aes-card-field">
              <span class="aes-card-label">Portal</span>
              <span class="aes-card-value">{u.portal}</span>
            </div>
          ) : null}
          {u?.bloque ? (
            <div class="aes-card-field">
              <span class="aes-card-label">Bloque</span>
              <span class="aes-card-value">{u.bloque}</span>
            </div>
          ) : null}
          {u?.escalera ? (
            <div class="aes-card-field">
              <span class="aes-card-label">Escalera</span>
              <span class="aes-card-value">{u.escalera}</span>
            </div>
          ) : null}
          {u?.kilometros ? (
            <div class="aes-card-field">
              <span class="aes-card-label">Km</span>
              <span class="aes-card-value">{u.kilometros}</span>
            </div>
          ) : null}
          <div class="aes-card-field">
            <span class="aes-card-label">Municipio</span>
            <span class="aes-card-value">{r.municipio}</span>
          </div>
          <div class="aes-card-field">
            <span class="aes-card-label">Provincia</span>
            <span class="aes-card-value">{r.provincia}</span>
          </div>
          <div class="aes-card-field">
            <span class="aes-card-label">Código postal</span>
            <span class="aes-card-value">{r.codigo_postal}</span>
          </div>
          <div class="aes-card-field">
            <span class="aes-card-label">Comunidad autónoma</span>
            <span class="aes-card-value">{r.comunidad_autonoma}</span>
          </div>
          <div class="aes-card-meta">
            <span class="aes-tag">
              <strong>CPRO</strong>
              {r.provincia_id}
            </span>
            <span class="aes-tag">
              <strong>CMUN</strong>
              {r.municipio_id}
            </span>
            <span class="aes-tag">
              <strong>CCAA</strong>
              {r.comunidad_autonoma_id}
            </span>
          </div>
        </div>
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
}
