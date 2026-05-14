import { describe, it, expect } from 'vitest'
import {
  isValidEmail,
  isValidPhoneNumber,
  validatePasswordSync,
  getFullName,
  formatCurrency,
} from '@/lib/utils'

describe('Utility Functions', () => {
  describe('isValidEmail', () => {
    it('returns true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
      expect(isValidEmail('user+tag@example.com')).toBe(true)
      expect(isValidEmail('user123@test-domain.com')).toBe(true)
    })

    it('returns false for invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user@domain')).toBe(false)
      expect(isValidEmail('user space@example.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })

    it('trims surrounding whitespace before validating', () => {
      expect(isValidEmail('  test@example.com  ')).toBe(true)
      expect(isValidEmail(' test@example.com')).toBe(true)
    })
  })

  describe('validatePasswordSync', () => {
    it('accepts passwords with 6 or more characters', () => {
      expect(validatePasswordSync('password123')).toEqual({ valid: true })
      expect(validatePasswordSync('123456')).toEqual({ valid: true })
      expect(validatePasswordSync('abcdef')).toEqual({ valid: true })
    })

    it('rejects passwords shorter than 6 characters', () => {
      const result = validatePasswordSync('12345')
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/at least 6/i)
    })

    it('rejects passwords longer than 128 characters', () => {
      const result = validatePasswordSync('a'.repeat(129))
      expect(result.valid).toBe(false)
      expect(result.message).toMatch(/less than 128/i)
    })

    it('accepts the boundary lengths (6 and 128)', () => {
      expect(validatePasswordSync('123456')).toEqual({ valid: true })
      expect(validatePasswordSync('a'.repeat(128))).toEqual({ valid: true })
    })
  })

  describe('isValidPhoneNumber', () => {
    it('returns true for 10-15 digit numbers (any formatting)', () => {
      expect(isValidPhoneNumber('1234567890')).toBe(true)
      expect(isValidPhoneNumber('+1234567890')).toBe(true)
      expect(isValidPhoneNumber('(123) 456-7890')).toBe(true)
      expect(isValidPhoneNumber('123-456-7890')).toBe(true)
      expect(isValidPhoneNumber('+1 234 567 8901')).toBe(true)
      expect(isValidPhoneNumber('123.456.7890')).toBe(true)
    })

    it('returns false for fewer than 10 digits', () => {
      expect(isValidPhoneNumber('123456789')).toBe(false)
      expect(isValidPhoneNumber('123')).toBe(false)
    })

    it('returns false for more than 15 digits', () => {
      expect(isValidPhoneNumber('1234567890123456')).toBe(false)
    })
  })

  describe('getFullName', () => {
    it('joins first and last name', () => {
      expect(getFullName('Jane', 'Doe')).toBe('Jane Doe')
    })

    it('falls back to whichever part is present', () => {
      expect(getFullName('Jane', undefined)).toBe('Jane')
      expect(getFullName(undefined, undefined, 'Anonymous')).toBe('Anonymous')
    })
  })

  describe('formatCurrency', () => {
    it('formats a number as USD', () => {
      expect(formatCurrency(1234.5)).toBe('$1,234.50')
      expect(formatCurrency(0)).toBe('$0.00')
    })
  })
})
