/**
 * Dependency-free typo-tolerant matching for the geo comboboxes
 * (Provincia / Municipio / Código postal).
 *
 * The lists are tiny (52 provincias, ≤~311 municipios per provincia, ≤~100 CPs)
 * and already fetched in full, so matching runs client-side with zero latency
 * per keystroke. The matcher is accent- and particle-aware:
 *
 *  - `normalize` strips diacritics via NFD so `málaga`/`Málaga`/`malaga` all
 *    compare equal (and `ñ`/`ü` collapse to `n`/`u`, as the rest of the repo).
 *  - a small Spanish stop-word set (`el, la, los, las, de, del, al, …`) lets a
 *    query like `rozas` match `Las Rozas`, or `de la frntera` match
 *    `De la Frontera`, by comparing stop-word-stripped token lists too.
 *
 * Ranking is deterministic, in strict bands: exact > stop-word-exact > code
 * prefix > token prefix > substring > edit distance.
 */

/** Lowercase + strip diacritics (NFD). `ñ` → `n`, `ü` → `u`, accents dropped. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Split a normalized name into tokens (letters + digits only). */
export function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Spanish articles/particles/connectors ignored for stop-word-invariant matching. */
export const SPANISH_STOP_WORDS: ReadonlySet<string> = new Set([
  'el', 'la', 'lo', 'los', 'las',
  'de', 'del', 'al', 'a',
  'un', 'una', 'unos', 'unas',
  'san', 'santa', 'santo',
  'y',
])

/** Tokens minus the Spanish stop words (used as a secondary comparison key). */
export function compactTokens(s: string): string[] {
  return tokenize(s).filter((t) => !SPANISH_STOP_WORDS.has(t))
}

/**
 * Optimal string alignment distance (Damerau-Levenshtein: insert / delete /
 * substitute / adjacent transposition). O(m·n); lists are tiny so no bound.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[m][n]
}

/** Fraction (0..1) of query tokens that prefix some candidate token. */
function prefixMatch(qTokens: string[], cTokens: string[]): number {
  if (qTokens.length === 0 || cTokens.length === 0) return 0
  let matched = 0
  for (const qt of qTokens) {
    if (cTokens.some((ct) => ct.startsWith(qt))) matched++
  }
  return matched / qTokens.length
}

/**
 * Rank a query against one candidate name (+ optional code). Higher is better;
 * `0` means "no match". Bands (never overlap):
 *   1000            exact (normalized full equality)
 *   960             stop-word-invariant exact (`rozas` ≡ `Las Rozas`)
 *   900..940        numeric code prefix (`28`, `28079`)
 *   800..899        token prefix (autocomplete)
 *   620..650        substring contains
 *   400..499        edit distance within threshold (typo tolerance)
 */
export function score(query: string, candidate: string, code?: string): number {
  const q = normalize(query)
  if (!q) return 0
  const c = normalize(candidate)
  if (c && q === c) return 1000

  const qt = tokenize(query)
  const ct = tokenize(candidate)
  const qc = qt.filter((t) => !SPANISH_STOP_WORDS.has(t))
  const cc = ct.filter((t) => !SPANISH_STOP_WORDS.has(t))

  if (qc.length > 0 && cc.length > 0 && qc.join(' ') === cc.join(' ')) return 960

  if (code && /^[0-9]+$/.test(q)) {
    const qn = q.replace(/^0+/, '')
    const cn = normalize(code).replace(/^0+/, '')
    if (qn && cn && cn.startsWith(qn)) return 940 - Math.min(40, qn.length)
  }

  const p = Math.max(prefixMatch(qt, ct), prefixMatch(qc, cc))
  if (p > 0) return 800 + Math.round(p * 99)

  if (c.includes(q)) return 650
  const qcs = qc.join(' ')
  const ccs = cc.join(' ')
  if (qcs && ccs && (ccs.includes(qcs) || qcs.includes(ccs))) return 620

  const a = ccs || c
  const b = qcs || q
  const dist = editDistance(a, b)
  const maxLen = Math.max(a.length, b.length)
  const threshold = Math.max(1, Math.floor(maxLen * 0.3))
  if (dist <= threshold) {
    return 400 + Math.round((1 - dist / maxLen) * 99)
  }
  return 0
}

/**
 * Rank `items` by fuzzy score against `query`. Empty query returns all items in
 * original order. Non-empty query returns only hits, best-first, ties broken by
 * original order, capped at `limit`.
 */
export function fuzzyMatch<T>(
  query: string,
  items: readonly T[],
  getText: (item: T) => string,
  getCode?: (item: T) => string,
  limit = 50,
): T[] {
  const q = normalize(query)
  if (!q) return [...items]
  const scored = items.map((item, index) => ({
    item,
    index,
    s: score(q, getText(item), getCode ? getCode(item) : undefined),
  }))
  const hits = scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.index - b.index)
  return (limit > 0 ? hits.slice(0, limit) : hits).map((x) => x.item)
}
