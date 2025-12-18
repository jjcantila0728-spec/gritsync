const VISA_BULLETIN_DATA: Record<string, {
  month: string
  year: string
  eb3Philippines: {
    finalAction: string
    datesForFiling: string
  }
  releaseDate: string
}> = {
  'December 2025': {
    month: 'December',
    year: '2025',
    eb3Philippines: {
      finalAction: 'January 01, 2018',
      datesForFiling: 'January 01, 2019'
    },
    releaseDate: '2025-11-10'
  },
  'November 2025': {
    month: 'November',
    year: '2025',
    eb3Philippines: {
      finalAction: 'December 01, 2017',
      datesForFiling: 'January 01, 2019'
    },
    releaseDate: '2025-10-10'
  },
  'October 2025': {
    month: 'October',
    year: '2025',
    eb3Philippines: {
      finalAction: 'November 01, 2017',
      datesForFiling: 'December 01, 2018'
    },
    releaseDate: '2025-09-10'
  }
}

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

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

export async function fetchVisaBulletin(): Promise<VisaBulletinData> {
  const now = new Date()
  const currentMonth = now.toLocaleString('en-US', { month: 'long' })
  const currentYear = now.getFullYear().toString()
  const bulletinKey = `${currentMonth} ${currentYear}`
  
  const bulletinData = VISA_BULLETIN_DATA[bulletinKey] || VISA_BULLETIN_DATA['December 2025']
  const nextReleaseDate = getNextBulletinReleaseDate()
  
  return {
    month: bulletinData.month,
    year: bulletinData.year,
    eb3Philippines: bulletinData.eb3Philippines,
    lastUpdated: new Date().toISOString(),
    source: 'U.S. Department of State',
    nextBulletinDate: formatDate(nextReleaseDate)
  }
}

export function getBulletinReleaseSchedule(): { currentMonth: string; nextRelease: string; isNewBulletinExpected: boolean } {
  const now = new Date()
  const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const nextReleaseDate = getNextBulletinReleaseDate()
  const daysUntilRelease = Math.ceil((nextReleaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  return {
    currentMonth,
    nextRelease: formatDate(nextReleaseDate),
    isNewBulletinExpected: daysUntilRelease <= 7
  }
}
