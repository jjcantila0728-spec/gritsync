// pearsonvue.gritsync.com/ — proctor-style start screen that mimics the real
// Pearson VUE pre-test screen. Same backend as review.gritsync.com (no
// duplicate session state), just a different visual environment so learners
// practice in the UI they'll actually face on test day.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { nclexApi } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Sentry } from '@/lib/sentry'

export function PearsonVueHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [now, setNow] = useState(new Date())

  // Live clock — the real Pearson VUE screen has one in the corner.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const handleStart = async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await nclexApi.startSession({ examType: 'CAT' })
      const id = res.data?.data?.session?.id
      if (!id) throw new Error('No session id returned')
      navigate(`/exam/${id}`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not start the test.'
      setError(msg)
      try { Sentry.captureException?.(err) } catch { /* ignore */ }
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#003a70] text-white flex flex-col font-sans">
      {/* Top banner — Pearson VUE house style: solid navy, thin border, candidate id top-right */}
      <header className="bg-[#002347] border-b border-[#001a36] px-4 sm:px-6 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-sm bg-white flex items-center justify-center">
            <span className="text-[#003a70] text-[10px] font-black tracking-tight">PV</span>
          </div>
          <span className="text-sm font-semibold tracking-wide">Pearson VUE — Test Delivery</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-blue-200">
          <span className="hidden sm:inline">
            Candidate: {user?.first_name ?? 'Candidate'} {user?.last_name ?? ''}
          </span>
          <span className="font-mono">{now.toLocaleTimeString([], { hour12: false })}</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-3xl bg-white text-gray-900 rounded-sm shadow-2xl ring-1 ring-black/10">
          <div className="border-b-4 border-[#003a70] px-6 sm:px-10 pt-6 pb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#003a70]">NCLEX-RN&reg; Examination</h1>
            <p className="mt-1 text-sm text-gray-500">National Council Licensure Examination &mdash; Registered Nurse</p>
          </div>

          <div className="px-6 sm:px-10 py-6 space-y-5">
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">Confidentiality Agreement</h2>
              <p className="text-sm leading-relaxed text-gray-700">
                The NCLEX-RN examination is confidential. By beginning this test you agree
                that you will not disclose, share, or reproduce the questions or content of
                this examination in any form. Doing so is a violation of the agreement and
                may result in disciplinary action.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">Test Information</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <div className="flex justify-between sm:block">
                  <dt className="text-gray-500">Test format</dt>
                  <dd className="font-semibold text-gray-900">Computerized Adaptive Test (CAT)</dd>
                </div>
                <div className="flex justify-between sm:block">
                  <dt className="text-gray-500">Items</dt>
                  <dd className="font-semibold text-gray-900">85 – 150</dd>
                </div>
                <div className="flex justify-between sm:block">
                  <dt className="text-gray-500">Time allowed</dt>
                  <dd className="font-semibold text-gray-900">5 hours (incl. breaks)</dd>
                </div>
                <div className="flex justify-between sm:block">
                  <dt className="text-gray-500">Result</dt>
                  <dd className="font-semibold text-gray-900">Pass / Fail</dd>
                </div>
              </dl>
            </section>

            <section className="bg-amber-50 border border-amber-200 rounded-sm p-4 text-sm text-amber-900">
              <strong className="block mb-1">Once started, the test cannot be paused.</strong>
              Make sure you have a quiet environment and a stable connection before
              continuing. If you leave the test window the session may be invalidated.
            </section>

            <label className="flex items-start gap-3 text-sm text-gray-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded-sm border-gray-400 text-[#003a70] focus:ring-[#003a70]"
              />
              <span>
                I have read and agree to the Confidentiality Agreement and I am ready
                to begin the NCLEX-RN examination.
              </span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-300 rounded-sm px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 bg-gray-50 px-6 sm:px-10 py-4 flex items-center justify-between rounded-b-sm">
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : null}
              className="text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={!agreed || starting}
              className="inline-flex items-center gap-2 bg-[#003a70] hover:bg-[#002a55] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2.5 rounded-sm shadow-sm transition-colors"
            >
              {starting && <Loader2 className="h-4 w-4 animate-spin" />}
              {starting ? 'Starting…' : 'Begin Test'}
            </button>
          </div>
        </div>
      </main>

      <footer className="bg-[#002347] text-blue-200 text-[11px] py-2 px-4 sm:px-6 text-center border-t border-[#001a36]">
        Pearson VUE Test Delivery &mdash; GritSync practice environment. Replicates the
        official NCLEX-RN testing UI for training purposes.
      </footer>
    </div>
  )
}
