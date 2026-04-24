import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { NCLEXLayout } from '@/layouts/NCLEXLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  BookOpen, Play, Brain, Target, Clock,
  CheckCircle, XCircle, AlertCircle, RotateCcw, BarChart2,
  ChevronRight, ChevronLeft, Award, Lightbulb,
  Crown, Zap, Lock, TrendingUp, Star, Calendar,
} from 'lucide-react'

const CONTENT_AREAS = [
  { value: 'all', label: 'All Content Areas' },
  { value: 'safe_effective_care_environment', label: 'Safe & Effective Care' },
  { value: 'health_promotion_and_maintenance', label: 'Health Promotion' },
  { value: 'psychosocial_integrity', label: 'Psychosocial Integrity' },
  { value: 'physiological_integrity', label: 'Physiological Integrity' },
]

const CONTENT_AREA_LABELS: Record<string, string> = {
  safe_effective_care_environment: 'Safe & Effective Care',
  health_promotion_and_maintenance: 'Health Promotion',
  psychosocial_integrity: 'Psychosocial Integrity',
  physiological_integrity: 'Physiological Integrity',
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  traditional_mcq: 'Traditional MCQ',
  ngn_sata: 'NGN – Select All That Apply',
  ngn_cloze: 'NGN – Cloze Dropdown',
  ngn_matrix: 'NGN – Matrix/Grid',
}

function getToken() {
  return localStorage.getItem('gritsync_token')
}

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

type ViewState = 'home' | 'config' | 'session' | 'results' | 'upgrade'
type SessionMode = 'practice' | 'readiness' | 'cat'

interface Question {
  id: number
  question_text: string
  question_type: string
  content_area: string
  difficulty: string
  is_ngn: boolean
  options: any
}

