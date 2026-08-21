/**
 * address-search-es — StencilJS Web Component for Spanish address autocomplete.
 *
 * Framework-agnostic: drops into any page as `<address-search-es>`. Stencil's
 * `@stencil/react-output-target` (configured in stencil.config.ts) generates the
 * typed React / Vue / Angular wrappers from this single component.
 *
 * Designed for the national index (749k docs / 52 provinces): results are
 * grouped by `municipio`, a 5-digit query routes to `filter_by cp`, and groups
 * are capped by `maxGroups` / expandable.
 */
import { Component, Prop, State, Event, EventEmitter, Element } from '@stencil/core'
// `h` is the JSX factory; the sandbox compiler's `syntheticRender` h-injection is
// dormant, so we import it from the non-public `@stencil/core/internal/client`
// subpath — rollup inlines+renames the real factory and links render() to it.
/* eslint-disable @typescript-eslint/no-unused-vars -- `h` is the JSX factory (jsxFactory); consumed by the JSX→h() emit, not referenced as a value in TS source */
// @ts-expect-error -- no public .d.ts; global.d.ts declares a loose `h` + permissive JSX so custom attrs stay typed
import { h } from '@stencil/core/internal/client'
/* eslint-enable @typescript-eslint/no-unused-vars */
import { createTypesenseClient, searchAddresses } from '@spain-address/core'

/** @stencil/core's published types for the records this component renders. */
type AddressRecord = import('@spain-address/core').AddressRecord
type SearchGroup = import('@spain-address/core').SearchGroup
type TypesenseClient = import('@spain-address/core').TypesenseClient

interface NavNode {
  kind: 'header' | 'item'
  g: number
  i?: number
}

@Component({
  tag: 'address-search-es',
  styleUrl: 'address-search-es.css',
  shadow: true,
})
export class AddressSearchEs {
  @Element() el!: HTMLElement
  private input?: HTMLInputElement
  private debounceHandle: ReturnType<typeof setTimeout> | undefined
  private collapsed = new Set<string>() // municipio_id -> collapsed

  /* ===== observed attributes (public API) ===== */
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
  @Prop({ reflect: true }) maxGroups = 8
  /** Max streets per group (Typesense `group_limit`). */
  @Prop({ reflect: true }) groupLimit = 3
  /** Input debounce in ms before issuing a search. */
  @Prop({ reflect: true }) debounceMs = 250

  /* ===== events ===== */
  @Event() addressSelected!: EventEmitter<AddressRecord>
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

  private client(): TypesenseClient | null {
    if (!this.typesenseHost) {
      const msg = 'attribute "typesense-host" is required'
      this.errorMsg = msg
      this.error.emit({ message: msg })
      return null
    }
    if (!this.typesenseApiKey) {
      const msg = 'attribute "typesense-api-key" is required'
      this.errorMsg = msg
      this.error.emit({ message: msg })
      return null
    }
    return createTypesenseClient({
      config: {
        host: this.typesenseHost,
        port: this.typesensePort,
        protocol: this.typesenseProtocol,
        apiKey: this.typesenseApiKey,
      },
    })
  }

  private async doSearch(): Promise<void> {
    const q = this.query.trim()
    if (q.length < 2) {
      this.clearResults()
      this.open = false
      return
    }
    const client = this.client()
    if (!client) return

    this.loading = true
    this.errorMsg = ''
    try {
      const cp = this.detectCp && this.isFiveDigits(q)
      const result = await searchAddresses(
        {
          query: cp ? '' : q,
          perPage: this.maxGroups,
          groupLimit: this.groupLimit,
          filterByCP: cp ? q : undefined,
          filterByProvincia: this.scopeProvincia || undefined,
          filterByMunicipio: this.scopeMunicipalidad(),
          // §3.1.7: bold matched tokens inside the result label.
          highlight: true,
        },
        { client },
      )
      this.groups = result.groups
      this.total = result.total
      this.open = true
      this.focused = result.groups.length ? 0 : -1
      this.errorMsg = ''
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // @ts-expect-error HTTP errors carry a status
      const code = e?.status
      if (msg !== 'AbortError' && !msg.includes('aborted')) {
        this.errorMsg = msg
        this.error.emit({ message: msg, code })
        this.open = false
      }
    } finally {
      this.loading = false
    }
  }

