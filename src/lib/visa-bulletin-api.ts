/**
 * Visa Bulletin API
 * Fetches and caches visa bulletin data
 * NOTE: This feature is currently stubbed with fallback data pending full migration
 */

export interface VisaBulletinData {
  month: string
  year: string
  eb3Philippines: {
    finalAction: string
    datesForFiling: string
  }
  lastUpdated: string
  source: string
  nextBulletinDate: string
}

function getNextBulletinReleaseDate(): Date {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const bulletinReleaseDay = 10
  
  let nextReleaseDate = new Date(currentYear, currentMonth, bulletinReleaseDay)
  
  if (now.getDate() >= bulletinReleaseDay) {
    nextReleaseDate = new Date(currentYear, currentMonth + 1, bulletinReleaseDay)
  }
  
  return nextReleaseDate
}

function getNextBulletinReleaseDateFormatted(): string {
  return formatDate(getNextBulletinReleaseDate())
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

const FALLBACK_DATA: VisaBulletinData = {
  month: 'December',
  year: '2025',
  eb3Philippines: {
    finalAction: 'April 15, 2023',
    datesForFiling: 'October 01, 2024'
  },
  lastUpdated: new Date().toISOString(),
  source: 'U.S. Department of State - Visa Bulletin December 2025',
  nextBulletinDate: getNextBulletinReleaseDateFormatted()
}

export async function fetchVisaBulletin(): Promise<VisaBulletinData> {
  // Return fallback data for now - feature pending full migration
  return FALLBACK_DATA
}

export async function getVisaBulletinFromCache(): Promise<VisaBulletinData | null> {
  return FALLBACK_DATA
}

export async function refreshVisaBulletinCache(): Promise<VisaBulletinData | null> {
  return FALLBACK_DATA
}

export function getBulletinReleaseSchedule(): { nextRelease: Date; formattedDate: string } {
  const nextRelease = getNextBulletinReleaseDate()
  return {
    nextRelease,
    formattedDate: getNextBulletinReleaseDateFormatted()
  }
}
