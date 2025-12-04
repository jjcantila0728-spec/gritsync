import { getSupabaseAdmin } from '../db/supabase.js'

// Helper function to generate UUID (kept for backward compatibility)
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Generate GRIT-ID: GRIT + 6 digit number (e.g., GRIT321569)
export async function generateGritId() {
  const supabase = getSupabaseAdmin()
  let gritId
  let exists = true
  let attempts = 0
  const maxAttempts = 100
  
  while (exists && attempts < maxAttempts) {
    // Generate 6 digit number (100000 to 999999)
    const number = Math.floor(100000 + Math.random() * 900000)
    gritId = `GRIT${number}`
    
    // Check if it already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('grit_id', gritId)
      .single()
    
    exists = !!existing
    attempts++
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique GRIT-ID after maximum attempts')
  }
  
  return gritId
}

// Generate Application ID: AP + 12 alphanumeric characters (e.g., AP36S25D451F2G)
export async function generateApplicationId() {
  const supabase = getSupabaseAdmin()
  let appId
  let exists = true
  let attempts = 0
  const maxAttempts = 100
  
  // Alphanumeric characters (0-9, A-Z)
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  
  while (exists && attempts < maxAttempts) {
    // Generate 12 alphanumeric characters
    let randomPart = ''
    for (let i = 0; i < 12; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    appId = `AP${randomPart}`
    
    // Check if it already exists
    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('id', appId)
      .single()
    
    exists = !!existing
    attempts++
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique Application ID after maximum attempts')
  }
  
  return appId
}

// Generate Gmail address from name: first letter of firstname + first letter of middlename + lastname + "usrn"@gmail.com
// Example: joy jeric alburo cantila -> jacantilausrn@gmail.com
// Note: Based on the example, it appears to use: first letter of firstname + first letter of first part of lastname + last part of lastname
export function generateGmailAddress(firstName, middleName, lastName) {
  // Get first letter of first name (lowercase)
  const firstInitial = (firstName || '').trim().charAt(0).toLowerCase()
  
  // Get last name parts
  const lastNameParts = (lastName || '').trim().split(/\s+/).filter(part => part.trim())
  
  if (lastNameParts.length === 0) {
    // Fallback if no last name
    return `${firstInitial}usrn@gmail.com`
  }
  
  // Based on example "joy jeric alburo cantila" -> "jacantilausrn@gmail.com"
  // It seems to use: j (joy) + a (first letter of "alburo", first part of last name) + cantila (last part)
  let email
  if (lastNameParts.length > 1) {
    // Multiple parts in last name: use first letter of first part + last part
    const firstPartInitial = lastNameParts[0].charAt(0).toLowerCase()
    const lastPart = lastNameParts[lastNameParts.length - 1].toLowerCase()
    email = `${firstInitial}${firstPartInitial}${lastPart}usrn@gmail.com`
  } else {
    // Single part last name: use first letter of middle name if available, otherwise first letter of last name
    const middleInitial = (middleName || '').trim().charAt(0).toLowerCase()
    const lastPart = lastNameParts[0].toLowerCase()
    const fallbackInitial = lastPart.charAt(0).toLowerCase()
    email = `${firstInitial}${middleInitial || fallbackInitial}${lastPart}usrn@gmail.com`
  }
  
  return email
}

// Generate Quote ID: GQ + 12 digit number (e.g., GQ654236986523)
export async function generateQuoteId() {
  const supabase = getSupabaseAdmin()
  let quoteId
  let exists = true
  let attempts = 0
  const maxAttempts = 100
  
  while (exists && attempts < maxAttempts) {
    // Generate 12 digit number (100000000000 to 999999999999)
    const number = Math.floor(100000000000 + Math.random() * 900000000000)
    quoteId = `GQ${number}`
    
    // Check if it already exists
    const { data: existing } = await supabase
      .from('quotations')
      .select('id')
      .eq('id', quoteId)
      .single()
    
    exists = !!existing
    attempts++
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique Quote ID after maximum attempts')
  }
  
  return quoteId
}

// Generate Payment ID: PAY + 10 digit number (e.g., PAY6542369852)
export async function generatePaymentId() {
  const supabase = getSupabaseAdmin()
  let paymentId
  let exists = true
  let attempts = 0
  const maxAttempts = 100
  
  while (exists && attempts < maxAttempts) {
    const number = Math.floor(1000000000 + Math.random() * 9000000000)
    paymentId = `PAY${number}`
    
    const { data: existing } = await supabase
      .from('application_payments')
      .select('id')
      .eq('id', paymentId)
      .single()
    
    exists = !!existing
    attempts++
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique Payment ID after maximum attempts')
  }
  
  return paymentId
}

// Generate Receipt Number: RCP + 10 digit number (e.g., RCP6542369852)
export async function generateReceiptNumber() {
  const supabase = getSupabaseAdmin()
  let receiptNumber
  let exists = true
  let attempts = 0
  const maxAttempts = 100
  
  while (exists && attempts < maxAttempts) {
    const number = Math.floor(1000000000 + Math.random() * 9000000000)
    receiptNumber = `RCP${number}`
    
    const { data: existing } = await supabase
      .from('receipts')
      .select('id')
      .eq('receipt_number', receiptNumber)
      .single()
    
    exists = !!existing
    attempts++
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique Receipt Number after maximum attempts')
  }
  
  return receiptNumber
}


