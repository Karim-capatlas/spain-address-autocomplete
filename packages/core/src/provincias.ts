/**
 * Static 52-provincia INE reference for locality auto-detection.
 *
 * Mirrors the table shipped in `packages/etl` / `packages/widget` (the repo
 * already duplicates this small list per package to keep bundles
 * self-contained). Used by `locality.ts` to recognise a trailing province name
 * in a free-text query — e.g. `… TORRELAVEGA, CANTABRIA` — and to constrain the
 * municipio lookup to that province.
 *
 * Attribution: © Instituto Nacional de Estadística (INE).
 */

export interface ProvinciaInfo {
  /** CPRO, 2-digit zero-padded (e.g. "39"). */
  code: string
  /** Castilian province name. */
  name: string
  /** Common alternative spellings / co-official names. */
  aliases: readonly string[]
}

export const PROVINCIAS: readonly ProvinciaInfo[] = [
  { code: '01', name: 'Álava', aliases: ['Araba', 'Alava'] },
  { code: '02', name: 'Albacete', aliases: [] },
  { code: '03', name: 'Alicante', aliases: ['Alacant'] },
  { code: '04', name: 'Almería', aliases: [] },
  { code: '05', name: 'Ávila', aliases: [] },
  { code: '06', name: 'Badajoz', aliases: [] },
  { code: '07', name: 'Baleares', aliases: ['Illes Balears', 'Islas Baleares', 'Balears'] },
  { code: '08', name: 'Barcelona', aliases: [] },
  { code: '09', name: 'Burgos', aliases: [] },
  { code: '10', name: 'Cáceres', aliases: [] },
  { code: '11', name: 'Cádiz', aliases: [] },
  { code: '12', name: 'Castellón', aliases: ['Castelló'] },
  { code: '13', name: 'Ciudad Real', aliases: [] },
  { code: '14', name: 'Córdoba', aliases: [] },
  { code: '15', name: 'A Coruña', aliases: ['La Coruña', 'Coruña'] },
  { code: '16', name: 'Guadalajara', aliases: [] },
  { code: '17', name: 'Girona', aliases: ['Gerona'] },
  { code: '18', name: 'Granada', aliases: [] },
  { code: '19', name: 'Gipuzkoa', aliases: ['Guipúzcoa', 'Guipuzcoa'] },
  { code: '20', name: 'Bizkaia', aliases: ['Vizcaya'] },
  { code: '21', name: 'León', aliases: [] },
  { code: '22', name: 'Huesca', aliases: [] },
  { code: '23', name: 'Huelva', aliases: [] },
  { code: '24', name: 'Jaén', aliases: [] },
  { code: '25', name: 'Lleida', aliases: ['Lérida', 'Lerida'] },
  { code: '26', name: 'La Rioja', aliases: ['Rioja'] },
  { code: '27', name: 'Lugo', aliases: [] },
  { code: '28', name: 'Madrid', aliases: ['Comunidad de Madrid'] },
  { code: '29', name: 'Málaga', aliases: [] },
  { code: '30', name: 'Murcia', aliases: [] },
  { code: '31', name: 'Navarra', aliases: ['Nafarroa'] },
  { code: '32', name: 'Ourense', aliases: ['Orense'] },
  { code: '33', name: 'Asturias', aliases: ['Principado de Asturias'] },
  { code: '34', name: 'Segovia', aliases: [] },
  { code: '35', name: 'Las Palmas', aliases: [] },
  { code: '36', name: 'Pontevedra', aliases: [] },
  { code: '37', name: 'Soria', aliases: [] },
  { code: '38', name: 'Santa Cruz de Tenerife', aliases: ['Tenerife'] },
  { code: '39', name: 'Cantabria', aliases: [] },
  { code: '40', name: 'Toledo', aliases: [] },
  { code: '41', name: 'Sevilla', aliases: ['Seville'] },
  { code: '42', name: 'Salamanca', aliases: [] },
  { code: '43', name: 'Tarragona', aliases: [] },
  { code: '44', name: 'Teruel', aliases: [] },
  { code: '45', name: 'Cuenca', aliases: [] },
  { code: '46', name: 'Valencia', aliases: ['València'] },
  { code: '47', name: 'Valladolid', aliases: [] },
  { code: '48', name: 'Palencia', aliases: [] },
  { code: '49', name: 'Zamora', aliases: [] },
  { code: '50', name: 'Zaragoza', aliases: ['Saragossa'] },
  { code: '53', name: 'Ceuta', aliases: [] },
  { code: '54', name: 'Melilla', aliases: [] },
]

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,;:()[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const BY_NAME = new Map<string, ProvinciaInfo>()
for (const provincia of PROVINCIAS) {
  BY_NAME.set(normalizeName(provincia.name), provincia)
  for (const alias of provincia.aliases) BY_NAME.set(normalizeName(alias), provincia)
}
/** Multi-token province names first, so the longest suffix wins. */
const MAX_NAME_WORDS = Math.max(
  ...PROVINCIAS.flatMap((p) => [p.name, ...p.aliases]).map((n) => normalizeName(n).split(' ').length),
)

export interface ProvinciaSuffix {
  info: ProvinciaInfo
  /** How many trailing tokens formed the province name. */
  tokenCount: number
}

/**
 * Match the longest suffix of `tokens` against a province name or alias, e.g.
 * `['torrelavega','cantabria']` → Cantabria (1 token),
 * `['ferrol','a','coruna']` → A Coruña (3 tokens). Returns `undefined` if the
 * tail is not a province.
 */
export function findProvinciaSuffix(tokens: string[]): ProvinciaSuffix | undefined {
  const max = Math.min(MAX_NAME_WORDS, tokens.length)
  for (let length = max; length >= 1; length--) {
    const candidate = normalizeName(tokens.slice(tokens.length - length).join(' '))
    const info = BY_NAME.get(candidate)
    if (info) return { info, tokenCount: length }
  }
  return undefined
}

/** Resolve a province by 2-digit code, name or alias. */
export function findProvincia(value: string): ProvinciaInfo | undefined {
  const trimmed = value.trim()
  if (/^\d{1,2}$/.test(trimmed)) {
    const code = trimmed.padStart(2, '0')
    return PROVINCIAS.find((p) => p.code === code)
  }
  return BY_NAME.get(normalizeName(trimmed))
}
