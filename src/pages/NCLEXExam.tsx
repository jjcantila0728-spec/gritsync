import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { NCLEXExamLayout } from '@/layouts/NCLEXLayout'
import {
  ChevronLeft, ChevronRight, Flag, AlignLeft, CheckCircle,
  XCircle, Lightbulb, AlertCircle, Clock, BarChart2,
  Award, Star, RotateCcw, BookOpen, Target, Brain,
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

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const cfg =
    difficulty === 'easy' ? { cls: 'bg-green-100 text-green-700', label: 'EASY' } :
    difficulty === 'medium' ? { cls: 'bg-yellow-100 text-yellow-700', label: 'MEDIUM' } :
    { cls: 'bg-red-100 text-red-700', label: 'HARD' }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${cfg.cls}`}>{cfg.label}</span>
}

// ── Case Study Scenario Banner ───────────────────────────────────────────────
function CaseStudyScenario({ scenario, group, questions, currentIndex }: {
  scenario: string
  group: string
  questions: any[]
  currentIndex: number
}) {
  const [expanded, setExpanded] = useState(true)
  const groupQuestions = questions.filter(q => q.case_study_group === group)
  const posInGroup = groupQuestions.findIndex(q => q.question_id === questions[currentIndex]?.question_id) + 1
  const totalInGroup = groupQuestions.length

  return (
    <div className="mb-5 rounded-xl border-2 border-[#17c3b2]/40 bg-[#17c3b2]/5 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[#17c3b2] flex-shrink-0" />
          <span className="text-xs font-bold text-[#17c3b2] uppercase tracking-wide">
            NGN Case Study — Question {posInGroup} of {totalInGroup}
          </span>
        </div>
        <span className="text-[10px] text-[#17c3b2] font-semibold">
          {expanded ? '▲ Hide Scenario' : '▼ Show Scenario'}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#17c3b2]/20">
          <p className="text-sm text-gray-800 leading-relaxed mt-3 whitespace-pre-line">{scenario}</p>
        </div>
      )}
    </div>
  )
}

// ── Question Type Components ─────────────────────────────────────────────────

function MCQQuestion({ options, selected, onSelect, disabled, feedback, correctAnswer }: {
  options: any[]; selected: string | null; onSelect: (id: string) => void
  disabled: boolean; feedback: any; correctAnswer: any
}) {
  return (
    <div className="space-y-2.5">
      {options.map((opt: any) => {
        const isSelected = selected === opt.id
        const isCorrect = correctAnswer?.value === opt.id
        const showResult = feedback !== null

        let cls = 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
        if (showResult) {
          if (isCorrect) cls = 'border-green-400 bg-green-50 text-green-900'
          else if (isSelected && !isCorrect) cls = 'border-red-400 bg-red-50 text-red-900'
          else cls = 'border-gray-200 bg-gray-50 text-gray-500'
        } else if (isSelected) {
          cls = 'border-[#17c3b2] bg-[#17c3b2]/5 text-gray-800'
        }

        return (
          <button
            key={opt.id}
            onClick={() => !disabled && onSelect(opt.id)}
            disabled={disabled}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${cls} ${disabled && !showResult ? 'cursor-default' : ''}`}
          >
            <div className="flex items-start gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5 ${
                showResult && isCorrect ? 'border-green-500 bg-green-500 text-white' :
                showResult && isSelected && !isCorrect ? 'border-red-500 bg-red-500 text-white' :
                isSelected ? 'border-[#17c3b2] bg-[#17c3b2] text-white' :
                'border-gray-300 text-gray-500'
              }`}>
                {showResult && isCorrect ? <CheckCircle className="h-3.5 w-3.5" /> :
                 showResult && isSelected && !isCorrect ? <XCircle className="h-3.5 w-3.5" /> :
                 opt.id.toUpperCase()}
              </span>
              <span className="text-sm leading-relaxed">{opt.text}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SATAQuestion({ options, selected, onToggle, disabled, feedback, correctAnswer }: {
  options: any[]; selected: string[]; onToggle: (id: string) => void
  disabled: boolean; feedback: any; correctAnswer: any
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-gray-500 italic mb-3">Select all that apply.</p>
      {options.map((opt: any) => {
        const isSelected = selected.includes(opt.id)
        const isCorrect = (correctAnswer?.values || []).includes(opt.id)
        const showResult = feedback !== null

        let cls = 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
        if (showResult) {
          if (isCorrect && isSelected) cls = 'border-green-400 bg-green-50 text-green-900'
          else if (isCorrect && !isSelected) cls = 'border-green-300 bg-green-50/50 text-green-800'
          else if (!isCorrect && isSelected) cls = 'border-red-400 bg-red-50 text-red-900'
          else cls = 'border-gray-200 bg-gray-50 text-gray-500'
        } else if (isSelected) {
          cls = 'border-[#17c3b2] bg-[#17c3b2]/5 text-gray-800'
        }

        return (
          <button
            key={opt.id}
            onClick={() => !disabled && onToggle(opt.id)}
            disabled={disabled}
            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${cls}`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                showResult && isCorrect && isSelected ? 'border-green-500 bg-green-500' :
                showResult && isCorrect && !isSelected ? 'border-green-400' :
                showResult && !isCorrect && isSelected ? 'border-red-500 bg-red-500' :
                isSelected ? 'border-[#17c3b2] bg-[#17c3b2]' : 'border-gray-300'
              }`}>
                {showResult && isCorrect && isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                {showResult && !isCorrect && isSelected && <XCircle className="h-3 w-3 text-white" />}
                {!showResult && isSelected && <CheckCircle className="h-3 w-3 text-white" />}
              </div>
              <span className="text-sm leading-relaxed">{opt.text}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ClozeQuestion({ options, selected, onSelect, disabled, feedback, correctAnswer }: {
  options: any; selected: Record<string, string>; onSelect: (blankId: string, value: string) => void
  disabled: boolean; feedback: any; correctAnswer: any
}) {
  const stem: string = options?.stem || ''
  const blanks: any[] = options?.blanks || []
  const parts = stem.split(/(\[\d+\])/)

  return (
    <div className="text-sm text-gray-800 leading-loose">
      {parts.map((part, i) => {
        const match = part.match(/\[(\d+)\]/)
        if (match) {
          const blankId = match[1]
          const blank = blanks.find((b: any) => String(b.id) === blankId)
          const isCorrect = feedback && correctAnswer?.values?.[blankId] === selected[blankId]
          return (
            <select
              key={i}
              value={selected[blankId] || ''}
              onChange={e => !disabled && onSelect(blankId, e.target.value)}
              disabled={disabled}
              className={`inline-block mx-1 border-b-2 px-2 py-0.5 rounded text-sm font-medium cursor-pointer ${
                feedback
                  ? isCorrect ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'
                  : 'border-[#17c3b2] bg-[#17c3b2]/5 text-[#17c3b2]'
              }`}
            >
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

function MatrixQuestion({ options, selected, onSelect, disabled, feedback, correctAnswer }: {
  options: any; selected: Record<string, string>; onSelect: (row: string, col: string) => void
  disabled: boolean; feedback: any; correctAnswer: any
}) {
  const rows: any[] = options?.rows || []
  const columns: any[] = options?.columns || []

  const correctMap: Record<string, string> = {}
  if (correctAnswer?.cells) {
    for (const [r, c] of correctAnswer.cells) {
      correctMap[String(r)] = String(c)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="p-3 border border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500 w-1/2" />
            {columns.map((col: any) => (
              <th key={col.id} className="p-3 border border-gray-200 bg-gray-50 text-center text-xs font-semibold text-gray-700">
                {col.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any) => {
            const rowId = String(row.id)
            const selectedCol = selected[rowId]
            const correctCol = correctMap[rowId]
            return (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-3 border border-gray-200 text-xs text-gray-700 font-medium leading-relaxed">
                  {row.text}
                </td>
                {columns.map((col: any) => {
                  const colId = String(col.id)
                  const isSelected = selectedCol === colId
                  const isCorrect = correctCol === colId
                  return (
                    <td key={col.id} className="p-3 border border-gray-200 text-center">
                      <input
                        type="radio"
                        name={`matrix-${rowId}`}
                        checked={isSelected}
                        onChange={() => !disabled && onSelect(rowId, colId)}
                        disabled={disabled}
                        className="accent-[#17c3b2] cursor-pointer w-4 h-4"
                      />
                      {feedback && isCorrect && (
                        <span className="ml-1 text-green-500 text-xs">✓</span>
                      )}
                      {feedback && isSelected && !isCorrect && (
                        <span className="ml-1 text-red-500 text-xs">✗</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Score Sheet (Results) ──────────────────────────────────────────────────────
function ScoreSheet({ session, questions, onClose, onReviewAll }: {
  session: any; questions: any[]; onClose: () => void; onReviewAll: () => void
}) {
  const total = session.total_questions || questions.length
  const correct = session.correct_answers || 0
  const score = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed = score >= 75

  const byArea: Record<string, { total: number; correct: number }> = {}
  const byDiff: Record<string, { total: number; correct: number }> = {}

  for (const q of questions) {
    if (q.answered_at) {
      const area = q.content_area || 'unknown'
      const diff = q.difficulty || 'unknown'
      if (!byArea[area]) byArea[area] = { total: 0, correct: 0 }
      if (!byDiff[diff]) byDiff[diff] = { total: 0, correct: 0 }
      byArea[area].total++
      byDiff[diff].total++
      if (q.is_correct) {
        byArea[area].correct++
        byDiff[diff].correct++
      }
    }
  }

  const AREA_LABELS: Record<string, string> = {
    safe_effective_care_environment: 'Safe & Effective Care',
    health_promotion_and_maintenance: 'Health Promotion',
    psychosocial_integrity: 'Psychosocial Integrity',
    physiological_integrity: 'Physiological Integrity',
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Score card */}
        <div className={`rounded-2xl p-8 text-center border-2 ${
          passed ? 'bg-green-50 border-green-300' : score >= 60 ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-200'
        }`}>
          <div className={`inline-flex h-16 w-16 rounded-full items-center justify-center mb-4 ${
            passed ? 'bg-green-100' : score >= 60 ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            {passed ? <Award className="h-8 w-8 text-green-600" /> : score >= 60 ? <Star className="h-8 w-8 text-yellow-600" /> : <Target className="h-8 w-8 text-red-500" />}
          </div>
          <h2 className="text-5xl font-black text-gray-900">{score}%</h2>
          <p className={`text-lg font-semibold mt-1 ${passed ? 'text-green-700' : score >= 60 ? 'text-yellow-700' : 'text-red-600'}`}>
            {passed ? 'Excellent Work!' : score >= 60 ? 'Keep Practicing' : 'Needs Improvement'}
          </p>
          <p className="text-gray-500 mt-2">{correct} correct out of {total} questions</p>
          {session.time_completed && session.time_started && (
            <p className="text-xs text-gray-400 mt-1">
              Time: {formatTime(Math.round((new Date(session.time_completed).getTime() - new Date(session.time_started).getTime()) / 1000))}
            </p>
          )}
        </div>

        {/* By content area */}
        {Object.keys(byArea).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm">
              <BarChart2 className="h-4 w-4 text-[#17c3b2]" /> Performance by Content Area
            </h3>
            <div className="space-y-3">
              {Object.entries(byArea).map(([area, d]) => {
                const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0
                return (
                  <div key={area}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{AREA_LABELS[area] || area}</span>
                      <span className="font-semibold">{d.correct}/{d.total} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* By difficulty */}
        {Object.keys(byDiff).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">Performance by Difficulty</h3>
            <div className="grid grid-cols-3 gap-3">
              {['easy', 'medium', 'hard'].map(diff => {
                const d = byDiff[diff]
                if (!d) return null
                const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0
                return (
                  <div key={diff} className="text-center bg-gray-50 rounded-xl p-3">
                    <DifficultyBadge difficulty={diff} />
                    <p className="text-2xl font-black text-gray-900 mt-2">{pct}%</p>
                    <p className="text-xs text-gray-500">{d.correct}/{d.total}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" /> Back to Q-Bank
          </button>
          <button
            onClick={onReviewAll}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#17c3b2] text-white text-sm font-semibold hover:bg-[#14a99a] transition-colors"
          >
            <BookOpen className="h-4 w-4" /> Review All Answers
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Exam Component ───────────────────────────────────────────────────────
export function NCLEXExam() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const isReviewMode = searchParams.get('review') === 'true'
  const initialTab = searchParams.get('tab') || 'exam'

  const [session, setSession] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Answer state
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const [selectedMatrix, setSelectedMatrix] = useState<Record<string, string>>({})
  const [selectedCloze, setSelectedCloze] = useState<Record<string, string>>({})

  // Feedback / submission
  const [feedback, setFeedback] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Timer
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // UI state
  const [showScore, setShowScore] = useState(initialTab === 'score')
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set())

  const currentQuestion = questions[qIndex] || null
  const sessionMode = session?.settings?.mode || 'tutorial'
  const isTutorial = sessionMode === 'tutorial'
  const sessionId = parseInt(id || '0')

  // Load session data
  const loadSession = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch(`/api/questions/session/${id}/questions`)
      setSession(data.session)
      setQuestions(data.questions || [])

      // Build pre-filled marks
      const marks = new Set<number>()
      for (const q of (data.questions || [])) {
        if (q.marked_for_review) marks.add(q.question_id)
      }
      setMarkedQuestions(marks)

      // In review mode, start at first question
      setQIndex(0)

      // If session already complete and not explicitly in review mode, show score
      if (data.session?.status === 'completed' && !isReviewMode) {
        setShowScore(true)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id, user, isReviewMode])

  useEffect(() => { loadSession() }, [loadSession])

  // Timer
  useEffect(() => {
    if (!isReviewMode && session?.status === 'in_progress' && !showScore) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isReviewMode, session?.status, showScore])

  // When question changes, load existing answer if in review mode
  useEffect(() => {
    const q = questions[qIndex]
    if (!q) return
    setFeedback(null)
    setSubmitError(null)

    if (isReviewMode && q.answered_at) {
      // Pre-fill with submitted answer and show feedback
      const userAnswer = q.user_answer
      if (q.question_type === 'traditional_mcq') {
        setSelectedAnswer(userAnswer?.value || null)
      } else if (q.question_type === 'ngn_sata') {
        setSelectedAnswers(userAnswer?.values || [])
      } else if (q.question_type === 'ngn_cloze') {
        setSelectedCloze(userAnswer?.values || {})
      } else if (q.question_type === 'ngn_matrix') {
        const matrixMap: Record<string, string> = {}
        for (const [r, c] of (userAnswer?.cells || [])) {
          matrixMap[String(r)] = String(c)
        }
        setSelectedMatrix(matrixMap)
      }
      setFeedback({ is_correct: q.is_correct, correct_answer: q.correct_answer })
    } else {
      setSelectedAnswer(null)
      setSelectedAnswers([])
      setSelectedMatrix({})
      setSelectedCloze({})
    }
  }, [qIndex, questions, isReviewMode])

  async function toggleMark() {
    if (!currentQuestion) return
    const qId = currentQuestion.question_id
    const newMarked = new Set(markedQuestions)
    if (newMarked.has(qId)) newMarked.delete(qId)
    else newMarked.add(qId)
    setMarkedQuestions(newMarked)

    try {
      await apiFetch(`/api/questions/session/${sessionId}/mark-review`, {
        method: 'POST',
        body: JSON.stringify({ question_id: qId, marked: newMarked.has(qId) }),
      })
    } catch {}
  }

  async function submitAnswer() {
    if (!currentQuestion || !session) return
    const qtype = currentQuestion.question_type
    let user_answer: any

    if (qtype === 'traditional_mcq') {
      if (!selectedAnswer) return
      user_answer = { value: selectedAnswer }
    } else if (qtype === 'ngn_sata') {
      if (selectedAnswers.length === 0) return
      user_answer = { values: selectedAnswers }
    } else if (qtype === 'ngn_cloze') {
      if (Object.keys(selectedCloze).length === 0) return
      user_answer = { values: selectedCloze }
    } else if (qtype === 'ngn_matrix') {
      if (Object.keys(selectedMatrix).length === 0) return
      user_answer = { cells: Object.entries(selectedMatrix).map(([r, c]) => [r, c]) }
    } else {
      if (!selectedAnswer) return
      user_answer = { value: selectedAnswer }
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const data = await apiFetch(`/api/questions/session/${sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ question_id: currentQuestion.question_id, user_answer, time_spent: elapsed }),
      })

      // Update local question with result (including correct_answer/rationale from answer response)
      setQuestions(prev => {
        const updated = prev.map((q, i) =>
          i === qIndex ? {
            ...q,
            is_correct: data.is_correct,
            user_answer,
            answered_at: new Date().toISOString(),
            correct_answer: data.correct_answer,
            rationale: data.rationale,
          } : q
        )
        // CAT: if backend swapped a question to be next, reorder local array to match
        if (data.next_question_id && session?.session_type === 'cat') {
          const nextIdx = updated.findIndex(q => q.question_id === data.next_question_id)
          const immediateNext = qIndex + 1
          if (nextIdx > immediateNext) {
            const reordered = [...updated]
            const [moved] = reordered.splice(nextIdx, 1)
            reordered.splice(immediateNext, 0, moved)
            return reordered
          }
        }
        return updated
      })

      if (isTutorial) {
        setFeedback({ is_correct: data.is_correct, correct_answer: data.correct_answer, ...data })
      } else {
        // Auto-advance in non-tutorial modes
        advanceQuestion()
      }

      if (data.session_complete) {
        // Reload session to get final stats
        setTimeout(async () => {
          await loadSession()
          setShowScore(true)
        }, isTutorial ? 0 : 500)
      }
    } catch (err: any) {
      if (err.message?.includes('Daily question limit') || err.message?.includes('daily_limit')) {
        setSubmitError('Daily question limit reached. Upgrade your plan to continue.')
      } else {
        setSubmitError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function advanceQuestion() {
    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1)
    } else {
      setShowScore(true)
    }
  }

  async function endSession() {
    try {
      await apiFetch(`/api/questions/session/${sessionId}/end`, { method: 'POST' })
    } catch {}
    await loadSession()
    setShowScore(true)
  }

  const hasAnswer = (() => {
    if (!currentQuestion) return false
    const qt = currentQuestion.question_type
    if (qt === 'traditional_mcq') return !!selectedAnswer
    if (qt === 'ngn_sata') return selectedAnswers.length > 0
    if (qt === 'ngn_cloze') {
      const blanks = currentQuestion.options?.blanks || []
      return blanks.length > 0 && blanks.every((b: any) => selectedCloze[String(b.id)])
    }
    if (qt === 'ngn_matrix') {
      const rows = currentQuestion.options?.rows || []
      return rows.length > 0 && rows.every((r: any) => selectedMatrix[String(r.id)])
    }
    return false
  })()

  const isMarked = currentQuestion ? markedQuestions.has(currentQuestion.question_id) : false
  const answeredCount = questions.filter(q => q.answered_at).length

  if (loading) {
    return (
      <NCLEXExamLayout>
        <div className="flex items-center justify-center h-full text-gray-500">Loading exam...</div>
      </NCLEXExamLayout>
    )
  }

  if (error) {
    return (
      <NCLEXExamLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-sm">{error}</p>
          <button onClick={() => navigate('/nclex-review')} className="px-4 py-2 rounded-lg bg-[#17c3b2] text-white text-sm font-semibold">
            Back to Q-Bank
          </button>
        </div>
      </NCLEXExamLayout>
    )
  }

  // Show score sheet
  if (showScore && !isReviewMode) {
    return (
      <NCLEXExamLayout
        sessionId={sessionId}
        mode={sessionMode}
        onClose={() => navigate('/nclex-review')}
      >
        <ScoreSheet
          session={session}
          questions={questions}
          onClose={() => navigate('/nclex-review')}
          onReviewAll={() => { setShowScore(false); setQIndex(0) }}
        />
      </NCLEXExamLayout>
    )
  }

  if (!currentQuestion) {
    return (
      <NCLEXExamLayout onClose={() => navigate('/nclex-review')}>
        <div className="flex items-center justify-center h-full text-gray-500">No questions found.</div>
      </NCLEXExamLayout>
    )
  }

  const qtype = currentQuestion.question_type
  const qOptions = Array.isArray(currentQuestion.options) ? currentQuestion.options : currentQuestion.options
  const isDisabled = !!feedback || isReviewMode
  const showExplanation = feedback || isReviewMode

  return (
    <NCLEXExamLayout
      sessionId={sessionId}
      questionNumber={qIndex + 1}
      totalQuestions={questions.length}
      mode={sessionMode}
      onClose={() => navigate('/nclex-review')}
    >
      <div className="flex h-full overflow-hidden">
        {/* ── Left Panel: Question ── */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 overflow-hidden">
          {/* Question toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-white flex-shrink-0">
            <button
              onClick={toggleMark}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                isMarked ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              {isMarked ? 'Marked' : 'Mark for Later'}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(elapsed)}
            </div>
          </div>

          {/* Question body */}
          <div className="flex-1 overflow-y-auto p-5 lg:p-7 bg-white">
            {/* QID + type badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400 font-mono">QID: {currentQuestion.question_id}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium capitalize">
                {qtype === 'traditional_mcq' ? 'MCQ' : qtype === 'ngn_sata' ? 'SATA' : qtype === 'ngn_cloze' ? 'Cloze' : 'Matrix'}
              </span>
              <DifficultyBadge difficulty={currentQuestion.difficulty} />
              {currentQuestion.is_ngn && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">NGN</span>
              )}
            </div>

            {/* Subcategory tab */}
            {currentQuestion.subcategory && (
              <div className="flex border-b border-gray-200 mb-4 text-xs gap-0">
                <div className="px-4 py-2 border-b-2 border-gray-900 font-semibold text-gray-900">
                  {currentQuestion.subcategory}
                </div>
              </div>
            )}

            {/* NGN Case Study Scenario Block */}
            {currentQuestion.case_study_group && currentQuestion.case_study_scenario && (
              <CaseStudyScenario
                scenario={currentQuestion.case_study_scenario}
                group={currentQuestion.case_study_group}
                questions={questions}
                currentIndex={qIndex}
              />
            )}

            {/* Question text */}
            <div className="mb-5">
              <p className="text-gray-900 leading-relaxed text-sm font-medium">{currentQuestion.question_text}</p>
            </div>

            {/* Score tracker for SATA */}
            {qtype === 'ngn_sata' && feedback && (
              <div className="mb-4 flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border-2 border-gray-400 flex items-center justify-center">
                    <CheckCircle className="h-3 w-3 text-gray-400" />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">
                    {selectedAnswers.filter(a => (currentQuestion.correct_answer?.values || []).includes(a)).length}/
                    {(currentQuestion.correct_answer?.values || []).length} Your Score/Max
                  </span>
                </div>
                <span className="text-xs text-gray-500">+/- Scoring Rule</span>
              </div>
            )}

            {/* Answer options */}
            {qtype === 'traditional_mcq' && (
              <MCQQuestion
                options={Array.isArray(qOptions) ? qOptions : []}
                selected={selectedAnswer}
                onSelect={setSelectedAnswer}
                disabled={isDisabled}
                feedback={feedback}
                correctAnswer={currentQuestion.correct_answer}
              />
            )}
            {qtype === 'ngn_sata' && (
              <SATAQuestion
                options={Array.isArray(qOptions) ? qOptions : []}
                selected={selectedAnswers}
                onToggle={id => setSelectedAnswers(prev =>
                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                )}
                disabled={isDisabled}
                feedback={feedback}
                correctAnswer={currentQuestion.correct_answer}
              />
            )}
            {qtype === 'ngn_cloze' && (
              <ClozeQuestion
                options={currentQuestion.options}
                selected={selectedCloze}
                onSelect={(blank, val) => setSelectedCloze(prev => ({ ...prev, [blank]: val }))}
                disabled={isDisabled}
                feedback={feedback}
                correctAnswer={currentQuestion.correct_answer}
              />
            )}
            {qtype === 'ngn_matrix' && (
              <MatrixQuestion
                options={currentQuestion.options}
                selected={selectedMatrix}
                onSelect={(row, col) => setSelectedMatrix(prev => ({ ...prev, [row]: col }))}
                disabled={isDisabled}
                feedback={feedback}
                correctAnswer={currentQuestion.correct_answer}
              />
            )}

            {submitError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {submitError}
              </div>
            )}

            {/* Stats section (after answer) */}
            {showExplanation && (
              <div className="mt-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Statistics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  {feedback?.difficulty && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Difficulty level –</span>
                      <DifficultyBadge difficulty={feedback.difficulty} />
                    </div>
                  )}
                  {feedback?.content_area && (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <span>Subject</span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium capitalize">
                        {feedback.content_area.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                    </div>
                  )}
                  {feedback?.subcategory && (
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <span>Lesson</span>
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">{feedback.subcategory}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit/Confirmation notice for non-tutorial modes */}
          {!isTutorial && !isReviewMode && !feedback && (
            <div className="bg-amber-50 border-t border-amber-200 px-5 py-2 flex-shrink-0">
              <p className="text-xs text-amber-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {sessionMode === 'timed' ? 'Timed mode – explanations shown after completion.' : 'CAT mode – difficulty adapts to your performance.'}
              </p>
            </div>
          )}
        </div>

        {/* ── Right Panel: Explanation ── */}
        <div className="w-0 lg:w-[45%] xl:w-[42%] flex-shrink-0 flex flex-col overflow-hidden bg-white">
          {showExplanation && currentQuestion.rationale ? (
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">Explanation</h3>
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed text-sm whitespace-pre-line">
                {currentQuestion.rationale}
              </div>

              {currentQuestion.tags && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Key Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentQuestion.tags.split(',').map((tag: string) => (
                      <span key={tag} className="text-xs bg-[#17c3b2]/10 text-[#17c3b2] px-2 py-0.5 rounded-full font-medium">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              {isTutorial && !feedback ? (
                <>
                  <Lightbulb className="h-10 w-10 opacity-30 mb-3" />
                  <p className="text-sm">Submit your answer to see the explanation.</p>
                </>
              ) : (
                <>
                  <BookOpen className="h-10 w-10 opacity-30 mb-3" />
                  <p className="text-sm">Explanation will appear here.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Navigation Bar ── */}
      <div className="bg-[#0d2137] text-white h-12 flex items-center px-4 gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/nclex-review')}
          className="flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
        >
          ✕ Close
        </button>

        {/* Progress dots */}
        <div className="flex-1 flex items-center justify-center gap-1 overflow-hidden">
          {questions.slice(0, 20).map((q, i) => (
            <button
              key={i}
              onClick={() => setQIndex(i)}
              className={`flex-shrink-0 h-2.5 w-2.5 rounded-full transition-all ${
                i === qIndex ? 'bg-[#17c3b2] ring-2 ring-[#17c3b2]/30' :
                q.answered_at ? (q.is_correct ? 'bg-green-400' : 'bg-red-400') :
                markedQuestions.has(q.question_id) ? 'bg-amber-400' :
                'bg-white/20'
              }`}
              title={`Question ${i + 1}`}
            />
          ))}
          {questions.length > 20 && (
            <span className="text-xs text-white/40 ml-1">+{questions.length - 20} more</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isReviewMode && session?.status === 'in_progress' && answeredCount > 0 && !feedback && (
            <button
              onClick={endSession}
              className="text-xs text-white/50 hover:text-white px-2 py-1 rounded transition-colors"
            >
              End Test
            </button>
          )}

          <button
            onClick={() => setQIndex(Math.max(0, qIndex - 1))}
            disabled={qIndex === 0}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>

          {!isReviewMode && !feedback && !isDisabled ? (
            <button
              onClick={submitAnswer}
              disabled={!hasAnswer || submitting}
              className="flex items-center gap-1 text-xs font-bold px-4 py-1.5 rounded-lg bg-[#17c3b2] hover:bg-[#14a99a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          ) : (
            <button
              onClick={advanceQuestion}
              disabled={qIndex + 1 >= questions.length && !feedback}
              className="flex items-center gap-1 text-xs font-bold px-4 py-1.5 rounded-lg bg-[#17c3b2] hover:bg-[#14a99a] disabled:opacity-40 transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </NCLEXExamLayout>
  )
}
