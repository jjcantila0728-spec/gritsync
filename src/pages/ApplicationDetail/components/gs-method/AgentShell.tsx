// Shared UI shell for every GS Method agent.
// - Initialize / Re-Initialize / Cancel buttons
// - Live SSE event log
// - Result card + run history
//
// Each tab's specific copy + extra inputs are passed in via children/render props.

import { ReactNode, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Play, StopCircle, CheckCircle2, XCircle, Loader2, AlertTriangle, Copy, FileText, Eye } from 'lucide-react'

export type AgentKind = 'mandatory-courses' | 'ny-application' | 'pv-application'
type Level = 'info' | 'warn' | 'error' | 'success' | 'debug'
export interface AgentEvent { ts: number; level: Level; step?: string; message: string; data?: any }
export type Status = 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

interface ResultDetail {
  // Free-form key/value rows shown in the success/failure card.
  // secret=true masks the value behind a "reveal" button.
  rows: Array<{ label: string; value: string; secret?: boolean }>
  // Document types saved during the run (rendered as a list)
  documentsSaved?: string[]
  // Friendly labels for those document types
  documentLabels?: Record<string, string>
  // Any error string from the run
  error?: string
}

interface Props {
  kind: AgentKind
  title: string
  subtitle: string
  appId: string  // grit_app_id or uuid — server resolves it
  steps: ReactNode  // <ol>…</ol> describing what happens on Initialize
  // Build the POST body for /start — can include `context` for runtime inputs
  buildStartPayload?: () => Record<string, any> | null
  // Map the raw `result` blob from the server into the structured detail
  // shown in the success card.
  describeResult?: (raw: any) => ResultDetail
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  // Optional inline content shown above the Initialize section (e.g. a form
  // collecting SSN for NY, or username/password for PV).
  preInitialize?: ReactNode
}

const LEVEL_CLASS: Record<Level, string> = {
  info: 'text-blue-600 dark:text-blue-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  debug: 'text-gray-400 dark:text-gray-500',
}

function getToken(): string {
  return localStorage.getItem('gritsync_token') || ''
}

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(url, { ...init, headers })
}

