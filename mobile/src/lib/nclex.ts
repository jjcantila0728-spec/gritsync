import { api } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Domain types — mirror the server's API shape (camelCase responses).
// ─────────────────────────────────────────────────────────────────────────────

export type QuestionFormat =
  | 'MCQ'
  | 'SATA'
  | 'ORDERED_RESPONSE'
  | 'FILL_IN_BLANK'
  | 'HIGHLIGHT_TEXT'
  | 'BOW_TIE'
  | 'DROP_DOWN'
  | 'MATRIX_MCQ'
  | 'MATRIX_SATA'
  | 'DRAG_DROP'

export type Bank = 'CLASSIC' | 'NGN'

export type ExamType = 'READINESS_ASSESSMENT' | 'CAT' | 'TUTORIAL' | 'EXIT_EXAM'

export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'

export type Tier = 'FREE' | 'PREMIUM'

export interface CaseStudy {
  id: string
  title?: string | null
  tabs?: Array<{ label: string; content: string }> | null
}

export interface QuestionOption {
  id: string
  text: string
  /** Some formats (e.g. MATRIX) ship row/column labels here. */
  [key: string]: unknown
}

export interface Question {
  id: string
  bank: Bank
  format: QuestionFormat
  caseStudyId?: string | null
  itemNumber?: number | null
  stem: string
  options: any
  correctAnswer: any
  rationale?: string | null
  additionalInfo?: string | null
  topic?: string | null
  subtopic?: string | null
  difficulty?: number | null
  discrimination?: number | null
  metadata?: Record<string, unknown> | null
  caseStudy?: CaseStudy | null
}

export interface SessionItem {
  id: string
  sessionId: string
  questionId: string
  itemIndex: number
  response: unknown
  isCorrect: boolean | null
  timeSpent: number | null
  answeredAt: string | null
  flagged?: boolean | null
  note?: string | null
  question?: Question
}

export interface Result {
  examType: ExamType
  totalItems: number
  correctCount?: number
  percentCorrect?: number
  passed?: boolean
  finalTheta?: number
  standardError?: number
  stopReason?: 'SE_THRESHOLD' | 'MAX_ITEMS' | 'MIN_ITEMS' | string
  /** Mapped topic → { correct, total, pct } */
  categoryBreakdown?: Record<string, { correct: number; total: number; pct: number }>
  durationSeconds?: number
  readiness?: 'LOW' | 'NEAR_PASSING' | 'APPROACHING' | 'HIGH' | 'VERY_HIGH' | string
}

export interface Session {
  id: string
  userId: string
  examType: ExamType
  status: SessionStatus
  bank?: Bank | null
  questionPool?: string[] | null
  currentIndex: number
  correctCount: number
  timeLimit?: number | null
  currentTheta?: number | null
  standardError?: number | null
  startedAt?: string | null
  completedAt?: string | null
  result?: Result | null
  /** Joined items (populated by GET /sessions/:id). */
  items?: SessionItem[]
}

export interface Feedback {
  isCorrect: boolean
  correctAnswer: unknown
  rationale?: string | null
  additionalInfo?: string | null
  metadata?: Record<string, unknown> | null
  peerCorrectPct?: number | null
  optionStats?: Record<string, number>
  /** When provided, the runner should call this id next instead of advancing
   *  the pool — used by CAT (adaptive) sessions. */
  nextQuestion?: Question | null
  shouldStop?: boolean
  result?: Result | null
}

export interface NclexProfile {
  userId: string
  tier: Tier
  tierExpiresAt?: string | null
  examDate?: string | null
  specialAccess?: string[] | null
  upgradeRequested?: boolean | null
}

export interface PeerStats {
  avgRA: number | null
  countRA: number
  avgCAT: number | null
  countCAT: number
}

export interface HomeData {
  sessions: Array<Pick<Session, 'id' | 'examType' | 'status' | 'startedAt' | 'completedAt' | 'correctCount' | 'currentIndex'> & { result?: Result | null }>
  exitAccess: unknown
  profile: NclexProfile | null
  questionsToday: number
  peerStats: PeerStats
  stats: {
    totalSessions: number
    completedSessions: number
    questionBanks: Array<{ bank: Bank; _count: number }>
    usedByBank: Record<string, number>
    usedByTopic: Record<string, number>
    byTopic: Array<{ topic: string; count: number }>
    byFormat: Array<{ format: string; count: number }>
  }
}

export interface SubscriptionPlan {
  id: string
  name: string
  tier: Tier
  priceUsd: number
  durationDays: number
  features?: string[]
}

export interface LiveSession {
  id: string
  title: string
  description?: string | null
  starts_at: string
  duration_minutes?: number | null
  join_url?: string | null
  host?: string | null
}

