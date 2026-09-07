export type {
  AddressRecord,
  SearchResult,
  SearchGroup,
  SearchOptions,
  AddressRecord as AddressRecordType,
  DireccionNormalizada,
} from '@spain-address/core';

export const PROVINCES_LIST = [
  { code: 'all', name: 'Todas las 52 provincias (España)' },
  { code: '01', name: '01 - Araba/Álava' },
  { code: '02', name: '02 - Albacete' },
  { code: '03', name: '03 - Alicante/Alacant' },
  { code: '04', name: '04 - Almería' },
  { code: '05', name: '05 - Ávila' },
  { code: '06', name: '06 - Badajoz' },
  { code: '07', name: '07 - Illes Balears' },
  { code: '08', name: '08 - Barcelona' },
  { code: '09', name: '09 - Burgos' },
  { code: '10', name: '10 - Cáceres' },
  { code: '11', name: '11 - Cádiz' },
  { code: '12', name: '12 - Castellón/Castelló' },
  { code: '13', name: '13 - Ciudad Real' },
  { code: '14', name: '14 - Córdoba' },
  { code: '15', name: '15 - A Coruña' },
  { code: '16', name: '16 - Cuenca' },
  { code: '17', name: '17 - Girona' },
  { code: '18', name: '18 - Granada' },
  { code: '19', name: '19 - Guadalajara' },
  { code: '20', name: '20 - Gipuzkoa' },
  { code: '21', name: '21 - Huelva' },
  { code: '22', name: '22 - Huesca' },
  { code: '23', name: '23 - Jaén' },
  { code: '24', name: '24 - León' },
  { code: '25', name: '25 - Lleida' },
  { code: '26', name: '26 - La Rioja' },
  { code: '27', name: '27 - Lugo' },
  { code: '28', name: '28 - Madrid' },
  { code: '29', name: '29 - Málaga' },
  { code: '30', name: '30 - Murcia' },
  { code: '31', name: '31 - Navarra' },
  { code: '32', name: '32 - Ourense' },
  { code: '33', name: '33 - Asturias' },
  { code: '34', name: '34 - Palencia' },
  { code: '35', name: '35 - Las Palmas' },
  { code: '36', name: '36 - Pontevedra (Vigo)' },
  { code: '37', name: '37 - Salamanca' },
  { code: '38', name: '38 - Santa Cruz de Tenerife' },
  { code: '39', name: '39 - Cantabria' },
  { code: '40', name: '40 - Segovia' },
  { code: '41', name: '41 - Sevilla' },
  { code: '42', name: '42 - Soria' },
  { code: '43', name: '43 - Tarragona' },
  { code: '44', name: '44 - Teruel' },
  { code: '45', name: '45 - Toledo' },
  { code: '46', name: '46 - Valencia/València' },
  { code: '47', name: '47 - Valladolid' },
  { code: '48', name: '48 - Bizkaia (Bilbao)' },
  { code: '49', name: '49 - Zamora' },
  { code: '50', name: '50 - Zaragoza' },
  { code: '51', name: '51 - Ceuta' },
  { code: '52', name: '52 - Melilla' },
];

/**
 * Ejemplos de OCR: la forma de consumo objetivo (`DireccionNormalizada`).
 * El código `ine_id` de portal (p. ej. `28079000100`) **no** es derivable del
 * Callejero del INE — se omite a propósito hasta disponer de un dataset de
 * portales. La confianza es categórica (`exact` | `parcial`), no un número de
 * OCR (eso pertenece a la capa de OCR, no a la frontera del normalizador).
 */
