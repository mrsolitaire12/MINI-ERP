export type CsvValue = string | number

/**
 * Prepares one value for a CSV file.
 * Text starting with = + - @ could be run as a formula when the file is opened in
 * a spreadsheet, so a quote mark is put in front of it to keep it as plain text.
 */
export function csvCell(value: CsvValue): string {
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

/** Builds the CSV text. The leading mark lets Excel read accented letters correctly. */
export function toCsv(rows: CsvValue[][]): string {
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function todayStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Saves the rows as a file through the browser's normal download. */
export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
