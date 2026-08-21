/**
 * Spanish address normalization utilities.
 * Handles title-case conversion and search normalization.
 */

// Spanish articles that should not be capitalized in title-case
const SPANISH_ARTICLES = new Set(['de', 'del', 'la', 'las', 'el', 'los'])

// Accented vowels for diacritic stripping
const ACCENT_MAP: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ü: 'u',
  ñ: 'n',
}

/**
 * Converts a string to proper Spanish title-case.
 * Preserves articles like "de", "del", "la", "las", "el", "los".
 * Example: "GRAN VIA" → "Gran Vía"
 * Example: "CALLE DE LA PAZ" → "Calle de la Paz"
 */
export function toTitleCase(str: string): string {
  const words = str.trim().split(/\s+/)
  return words
    .map((word, index) => {
      // First word is always capitalized (it's the street type or start of name)
      if (index === 0) {
        return capitalizeWord(word)
      }
      // Articles are not capitalized
      if (SPANISH_ARTICLES.has(word.toLowerCase())) {
        return word.toLowerCase()
      }
      // Other words are capitalized
      return capitalizeWord(word)
    })
    .join(' ')
}

/**
 * Capitalizes a single word, preserving Spanish accents.
 */
function capitalizeWord(word: string): string {
  if (!word) return word
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/**
 * Normalizes a string for search: strips diacritics, lowercases.
 * Example: "Gran Vía" → "gran via"
 */
export function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .split('')
    .map((char) => ACCENT_MAP[char] ?? char)
    .join('')
}

/**
 * Ensures province code is 2-digit zero-padded.
 * Example: "28" → "28", "8" → "08"
 */
export function padProvinceCode(code: string): string {
  return code.padStart(2, '0')
}

/**
 * Ensures municipality code is 3-digit zero-padded.
 * Example: "79" → "079", "179" → "179"
 */
export function padMunicipioCode(code: string): string {
  return code.padStart(3, '0')
}

/**
 * Combines province and municipality codes into 5-digit INE municipality ID.
 * Example: ("28", "079") → "28079"
 */
export function combineMunicipioId(provinciaId: string, municipioId: string): string {
  return padProvinceCode(provinciaId) + padMunicipioCode(municipioId)
}

/**
 * Validates a postal code format.
 * Returns false for invalid/placeholder codes like "00000".
 */
export function validateCP(cp: string): boolean {
  // Must be exactly 5 digits
  if (!/^\d{5}$/.test(cp)) return false
  // Cannot start with 000 (placeholder)
  if (cp.startsWith('000')) return false
  return true
}

/**
 * INE street type code to Spanish label mapping.
 */
export const VIA_TIPO_MAP: Record<string, string> = {
  '01': 'Calle',
  '02': 'Avenida',
  '03': 'Plaza',
  '04': 'Paseo',
  '05': 'Ronda',
  '06': 'Travesía',
  '07': 'Carretera',
  '08': 'Camino',
  '09': 'Gran Vía',
  '10': 'Bulevar',
  '11': 'Glorieta',
  '12': 'Urbanización',
  '13': 'Acceso',
  '14': 'Aldea',
  '15': 'Aeropuerto',
  '16': 'Alameda',
  '17': 'Área',
  '18': 'Arrabal',
  '19': 'Autopista',
  '20': 'Avenida de la Constitución',
  '21': 'Barranco',
  '22': 'Barrio',
  '23': 'Bloque',
  '24': 'Cañada',
  '25': 'Carretera de',
  '26': 'Caserío',
  '27': 'Colegio',
  '28': 'Colonia',
  '29': 'Complejo',
  '30': 'Conjunto',
  '31': 'Cuesta',
  '32': 'Chalet',
  '33': 'Edificio',
  '34': 'Entroncamento',
  '35': 'Era',
  '36': 'Estación',
  '37': 'Explanada',
  '38': 'Ferrocarril',
  '39': 'Glorieta',
  '40': 'Huerta',
  '41': 'Jardín',
  '42': 'Jardines',
  '43': 'Lado',
  '44': 'Lugar',
  '45': 'Monte',
  '46': 'Muelle',
  '47': 'Municipio',
  '48': 'Núcleo',
  '49': 'Paraje',
  '50': 'Parque',
  '51': 'Particular',
  '52': 'Pasaje',
  '53': 'Paseo',
  '54': 'Paso',
  '55': 'Patio',
  '56': 'Población',
  '57': 'Polígono',
  '58': 'Praza',
  '59': 'Prolongación',
  '60': 'Puente',
  '61': 'Puerto',
  '62': 'Rambla',
  '63': 'Rampa',
  '64': 'Residencial',
  '65': 'Rincón',
  '66': 'Rio',
  '67': 'Rúa',
  '68': 'Salida',
  '69': 'Sector',
  '70': 'Semáforo',
  '71': 'Senda',
  '72': 'Sentier',
  '73': 'Separador',
  '74': 'Servidumbre',
  '75': 'Travesía',
  '76': 'Urbanización',
  '77': 'Valle',
  '78': 'Vía',
  '79': 'Vía Pública',
  '80': 'Villa',
  '81': 'Viñedo',
  '82': 'Zona',
  '83': 'Costa',
  '84': 'Mar',
  '85': 'Playa',
  '86': 'Campo',
  '87': 'Cruz',
  '88': 'Llano',
  '89': 'Parada',
  '90': 'Paseo Marítimo',
  '91': 'Pirámide',
  '92': 'Km',
  '93': 'Hm',
  '94': 'Dm',
  '95': 'm',
}
