/**
 * ETL CLI - Spanish Address Data Pipeline
 *
 * Usage:
 *   pnpm etl run --year 2025 --month 1
 *   pnpm etl run --year 2025 --month 1 --provinces 28,08
 *   pnpm etl validate ./data/snapshots/callejero_2025-01.jsonl
 *   pnpm etl stats ./data/snapshots/callejero_2025-01.jsonl
 */

import { Command } from 'commander'
import { existsSync, mkdirSync, createReadStream } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { downloadINECallejero } from './sources/downloader.js'
import { parseCallejeroZip, buildMunicipiosMapFromZip } from './sources/ine-callejero.js'
import { loadMunicipiosFromFile } from './sources/ine-municipios.js'
import { loadCoordinatesFromFile } from './sources/cnig-cartociudad.js'
import { mergeRecords } from './transform/merge.js'
import { deduplicate, logDeduplicationStats } from './transform/deduplicate.js'
import { writeJsonl } from './output/jsonl-writer.js'
import type { RawRecord } from './sources/ine-callejero.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Data directory relative to package root
const DATA_DIR = join(__dirname, '../../data')
const RAW_DIR = join(DATA_DIR, 'raw')
const SNAPSHOTS_DIR = join(DATA_DIR, 'snapshots')

const program = new Command()

program
  .name('etl')
  .description('ETL pipeline for Spanish address data')
  .version('0.1.0')

/**
 * ETL run command - downloads, parses, and outputs address data.
 */
