import { describe, it, expect } from 'vitest'
import { applyNumFormat } from '../lib/format-utils'

describe('applyNumFormat', () => {
  describe('null / empty passthrough', () => {
    it('returns empty string for null', () => {
      expect(applyNumFormat(null)).toBe('')
    })

    it('returns empty string for empty string', () => {
      expect(applyNumFormat('')).toBe('')
    })
  })

  describe('general (default)', () => {
    it('returns string as-is', () => {
      expect(applyNumFormat('hello', 'general')).toBe('hello')
    })

    it('returns number as string', () => {
      expect(applyNumFormat(42, 'general')).toBe('42')
    })

    it('uses general when no format provided', () => {
      expect(applyNumFormat(42)).toBe('42')
    })
  })

  describe('number', () => {
    it('formats integer with locale separators', () => {
      expect(applyNumFormat(1234567, 'number')).toBe('1,234,567')
    })

    it('formats float to at most 2 decimal places', () => {
      expect(applyNumFormat(1234.5, 'number')).toBe('1,234.5')
    })

    it('rounds to 2 decimal places', () => {
      expect(applyNumFormat(1.005, 'number')).toBe('1.01')
    })

    it('passes non-numeric string through unchanged', () => {
      expect(applyNumFormat('text', 'number')).toBe('text')
    })
  })

  describe('currency', () => {
    it('formats with $ sign and 2 decimal places', () => {
      expect(applyNumFormat(1234.5, 'currency')).toBe('$1,234.50')
    })

    it('formats zero as $0.00', () => {
      expect(applyNumFormat(0, 'currency')).toBe('$0.00')
    })

    it('formats negative values', () => {
      expect(applyNumFormat(-42, 'currency')).toMatch(/\$?-?42|−\$42/)
    })

    it('passes non-numeric string through unchanged', () => {
      expect(applyNumFormat('text', 'currency')).toBe('text')
    })
  })

  describe('percent', () => {
    it('multiplies by 100 and appends %', () => {
      expect(applyNumFormat(0.5, 'percent')).toBe('50%')
    })

    it('handles decimal percentages', () => {
      expect(applyNumFormat(0.1234, 'percent')).toBe('12.34%')
    })

    it('passes non-numeric string through unchanged', () => {
      expect(applyNumFormat('text', 'percent')).toBe('text')
    })
  })

  describe('date', () => {
    it('converts Excel serial 1 (Jan 1 1900) to a date string', () => {
      const result = applyNumFormat(1, 'date')
      expect(result).toMatch(/1\/1\/1900/)
    })

    it('converts a recent Excel serial date', () => {
      // Excel serial 45000 ≈ May 18, 2023
      const result = applyNumFormat(45000, 'date')
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
    })

    it('passes non-numeric string through unchanged', () => {
      expect(applyNumFormat('text', 'date')).toBe('text')
    })
  })
})
