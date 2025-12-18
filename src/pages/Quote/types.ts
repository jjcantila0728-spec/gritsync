export interface Quotation {
  id: string
  amount: number
  description: string
  status: string
  created_at: string
  user_id: string | null // NULL for public/guest quotations
  service?: string
  state?: string
  payment_type?: string
  line_items?: QuoteLineItem[]
  client_first_name?: string
  client_last_name?: string
  client_email?: string
  client_mobile?: string
  validity_date?: string // Quote expiration date
}

export interface QuoteLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  payLater?: boolean // Flag to indicate items that will be paid later (for staggered payments)
  taxable?: boolean // Flag to indicate if item is taxable
}

export interface QuoteFormData {
  service: string
  state: string
  takerType: 'first-time' | 'retaker' | null
  firstName: string
  lastName: string
  email: string
  mobileNumber: string
  paymentType: 'full' | 'staggered' | null
  lineItems: QuoteLineItem[]
  total: number
  subtotal: number // Subtotal before tax
  tax: number // Tax amount
}

// Service configuration type
export interface ServiceConfig {
  step1: {
    total: number
    items: Array<{ description: string; amount: number; taxable?: boolean }>
  }
  step2: {
    total: number
    items: Array<{ description: string; amount: number; taxable?: boolean }>
  }
}







