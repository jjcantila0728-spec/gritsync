// pearsonvue.gritsync.com/ — gatekeeper.
//
// The PearsonVue subdomain is the official test-delivery surface, not a
// place to set up a test. The only legitimate way to land here is for
// review.gritsync.com to create a session and redirect the user to
// `/exam/<sessionId>`. A naked hit on `/` means someone bookmarked the
// subdomain or typed the URL directly — we bounce them back to review so
// the exam-start flow happens in the right place (where the test type,
// bank, topics, etc. are chosen).

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { reviewUrl } from '@/lib/routing'

export function PearsonVueHome() {
  useEffect(() => {
    // Tiny delay so the user sees the redirect message and understands
    // they need to start the test from review, rather than just bouncing
    // through a blank page.
    const dest = reviewUrl('/nclex/qbanks')
    const t = setTimeout(() => { window.location.replace(dest) }, 1500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#003a70] text-white flex flex-col font-sans">
      <header className="bg-[#002347] border-b border-[#001a36] px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        <div className="h-7 w-7 rounded-sm bg-white flex items-center justify-center">
          <span className="text-[#003a70] text-[10px] font-black tracking-tight">PV</span>
        </div>
        <span className="text-sm font-semibold tracking-wide">Pearson VUE — Test Delivery</span>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg bg-white text-gray-900 rounded-sm shadow-2xl ring-1 ring-black/10">
          <div className="border-b-4 border-[#003a70] px-6 sm:px-10 pt-6 pb-4">
            <h1 className="text-2xl font-bold text-[#003a70]">No active examination</h1>
            <p className="mt-1 text-sm text-gray-500">Test delivery is locked.</p>
          </div>

          <div className="px-6 sm:px-10 py-6 space-y-4 text-sm leading-relaxed text-gray-700">
            <p>
              This environment is reserved for active NCLEX-RN&reg; test sessions.
              Tests can only be initiated from your GritSync review portal — the
              system selects the appropriate item pool, sets the time limit, and
              hands the session off to the Pearson VUE delivery surface
              automatically.
            </p>
            <p className="text-gray-500">
              Redirecting you to the review portal to start an exam…
            </p>
            <div className="flex items-center gap-2 text-[#003a70]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <a
                href={reviewUrl('/nclex/qbanks')}
                className="text-sm font-semibold underline-offset-2 hover:underline"
              >
                Continue to review.gritsync.com →
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#002347] text-blue-200 text-[11px] py-2 px-4 sm:px-6 text-center border-t border-[#001a36]">
        Pearson VUE Test Delivery &mdash; GritSync practice environment.
      </footer>
    </div>
  )
}