  private scopeMunicipalidad(): string | undefined {
    return this.scopeMunicipio || undefined
  }

  private scheduleSearch(): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle)
    this.loading = true
    this.debounceHandle = setTimeout(() => {
      this.debounceHandle = undefined
      void this.doSearch()
    }, this.debounceMs)
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
    // defocus only if focus leaves the whole component (not a menu click)
    setTimeout(() => {
      if (!this.el.contains(document.activeElement as Node)) this.open = false
    }, 120)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.open) return
    const nav = this.navNodes()
    if (nav.length === 0) {
      if (e.key === 'Escape') {
        this.open = false
        this.focused = -1
        this.input?.focus()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.focused = (this.focused + 1) % nav.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.focused = (this.focused - 1 + nav.length) % nav.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const focusedIdx = this.focused >= 0 ? this.focused : 0
      const node = nav[focusedIdx]
      if (!node) return
      if (node.kind === 'header') {
        const g = this.groups[node.g]
        this.toggleGroup(g.municipio_id)
      } else {
        const g = this.groups[node.g]
        const item = g?.items[node.i as number]
        if (item) {
          this.selectItem(item)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this.open = false
      this.focused = -1
      this.input?.focus()
    }
  }

  private onClear = (): void => {
    this.query = ''
    this.clearResults()
    this.open = false
    this.focused = -1
    this.addressCleared.emit()
    this.input?.focus()
  }

  private onUnscope = (): void => {
    this.scopeProvincia = ''
    this.scopeMunicipio = ''
    this.scopeChanged.emit({ provincia: '' })
    void this.doSearch()
  }

  private onVerTodo = (): void => {
    window.alert('En la app real: abrir resultados completos (paginación).')
  }

  private selectItem(item: AddressRecord): void {
    this.addressSelected.emit(item)
    this.query = ''
    this.clearResults()
    this.open = false
    this.input?.focus()
  }

  private toggleGroup(id: string): void {
    if (this.collapsed.has(id)) this.collapsed.delete(id)
    else this.collapsed.add(id)
  }

  /* ===== navigation ===== */
  private navNodes(): NavNode[] {
    const out: NavNode[] = []
    this.groups.forEach((g, gi) => {
      out.push({ kind: 'header', g: gi })
      if (!this.collapsed.has(g.municipio_id)) {
        g.items.forEach((_, i) => out.push({ kind: 'item', g: gi, i }))
      }
    })
    return out
  }

  private activeId(): string | undefined {
    if (this.focused < 0) return undefined
    const nav = this.navNodes()
    const node = nav[this.focused]
    if (!node) return undefined
    return node.kind === 'header'
      ? `aes-h-${node.g}`
      : `aes-i-${node.g}-${node.i}`
  }

  private isFocused(node: NavNode): boolean {
    const nav = this.navNodes()
    const idx = nav.findIndex(
      (n) => node.kind === n.kind && n.g === node.g && (node.i ?? -1) === (n.i ?? -1),
    )
    return idx === this.focused
  }

  /** Scroll the focused option into view after each relayer. */
  componentDidUpdate(): void {
    const id = this.activeId()
    if (id) {
      const el = this.el.shadowRoot?.getElementById(id)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }

  render() {
    const cpMode = this.detectCp && this.isFiveDigits(this.query.trim())
    const count = this.groups.length
    const showingFooter = this.open && this.total > count && count > 0

    return (
      <div class={{ 'aes': true, open: this.open }}>
        <label class="aes-sr" htmlFor="aes-input">
          Buscar calle, municipio o código postal
        </label>
        <div
          class={{
            'aes-input-row': true,
            loading: this.loading,
          }}
          id="input-row"
        >
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
            aria-controls="aes-menu"
            aria-activedescendant={this.activeId()}
            aria-label={cpMode ? 'Código postal' : 'Buscar dirección'}
            autoComplete="off"
          />
          <span class="aes-spinner" aria-hidden="true" />
          <button class="aes-clear" aria-label="Borrar" type="button" onClick={this.onClear}>
            ✕
          </button>
        </div>

        {this.scopeProvincia ? (
          <div class="aes-scope-chip">
            <span>📍 {this.scopeProvincia}</span>
            <button aria-label="Quitar filtro de provincia" type="button" onClick={this.onUnscope}>
              ✕
            </button>
          </div>
        ) : null}

        <div class="aes-menu" id="aes-menu" role="listbox" aria-hidden={!this.open} tabIndex={-1}>
          {this.errorMsg ? (
            <div class="aes-empty">{this.errorMsg}</div>
          ) : this.loading ? (
            this.renderSkeleton()
          ) : this.groups.length === 0 && this.open ? (
            this.query.trim() ? (
              <div class="aes-empty">
                No se encontraron resultados para <b>{this.query.trim()}</b>.
              </div>
            ) : null
          ) : (
            this.renderGroups()
          )}
          {showingFooter ? (
            <div class="aes-footer">
              <span>
                Mostrando los {count} primeros de {this.total}
                {cpMode ? ' (CP)' : ''}
              </span>
              <button type="button" onClick={this.onVerTodo}>
                Ver todo
              </button>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  private renderSkeleton() {
    return (
      <div class="aes-skel-area">
        <div class="skel-row">
          <span class="skel-line lab" />
          <span class="skel-line sub" />
        </div>
        <div class="skel-row">
          <span class="skel-line lab" />
          <span class="skel-line sub" />
        </div>
        <div class="skel-row">
          <span class="skel-line lab" />
          <span class="skel-line sub" />
        </div>
      </div>
    )
  }

  /** §3.1.7: render `via_nombre_completo` with Typesense's `<mark>`-wrapped matched
   *  tokens bolded (e.g. "Travesía `<mark>Calle</mark> <mark>Mayor</mark>`").
   *  Falls back to the plain name when no highlights are present on the hit. */
  private renderHighlighted(item: AddressRecord): (string | JSX.Element)[] {
    const snippet = item.highlights?.find((h) => h.field === 'via_nombre_completo')?.snippet
    if (!snippet) return [item.via_nombre_completo]
    const parts: (string | JSX.Element)[] = []
    const re = /<mark>(.*?)<\/mark>/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(snippet)) !== null) {
      if (m.index > last) parts.push(snippet.slice(last, m.index))
      parts.push(<mark>{m[1] ?? ''}</mark>)
      last = m.index + m[0].length
    }
    if (last < snippet.length) parts.push(snippet.slice(last))
    return parts
  }

  private renderGroups() {
    return this.groups.map((g, gi) => {
      const collapsed = this.collapsed.has(g.municipio_id)
      const navHeader: NavNode = { kind: 'header', g: gi }
      return (
        <div
          class="aes-group"
          key={`g-${gi}`}
          aria-label={`${g.municipio}, ${g.provincia} · ${g.codigo_postal || 'CP'}`}
          open={collapsed ? 'false' : 'true'}
        >
          <div
            id={`aes-h-${gi}`}
            class={`aes-group-header${this.isFocused(navHeader) ? ' hi' : ''}`}
            role="button"
            tabIndex={0}
            aria-expanded={!collapsed}
            onClick={() => this.toggleGroup(g.municipio_id)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                this.toggleGroup(g.municipio_id)
              }
            }}
          >
            <span class="aes-group-via">{g.municipio || g.municipio_id}</span>
            <span class="aes-group-sub">
              {g.municipio}, {g.provincia} · {g.codigo_postal || 'CP'}
            </span>
            <span class="aes-chevron" aria-hidden="true">
              ▾
            </span>
          </div>
          <div class="aes-children">
            {g.items.map((it, i) => {
              const navItem: NavNode = { kind: 'item', g: gi, i }
              return (
                <li
                  key={`it-${gi}-${i}`}
                  id={`aes-i-${gi}-${i}`}
                  class={`aes-item${this.isFocused(navItem) ? ' hi' : ''}`}
                  role="option"
                  aria-selected={false}
                  aria-label={
                    it.label ||
                    `${it.via_nombre_completo}, ${it.municipio} (${it.codigo_postal})`
                  }
                  onClick={() => this.selectItem(it)}
                >
                  <span class="aes-label">{this.renderHighlighted(it)}</span>
                  <span class="aes-sub">
                    {it.municipio}, {it.provincia} · {it.codigo_postal}
                  </span>
                </li>
              )
            })}
          </div>
        </div>
      )
    })
  }
}
