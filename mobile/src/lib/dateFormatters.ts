/**
 * Shared date formatting helpers — mirrors src/lib/utils/dateFormatters.ts
 * on the web so the apply form can round-trip through user_details cleanly.
 *
 * The apply wizard saves to the user_details table, which keeps DATE columns
 * (Postgres "YYYY-MM-DD"). The UI prefers MM/DD/YYYY for DOB and MM/YYYY for
 * school start/end dates. These functions handle both directions.
 */

/** As-you-type formatter: 1015 → "10/15", 10152023 → "10/15/2023". */
export function formatMMDDYYYY(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** As-you-type formatter: 062019 → "06/2019". */
export function formatMMYYYY(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 6)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

/**
 * Database value (YYYY-MM-DD or ISO timestamp) → display MM/DD/YYYY.
 * Accepts MM/DD/YYYY as a pass-through. Empty/invalid → ''.
 */
export function convertFromDatabaseFormat(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  if (/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(dateStr)) return dateStr
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-')
    return `${month}/${day}/${year}`
  }
  if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) {
    const [month, year] = dateStr.split('/')
    return `${month}/01/${year}`
  }
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${day}/${year}`
  }
  return dateStr
}

/** MM/DD/YYYY → YYYY-MM-DD for Postgres DATE storage. */
export function convertToDatabaseFormat(mmddyyyy: string): string {
  if (!mmddyyyy || !/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/.test(mmddyyyy)) return ''
  const [month, day, year] = mmddyyyy.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/** DB value → display MM/YYYY. Handles YYYY-MM, YYYY-MM-DD, and ISO timestamps. */
export function convertToMMYYYY(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) return dateStr
  const m = dateStr.match(/^(\d{4})-(\d{2})(?:-\d{2})?(?:T.*)?$/)
  if (m) {
    const [, year, month] = m
    return `${month}/${year}`
  }
  return dateStr
}

/** MM/YYYY → YYYY-MM-01 (first of month) — Postgres DATE requires a day. */
export function convertMMYYYYToDatabase(mmyyyy: string): string {
  if (!mmyyyy || !/^(0[1-9]|1[0-2])\/\d{4}$/.test(mmyyyy)) return ''
  const [month, year] = mmyyyy.split('/')
  return `${year}-${month.padStart(2, '0')}-01`
}

export function isValidMMDDYYYY(value: string): boolean {
  const pattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/
  if (!pattern.test(value)) return false
  const [month, day, year] = value.split('/').map(Number)
  if (month < 1 || month > 12) return false
  if (year < 1900 || year > 2100) return false
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  if (isLeap) daysInMonth[1] = 29
  return day >= 1 && day <= daysInMonth[month - 1]
}

export function isValidMMYYYY(value: string): boolean {
  return /^(0[1-9]|1[0-2])\/\d{4}$/.test(value)
}
