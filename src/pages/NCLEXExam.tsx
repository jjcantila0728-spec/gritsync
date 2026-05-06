import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { NCLEXExamLayout } from '@/layouts/NCLEXLayout'
import {
  ChevronLeft, ChevronRight, AlertCircle, Clock,
  BarChart2, Award, Star, RotateCcw, BookOpen, Target,
  CheckCircle, XCircle, Lightbulb, Brain,
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

// ── Score tracker row (Archer Review style) ──────────────────────────────────
function ScoreTracker({ correct, total, scoringType }: { correct: number; total: number; scoringType?: string }) {
  return (
    <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 mb-4">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded border-2 border-gray-400 flex items-center justify-center flex-shrink-0">
          <CheckCircle className="h-3 w-3 text-gray-400" />
        </div>
        <span className="text-xs font-semibold text-gray-700">{correct}/{total}</span>
        <span className="text-xs text-gray-500">Your Score/Max</span>
      </div>
      <div className="w-px h-4 bg-gray-300" />
      <span className="text-xs text-gray-500">{scoringType || '+/- Scoring Rule'}</span>
      <span className="text-gray-400 cursor-help text-xs" title="Partial credit is given for correct selections">ⓘ</span>
    </div>
  )
}

// ── MCQ question component ───────────────────────────────────────────────────
function MCQQuestion({ options, selected, onSelect, disabled, feedback, correctAnswer }: {
  options: any[]; selected: string | null; onSelect: (id: string) => void
  disabled: boolean; feedback: any; correctAnswer: any
}) {
  return (
    <div className="space-y-2">
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
            className={`w-full text-left px-3 sm:px-4 py-3 rounded-xl border-2 transition-all ${cls} ${disabled && !showResult ? 'cursor-default' : ''}`}
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

// ── SATA question component ──────────────────────────────────────────────────
function SATAQuestion({ options, selected, onToggle, disabled, feedback, correctAnswer }: {
  options: any[]; selected: string[]; onToggle: (id: string) => void
  disabled: boolean; feedback: any; correctAnswer: any
}) {
  return (
    <div className="space-y-2">
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
            className={`w-full text-left px-3 sm:px-4 py-3 rounded-xl border-2 transition-all ${cls}`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                showResult && isCorrect && isSelected ? 'border-green-500 bg-green-500' :
                showResult && isCorrect && !isSelected ? 'border-green-400' :
                showResult && !isCorrect && isSelected ? 'border-red-500 bg-red-500' :
                isSelected ? 'border-[#17c3b2] bg-[#17c3b2]' : 'border-gray-300'
              }`}>
                {(showResult && isCorrect && isSelected) && <CheckCircle className="h-3 w-3 text-white" />}
                {(showResult && !isCorrect && isSelected) && <XCircle className="h-3 w-3 text-white" />}
                {(!showResult && isSelected) && <CheckCircle className="h-3 w-3 text-white" />}
              </div>
              <span className="text-sm leading-relaxed">
                <span className="font-medium mr-1">{opt.id.toUpperCase()}.</span>{opt.text}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Cloze (drop-down) question ───────────────────────────────────────────────
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
              className={`inline-block mx-1 border-b-2 px-2 py-0.5 rounded text-sm font-medium cursor-pointer max-w-[200px] ${
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

// ── Matrix question ──────────────────────────────────────────────────────────
function MatrixQuestion({ options, selected, onSelect, disabled, feedback, correctAnswer }: {
  options: any; selected: Record<string, string>; onSelect: (row: string, col: string) => void
  disabled: boolean; feedback: any; correctAnswer: any
}) {
  const rows: any[] = options?.rows || []
  const columns: any[] = options?.columns || []
  const correctMap: Record<string, string> = {}
  if (correctAnswer?.cells) {
    for (const [r, c] of correctAnswer.cells) correctMap[String(r)] = String(c)
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse min-w-[320px]">
        <thead>
          <tr>
            <th className="p-2 sm:p-3 border border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500 w-1/2" />
            {columns.map((col: any) => (
              <th key={col.id} className="p-2 sm:p-3 border border-gray-200 bg-gray-50 text-center text-xs font-semibold text-gray-700">
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
                <td className="p-2 sm:p-3 border border-gray-200 text-xs text-gray-700 font-medium leading-relaxed">{row.text}</td>
                {columns.map((col: any) => {
                  const colId = String(col.id)
                  const isSelected = selectedCol === colId
                  const isCorrect = correctCol === colId
                  return (
                    <td key={col.id} className="p-2 sm:p-3 border border-gray-200 text-center">
                      <input
                        type="radio"
                        name={`matrix-${rowId}`}
                        checked={isSelected}
                        onChange={() => !disabled && onSelect(rowId, colId)}
                        disabled={disabled}
                        className="accent-[#17c3b2] cursor-pointer w-4 h-4"
                      />
                      {feedback && isCorrect && <span className="ml-1 text-green-500 text-xs">✓</span>}
                      {feedback && isSelected && !isCorrect && <span className="ml-1 text-red-500 text-xs">✗</span>}
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

// ── Statistics panel (Archer Review style) ───────────────────────────────────
function StatisticsPanel({ question, feedback }: { question: any; feedback: any }) {
  const AREA_LABELS: Record<string, string> = {
    safe_effective_care_environment: 'Safe & Effective Care',
    health_promotion_and_maintenance: 'Health Promotion',
    psychosocial_integrity: 'Psychosocial Integrity',
    physiological_integrity: 'Physiological Integrity',
  }

  const rawTags = question.tags
  const tagList: string[] = Array.isArray(rawTags)
    ? rawTags.filter(Boolean)
    : rawTags ? String(rawTags).split(',').map((t: string) => t.trim()).filter(Boolean) : []

  const diff = feedback?.difficulty || question.difficulty
  const area = feedback?.content_area || question.content_area
  const lesson = feedback?.subcategory || question.subcategory

  return (
    <div className="mt-5 pt-4 border-t border-gray-100">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Statistics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-xs">
        {diff && (
          <div className="flex items-center gap-1.5 text-gray-500 col-span-2 sm:col-span-1">
            <span>Difficulty level –</span>
            <DifficultyBadge difficulty={diff} />
          </div>
        )}
        {area && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="shrink-0">Subject</span>
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium capitalize truncate">
              {AREA_LABELS[area] || area.replace(/_/g, ' ')}
            </span>
          </div>
        )}
        {lesson && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="shrink-0">Lesson</span>
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium truncate">{lesson}</span>
          </div>
        )}
        {question.question_type && (
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="shrink-0">Type</span>
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium capitalize">
              {question.question_type === 'traditional_mcq' ? 'MCQ' :
               question.question_type === 'ngn_sata' ? 'SATA' :
               question.question_type === 'ngn_cloze' ? 'Cloze' : 'Matrix'}
            </span>
          </div>
        )}
      </div>
      {tagList.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tagList.map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Explanation panel (Archer Review style) ──────────────────────────────────
function ExplanationPanel({ question, feedback, isTutorial }: {
  question: any; feedback: any; isTutorial: boolean
}) {
  if (!feedback && !question.answered_at) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400 bg-gray-50">
        {isTutorial ? (
          <>
            <Lightbulb className="h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm font-medium text-gray-500">Submit your answer to see the explanation</p>
          </>
        ) : (
          <>
            <BookOpen className="h-10 w-10 opacity-30 mb-3" />
            <p className="text-sm">Explanation will appear here.</p>
          </>
        )}
      </div>
    )
  }

  const rationale = question.rationale || ''
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
      <h3 className="font-bold text-gray-900 mb-4 text-sm">Explanation</h3>

      {feedback && !feedback.is_correct && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <span className="text-amber-700 text-sm">ⓘ</span>
          <span className="text-xs text-amber-700 font-medium">Click the answer box to view the correct answer</span>
        </div>
      )}

      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed text-sm whitespace-pre-line">
        {rationale || 'No explanation available for this question.'}
      </div>

      {/* Learning Objective box if rationale contains learning objective marker */}
      {rationale.toLowerCase().includes('learning objective') && (
        <div className="mt-5 bg-[#17c3b2]/8 border border-[#17c3b2]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <span>💡</span>
            <h4 className="text-sm font-bold text-gray-800">Learning Objective</h4>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Score Sheet (Results) ────────────────────────────────────────────────────
function ScoreSheet({ session, questions, onClose, onReviewAll, mode }: {
  session: any; questions: any[]; onClose: () => void; onReviewAll: () => void; mode?: string
}) {
  const isTimed = mode === 'timed'
  const SLOW_THRESHOLD = 90
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
      if (q.is_correct) { byArea[area].correct++; byDiff[diff].correct++ }
    }
  }

  const AREA_LABELS: Record<string, string> = {
    safe_effective_care_environment: 'Safe & Effective Care',
    health_promotion_and_maintenance: 'Health Promotion',
    psychosocial_integrity: 'Psychosocial Integrity',
    physiological_integrity: 'Physiological Integrity',
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className={`rounded-2xl p-6 sm:p-8 text-center border-2 ${
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
                      <div className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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

        {isTimed && (() => {
          const answeredWithTime = questions.filter(q => q.answered_at && typeof q.time_spent === 'number')
          if (answeredWithTime.length === 0) return null
          const slowCount = answeredWithTime.filter(q => q.time_spent > SLOW_THRESHOLD).length
          const avgTime = Math.round(answeredWithTime.reduce((s, q) => s + q.time_spent, 0) / answeredWithTime.length)
          return (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-[#17c3b2]" /> Time Per Question
              </h3>
              <div className="flex flex-wrap items-center gap-6 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-black text-gray-900">{formatTime(avgTime)}</p>
                  <p className="text-xs text-gray-500">Average time</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-orange-600">{slowCount}</p>
                  <p className="text-xs text-gray-500">Slow answers (&gt;{SLOW_THRESHOLD}s)</p>
                </div>
              </div>
            </div>
          )
        })()}

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onClose} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <RotateCcw className="h-4 w-4" /> Back to Q-Bank
          </button>
          <button onClick={onReviewAll} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#17c3b2] text-white text-sm font-semibold hover:bg-[#14a99a] transition-colors">
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
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const isReviewMode = searchParams.get('review') === 'true'
  const initialTab = searchParams.get('tab') || 'exam'

  const [session, setSession] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const [selectedMatrix, setSelectedMatrix] = useState<Record<string, string>>({})
  const [selectedCloze, setSelectedCloze] = useState<Record<string, string>>({})

  const [feedback, setFeedback] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qStartElapsedRef = useRef<number>(0)
  const timedEndFiredRef = useRef(false)

  const [showScore, setShowScore] = useState(initialTab === 'score')
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set())
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<number>>(new Set())
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [caseStudyFilter, setCaseStudyFilter] = useState<string | null>(searchParams.get('csFilter'))
  // Mobile: which panel is active ('question' | 'explanation')
  const [mobilePanel, setMobilePanel] = useState<'question' | 'explanation'>('question')

  const updateCaseStudyFilter = (value: string | null) => {
    setCaseStudyFilter(value)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value === null) next.delete('csFilter')
      else next.set('csFilter', value)
      return next
    }, { replace: true })
  }

  const currentQuestion = questions[qIndex] || null
  const sessionMode = session?.settings?.mode || 'tutorial'
  const isTutorial = sessionMode === 'tutorial'
  const isTimed = sessionMode === 'timed'
  const sessionId = parseInt(id || '0')

  const SECONDS_PER_QUESTION = 90
  const totalTimedSeconds = isTimed && questions.length > 0 ? questions.length * SECONDS_PER_QUESTION : null
  const timedTimeLeft = totalTimedSeconds !== null ? Math.max(0, totalTimedSeconds - elapsed) : null

  const caseStudiesInSession = useMemo(() => {
    if (!isReviewMode) return []
    const seen = new Set<string>()
    const counts = new Map<string, number>()
    const result: { id: string; title: string; count: number }[] = []
    for (const q of questions) {
      const csId = q.case_study_id ? String(q.case_study_id) : null
      if (csId) {
        counts.set(csId, (counts.get(csId) ?? 0) + 1)
        if (!seen.has(csId)) {
          seen.add(csId)
          result.push({ id: csId, title: q.case_study_title || `Case Study ${csId}`, count: 0 })
        }
      }
    }
    for (const cs of result) cs.count = counts.get(cs.id) ?? 0
    return result
  }, [questions, isReviewMode])

  const navQuestions = useMemo(() => {
    if (!caseStudyFilter) return questions
    return questions.filter(q => String(q.case_study_id) === caseStudyFilter)
  }, [questions, caseStudyFilter])

  const loadSession = useCallback(async () => {
    if (!id || !user) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch(`/api/questions/session/${id}/questions`)
      setSession(data.session)
      setQuestions(data.questions || [])
      const marks = new Set<number>()
      const bookmarks = new Set<number>()
      for (const q of (data.questions || [])) {
        if (q.marked_for_review) marks.add(q.question_id)
        if (q.is_bookmarked) bookmarks.add(q.question_id)
      }
      setMarkedQuestions(marks)
      setBookmarkedQuestions(bookmarks)
      setQIndex(0)
      if (data.session?.status === 'completed' && !isReviewMode) setShowScore(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [id, user, isReviewMode])

  useEffect(() => { loadSession() }, [loadSession])

  useEffect(() => {
    if (caseStudyFilter) {
      const firstIdx = questions.findIndex(q => String(q.case_study_id) === caseStudyFilter)
      if (firstIdx >= 0) setQIndex(firstIdx)
    }
  }, [caseStudyFilter, questions])

  useEffect(() => {
    if (caseStudyFilter && caseStudiesInSession.length > 0) {
      const valid = caseStudiesInSession.some(cs => cs.id === caseStudyFilter)
      if (!valid) updateCaseStudyFilter(null)
    }
  }, [caseStudiesInSession])

  useEffect(() => {
    if (!isReviewMode && session?.status === 'in_progress' && !showScore) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isReviewMode, session?.status, showScore])

  useEffect(() => {
    if (!isTimed || isReviewMode || showScore || timedTimeLeft === null) return
    if (timedTimeLeft <= 0 && !timedEndFiredRef.current) {
      timedEndFiredRef.current = true
      endSession()
    }
  }, [timedTimeLeft, isTimed, isReviewMode, showScore])

  useEffect(() => {
    const q = questions[qIndex]
    if (!q) return
    setFeedback(null)
    setSubmitError(null)
    qStartElapsedRef.current = elapsed
    setMobilePanel('question')

    if (isReviewMode && q.answered_at) {
      const userAnswer = q.user_answer
      if (q.question_type === 'traditional_mcq') setSelectedAnswer(userAnswer?.value || null)
      else if (q.question_type === 'ngn_sata') setSelectedAnswers(userAnswer?.values || [])
      else if (q.question_type === 'ngn_cloze') setSelectedCloze(userAnswer?.values || {})
      else if (q.question_type === 'ngn_matrix') {
        const matrixMap: Record<string, string> = {}
        for (const [r, c] of (userAnswer?.cells || [])) matrixMap[String(r)] = String(c)
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

  async function toggleBookmark() {
    if (!currentQuestion || bookmarkLoading) return
    const qId = currentQuestion.question_id
    setBookmarkLoading(true)
    const wasBookmarked = bookmarkedQuestions.has(qId)
    const newBookmarked = new Set(bookmarkedQuestions)
    if (wasBookmarked) newBookmarked.delete(qId)
    else newBookmarked.add(qId)
    setBookmarkedQuestions(newBookmarked)
    try {
      await apiFetch('/api/questions/bookmarks/toggle', { method: 'POST', body: JSON.stringify({ question_id: qId }) })
    } catch {
      if (wasBookmarked) newBookmarked.add(qId)
      else newBookmarked.delete(qId)
      setBookmarkedQuestions(new Set(newBookmarked))
    } finally {
      setBookmarkLoading(false)
    }
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
      const questionTimeSpent = elapsed - qStartElapsedRef.current
      const data = await apiFetch(`/api/questions/session/${sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ question_id: currentQuestion.question_id, user_answer, time_spent: questionTimeSpent }),
      })

      setQuestions(prev => {
        const updated = prev.map((q, i) =>
          i === qIndex ? { ...q, is_correct: data.is_correct, user_answer, answered_at: new Date().toISOString(), correct_answer: data.correct_answer, rationale: data.rationale } : q
        )
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
        // Auto-switch to explanation panel on mobile after submitting
        setMobilePanel('explanation')
      } else {
        advanceQuestion()
      }

      if (data.session_complete) {
        setTimeout(async () => {
          await loadSession()
          setShowScore(true)
        }, isTutorial ? 0 : 500)
      }
    } catch (err: any) {
      if (err.message?.includes('Daily question limit') || err.message?.includes('daily_limit')) {
        setSubmitError('Daily question limit reached. Upgrade your plan to continue.')
      } else if (err.message?.includes('time limit exceeded') || err.message?.includes('time_expired')) {
        await loadSession()
        setShowScore(true)
      } else {
        setSubmitError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function advanceQuestion() {
    if (qIndex + 1 < questions.length) setQIndex(qIndex + 1)
    else setShowScore(true)
  }

  async function endSession() {
    try { await apiFetch(`/api/questions/session/${sessionId}/end`, { method: 'POST' }) } catch {}
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
  const isBookmarked = currentQuestion ? bookmarkedQuestions.has(currentQuestion.question_id) : false
  const answeredCount = questions.filter(q => q.answered_at).length
  const showExplanation = !!(feedback || isReviewMode)

  if (loading) {
    return (
      <NCLEXExamLayout>
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-[#17c3b2] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm">Loading exam...</p>
          </div>
        </div>
      </NCLEXExamLayout>
    )
  }

  if (error) {
    return (
      <NCLEXExamLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500 p-6">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-sm text-center">{error}</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 rounded-lg bg-[#17c3b2] text-white text-sm font-semibold">
            Back to Q-Bank
          </button>
        </div>
      </NCLEXExamLayout>
    )
  }

  if (showScore && !isReviewMode) {
    return (
      <NCLEXExamLayout
        sessionId={sessionId}
        mode={sessionMode}
        onClose={() => navigate('/')}
      >
        <ScoreSheet
          session={session}
          questions={questions}
          onClose={() => navigate('/')}
          onReviewAll={() => { setShowScore(false); setQIndex(0) }}
          mode={sessionMode}
        />
      </NCLEXExamLayout>
    )
  }

  if (!currentQuestion) {
    return (
      <NCLEXExamLayout onClose={() => navigate('/')}>
        <div className="flex items-center justify-center h-full text-gray-500">No questions found.</div>
      </NCLEXExamLayout>
    )
  }

  const qtype = currentQuestion.question_type
  const qOptions = currentQuestion.options
  const isDisabled = !!feedback || isReviewMode
  const isCaseStudy = !!(currentQuestion.case_study_id && currentQuestion.case_study_scenario)

  const caseStudyQuestions = currentQuestion.case_study_id
    ? questions.filter(q => q.case_study_id === currentQuestion.case_study_id)
    : []
  const caseStudyIndex = currentQuestion.case_study_id
    ? Math.max(1, caseStudyQuestions.findIndex(q => q.question_id === currentQuestion.question_id) + 1)
    : 0
  const caseStudyTotal = caseStudyQuestions.length

  // SATA score count
  const sataCorrect = qtype === 'ngn_sata' && feedback
    ? selectedAnswers.filter(a => (currentQuestion.correct_answer?.values || []).includes(a)).length
    : 0
  const sataTotal = qtype === 'ngn_sata' ? (currentQuestion.correct_answer?.values || []).length : 0

  // ── The question + answer content (shared between case study right and regular left) ──
  const QuestionContent = () => (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
      {/* Case study header (for case study right panel) */}
      {isCaseStudy && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[#17c3b2]">►</span>
          <span className="text-sm font-semibold text-gray-900">
            {qtype === 'ngn_sata' ? 'Select all that apply' :
             qtype === 'ngn_cloze' ? 'Complete the sentence below from the list of options' :
             qtype === 'ngn_matrix' ? 'Complete the matrix below' :
             'Select the best answer'}
          </span>
        </div>
      )}

      {/* Item position for case study */}
      {isCaseStudy && caseStudyTotal > 0 && (
        <p className="text-xs text-gray-500 mb-3 font-medium">Item {caseStudyIndex} of {caseStudyTotal}</p>
      )}

      {/* Subcategory tab for non-case-study questions */}
      {!isCaseStudy && currentQuestion.subcategory && (
        <div className="flex border-b border-gray-200 mb-4 text-xs gap-0">
          <div className="px-4 py-2 border-b-2 border-gray-900 font-semibold text-gray-900">
            {currentQuestion.subcategory}
          </div>
        </div>
      )}

      {/* SATA score tracker (Archer Review style - above options) */}
      {qtype === 'ngn_sata' && showExplanation && (
        <ScoreTracker correct={sataCorrect} total={sataTotal} scoringType="+/- Scoring Rule" />
      )}

      {/* Question text */}
      <div className="mb-5">
        <p className="text-gray-900 leading-relaxed text-sm font-medium">{currentQuestion.question_text}</p>
      </div>

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
          onToggle={id => setSelectedAnswers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
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

      {/* Submit button (inline for case study right panel on mobile) */}
      {!isReviewMode && !feedback && !isDisabled && (
        <div className="mt-4 sm:hidden">
          <button
            onClick={submitAnswer}
            disabled={!hasAnswer || submitting}
            className="w-full py-3 rounded-xl bg-[#17c3b2] text-white text-sm font-bold hover:bg-[#14a99a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        </div>
      )}

      {/* Statistics (shown after answering for regular questions) */}
      {showExplanation && !isCaseStudy && (
        <StatisticsPanel question={currentQuestion} feedback={feedback} />
      )}

      {/* For case study right panel — show explanation here after answering on mobile */}
      {isCaseStudy && showExplanation && (
        <div className="mt-5 pt-4 border-t border-gray-100 block md:hidden">
          <ExplanationPanel question={currentQuestion} feedback={feedback} isTutorial={isTutorial} />
        </div>
      )}
    </div>
  )

  return (
    <NCLEXExamLayout
      sessionId={sessionId}
      questionNumber={qIndex + 1}
      totalQuestions={questions.length}
      qid={currentQuestion.question_id}
      mode={sessionMode}
      isMarked={isMarked}
      isBookmarked={isBookmarked}
      onToggleMark={toggleMark}
      onToggleBookmark={toggleBookmark}
      onClose={() => navigate('/')}
    >
      {/* ── Mobile Panel Tabs (only on small screens) ── */}
      <div className="flex border-b border-gray-200 bg-white sm:hidden flex-shrink-0">
        <button
          onClick={() => setMobilePanel('question')}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 ${
            mobilePanel === 'question' ? 'text-[#17c3b2] border-[#17c3b2]' : 'text-gray-500 border-transparent'
          }`}
        >
          {isCaseStudy ? 'Case Study' : 'Question'}
        </button>
        <button
          onClick={() => setMobilePanel('explanation')}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 ${
            mobilePanel === 'explanation' ? 'text-[#17c3b2] border-[#17c3b2]' : 'text-gray-500 border-transparent'
          }`}
        >
          {isCaseStudy ? 'Question & Answers' : 'Explanation'}
        </button>
      </div>

      {/* ── Main Two-Column Content ── */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">

        {/* ── LEFT PANEL ── */}
        {/* Desktop: always visible; Mobile: show/hide based on tab */}
        <div className={`
          ${isCaseStudy ? 'sm:w-1/2' : 'sm:flex-1'}
          flex-col overflow-hidden border-r border-gray-200
          ${isCaseStudy ? 'bg-[#f8f9fa]' : 'bg-white'}
          ${mobilePanel === 'question' ? 'flex' : 'hidden sm:flex'}
        `}>
          {isCaseStudy ? (
            /* ── CASE STUDY: Left = Clinical Scenario ── */
            <div className="flex flex-col h-full overflow-hidden min-h-0">
              {/* Scenario tab bar */}
              <div className="flex border-b border-gray-300 bg-white flex-shrink-0">
                {['Clinical Scenario', 'Vital Signs', 'Laboratory'].map((tab, i) => (
                  <button
                    key={tab}
                    className={`px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                      i === 0
                        ? 'border-gray-900 text-gray-900 bg-white'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Case study info */}
              {currentQuestion.case_study_title && (
                <div className="px-4 sm:px-6 pt-4 pb-2 bg-white border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-[#17c3b2] flex-shrink-0" />
                    <span className="text-xs font-bold text-[#17c3b2] uppercase tracking-wide">
                      {currentQuestion.case_study_title}
                    </span>
                  </div>
                </div>
              )}

              {/* Scenario text */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                  {currentQuestion.case_study_scenario}
                </p>

                {/* Stats for case study left panel */}
                {showExplanation && (
                  <StatisticsPanel question={currentQuestion} feedback={feedback} />
                )}
              </div>
            </div>
          ) : (
            /* ── REGULAR: Left = Question + Answers ── */
            QuestionContent()
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        {/* Desktop: always visible; Mobile: show/hide based on tab */}
        <div className={`
          ${isCaseStudy ? 'sm:w-1/2' : 'sm:w-[44%] xl:w-[42%] flex-shrink-0'}
          flex flex-col overflow-hidden bg-white
          ${mobilePanel === 'explanation' ? 'flex' : 'hidden sm:flex'}
        `}>
          {isCaseStudy ? (
            /* ── CASE STUDY: Right = Question + Answers (+ explanation after) ── */
            QuestionContent()
          ) : (
            /* ── REGULAR: Right = Explanation ── */
            <ExplanationPanel
              question={currentQuestion}
              feedback={feedback}
              isTutorial={isTutorial}
            />
          )}
        </div>
      </div>

      {/* ── Timed mode warning bar ── */}
      {!isTutorial && !isReviewMode && !feedback && isTimed && timedTimeLeft !== null && timedTimeLeft <= 120 && (
        <div className={`px-4 py-2 flex-shrink-0 border-t flex items-center gap-2 ${timedTimeLeft <= 60 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <Clock className={`h-3.5 w-3.5 flex-shrink-0 ${timedTimeLeft <= 60 ? 'text-red-600' : 'text-amber-600'}`} />
          <p className={`text-xs font-semibold ${timedTimeLeft <= 60 ? 'text-red-700' : 'text-amber-700'}`}>
            {formatTime(timedTimeLeft)} remaining — submit your answers now!
          </p>
        </div>
      )}

      {/* ── Case Study Filter Bar (review mode) ── */}
      {isReviewMode && caseStudiesInSession.length > 0 && (
        <div className="bg-[#0a1a2e] border-t border-white/10 px-4 py-2 flex items-center gap-2 flex-shrink-0 overflow-x-auto">
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wide flex-shrink-0">Filter:</span>
          <button
            onClick={() => updateCaseStudyFilter(null)}
            className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
              caseStudyFilter === null ? 'bg-[#17c3b2] text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            All — {questions.length}
          </button>
          {caseStudiesInSession.map(cs => (
            <button
              key={cs.id}
              onClick={() => updateCaseStudyFilter(cs.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors max-w-[160px] ${
                caseStudyFilter === cs.id ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
              title={cs.title}
            >
              <BookOpen className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{cs.title}</span>
              <span className="flex-shrink-0 opacity-75">— {cs.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Bottom Navigation Bar ── */}
      <div className="bg-[#0d2137] text-white h-12 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white transition-colors px-2 sm:px-3 py-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"
        >
          ✕ <span className="hidden sm:inline">Close</span>
        </button>

        {/* Progress dots */}
        <div className="flex-1 flex items-center justify-center gap-1 overflow-hidden">
          {navQuestions.slice(0, 20).map((q) => {
            const realIdx = questions.findIndex(rq => rq.question_id === q.question_id)
            const isBookmarkedQ = bookmarkedQuestions.has(q.question_id)
            const isCurrent = realIdx === qIndex
            return (
              <button
                key={q.question_id}
                onClick={() => setQIndex(realIdx)}
                className={`flex-shrink-0 h-2.5 w-2.5 rounded-full transition-all ${
                  isCurrent ? 'bg-[#17c3b2] ring-2 ring-[#17c3b2]/30 scale-125' :
                  q.answered_at ? (q.is_correct ? 'bg-green-400' : 'bg-red-400') :
                  markedQuestions.has(q.question_id) ? 'bg-amber-400' :
                  isBookmarkedQ ? 'bg-[#17c3b2]/30' : 'bg-white/20'
                } ${!isCurrent && isBookmarkedQ ? 'ring-1 ring-[#17c3b2]' : ''}`}
                title={`Q${realIdx + 1}${isBookmarkedQ ? ' · Bookmarked' : ''}`}
              />
            )
          })}
          {navQuestions.length > 20 && (
            <span className="text-xs text-white/40 ml-1">+{navQuestions.length - 20}</span>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {!isReviewMode && session?.status === 'in_progress' && answeredCount > 0 && !feedback && (
            <button onClick={endSession} className="text-xs text-white/50 hover:text-white px-2 py-1 rounded transition-colors hidden sm:block">
              End Test
            </button>
          )}

          {(() => {
            const navQIndex = navQuestions.findIndex(q => q.question_id === currentQuestion?.question_id)
            const prevNavQ = navQIndex > 0 ? navQuestions[navQIndex - 1] : null
            const nextNavQ = navQIndex >= 0 && navQIndex < navQuestions.length - 1 ? navQuestions[navQIndex + 1] : null

            const goPrev = () => {
              if (prevNavQ) {
                const idx = questions.findIndex(q => q.question_id === prevNavQ.question_id)
                if (idx >= 0) setQIndex(idx)
              } else if (!caseStudyFilter) {
                setQIndex(Math.max(0, qIndex - 1))
              }
            }
            const goNext = () => {
              if (nextNavQ) {
                const idx = questions.findIndex(q => q.question_id === nextNavQ.question_id)
                if (idx >= 0) setQIndex(idx)
              } else if (!caseStudyFilter) {
                advanceQuestion()
              }
            }
            const atStart = navQIndex <= 0
            const atEnd = caseStudyFilter ? !nextNavQ : qIndex + 1 >= questions.length && !feedback

            return (
              <>
                <button
                  onClick={goPrev}
                  disabled={atStart}
                  className="flex items-center gap-1 text-xs font-semibold px-2 sm:px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                {!isReviewMode && !feedback && !isDisabled ? (
                  <button
                    onClick={submitAnswer}
                    disabled={!hasAnswer || submitting}
                    className="flex items-center gap-1 text-xs font-bold px-3 sm:px-4 py-1.5 rounded-lg bg-[#17c3b2] hover:bg-[#14a99a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? '...' : 'Submit'}
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    disabled={atEnd}
                    className="flex items-center gap-1 text-xs font-bold px-3 sm:px-4 py-1.5 rounded-lg bg-[#17c3b2] hover:bg-[#14a99a] disabled:opacity-40 transition-colors"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </>
            )
          })()}
        </div>
      </div>
    </NCLEXExamLayout>
  )
}
