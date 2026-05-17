import { Alert, Platform } from 'react-native'
import * as Calendar from 'expo-calendar'
import type { TimelineStepRow } from './services'

async function getOrCreateGritSyncCalendar(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
  const existing = calendars.find((c) => c.title === 'GritSync')
  if (existing) return existing.id

  // iOS requires a source — pick the default writable one.
  let source: Calendar.Source | undefined
  if (Platform.OS === 'ios') {
    const def = await Calendar.getDefaultCalendarAsync().catch(() => null)
    if (def?.source) source = def.source
  }
  if (!source) {
    source = calendars.find((c) => c.allowsModifications)?.source as Calendar.Source | undefined
  }
  if (!source) {
    Alert.alert('Calendar unavailable', "We couldn't find a writable calendar on this device.")
    return null
  }

  try {
    return await Calendar.createCalendarAsync({
      title: 'GritSync',
      color: '#DC2626',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: source.id,
      source,
      name: 'GritSync',
      ownerAccount: 'gritsync',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    })
  } catch {
    return null
  }
}

export async function addStepsToCalendar(steps: TimelineStepRow[], serviceName: string): Promise<void> {
  const { status } = await Calendar.requestCalendarPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert(
      'Calendar permission needed',
      'Enable calendar access in Settings to save your GritSync milestones.',
    )
    return
  }

  const calendarId = await getOrCreateGritSyncCalendar()
  if (!calendarId) return

  // Only export steps that have a meaningful date and aren't already past.
  const candidates = steps
    .filter((s) => !s.is_completed && s.status !== 'completed' && s.due_date)
    .filter((s) => {
      const t = new Date(s.due_date!).getTime()
      return isFinite(t) && t > Date.now()
    })

  if (candidates.length === 0) {
    Alert.alert('Nothing to add', 'No upcoming due dates were found on this application.')
    return
  }

  let added = 0
  for (const step of candidates) {
    const due = new Date(step.due_date!)
    const start = new Date(due)
    start.setHours(9, 0, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    try {
      await Calendar.createEventAsync(calendarId, {
        title: `GritSync ${serviceName}: ${step.title ?? step.name ?? 'Milestone'}`,
        notes: step.description ?? undefined,
        startDate: start,
        endDate: end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        alarms: [{ relativeOffset: -24 * 60 }, { relativeOffset: -60 }],
      })
      added += 1
    } catch {
      // skip a single failure rather than aborting the batch
    }
  }

  Alert.alert(
    'Calendar updated',
    `Added ${added} ${added === 1 ? 'event' : 'events'} to your GritSync calendar.`,
  )
}
