/**
 * JSONL output writer.
 * Streams AddressRecords to JSONL format and optionally gzips the output.
 */

import { createReadStream, createWriteStream, writeFileSync, mkdirSync, statSync } from 'fs'
import { dirname } from 'path'
import { createGzip } from 'zlib'
import { pipeline } from 'stream/promises'
import type { AddressRecord } from '@spain-address/core'

export interface JsonlWriterOptions {
  outputPath: string
  gzip?: boolean
  /** INE Callejero reference period, e.g. "2026-01". */
  sourceDate?: string
}

/** INE data source description (credited in output metadata per INE terms). */
export const INE_DATA_SOURCE = 'INE Callejero del Censo Electoral'

/** INE attribution string required by the Spanish Public Sector licensing terms. */
export const INE_ATTRIBUTION =
  '© Instituto Nacional de Estadística (INE) — https://www.ine.es/dyngs/DAB/es/index.htm?cid=1390'

export interface Metadata {
  source_date: string
  record_count: number
  provinces_covered: string[]
  generated_at: string
  file_size_bytes?: number
  gzip_size_bytes?: number
  /** Human-readable data source, e.g. "INE Callejero del Censo Electoral". */
  data_source: string
  /** Attribution that MUST travel with the data, e.g. "© Instituto Nacional de Estadística (INE)". */
  attribution: string
}

/**
 * Writes records to a JSONL file.
 */
export class JsonlWriter {
  private filePath: string
  private gzipPath: string
  private writeStream: ReturnType<typeof createWriteStream>
  private gzipStream: ReturnType<typeof createGzip> | null = null
  private recordCount = 0
  private provincesSet = new Set<string>()
  private sourceDate: string

  constructor(options: JsonlWriterOptions) {
    this.filePath = options.outputPath
    this.gzipPath = options.outputPath + '.gz'
    this.sourceDate = options.sourceDate ?? ''

    this.writeStream = createWriteStream(this.filePath, { encoding: 'utf-8' })

    if (options.gzip) {
      this.gzipStream = createGzip()
    }
  }

  /**
   * Writes a single record to the JSONL file.
   */
  write(record: AddressRecord): void {
    const line = JSON.stringify(record) + '\n'
    this.writeStream.write(line)
    this.recordCount++

    if (record.provincia_id) {
      this.provincesSet.add(record.provincia_id)
    }
  }

  /**
   * Writes multiple records.
   */
  writeBatch(records: AddressRecord[]): void {
    for (const record of records) {
      this.write(record)
    }
  }

  /**
   * Closes the writer and optionally gzips the output.
   */
  async close(): Promise<{ gzipPath?: string; stats: Metadata }> {
    return new Promise((resolve, reject) => {
      this.writeStream.end(() => {
        if (this.gzipStream) {
          // Gzip the JSONL file: read -> gzip transform -> write .gz
          const readFile = createReadStream(this.filePath)
          const writeFile = createWriteStream(this.gzipPath)
          pipeline(readFile, this.gzipStream, writeFile)
            .then(() => resolve({ gzipPath: this.gzipPath, stats: this.getStats() }))
            .catch(reject)
        } else {
          resolve({ stats: this.getStats() })
        }
      })

      this.writeStream.on('error', reject)
    })
  }

  /**
   * Gets writing statistics.
   */
  private getStats(): Metadata {
    let fileSize: number | undefined
    let gzipSize: number | undefined

    try {
      const stats = statSync(this.filePath)
      fileSize = stats.size
    } catch {
      // File might not exist yet
    }

    if (this.gzipStream) {
      try {
        const gzipStats = statSync(this.gzipPath)
        gzipSize = gzipStats.size
      } catch {
        // Not yet created
      }
    }

    const provinces = Array.from(this.provincesSet).sort()

    return {
      source_date: this.sourceDate,
      record_count: this.recordCount,
      provinces_covered: provinces,
      generated_at: new Date().toISOString(),
      file_size_bytes: fileSize,
      gzip_size_bytes: gzipSize,
      data_source: INE_DATA_SOURCE,
      attribution: INE_ATTRIBUTION,
    }
  }

  /**
   * Gets current record count.
   */
  getRecordCount(): number {
    return this.recordCount
  }
}

/**
 * Writes records to JSONL file.
 */
export async function writeJsonl(
  records: AddressRecord[],
  outputPath: string,
  options?: { gzip?: boolean; sourceDate?: string },
): Promise<Metadata> {
  mkdirSync(dirname(outputPath), { recursive: true })
  const writer = new JsonlWriter({ outputPath, gzip: options?.gzip, sourceDate: options?.sourceDate })

  for (const record of records) {
    writer.write(record)
  }

  const result = await writer.close()

  // Write metadata file alongside
  const metadataPath = outputPath.replace('.jsonl', '_metadata.json')
  const finalStats = result.stats

  mkdirSync(dirname(metadataPath), { recursive: true })
  writeFileSync(metadataPath, JSON.stringify(finalStats, null, 2))

  return finalStats
}

/**
 * Writes metadata to a file.
 */
export function writeMetadata(metadata: Metadata, outputPath: string): void {
  const metadataPath = outputPath.replace('.jsonl', '_metadata.json')
  mkdirSync(dirname(metadataPath), { recursive: true })
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
}
