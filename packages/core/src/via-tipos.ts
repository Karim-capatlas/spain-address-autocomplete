/**
 * Spanish street-type ("tipo de vía") abbreviation handling for search queries.
 *
 * The INE Callejero indexes the canonical type in `via_nombre_completo`
 * (`Calle Villanubla`) and the bare name in `via_nombre` (`Villanubla`). Users
 * type conventional abbreviations (`c/`, `C.`, `Ctra`, `Avda`, `Pza`, `Pº`, …)
 * that never appear in the index — and a detached token like `c/` in
 * `c/ Villanubla` is worse than a miss: Typesense fuzzily matches the stray
 * `c/` against unrelated streets and then drops the meaningful name token,
 * returning noise or nothing at all.
 *
 * `normalizeSearchQuery` expands a recognized leading type to its canonical
 * full word (`c/ Villanubla` → `calle Villanubla`, `Ctra. X` → `carretera X`),
 * so the abbreviation matches the indexed `via_nombre_completo` exactly. Full
 * words are already canonical and pass through untouched, which keeps queries
 * like `Paseo de la Castellana` / `Plaza Mayor` ranking as before.
 */

/** Normalized abbreviation (or full word) -> canonical Spanish street type. */
export const VIA_TIPO_ABBREVIATIONS: Readonly<Record<string, string>> = {
  // Calle
  calle: 'Calle',
  c: 'Calle',
  cl: 'Calle',
  cll: 'Calle',
  // Avenida
  avenida: 'Avenida',
  avda: 'Avenida',
  avd: 'Avenida',
  av: 'Avenida',
  avgda: 'Avenida',
  // Plaza
  plaza: 'Plaza',
  plza: 'Plaza',
  plzla: 'Plaza',
  pza: 'Plaza',
  pl: 'Plaza',
  // Paseo
  paseo: 'Paseo',
  pso: 'Paseo',
  ps: 'Paseo',
  'pº': 'Paseo',
  'p.º': 'Paseo',
  'p.o': 'Paseo',
  // Ronda
  ronda: 'Ronda',
  rda: 'Ronda',
  // Travesía
  travesia: 'Travesía',
  trav: 'Travesía',
  trva: 'Travesía',
  trava: 'Travesía',
  trvsa: 'Travesía',
  // Carretera
  carretera: 'Carretera',
  ctra: 'Carretera',
  crta: 'Carretera',
  cra: 'Carretera',
  carre: 'Carretera',
  carr: 'Carretera',
  // Camino
  camino: 'Camino',
  cno: 'Camino',
  cmno: 'Camino',
  // Bulevar
  bulevar: 'Bulevar',
  bulev: 'Bulevar',
  blvd: 'Bulevar',
  blvr: 'Bulevar',
  // Glorieta
  glorieta: 'Glorieta',
  glta: 'Glorieta',
  gta: 'Glorieta',
  // Urbanización
  urbanizacion: 'Urbanización',
  urb: 'Urbanización',
  urbn: 'Urbanización',
  // Edificio
  edificio: 'Edificio',
  edif: 'Edificio',
  edf: 'Edificio',
  // Polígono
  poligono: 'Polígono',
  pol: 'Polígono',
  polig: 'Polígono',
  pg: 'Polígono',
  // Callejón
  callejon: 'Callejón',
  cjon: 'Callejón',
  cj: 'Callejón',
  // Pasaje
  pasaje: 'Pasaje',
  psaje: 'Pasaje',
  psje: 'Pasaje',
  pje: 'Pasaje',
  // Rambla
  rambla: 'Rambla',
  rbla: 'Rambla',
  // Alameda
  alameda: 'Alameda',
  alam: 'Alameda',
  // Cuesta
  cuesta: 'Cuesta',
  cta: 'Cuesta',
  // Vía
  via: 'Vía',
  'vª': 'Vía',
}

/** Lowercase a token and drop the trailing punctuation users attach to it. */
function typeKey(token: string): string | undefined {
  const key = token
    .toLowerCase()
    .replace(/[.,;:]+$/u, '')
    .replace(/\/+$/u, '')
    .trim()
  return Object.hasOwn(VIA_TIPO_ABBREVIATIONS, key) ? key : undefined
}

/** Join non-empty, trimmed parts with single spaces. */
function join(...parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Normalize a free-text address query for the search backend.
 *
 * A recognized leading street type is rewritten to its canonical full word so
 * abbreviations match the indexed `via_nombre_completo`:
 *   `c/ Villanubla` → `calle Villanubla`
 *   `c/Villanubla`  → `calle Villanubla`
 *   `Ctra. Villanubla` → `carretera Villanubla`
 * Full words (`calle`, `paseo`, `plaza`, …) are unchanged.
 */
export function normalizeSearchQuery(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return ''

  const m = trimmed.match(/^(\S+)(?:\s+([\s\S]*))?$/)
  if (!m) return trimmed
  const first = m[1]
  const rest = (m[2] ?? '').trim()

  // Slash-attached form: "c/Villanubla" / "C/MAYOR".
  const slash = first.indexOf('/')
  if (slash > 0 && slash < first.length - 1) {
    const prefixKey = typeKey(first.slice(0, slash))
    if (prefixKey) {
      return join(VIA_TIPO_ABBREVIATIONS[prefixKey], first.slice(slash + 1), rest)
    }
  }

  const key = typeKey(first)
  if (key) return join(VIA_TIPO_ABBREVIATIONS[key], rest)
  return trimmed
}
