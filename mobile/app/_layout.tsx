import React, { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Constants from 'expo-constants'
import { StripeProvider } from '@stripe/stripe-react-native'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import { Splash } from '@/components/Splash'
import { OfflineBanner } from '@/components/OfflineBanner'
import { UpdateBanner } from '@/components/UpdateBanner'
import { useTheme } from '@/theme'
import { deepLinkFromPushData } from '@/lib/push'
import { checkForUpdates } from '@/lib/updates'
import { hasSeenOnboarding } from './(auth)/onboarding'

SplashScreen.preventAutoHideAsync().catch(() => {})

// Cold-start probe — fire and forget. Downloads any newer EAS Update bundle
// into cache; the UpdateBanner then offers the user a one-tap restart. Safe
// no-op in dev / Expo Go (handled inside checkForUpdates).
void checkForUpdates({ silent: true })

// Re-probe whenever the app comes back to the foreground after a long break,
// so users on multi-day sessions get prompted instead of sitting on a stale
// bundle indefinitely. Throttled to once per 30 minutes to avoid hammering.
const FOREGROUND_CHECK_MS = 30 * 60 * 1000
let lastForegroundCheck = Date.now()
AppState.addEventListener('change', (next) => {
  if (next !== 'active') return
  const now = Date.now()
  if (now - lastForegroundCheck < FOREGROUND_CHECK_MS) return
  lastForegroundCheck = now
  void checkForUpdates({ silent: true })
})

function AuthGate() {
  const { user, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const onboardingChecked = useRef(false)

  useEffect(() => {
    if (loading) return
    SplashScreen.hideAsync().catch(() => {})
    const onAuthRoute = segments[0] === '(auth)'
    const onOnboarding = (segments[1] as string | undefined) === 'onboarding'

    if (!user) {
      // Show onboarding on first launch (before login) if it hasn't been seen.
      if (!onboardingChecked.current) {
        onboardingChecked.current = true
        hasSeenOnboarding().then((seen) => {
          if (!seen && !onOnboarding) {
            router.replace('/(auth)/onboarding' as any)
          } else if (!onAuthRoute) {
            router.replace('/(auth)/login')
          }
        })
        return
      }
      if (!onAuthRoute) router.replace('/(auth)/login')
    } else if (user && onAuthRoute) {
      router.replace('/(tabs)/home')
    }
  }, [user, loading, segments, router])

  return null
}

/**
 * Routes pushes into the app. Listens for:
 *   - notification-tap events (foreground or cold-start)
 *   - the initial notification that launched the app (cold-start)
 *
 * Cold-start path: when the user taps a push from a killed-state app, the
 * notification is consumed before our listener mounts, so we read it via
 * `getLastNotificationResponseAsync()` once. Pending taps wait until
 * auth + router are ready (see `pendingRouteRef`).
 */
function PushDeepLinkRouter() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pendingRouteRef = useRef<string | null>(null)
  const consumedColdStart = useRef(false)

  // Flush any pending route once we're authenticated and the router is ready.
  useEffect(() => {
    if (loading) return
    if (!user) return
    if (pendingRouteRef.current) {
      router.push(pendingRouteRef.current as any)
      pendingRouteRef.current = null
    }
  }, [user, loading, router])

  useEffect(() => {
    // Cold-start: app launched from a killed state via a push tap.
    if (!consumedColdStart.current) {
      consumedColdStart.current = true
      Notifications.getLastNotificationResponseAsync()
        .then((resp) => {
          if (!resp) return
          const route = deepLinkFromPushData(
            (resp.notification.request.content.data ?? {}) as Record<string, unknown>,
          )
          if (route) pendingRouteRef.current = route
        })
        .catch(() => {
          // swallow — non-fatal
        })
    }

    // Warm-start: app was open or backgrounded when the push was tapped.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = deepLinkFromPushData(
        (response.notification.request.content.data ?? {}) as Record<string, unknown>,
      )
      if (!route) return
      // If we already have an authed user + router, navigate now; otherwise
      // stash the route and let the auth effect flush it when ready.
      if (user) {
        router.push(route as any)
      } else {
        pendingRouteRef.current = route
      }
    })
    return () => sub.remove()
  }, [user, router])

  return null
}

function BootSplash({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()
  if (loading) {
    return <Splash />
  }
  return <>{children}</>
}

function RootStack() {
  const { colors } = useTheme()
  return (
    <>
      <AuthGate />
      <PushDeepLinkRouter />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
          headerTintColor: colors.accent,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="applications/[id]"
          options={{ headerShown: true, title: 'Application' }}
        />
        <Stack.Screen
          name="notifications"
          options={{ headerShown: true, title: 'Notifications' }}
        />
        <Stack.Screen
          name="messages/index"
          options={{ headerShown: true, title: 'Messages' }}
        />
        <Stack.Screen
          name="messages/[userId]"
          options={{ headerShown: true, title: 'Conversation' }}
        />
        <Stack.Screen
          name="profile-edit"
          options={{ headerShown: true, title: 'Edit Profile' }}
        />
        <Stack.Screen
          name="emails/index"
          options={{ headerShown: true, title: 'Emails' }}
        />
        <Stack.Screen
          name="apply/index"
          options={{ headerShown: true, title: 'New Application' }}
        />
        <Stack.Screen
          name="review/qbanks/[bank]"
          options={{ headerShown: true, title: 'Q-Bank' }}
        />
        <Stack.Screen
          name="review/exam/[sessionId]"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="review/results/[sessionId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="review/review/[sessionId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="subscription/index"
          options={{ headerShown: true, title: 'Subscription' }}
        />
        <Stack.Screen
          name="subscription/orders"
          options={{ headerShown: true, title: 'Order history' }}
        />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    stripePublishableKey?: string
    stripeMerchantId?: string
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={extra.stripePublishableKey ?? ''}
        merchantIdentifier={extra.stripeMerchantId}
        urlScheme="gritsync"
      >
        <PreferencesProvider>
          <AuthProvider>
            <BootSplash>
              <RootStack />
            </BootSplash>
            <OfflineBanner />
            <UpdateBanner />
          </AuthProvider>
        </PreferencesProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  )
}
