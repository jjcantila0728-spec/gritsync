import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Footer } from '@/components/Footer'
import {
  BookOpen, Play, Brain, Target, Clock,
  CheckCircle, XCircle, AlertCircle, RotateCcw, BarChart2,
  ChevronRight, ChevronLeft, Award, Lightbulb,
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

type ViewState = 'home' | 'config' | 'session' | 'results'
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

interface AnswerResult {
  is_correct: boolean
  correct_answer: any
  rationale?: string
  session_complete: boolean
  questions_answered: number
  correct_answers: number
  cat_next_difficulty?: string
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
        <button
          key={opt.id}
          onClick={() => !disabled && onSelect(opt.id)}
          disabled={disabled}
          className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
            selectedAnswer === opt.id
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
        >
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
          <button
            key={opt.id}
            onClick={() => !disabled && onToggle(opt.id)}
            disabled={disabled}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
              checked ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
          >
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

function MatrixQuestion({ question, selectedCells, onToggle, disabled }: {
  question: Question; selectedCells: number[][]; onToggle: (row: number, col: number) => void; disabled: boolean
}) {
  const rows: string[] = question.options?.rows || []
  const columns: string[] = question.options?.columns || []
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 bg-gray-50 dark:bg-gray-800"></th>
            {columns.map((col: string, ci: number) => (
              <th key={ci} className="border border-gray-200 dark:border-gray-700 px-4 py-2 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-center">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: string, ri: number) => (
            <tr key={ri}>
              <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800">{row}</td>
              {columns.map((_: string, ci: number) => {
                const sel = selectedCells.some(c => c[0] === ri && c[1] === ci)
                return (
                  <td key={ci} onClick={() => !disabled && onToggle(ri, ci)}
                    className={`border border-gray-200 dark:border-gray-700 px-4 py-3 text-center ${disabled ? 'cursor-default' : 'cursor-pointer'} ${sel ? 'bg-primary-100 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    {sel && <CheckCircle className="h-4 w-4 text-primary-600 mx-auto" />}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FeedbackPanel({ result }: { result: AnswerResult }) {
  return (
    <div className={`mt-4 rounded-xl p-4 border-2 ${result.is_correct ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-red-400 bg-red-50 dark:bg-red-900/20'}`}>
      <div className="flex items-center gap-2 mb-2">
        {result.is_correct ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
        <span className={`font-semibold ${result.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
          {result.is_correct ? 'Correct!' : 'Incorrect'}
        </span>
        {!result.is_correct && result.correct_answer?.value && (
          <span className="text-sm text-gray-600 dark:text-gray-400">Correct: {result.correct_answer.value}</span>
        )}
      </div>
      {result.rationale && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <span className="font-medium">Rationale: </span>{result.rationale}
        </p>
      )}
    </div>
  )
}

export function NCLEXReview() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState<ViewState>('home')
  const [sessionMode, setSessionMode] = useState<SessionMode>('practice')
  const [stats, setStats] = useState<any>(null)
  const [mySessions, setMySessions] = useState<any[]>([])
  const [loadingHome, setLoadingHome] = useState(true)

  const [config, setConfig] = useState({
    content_area: 'all',
    difficulty: 'all',
    question_type: 'all',
    question_count: 25,
    immediate_feedback: true,
  })

  const [sessionId, setSessionId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [startingSession, setStartingSession] = useState(false)
  const [startingMode, setStartingMode] = useState<SessionMode | null>(null)

  const [traditionalAnswer, setTraditionalAnswer] = useState<string | null>(null)
  const [sataAnswers, setSataAnswers] = useState<string[]>([])
  const [clozeAnswers, setClozeAnswers] = useState<Record<string, string>>({})
  const [matrixCells, setMatrixCells] = useState<number[][]>([])

  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())

  const [sessionResults, setSessionResults] = useState<any>(null)
  const [loadingResults, setLoadingResults] = useState(false)

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (user) loadHomeData()
    else setLoadingHome(false)
  }, [user])

  useEffect(() => {
    if (view === 'session' && sessionStartTime) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000))
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [view, sessionStartTime])

  async function loadHomeData() {
    setLoadingHome(true)
    try {
      const [s, sessions] = await Promise.all([
        apiFetch('/api/questions/stats'),
        apiFetch('/api/questions/my-sessions'),
      ])
      setStats(s)
      setMySessions(sessions)
    } catch {}
    setLoadingHome(false)
  }

  function resetAnswerState() {
    setTraditionalAnswer(null)
    setSataAnswers([])
    setClozeAnswers({})
    setMatrixCells([])
    setAnswerResult(null)
    setSubmitted(false)
    setQuestionStartTime(Date.now())
  }

  async function startSession(mode?: SessionMode) {
    const activeMode = mode || sessionMode
    setStartingSession(true)
    setStartingMode(activeMode)
    try {
      const payload: any = { session_type: activeMode }
      if (activeMode === 'practice') {
        payload.content_area = config.content_area
        payload.difficulty = config.difficulty
        payload.question_type = config.question_type
        payload.question_count = config.question_count
      }
      if (activeMode === 'readiness') {
        payload.content_area = 'all'
        payload.question_count = 75
      }
      if (activeMode === 'cat') {
        payload.question_count = 85
      }

      const data = await apiFetch('/api/questions/session/start', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setSessionId(data.session_id)
      setQuestions(data.questions)
      setCurrentIdx(0)
      setElapsedSeconds(0)
      setSessionStartTime(Date.now())
      setSessionMode(activeMode)
      resetAnswerState()
      setView('session')
    } catch (e: any) {
      alert(e.message || 'Could not start session. Make sure there are questions in the question bank.')
    } finally {
      setStartingSession(false)
      setStartingMode(null)
    }
  }

  async function submitAnswer() {
    if (!sessionId) return
    const q = questions[currentIdx]

    let userAnswer: any = null
    if (q.question_type === 'traditional_mcq') {
      if (!traditionalAnswer) return
      userAnswer = { value: traditionalAnswer }
    } else if (q.question_type === 'ngn_sata') {
      if (sataAnswers.length === 0) return
      userAnswer = { values: sataAnswers }
    } else if (q.question_type === 'ngn_cloze') {
      const blanks = q.options?.blanks || []
      if (blanks.some((b: any) => !clozeAnswers[String(b.id)])) return
      userAnswer = { values: clozeAnswers }
    } else if (q.question_type === 'ngn_matrix') {
      userAnswer = { cells: matrixCells }
    }

    setSubmitting(true)
    try {
      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000)
      const result = await apiFetch(`/api/questions/session/${sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ question_id: q.id, user_answer: userAnswer, time_spent: timeSpent }),
      })
      setAnswerResult(result)
      setSubmitted(true)
      if (result.session_complete) {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    } catch (e: any) {
      alert(e.message || 'Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  async function loadResults() {
    if (!sessionId) return
    setLoadingResults(true)
    try {
      const data = await apiFetch(`/api/questions/session/${sessionId}/results`)
      setSessionResults(data)
      setView('results')
    } catch (e: any) {
      alert(e.message || 'Failed to load results')
    } finally {
      setLoadingResults(false)
    }
  }

  function goNextQuestion() {
    if (!answerResult) return
    if (answerResult.session_complete) {
      loadResults()
      return
    }
    setCurrentIdx(i => i + 1)
    resetAnswerState()
  }

  function goHome() {
    if (timerRef.current) clearInterval(timerRef.current)
    setView('home')
    setSessionId(null)
    setQuestions([])
    setSessionResults(null)
    resetAnswerState()
    loadHomeData()
  }

  const canSubmit = useCallback(() => {
    const q = questions[currentIdx]
    if (!q) return false
    if (q.question_type === 'traditional_mcq') return traditionalAnswer !== null
    if (q.question_type === 'ngn_sata') return sataAnswers.length > 0
    if (q.question_type === 'ngn_cloze') {
      const blanks = q.options?.blanks || []
      return blanks.every((b: any) => clozeAnswers[String(b.id)])
    }
    if (q.question_type === 'ngn_matrix') return matrixCells.length > 0
    return false
  }, [questions, currentIdx, traditionalAnswer, sataAnswers, clozeAnswers, matrixCells])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <BookOpen className="h-16 w-16 text-primary-600 mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">NCLEX Question Bank</h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
            Practice with traditional and NGN-style questions. Choose from Readiness Assessment, CAT, or Custom Practice Test modes.
          </p>
          <Button onClick={() => navigate('/login')}>Sign In to Start Practicing</Button>
        </div>
        <Footer />
      </div>
    )
  }

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 space-y-6">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NCLEX Question Bank</h1>
            </div>

            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">{stats.total}</div>
                  <div className="text-sm text-gray-500">Questions Available</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">
                    {stats.by_type?.find((t: any) => t.question_type === 'traditional_mcq')?.count || 0}
                  </div>
                  <div className="text-sm text-gray-500">Traditional MCQ</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.by_type?.filter((t: any) => t.question_type !== 'traditional_mcq')
                      .reduce((sum: number, t: any) => sum + parseInt(t.count), 0) || 0}
                  </div>
                  <div className="text-sm text-gray-500">NGN Questions</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {mySessions.filter(s => s.status === 'completed').length}
                  </div>
                  <div className="text-sm text-gray-500">Sessions Completed</div>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 cursor-pointer hover:border-primary-400 hover:shadow-md transition-all border-2 border-transparent"
                onClick={() => { setSessionMode('practice'); setView('config') }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Play className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Practice Test</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Customize your session. Choose content area, difficulty, question type, and count. Optional immediate feedback.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">Custom Filters</span>
                  <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">Immediate Feedback</span>
                  <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">5–75 Questions</span>
                </div>
                <div className="flex items-center justify-end text-primary-600">
                  <span className="text-sm font-medium">Configure</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Card>

              <Card className="p-6 cursor-pointer hover:border-primary-400 hover:shadow-md transition-all border-2 border-transparent"
                onClick={() => startSession('readiness')}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Target className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Readiness Assessment</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  75-question exam simulating the NCLEX minimum. Mixed content areas, results shown at the end.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">75 Questions</span>
                  <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">All Content Areas</span>
                  <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">NCLEX Simulation</span>
                </div>
                <div className="flex items-center justify-end text-primary-600">
                  {startingSession && startingMode === 'readiness'
                    ? <span className="text-sm text-gray-400">Starting...</span>
                    : <><span className="text-sm font-medium">Start Now</span><ChevronRight className="h-4 w-4 ml-1" /></>}
                </div>
              </Card>

              <Card className="p-6 cursor-pointer hover:border-primary-400 hover:shadow-md transition-all border-2 border-transparent"
                onClick={() => startSession('cat')}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Brain className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">CAT Mode</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Computerized Adaptive Test. Starts at medium difficulty and adjusts based on your performance.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">85+ Questions</span>
                  <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">Adaptive Difficulty</span>
                  <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">Real NCLEX Style</span>
                </div>
                <div className="flex items-center justify-end text-primary-600">
                  {startingSession && startingMode === 'cat'
                    ? <span className="text-sm text-gray-400">Starting...</span>
                    : <><span className="text-sm font-medium">Start Now</span><ChevronRight className="h-4 w-4 ml-1" /></>}
                </div>
              </Card>
            </div>

            {mySessions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Recent Sessions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mySessions.slice(0, 4).map(s => (
                    <Card key={s.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-xs font-semibold uppercase tracking-wide ${
                            s.session_type === 'practice' ? 'text-blue-600' :
                            s.session_type === 'readiness' ? 'text-green-600' : 'text-purple-600'
                          }`}>
                            {s.session_type === 'practice' ? 'Practice Test' :
                              s.session_type === 'readiness' ? 'Readiness Assessment' : 'CAT Mode'}
                          </span>
                          <p className="text-sm text-gray-500 mt-0.5">{new Date(s.time_started).toLocaleDateString()}</p>
                        </div>
                        {s.status === 'completed' ? (
                          <div className="text-right">
                            <div className={`text-xl font-bold ${(s.score || 0) >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                              {s.score ? `${Math.round(s.score)}%` : 'N/A'}
                            </div>
                            <p className="text-xs text-gray-500">{s.correct_answers}/{s.total_questions} correct</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">In Progress</span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {stats?.total === 0 && (
              <Card className="p-8 text-center border-dashed border-2 border-gray-300 dark:border-gray-700">
                <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Questions Yet</h3>
                <p className="text-sm text-gray-500">Admins can add questions from the Question Bank management page.</p>
              </Card>
            )}
          </main>
        </div>
      </div>
    )
  }

  if (view === 'config') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="max-w-2xl mx-auto">
              <button onClick={() => setView('home')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6">
                <ChevronLeft className="h-4 w-4" />Back to Question Bank
              </button>
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Play className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configure Practice Test</h2>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Content Area</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CONTENT_AREAS.map(ca => (
                        <button key={ca.value} onClick={() => setConfig(c => ({ ...c, content_area: ca.value }))}
                          className={`px-3 py-2 rounded-lg text-sm border-2 text-left transition-all ${
                            config.content_area === ca.value
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-300'
                          }`}>{ca.label}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Difficulty</label>
                    <div className="flex gap-2">
                      {[{value:'all',label:'All'},{value:'easy',label:'Easy'},{value:'medium',label:'Medium'},{value:'hard',label:'Hard'}].map(d => (
                        <button key={d.value} onClick={() => setConfig(c => ({ ...c, difficulty: d.value }))}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm border-2 transition-all ${
                            config.difficulty === d.value
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-300'
                          }`}>{d.label}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Question Type</label>
                    <div className="flex gap-2 flex-wrap">
                      {[{value:'all',label:'All Types'},{value:'traditional_mcq',label:'Traditional MCQ'},{value:'ngn_sata',label:'NGN – SATA'},{value:'ngn_cloze',label:'NGN – Cloze'}].map(t => (
                        <button key={t.value} onClick={() => setConfig(c => ({ ...c, question_type: t.value }))}
                          className={`px-3 py-2 rounded-lg text-sm border-2 transition-all ${
                            config.question_type === t.value
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-300'
                          }`}>{t.label}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Number of Questions: <span className="text-primary-600">{config.question_count}</span>
                    </label>
                    <input type="range" min={5} max={75} step={5} value={config.question_count}
                      onChange={e => setConfig(c => ({ ...c, question_count: parseInt(e.target.value) }))}
                      className="w-full accent-primary-600" />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>5</span><span>25</span><span>50</span><span>75</span>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div onClick={() => setConfig(c => ({ ...c, immediate_feedback: !c.immediate_feedback }))}
                        className={`w-10 h-6 rounded-full transition-colors ${config.immediate_feedback ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`w-5 h-5 rounded-full bg-white shadow m-0.5 transition-transform ${config.immediate_feedback ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Immediate feedback after each question</span>
                    </label>
                  </div>

                  <Button onClick={() => startSession('practice')} disabled={startingSession} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    {startingSession ? 'Starting...' : 'Begin Practice Test'}
                  </Button>
                </div>
              </Card>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (view === 'session') {
    const q = questions[currentIdx]
    const progress = ((currentIdx + (submitted ? 1 : 0)) / questions.length) * 100

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                    Question {currentIdx + 1} of {questions.length}
                  </span>
                  {q && <DifficultyBadge difficulty={q.difficulty} />}
                  {q?.is_ngn && (
                    <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium">NGN</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(elapsedSeconds)}</span>
                </div>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-6">
                <div className="bg-primary-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>

              {q && (
                <Card className="p-6">
                  <p className="text-xs text-gray-400 mb-2">
                    {CONTENT_AREA_LABELS[q.content_area] || q.content_area}
                    {' · '}
                    {QUESTION_TYPE_LABELS[q.question_type] || q.question_type}
                  </p>
                  <p className="text-gray-900 dark:text-white font-medium leading-relaxed mb-6 text-base">
                    {q.question_text}
                  </p>

                  {q.question_type === 'traditional_mcq' && (
                    <TraditionalQuestion question={q} selectedAnswer={traditionalAnswer} onSelect={setTraditionalAnswer} disabled={submitted} />
                  )}
                  {q.question_type === 'ngn_sata' && (
                    <SATAQuestion question={q} selectedAnswers={sataAnswers}
                      onToggle={id => setSataAnswers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                      disabled={submitted} />
                  )}
                  {q.question_type === 'ngn_cloze' && (
                    <ClozeQuestion question={q} selectedAnswers={clozeAnswers}
                      onSelect={(blankId, value) => setClozeAnswers(prev => ({ ...prev, [blankId]: value }))}
                      disabled={submitted} />
                  )}
                  {q.question_type === 'ngn_matrix' && (
                    <MatrixQuestion question={q} selectedCells={matrixCells}
                      onToggle={(row, col) => {
                        const exists = matrixCells.some(c => c[0] === row && c[1] === col)
                        setMatrixCells(prev => exists ? prev.filter(c => !(c[0] === row && c[1] === col)) : [...prev, [row, col]])
                      }}
                      disabled={submitted} />
                  )}

                  {submitted && answerResult && (config.immediate_feedback || sessionMode !== 'practice') && (
                    <FeedbackPanel result={answerResult} />
                  )}

                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                    {!submitted ? (
                      <Button onClick={submitAnswer} disabled={!canSubmit() || submitting} className="ml-auto">
                        {submitting ? 'Submitting...' : 'Submit Answer'}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <div className="flex items-center gap-3 ml-auto">
                        {loadingResults && <span className="text-sm text-gray-400">Loading results...</span>}
                        <Button onClick={goNextQuestion} disabled={loadingResults}>
                          {answerResult?.session_complete ? 'View Results' : 'Next Question'}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (view === 'results' && sessionResults) {
    const session = sessionResults.session
    const score = session.score ? Math.round(session.score) : 0
    const passed = score >= 70

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-3">
                <BarChart2 className="h-6 w-6 text-primary-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Session Results</h1>
              </div>

              <Card className={`p-8 text-center border-2 ${passed ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-red-400 bg-red-50 dark:bg-red-900/20'}`}>
                <div className={`text-6xl font-bold mb-2 ${passed ? 'text-green-600' : 'text-red-600'}`}>{score}%</div>
                <div className="flex items-center justify-center gap-2 mb-3">
                  {passed ? <Award className="h-6 w-6 text-green-600" /> : <AlertCircle className="h-6 w-6 text-red-600" />}
                  <span className={`text-lg font-semibold ${passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {passed ? 'Passing Score!' : 'Needs Improvement'}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {session.correct_answers} correct out of {session.total_questions} questions
                </p>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-5">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">By Content Area</h3>
                  <div className="space-y-3">
                    {Object.entries(sessionResults.breakdown.by_content_area).map(([area, data]: [string, any]) => {
                      const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
                      return (
                        <div key={area}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">{CONTENT_AREA_LABELS[area] || area}</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{pct}% ({data.correct}/{data.total})</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${pct >= 70 ? 'bg-green-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    {Object.keys(sessionResults.breakdown.by_content_area).length === 0 && (
                      <p className="text-sm text-gray-400">No breakdown available</p>
                    )}
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">By Difficulty</h3>
                  <div className="space-y-3">
                    {Object.entries(sessionResults.breakdown.by_difficulty).map(([diff, data]: [string, any]) => {
                      const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
                      return (
                        <div key={diff}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize text-gray-600 dark:text-gray-400">{diff}</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{pct}% ({data.correct}/{data.total})</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${pct >= 70 ? 'bg-green-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    {Object.keys(sessionResults.breakdown.by_difficulty).length === 0 && (
                      <p className="text-sm text-gray-400">No breakdown available</p>
                    )}
                  </div>
                </Card>
              </div>

              {sessionResults.responses?.some((r: any) => !r.is_correct) && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">Questions to Review</h3>
                  </div>
                  <div className="space-y-4">
                    {sessionResults.responses.filter((r: any) => !r.is_correct).slice(0, 10).map((r: any, i: number) => (
                      <div key={i} className="border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">{r.question_text}</p>
                        {r.rationale && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-semibold">Rationale: </span>{r.rationale}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="flex gap-4">
                <Button onClick={goHome} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />Back to Question Bank
                </Button>
                <Button variant="outline" onClick={() => { setSessionMode('practice'); setView('config') }} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />New Practice Test
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return null
}
