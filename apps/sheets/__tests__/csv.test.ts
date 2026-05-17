import { describe, it, expect } from 'vitest'
import { parseCSV, serializeCSV } from '../lib/xlsx-io'

describe('parseCSV', () => {
  it('parses a single row of strings', () => {
    expect(parseCSV('a,b,c')).toEqual([['a', 'b', 'c']])
  })

  it('auto-detects integers', () => {
    expect(parseCSV('1,2,3')).toEqual([[1, 2, 3]])
  })

  it('auto-detects floats', () => {
    expect(parseCSV('1.5,2.75')).toEqual([[1.5, 2.75]])
  })

  it('preserves leading zeros (ZIP codes, IDs)', () => {
    expect(parseCSV('007,90210')).toEqual([['007', '90210']])
  })

  it('keeps strings that are not purely numeric', () => {
    expect(parseCSV('1e2text,abc123')).toEqual([['1e2text', 'abc123']])
  })

  it('scientific notation numbers are parsed', () => {
    expect(parseCSV('1e2')).toEqual([[100]])
  })

  it('parses multiple rows with LF line endings', () => {
    expect(parseCSV('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('parses multiple rows with CRLF line endings', () => {
    expect(parseCSV('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('returns null for empty fields', () => {
    expect(parseCSV('a,,c')).toEqual([['a', null, 'c']])
  })

  it('returns two nulls for a bare comma (two empty fields)', () => {
    expect(parseCSV(',')).toEqual([[null, null]])
  })

  it('handles quoted fields containing commas', () => {
    expect(parseCSV('"hello, world",foo')).toEqual([['hello, world', 'foo']])
  })

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(parseCSV('"say ""hi""",bar')).toEqual([['say "hi"', 'bar']])
  })

  it('handles quoted fields containing newlines', () => {
    expect(parseCSV('"line1\nline2",end')).toEqual([['line1\nline2', 'end']])
  })

  it('handles empty input', () => {
    expect(parseCSV('')).toEqual([])
  })

  it('strips a trailing empty row from a trailing newline', () => {
    expect(parseCSV('a,b\n')).toEqual([['a', 'b']])
  })

  it('handles mixed numbers and strings in the same file', () => {
    expect(parseCSV('Name,Score\nAlice,95\nBob,87.5')).toEqual([
      ['Name', 'Score'],
      ['Alice', 95],
      ['Bob', 87.5],
    ])
  })
})

describe('serializeCSV', () => {
  it('joins a single row with commas', () => {
    expect(serializeCSV([['a', 'b', 'c']])).toBe('a,b,c')
  })

  it('joins multiple rows with CRLF', () => {
    expect(serializeCSV([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d')
  })

  it('converts null to empty string', () => {
    expect(serializeCSV([[null, 'x']])).toBe(',x')
  })

  it('converts numbers to string', () => {
    expect(serializeCSV([[1, 2.5]])).toBe('1,2.5')
  })

  it('converts booleans to string', () => {
    expect(serializeCSV([[true, false]])).toBe('true,false')
  })

  it('quotes fields containing a comma', () => {
    expect(serializeCSV([['hello, world']])).toBe('"hello, world"')
  })

  it('escapes double-quotes inside quoted fields', () => {
    expect(serializeCSV([['say "hi"']])).toBe('"say ""hi"""')
  })

  it('quotes fields containing a newline', () => {
    expect(serializeCSV([['line1\nline2']])).toBe('"line1\nline2"')
  })

  it('quotes fields containing a carriage return', () => {
    expect(serializeCSV([['a\rb']])).toBe('"a\rb"')
  })

  it('round-trips through parseCSV', () => {
    const original: (string | number | null)[][] = [
      ['Name', 'Score', 'Note'],
      ['Alice', 95, 'First, place'],
      ['Bob "the builder"', 87.5, null],
      ['Charlie', 100, 'Perfect\nscore'],
    ]
    const csv = serializeCSV(original)
    const parsed = parseCSV(csv)
    expect(parsed).toEqual(original)
  })
})
