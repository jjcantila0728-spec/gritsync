import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { NCLEXLayout } from '@/layouts/NCLEXLayout'
import {
  BarChart2, Plus, Filter, ChevronRight, Crown, Zap,
  BookOpen, CheckCircle, XCircle, Clock, RotateCcw,
  TrendingUp, AlertCircle, X, Brain, Target,
  ChevronDown, ChevronUp, Lock, Gift, Sparkles,
} from 'lucide-react'

function getToken() { return localStorage.getItem('gritsync_token') }

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts?.headers || {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

interface Subscription {
  plan: string
  status: string
  expires_at: string | null
  questions_today: number
  daily_limit: number | null
  can_answer: boolean
}

interface UserStats {
  total_questions: number
  total_classic: number
  total_ngn: number
  total_sata: number
  total_case_studies: number
  used: number
  unused: number
  correct: number
  incorrect: number
  omitted: number
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ segments, label, centerLabel, centerSub }: {
  segments: { value: number; color: string; label: string }[]
  label: string
  centerLabel: string
  centerSub?: string
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-32 w-32 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
            <circle cx="50" cy="50" r="35" fill="none" stroke="#e5e7eb" strokeWidth="16" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold text-gray-900 dark:text-white">{centerLabel}</span>
            {centerSub && <span className="text-xs text-gray-500">{centerSub}</span>}
          </div>
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</p>
      </div>
    )
  }

  let offset = 0
  const circumference = 2 * Math.PI * 35

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-36 w-36 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90">
          <circle cx="50" cy="50" r="35" fill="none" stroke="#e5e7eb" strokeWidth="16" />
          {segments.filter(s => s.value > 0).map((seg, i) => {
            const pct = seg.value / total
            const dash = pct * circumference
            const el = (
              <circle
                key={i}
                cx="50" cy="50" r="35"
                fill="none"
                stroke={seg.color}
                strokeWidth="16"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset * circumference}
              />
            )
            offset += pct
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-gray-900 dark:text-white">{centerLabel}</span>
          {centerSub && <span className="text-xs text-gray-500">{centerSub}</span>}
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</p>
    </div>
  )
}

// ── Create Test Modal ─────────────────────────────────────────────────────────
type TestMode = 'tutorial' | 'timed' | 'cat' | 'readiness'
type TestType = 'classic' | 'ngn' | 'mixed'
type QuestionPool = 'unused' | 'incorrect' | 'marked' | 'all' | 'case_studies'

interface CreateTestConfig {
  mode: TestMode
  testType: TestType
  pool: QuestionPool
  questionCount: number
  contentArea: string
}