program
  .command('run')
  .description('Run the ETL pipeline')
  .requiredOption('--year <year>', 'Year to download (e.g., 2025)')
  .requiredOption('--month <month>', 'Month to download (1 or 7)', (val) => {
    const num = parseInt(val, 10)
    if (num !== 1 && num !== 7) {
      throw new Error('Month must be 1 or 7')
    }
    return num as 1 | 7
  })
  .option(
    '--provinces <codes>',
    'Comma-separated province codes to process (e.g., 28,08)',
    (val) => val.split(',').map((s) => s.trim()),
  )
  .option('--municipios <file>', 'Path to municipios CSV file')
  .option('--coordinates <file>', 'Path to CartoCiudad coordinates CSV file')
  .option('--output <path>', 'Output JSONL path')
  .option('--skip-download', 'Skip downloading, use existing file')
  .action(async (options) => {
    const { year, month, provinces, municipios: municipiosFile, coordinates: coordsFile, output: outputPath, skipDownload } = options

    console.log(`\n=== ETL Pipeline ===`)
    console.log(`  Year: ${year}`)
    console.log(`  Month: ${month}`)
    console.log(`  Provinces: ${provinces ? provinces.join(', ') : 'all'}`)

    // Ensure directories exist
    mkdirSync(RAW_DIR, { recursive: true })
    mkdirSync(SNAPSHOTS_DIR, { recursive: true })

    // Step 1: Download INE Callejero
    let zipPath: string
    if (skipDownload) {
      // Try to find existing file
      const filename = `caj_esp_${month.toString().padStart(2, '0')}${year}.zip`
      zipPath = join(RAW_DIR, filename)
      if (!existsSync(zipPath)) {
        console.error(`  Error: File not found: ${zipPath}`)
        process.exit(1)
      }
      console.log(`  Using existing file: ${zipPath}`)
    } else {
      console.log('\n[1/6] Downloading INE Callejero...')
      zipPath = await downloadINECallejero(year, month, RAW_DIR)
    }

    // Step 2: Load municipios reference data
    console.log('\n[2/6] Loading municipios reference data...')
    let municipiosMap
    if (municipiosFile) {
      municipiosMap = await loadMunicipiosFromFile(municipiosFile)
    } else {
      // Try to find an explicit municipios reference in the data directory.
      const defaultPath = join(DATA_DIR, 'municipios.csv')
      if (existsSync(defaultPath)) {
        municipiosMap = await loadMunicipiosFromFile(defaultPath)
      } else {
        // No reference file present: derive municipality names + provincia/CCAA
        // directly from the INE Callejero ZIP (TRAM). Self-contained, no extra
        // download required. For authoritative names/CCAA supply --municipios.
        console.log('  Deriving municipality reference from callejero ZIP...')
        municipiosMap = await buildMunicipiosMapFromZip(zipPath, provinces)
        console.warn(
          '  Note: municipality names derived from INE callejero TRAM; supply ' +
            '`--municipios <csv>` for the authoritative INE reference.',
        )
      }
    }
    console.log(`  Loaded ${municipiosMap.size} municipalities`)

    // Step 3: Load coordinates (optional)
    console.log('\n[3/6] Loading coordinates (optional)...')
    let coordMap
    if (coordsFile) {
      coordMap = await loadCoordinatesFromFile(coordsFile)
      console.log(`  Loaded ${coordMap.size} coordinate records`)
    } else {
      console.log('  Skipped (no coordinates file provided)')
    }

    // Step 4: Parse INE Callejero
    console.log('\n[4/6] Parsing INE Callejero...')
    const rawRecords: RawRecord[] = []

    // Use the INE Callejero ZIP parser to extract TRAM records.
    console.log(`  Parsing ZIP file: ${zipPath}`)

    for await (const record of parseCallejeroZip(zipPath, provinces, municipiosMap)) {
      rawRecords.push(record)
    }

    console.log(`  Parsed ${rawRecords.length.toLocaleString()} raw records`)

    // Step 5: Merge and enrich
    console.log('\n[5/6] Merging with municipio data...')
    const enrichedRecords = mergeRecords(rawRecords, municipiosMap, coordMap)
    console.log(`  Enriched ${enrichedRecords.length.toLocaleString()} records`)

    // Step 6: Deduplicate
    console.log('\n[6/6] Deduplicating...')
    const { deduplicated, stats } = deduplicate(enrichedRecords)
    logDeduplicationStats(stats)

    // Step 7: Write output
    const defaultOutput = join(
      SNAPSHOTS_DIR,
      `callejero_${year}-${month.toString().padStart(2, '0')}${
        provinces ? '_' + provinces.join('_') : ''
      }.jsonl`,
    )
    const finalOutput = outputPath || defaultOutput
    const sourceDate = `${year}-${month.toString().padStart(2, '0')}`

    console.log(`\nWriting to ${finalOutput}...`)
    const outputStats = await writeJsonl(deduplicated, finalOutput, { gzip: true, sourceDate })

    console.log(`\n=== Complete ===`)
    console.log(`  Records: ${outputStats.record_count.toLocaleString()}`)
    console.log(`  Provinces: ${outputStats.provinces_covered.join(', ')}`)
    console.log(`  File: ${finalOutput}.gz`)
    console.log(`  Size: ${formatBytes(outputStats.gzip_size_bytes || 0)}`)
  })

/**
 * Validate command - validates a JSONL snapshot file.
 */