interface Subscription {
  plan: string
  status: string
  expires_at: string | null
  questions_today: number
  daily_limit: number | null
  can_answer: boolean
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const cls =
    difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
    difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
  return <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${cls}`}>{difficulty}</span>
}

function TraditionalQuestion({ question, selectedAnswer, onSelect, disabled }: {
  question: Question; selectedAnswer: string | null; onSelect: (id: string) => void; disabled: boolean
}) {
  const options: any[] = Array.isArray(question.options) ? question.options : []
  return (
    <div className="space-y-3">
      {options.map((opt: any) => (
        <button key={opt.id} onClick={() => !disabled && onSelect(opt.id)} disabled={disabled}
          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
            selectedAnswer === opt.id
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
          <div className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
              selectedAnswer === opt.id ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-500'
            }`}>{opt.id?.toUpperCase()}</span>
            <span className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{opt.text}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function SATAQuestion({ question, selectedAnswers, onToggle, disabled }: {
  question: Question; selectedAnswers: string[]; onToggle: (id: string) => void; disabled: boolean
}) {
  const options: any[] = Array.isArray(question.options) ? question.options : []
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 italic">Select all that apply.</p>
      {options.map((opt: any) => {
        const checked = selectedAnswers.includes(opt.id)
        return (
          <button key={opt.id} onClick={() => !disabled && onToggle(opt.id)} disabled={disabled}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
              checked ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
            <div className="flex items-start gap-3">
              <span className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                checked ? 'border-primary-500 bg-primary-500' : 'border-gray-300 dark:border-gray-600'
              }`}>
                {checked && <CheckCircle className="h-3 w-3 text-white" />}
              </span>
              <span className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{opt.text}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ClozeQuestion({ question, selectedAnswers, onSelect, disabled }: {
  question: Question; selectedAnswers: Record<string, string>; onSelect: (blankId: string, value: string) => void; disabled: boolean
}) {
  const stem: string = question.options?.stem || ''
  const blanks: any[] = question.options?.blanks || []
  const parts = stem.split(/(\[\d+\])/)
  return (
    <div className="text-sm text-gray-800 dark:text-gray-200 leading-loose">
      {parts.map((part, i) => {
        const match = part.match(/\[(\d+)\]/)
        if (match) {
          const blankId = match[1]
          const blank = blanks.find((b: any) => String(b.id) === blankId)
          return (
            <select key={i} value={selectedAnswers[blankId] || ''} onChange={(e) => !disabled && onSelect(blankId, e.target.value)} disabled={disabled}
              className="inline-block mx-1 border-b-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded text-sm">
              <option value="">— select —</option>
              {blank?.choices?.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </div>
  )
}

function MatrixQuestion({ question, selectedAnswers, onSelect, disabled }: {
  question: Question; selectedAnswers: Record<string, string>; onSelect: (row: string, col: string) => void; disabled: boolean
}) {
  const rows: any[] = question.options?.rows || []
  const columns: any[] = question.options?.columns || []
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="p-2 border dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-left" />
            {columns.map((col: any) => (
              <th key={col.id} className="p-2 border dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-center text-xs text-gray-700 dark:text-gray-300">
                {col.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any) => (
            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="p-2 border dark:border-gray-600 text-xs text-gray-800 dark:text-gray-200">{row.text}</td>
              {columns.map((col: any) => (
                <td key={col.id} className="p-2 border dark:border-gray-600 text-center">
                  <input type="radio" name={`matrix-${question.id}-${row.id}`}
                    checked={selectedAnswers[String(row.id)] === String(col.id)}
                    onChange={() => !disabled && onSelect(String(row.id), String(col.id))}
                    disabled={disabled} className="accent-primary-500 cursor-pointer" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Upgrade / Pricing View ───────────────────────────────────────────────────

function UpgradeView({ onBack, questionsToday, dailyLimit }: {
  onBack: () => void
  questionsToday: number
  dailyLimit: number | null
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {dailyLimit !== null && questionsToday >= dailyLimit && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-6 flex items-start gap-4">
          <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">Daily Limit Reached</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              You've used all {dailyLimit} free questions for today. Upgrade to continue practicing, or come back tomorrow.
            </p>
          </div>
        </div>
      )}

      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Upgrade Your Plan</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Unlock unlimited access and ace your NCLEX exam</p>
      </div>

      <Card className="p-5 border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Free Forever</p>
              <p className="text-xs text-gray-400">Your current plan</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-700 dark:text-gray-300">₱0</p>
            <p className="text-xs text-gray-400">25 questions/day</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            key: 'premium', name: 'Premium', Icon: Zap, price: '₱250', period: '2 months', isVip: false,
            features: ['250 questions per day', 'All question types (MCQ + NGN)', 'Practice, RA & CAT modes', 'Detailed rationales', 'Performance analytics'],
          },
          {
            key: 'vip', name: 'VIP', Icon: Crown, price: '₱500', period: '6 months', isVip: true,
            features: ['Unlimited questions per day', 'All question types (MCQ + NGN)', 'Practice, RA & CAT modes', 'Detailed rationales', 'Advanced analytics', 'Priority support', 'Best value!'],
          },
        ].map(({ key, name, Icon, price, period, isVip, features }) => (
          <div key={key} className={`relative rounded-2xl border-2 p-6 ${
            isVip ? 'border-amber-400 dark:border-amber-600 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20'
                  : 'border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
          }`}>
            {isVip && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">BEST VALUE</span>
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isVip ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                <Icon className={`h-6 w-6 ${isVip ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`} />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${isVip ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`}>{name}</h3>
                <p className="text-sm text-gray-500">{period} access</p>
              </div>
            </div>
            <div className="mb-5">
              <span className={`text-3xl font-black ${isVip ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`}>{price}</span>
              <span className="text-gray-400 text-sm ml-1">/ {period}</span>
            </div>
            <ul className="space-y-2 mb-6">
              {features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle className={`h-4 w-4 flex-shrink-0 ${isVip ? 'text-amber-500' : 'text-blue-500'}`} />
                  {f}
                </li>
              ))}
            </ul>
            <div className={`rounded-xl p-4 text-center ${isVip ? 'bg-amber-100/50 dark:bg-amber-900/30' : 'bg-blue-100/50 dark:bg-blue-900/30'}`}>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">To activate, send payment to:</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">GCash / Maya: 09XX-XXX-XXXX</p>
              <p className="text-xs text-gray-500 mt-1">Message admin with your proof of payment.</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={onBack}>← Back to Platform</Button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NCLEXReview() {
  const { user } = useAuth()

  const [view, setView] = useState<ViewState>('home')
  const [mode, setMode] = useState<SessionMode>('practice')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [recentSessions, setRecentSessions] = useState<any[]>([])

  // Config
  const [contentArea, setContentArea] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [questionType, setQuestionType] = useState('all')
  const [questionCount, setQuestionCount] = useState(20)
  const [immediateFeedback, setImmediateFeedback] = useState(true)

  // Session state — all questions loaded at once
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const [selectedMatrixAnswers, setSelectedMatrixAnswers] = useState<Record<string, string>>({})
  const [selectedClozeAnswers, setSelectedClozeAnswers] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<{ is_correct: boolean; correct_answer: any; rationale?: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [results, setResults] = useState<any>(null)

  const currentQuestion = questions[questionIndex] || null
  const totalQuestions = questions.length

  // ── Subscription ──
  const loadSubscription = useCallback(async () => {
    try {
      setSubLoading(true)
      const data = await apiFetch('/api/questions/subscription/me')
      setSubscription(data)
    } catch {
      setSubscription({ plan: 'free', status: 'active', expires_at: null, questions_today: 0, daily_limit: 25, can_answer: true })
    } finally {
      setSubLoading(false)
    }
  }, [])

  const loadRecentSessions = useCallback(async () => {
    try {
      const data = await apiFetch('/api/questions/my-sessions')
      setRecentSessions(Array.isArray(data) ? data.slice(0, 4) : [])
    } catch {
      setRecentSessions([])
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadSubscription()
      loadRecentSessions()
    }
  }, [user, loadSubscription, loadRecentSessions])

  // Timer
  useEffect(() => {
    if (view === 'session') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [view])

  // ── Start session ──
  async function startSession(sessionMode?: SessionMode) {
    const m = sessionMode || mode
    if (!subscription?.can_answer && subscription?.plan === 'free') {
      setView('upgrade')
      return
    }

    setSessionLoading(true)
    setSessionError(null)

    try {
      const body: any = { session_type: m }
      if (m === 'practice') {
        if (contentArea !== 'all') body.content_area = contentArea
        if (difficulty !== 'all') body.difficulty = difficulty
        if (questionType !== 'all') body.question_type = questionType
        body.question_count = questionCount
      } else if (m === 'cat') {
        body.difficulty = 'medium'
      }

      const data = await apiFetch('/api/questions/session/start', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      setSessionId(data.session_id)
      setQuestions(data.questions || [])
      setQuestionIndex(0)
      setSelectedAnswer(null)
      setSelectedAnswers([])
      setSelectedMatrixAnswers({})
      setSelectedClozeAnswers({})
      setFeedback(null)
      setElapsed(0)
      setCorrectCount(0)
      setView('session')
    } catch (err: any) {
      setSessionError(err.message)
    } finally {
      setSessionLoading(false)
    }
  }

  // ── Submit answer ──
  async function submitAnswer() {
    if (!sessionId || !currentQuestion) return

    const qtype = currentQuestion.question_type
    let user_answer: any

    if (qtype === 'traditional_mcq') {
      if (!selectedAnswer) return
      user_answer = { value: selectedAnswer }
    } else if (qtype === 'ngn_sata') {
      if (selectedAnswers.length === 0) return
      user_answer = { values: selectedAnswers }
    } else if (qtype === 'ngn_cloze') {
      if (Object.keys(selectedClozeAnswers).length === 0) return
      user_answer = { values: selectedClozeAnswers }
    } else if (qtype === 'ngn_matrix') {
      if (Object.keys(selectedMatrixAnswers).length === 0) return
      user_answer = { cells: Object.entries(selectedMatrixAnswers).map(([r, c]) => [r, c]) }
    } else {
      if (!selectedAnswer) return
      user_answer = { value: selectedAnswer }
    }

    setSubmitting(true)
    try {
      const data = await apiFetch(`/api/questions/session/${sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ question_id: currentQuestion.id, user_answer, time_spent: elapsed }),
      })

      if (data.is_correct) setCorrectCount(c => c + 1)

      // Track daily usage for free plan
      if (subscription?.plan === 'free') {
        try { await apiFetch('/api/questions/subscription/track-usage', { method: 'POST' }) } catch {}
        setSubscription(prev => prev ? {
          ...prev,
          questions_today: (prev.questions_today || 0) + 1,
          can_answer: (prev.questions_today || 0) + 1 < (prev.daily_limit || 25),
        } : prev)
      }

      if (immediateFeedback && mode === 'practice') {
        setFeedback({ is_correct: data.is_correct, correct_answer: data.correct_answer, rationale: data.rationale })
      } else {
        // Auto-advance
        advanceQuestion()
      }

      if (data.session_complete) {
        await loadResults()
      }
    } catch (err: any) {
      setSessionError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function loadResults() {
    if (!sessionId) return
    try {
      const data = await apiFetch(`/api/questions/session/${sessionId}/results`)
      setResults(data)
      setView('results')
      loadRecentSessions()
      loadSubscription()
    } catch {
      // Build local results
      setResults({ session: { correct_answers: correctCount + 1, total_questions: totalQuestions }, breakdown: {} })
      setView('results')
    }
  }

  function advanceQuestion() {
    const nextIndex = questionIndex + 1
    if (nextIndex >= totalQuestions) {
      loadResults()
    } else {
      setQuestionIndex(nextIndex)
      setSelectedAnswer(null)
      setSelectedAnswers([])
      setSelectedMatrixAnswers({})
      setSelectedClozeAnswers({})
      setFeedback(null)
    }
  }

  function resetHome() {
    setView('home')
    setSessionId(null)
    setQuestions([])
    setFeedback(null)
    setResults(null)
    setSessionError(null)
    setCorrectCount(0)
  }

  if (!user) {
    return (
      <NCLEXLayout subscription={subscription}>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Please sign in to access NCLEX Review.</p>
        </div>
      </NCLEXLayout>
    )
  }

  // ─── HOME ─────────────────────────────────────────────────────────────────
  if (view === 'home') {
    const plan = subscription?.plan || 'free'
    const questionsToday = subscription?.questions_today || 0
    const dailyLimit = subscription?.daily_limit ?? null
    const limitPct = dailyLimit ? Math.min(100, (questionsToday / dailyLimit) * 100) : 0
    const limitReached = dailyLimit !== null && questionsToday >= dailyLimit
    const remaining = dailyLimit !== null ? Math.max(0, dailyLimit - questionsToday) : null

    return (
      <NCLEXLayout subscription={subscription}>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NCLEX Review Platform</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Practice smarter. Pass your NCLEX.</p>
            </div>
            {plan === 'free' && (
              <Button onClick={() => setView('upgrade')} className="flex items-center gap-2 shrink-0" size="sm">
                <Crown className="h-4 w-4" />
                Upgrade Plan
              </Button>
            )}
          </div>

          {/* Subscription card */}
          <div className={`rounded-2xl p-5 border-2 ${
            plan === 'vip' ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-300 dark:border-amber-700' :
            plan === 'premium' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-300 dark:border-blue-700' :
            'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                  plan === 'vip' ? 'bg-amber-100 dark:bg-amber-900/50' :
                  plan === 'premium' ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  {plan === 'vip' ? <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" /> :
                   plan === 'premium' ? <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" /> :
                   <BookOpen className="h-6 w-6 text-gray-500" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white capitalize">
                    {plan === 'vip' ? 'VIP Plan' : plan === 'premium' ? 'Premium Plan' : 'Free Plan'}
                  </p>
                  {subscription?.expires_at ? (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Expires {new Date(subscription.expires_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  ) : plan === 'free' ? (
                    <p className="text-xs text-gray-500">25 questions/day · Forever free</p>
                  ) : null}
                </div>
              </div>

              {plan === 'free' && dailyLimit !== null ? (
                <div className="flex-1 max-w-xs">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Daily Questions</span>
                    <span className={limitReached ? 'text-red-500 font-semibold' : ''}>{questionsToday}/{dailyLimit}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${limitReached ? 'bg-red-400' : 'bg-primary-500'}`}
                      style={{ width: `${limitPct}%` }} />
                  </div>
                  {limitReached && <p className="text-xs text-red-500 mt-1">Limit reached. Upgrade or come back tomorrow.</p>}
                  {!limitReached && <p className="text-xs text-gray-400 mt-1">{remaining} questions remaining today</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <TrendingUp className="h-4 w-4" />
                  <span>Unlimited questions</span>
                </div>
              )}
            </div>
          </div>

          {/* Test Modes */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Choose Test Mode</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { m: 'practice' as const, title: 'Practice Test', icon: BookOpen, color: 'primary',
                  desc: 'Customizable practice with filters by content area, difficulty, and question type.',
                  features: ['Configure question count', 'Filter by content area', 'Immediate or end feedback'] },
                { m: 'readiness' as const, title: 'Readiness Assessment', icon: Target, color: 'green',
                  desc: 'Full 75-question NCLEX simulation across all content areas.',
                  features: ['75 questions', 'All content areas', 'NCLEX simulation'] },
                { m: 'cat' as const, title: 'CAT Mode', icon: Brain, color: 'purple',
                  desc: 'Computer Adaptive Testing that adjusts difficulty based on your performance.',
                  features: ['Adaptive difficulty', 'Starts at medium', 'Mirrors real NCLEX'] },
              ].map(({ m, title, icon: Icon, color, desc, features }) => {
                const locked = limitReached && plan === 'free'
                return (
                  <Card key={m}
                    className={`p-5 border-2 transition-all ${locked ? 'opacity-60' : 'hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md cursor-pointer'} border-gray-200 dark:border-gray-700`}
                    onClick={() => {
                      if (locked) { setView('upgrade'); return }
                      setMode(m)
                      if (m === 'practice') setView('config')
                      else startSession(m)
                    }}>
                    <div className={`h-11 w-11 rounded-xl mb-3 flex items-center justify-center ${
                      color === 'primary' ? 'bg-primary-100 dark:bg-primary-900/30' :
                      color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                      'bg-purple-100 dark:bg-purple-900/30'
                    }`}>
                      {locked ? <Lock className="h-5 w-5 text-gray-400" /> :
                        <Icon className={`h-5 w-5 ${
                          color === 'primary' ? 'text-primary-600 dark:text-primary-400' :
                          color === 'green' ? 'text-green-600 dark:text-green-400' :
                          'text-purple-600 dark:text-purple-400'
                        }`} />}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">{desc}</p>
                    <ul className="space-y-1">
                      {features.map(f => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                          <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Recent Sessions */}
          {recentSessions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Recent Sessions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {recentSessions.map((s: any) => {
                  const total = s.total_questions || 0
                  const correct = s.correct_answers || 0
                  const score = total > 0 ? Math.round((correct / total) * 100) : 0
                  return (
                    <Card key={s.id} className="p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 capitalize bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                          {s.session_type}
                        </span>
                        <span className={`text-sm font-bold ${score >= 75 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>{score}%</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{correct}/{total} correct</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(s.time_started || s.created_at).toLocaleDateString()}</p>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </NCLEXLayout>
    )
  }

  // ─── UPGRADE ──────────────────────────────────────────────────────────────
  if (view === 'upgrade') {
    return (
      <NCLEXLayout subscription={subscription}>
        <UpgradeView
          onBack={() => setView('home')}
          questionsToday={subscription?.questions_today || 0}
          dailyLimit={subscription?.daily_limit ?? null}
        />
      </NCLEXLayout>
    )
  }

  // ─── CONFIG ───────────────────────────────────────────────────────────────
  if (view === 'config') {
    const maxQ = subscription?.plan === 'free'
      ? Math.min(75, Math.max(5, (subscription.daily_limit || 25) - (subscription.questions_today || 0)))
      : 75

    return (
      <NCLEXLayout subscription={subscription}>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('home')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configure Practice Test</h2>
              <p className="text-sm text-gray-500">Set your test parameters</p>
            </div>
          </div>

          <Card className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content Area</label>
              <select value={contentArea} onChange={e => setContentArea(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {CONTENT_AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                <option value="all">All Levels</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Question Type</label>
              <select value={questionType} onChange={e => setQuestionType(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                <option value="all">All Types</option>
                {Object.entries(QUESTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Questions: <span className="text-primary-600 font-bold">{Math.min(questionCount, maxQ)}</span>
                {subscription?.plan === 'free' && <span className="text-xs text-gray-400 ml-2">({maxQ} remaining today)</span>}
              </label>
              <input type="range" min={5} max={maxQ} value={Math.min(questionCount, maxQ)}
                onChange={e => setQuestionCount(Number(e.target.value))}
                className="w-full accent-primary-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>5</span><span>{maxQ}</span></div>
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Immediate Feedback</p>
                <p className="text-xs text-gray-500">Show correct answer after each question</p>
              </div>
              <button onClick={() => setImmediateFeedback(!immediateFeedback)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${immediateFeedback ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${immediateFeedback ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </Card>

          {sessionError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
              {sessionError}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setView('home')} className="flex-1">Cancel</Button>
            <Button onClick={() => startSession()} loading={sessionLoading} className="flex-1 flex items-center justify-center gap-2">
              <Play className="h-4 w-4" />
              Start Test
            </Button>
          </div>
        </div>
      </NCLEXLayout>
    )
  }

  // ─── SESSION ──────────────────────────────────────────────────────────────
  if (view === 'session') {
    if (sessionLoading && questions.length === 0) {
      return (
        <NCLEXLayout subscription={subscription}>
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-500">Loading questions...</p>
            </div>
          </div>
        </NCLEXLayout>
      )
    }

    if (!currentQuestion) {
      return (
        <NCLEXLayout subscription={subscription}>
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{sessionError || 'No questions found for your selected criteria.'}</p>
            <Button onClick={resetHome}>Back to Home</Button>
          </div>
        </NCLEXLayout>
      )
    }

    const qtype = currentQuestion.question_type
    const hasAnswer =
      qtype === 'traditional_mcq' ? !!selectedAnswer :
      qtype === 'ngn_sata' ? selectedAnswers.length > 0 :
      qtype === 'ngn_matrix' ? Object.keys(selectedMatrixAnswers).length > 0 :
      Object.keys(selectedClozeAnswers).length > 0

    return (
      <NCLEXLayout subscription={subscription}>
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Question {questionIndex + 1} of {totalQuestions}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(elapsed)}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${totalQuestions > 0 ? (questionIndex / totalQuestions) * 100 : 0}%` }} />
            </div>
          </div>

          {/* Question */}
          <Card className="p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {QUESTION_TYPE_LABELS[qtype] || qtype}
                </span>
                <DifficultyBadge difficulty={currentQuestion.difficulty} />
                {currentQuestion.content_area && (
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                    {CONTENT_AREA_LABELS[currentQuestion.content_area] || currentQuestion.content_area}
                  </span>
                )}
              </div>
              <p className="text-base text-gray-900 dark:text-gray-100 leading-relaxed font-medium">
                {currentQuestion.question_text}
              </p>
            </div>

            {qtype === 'traditional_mcq' && (
              <TraditionalQuestion question={currentQuestion} selectedAnswer={selectedAnswer}
                onSelect={setSelectedAnswer} disabled={!!feedback} />
            )}
            {qtype === 'ngn_sata' && (
              <SATAQuestion question={currentQuestion} selectedAnswers={selectedAnswers}
                onToggle={id => setSelectedAnswers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                disabled={!!feedback} />
            )}
            {qtype === 'ngn_cloze' && (
              <ClozeQuestion question={currentQuestion} selectedAnswers={selectedClozeAnswers}
                onSelect={(bid, val) => setSelectedClozeAnswers(prev => ({ ...prev, [bid]: val }))}
                disabled={!!feedback} />
            )}
            {qtype === 'ngn_matrix' && (
              <MatrixQuestion question={currentQuestion} selectedAnswers={selectedMatrixAnswers}
                onSelect={(row, col) => setSelectedMatrixAnswers(prev => ({ ...prev, [row]: col }))}
                disabled={!!feedback} />
            )}

            {/* Feedback */}
            {feedback && immediateFeedback && mode === 'practice' && (
              <div className={`rounded-xl p-4 border ${feedback.is_correct ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {feedback.is_correct ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-500" />}
                  <span className={`font-semibold text-sm ${feedback.is_correct ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {feedback.is_correct ? 'Correct!' : 'Incorrect'}
                  </span>
                </div>
                {feedback.rationale && (
                  <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{feedback.rationale}</p>
                  </div>
                )}
              </div>
            )}

            {sessionError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {sessionError}
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <Button variant="ghost" size="sm" onClick={resetHome} className="text-gray-400 hover:text-gray-600">Exit</Button>
              {!feedback ? (
                <Button onClick={submitAnswer} loading={submitting} disabled={!hasAnswer} className="flex items-center gap-2">
                  Submit <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={advanceQuestion} className="flex items-center gap-2">
                  {questionIndex + 1 < totalQuestions ? 'Next Question' : 'View Results'}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        </div>
      </NCLEXLayout>
    )
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  if (view === 'results') {
    const session = results?.session || {}
    const total = session.total_questions || totalQuestions
    const correct = session.correct_answers || correctCount
    const score = total > 0 ? Math.round((correct / total) * 100) : 0
    const passed = score >= 75
    const breakdown = results?.breakdown?.by_content_area || {}

    return (
      <NCLEXLayout subscription={subscription}>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className={`p-8 text-center border-2 ${
            passed ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20' :
            score >= 60 ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20' :
            'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
          }`}>
            <div className={`inline-flex h-16 w-16 rounded-full items-center justify-center mb-4 ${
              passed ? 'bg-green-100 dark:bg-green-900/50' : score >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/50' : 'bg-red-100 dark:bg-red-900/50'
            }`}>
              {passed ? <Award className="h-8 w-8 text-green-600" /> : score >= 60 ? <Star className="h-8 w-8 text-yellow-600" /> : <AlertCircle className="h-8 w-8 text-red-500" />}
            </div>
            <h2 className="text-4xl font-black text-gray-900 dark:text-white">{score}%</h2>
            <p className={`text-lg font-semibold mt-1 ${passed ? 'text-green-700 dark:text-green-300' : score >= 60 ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-600 dark:text-red-400'}`}>
              {passed ? 'Excellent Work!' : score >= 60 ? 'Keep Practicing' : 'Needs Improvement'}
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{correct} correct out of {total} questions</p>
          </Card>

          {Object.keys(breakdown).length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary-500" />
                Performance by Content Area
              </h3>
              <div className="space-y-3">
                {Object.entries(breakdown).map(([area, d]: [string, any]) => {
                  const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0
                  return (
                    <div key={area}>
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>{CONTENT_AREA_LABELS[area] || area}</span>
                        <span className="font-medium">{d.correct}/{d.total} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-400'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={resetHome} className="flex-1 flex items-center justify-center gap-2">
              <RotateCcw className="h-4 w-4" /> Back to Home
            </Button>
            <Button onClick={() => { setMode('practice'); setView('config') }} className="flex-1 flex items-center justify-center gap-2">
              <Play className="h-4 w-4" /> Practice Again
            </Button>
          </div>
        </div>
      </NCLEXLayout>
    )
  }

  return (
    <NCLEXLayout subscription={subscription}>
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    </NCLEXLayout>
  )
}