export const OCR_EXAMPLES = [
  {
    title: 'Escaneo DNI 4.0',
    raw: 'clle grn via 12 4b 28013 mdrid',
    parsed: {
      id: 'a3f1b2c4d5e6f7a8',
      via_tipo: 'Calle',
      via_nombre: 'Gran Vía',
      via_nombre_completo: 'Calle Gran Vía',
      municipio: 'Madrid',
      municipio_id: '28079',
      provincia: 'Madrid',
      provincia_id: '28',
      comunidad_autonoma: 'Comunidad de Madrid',
      comunidad_autonoma_id: '13',
      codigo_postal: '28013',
      label: 'Calle Gran Vía, Madrid (28013)',
      numero: '12',
      piso: '4º',
      puerta: 'B',
      escalera: null,
      bloque: null,
      portal: null,
      kilometros: null,
      sin_numero: false,
      unidad_raw: '12 4b',
      confidence: 'parcial',
    },
  },
  {
    title: 'NIE ruidoso',
    raw: 'ps castellana 259d 28046 madr - t4',
    parsed: {
      id: 'b4e2c3d5e6f7a8b9',
      via_tipo: 'Paseo',
      via_nombre: 'de la Castellana',
      via_nombre_completo: 'Paseo de la Castellana',
      municipio: 'Madrid',
      municipio_id: '28079',
      provincia: 'Madrid',
      provincia_id: '28',
      comunidad_autonoma: 'Comunidad de Madrid',
      comunidad_autonoma_id: '13',
      codigo_postal: '28046',
      label: 'Paseo de la Castellana, Madrid (28046)',
      numero: '259 D',
      piso: null,
      puerta: null,
      escalera: null,
      bloque: null,
      portal: null,
      kilometros: null,
      sin_numero: false,
      unidad_raw: '259d',
      confidence: 'parcial',
    },
  },
  {
    title: 'Formulario con errata',
    raw: 'rmbla cataluna num 45 bcn 08007',
    parsed: {
      id: 'c5f3d4e6f7a8b9c0',
      via_tipo: 'Rambla',
      via_nombre: 'de Catalunya',
      via_nombre_completo: 'Rambla de Catalunya',
      municipio: 'Barcelona',
      municipio_id: '08019',
      provincia: 'Barcelona',
      provincia_id: '08',
      comunidad_autonoma: 'Catalunya',
      comunidad_autonoma_id: '09',
      codigo_postal: '08007',
      label: 'Rambla de Catalunya, Barcelona (08007)',
      numero: '45',
      piso: null,
      puerta: null,
      escalera: null,
      bloque: null,
      portal: null,
      kilometros: null,
      sin_numero: false,
      unidad_raw: 'num 45',
      confidence: 'exact',
    },
  },
  {
    title: 'Dirección abreviada andaluza',
    raw: 'av constitucion 14 3o a sevilla 41001',
    parsed: {
      id: 'd6a4e5f7a8b9c0d1',
      via_tipo: 'Avenida',
      via_nombre: 'de la Constitución',
      via_nombre_completo: 'Avenida de la Constitución',
      municipio: 'Sevilla',
      municipio_id: '41091',
      provincia: 'Sevilla',
      provincia_id: '41',
      comunidad_autonoma: 'Andalucía',
      comunidad_autonoma_id: '01',
      codigo_postal: '41001',
      label: 'Avenida de la Constitución, Sevilla (41001)',
      numero: '14',
      piso: '3º',
      puerta: 'A',
      escalera: null,
      bloque: null,
      portal: null,
      kilometros: null,
      sin_numero: false,
      unidad_raw: '14 3º A',
      confidence: 'parcial',
    },
  },
];

export const QUICKSTART_SCRIPTS: Record<string, string> = {
  '1': `# 1. Clonar el repositorio desde GitHub
git clone https://github.com/Karim-capatlas/spain-address-autocomplete.git
cd spain-address-autocomplete

# 2. Instalar dependencias con pnpm
pnpm install --frozen-lockfile

# 3. Compilar el Web Component y los microservicios
pnpm build`,
  '2': `# Lanzar el contenedor de Typesense en segundo plano
docker compose up -d typesense

# Verificar el estado del clúster y la memoria asignada
curl http://localhost:8108/health
# {"ok":true,"version":"30.2"}`,
  '3': `# Descargar el snapshot INE reciente (callejero_2026-01)
pnpm exec tsx packages/etl/src/index.ts run --year 2026 --month 1

# Indexar en bloque 749K calles con indexación infix
pnpm typesense:import -- --snapshot packages/data/snapshots/callejero_2026-01.jsonl.gz --drop --batch-size 1000`,
  '4': `# Lanzar el Search Proxy (BFF) y el Cascade Geo Service
pnpm --filter @spain-address/proxy start
# Server listening on http://localhost:8787

pnpm --filter @spain-address/cascade start
# Server listening on http://localhost:5978

# (Opcional) Exponer de forma segura con Cloudflare Tunnel
cloudflared tunnel run address-api`,
};