program
  .command('validate')
  .description('Validate a snapshot JSONL file')
  .argument('<file>', 'Path to JSONL file to validate')
  .action(async (file) => {
    console.log(`\nValidating: ${file}`)

    if (!existsSync(file)) {
      console.error(`  Error: File not found: ${file}`)
      process.exit(1)
    }

    const requiredFields = [
      'id',
      'via_nombre',
      'via_tipo',
      'via_nombre_completo',
      'municipio',
      'municipio_id',
      'provincia',
      'provincia_id',
      'comunidad_autonoma',
      'comunidad_autonoma_id',
      'codigo_postal',
      'label',
    ]

    let lineNum = 0
    const errors: string[] = []
    let nullIds = 0
    let invalidCP = 0
    let invalidMunicipioId = 0
    let recordCount = 0
    const provinces = new Set<string>()

    const readStream = createReadStream(file, { encoding: 'utf-8' })
    let buffer = ''

    for await (const chunk of readStream) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete last line

      for (const line of lines) {
        lineNum++
        if (!line.trim()) continue

        try {
          const record = JSON.parse(line) as Record<string, unknown>
          recordCount++
          if (record.provincia_id) provinces.add(record.provincia_id as string)

          // Check required fields
          for (const field of requiredFields) {
            if (record[field] === undefined || record[field] === null) {
              errors.push(`Line ${lineNum}: Missing field "${field}"`)
            }
          }

          // Check ID is not null/empty
          if (!record.id) {
            nullIds++
          }

          // Check CP format (5 digits) and not the "00000" collapse marker
          // (a single-province run that collapses to 00000 is the original bug).
          const cp = record.codigo_postal as string | undefined
          if (!cp || !/^\d{5}$/.test(cp) || cp.startsWith('000')) {
            invalidCP++
          }

          // Check municipio_id format (5 digits)
          if (record.municipio_id && !/^\d{5}$/.test(record.municipio_id as string)) {
            invalidMunicipioId++
          }
        } catch (e) {
          errors.push(`Line ${lineNum}: Invalid JSON - ${e}`)
        }
      }
    }

    console.log(`\nValidation Results:`)
    console.log(`  Records checked: ${recordCount.toLocaleString()}`)

    // Count threshold is national-scale only; a single-province snapshot
    // (e.g. Madrid) legitimately has tens of thousands of records, not 500k.
    const expectedMinimum = provinces.size <= 1 ? 1000 : 500_000
    if (recordCount < expectedMinimum) {
      console.warn(
        `  Warning: Expected >${expectedMinimum.toLocaleString()} records for ${
          provinces.size === 1 ? 'a single province' : `${provinces.size} provinces`
        }, got ${recordCount.toLocaleString()}`,
      )
    }

    if (nullIds > 0) {
      console.warn(`  Warning: ${nullIds} records with null/empty IDs`)
    }

    if (invalidCP > 0) {
      console.warn(`  Warning: ${invalidCP} records with invalid postal code format`)
    }

    if (invalidMunicipioId > 0) {
      console.warn(`  Warning: ${invalidMunicipioId} records with invalid municipio_id format`)
    }

    if (errors.length === 0) {
      console.log('  ✓ All validations passed')
    } else {
      console.error(`  ✗ ${errors.length} validation errors found`)
      errors.slice(0, 10).forEach((e) => console.error(`    ${e}`))
      if (errors.length > 10) {
        console.error(`    ... and ${errors.length - 10} more`)
      }
      process.exit(1)
    }
  })

/**
 * Stats command - prints statistics about a snapshot file.
 */
program
  .command('stats')
  .description('Print statistics about a snapshot file')
  .argument('<file>', 'Path to JSONL file')
  .action(async (file) => {
    if (!existsSync(file)) {
      console.error(`Error: File not found: ${file}`)
      process.exit(1)
    }

    const readStream = createReadStream(file, { encoding: 'utf-8' })
    let buffer = ''
    let recordCount = 0
    const provinces = new Set<string>()
    const municipalities = new Set<string>()
    let withCoords = 0

    for await (const chunk of readStream) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const record = JSON.parse(line) as Record<string, unknown>
          recordCount++
          provinces.add(record.provincia_id as string)
          municipalities.add(record.municipio_id as string)
          if (record.lat !== undefined && record.lon !== undefined) {
            withCoords++
          }
        } catch {
          // Skip invalid lines
        }
      }
    }

    console.log(`\nStatistics for: ${file}`)
    console.log(`  Total records: ${recordCount.toLocaleString()}`)
    console.log(`  Provinces: ${provinces.size}`)
    console.log(`  Municipalities: ${municipalities.size}`)
    console.log(`  With coordinates: ${withCoords.toLocaleString()} (${((withCoords / recordCount) * 100).toFixed(1)}%)`)
  })

program.parse()

/**
 * Formats bytes into human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export { program }
