/**
 * Deduplication module for address records.
 * Deduplicates on composite key: (via_nombre_normalized, municipio_id, codigo_postal)
 * When duplicates exist, keeps the record with coordinates if available.
 */

import type { AddressRecord } from '@spain-address/core'
import { normalizeForSearch } from './normalize.js'

export interface DeduplicationStats {
  inputCount: number
  duplicatesRemoved: number
  outputCount: number
}

/**
 * Creates a deduplication key from an address record.
 */
function createDeduplicationKey(record: AddressRecord): string {
  const normalizedVia = normalizeForSearch(record.via_nombre)
  return `${normalizedVia}|${record.municipio_id}|${record.codigo_postal}`
}

/**
 * Deduplicates address records.
 * Keeps records with coordinates over those without.
 */
export function deduplicate(records: AddressRecord[]): {
  deduplicated: AddressRecord[]
  stats: DeduplicationStats
} {
  const seen = new Map<string, AddressRecord>()
  let duplicatesRemoved = 0

  for (const record of records) {
    const key = createDeduplicationKey(record)
    const existing = seen.get(key)

    if (!existing) {
      seen.set(key, record)
    } else {
      duplicatesRemoved++

      // If existing record has no coordinates but this one does, replace
      if (!existing.lat && record.lat) {
        seen.set(key, record)
      }
      // If both have coordinates or neither has, keep the existing (first seen)
    }
  }

  const deduplicated = Array.from(seen.values())

  return {
    deduplicated,
    stats: {
      inputCount: records.length,
      duplicatesRemoved,
      outputCount: deduplicated.length,
    },
  }
}

/**
 * Logs deduplication statistics.
 */
export function logDeduplicationStats(stats: DeduplicationStats): void {
  console.log(`  Input records: ${stats.inputCount.toLocaleString()}`)
  console.log(`  Duplicates removed: ${stats.duplicatesRemoved.toLocaleString()}`)
  console.log(`  Output records: ${stats.outputCount.toLocaleString()}`)
}
