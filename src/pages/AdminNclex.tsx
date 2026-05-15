/**
 * Admin NCLEX Management — single-page, 9-tab admin console for the NCLEX
 * practice platform. Replaces the legacy AdminQuestionBank +
 * AdminNCLEXSubscriptions pages. Talks to /api/nclex/admin/* (auth: admin).
 *
 * Tabs are URL-deep-linkable via ?tab=<id>. Each tab fetches lazily on first
 * activation and caches its state for subsequent visits.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  BarChart3, FileText, Sparkles, BookOpen, Trophy, Crown, Settings,
  Video, Star, Plus, Edit2, Trash2, RefreshCw, Check, X,
  GripVertical, ChevronDown, ChevronUp, ExternalLink, Lightbulb,
} from 'lucide-react'

// ─── helpers ─────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('gritsync_token')
}

function useNotify() {
  const { showToast } = useToast()
  return {
    success: (msg: string) => showToast(msg, 'success'),
    error: (msg: string) => showToast(msg, 'error'),
  }
}

async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts?.headers as Record<string, string> || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`)
  // server wraps as { success, message, data }; unwrap for convenience
  return (data?.data ?? data) as T
}

const FORMATS = [
  'MCQ', 'SATA', 'ORDERED_RESPONSE', 'FILL_IN_BLANK', 'HIGHLIGHT_TEXT',
  'BOW_TIE', 'DROP_DOWN', 'MATRIX_MCQ', 'MATRIX_SATA', 'DRAG_DROP',
] as const
type Format = typeof FORMATS[number]

const NGN_FORMATS: Format[] = ['SATA', 'BOW_TIE', 'DROP_DOWN', 'MATRIX_MCQ', 'MATRIX_SATA', 'DRAG_DROP', 'HIGHLIGHT_TEXT']

const FORMAT_LABELS: Record<Format, string> = {
  MCQ: 'Multiple Choice',
  SATA: 'Select All That Apply',
  ORDERED_RESPONSE: 'Ordered Response',
  FILL_IN_BLANK: 'Fill in the Blank',
  HIGHLIGHT_TEXT: 'Highlight Text',
  BOW_TIE: 'Bow Tie',
  DROP_DOWN: 'Drop Down',
  MATRIX_MCQ: 'Matrix MCQ',
  MATRIX_SATA: 'Matrix SATA',
  DRAG_DROP: 'Drag & Drop',
}

const TEST_TAKING_STRATEGIES: Record<Format, { steps: string[]; tip: string }> = {
  MCQ: {
    steps: [
      'Read the stem twice — identify what is actually being asked.',
      'Cover the options. Predict an answer before reading them.',
      'Eliminate two obvious distractors first.',
      'Choose the option that addresses safety, ABCs, or the nursing process.',
    ],
    tip: 'When two options look equally correct, pick the broader, more comprehensive one — it usually subsumes the other.',
  },
  SATA: {
    steps: [
      'Treat each option as its own True/False question.',
      'Read each option in isolation against the stem.',
      'Do not anchor on the count of correct answers — there is no fixed number.',
      'Re-check by reading the stem with only your selected options.',
    ],
    tip: 'SATA items have no partial credit — be confident on each pick.',
  },
  ORDERED_RESPONSE: {
    steps: [
      'Identify the goal: emergency? procedure? assessment?',
      'Mark the obvious first step (safety / ABCs / consent).',
      'Mark the obvious last step (documentation / evaluation).',
      'Fill in the middle by clinical logic.',
    ],
    tip: 'Always lead with safety — airway/breathing/circulation before any intervention.',
  },
  FILL_IN_BLANK: {
    steps: [
      'Re-read the calculation prompt carefully — pull out given values.',
      'Set up the formula on scratch paper before computing.',
      'Match the requested unit; round only at the end.',
      'Sanity-check the order of magnitude.',
    ],
    tip: 'Most fills are dosage calculations. Double-check decimal placement before submitting.',
  },
  HIGHLIGHT_TEXT: {
    steps: [
      'Skim the passage for the requested concern (e.g. "findings that require follow-up").',
      'Highlight only items that directly match the request — do not over-highlight.',
      'Re-read each highlight in context to confirm.',
    ],
    tip: 'A common trap is highlighting normal findings. Verify each pick against normal vital/lab ranges.',
  },
  BOW_TIE: {
    steps: [
      'Identify the central problem first.',
      'Pick two actions you would take in priority order.',
      'Pick two conditions to monitor that confirm your assessment.',
    ],
    tip: 'Bow ties test clinical judgment. Anchor on the most-urgent problem before selecting actions.',
  },
  DROP_DOWN: {
    steps: [
      'Read the sentence end-to-end first to get its full meaning.',
      'Resolve each dropdown left-to-right.',
      'Re-read the completed sentence to verify it is clinically coherent.',
    ],
    tip: 'Treat the sentence as a connected clinical statement, not isolated blanks.',
  },
  MATRIX_MCQ: {
    steps: [
      'Read the row label (the assessment finding or scenario).',
      'Pick the single best column option for that row.',
      'Repeat per row independently.',
    ],
    tip: 'Each row is an independent MCQ. Do not let one row bias another.',
  },
  MATRIX_SATA: {
    steps: [
      'For each row, evaluate every column as True/False against the row.',
      'Select all true columns for that row before moving on.',
    ],
    tip: 'Matrix SATA is the densest format — pace yourself, one row at a time.',
  },
  DRAG_DROP: {
    steps: [
      'Read each item once before placing.',
      'Start with the easiest, most certain placements.',
      'Re-evaluate the remaining items as the targets fill up.',
    ],
    tip: 'Process of elimination is your friend — confident placements simplify the rest.',
  },
}

// ─── types ───────────────────────────────────────────────────────────────────

type Bank = 'CLASSIC' | 'NGN'

type Question = {
  id: string
  bank: Bank
  format: Format
  caseStudyId?: string | null
  itemNumber?: number | null
  stem: string
  stemImage?: string | null
  options: any
  correctAnswer: any
  rationale: string
  rationaleImage?: string | null
  additionalInfo?: string | null
  topic?: string | null
  subtopic?: string | null
  difficulty: number
  discrimination: number
  isActive?: boolean
  metadata?: any
}

type CaseStudy = {
  id: string
  title: string
  scenario: string
  tabs: { label: string; content: string }[]
  caseType: 'UNFOLDING' | 'STANDALONE'
  isActive?: boolean
  questions?: Question[]
}

type SubscriptionPlan = {
  id: string
  name: string
  price: number
  durationDays: number | null
  currency: string
  description: string
  features: { name: string; included: boolean }[]
  isPopular: boolean
  isActive: boolean
}

type NclexVideo = {
  id: string
  title: string
  description: string
  videoUrl: string
  thumbnailUrl: string
  duration: string
  order: number
  isPublished: boolean
  topic: string
}

// ─── tab nav ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'stats',         label: 'Overview',     Icon: BarChart3 },
  { id: 'questions',     label: 'Questions',    Icon: FileText },
  { id: 'generator',     label: 'AI Generator', Icon: Sparkles },
  { id: 'cases',         label: 'Case Studies', Icon: BookOpen },
  { id: 'access',        label: 'Exit Access',  Icon: Trophy },
  { id: 'subscriptions', label: 'Subscriptions', Icon: Crown },
  { id: 'plans',         label: 'Plans & Pricing', Icon: Settings },
  { id: 'videos',        label: 'Videos',       Icon: Video },
  { id: 'testimonials',  label: 'Testimonials', Icon: Star },
] as const
type TabId = typeof TABS[number]['id']

// ─── main component ──────────────────────────────────────────────────────────

export function AdminNclex() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabId) || 'stats'
  const [tab, setTab] = useState<TabId>(initialTab)

  useEffect(() => {
    if (loading) return
    if (!user || user.role !== 'admin') navigate('/login', { replace: true })
  }, [user, loading, navigate])

  useEffect(() => {
    const current = searchParams.get('tab')
    if (current !== tab) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', tab)
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  if (loading || !user || user.role !== 'admin') return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="sticky top-16 z-20 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur px-4 sm:px-6 lg:px-8 pt-6 pb-3 border-b border-gray-200 dark:border-gray-800">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">NCLEX Management</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage NCLEX content, sessions, and user access
            </p>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
              {TABS.map(({ id, label, Icon }) => {
                const active = tab === id
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                      active
                        ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {tab === 'stats' && <StatsTab />}
            {tab === 'questions' && <QuestionsTab />}
            {tab === 'generator' && <GeneratorTab />}
            {tab === 'cases' && <CasesTab />}
            {tab === 'access' && <AccessTab />}
            {tab === 'subscriptions' && <SubscriptionsTab />}
            {tab === 'plans' && <PlansTab />}
            {tab === 'videos' && <VideosTab />}
            {tab === 'testimonials' && <TestimonialsTab />}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Stats tab ───────────────────────────────────────────────────────────────

function StatsTab() {
  const toast = useNotify()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/nclex/admin/stats')
      setStats(data)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-gray-500">Loading…</div>
  if (!stats) return null

  const cards = [
    { label: 'Classic Questions', value: stats.classic ?? 0, color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' },
    { label: 'NGN Questions',     value: stats.ngn ?? 0,     color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' },
    { label: 'Case Studies',      value: stats.caseStudies ?? 0, color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' },
  ]
  const maxFormatCount = Math.max(1, ...(stats.byFormat || []).map((b: any) => Number(b._count) || 0))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{c.value}</div>
            <div className={`mt-2 inline-block px-2 py-0.5 rounded-md text-xs font-medium ${c.color}`}>{c.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Sessions by status</h2>
        <div className="grid grid-cols-3 gap-3">
          {(stats.sessions || []).map((s: any) => (
            <div key={s.status} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="text-xs text-gray-500 uppercase">{s.status}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{s._count}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Question format breakdown</h2>
        <div className="space-y-2">
          {(stats.byFormat || []).map((b: any) => (
            <div key={b.format} className="flex items-center gap-3">
              <div className="w-40 text-xs text-gray-700 dark:text-gray-300">{FORMAT_LABELS[b.format as Format] || b.format}</div>
              <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded">
                <div
                  className="h-3 rounded bg-primary-600"
                  style={{ width: `${(Number(b._count) / maxFormatCount) * 100}%` }}
                />
              </div>
              <div className="w-12 text-right text-xs text-gray-700 dark:text-gray-300">{b._count}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ─── Questions tab ───────────────────────────────────────────────────────────

function QuestionsTab() {
  const toast = useNotify()
  const [list, setList] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [bank, setBank] = useState<'' | Bank>('')
  const [format, setFormat] = useState<'' | Format>('')
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [editing, setEditing] = useState<Question | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (bank) qs.set('bank', bank)
      if (format) qs.set('format', format)
      if (search) qs.set('search', search)
      if (topic) qs.set('topic', topic)
      qs.set('page', String(page))
      qs.set('pageSize', String(pageSize))
      const data: any = await apiFetch(`/api/nclex/admin/questions?${qs}`)
      setList(data.questions || data.items || data.rows || [])
      setTotal(data.total ?? 0)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [bank, format, search, topic, page, pageSize, toast])

  useEffect(() => { load() }, [load])

  const onDelete = async (id: string) => {
    if (!confirm('Delete this question? This cannot be undone.')) return
    try {
      await apiFetch(`/api/nclex/admin/questions/${id}`, { method: 'DELETE' })
      toast.success('Question deleted')
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500">Search stem</label>
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="keywords…" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Bank</label>
          <Select value={bank} onChange={(e) => { setBank(e.target.value as any); setPage(1) }}>
            <option value="">All</option>
            <option value="CLASSIC">CLASSIC</option>
            <option value="NGN">NGN</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Format</label>
          <Select value={format} onChange={(e) => { setFormat(e.target.value as any); setPage(1) }}>
            <option value="">All</option>
            {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Topic</label>
          <Input value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1) }} placeholder="topic…" />
        </div>
        <Button variant="outline" onClick={load} className="flex items-center gap-1"><RefreshCw className="h-4 w-4" />Refresh</Button>
        <Button onClick={() => { setEditing(null); setShowEditor(true) }} className="bg-primary-600 hover:bg-primary-700 text-white">
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2">Stem</th>
              <th className="px-4 py-2">Bank</th>
              <th className="px-4 py-2">Format</th>
              <th className="px-4 py-2">Topic</th>
              <th className="px-4 py-2">Diff.</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No questions match.</td></tr>
            )}
            {list.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-2 max-w-md truncate text-gray-900 dark:text-gray-100">{q.stem}</td>
                <td className="px-4 py-2"><Badge>{q.bank}</Badge></td>
                <td className="px-4 py-2 text-xs">{FORMAT_LABELS[q.format] || q.format}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{q.topic || '—'}</td>
                <td className="px-4 py-2 text-xs">{Number(q.difficulty).toFixed(2)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(q); setShowEditor(true) }}><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(q.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <div>{total.toLocaleString()} total</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span>Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      {showEditor && (
        <QuestionEditorModal
          question={editing}
          onClose={() => setShowEditor(false)}
          onSaved={() => { setShowEditor(false); load() }}
        />
      )}
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
      {children}
    </span>
  )
}

// ─── Question Editor Modal (all 10 formats) ─────────────────────────────────

function defaultOptionsFor(format: Format): any {
  switch (format) {
    case 'MCQ': return ['', '', '', '']
    case 'SATA': return ['', '', '', '', '']
    case 'ORDERED_RESPONSE': return ['', '', '', '']
    case 'FILL_IN_BLANK': return []
    case 'HIGHLIGHT_TEXT': return { segments: [''] }
    case 'BOW_TIE': return { actions: ['', ''], conditions: ['', ''], parameters: ['', ''] }
    case 'DROP_DOWN': return { blanks: [''], choices: [['', '']] }
    case 'MATRIX_MCQ':
    case 'MATRIX_SATA': return { rows: ['', ''], cols: ['', ''] }
    case 'DRAG_DROP': return { items: ['', ''], targets: ['', ''] }
  }
}

function defaultAnswerFor(format: Format): any {
  switch (format) {
    case 'MCQ': return 0
    case 'SATA':
    case 'ORDERED_RESPONSE':
    case 'HIGHLIGHT_TEXT': return []
    case 'FILL_IN_BLANK': return ''
    case 'BOW_TIE': return { action: 0, condition: 0, parameter: 0 }
    case 'DROP_DOWN':
    case 'MATRIX_MCQ': return [0]
    case 'MATRIX_SATA': return [[]]
    case 'DRAG_DROP': return [0]
  }
}

function QuestionEditorModal({ question, onClose, onSaved }: { question: Question | null; onClose: () => void; onSaved: () => void }) {
  const toast = useNotify()
  const isEdit = !!question
  const [bank, setBank] = useState<Bank>(question?.bank ?? 'CLASSIC')
  const [format, setFormat] = useState<Format>(question?.format ?? 'MCQ')
  const [stem, setStem] = useState(question?.stem ?? '')
  const [options, setOptions] = useState<any>(question?.options ?? defaultOptionsFor(question?.format ?? 'MCQ'))
  const [correctAnswer, setCorrectAnswer] = useState<any>(question?.correctAnswer ?? defaultAnswerFor(question?.format ?? 'MCQ'))
  const [rationale, setRationale] = useState(question?.rationale ?? '')
  const [additionalInfo, setAdditionalInfo] = useState(question?.additionalInfo ?? '')
  const [topic, setTopic] = useState(question?.topic ?? '')
  const [subtopic, setSubtopic] = useState(question?.subtopic ?? '')
  const [difficulty, setDifficulty] = useState<number>(question?.difficulty ?? 0)
  const [discrimination, setDiscrimination] = useState<number>(question?.discrimination ?? 1)
  const [caseStudyId, setCaseStudyId] = useState(question?.caseStudyId ?? '')
  const [saving, setSaving] = useState(false)

  // When format changes, reset options/correctAnswer if they don't match (avoid runtime errors)
  useEffect(() => {
    if (question?.format === format) return
    setOptions(defaultOptionsFor(format))
    setCorrectAnswer(defaultAnswerFor(format))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format])

  const onSubmit = async () => {
    if (!stem.trim()) return toast.error('Stem is required')
    if (!rationale.trim()) return toast.error('Rationale is required')
    setSaving(true)
    try {
      const body = {
        bank, format, stem, options, correctAnswer, rationale,
        additionalInfo: additionalInfo || null,
        topic: topic || null,
        subtopic: subtopic || null,
        difficulty: Number(difficulty),
        discrimination: Number(discrimination),
        caseStudyId: caseStudyId || null,
      }
      if (isEdit) {
        await apiFetch(`/api/nclex/admin/questions/${question!.id}`, { method: 'PUT', body: JSON.stringify(body) })
        toast.success('Saved')
      } else {
        await apiFetch('/api/nclex/admin/questions', { method: 'POST', body: JSON.stringify(body) })
        toast.success('Created')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const strategy = TEST_TAKING_STRATEGIES[format]

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit question' : 'New question'} size="xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Bank</label>
              <Select value={bank} onChange={(e) => setBank(e.target.value as Bank)}>
                <option value="CLASSIC">CLASSIC</option>
                <option value="NGN">NGN</option>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Format</label>
              <Select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Stem</label>
            <Textarea rows={4} value={stem} onChange={(e) => setStem(e.target.value)} />
          </div>

          <FormatOptionsEditor format={format} options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />

          <div>
            <label className="text-xs text-gray-500">Rationale</label>
            <Textarea rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Additional info (optional)</label>
            <Textarea rows={2} value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Topic</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Subtopic</label>
              <Input value={subtopic} onChange={(e) => setSubtopic(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Difficulty (-4 → 4)</label>
              <Input type="number" step="0.1" min="-4" max="4" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Discrimination (0.1 → 2.5)</label>
              <Input type="number" step="0.1" min="0.1" max="2.5" value={discrimination} onChange={(e) => setDiscrimination(Number(e.target.value))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">Case Study ID (optional)</label>
              <Input value={caseStudyId} onChange={(e) => setCaseStudyId(e.target.value)} placeholder="link to a case study" />
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary-600" />
              Strategy: {FORMAT_LABELS[format]}
            </h3>
            <ol className="mt-3 space-y-2 text-xs text-gray-700 dark:text-gray-300 list-decimal list-inside">
              {strategy.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <p className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-800 dark:text-blue-300 rounded">
              <strong>Tip:</strong> {strategy.tip}
            </p>
          </Card>
        </aside>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} disabled={saving} className="bg-primary-600 hover:bg-primary-700 text-white">
          {saving ? 'Saving…' : (isEdit ? 'Save' : 'Create')}
        </Button>
      </div>
    </Modal>
  )
}

// ─── Per-format option editors ───────────────────────────────────────────────

function FormatOptionsEditor({ format, options, setOptions, correctAnswer, setCorrectAnswer }: {
  format: Format
  options: any; setOptions: (v: any) => void
  correctAnswer: any; setCorrectAnswer: (v: any) => void
}) {
  switch (format) {
    case 'MCQ':
      return <McqEditor options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
    case 'SATA':
      return <SataEditor options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
    case 'ORDERED_RESPONSE':
      return <OrderedEditor options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
    case 'FILL_IN_BLANK':
      return <FillBlankEditor correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
    case 'HIGHLIGHT_TEXT':
      return <HighlightEditor options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
    case 'BOW_TIE':
      return <BowTieEditor options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
    case 'DROP_DOWN':
      return <DropDownEditor options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
    case 'MATRIX_MCQ':
      return <MatrixEditor multi={false} options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
    case 'MATRIX_SATA':
      return <MatrixEditor multi={true} options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
    case 'DRAG_DROP':
      return <DragDropEditor options={options} setOptions={setOptions} correctAnswer={correctAnswer} setCorrectAnswer={setCorrectAnswer} />
  }
}

function McqEditor({ options, setOptions, correctAnswer, setCorrectAnswer }: any) {
  const opts: string[] = Array.isArray(options) ? options : ['', '', '', '']
  return (
    <div>
      <label className="text-xs text-gray-500">Options (pick one correct)</label>
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" checked={Number(correctAnswer) === i} onChange={() => setCorrectAnswer(i)} />
            <Input value={o} onChange={(e) => { const n = [...opts]; n[i] = e.target.value; setOptions(n) }} />
            <Button variant="ghost" size="sm" onClick={() => { const n = opts.filter((_, j) => j !== i); setOptions(n) }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => setOptions([...opts, ''])}><Plus className="h-4 w-4" />Add option</Button>
    </div>
  )
}

function SataEditor({ options, setOptions, correctAnswer, setCorrectAnswer }: any) {
  const opts: string[] = Array.isArray(options) ? options : ['', '', '', '', '']
  const correct: number[] = Array.isArray(correctAnswer) ? correctAnswer : []
  const toggle = (i: number) => {
    setCorrectAnswer(correct.includes(i) ? correct.filter((x) => x !== i) : [...correct, i].sort((a, b) => a - b))
  }
  return (
    <div>
      <label className="text-xs text-gray-500">Options (select all that apply)</label>
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" checked={correct.includes(i)} onChange={() => toggle(i)} />
            <Input value={o} onChange={(e) => { const n = [...opts]; n[i] = e.target.value; setOptions(n) }} />
            <Button variant="ghost" size="sm" onClick={() => { const n = opts.filter((_, j) => j !== i); setOptions(n); setCorrectAnswer(correct.filter((x) => x !== i)) }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => setOptions([...opts, ''])}><Plus className="h-4 w-4" />Add option</Button>
    </div>
  )
}

function OrderedEditor({ options, setOptions, correctAnswer, setCorrectAnswer }: any) {
  const opts: string[] = Array.isArray(options) ? options : ['', '', '', '']
  const order: number[] = Array.isArray(correctAnswer) && correctAnswer.length === opts.length
    ? correctAnswer
    : opts.map((_, i) => i)
  const move = (idx: number, dir: -1 | 1) => {
    const n = [...order]
    const t = idx + dir
    if (t < 0 || t >= n.length) return
    ;[n[idx], n[t]] = [n[t], n[idx]]
    setCorrectAnswer(n)
  }
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500">Steps</label>
        <div className="space-y-2">
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={o} onChange={(e) => { const n = [...opts]; n[i] = e.target.value; setOptions(n) }} placeholder={`Step ${i + 1}`} />
              <Button variant="ghost" size="sm" onClick={() => { const n = opts.filter((_, j) => j !== i); setOptions(n); setCorrectAnswer(n.map((_, k) => k)) }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => { const n = [...opts, '']; setOptions(n); setCorrectAnswer(n.map((_, k) => k)) }}><Plus className="h-4 w-4" />Add step</Button>
      </div>
      <div>
        <label className="text-xs text-gray-500">Correct order</label>
        <div className="space-y-1">
          {order.map((origIdx, pos) => (
            <div key={pos} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
              <span className="text-xs font-bold w-6">{pos + 1}.</span>
              <span className="flex-1 text-sm">{opts[origIdx] || `(empty step ${origIdx + 1})`}</span>
              <Button variant="ghost" size="sm" onClick={() => move(pos, -1)}><ChevronUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => move(pos, 1)}><ChevronDown className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FillBlankEditor({ correctAnswer, setCorrectAnswer }: any) {
  const [mode, setMode] = useState<'number' | 'text'>(typeof correctAnswer === 'number' || (typeof correctAnswer === 'object' && correctAnswer?.value !== undefined) ? 'number' : 'text')
  if (mode === 'number') {
    const obj = (typeof correctAnswer === 'object' && correctAnswer) ? correctAnswer : { value: Number(correctAnswer) || 0, tolerance: 0.1 }
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Answer type:</span>
          <Button variant={mode === 'number' ? 'default' : 'outline'} size="sm" onClick={() => setMode('number')}>Number</Button>
          <Button variant="outline" size="sm" onClick={() => { setMode('text'); setCorrectAnswer('') }}>Text</Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">Value</label>
            <Input type="number" step="any" value={obj.value} onChange={(e) => setCorrectAnswer({ value: Number(e.target.value), tolerance: obj.tolerance })} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Tolerance</label>
            <Input type="number" step="any" value={obj.tolerance} onChange={(e) => setCorrectAnswer({ value: obj.value, tolerance: Number(e.target.value) })} />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Answer type:</span>
        <Button variant="outline" size="sm" onClick={() => { setMode('number'); setCorrectAnswer({ value: 0, tolerance: 0.1 }) }}>Number</Button>
        <Button variant={mode === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setMode('text')}>Text</Button>
      </div>
      <div>
        <label className="text-xs text-gray-500">Correct text</label>
        <Input value={String(correctAnswer ?? '')} onChange={(e) => setCorrectAnswer(e.target.value)} />
      </div>
    </div>
  )
}

function HighlightEditor({ options, setOptions, correctAnswer, setCorrectAnswer }: any) {
  const segs: string[] = options?.segments ?? ['']
  const correct: number[] = Array.isArray(correctAnswer) ? correctAnswer : []
  const toggle = (i: number) => setCorrectAnswer(correct.includes(i) ? correct.filter((x) => x !== i) : [...correct, i].sort((a, b) => a - b))
  return (
    <div>
      <label className="text-xs text-gray-500">Segments (toggle to mark as "highlight target")</label>
      <div className="space-y-2">
        {segs.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" checked={correct.includes(i)} onChange={() => toggle(i)} />
            <Input value={s} onChange={(e) => { const n = [...segs]; n[i] = e.target.value; setOptions({ segments: n }) }} placeholder={`Segment ${i + 1}`} />
            <Button variant="ghost" size="sm" onClick={() => { const n = segs.filter((_, j) => j !== i); setOptions({ segments: n }); setCorrectAnswer(correct.filter((x) => x !== i)) }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => setOptions({ segments: [...segs, ''] })}><Plus className="h-4 w-4" />Add segment</Button>
    </div>
  )
}

function BowTieEditor({ options, setOptions, correctAnswer, setCorrectAnswer }: any) {
  const o = options || { actions: [''], conditions: [''], parameters: [''] }
  const ans = correctAnswer || { action: 0, condition: 0, parameter: 0 }
  const renderCol = (label: string, key: 'actions' | 'conditions' | 'parameters', ansKey: 'action' | 'condition' | 'parameter') => (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div className="space-y-2">
        {(o[key] || []).map((v: string, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" checked={ans[ansKey] === i} onChange={() => setCorrectAnswer({ ...ans, [ansKey]: i })} />
            <Input value={v} onChange={(e) => { const n = [...(o[key] || [])]; n[i] = e.target.value; setOptions({ ...o, [key]: n }) }} />
            <Button variant="ghost" size="sm" onClick={() => { const n = (o[key] || []).filter((_: any, j: number) => j !== i); setOptions({ ...o, [key]: n }) }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => setOptions({ ...o, [key]: [...(o[key] || []), ''] })}><Plus className="h-4 w-4" />Add</Button>
    </div>
  )
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {renderCol('Actions', 'actions', 'action')}
      {renderCol('Conditions', 'conditions', 'condition')}
      {renderCol('Parameters', 'parameters', 'parameter')}
    </div>
  )
}

function DropDownEditor({ options, setOptions, correctAnswer, setCorrectAnswer }: any) {
  const blanks: string[] = options?.blanks ?? ['']
  const choices: string[][] = options?.choices ?? [['', '']]
  const ans: number[] = Array.isArray(correctAnswer) ? correctAnswer : blanks.map(() => 0)
  return (
    <div className="space-y-3">
      {blanks.map((b, bi) => (
        <Card key={bi} className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Blank {bi + 1}</span>
            <Input value={b} onChange={(e) => { const n = [...blanks]; n[bi] = e.target.value; setOptions({ blanks: n, choices }) }} placeholder="Blank label / placeholder" />
            <Button variant="ghost" size="sm" onClick={() => {
              const nb = blanks.filter((_, j) => j !== bi)
              const nc = choices.filter((_, j) => j !== bi)
              const na = ans.filter((_, j) => j !== bi)
              setOptions({ blanks: nb, choices: nc }); setCorrectAnswer(na)
            }}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="pl-4 space-y-1">
            {(choices[bi] || []).map((c, ci) => (
              <div key={ci} className="flex items-center gap-2">
                <input type="radio" checked={ans[bi] === ci} onChange={() => { const a = [...ans]; a[bi] = ci; setCorrectAnswer(a) }} />
                <Input value={c} onChange={(e) => { const nc = choices.map((row) => [...row]); nc[bi][ci] = e.target.value; setOptions({ blanks, choices: nc }) }} />
                <Button variant="ghost" size="sm" onClick={() => { const nc = choices.map((row) => [...row]); nc[bi] = nc[bi].filter((_, j) => j !== ci); setOptions({ blanks, choices: nc }) }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => { const nc = choices.map((row) => [...row]); nc[bi] = [...(nc[bi] || []), '']; setOptions({ blanks, choices: nc }) }}><Plus className="h-4 w-4" />Add choice</Button>
          </div>
        </Card>
      ))}
      <Button variant="outline" size="sm" onClick={() => { setOptions({ blanks: [...blanks, ''], choices: [...choices, ['', '']] }); setCorrectAnswer([...ans, 0]) }}><Plus className="h-4 w-4" />Add blank</Button>
    </div>
  )
}

function MatrixEditor({ multi, options, setOptions, correctAnswer, setCorrectAnswer }: any) {
  const rows: string[] = options?.rows ?? ['', '']
  const cols: string[] = options?.cols ?? ['', '']
  const ans: any = correctAnswer ?? (multi ? rows.map(() => [] as number[]) : rows.map(() => 0))
  const setRowAns = (ri: number, ci: number) => {
    if (multi) {
      const cur: number[] = Array.isArray(ans[ri]) ? ans[ri] : []
      const next = cur.includes(ci) ? cur.filter((x) => x !== ci) : [...cur, ci].sort((a, b) => a - b)
      const out = [...ans]; out[ri] = next; setCorrectAnswer(out)
    } else {
      const out = [...ans]; out[ri] = ci; setCorrectAnswer(out)
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Row labels</label>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 mt-1">
              <Input value={r} onChange={(e) => { const n = [...rows]; n[i] = e.target.value; setOptions({ rows: n, cols }) }} />
              <Button variant="ghost" size="sm" onClick={() => { const nr = rows.filter((_, j) => j !== i); setOptions({ rows: nr, cols }); setCorrectAnswer((ans as any[]).filter((_, j) => j !== i)) }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => { setOptions({ rows: [...rows, ''], cols }); setCorrectAnswer([...ans, multi ? [] : 0]) }}><Plus className="h-4 w-4" />Add row</Button>
        </div>
        <div>
          <label className="text-xs text-gray-500">Column labels</label>
          {cols.map((c, i) => (
            <div key={i} className="flex items-center gap-2 mt-1">
              <Input value={c} onChange={(e) => { const n = [...cols]; n[i] = e.target.value; setOptions({ rows, cols: n }) }} />
              <Button variant="ghost" size="sm" onClick={() => { const nc = cols.filter((_, j) => j !== i); setOptions({ rows, cols: nc }) }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setOptions({ rows, cols: [...cols, ''] })}><Plus className="h-4 w-4" />Add column</Button>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Correct cells</label>
        <table className="w-full text-xs mt-1">
          <thead><tr><th></th>{cols.map((c, i) => <th key={i} className="px-1 py-1 text-gray-500">{c || `Col ${i + 1}`}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-1 py-1 text-gray-700 dark:text-gray-300">{r || `Row ${ri + 1}`}</td>
                {cols.map((_, ci) => {
                  const checked = multi ? (Array.isArray(ans[ri]) && ans[ri].includes(ci)) : ans[ri] === ci
                  return (
                    <td key={ci} className="px-1 py-1 text-center">
                      <input type={multi ? 'checkbox' : 'radio'} name={`row-${ri}`} checked={checked} onChange={() => setRowAns(ri, ci)} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DragDropEditor({ options, setOptions, correctAnswer, setCorrectAnswer }: any) {
  const items: string[] = options?.items ?? ['', '']
  const targets: string[] = options?.targets ?? ['', '']
  const ans: number[] = Array.isArray(correctAnswer) ? correctAnswer : items.map(() => 0)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Items</label>
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 mt-1">
              <Input value={it} onChange={(e) => { const n = [...items]; n[i] = e.target.value; setOptions({ items: n, targets }) }} />
              <Button variant="ghost" size="sm" onClick={() => { const ni = items.filter((_, j) => j !== i); const na = ans.filter((_, j) => j !== i); setOptions({ items: ni, targets }); setCorrectAnswer(na) }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => { setOptions({ items: [...items, ''], targets }); setCorrectAnswer([...ans, 0]) }}><Plus className="h-4 w-4" />Add item</Button>
        </div>
        <div>
          <label className="text-xs text-gray-500">Targets</label>
          {targets.map((t, i) => (
            <div key={i} className="flex items-center gap-2 mt-1">
              <Input value={t} onChange={(e) => { const n = [...targets]; n[i] = e.target.value; setOptions({ items, targets: n }) }} />
              <Button variant="ghost" size="sm" onClick={() => { const nt = targets.filter((_, j) => j !== i); setOptions({ items, targets: nt }) }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setOptions({ items, targets: [...targets, ''] })}><Plus className="h-4 w-4" />Add target</Button>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Item → Target mapping</label>
        <div className="space-y-1 mt-1">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs flex-1 truncate">{it || `Item ${i + 1}`}</span>
              <Select value={ans[i] ?? 0} onChange={(e) => { const n = [...ans]; n[i] = Number(e.target.value); setCorrectAnswer(n) }}>
                {targets.map((t, j) => <option key={j} value={j}>{t || `Target ${j + 1}`}</option>)}
              </Select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Generator tab ───────────────────────────────────────────────────────────

function GeneratorTab() {
  const [mode, setMode] = useState<'questions' | 'case'>('questions')
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button onClick={() => setMode('questions')} className={`px-4 py-2 rounded text-sm font-medium ${mode === 'questions' ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>Questions</button>
        <button onClick={() => setMode('case')} className={`px-4 py-2 rounded text-sm font-medium ${mode === 'case' ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>Case Study</button>
      </div>
      {mode === 'questions' ? <GenerateQuestionsForm /> : <GenerateCaseStudyForm />}
      <PendingReview />
    </div>
  )
}

function GenerateQuestionsForm() {
  const toast = useNotify()
  const [format, setFormat] = useState<Format>('MCQ')
  const [bank, setBank] = useState<Bank>('CLASSIC')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(5)
  const [customContext, setCustomContext] = useState('')
  const [busy, setBusy] = useState(false)

  // Auto-derive bank from format (NGN formats default to NGN)
  useEffect(() => {
    if (NGN_FORMATS.includes(format)) setBank('NGN')
  }, [format])

  const submit = async () => {
    if (!topic.trim()) return toast.error('Topic is required')
    setBusy(true)
    try {
      const data: any = await apiFetch('/api/nclex/admin/generate-questions', {
        method: 'POST',
        body: JSON.stringify({ format, bank, topic, count, customContext: customContext || undefined }),
      })
      toast.success(`Generated ${data?.count ?? data?.pending?.length ?? 0} pending question(s)`)
      window.dispatchEvent(new CustomEvent('nclex:pending-refresh'))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Generate questions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Format</label>
          <Select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
            {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Bank</label>
          <Select value={bank} onChange={(e) => setBank(e.target.value as Bank)}>
            <option value="CLASSIC">CLASSIC</option>
            <option value="NGN">NGN</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Topic</label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Hypoglycemia, Sepsis…" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Count (1–50)</label>
          <Input type="number" min="1" max="50" value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Custom context (optional)</label>
          <Textarea rows={3} value={customContext} onChange={(e) => setCustomContext(e.target.value)} placeholder="Extra instructions for the model…" />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={submit} disabled={busy} className="bg-primary-600 hover:bg-primary-700 text-white">
          <Sparkles className="h-4 w-4 mr-1" /> {busy ? 'Generating…' : 'Generate'}
        </Button>
      </div>
    </Card>
  )
}

function GenerateCaseStudyForm() {
  const toast = useNotify()
  const [caseType, setCaseType] = useState<'UNFOLDING' | 'STANDALONE'>('UNFOLDING')
  const [topic, setTopic] = useState('')
  const [formats, setFormats] = useState<Format[]>(['SATA', 'BOW_TIE', 'DROP_DOWN', 'MATRIX_MCQ'])
  const [customContext, setCustomContext] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (f: Format) => setFormats((cur) => cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f])

  const submit = async () => {
    if (!topic.trim()) return toast.error('Topic is required')
    if (formats.length === 0) return toast.error('Pick at least one question format')
    setBusy(true)
    try {
      const data: any = await apiFetch('/api/nclex/admin/generate-case-study', {
        method: 'POST',
        body: JSON.stringify({ caseType, topic, formats, customContext: customContext || undefined }),
      })
      toast.success(`Generated case study "${data?.caseStudy?.title || topic}"`)
      window.dispatchEvent(new CustomEvent('nclex:pending-refresh'))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Generate case study</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Case type</label>
          <Select value={caseType} onChange={(e) => setCaseType(e.target.value as any)}>
            <option value="UNFOLDING">Unfolding</option>
            <option value="STANDALONE">Standalone</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Topic</label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Post-op care after appendectomy…" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Question formats</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {FORMATS.map((f) => (
              <button
                key={f}
                onClick={() => toggle(f)}
                className={`px-3 py-1 rounded-full text-xs border ${formats.includes(f) ? 'bg-primary-600 hover:bg-primary-700 text-white border-transparent' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700'}`}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Custom context (optional)</label>
          <Textarea rows={3} value={customContext} onChange={(e) => setCustomContext(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={submit} disabled={busy} className="bg-primary-600 hover:bg-primary-700 text-white">
          <Sparkles className="h-4 w-4 mr-1" /> {busy ? 'Generating…' : 'Generate case study'}
        </Button>
      </div>
    </Card>
  )
}

function PendingReview() {
  const [sub, setSub] = useState<'questions' | 'cases'>('questions')
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Pending review</h3>
        <button onClick={() => setSub('questions')} className={`px-3 py-1 rounded text-xs ${sub === 'questions' ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700'}`}>Questions</button>
        <button onClick={() => setSub('cases')} className={`px-3 py-1 rounded text-xs ${sub === 'cases' ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700'}`}>Case Studies</button>
      </div>
      {sub === 'questions' ? <PendingQuestions /> : <PendingCaseStudies />}
    </Card>
  )
}

function PendingQuestions() {
  const toast = useNotify()
  const [list, setList] = useState<any[]>([])
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (status) qs.set('status', status)
      qs.set('limit', '50')
      const data: any = await apiFetch(`/api/nclex/admin/pending-questions?${qs}`)
      setList(data.pending || [])
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [status, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const h = () => load()
    window.addEventListener('nclex:pending-refresh', h)
    return () => window.removeEventListener('nclex:pending-refresh', h)
  }, [load])

  const togglePick = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const approve = async (id: string) => { try { await apiFetch(`/api/nclex/admin/pending-questions/${id}/approve`, { method: 'POST' }); toast.success('Approved'); load() } catch (e: any) { toast.error(e.message) } }
  const reject = async (id: string) => {
    const note = prompt('Rejection note (optional):') || undefined
    try { await apiFetch(`/api/nclex/admin/pending-questions/${id}/reject`, { method: 'POST', body: JSON.stringify({ rejectionNote: note }) }); toast.success('Rejected'); load() } catch (e: any) { toast.error(e.message) }
  }
  const remove = async (id: string) => { if (!confirm('Delete this pending question?')) return; try { await apiFetch(`/api/nclex/admin/pending-questions/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load() } catch (e: any) { toast.error(e.message) } }
  const bulkApprove = async () => {
    const ids = [...picked]
    if (!ids.length) return
    try { await apiFetch('/api/nclex/admin/pending-questions/bulk-approve', { method: 'POST', body: JSON.stringify({ ids }) }); toast.success(`Approved ${ids.length}`); setPicked(new Set()); load() } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </Select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        {picked.size > 0 && <Button onClick={bulkApprove} className="bg-primary-600 hover:bg-primary-700 text-white">Bulk approve ({picked.size})</Button>}
      </div>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {!loading && list.length === 0 && <div className="text-sm text-gray-500">Nothing pending.</div>}
      <div className="space-y-2">
        {list.map((p) => (
          <Card key={p.id} className="p-3">
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => togglePick(p.id)} className="mt-1" disabled={p.status !== 'PENDING'} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <StatusPill status={p.status} />
                  <Badge>{p.bank}</Badge>
                  <Badge>{FORMAT_LABELS[p.format as Format] || p.format}</Badge>
                  <span className="text-gray-400">batch {p.generationBatch?.slice(0, 8)} · {new Date(p.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">{p.stem}</p>
                {expanded === p.id && (
                  <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto">
{JSON.stringify({ options: p.options, correctAnswer: p.correctAnswer, rationale: p.rationale }, null, 2)}
                  </pre>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    {expanded === p.id ? 'Hide' : 'Preview'}
                  </Button>
                  {p.status === 'PENDING' && <>
                    <Button size="sm" onClick={() => approve(p.id)} className="bg-primary-600 hover:bg-primary-700 text-white"><Check className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => reject(p.id)}><X className="h-4 w-4" /></Button>
                  </>}
                  <Button variant="ghost" size="sm" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function PendingCaseStudies() {
  const toast = useNotify()
  const [list, setList] = useState<any[]>([])
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<Record<string, any>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (status) qs.set('status', status)
      const data: any = await apiFetch(`/api/nclex/admin/pending-case-studies?${qs}`)
      setList(data.pending || [])
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [status, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const h = () => load()
    window.addEventListener('nclex:pending-refresh', h)
    return () => window.removeEventListener('nclex:pending-refresh', h)
  }, [load])

  const expand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!expandedDetail[id]) {
      try {
        const data: any = await apiFetch(`/api/nclex/admin/pending-case-studies/${id}`)
        setExpandedDetail((s) => ({ ...s, [id]: data }))
      } catch (e: any) { toast.error(e.message) }
    }
  }

  const approve = async (id: string) => { try { await apiFetch(`/api/nclex/admin/pending-case-studies/${id}/approve`, { method: 'POST' }); toast.success('Approved'); load() } catch (e: any) { toast.error(e.message) } }
  const reject = async (id: string) => {
    const note = prompt('Rejection note (optional):') || undefined
    try { await apiFetch(`/api/nclex/admin/pending-case-studies/${id}/reject`, { method: 'POST', body: JSON.stringify({ rejectionNote: note }) }); toast.success('Rejected'); load() } catch (e: any) { toast.error(e.message) }
  }
  const remove = async (id: string) => { if (!confirm('Delete this pending case study?')) return; try { await apiFetch(`/api/nclex/admin/pending-case-studies/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load() } catch (e: any) { toast.error(e.message) } }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </Select>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {!loading && list.length === 0 && <div className="text-sm text-gray-500">Nothing pending.</div>}
      <div className="space-y-2">
        {list.map((p) => (
          <Card key={p.id} className="p-3">
            <div className="flex items-center gap-2 text-xs">
              <StatusPill status={p.status} />
              <Badge>{p.caseType}</Badge>
              <span className="text-gray-400">batch {p.generationBatch?.slice(0, 8)} · {new Date(p.createdAt).toLocaleString()}</span>
            </div>
            <h4 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{p.title}</h4>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{p.scenario}</p>
            {expanded === p.id && expandedDetail[p.id] && (
              <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto max-h-80">
{JSON.stringify(expandedDetail[p.id], null, 2)}
              </pre>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => expand(p.id)}>{expanded === p.id ? 'Hide' : 'Preview'}</Button>
              {p.status === 'PENDING' && <>
                <Button size="sm" onClick={() => approve(p.id)} className="bg-primary-600 hover:bg-primary-700 text-white"><Check className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => reject(p.id)}><X className="h-4 w-4" /></Button>
              </>}
              <Button variant="ghost" size="sm" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  }
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${map[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>
}

// ─── Cases tab ───────────────────────────────────────────────────────────────

function CasesTab() {
  const toast = useNotify()
  const [list, setList] = useState<CaseStudy[]>([])
  const [search, setSearch] = useState('')
  const [caseType, setCaseType] = useState<'' | 'UNFOLDING' | 'STANDALONE'>('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<CaseStudy | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (search) qs.set('search', search)
      if (caseType) qs.set('caseType', caseType)
      const data: any = await apiFetch(`/api/nclex/admin/case-studies?${qs}`)
      setList(data.caseStudies || data.items || data || [])
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, caseType, toast])

  useEffect(() => { load() }, [load])

  const remove = async (id: string) => {
    if (!confirm('Delete this case study?')) return
    try { await apiFetch(`/api/nclex/admin/case-studies/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load() } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500">Search</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="title or scenario…" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Type</label>
          <Select value={caseType} onChange={(e) => setCaseType(e.target.value as any)}>
            <option value="">All</option>
            <option value="UNFOLDING">Unfolding</option>
            <option value="STANDALONE">Standalone</option>
          </Select>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        <Button onClick={() => { setEditing(null); setShowEditor(true) }} className="bg-primary-600 hover:bg-primary-700 text-white"><Plus className="h-4 w-4 mr-1" />New case</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading && <div className="text-gray-500">Loading…</div>}
        {!loading && list.length === 0 && <div className="text-gray-500">No case studies.</div>}
        {list.map((cs) => (
          <Card key={cs.id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge>{cs.caseType}</Badge>
              <span className="text-xs text-gray-500">{cs.questions?.length ?? 0} questions</span>
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white">{cs.title}</h4>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{cs.scenario}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(cs); setShowEditor(true) }}><Edit2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => remove(cs.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          </Card>
        ))}
      </div>
      {showEditor && <CaseStudyEditorModal cs={editing} onClose={() => setShowEditor(false)} onSaved={() => { setShowEditor(false); load() }} />}
    </div>
  )
}

function CaseStudyEditorModal({ cs, onClose, onSaved }: { cs: CaseStudy | null; onClose: () => void; onSaved: () => void }) {
  const toast = useNotify()
  const isEdit = !!cs
  const [title, setTitle] = useState(cs?.title ?? '')
  const [scenario, setScenario] = useState(cs?.scenario ?? '')
  const [caseType, setCaseType] = useState<'UNFOLDING' | 'STANDALONE'>(cs?.caseType ?? 'UNFOLDING')
  const [tabs, setTabs] = useState<{ label: string; content: string }[]>(cs?.tabs ?? [{ label: '', content: '' }])
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const body = { title, scenario, caseType, tabs, questions: [] }
      if (isEdit) {
        await apiFetch(`/api/nclex/admin/case-studies/${cs!.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiFetch('/api/nclex/admin/case-studies', { method: 'POST', body: JSON.stringify(body) })
      }
      toast.success('Saved')
      onSaved()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit case study' : 'New case study'} size="lg">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Type</label>
          <Select value={caseType} onChange={(e) => setCaseType(e.target.value as any)}>
            <option value="UNFOLDING">Unfolding</option>
            <option value="STANDALONE">Standalone</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Scenario</label>
          <Textarea rows={5} value={scenario} onChange={(e) => setScenario(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Chart tabs</label>
          <div className="space-y-2">
            {tabs.map((t, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={t.label} onChange={(e) => { const n = [...tabs]; n[i] = { ...n[i], label: e.target.value }; setTabs(n) }} placeholder="Tab label (e.g. Vital Signs)" />
                  <Button variant="ghost" size="sm" onClick={() => setTabs(tabs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
                <Textarea rows={4} value={t.content} onChange={(e) => { const n = [...tabs]; n[i] = { ...n[i], content: e.target.value }; setTabs(n) }} placeholder="Tab content" />
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={() => setTabs([...tabs, { label: '', content: '' }])}><Plus className="h-4 w-4" />Add tab</Button>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-primary-600 hover:bg-primary-700 text-white">{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </Modal>
  )
}

// ─── Exit Access tab ─────────────────────────────────────────────────────────

function AccessTab() {
  const toast = useNotify()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [grantUserId, setGrantUserId] = useState('')
  const [grantRef, setGrantRef] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data: any = await apiFetch('/api/nclex/admin/exit-access')
      setList(data.exitAccess || data.items || data || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const grant = async () => {
    if (!grantUserId) return toast.error('User ID required')
    try { await apiFetch(`/api/nclex/admin/grant-exit/${grantUserId}`, { method: 'POST', body: JSON.stringify({ paymentRef: grantRef || undefined }) }); toast.success('Granted'); setGrantUserId(''); setGrantRef(''); load() } catch (e: any) { toast.error(e.message) }
  }
  const revoke = async (userId: string) => {
    if (!confirm('Revoke exit-exam access for this user?')) return
    try { await apiFetch(`/api/nclex/admin/revoke-exit/${userId}`, { method: 'DELETE' }); toast.success('Revoked'); load() } catch (e: any) { toast.error(e.message) }
  }

  const filtered = list.filter((r: any) => {
    if (!search) return true
    const u = r.user || {}
    const blob = `${u.email || ''} ${u.first_name || ''} ${u.last_name || ''} ${r.userId || ''}`.toLowerCase()
    return blob.includes(search.toLowerCase())
  })

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-gray-500">Grant to user ID</label>
          <Input value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} placeholder="user ID…" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-gray-500">Payment ref (optional)</label>
          <Input value={grantRef} onChange={(e) => setGrantRef(e.target.value)} />
        </div>
        <Button onClick={grant} className="bg-primary-600 hover:bg-primary-700 text-white"><Plus className="h-4 w-4 mr-1" />Grant</Button>
      </Card>
      <div className="flex items-center gap-2">
        <div className="flex-1"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search granted users…" /></div>
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs text-gray-500 uppercase">
            <tr><th className="px-4 py-2">User</th><th className="px-4 py-2">Granted</th><th className="px-4 py-2">Payment ref</th><th className="px-4 py-2 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No exit access granted.</td></tr>}
            {filtered.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-2"><div className="font-medium">{r.user?.first_name} {r.user?.last_name}</div><div className="text-xs text-gray-500">{r.user?.email || r.userId}</div></td>
                <td className="px-4 py-2 text-xs">{new Date(r.grantedAt).toLocaleString()}</td>
                <td className="px-4 py-2 text-xs">{r.paymentRef || '—'}</td>
                <td className="px-4 py-2 text-right"><Button variant="ghost" size="sm" onClick={() => revoke(r.userId)}><Trash2 className="h-4 w-4 text-red-500" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ─── Subscriptions tab ──────────────────────────────────────────────────────

const SPECIAL_ACCESS_KEYS = ['live_lectures', 'cheat_sheets', 'week_of_exam'] as const

function SubscriptionsTab() {
  return (
    <div className="space-y-6">
      <UpgradeRequests />
      <ProfilesList />
    </div>
  )
}

function UpgradeRequests() {
  const toast = useNotify()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data: any = await apiFetch('/api/nclex/admin/upgrade-requests')
      setList(data.requests || data.profiles || data.items || data || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const approve = async (uid: string) => { try { await apiFetch(`/api/nclex/admin/approve-upgrade/${uid}`, { method: 'POST' }); toast.success('Approved'); load() } catch (e: any) { toast.error(e.message) } }
  const reject = async (uid: string) => { try { await apiFetch(`/api/nclex/admin/reject-upgrade/${uid}`, { method: 'POST' }); toast.success('Rejected'); load() } catch (e: any) { toast.error(e.message) } }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Upgrade requests</h3>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading && <div className="text-gray-500 text-sm">Loading…</div>}
      {!loading && list.length === 0 && <div className="text-gray-500 text-sm">No pending upgrade requests.</div>}
      <div className="space-y-2">
        {list.map((r: any) => {
          const userId = r.userId || r.user_id
          return (
            <div key={r.id || userId} className="p-3 rounded border border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-medium">{r.user?.first_name || ''} {r.user?.last_name || ''}</div>
                <div className="text-xs text-gray-500">{r.user?.email || userId}</div>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                <div>Method: {r.upgradePaymentMethod || '—'}</div>
                <div>Ref: {r.upgradePaymentRef || '—'}</div>
              </div>
              {r.upgradeReceiptPath && (
                <a className="text-xs text-blue-600 hover:underline flex items-center gap-1" href={`/api/storage/file?path=${encodeURIComponent(r.upgradeReceiptPath)}&t=${getToken()}`} target="_blank" rel="noreferrer">
                  Receipt <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="flex gap-1">
                <Button size="sm" onClick={() => approve(userId)} className="bg-primary-600 hover:bg-primary-700 text-white"><Check className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => reject(userId)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function ProfilesList() {
  const toast = useNotify()
  const [list, setList] = useState<any[]>([])
  const [tier, setTier] = useState<'' | 'FREE' | 'PREMIUM'>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (tier) qs.set('tier', tier)
      if (search) qs.set('search', search)
      const data: any = await apiFetch(`/api/nclex/admin/profiles?${qs}`)
      setList(data.profiles || data.items || data || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }, [tier, search, toast])

  useEffect(() => { load() }, [load])

  const toggleAccess = async (uid: string, resource: string, has: boolean) => {
    try {
      if (has) {
        await apiFetch(`/api/nclex/admin/special-access/${uid}`, { method: 'DELETE', body: JSON.stringify({ resource }) })
      } else {
        await apiFetch(`/api/nclex/admin/special-access/${uid}`, { method: 'POST', body: JSON.stringify({ resource }) })
      }
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">All profiles</h3>
        <Select value={tier} onChange={(e) => setTier(e.target.value as any)}>
          <option value="">All tiers</option>
          <option value="FREE">FREE</option>
          <option value="PREMIUM">PREMIUM</option>
        </Select>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search…" className="w-48" />
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Tier</th>
              {SPECIAL_ACCESS_KEYS.map((k) => <th key={k} className="px-3 py-2">{k.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && <tr><td colSpan={2 + SPECIAL_ACCESS_KEYS.length} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={2 + SPECIAL_ACCESS_KEYS.length} className="px-3 py-8 text-center text-gray-500">No profiles.</td></tr>}
            {list.map((p: any) => {
              const uid = p.userId || p.user_id
              const access: string[] = Array.isArray(p.specialAccess) ? p.specialAccess : []
              return (
                <tr key={p.id || uid}>
                  <td className="px-3 py-2"><div className="font-medium">{p.user?.first_name} {p.user?.last_name}</div><div className="text-xs text-gray-500">{p.user?.email || uid}</div></td>
                  <td className="px-3 py-2"><Badge>{p.tier || 'FREE'}</Badge></td>
                  {SPECIAL_ACCESS_KEYS.map((k) => {
                    const has = access.includes(k)
                    return (
                      <td key={k} className="px-3 py-2">
                        <button onClick={() => toggleAccess(uid, k, has)} className={`px-2 py-1 rounded text-xs ${has ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>
                          {has ? 'ON' : 'OFF'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ─── Plans tab ───────────────────────────────────────────────────────────────

function PlansTab() {
  const toast = useNotify()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [paymentInstructions, setPaymentInstructions] = useState('')
  const [gcashNumber, setGcashNumber] = useState('')
  const [gcashName, setGcashName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch('/api/nclex/admin/subscription-plans')
      .then((data: any) => {
        setPlans(data.plans || [])
        setPaymentInstructions(data.paymentInstructions || '')
        setGcashNumber(data.gcashNumber || '')
        setGcashName(data.gcashName || '')
      })
      .catch((e: any) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [toast])

  const save = async () => {
    setSaving(true)
    try {
      await apiFetch('/api/nclex/admin/subscription-plans', {
        method: 'PUT',
        body: JSON.stringify({ plans, paymentInstructions, gcashNumber, gcashName }),
      })
      toast.success('Saved')
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  const setPlan = (i: number, patch: Partial<SubscriptionPlan>) => {
    setPlans((prev) => { const n = [...prev]; n[i] = { ...n[i], ...patch }; return n })
  }
  const movePlan = (i: number, dir: -1 | 1) => {
    setPlans((prev) => { const n = [...prev]; const t = i + dir; if (t < 0 || t >= n.length) return prev; [n[i], n[t]] = [n[t], n[i]]; return n })
  }
  const addPlan = () => setPlans((prev) => [...prev, {
    id: crypto.randomUUID(), name: 'New Plan', price: 0, durationDays: 30, currency: 'PHP',
    description: '', features: [], isPopular: false, isActive: true,
  }])
  const removePlan = (i: number) => setPlans((prev) => prev.filter((_, j) => j !== i))

  if (loading) return <div className="text-gray-500">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Plans</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addPlan}><Plus className="h-4 w-4" />Add plan</Button>
          <Button onClick={save} disabled={saving} className="bg-primary-600 hover:bg-primary-700 text-white">{saving ? 'Saving…' : 'Save all'}</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map((p, i) => (
          <Card key={p.id || i} className="p-4 space-y-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => movePlan(i, -1)}><ChevronUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => movePlan(i, 1)}><ChevronDown className="h-4 w-4" /></Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => removePlan(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
            <Input value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} placeholder="Plan name" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" value={p.price} onChange={(e) => setPlan(i, { price: Number(e.target.value) })} placeholder="Price" />
              <Input value={p.currency} onChange={(e) => setPlan(i, { currency: e.target.value })} placeholder="PHP" />
              <Input type="number" value={p.durationDays ?? 0} onChange={(e) => setPlan(i, { durationDays: Number(e.target.value) || null })} placeholder="Days (0 = lifetime)" />
            </div>
            <Textarea rows={2} value={p.description} onChange={(e) => setPlan(i, { description: e.target.value })} placeholder="Description" />
            <div>
              <label className="text-xs text-gray-500">Features</label>
              <div className="space-y-1">
                {(p.features || []).map((f, fi) => (
                  <div key={fi} className="flex items-center gap-2">
                    <input type="checkbox" checked={f.included} onChange={(e) => { const fs = [...p.features]; fs[fi] = { ...fs[fi], included: e.target.checked }; setPlan(i, { features: fs }) }} />
                    <Input value={f.name} onChange={(e) => { const fs = [...p.features]; fs[fi] = { ...fs[fi], name: e.target.value }; setPlan(i, { features: fs }) }} />
                    <Button variant="ghost" size="sm" onClick={() => setPlan(i, { features: p.features.filter((_, k) => k !== fi) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setPlan(i, { features: [...(p.features || []), { name: '', included: true }] })}><Plus className="h-4 w-4" />Add feature</Button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={p.isPopular} onChange={(e) => setPlan(i, { isPopular: e.target.checked })} /> Popular</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={p.isActive} onChange={(e) => setPlan(i, { isActive: e.target.checked })} /> Active</label>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">GCash payment instructions</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input value={gcashName} onChange={(e) => setGcashName(e.target.value)} placeholder="GCash account name" />
          <Input value={gcashNumber} onChange={(e) => setGcashNumber(e.target.value)} placeholder="GCash number" />
        </div>
        <Textarea rows={4} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} placeholder="Instructions shown on the upgrade form…" />
      </Card>
    </div>
  )
}

// ─── Videos tab ──────────────────────────────────────────────────────────────

function VideosTab() {
  const toast = useNotify()
  const [videos, setVideos] = useState<NclexVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const dragIdx = useRef<number | null>(null)

  useEffect(() => {
    apiFetch('/api/nclex/videos').then((data: any) => setVideos((data.videos || []).sort((a: NclexVideo, b: NclexVideo) => a.order - b.order))).catch((e: any) => toast.error(e.message)).finally(() => setLoading(false))
  }, [toast])

  const save = async () => {
    setSaving(true)
    try {
      const normalized = videos.map((v, i) => ({ ...v, order: i }))
      await apiFetch('/api/nclex/admin/videos', { method: 'PUT', body: JSON.stringify({ videos: normalized }) })
      toast.success('Saved')
      setVideos(normalized)
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }
  const setVideo = (i: number, patch: Partial<NclexVideo>) => setVideos((prev) => { const n = [...prev]; n[i] = { ...n[i], ...patch }; return n })
  const add = () => setVideos((prev) => [...prev, { id: crypto.randomUUID(), title: '', description: '', videoUrl: '', thumbnailUrl: '', duration: '', order: prev.length, isPublished: false, topic: '' }])
  const remove = (i: number) => setVideos((prev) => prev.filter((_, j) => j !== i))
  const onDragStart = (i: number) => { dragIdx.current = i }
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); if (dragIdx.current === null || dragIdx.current === i) return; setVideos((prev) => { const n = [...prev]; const [m] = n.splice(dragIdx.current!, 1); n.splice(i, 0, m); dragIdx.current = i; return n }) }
  const onDragEnd = () => { dragIdx.current = null }

  if (loading) return <div className="text-gray-500">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Lecture videos</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={add}><Plus className="h-4 w-4" />Add video</Button>
          <Button onClick={save} disabled={saving} className="bg-primary-600 hover:bg-primary-700 text-white">{saving ? 'Saving…' : 'Save all'}</Button>
        </div>
      </div>
      <div className="space-y-2">
        {videos.map((v, i) => (
          <Card
            key={v.id || i}
            className="p-3 flex gap-3 items-start"
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDragEnd={onDragEnd}
          >
            <div className="pt-2 cursor-grab text-gray-400"><GripVertical className="h-5 w-5" /></div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input value={v.title} onChange={(e) => setVideo(i, { title: e.target.value })} placeholder="Title" />
              <Input value={v.topic} onChange={(e) => setVideo(i, { topic: e.target.value })} placeholder="Topic" />
              <Input value={v.videoUrl} onChange={(e) => setVideo(i, { videoUrl: e.target.value })} placeholder="Video URL" />
              <Input value={v.thumbnailUrl} onChange={(e) => setVideo(i, { thumbnailUrl: e.target.value })} placeholder="Thumbnail URL" />
              <Input value={v.duration} onChange={(e) => setVideo(i, { duration: e.target.value })} placeholder="Duration (e.g. 12:34)" />
              <Textarea rows={2} value={v.description} onChange={(e) => setVideo(i, { description: e.target.value })} placeholder="Description" className="md:col-span-2" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={v.isPublished} onChange={(e) => setVideo(i, { isPublished: e.target.checked })} /> Published</label>
              <Button variant="ghost" size="sm" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Testimonials tab ───────────────────────────────────────────────────────

function TestimonialsTab() {
  const toast = useNotify()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data: any = await apiFetch('/api/nclex/admin/pending-testimonials')
      setList(data.testimonials || data.items || data || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const approve = async (id: string) => {
    try { await apiFetch(`/api/nclex/admin/approve-testimonial/${id}`, { method: 'POST' }); toast.success('Approved'); load() } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Pending testimonials</h2>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading && <div className="text-gray-500">Loading…</div>}
      {!loading && list.length === 0 && <div className="text-gray-500">No pending testimonials.</div>}
      <div className="space-y-2">
        {list.map((t) => (
          <Card key={t.id} className="p-4 flex items-start gap-3">
            <div className="flex items-center gap-1 text-amber-500">
              {Array.from({ length: t.rating || 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100">{t.content}</p>
              <p className="mt-1 text-xs text-gray-500">— {t.clientName}</p>
            </div>
            <Button size="sm" onClick={() => approve(t.id)} className="bg-primary-600 hover:bg-primary-700 text-white"><Check className="h-4 w-4 mr-1" />Approve</Button>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default AdminNclex
