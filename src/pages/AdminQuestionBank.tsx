import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import {
  BookOpen, Plus, Search, Edit, Trash2, Tag, BarChart2,
  ChevronLeft, ChevronRight, Filter, RefreshCw, CheckCircle, XCircle,
} from 'lucide-react'

const CONTENT_AREA_LABELS: Record<string, string> = {
  safe_effective_care_environment: 'Safe & Effective Care',
  health_promotion_and_maintenance: 'Health Promotion',
  psychosocial_integrity: 'Psychosocial Integrity',
  physiological_integrity: 'Physiological Integrity',
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  traditional_mcq: 'Traditional MCQ',
  ngn_sata: 'NGN – Select All',
  ngn_cloze: 'NGN – Cloze',
  ngn_matrix: 'NGN – Matrix',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

interface Question {
  id: number
  question_text: string
  question_type: string
  content_area: string
  subcategory?: string
  difficulty: string
  cognitive_level: string
  is_ngn: boolean
  options: any
  correct_answer: any
  rationale?: string
  tags: string[]
  is_active: boolean
  created_at: string
}

const EMPTY_FORM = {
  question_text: '',
  question_type: 'traditional_mcq',
  content_area: 'safe_effective_care_environment',
  subcategory: '',
  difficulty: 'medium',
  cognitive_level: 'apply',
  is_ngn: false,
  rationale: '',
  tags: '',
  options: [
    { id: 'a', text: '', is_correct: false },
    { id: 'b', text: '', is_correct: false },
    { id: 'c', text: '', is_correct: false },
    { id: 'd', text: '', is_correct: false },
  ],
  cloze_stem: '',
  cloze_blanks: [
    { id: 1, choices: ['', '', ''], correct: '' },
  ],
  matrix_rows: ['', ''],
  matrix_columns: ['', ''],
  matrix_correct_cells: [] as number[][],
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

export function AdminQuestionBank() {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()

  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [stats, setStats] = useState<any>(null)

  const [filterContentArea, setFilterContentArea] = useState('all')
  const [filterDifficulty, setFilterDifficulty] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterNGN, setFilterNGN] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null)

  useEffect(() => {
    if (isAdmin()) {
      fetchQuestions()
      fetchStats()
    }
  }, [page, filterContentArea, filterDifficulty, filterType, filterNGN, searchQuery])

  async function fetchQuestions() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        active_only: 'false',
      })
      if (filterContentArea !== 'all') params.set('content_area', filterContentArea)
      if (filterDifficulty !== 'all') params.set('difficulty', filterDifficulty)
      if (filterType !== 'all') params.set('question_type', filterType)
      if (filterNGN !== 'all') params.set('is_ngn', filterNGN === 'ngn' ? 'true' : 'false')
      if (searchQuery) params.set('search', searchQuery)

      const data = await apiFetch(`/api/questions?${params}`)
      setQuestions(data.questions)
      setTotal(data.total)
      setPages(data.pages)
    } catch (e: any) {
      showToast('Failed to load questions', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchStats() {
    try {
      const data = await apiFetch('/api/questions/stats')
      setStats(data)
    } catch {}
  }

  function openAddModal() {
    setEditingQuestion(null)
    setForm({ ...EMPTY_FORM })
    setTagInput('')
    setShowModal(true)
  }

  function openEditModal(q: Question) {
    setEditingQuestion(q)
    const opts = Array.isArray(q.options) ? q.options : []
    const clozeOpts = q.options?.blanks || [{ id: 1, choices: ['', '', ''], correct: '' }]
    setTagInput('')
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      content_area: q.content_area,
      subcategory: q.subcategory || '',
      difficulty: q.difficulty,
      cognitive_level: q.cognitive_level,
      is_ngn: q.is_ngn,
      rationale: q.rationale || '',
      tags: (q.tags || []).join(', '),
      options:
        q.question_type === 'traditional_mcq' || q.question_type === 'ngn_sata'
          ? opts.length >= 4
            ? opts
            : [...opts, ...EMPTY_FORM.options].slice(0, Math.max(opts.length, 4))
          : EMPTY_FORM.options,
      cloze_stem: q.options?.stem || '',
      cloze_blanks: clozeOpts,
      matrix_rows: q.options?.rows || ['', ''],
      matrix_columns: q.options?.columns || ['', ''],
      matrix_correct_cells: q.correct_answer?.cells || [],
    })
    setShowModal(true)
  }

  function parsedTags(): string[] {
    return form.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
  }

  function addTagFromInput() {
    const parts = tagInput.split(',').map((t: string) => t.trim()).filter(Boolean)
    if (parts.length === 0) return
    const existing = parsedTags()
    const existingLower = existing.map((t: string) => t.toLowerCase())
    const toAdd = parts.filter((t: string) => !existingLower.includes(t.toLowerCase()))
    if (toAdd.length > 0) {
      setForm(f => ({ ...f, tags: [...existing, ...toAdd].join(', ') }))
    }
    setTagInput('')
  }

  function removeTag(index: number) {
    const updated = parsedTags().filter((_, i) => i !== index)
    setForm(f => ({ ...f, tags: updated.join(', ') }))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTagFromInput()
    } else if (e.key === 'Backspace' && tagInput === '') {
      const tags = parsedTags()
      if (tags.length > 0) removeTag(tags.length - 1)
    }
  }

  async function handleSave() {
    if (!form.question_text.trim()) {
      showToast('Question text is required', 'error')
      return
    }

    setSaving(true)
    try {
      let options: any = []
      let correct_answer: any = null

      if (form.question_type === 'traditional_mcq') {
        options = form.options
        const correct = form.options.find((o: any) => o.is_correct)
        correct_answer = { type: 'single', value: correct?.id || '' }
      } else if (form.question_type === 'ngn_sata') {
        options = form.options
        const correctVals = form.options.filter((o: any) => o.is_correct).map((o: any) => o.id)
        correct_answer = { type: 'multiple', values: correctVals }
      } else if (form.question_type === 'ngn_cloze') {
        options = { stem: form.cloze_stem, blanks: form.cloze_blanks }
        const values: Record<string, string> = {}
        form.cloze_blanks.forEach((b: any) => { values[String(b.id)] = b.correct })
        correct_answer = { type: 'cloze', values }
      } else if (form.question_type === 'ngn_matrix') {
        options = {
          rows: form.matrix_rows.filter(Boolean),
          columns: form.matrix_columns.filter(Boolean),
        }
        correct_answer = { type: 'matrix', cells: form.matrix_correct_cells }
      }

      const payload = {
        question_text: form.question_text,
        question_type: form.question_type,
        content_area: form.content_area,
        subcategory: form.subcategory || null,
        difficulty: form.difficulty,
        cognitive_level: form.cognitive_level,
        is_ngn: form.question_type.startsWith('ngn_'),
        options,
        correct_answer,
        rationale: form.rationale || null,
        tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      }

      if (editingQuestion) {
        await apiFetch(`/api/questions/${editingQuestion.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        showToast('Question updated', 'success')
      } else {
        await apiFetch('/api/questions', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        showToast('Question added', 'success')
      }

      setShowModal(false)
      fetchQuestions()
      fetchStats()
    } catch (e: any) {
      showToast(e.message || 'Failed to save question', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(q: Question) {
    setQuestionToDelete(q)
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!questionToDelete) return
    setDeletingId(questionToDelete.id)
    try {
      await apiFetch(`/api/questions/${questionToDelete.id}`, { method: 'DELETE' })
      showToast('Question deleted', 'success')
      fetchQuestions()
      fetchStats()
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', 'error')
    } finally {
      setDeletingId(null)
      setShowDeleteConfirm(false)
      setQuestionToDelete(null)
    }
  }

  async function toggleActive(q: Question) {
    try {
      await apiFetch(`/api/questions/${q.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !q.is_active }),
      })
      fetchQuestions()
      fetchStats()
    } catch (e: any) {
      showToast(e.message || 'Failed to update', 'error')
    }
  }

  function updateOption(index: number, field: string, value: any) {
    const newOpts = [...form.options]
    if (field === 'is_correct' && form.question_type === 'traditional_mcq') {
      newOpts.forEach((o: any) => (o.is_correct = false))
    }
    newOpts[index] = { ...newOpts[index], [field]: value }
    setForm((f) => ({ ...f, options: newOpts }))
  }

  function addOption() {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const id = ids[form.options.length] || String.fromCharCode(97 + form.options.length)
    setForm((f) => ({ ...f, options: [...f.options, { id, text: '', is_correct: false }] }))
  }

  function removeOption(index: number) {
    if (form.options.length <= 2) return
    const newOpts = form.options.filter((_: any, i: number) => i !== index)
    setForm((f) => ({ ...f, options: newOpts }))
  }

  function addClozeBlank() {
    const newBlanks = [...form.cloze_blanks, { id: form.cloze_blanks.length + 1, choices: ['', '', ''], correct: '' }]
    setForm((f) => ({ ...f, cloze_blanks: newBlanks }))
  }

  function updateClozeBlank(index: number, field: string, value: any) {
    const blanks = [...form.cloze_blanks]
    blanks[index] = { ...blanks[index], [field]: value }
    setForm((f) => ({ ...f, cloze_blanks: blanks }))
  }

  function updateClozeChoice(blankIdx: number, choiceIdx: number, value: string) {
    const blanks = [...form.cloze_blanks]
    const choices = [...blanks[blankIdx].choices]
    choices[choiceIdx] = value
    blanks[blankIdx] = { ...blanks[blankIdx], choices }
    setForm((f) => ({ ...f, cloze_blanks: blanks }))
  }

  function toggleMatrixCell(row: number, col: number) {
    const cells = form.matrix_correct_cells
    const key = `${row},${col}`
    const exists = cells.some((c: number[]) => c[0] === row && c[1] === col)
    const newCells = exists
      ? cells.filter((c: number[]) => !(c[0] === row && c[1] === col))
      : [...cells, [row, col]]
    setForm((f) => ({ ...f, matrix_correct_cells: newCells }))
  }

  if (!isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Access denied</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Question Bank</h1>
              <span className="bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 px-2 py-0.5 rounded-full text-sm font-medium">
                {total} questions
              </span>
            </div>
            <Button onClick={openAddModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <div className="text-2xl font-bold text-primary-600">{stats.total}</div>
                <div className="text-sm text-gray-500">Active Questions</div>
              </Card>
              {stats.by_type?.slice(0, 3).map((t: any) => (
                <Card key={t.question_type} className="p-4 text-center">
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{t.count}</div>
                  <div className="text-sm text-gray-500">{QUESTION_TYPE_LABELS[t.question_type] || t.question_type}</div>
                </Card>
              ))}
            </div>
          )}

          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <select
                value={filterContentArea}
                onChange={(e) => { setFilterContentArea(e.target.value); setPage(1) }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Content Areas</option>
                {Object.entries(CONTENT_AREA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={filterDifficulty}
                onChange={(e) => { setFilterDifficulty(e.target.value); setPage(1) }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Types</option>
                {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={filterNGN}
                onChange={(e) => { setFilterNGN(e.target.value); setPage(1) }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">Traditional & NGN</option>
                <option value="traditional">Traditional Only</option>
                <option value="ngn">NGN Only</option>
              </select>
            </div>
          </Card>

          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading questions...</div>
            ) : questions.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No questions found</p>
                <Button onClick={openAddModal}>
                  <Plus className="h-4 w-4 mr-2" />Add First Question
                </Button>
              </div>
            ) : (
              <div>
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Question</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-32">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-28">Content Area</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-20">Difficulty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-20">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {questions.map((q) => (
                      <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 dark:text-white line-clamp-2 max-w-md">
                            {q.question_text}
                          </p>
                          {q.tags && q.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {q.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${q.is_ngn ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}>
                            {QUESTION_TYPE_LABELS[q.question_type] || q.question_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {CONTENT_AREA_LABELS[q.content_area] || q.content_area}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                            q.difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                            q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {q.difficulty}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleActive(q)} className="flex items-center gap-1 text-xs">
                            {q.is_active
                              ? <CheckCircle className="h-4 w-4 text-green-500" />
                              : <XCircle className="h-4 w-4 text-gray-400" />
                            }
                            <span className={q.is_active ? 'text-green-600' : 'text-gray-400'}>
                              {q.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditModal(q)} className="p-1.5 rounded text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(q)} className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500">
                      Page {page} of {pages} ({total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </main>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingQuestion ? 'Edit Question' : 'Add Question'} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question Text *</label>
            <textarea
              value={form.question_text}
              onChange={(e) => setForm(f => ({ ...f, question_text: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              placeholder="Enter the question stem..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question Type</label>
              <select
                value={form.question_type}
                onChange={(e) => setForm(f => ({ ...f, question_type: e.target.value, is_ngn: e.target.value.startsWith('ngn_') }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content Area</label>
              <select
                value={form.content_area}
                onChange={(e) => setForm(f => ({ ...f, content_area: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {Object.entries(CONTENT_AREA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm(f => ({ ...f, difficulty: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cognitive Level</label>
              <select
                value={form.cognitive_level}
                onChange={(e) => setForm(f => ({ ...f, cognitive_level: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="remember">Remember</option>
                <option value="understand">Understand</option>
                <option value="apply">Apply</option>
                <option value="analyze">Analyze</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subcategory</label>
              <input
                type="text"
                value={form.subcategory}
                onChange={(e) => setForm(f => ({ ...f, subcategory: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Optional"
              />
            </div>
          </div>

          {(form.question_type === 'traditional_mcq' || form.question_type === 'ngn_sata') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Answer Choices {form.question_type === 'traditional_mcq' ? '(select one correct)' : '(select all correct)'}
                </label>
                <button onClick={addOption} className="text-xs text-primary-600 hover:underline">+ Add option</button>
              </div>
              <div className="space-y-2">
                {form.options.map((opt: any, i: number) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type={form.question_type === 'traditional_mcq' ? 'radio' : 'checkbox'}
                      name="correct_option"
                      checked={opt.is_correct}
                      onChange={(e) => updateOption(i, 'is_correct', e.target.checked)}
                      className="text-primary-600"
                    />
                    <span className="w-6 text-sm font-medium text-gray-500 uppercase">{opt.id}.</span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => updateOption(i, 'text', e.target.value)}
                      placeholder={`Option ${opt.id.toUpperCase()}`}
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                    {form.options.length > 2 && (
                      <button onClick={() => removeOption(i)} className="text-red-400 hover:text-red-600">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.question_type === 'ngn_cloze' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cloze Stem (use [1], [2]... for blanks)
                </label>
                <textarea
                  value={form.cloze_stem}
                  onChange={(e) => setForm(f => ({ ...f, cloze_stem: e.target.value }))}
                  rows={3}
                  placeholder="The patient presents with [1] and requires [2]."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                />
              </div>
              {form.cloze_blanks.map((blank: any, bi: number) => (
                <div key={bi} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Blank [{blank.id}]</p>
                  <div className="space-y-1">
                    {blank.choices.map((choice: string, ci: number) => (
                      <div key={ci} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`blank_${bi}_correct`}
                          checked={blank.correct === choice && choice !== ''}
                          onChange={() => updateClozeBlank(bi, 'correct', choice)}
                        />
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) => updateClozeChoice(bi, ci, e.target.value)}
                          placeholder={`Choice ${ci + 1}`}
                          className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={addClozeBlank} className="text-xs text-primary-600 hover:underline">+ Add blank</button>
            </div>
          )}

          {form.question_type === 'ngn_matrix' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rows</label>
                  {form.matrix_rows.map((row: string, ri: number) => (
                    <input
                      key={ri}
                      type="text"
                      value={row}
                      onChange={(e) => {
                        const rows = [...form.matrix_rows]
                        rows[ri] = e.target.value
                        setForm(f => ({ ...f, matrix_rows: rows }))
                      }}
                      placeholder={`Row ${ri + 1}`}
                      className="w-full mb-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  ))}
                  <button onClick={() => setForm(f => ({ ...f, matrix_rows: [...f.matrix_rows, ''] }))} className="text-xs text-primary-600 hover:underline">+ Row</button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Columns</label>
                  {form.matrix_columns.map((col: string, ci: number) => (
                    <input
                      key={ci}
                      type="text"
                      value={col}
                      onChange={(e) => {
                        const cols = [...form.matrix_columns]
                        cols[ci] = e.target.value
                        setForm(f => ({ ...f, matrix_columns: cols }))
                      }}
                      placeholder={`Column ${ci + 1}`}
                      className="w-full mb-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  ))}
                  <button onClick={() => setForm(f => ({ ...f, matrix_columns: [...f.matrix_columns, ''] }))} className="text-xs text-primary-600 hover:underline">+ Column</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mark correct cells (click to toggle)</label>
                <div className="overflow-x-auto">
                  <table className="border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-50 dark:bg-gray-800"></th>
                        {form.matrix_columns.filter(Boolean).map((col: string, ci: number) => (
                          <th key={ci} className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">{col || `Col ${ci + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {form.matrix_rows.filter(Boolean).map((row: string, ri: number) => (
                        <tr key={ri}>
                          <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-50 dark:bg-gray-800 font-medium text-gray-700 dark:text-gray-300">{row || `Row ${ri + 1}`}</td>
                          {form.matrix_columns.filter(Boolean).map((_: string, ci: number) => {
                            const selected = form.matrix_correct_cells.some((c: number[]) => c[0] === ri && c[1] === ci)
                            return (
                              <td
                                key={ci}
                                onClick={() => toggleMatrixCell(ri, ci)}
                                className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-center cursor-pointer ${selected ? 'bg-primary-100 dark:bg-primary-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                              >
                                {selected ? '✓' : ''}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rationale / Explanation</label>
            <textarea
              value={form.rationale}
              onChange={(e) => setForm(f => ({ ...f, rationale: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              placeholder="Explain why the answer is correct..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
            <div
              className="min-h-[42px] w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 flex flex-wrap gap-1.5 items-center bg-white dark:bg-gray-800 cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
              onClick={(e) => {
                const input = (e.currentTarget as HTMLElement).querySelector('input')
                if (input) input.focus()
              }}
            >
              {parsedTags().map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-medium px-2 py-0.5 rounded-full"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeTag(i) }}
                    className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 leading-none"
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTagFromInput}
                placeholder={parsedTags().length === 0 ? 'Type a tag and press Enter or comma…' : ''}
                className="flex-1 min-w-[120px] text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 py-0.5"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Press Enter or comma to add a tag. Backspace removes the last tag.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : editingQuestion ? 'Save Changes' : 'Add Question'}
            </Button>
            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Question">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to permanently delete this question? This cannot be undone.
          </p>
          {questionToDelete && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
              {questionToDelete.question_text}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="destructive" onClick={confirmDelete} disabled={deletingId !== null} className="flex-1">
              {deletingId !== null ? 'Deleting...' : 'Delete Question'}
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
