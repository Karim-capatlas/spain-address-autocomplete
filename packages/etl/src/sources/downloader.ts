/**
 * INE Callejero downloader.
 * Downloads the INE Callejero ZIP file for a given year/month.
 */

import { createWriteStream, existsSync, mkdirSync } from 'fs'
import cliProgress from 'cli-progress'

const INE_CALLEJERO_URL =
  'http://www.ine.es/prodyser/callejero/caj_esp/caj_esp_{MM}{YYYY}.zip'

/**
 * Constructs the INE Callejero download URL.
 */
function constructUrl(year: number, month: 1 | 7): string {
  const monthStr = month.toString().padStart(2, '0')
  return INE_CALLEJERO_URL.replace('{YYYY}', year.toString()).replace('{MM}', monthStr)
}

/**
 * Downloads the INE Callejero ZIP file.
 * Idempotent - skips download if file already exists.
 *
 * @param year Year (e.g., 2025)
 * @param month Month (1 or 7)
 * @param outputDir Directory to save the ZIP file
 * @returns Path to the downloaded ZIP file
 */
export async function downloadINECallejero(
  year: number,
  month: 1 | 7,
  outputDir: string,
): Promise<string> {
  const url = constructUrl(year, month)
  const filename = `caj_esp_${month.toString().padStart(2, '0')}${year}.zip`
  const outputPath = `${outputDir}/${filename}`

  // Check if file already exists (idempotent)
  if (existsSync(outputPath)) {
    console.log(`  File already exists: ${outputPath}`)
    return outputPath
  }

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  console.log(`  Downloading from: ${url}`)

  // Start download with progress bar
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10)

  const progressBar = new cliProgress.SingleBar(
    {
      format: '  Downloading [{bar}] {percentage}% | {value}/{total} bytes',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  )

  if (contentLength > 0) {
    progressBar.start(contentLength, 0)
  }

  const fileStream = createWriteStream(outputPath)

  if (!response.body) {
    throw new Error('Response body is null')
  }

  let downloaded = 0

  const reader = response.body.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      fileStream.write(value)
      downloaded += value.length

      if (contentLength > 0) {
        progressBar.update(downloaded)
      }
    }
  } finally {
    progressBar.stop()
    fileStream.end()
  }

  console.log(`  Downloaded: ${outputPath}`)

  return outputPath
}
