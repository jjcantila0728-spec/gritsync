import { useEffect, useState } from 'react'
import { Apple, Smartphone, Download as DownloadIcon, ShieldCheck, Check } from 'lucide-react'

/**
 * Mobile-app download / install page.
 *
 * Marketing-side public page hosted at gritsync.com/download (and surfaced
 * via the email signature + footer links). Detects iOS / Android on load
 * and surfaces the primary CTA accordingly:
 *
 *   iOS      → App Store badge (falls back to TestFlight while in review)
 *   Android  → Google Play badge + a direct APK download for people on
 *              older devices or in countries where Play isn't available
 *   Desktop  → both stores side-by-side + QR code instructions
 *
 * The three URLs are configured below. To swap in the real production
 * URLs after store approval, edit MOBILE_APP_LINKS at the top of this
 * file. APK URL points at the latest EAS build artifact — see
 * .github/workflows/mobile-build.yml for how it's produced.
 */

// ---------------------------------------------------------------------------
// Config — edit these after each store approval / EAS build
// ---------------------------------------------------------------------------
const MOBILE_APP_LINKS = {
  // Production App Store URL once Apple approves the listing.
  appStore: '', // 'https://apps.apple.com/app/gritsync/id0000000000'
  // TestFlight beta — fallback while App Store review is in progress.
  testFlight: '', // 'https://testflight.apple.com/join/xxxxxx'
  // Production Play Store URL once Google approves the listing.
  playStore: '', // 'https://play.google.com/store/apps/details?id=com.gritsync.app'
  // Direct APK download — hosted on Supabase Storage's public `downloads`
  // bucket, refreshed each time `scripts/upload-apk-to-supabase.cjs` runs.
  // The URL is stable across builds; the file behind it updates in-place.
  apk: 'https://jfgvjbawwvsviiyatnqn.supabase.co/storage/v1/object/public/downloads/gritsync.apk',
  // Internal preview track (Play Internal) — fallback while review pending.
  playInternal: '', // 'https://play.google.com/apps/internaltest/xxxxxx'
} as const

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || (navigator as any).vendor || (window as any).opera
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

export function Download() {
  const [platform, setPlatform] = useState<Platform>('desktop')

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 text-white">
      <div className="mx-auto max-w-5xl px-6 pt-16 pb-24">
        <div className="flex items-center gap-3 mb-12">
          <img src="/gritsync_logo.png" alt="GritSync" className="h-12 w-12 rounded-xl bg-white p-1.5" />
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Grit</span>
            <span className="text-white/90">Sync</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider mb-6">
              <DownloadIcon className="h-3.5 w-3.5" />
              GET THE APP
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
              GritSync on your phone.
            </h1>
            <p className="mt-4 text-white/85 text-lg leading-relaxed">
              Track your NCLEX application, upload documents, message your advisor, and study
              with our full Q-Banks — all from a native app for iOS and Android.
            </p>

            <ul className="mt-8 grid grid-cols-2 gap-3 text-sm text-white/90">
              {[
                'Face ID sign-in',
                'Push notifications',
                'Camera document capture',
                'NCLEX Q-Banks offline-friendly',
                'Live exam timer + calculator',
                'GCash / BDO / Stripe checkout',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 text-gray-900">
            <h2 className="text-xl font-extrabold">Install GritSync</h2>
            <p className="text-sm text-gray-600 mt-1">
              {platform === 'ios' && 'Detected: iPhone / iPad'}
              {platform === 'android' && 'Detected: Android'}
              {platform === 'desktop' && 'Open this page on your phone to install.'}
            </p>

            <div className="mt-6 space-y-3">
              {/* iOS */}
              {(platform === 'ios' || platform === 'desktop') && (
                <StoreButton
                  primary={platform === 'ios'}
                  href={MOBILE_APP_LINKS.appStore || MOBILE_APP_LINKS.testFlight || '#'}
                  label={MOBILE_APP_LINKS.appStore ? 'Download on the App Store' : 'Join TestFlight beta'}
                  sub={MOBILE_APP_LINKS.appStore ? 'iPhone & iPad' : 'iOS — App Store review pending'}
                  icon={<Apple className="h-6 w-6" />}
                  disabled={!MOBILE_APP_LINKS.appStore && !MOBILE_APP_LINKS.testFlight}
                />
              )}

              {/* Android */}
              {(platform === 'android' || platform === 'desktop') && (
                <>
                  <StoreButton
                    primary={platform === 'android'}
                    href={MOBILE_APP_LINKS.playStore || MOBILE_APP_LINKS.playInternal || '#'}
                    label={MOBILE_APP_LINKS.playStore ? 'Get it on Google Play' : 'Join Internal Test'}
                    sub={MOBILE_APP_LINKS.playStore ? 'Android phones & tablets' : 'Android — Play Store review pending'}
                    icon={<Smartphone className="h-6 w-6" />}
                    disabled={!MOBILE_APP_LINKS.playStore && !MOBILE_APP_LINKS.playInternal}
                  />
                  {MOBILE_APP_LINKS.apk && (
                    <a
                      href={MOBILE_APP_LINKS.apk}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition"
                    >
                      <DownloadIcon className="h-5 w-5 text-primary-600" />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-900">Direct APK download</div>
                        <div className="text-xs text-gray-500">
                          For Android devices without Google Play
                        </div>
                      </div>
                    </a>
                  )}
                </>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 flex items-start gap-3 text-xs text-gray-500">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary-600" />
              <p>
                Signed and verified by GritSync. Your account, documents, and payments are
                encrypted end-to-end. See our{' '}
                <a href="/privacy" className="text-primary-600 hover:underline">
                  privacy policy
                </a>{' '}
                for details.
              </p>
            </div>
          </div>
        </div>

        {platform === 'desktop' && (
          <div className="mt-12 text-center text-white/75 text-sm">
            Open <span className="font-mono bg-white/15 px-2 py-0.5 rounded">gritsync.com/download</span>
            {' '}on your phone to install.
          </div>
        )}
      </div>
    </div>
  )
}

function StoreButton({
  primary,
  href,
  label,
  sub,
  icon,
  disabled,
}: {
  primary: boolean
  href: string
  label: string
  sub: string
  icon: React.ReactNode
  disabled?: boolean
}) {
  if (disabled) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed">
        <div className="opacity-50">{icon}</div>
        <div className="flex-1">
          <div className="text-sm font-bold">{label}</div>
          <div className="text-xs">{sub}</div>
        </div>
      </div>
    )
  }
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      className={
        primary
          ? 'flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition shadow-lg'
          : 'flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition text-gray-900'
      }
    >
      {icon}
      <div className="flex-1">
        <div className="text-sm font-bold">{label}</div>
        <div className={primary ? 'text-xs text-white/80' : 'text-xs text-gray-500'}>{sub}</div>
      </div>
    </a>
  )
}

export default Download
