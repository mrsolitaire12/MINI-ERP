import { describe, expect, it } from 'vitest'
import { csvCell, toCsv, todayStamp } from './csv'

describe('csvCell', () => {
  it('leaves plain text and numbers alone', () => {
    expect(csvCell('Wireless Mouse')).toBe('Wireless Mouse')
    expect(csvCell(24.99)).toBe('24.99')
    expect(csvCell(0)).toBe('0')
  })
  it('wraps text with commas, quotes or new lines, and doubles the quotes', () => {
    expect(csvCell('Mouse, wireless')).toBe('"Mouse, wireless"')
    expect(csvCell('12" monitor')).toBe('"12"" monitor"')
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"')
  })
  it('stops spreadsheet formulas from running', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(csvCell('+1 555')).toBe("'+1 555")
    expect(csvCell('-2+3')).toBe("'-2+3")
    expect(csvCell('@cmd')).toBe("'@cmd")
  })
  it('does not change real negative numbers', () => {
    expect(csvCell(-5)).toBe('-5')
  })
})

describe('toCsv', () => {
  it('joins rows with line breaks and starts with a byte-order mark for Excel', () => {
    const text = toCsv([
      ['Name', 'Qty'],
      ['A, B', 2],
    ])
    expect(text).toBe('﻿Name,Qty\r\n"A, B",2')
  })
})

describe('todayStamp', () => {
  it('formats a date as year-month-day', () => {
    expect(todayStamp(new Date(2026, 10, 5))).toBe('2026-11-05')
  })
})
