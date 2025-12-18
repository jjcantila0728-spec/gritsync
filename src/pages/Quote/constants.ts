import type { ServiceConfig } from './types'

// Tax rate constant
export const TAX_RATE = 0.12 // 12% tax

// Default fallback service configuration
export const DEFAULT_NCLEX_SERVICES: ServiceConfig = {
  step1: {
    total: 267.99,
    items: [
      { description: 'NCLEX NY BON Application Fee', amount: 143 },
      { description: 'NCLEX NY Mandatory Courses', amount: 54.99 },
      { description: 'NCLEX NY Bond Fee', amount: 70 },
    ],
  },
  step2: {
    total: 508,
    items: [
      { description: 'NCLEX PV Application Fee', amount: 200 },
      { description: 'NCLEX PV NCSBN Exam Fee', amount: 150 },
      { description: 'NCLEX GritSync Service Fee', amount: 150 },
      { description: 'NCLEX NY Quick Results', amount: 8 },
    ],
  },
}







