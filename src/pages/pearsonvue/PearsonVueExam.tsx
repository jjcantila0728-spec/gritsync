// pearsonvue.gritsync.com/exam/:sessionId — the actual test surface.
// Replicates the real Pearson VUE NCLEX testing UI: navy banner, item
// counter top-right, clock, question text and options on a white background,
// Calculator / Highlight / Strikethrough placeholders at the bottom-left,
// Next button bottom-right. Reuses the same /api/nclex/sessions/* endpoints
// as review.gritsync.com.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, Calculator, Highlighter, StrikethroughIcon, ChevronRight } from 'lucide-react'
import { nclexApi } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { reviewUrl } from '@/lib/routing'

interface SessionItem {
  id: string
  itemIndex: number
  question: {
    id: string
    format: string
    stem: string
    options: any
    topic?: string | null
  } | null
}

interface SessionResponse {
  session: {
    id: string
    examType: string
    status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'
    timeLimit?: number | null
    items?: SessionItem[]
    questionPool?: string[]
  }
  currentQuestion: any
  currentIndex: number
}

export function PearsonVueExam() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [data, setData] = useState<SessionResponse | null>(null)
  const [response, setResponse] = useState<string | string[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const startedAtRef = useRef<Date | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Load the session and the current question. Acts as the per-route
  // access guard: if the session id doesn't exist, doesn't belong to the
  // current user, or isn't IN_PROGRESS, we bounce back to review where
  // the user can legitimately start a new test. The /api/nclex/sessions/:id
  // endpoint already enforces ownership server-side (it filters by user_id),
  // so an unauthorized id simply returns 404.
  useEffect(() => {
    if (!sessionId) {
      window.location.replace(reviewUrl('/nclex/qbanks'))
      return
    }
    let cancelled = false
    setLoading(true)
    nclexApi
      .getSession(sessionId)
      .then((res) => {
        if (cancelled) return
        const payload = res.data?.data as SessionResponse
        // Only IN_PROGRESS sessions are eligible for the test surface.
        // Completed / abandoned sessions belong on the results page; an
        // attacker copying a stale id from another tab gets bounced.
        if (!payload?.session || payload.session.status !== 'IN_PROGRESS') {
          window.location.replace(reviewUrl('/nclex/qbanks'))
          return
        }
        setData(payload)
        startedAtRef.current = new Date()
        setResponse(null)
      })
      .catch(() => {
        if (cancelled) return
        // 401 / 404 / network — same response: send them home to start over.
        window.location.replace(reviewUrl('/nclex/qbanks'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sessionId])

  const currentQuestion = data?.currentQuestion
  const currentIndex = data?.currentIndex ?? 0
  const totalEstimate = data?.session.examType === 'CAT' ? 150 : (data?.session.questionPool?.length ?? 0)

  // Format-specific option rendering. Mimics the actual Pearson VUE layout:
  // numbered options with radio buttons (MCQ) or checkboxes (SATA).
  const isSATA = currentQuestion?.format === 'SATA'

  const optionList = useMemo(() => {
    if (!currentQuestion?.options || !Array.isArray(currentQuestion.options)) return []
    return currentQuestion.options as Array<{ id: string; text: string }>
  }, [currentQuestion])

  const handleOptionToggle = (optionId: string) => {
    if (isSATA) {
      setResponse((prev) => {
        const arr = Array.isArray(prev) ? prev : []
        return arr.includes(optionId) ? arr.filter((id) => id !== optionId) : [...arr, optionId]
      })
    } else {
      setResponse(optionId)
    }
  }

  const handleNext = async () => {
    if (!sessionId || !currentQuestion) return
    if (response == null || (Array.isArray(response) && response.length === 0)) {
      setError('Select an answer before continuing.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const timeSpent = startedAtRef.current
        ? Math.round((Date.now() - startedAtRef.current.getTime()) / 1000)
        : 0
      const res = await nclexApi.submitAnswer(sessionId, {
        questionId: currentQuestion.id,
        response,
        timeSpent,
      })
      const payload = res.data?.data
      if (payload?.completed || payload?.session?.status === 'COMPLETED') {
        navigate(`/?completed=${sessionId}`)
        return
      }
      // Refresh current question
      const next = await nclexApi.getSession(sessionId)
      setData(next.data?.data as SessionResponse)
      setResponse(null)
      startedAtRef.current = new Date()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not submit your answer.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#003a70] text-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-3 text-sm">Loading test…</span>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-[#003a70] text-white flex flex-col items-center justify-center p-6">
        <p className="text-sm mb-4">{error || 'No question to display.'}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-white text-[#003a70] px-4 py-2 rounded-sm text-sm font-semibold"
        >
          Back to start
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#e9eef3] flex flex-col font-sans">
      {/* ─── Banner ─── */}
      <header className="bg-[#003a70] text-white flex items-stretch justify-between flex-shrink-0">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-2">
          <div className="h-6 w-6 rounded-sm bg-white flex items-center justify-center">
            <span className="text-[#003a70] text-[9px] font-black tracking-tight">PV</span>
          </div>
          <span className="text-sm font-semibold tracking-wide">NCLEX-RN&reg; Examination</span>
        </div>
        <div className="flex items-stretch text-xs">
          <div className="px-4 py-2 border-l border-blue-900/40 flex items-center gap-2">
            <span className="text-blue-200">Item</span>
            <span className="font-mono font-bold">
              {currentIndex + 1}{totalEstimate ? ` of ${totalEstimate}` : ''}
            </span>
          </div>
          <div className="px-4 py-2 border-l border-blue-900/40 flex items-center gap-2 font-mono">
            {now.toLocaleTimeString([], { hour12: false })}
          </div>
          <div className="px-4 py-2 border-l border-blue-900/40 hidden md:flex items-center gap-2">
            <span className="text-blue-200">Candidate:</span>
            <span className="truncate max-w-[160px]">
              {user?.first_name ?? ''} {user?.last_name ?? ''}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Test surface ─── */}
      <main className="flex-1 flex flex-col px-4 sm:px-8 lg:px-16 py-6">
        <div className="bg-white shadow-sm ring-1 ring-gray-200 flex-1 flex flex-col">
          <div className="px-6 sm:px-10 py-5 border-b border-gray-200 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-gray-500">
              {currentQuestion.topic ? <span>{currentQuestion.topic}</span> : <span>Question</span>}
              <span className="mx-2 text-gray-300">·</span>
              <span>{currentQuestion.format}</span>
              {isSATA && (
                <>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="text-amber-700 font-semibold">Select all that apply</span>
                </>
              )}
            </div>
          </div>

          <div className="px-6 sm:px-10 py-6 flex-1 overflow-y-auto">
            <p className="text-base sm:text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap mb-6">
              {currentQuestion.stem}
            </p>

            <ol className="space-y-2.5">
              {optionList.map((opt) => {
                const checked = isSATA
                  ? Array.isArray(response) && response.includes(opt.id)
                  : response === opt.id
                return (
                  <li key={opt.id}>
                    <label
                      className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${
                        checked
                          ? 'border-[#003a70] bg-[#003a70]/5'
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type={isSATA ? 'checkbox' : 'radio'}
                        name="answer"
                        checked={checked}
                        onChange={() => handleOptionToggle(opt.id)}
                        className="mt-0.5 h-4 w-4 text-[#003a70] focus:ring-[#003a70] border-gray-400"
                      />
                      <span className="text-sm leading-relaxed text-gray-900 select-text">
                        <span className="font-semibold mr-2">{opt.id.toUpperCase()}.</span>
                        {opt.text}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ol>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-300 rounded-sm px-4 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Tool strip + Next */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              {[
                { label: 'Calculator', icon: Calculator },
                { label: 'Highlight', icon: Highlighter },
                { label: 'Strike', icon: StrikethroughIcon },
              ].map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-[11px] text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-100 disabled:opacity-50"
                  disabled
                  title={`${label} — coming soon`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handleNext}
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-[#003a70] hover:bg-[#002a55] disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 sm:px-6 py-2 rounded-sm shadow-sm transition-colors"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              {submitting ? 'Submitting…' : 'Next Item'}
            </button>
          </div>
        </div>
      </main>

      <footer className="bg-[#002347] text-blue-200 text-[11px] py-1.5 px-4 sm:px-6 text-center border-t border-[#001a36]">
        Pearson VUE Test Delivery &mdash; GritSync practice environment.
      </footer>
    </div>
  )
}
