/**
 * Convert a raw hit document into a typed `AddressRecord`.
 *
 * Shared by the Typesense and Upstash/Redis search paths so the two backends
 * can't drift on field mapping. Both backends store values as strings
 * (Typesense returns every value as a string; Upstash/Redis hashes store flat
 * strings), so a `String(…)` coercion per field is correct for both.
 *
 * `highlights` are forwarded only for the Typesense path (it attaches
 * `<mark>`-wrapped snippets per hit). Upstash documents have no equivalent, so
 * the Upstash path simply omits the argument.
 */

import type { AddressRecord, Highlight } from './types.js'

type RawDoc = Record<string, unknown>

export function toAddressRecord(doc: RawDoc, highlights?: Highlight[]): AddressRecord {
  return {
    id: String(doc.id ?? ''),
    via_nombre: String(doc.via_nombre ?? ''),
    via_tipo: String(doc.via_tipo ?? ''),
    via_nombre_completo: String(doc.via_nombre_completo ?? ''),
    municipio: String(doc.municipio ?? ''),
    municipio_id: String(doc.municipio_id ?? ''),
    provincia: String(doc.provincia ?? ''),
    provincia_id: String(doc.provincia_id ?? ''),
    comunidad_autonoma: String(doc.comunidad_autonoma ?? ''),
    comunidad_autonoma_id: String(doc.comunidad_autonoma_id ?? ''),
    codigo_postal: String(doc.codigo_postal ?? ''),
    label: String(doc.label ?? ''),
    lat: doc.lat != null ? Number(doc.lat) : undefined,
    lon: doc.lon != null ? Number(doc.lon) : undefined,
    // Only Typesense attaches highlights; Upstash documents have none.
    ...(highlights ? { highlights } : {}),
  }
}
