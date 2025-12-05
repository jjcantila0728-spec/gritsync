import { describe, it, expect } from 'vitest'
import { isValidEmail, validatePassword, isValidPhoneNumber } from '@/lib/utils'

describe('Utility Functions', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
      expect(isValidEmail('user+tag@example.com')).toBe(true)
      expect(isValidEmail('user123@test-domain.com')).toBe(true)
    })

    it('should return false for invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user@domain')).toBe(false)
      expect(isValidEmail('user space@example.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })

    it('should handle email with whitespace', () => {
      expect(isValidEmail('  test@example.com  ')).toBe(true)
      expect(isValidEmail(' test@example.com')).toBe(true)
    })
  })

  describe('validatePassword', () => {
    it('should return valid for passwords with 6 or more characters', () => {
      expect(validatePassword('password123')).toEqual({ valid: true })
      expect(validatePassword('123456')).toEqual({ valid: true })
      expect(validatePassword('abcdef')).toEqual({ valid: true })
    })

    it('should return invalid for passwords shorter than 6 characters', async () => {
      const result = await validatePassword('12345')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must be at least 6 characters')
    })

    it('should return invalid for passwords longer than 128 characters', async () => {
      const longPassword = 'a'.repeat(129)
      const result = await validatePassword(longPassword)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Password must be less than 128 characters')
    })

    it('should return valid for passwords exactly 6 characters', () => {
      expect(validatePassword('123456')).toEqual({ valid: true })
    })

    it('should return valid for passwords exactly 128 characters', () => {
      const password = 'a'.repeat(128)
      expect(validatePassword(password)).toEqual({ valid: true })
    })
  })

  describe('isValidPhoneNumber', () => {
    it('should return true for valid phone numbers', () => {
      expect(isValidPhoneNumber('1234567890')).toBe(true)
      expect(isValidPhoneNumber('+1234567890')).toBe(true)
      expect(isValidPhoneNumber('(123) 456-7890')).toBe(true)
      expect(isValidPhoneNumber('123-456-7890')).toBe(true)
      expect(isValidPhoneNumber('+1 234 567 8901')).toBe(true)
    })

    it('should return false for phone numbers with less than 10 digits', () => {
      expect(isValidPhoneNumber('123456789')).toBe(false)
      expect(isValidPhoneNumber('123')).toBe(false)
    })

    it('should return false for phone numbers with more than 15 digits', () => {
      expect(isValidPhoneNumber('1234567890123456')).toBe(false)
    })

    it('should handle phone numbers with formatting', () => {
      expect(isValidPhoneNumber('(123) 456-7890')).toBe(true)
      expect(isValidPhoneNumber('123.456.7890')).toBe(true)
    })
  })
})









