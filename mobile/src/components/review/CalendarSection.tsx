import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Calendar, type DateData } from 'react-native-calendars'
import { Card, CardSubtitle, CardTitle } from '@/components/Card'
import { useTheme, palette, radius, spacing } from '@/theme'
import { nclexAPI, type NclexProfile } from '@/lib/nclex'
import { errorMessage } from '@/lib/api'

export function CalendarSection() {
  const { colors, mode } = useTheme()
  const [profile, setProfile] = useState<NclexProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setProfile(await nclexAPI.profile())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const examDate = profile?.examDate ?? null

  const marked = useMemo(() => {
    const out: Record<string, any> = {}
    if (examDate) {
      const iso = new Date(examDate).toISOString().slice(0, 10)
      out[iso] = {
        selected: true,
        selectedColor: palette.brand.red600,
        customStyles: {
          container: { backgroundColor: palette.brand.red600 },
          text: { color: '#fff', fontWeight: '800' },
        },
      }
    }
    return out
  }, [examDate])

  async function setExamDate(d: DateData) {
    setSaving(true)
    try {
      const iso = new Date(d.dateString).toISOString()
      await nclexAPI.setExamDate(iso)
      setProfile((p) => (p ? { ...p, examDate: iso } : { userId: '', tier: 'FREE', examDate: iso } as any))
    } catch (e) {
      Alert.alert("Couldn't save exam date", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function clearExamDate() {
    setSaving(true)
    try {
      await nclexAPI.setExamDate(null)
      setProfile((p) => (p ? { ...p, examDate: null } : p))
    } catch (e) {
      Alert.alert("Couldn't clear exam date", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const days = useMemo(() => {
    if (!examDate) return null
    const diff = new Date(examDate).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [examDate])

  if (loading) {
    return (
      <Card>
        <View style={{ alignItems: 'center', padding: spacing.xl }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Card>
    )
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <CardTitle>Your NCLEX exam date</CardTitle>
        {examDate ? (
          <>
            <CardSubtitle>
              {new Date(examDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </CardSubtitle>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: palette.brand.red50,
                  borderWidth: 1,
                  borderColor: palette.brand.red200,
                }}
              >
                <Text style={{ color: palette.brand.red700, fontWeight: '800', fontSize: 12 }}>
                  {days === 0 ? 'TODAY' : `${days} day${days === 1 ? '' : 's'} to go`}
                </Text>
              </View>
              <Pressable
                onPress={clearExamDate}
                disabled={saving}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>Clear</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <CardSubtitle>Tap a date on the calendar below to set your exam date.</CardSubtitle>
        )}
      </Card>

      <Card>
        <Calendar
          markingType="custom"
          markedDates={marked}
          onDayPress={(d) => setExamDate(d)}
          minDate={new Date().toISOString().slice(0, 10)}
          theme={{
            calendarBackground: 'transparent',
            backgroundColor: 'transparent',
            dayTextColor: colors.text,
            monthTextColor: colors.text,
            textSectionTitleColor: colors.textMuted,
            todayTextColor: palette.brand.red600,
            selectedDayBackgroundColor: palette.brand.red600,
            selectedDayTextColor: '#fff',
            arrowColor: palette.brand.red600,
            textDayFontWeight: '600',
            textMonthFontWeight: '800',
            textDayHeaderFontWeight: '700',
            textDisabledColor: mode === 'dark' ? '#4B5563' : '#D1D5DB',
          }}
          style={{ borderRadius: radius.md }}
        />
      </Card>

      <Card>
        <CardTitle>Study tip</CardTitle>
        <CardSubtitle>
          Aim for at least 75 questions a day in the last 4 weeks before your exam date. Spread CAT
          practice across formats so adaptive selection stays well-calibrated.
        </CardSubtitle>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({})
void styles