export function AgentShell({
  kind, title, subtitle, appId, steps,
  buildStartPayload, describeResult, showToast, preInitialize,
}: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [result, setResult] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch(`/api/agents/${kind}/active/${appId}`)
        if (!res.ok) return
        const body = await res.json()
        if (cancelled) return
        if (body?.active?.id) {
          setJobId(body.active.id)
          setStatus(body.active.status as Status)
          connectStream(body.active.id)
        }
      } catch { /* */ }
    })()
    loadHistory()
    return () => { cancelled = true; closeStream() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, kind])

  async function loadHistory() {
    try {
      const res = await authFetch(`/api/agents/${kind}/runs/${appId}`)
      if (!res.ok) return
      const body = await res.json()
      setHistory(body?.runs || [])
    } catch { /* */ }
  }

  function closeStream() {
    if (esRef.current) {
      try { esRef.current.close() } catch { /* */ }
      esRef.current = null
    }
  }

  function connectStream(id: string) {
    closeStream()
    const token = encodeURIComponent(getToken())
    const url = `/api/agents/${kind}/stream/${id}?t=${token}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as AgentEvent
        setEvents((prev) => [...prev, parsed])
      } catch { /* */ }
    }
    es.addEventListener('status', (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data) as { status: Status }
        setStatus(parsed.status)
        if (parsed.status === 'completed' || parsed.status === 'failed' || parsed.status === 'cancelled') {
          fetchFinalStatus(id)
          loadHistory()
          closeStream()
        }
      } catch { /* */ }
    })
    es.onerror = () => { /* auto-reconnect */ }
  }

  async function fetchFinalStatus(id: string) {
    try {
      const res = await authFetch(`/api/agents/${kind}/status/${id}`)
      if (!res.ok) return
      const body = await res.json()
      if (body?.result) setResult(body.result)
    } catch { /* */ }
  }

  async function handleInitialize() {
    let context: Record<string, any> | null = null
    if (buildStartPayload) {
      context = buildStartPayload()
      if (context === null) return  // validation handled by caller; nothing to do
    }
    setEvents([])
    setResult(null)
    setStatus('pending')
    try {
      const res = await authFetch(`/api/agents/${kind}/start`, {
        method: 'POST',
        body: JSON.stringify({ applicationId: appId, context }),
      })
      const body = await res.json()
      if (!res.ok) {
        setStatus('failed')
        showToast(body?.error || 'Failed to start agent', 'error')
        return
      }
      setJobId(body.jobId)
      if (body.reused) showToast('Resumed an in-flight run.', 'info')
      else showToast(`${title} started.`, 'success')
      connectStream(body.jobId)
    } catch (err: any) {
      setStatus('failed')
      showToast(err?.message || 'Failed to start agent', 'error')
    }
  }

  async function handleCancel() {
    if (!jobId) return
    try {
      const res = await authFetch(`/api/agents/${kind}/cancel/${jobId}`, { method: 'POST' })
      const body = await res.json()
      if (body?.cancelled) showToast('Cancellation requested.', 'info')
      else showToast('Run is not active.', 'warning')
    } catch (err: any) {
      showToast(err?.message || 'Cancel failed', 'error')
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => showToast(`${label} copied.`, 'success'),
      () => showToast(`Failed to copy ${label}.`, 'error')
    )
  }

  const isRunning = status === 'pending' || status === 'running'
  const isDone = status === 'completed'
  const isFailed = status === 'failed' || status === 'cancelled'
  const detail = result && describeResult ? describeResult(result) : null

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {!isRunning ? (
              <Button onClick={handleInitialize} variant="default" size="sm">
                <Play className="h-4 w-4 mr-1.5" />
                {isDone || isFailed ? 'Re-Initialize' : 'Initialize'}
              </Button>
            ) : (
              <Button onClick={handleCancel} variant="outline" size="sm">
                <StopCircle className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        {preInitialize}

        {status === 'idle' && (
          <div className="rounded-md border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">When you press Initialize, the agent will:</p>
            <div className="text-xs text-gray-600 dark:text-gray-400">{steps}</div>
          </div>
        )}

        {(detail || isDone || isFailed) && (
          <div className={`rounded-md border p-4 ${isFailed ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900' : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900'}`}>
            <h4 className={`text-sm font-semibold mb-2 ${isFailed ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {isFailed ? 'Run did not complete' : 'Run completed'}
            </h4>
            {detail?.error && (<p className="text-xs text-red-700 dark:text-red-300 mb-2">{detail.error}</p>)}
            {detail?.rows && detail.rows.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {detail.rows.map((r, i) => (
                  <CredRow key={i} label={r.label} value={r.value} onCopy={copy} secret={!!r.secret} />
                ))}
              </div>
            )}
            {detail?.documentsSaved && detail.documentsSaved.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Saved to Documents:</p>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                  {detail.documentsSaved.map((d) => (
                    <li key={d} className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {(detail.documentLabels && detail.documentLabels[d]) || d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {(events.length > 0 || isRunning) && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Live log</p>
              <p className="text-[10px] text-gray-400">{events.length} events</p>
            </div>
            <div ref={logRef} className="font-mono text-[11px] leading-relaxed bg-gray-900 text-gray-200 rounded-md p-3 max-h-72 overflow-y-auto border border-gray-700">
              {events.length === 0 ? (
                <div className="text-gray-500 italic">Waiting for the first event…</div>
              ) : (
                events.map((ev, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-500 shrink-0">{new Date(ev.ts).toLocaleTimeString([], { hour12: false })}</span>
                    {ev.step && <span className="text-purple-400 shrink-0">[{ev.step}]</span>}
                    <span className={LEVEL_CLASS[ev.level] || 'text-gray-200'}>{ev.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
          >
            {showHistory ? 'Hide previous runs' : `Previous runs (${history.length})`}
          </button>
          {showHistory && history.length > 0 && (
            <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr className="text-left text-gray-600 dark:text-gray-300">
                    <th className="px-3 py-2">Started</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {history.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-1.5">{new Date(r.started_at).toLocaleString()}</td>
                      <td className="px-3 py-1.5"><StatusBadge status={r.status as Status} compact /></td>
                      <td className="px-3 py-1.5 text-gray-500">
                        {r.result?.error
                          ? <span className="text-red-600 dark:text-red-400">{r.result.error.slice(0, 60)}</span>
                          : r.result?.applicationId
                          ? `App ${r.result.applicationId}`
                          : r.result?.confirmationNumber
                          ? `Conf ${r.result.confirmationNumber}`
                          : r.result?.accountEmail
                          ? r.result.accountEmail
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function StatusBadge({ status, compact = false }: { status: Status; compact?: boolean }) {
  const map: Record<Status, { label: string; cls: string; Icon: any }> = {
    idle:      { label: 'Idle',      cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', Icon: Eye },
    pending:   { label: 'Queued',    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', Icon: Loader2 },
    running:   { label: 'Running',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', Icon: Loader2 },
    completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', Icon: CheckCircle2 },
    failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', Icon: XCircle },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300', Icon: AlertTriangle },
  }
  const m = map[status] || map.idle
  const I = m.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${m.cls} ${compact ? '' : ''}`}>
      <I className={`h-3 w-3 ${status === 'pending' || status === 'running' ? 'animate-spin' : ''}`} />
      {m.label}
    </span>
  )
}

function CredRow({ label, value, onCopy, secret = false }: { label: string; value: string; onCopy: (v: string, l: string) => void; secret?: boolean }) {
  const [revealed, setRevealed] = useState(!secret)
  return (
    <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
        <p className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">
          {revealed ? value : '••••••••••'}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {secret && (
          <button onClick={() => setRevealed((v) => !v)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1" title={revealed ? 'Hide' : 'Reveal'}>
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={() => onCopy(value, label)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1" title="Copy">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