export interface Testimonial {
  id: string
  user_name?: string | null
  rating?: number | null
  body?: string | null
  created_at?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// API helpers — every call goes through the existing axios `api` instance
// which already handles bearer auth + 401 refresh.
// ─────────────────────────────────────────────────────────────────────────────

interface OkEnvelope<T> {
  success: boolean
  message?: string
  data: T
}

function unwrap<T>(env: OkEnvelope<T>): T {
  return env.data
}

export const nclexAPI = {
  // Hub / home
  async home(): Promise<HomeData> {
    const res = await api.get<OkEnvelope<HomeData>>('/nclex/home')
    return unwrap(res.data)
  },

  // Profile
  async profile(): Promise<NclexProfile | null> {
    const res = await api.get<OkEnvelope<NclexProfile | null>>('/nclex/profile')
    return unwrap(res.data)
  },
  async setExamDate(examDate: string | null): Promise<void> {
    await api.put('/nclex/profile/exam-date', { examDate })
  },

  // Sessions
  async startSession(input: {
    examType: ExamType
    bank?: Bank
    questionCount?: number
    topics?: string[]
    formats?: QuestionFormat[]
  }): Promise<{ session: Session; currentQuestion: Question; currentIndex: number }> {
    const res = await api.post<
      OkEnvelope<{ session: Session; currentQuestion: Question; currentIndex: number }>
    >('/nclex/sessions', input)
    return unwrap(res.data)
  },
  async getSession(id: string): Promise<{ session: Session; currentQuestion: Question | null; currentIndex: number }> {
    const res = await api.get<OkEnvelope<any>>(`/nclex/sessions/${id}`)
    return unwrap(res.data)
  },
  async answer(
    sessionId: string,
    questionId: string,
    response: unknown,
    timeSpent?: number,
  ): Promise<Feedback> {
    const res = await api.post<OkEnvelope<Feedback>>(`/nclex/sessions/${sessionId}/answer`, {
      questionId,
      response,
      timeSpent,
    })
    return unwrap(res.data)
  },
  async abandonSession(id: string): Promise<void> {
    await api.post(`/nclex/sessions/${id}/abandon`)
  },
  async reviewSession(id: string): Promise<SessionItem[]> {
    const res = await api.get<OkEnvelope<{ items: SessionItem[] }>>(`/nclex/sessions/${id}/review`)
    return res.data?.data?.items ?? []
  },

  // Subscriptions
  async plans(): Promise<SubscriptionPlan[]> {
    const res = await api.get<OkEnvelope<{ plans: SubscriptionPlan[] }>>('/nclex/plans')
    return res.data?.data?.plans ?? []
  },
  async createUpgradeIntent(planId: string): Promise<{ clientSecret: string; intentId: string; amount?: number; currency?: string }> {
    const res = await api.post<OkEnvelope<any>>('/nclex/create-upgrade-intent', { planId })
    return unwrap(res.data)
  },
  async confirmStripeUpgrade(input: { intentId: string; planId: string }): Promise<NclexProfile> {
    const res = await api.post<OkEnvelope<NclexProfile>>('/nclex/confirm-stripe-upgrade', input)
    return unwrap(res.data)
  },
  async submitUpgradeRequest(form: FormData): Promise<void> {
    // multipart — receipt file is the optional `receipt` field. We construct
    // the FormData at the call site so we can use expo-document-picker / image
    // URIs from the mobile app.
    await api.post('/nclex/profile/upgrade-request', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Videos / cheatsheets / live / testimonials (used by Phase 3)
  async videos(): Promise<unknown> {
    const res = await api.get<OkEnvelope<unknown>>('/nclex/videos')
    return unwrap(res.data)
  },
  async liveSessions(): Promise<LiveSession[]> {
    const res = await api.get<OkEnvelope<{ sessions: LiveSession[] }>>('/nclex/live-sessions')
    return res.data?.data?.sessions ?? []
  },
  async approvedTestimonials(): Promise<Testimonial[]> {
    const res = await api.get<OkEnvelope<{ testimonials: Testimonial[] }>>('/nclex/testimonials/approved')
    return res.data?.data?.testimonials ?? []
  },

  // Orders
  async orderHistory(): Promise<Order[]> {
    const res = await api.get<OkEnvelope<Order[]>>('/nclex/order-history')
    // server returns the array directly under `data`
    const raw = res.data?.data
    return Array.isArray(raw) ? raw : []
  },
}

export interface Order {
  id: string
  method: 'stripe' | 'gcash' | 'bdo' | 'manual' | 'unknown' | string
  reference: string
  status: 'completed' | 'pending_admin_review' | 'failed' | string
  tier: Tier | string
  expiresAt: string | null
  date: string | null
  amount?: number | null
  currency?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure-ish helpers used by multiple screens.
// ─────────────────────────────────────────────────────────────────────────────

export function readinessLabel(level?: string): string {
  switch (level) {
    case 'VERY_HIGH':
      return 'Very High'
    case 'HIGH':
      return 'High'
    case 'APPROACHING':
      return 'Approaching'
    case 'NEAR_PASSING':
      return 'Near Passing'
    case 'LOW':
      return 'Low'
    default:
      return level ?? '—'
  }
}

export function readinessTone(level?: string): {
  bg: string
  border: string
  fg: string
} {
  switch (level) {
    case 'VERY_HIGH':
      return { bg: '#DCFCE7', border: '#86EFAC', fg: '#15803D' }
    case 'HIGH':
      return { bg: '#D1FAE5', border: '#6EE7B7', fg: '#047857' }
    case 'APPROACHING':
      return { bg: '#DBEAFE', border: '#93C5FD', fg: '#1D4ED8' }
    case 'NEAR_PASSING':
      return { bg: '#FEF3C7', border: '#FCD34D', fg: '#B45309' }
    case 'LOW':
      return { bg: '#FEE2E2', border: '#FCA5A5', fg: '#B91C1C' }
    default:
      return { bg: '#F3F4F6', border: '#E5E7EB', fg: '#374151' }
  }
}

export function formatExamType(t: ExamType): string {
  switch (t) {
    case 'READINESS_ASSESSMENT':
      return 'Readiness Assessment'
    case 'CAT':
      return 'CAT (Adaptive)'
    case 'TUTORIAL':
      return 'Tutorial'
    case 'EXIT_EXAM':
      return 'Exit Exam'
  }
}

export function bankLabel(bank: Bank): string {
  return bank === 'CLASSIC' ? 'Classic Q-Bank' : 'NGN Q-Bank'
}

export function bankSummary(bank: Bank): string {
  return bank === 'CLASSIC'
    ? 'Traditional multiple-choice items aligned to the NCLEX-RN test plan.'
    : 'Next Generation NCLEX — case studies, matrix, bow-tie, and more.'
}
