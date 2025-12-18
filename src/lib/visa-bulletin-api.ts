import { supabase } from './supabase'

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

interface VisaBulletinCacheRow {
  id: string
  bulletin_month: string
  bulletin_year: number
  category: string
  country: string
  final_action_date: string | null
  dates_for_filing: string | null
  source: string | null
  raw_data: any
  fetched_at: string
  created_at: string
}

const FALLBACK_DATA: VisaBulletinData = {
  month: 'December',
  year: '2025',
  eb3Philippines: {
    finalAction: 'January 01, 2018',
    datesForFiling: 'January 01, 2019'
  },
  lastUpdated: new Date().toISOString(),
  source: 'U.S. Department of State (Cached)',
  nextBulletinDate: getNextBulletinReleaseDateFormatted()
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

function formatDateFromDB(dateString: string | null): string {
  if (!dateString) return 'Not Available'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: '2-digit'
    })
  } catch {
    return dateString
  }
}

export async function fetchVisaBulletin(): Promise<VisaBulletinData> {
  try {
    const { data, error } = await supabase
      .from('visa_bulletin_cache')
      .select('*')
      .eq('category', 'EB3')
      .eq('country', 'Philippines')
      .order('bulletin_year', { ascending: false })
      .order('bulletin_month', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (error) {
      console.error('Error fetching visa bulletin from Supabase:', error)
      return FALLBACK_DATA
    }
    
    if (!data) {
      return FALLBACK_DATA
    }
    
    const row = data as VisaBulletinCacheRow
    
    return {
      month: row.bulletin_month,
      year: row.bulletin_year.toString(),
      eb3Philippines: {
        finalAction: formatDateFromDB(row.final_action_date),
        datesForFiling: formatDateFromDB(row.dates_for_filing)
      },
      lastUpdated: row.fetched_at,
      source: row.source || 'U.S. Department of State',
      nextBulletinDate: getNextBulletinReleaseDateFormatted()
    }
  } catch (error) {
    console.error('Error fetching visa bulletin:', error)
    return FALLBACK_DATA
  }
}

export async function getLatestBulletins(limit: number = 12): Promise<VisaBulletinData[]> {
  try {
    const { data, error } = await supabase
      .from('visa_bulletin_cache')
      .select('*')
      .eq('category', 'EB3')
      .eq('country', 'Philippines')
      .order('bulletin_year', { ascending: false })
      .order('bulletin_month', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching bulletin history:', error)
      return [FALLBACK_DATA]
    }
    
    if (!data || data.length === 0) {
      return [FALLBACK_DATA]
    }
    
    return data.map((row: VisaBulletinCacheRow) => ({
      month: row.bulletin_month,
      year: row.bulletin_year.toString(),
      eb3Philippines: {
        finalAction: formatDateFromDB(row.final_action_date),
        datesForFiling: formatDateFromDB(row.dates_for_filing)
      },
      lastUpdated: row.fetched_at,
      source: row.source || 'U.S. Department of State',
      nextBulletinDate: getNextBulletinReleaseDateFormatted()
    }))
  } catch (error) {
    console.error('Error fetching bulletin history:', error)
    return [FALLBACK_DATA]
  }
}

export async function saveBulletinToCache(bulletin: {
  month: string
  year: number
  finalActionDate: string
  datesForFiling: string
  source?: string
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('visa_bulletin_cache')
      .upsert({
        bulletin_month: bulletin.month,
        bulletin_year: bulletin.year,
        category: 'EB3',
        country: 'Philippines',
        final_action_date: bulletin.finalActionDate,
        dates_for_filing: bulletin.datesForFiling,
        source: bulletin.source || 'U.S. Department of State',
        fetched_at: new Date().toISOString()
      }, {
        onConflict: 'bulletin_month,bulletin_year,category,country'
      })
    
    if (error) {
      console.error('Error saving bulletin to cache:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error saving bulletin:', error)
    return false
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

export async function checkForBulletinUpdate(): Promise<{
  hasUpdate: boolean
  previousData?: VisaBulletinData
  currentData?: VisaBulletinData
}> {
  try {
    const bulletins = await getLatestBulletins(2)
    
    if (bulletins.length < 2) {
      return { hasUpdate: false }
    }
    
    const [current, previous] = bulletins
    
    const hasUpdate = current.eb3Philippines.finalAction !== previous.eb3Philippines.finalAction ||
                      current.eb3Philippines.datesForFiling !== previous.eb3Philippines.datesForFiling
    
    return {
      hasUpdate,
      currentData: current,
      previousData: previous
    }
  } catch (error) {
    console.error('Error checking for bulletin update:', error)
    return { hasUpdate: false }
  }
}