function CreateTestModal({ onClose, onStart, stats }: {
  onClose: () => void
  onStart: (config: CreateTestConfig) => void
  stats: UserStats | null
}) {
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<TestMode>('tutorial')
  const [testType, setTestType] = useState<TestType>('mixed')
  const [pool, setPool] = useState<QuestionPool>('all')
  const [questionCount, setQuestionCount] = useState(25)
  const [contentArea, setContentArea] = useState('all')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modeDescriptions: Record<TestMode, string> = {
    tutorial: 'Receive instant explanations after submitting your answers.',
    timed: 'Take the test under time pressure. Explanations available after completion.',
    cat: 'Computer Adaptive Test: difficulty adjusts based on your performance.',
    readiness: '75-question NCLEX simulation that mirrors the real exam format.',
  }

  async function handleStart() {
    setStarting(true)
    setError(null)
    try {
      const sessionType = mode === 'readiness' ? 'readiness' : mode === 'cat' ? 'cat' : 'practice'
      const data = await apiFetch('/api/questions/session/start', {
        method: 'POST',
        body: JSON.stringify({
          session_type: sessionType,
          mode,
          test_type: testType,
          pool,
          content_area: contentArea,
          question_count: mode === 'readiness' ? 75 : mode === 'cat' ? 85 : questionCount,
        }),
      })
      onStart({ mode, testType, pool, questionCount, contentArea })
      window.location.replace(`/nclex-review/exam/${data.session_id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create test')
      setStarting(false)
    }
  }

  const MODES: { key: TestMode; label: string; icon: any; locked?: boolean }[] = [
    { key: 'cat', label: 'CAT (Adaptive Test)', icon: Brain },
    { key: 'tutorial', label: 'Tutorial', icon: BookOpen },
    { key: 'timed', label: 'Timed', icon: Clock },
    { key: 'readiness', label: 'Readiness Assessment', icon: Target },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide">Create Test</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {step === 1 && (
            <div className="space-y-6">
              {/* Q-Bank Mode */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Q-Bank Mode</h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {MODES.map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setMode(key)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                          mode === key
                            ? 'border-[#17c3b2] bg-[#17c3b2]/10 text-[#17c3b2]'
                            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          mode === key ? 'border-[#17c3b2]' : 'border-gray-300'
                        }`}>
                          {mode === key && <div className="w-2 h-2 rounded-full bg-[#17c3b2]" />}
                        </div>
                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-xs truncate">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Mode description */}
                  <div className="mt-2 flex items-start gap-2 bg-[#17c3b2]/10 border border-[#17c3b2]/30 rounded-lg px-3 py-2.5">
                    <BookOpen className="h-4 w-4 text-[#17c3b2] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-[#17c3b2] capitalize">{mode}</span>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{modeDescriptions[mode]}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Test Type */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Test Type</h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <div className="flex gap-4">
                    {(['classic', 'ngn', 'mixed'] as TestType[]).map(t => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            testType === t ? 'border-[#17c3b2]' : 'border-gray-300'
                          }`}
                          onClick={() => setTestType(t)}
                        >
                          {testType === t && <div className="w-2 h-2 rounded-full bg-[#17c3b2]" />}
                        </div>
                        <span
                          className={`text-sm font-medium cursor-pointer ${testType === t ? 'text-[#17c3b2] font-semibold' : 'text-gray-700 dark:text-gray-300'}`}
                          onClick={() => setTestType(t)}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </span>
                        {testType === t && stats && (
                          <span className="text-xs text-gray-400">
                            ({t === 'classic' ? stats.total_classic : t === 'ngn' ? stats.total_ngn : stats.total_questions})
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Organization */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Organization</h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <div className="flex gap-6">
                    {[
                      { value: 'all', label: 'All Content Areas' },
                      { value: 'safe_effective_care_environment', label: 'Safe & Effective Care' },
                      { value: 'health_promotion_and_maintenance', label: 'Health Promotion' },
                      { value: 'psychosocial_integrity', label: 'Psychosocial Integrity' },
                      { value: 'physiological_integrity', label: 'Physiological Integrity' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                            contentArea === opt.value ? 'border-[#17c3b2]' : 'border-gray-300'
                          }`}
                          onClick={() => setContentArea(opt.value)}
                        >
                          {contentArea === opt.value && <div className="w-2 h-2 rounded-full bg-[#17c3b2]" />}
                        </div>
                        <span
                          className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
                          onClick={() => setContentArea(opt.value)}
                        >
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Question Pool */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Question Pool</h3>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { value: 'unused', label: 'Unused', sub: `${stats?.unused ?? '—'} questions` },
                      { value: 'incorrect', label: 'Incorrect', sub: `${stats?.incorrect ?? '—'} questions` },
                      { value: 'all', label: 'All', sub: `${stats?.total_questions ?? '—'} questions` },
                      { value: 'case_studies', label: 'Case Studies', sub: 'NGN cluster sets' },
                    ].map(opt => (
                      <label key={opt.value} className="cursor-pointer">
                        <div
                          className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border-2 transition-all ${
                            pool === opt.value
                              ? 'border-[#17c3b2] bg-[#17c3b2]/5'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                          onClick={() => setPool(opt.value as QuestionPool)}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${
                            pool === opt.value ? 'border-[#17c3b2]' : 'border-gray-300'
                          }`}>
                            {pool === opt.value && <div className="w-2 h-2 rounded-full bg-[#17c3b2]" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.label}</p>
                            <p className="text-xs text-gray-500">{opt.sub}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Test Length */}
              {mode !== 'readiness' && mode !== 'cat' && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                    Test Length <span className="text-gray-400 font-normal normal-case">Number of questions per test (max 150)</span>
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <input
                      type="number"
                      min={5}
                      max={150}
                      value={questionCount}
                      onChange={e => setQuestionCount(Math.min(150, Math.max(5, parseInt(e.target.value) || 25)))}
                      className="w-32 px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-900 focus:border-[#17c3b2] outline-none"
                    />
                  </div>
                </div>
              )}

              {pool === 'case_studies' && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 text-sm text-indigo-800 dark:text-indigo-300 space-y-2">
                  <p className="font-semibold">NGN Case Study Mode</p>
                  <p>Each question is linked to a detailed clinical scenario. The shared patient scenario appears at the top of the screen while you answer all 6 related questions — just like the real Next-Generation NCLEX.</p>
                  <ul className="list-disc list-inside space-y-1 text-indigo-700 dark:text-indigo-400">
                    <li>Questions are delivered as <strong>complete 6-question clusters</strong> — the actual count may be slightly more than the number you enter to preserve each cluster.</li>
                    <li>Content area and difficulty filters are not applied — case studies span multiple areas by design.</li>
                  </ul>
                </div>
              )}

              {mode === 'readiness' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
                  Readiness Assessment: 75 questions across all NCLEX content areas, simulating the real exam.
                </div>
              )}
              {mode === 'cat' && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 text-sm text-purple-800 dark:text-purple-300">
                  CAT Mode: Up to 85 questions with adaptive difficulty. The exam adjusts based on your performance.
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#17c3b2] text-white text-sm font-semibold hover:bg-[#14a99a] transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#17c3b2] text-white text-sm font-semibold hover:bg-[#14a99a] transition-colors disabled:opacity-60"
            >
              {starting ? 'Creating...' : <>Start Test <ChevronRight className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Upgrade Modal ─────────────────────────────────────────────────────────────
function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [paymentInfo, setPaymentInfo] = useState<{ accounts: { method: string; name: string; number: string }[] } | null>(null)
  const [paymentError, setPaymentError] = useState(false)

  useEffect(() => {
    fetch('/api/questions/payment-info')
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() })
      .then(setPaymentInfo)
      .catch(() => setPaymentError(true))
  }, [])

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Upgrade Your Plan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: 'premium', name: 'Premium', Icon: Zap, price: '₱250', period: '2 months', color: 'blue',
              features: ['250 questions/day', 'All question types (MCQ + NGN)', 'Tutorial, Timed & CAT modes', 'Detailed rationales'] },
            { key: 'vip', name: 'VIP', Icon: Crown, price: '₱500', period: '6 months', color: 'amber',
              features: ['Unlimited questions/day', 'All question types (MCQ + NGN)', 'All exam modes', 'Priority support', 'Best value!'] },
          ].map(({ key, name, Icon, price, period, color, features }) => (
            <div key={key} className={`rounded-xl border-2 p-4 ${
              color === 'amber' ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10' : 'border-blue-300 bg-blue-50 dark:bg-blue-900/10'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${color === 'amber' ? 'text-amber-500' : 'text-blue-500'}`} />
                  <span className={`font-bold ${color === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`}>{name}</span>
                </div>
                <div className="text-right">
                  <span className={`text-xl font-black ${color === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`}>{price}</span>
                  <span className="text-xs text-gray-500 ml-1">/ {period}</span>
                </div>
              </div>
              <ul className="space-y-1 mb-3">
                {features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <CheckCircle className={`h-3 w-3 flex-shrink-0 ${color === 'amber' ? 'text-amber-500' : 'text-blue-500'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Payment info */}
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">Send payment to:</p>
            {paymentError ? (
              <p className="text-sm font-medium text-red-500">Unable to load payment info — contact admin to upgrade.</p>
            ) : paymentInfo ? (
              paymentInfo.accounts.map(a => (
                <p key={a.method} className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {a.method}: {a.number} ({a.name})
                </p>
              ))
            ) : (
              <p className="text-sm text-gray-400 animate-pulse">Loading payment info...</p>
            )}
            <p className="text-xs text-gray-400 mt-2">Message admin with proof of payment and your email address.</p>
          </div>
        </div>
        <div className="px-6 pb-5">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Free Activate Modal ───────────────────────────────────────────────────────
function FreeActivateModal({ eligibility, onClose, onActivated }: {
  eligibility: any
  onClose: () => void
  onActivated: () => void
}) {
  const [activating, setActivating] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleActivate() {
    setActivating(true)
    setError(null)
    try {
      await apiFetch('/api/questions/free-review-activate', { method: 'POST' })
      setDone(true)
      setTimeout(() => {
        onActivated()
        onClose()
      }, 2200)
    } catch (err: any) {
      setError(err.message || 'Activation failed')
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0d2137] to-[#163352] px-6 pt-6 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[#17c3b2]/20 flex items-center justify-center">
                <Gift className="h-4 w-4 text-[#17c3b2]" />
              </div>
              <span className="text-xs font-bold text-[#17c3b2] uppercase tracking-widest">Processing Client Benefit</span>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 className="text-2xl font-black text-white leading-tight">
            2 Months FREE<br />
            <span className="text-[#17c3b2]">Premium NCLEX Review</span>
          </h2>
          <p className="text-white/70 text-sm mt-1.5">Complimentary access included with your NCLEX Processing subscription.</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Order Summary */}
          <div className="rounded-xl border-2 border-[#17c3b2]/30 bg-[#17c3b2]/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-900 dark:text-white">Order Summary</span>
              <span className="text-xs font-bold text-[#17c3b2] bg-[#17c3b2]/10 px-2.5 py-1 rounded-full">FREE</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">NCLEX RN Q-Bank — Premium</span>
                <span className="font-semibold text-gray-900 dark:text-white">2 Months</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">250 questions/day</span>
                <span className="font-semibold text-[#17c3b2]">Included</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">All exam modes (Tutorial, CAT, Timed)</span>
                <span className="font-semibold text-[#17c3b2]">Included</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">NGN case studies + detailed rationales</span>
                <span className="font-semibold text-[#17c3b2]">Included</span>
              </div>
              <div className="border-t border-[#17c3b2]/20 pt-2 mt-2 flex justify-between text-sm font-bold">
                <span className="text-gray-900 dark:text-white">Total Due Today</span>
                <span className="text-[#17c3b2] text-lg">₱0.00</span>
              </div>
            </div>
          </div>

          {/* Application Info */}
          {eligibility?.application && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Verified NCLEX Processing Client</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Application {eligibility.application.grit_app_id || eligibility.application.id?.slice(0,8).toUpperCase()} · {eligibility.application.status}
                </p>
              </div>
            </div>
          )}

          {/* What you get */}
          <div className="space-y-2">
            {[
              'Access to full Q-Bank (42+ questions, constantly growing)',
              'NGN next-generation nursing case studies',
              'Performance analytics & session history',
              'Expires 2 months from activation — use it wisely!',
            ].map(f => (
              <div key={f} className="flex items-start gap-2.5">
                <Sparkles className="h-3.5 w-3.5 text-[#17c3b2] flex-shrink-0 mt-0.5" />
                <span className="text-xs text-gray-600 dark:text-gray-400">{f}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {done && (
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">Activated! Enjoy your 2 months of Premium access.</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 space-y-2">
          {!done && (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="w-full py-3 rounded-xl bg-[#17c3b2] text-white font-bold text-sm hover:bg-[#14a99a] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-[#17c3b2]/20"
            >
              {activating ? (
                <><RotateCcw className="h-4 w-4 animate-spin" /> Activating...</>
              ) : (
                <><Gift className="h-4 w-4" /> Activate Free Subscription</>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {done ? 'Close' : 'Maybe Later'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function NCLEXReview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [activeTab, setActiveTab] = useState<'statistics' | 'previous'>('statistics')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateTest, setShowCreateTest] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showFreeActivate, setShowFreeActivate] = useState(false)
  const [eligibility, setEligibility] = useState<any>(null)
  const [statsTab, setStatsTab] = useState<'classic' | 'ngn' | 'case_studies'>('classic')
  const [seedingLoading, setSeedingLoading] = useState(false)
  const [seedingCaseStudiesLoading, setSeedingCaseStudiesLoading] = useState(false)
  const [showReseedConfirm, setShowReseedConfirm] = useState(false)
  const [adminBankCount, setAdminBankCount] = useState<number | null>(null)
  const [filterPending, setFilterPending] = useState(false)

  useEffect(() => {
    if (location.state?.openUpgrade) navigate('/nclex-review/checkout')
  }, [location.state])

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const requests: Promise<any>[] = [
        apiFetch('/api/questions/subscription/me'),
        apiFetch('/api/questions/user-stats'),
        apiFetch('/api/questions/my-sessions?limit=50'),
        apiFetch('/api/questions/free-review-eligibility'),
      ]
      if (user.role === 'admin') {
        requests.push(apiFetch('/api/questions/stats'))
      }

      const [subData, statsData, sessionsData, eligData, bankStatsData] = await Promise.allSettled(requests)

      if (subData.status === 'fulfilled') setSubscription(subData.value)
      if (statsData.status === 'fulfilled') setStats(statsData.value)
      if (sessionsData.status === 'fulfilled') setSessions(Array.isArray(sessionsData.value) ? sessionsData.value : [])
      if (eligData.status === 'fulfilled') setEligibility(eligData.value)
      if (bankStatsData && bankStatsData.status === 'fulfilled') {
        setAdminBankCount(bankStatsData.value?.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadAll() }, [loadAll])

  async function seedQuestions(force = false) {
    setSeedingLoading(true)
    setShowReseedConfirm(false)
    try {
      const url = force ? '/api/questions/seed?force=true' : '/api/questions/seed'
      await apiFetch(url, { method: 'POST' })
      await loadAll()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSeedingLoading(false)
    }
  }

  async function seedCaseStudies() {
    setSeedingCaseStudiesLoading(true)
    try {
      const result = await apiFetch('/api/questions/seed-case-studies', { method: 'POST' })
      await loadAll()
      if (result.insertedStudies > 0) {
        alert(`Seeded ${result.insertedStudies} case studies with ${result.insertedQuestions} questions.`)
      } else {
        alert(result.message || 'Case studies already exist.')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSeedingCaseStudiesLoading(false)
    }
  }

  if (!user) {
    return (
      <NCLEXLayout subscription={null}>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Please sign in to access NCLEX Review.</p>
        </div>
      </NCLEXLayout>
    )
  }

  const plan = subscription?.plan || 'free'
  const completedSessions = sessions.filter(s => s.status === 'completed')
  const pendingSessions = sessions.filter(s => s.status === 'in_progress')

  const totalBank = stats?.total_questions ?? 0
  const usedQuestions = stats?.used ?? 0
  const unusedQuestions = stats?.unused ?? 0
  const correctQuestions = stats?.correct ?? 0
  const incorrectQuestions = stats?.incorrect ?? 0

  const usagePct = totalBank > 0 ? Math.round((usedQuestions / totalBank) * 100) : 0
  const unusedPct = totalBank > 0 ? 100 - usagePct : 100

  const displayedSessions = filterPending ? pendingSessions : completedSessions

  return (
    <NCLEXLayout subscription={subscription}>
      {showCreateTest && (
        <CreateTestModal
          onClose={() => setShowCreateTest(false)}
          onStart={() => setShowCreateTest(false)}
          stats={stats}
        />
      )}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      {showFreeActivate && (
        <FreeActivateModal
          eligibility={eligibility}
          onClose={() => setShowFreeActivate(false)}
          onActivated={loadAll}
        />
      )}

      {showReseedConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Reset & Re-seed Question Bank?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
              This will permanently delete all <strong>{adminBankCount ?? 0}</strong> existing questions and replace them with the default seed questions. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReseedConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => seedQuestions(true)}
                disabled={seedingLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                {seedingLoading ? 'Resetting...' : 'Reset & Re-seed'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 lg:p-7 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">NCLEX RN – Q-Bank</h1>
            {subscription?.expires_at && (
              <p className="text-sm text-gray-500 mt-0.5">
                Expires in {Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / 86400000))} days
                &nbsp;·&nbsp;
                <button onClick={() => navigate('/nclex-review/checkout')} className="text-[#17c3b2] hover:underline font-medium">
                  Extend
                </button>
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {user?.role === 'admin' && (
              <button
                onClick={() => (adminBankCount ?? 0) >= 10 ? setShowReseedConfirm(true) : seedQuestions()}
                disabled={seedingLoading}
                className="px-3 py-2 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {seedingLoading ? 'Seeding...' : (adminBankCount ?? 0) >= 10 ? 'Reset & Re-seed' : 'Seed Questions'}
              </button>
            )}
            {user?.role === 'admin' && (
              <button
                onClick={seedCaseStudies}
                disabled={seedingCaseStudiesLoading}
                className="px-3 py-2 rounded-xl border border-indigo-300 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                {seedingCaseStudiesLoading ? 'Seeding...' : 'Seed Case Studies'}
              </button>
            )}
            <button
              onClick={() => {
                if (plan === 'free' && !subscription?.can_answer) {
                  navigate('/nclex-review/checkout')
                  return
                }
                setShowCreateTest(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17c3b2] text-white text-sm font-semibold hover:bg-[#14a99a] transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Create Test
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-1">
          {[
            { key: 'statistics', label: 'Statistics' },
            { key: 'previous', label: 'History' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-[#17c3b2] text-[#17c3b2]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Statistics Tab */}
        {activeTab === 'statistics' && (
          <div className="space-y-6">
            {/* Promo banners */}
            {plan === 'free' && eligibility?.eligible && (
              <div className="rounded-2xl bg-gradient-to-r from-[#0d2137] to-[#163352] text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-2 border-[#17c3b2]/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#17c3b2] text-white text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">
                  Processing Perk
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-[#17c3b2]/20 flex items-center justify-center flex-shrink-0">
                    <Gift className="h-5 w-5 text-[#17c3b2]" />
                  </div>
                  <div>
                    <p className="font-bold">You Have 2 Months FREE Premium!</p>
                    <p className="text-sm text-white/70 mt-0.5">As a GritSync Processing client, enjoy complimentary Premium access — 250 questions/day, all modes included.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFreeActivate(true)}
                  className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#17c3b2] text-white text-sm font-bold hover:bg-[#14a99a] transition-colors shadow-lg shadow-[#17c3b2]/30 whitespace-nowrap"
                >
                  <Gift className="h-4 w-4" /> Activate Free Access
                </button>
              </div>
            )}
            {plan === 'free' && !eligibility?.eligible && (
              <div className="rounded-2xl bg-gradient-to-r from-[#0d2137] to-[#163352] text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-[#17c3b2]/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="h-5 w-5 text-[#17c3b2]" />
                  </div>
                  <div>
                    <p className="font-bold">Boost Your Confidence Before Exam Day!</p>
                    <p className="text-sm text-white/70 mt-0.5">Unlock unlimited questions and all exam modes with Premium or VIP.</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/nclex-review/checkout')}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#17c3b2] text-white text-sm font-bold hover:bg-[#14a99a] transition-colors"
                >
                  <Crown className="h-4 w-4" /> Upgrade Plan
                </button>
              </div>
            )}

            {/* Stats Charts */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-[#17c3b2]" /> Statistics
                </h2>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setStatsTab('classic')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${statsTab === 'classic' ? 'bg-white dark:bg-gray-700 text-[#17c3b2] shadow-sm' : 'text-gray-500'}`}
                  >
                    Classic ({stats?.total_classic ?? '—'})
                  </button>
                  <button
                    onClick={() => setStatsTab('ngn')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${statsTab === 'ngn' ? 'bg-white dark:bg-gray-700 text-[#17c3b2] shadow-sm' : 'text-gray-500'}`}
                  >
                    NGN ({stats?.total_ngn ?? '—'})
                  </button>
                  <button
                    onClick={() => setStatsTab('case_studies')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${statsTab === 'case_studies' ? 'bg-white dark:bg-gray-700 text-[#17c3b2] shadow-sm' : 'text-gray-500'}`}
                  >
                    Case Studies ({stats?.total_case_studies ?? '—'})
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-48 text-gray-400">Loading statistics...</div>
              ) : totalBank === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                  <BookOpen className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No questions in the bank yet.</p>
                  {user?.role === 'admin' && (
                    <div className="flex gap-2">
                      <button
                        onClick={seedQuestions}
                        disabled={seedingLoading}
                        className="px-4 py-2 rounded-lg bg-[#17c3b2] text-white text-sm font-semibold hover:bg-[#14a99a]"
                      >
                        {seedingLoading ? 'Seeding...' : 'Seed Sample Questions'}
                      </button>
                      <button
                        onClick={seedCaseStudies}
                        disabled={seedingCaseStudiesLoading}
                        className="px-4 py-2 rounded-lg border border-indigo-300 text-indigo-600 text-sm font-semibold hover:bg-indigo-50"
                      >
                        {seedingCaseStudiesLoading ? 'Seeding...' : 'Seed Case Studies'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Usage donut */}
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <DonutChart
                      label="Usage"
                      centerLabel={`${usagePct}%`}
                      centerSub="Used"
                      segments={[
                        { value: usedQuestions, color: '#6366f1', label: 'Used' },
                        { value: unusedQuestions, color: '#e5e7eb', label: 'Unused' },
                      ]}
                    />
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-600 dark:text-gray-400">Total Questions</span>
                        <span className="font-bold text-gray-900 dark:text-white">{totalBank}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-600 dark:text-gray-400">Used Questions</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">{usedQuestions}</span>
                          <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-1.5 py-0.5 rounded font-semibold">{usagePct}%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-600 dark:text-gray-400">Unused Questions</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">{unusedQuestions}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded font-semibold">{unusedPct}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Questions accuracy donut */}
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <DonutChart
                      label="Questions"
                      centerLabel={usedQuestions > 0 ? `${Math.round((correctQuestions / usedQuestions) * 100)}%` : '0%'}
                      centerSub="Correct"
                      segments={[
                        { value: correctQuestions, color: '#22c55e', label: 'Correct' },
                        { value: incorrectQuestions, color: '#f97316', label: 'Incorrect' },
                      ]}
                    />
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-600 dark:text-gray-400">Total Correct</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">{correctQuestions}</span>
                          {usedQuestions > 0 && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded font-semibold">{Math.round((correctQuestions / usedQuestions) * 100)}%</span>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-gray-600 dark:text-gray-400">Total Incorrect</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">{incorrectQuestions}</span>
                          {usedQuestions > 0 && <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 rounded font-semibold">{Math.round((incorrectQuestions / usedQuestions) * 100)}%</span>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-600 dark:text-gray-400">Total Omitted</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">0</span>
                          <span className="text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 px-1.5 py-0.5 rounded font-semibold">0%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recent sessions preview */}
            {completedSessions.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Recent Tests</h2>
                  <button onClick={() => setActiveTab('previous')} className="text-xs text-[#17c3b2] hover:underline font-medium">
                    View all →
                  </button>
                </div>
                <div className="space-y-2">
                  {completedSessions.slice(0, 3).map(s => {
                    const total = s.total_questions || 0
                    const correct = s.correct_answers || 0
                    const score = total > 0 ? Math.round((correct / total) * 100) : 0
                    const settings = s.settings || {}
                    return (
                      <div key={s.id} className="flex items-center gap-4 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <span className="text-sm font-mono text-gray-500 w-16 flex-shrink-0">#{s.id}</span>
                        <span className={`text-sm font-bold w-12 flex-shrink-0 ${score >= 75 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>{score}%</span>
                        <span className="text-xs text-gray-500 flex-1 min-w-0">
                          {new Date(s.time_started).toLocaleDateString()} · {s.session_type} · {settings.mode || 'tutorial'}
                        </span>
                        <button
                          onClick={() => navigate(`/nclex-review/exam/${s.id}?review=true`)}
                          className="text-xs text-[#17c3b2] hover:underline font-medium flex-shrink-0"
                        >
                          Review
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Previous Tests Tab */}
        {activeTab === 'previous' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Filter header */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setFilterPending(false)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  !filterPending ? 'bg-[#17c3b2] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                Completed ({completedSessions.length})
              </button>
              <button
                onClick={() => setFilterPending(true)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  filterPending ? 'bg-[#17c3b2] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                In Progress ({pendingSessions.length})
              </button>
              <div className="ml-auto">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Filter className="h-3.5 w-3.5" /> Filter
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48 text-gray-400">Loading tests...</div>
            ) : displayedSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                <RotateCcw className="h-10 w-10 opacity-30" />
                <p className="text-sm">{filterPending ? 'No tests in progress' : 'No completed tests yet'}</p>
                <button
                  onClick={() => setShowCreateTest(true)}
                  className="px-4 py-2 rounded-lg bg-[#17c3b2] text-white text-sm font-semibold hover:bg-[#14a99a]"
                >
                  Create Your First Test
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-900 dark:bg-gray-800 text-white">
                      <th className="px-5 py-3 text-xs font-semibold text-left uppercase tracking-wide">Test ID</th>
                      <th className="px-4 py-3 text-xs font-semibold text-left uppercase tracking-wide">Score</th>
                      <th className="px-4 py-3 text-xs font-semibold text-left uppercase tracking-wide">Questions</th>
                      <th className="px-4 py-3 text-xs font-semibold text-left uppercase tracking-wide">
                        <div className="flex items-center gap-2">
                          Date
                          <span className="text-gray-400">⇄</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-left uppercase tracking-wide">Mode</th>
                      <th className="px-4 py-3 text-xs font-semibold text-center uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {displayedSessions.map(s => {
                      const total = s.total_questions || 0
                      const correct = s.correct_answers || 0
                      const score = total > 0 ? Math.round((correct / total) * 100) : null
                      const settings = s.settings || {}
                      const modeLabel = `${(settings.test_type || 'Mixed').charAt(0).toUpperCase() + (settings.test_type || 'Mixed').slice(1)} | ${(settings.mode || s.session_type).charAt(0).toUpperCase() + (settings.mode || s.session_type).slice(1)}`
                      const date = new Date(s.time_started)
                      return (
                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-5 py-4 text-sm font-mono text-gray-700 dark:text-gray-300">{s.id}</td>
                          <td className="px-4 py-4">
                            {score !== null ? (
                              <span className={`text-sm font-bold ${score >= 75 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {score}%
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">{s.questions_answered || 0}</span>
                            <span className="text-gray-400">/{total}</span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            &nbsp;·&nbsp;
                            {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#17c3b2]/10 text-[#17c3b2] border border-[#17c3b2]/30">
                              {modeLabel}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-3">
                              {s.status === 'in_progress' ? (
                                <button
                                  onClick={() => navigate(`/nclex-review/exam/${s.id}`)}
                                  className="flex flex-col items-center gap-0.5 text-[#17c3b2] hover:text-[#14a99a] transition-colors"
                                >
                                  <Play className="h-5 w-5" />
                                  <span className="text-[10px] font-semibold">Resume</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => navigate(`/nclex-review/exam/${s.id}?review=true`)}
                                    className="flex flex-col items-center gap-0.5 text-[#17c3b2] hover:text-[#14a99a] transition-colors"
                                  >
                                    <BarChart2 className="h-5 w-5" />
                                    <span className="text-[10px] font-semibold">Score/Stats</span>
                                  </button>
                                  <button
                                    onClick={() => navigate(`/nclex-review/exam/${s.id}?review=true&tab=explanations`)}
                                    className="flex flex-col items-center gap-0.5 text-[#17c3b2] hover:text-[#14a99a] transition-colors"
                                  >
                                    <BookOpen className="h-5 w-5" />
                                    <span className="text-[10px] font-semibold">Explanations</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </NCLEXLayout>
  )
}

function Play({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M8 5.14v14l11-7-11-7z"/></svg>
}
