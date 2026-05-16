import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gritsync.com/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gritsync_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gritsync_token')
      localStorage.removeItem('gritsync_user')
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.replace(`/login?next=${next}`)
    }
    return Promise.reject(error)
  }
)

// ─── NCLEX (subset used by the review subapp) ────────────────────────────────
export const nclexApi = {
  getHome: () => api.get('/nclex/home'),
  getProfile: () => api.get('/nclex/profile'),
  updateExamDate: (examDate: string | null) => api.put('/nclex/profile/exam-date', { examDate }),
  requestUpgrade: (formData: FormData) =>
    api.post('/nclex/profile/upgrade-request', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  submitTestimonial: (data: Record<string, unknown>) => api.post('/nclex/testimonials', data),
  getApprovedTestimonials: () => api.get('/nclex/testimonials/approved'),
  getVideoConfig: () => api.get('/nclex/videos'),
  updateVideoConfig: (data: Record<string, unknown>) => api.put('/nclex/admin/videos', data),
  startSession: (data: {
    examType: string
    bank?: string
    questionCount?: number
    topics?: string[]
    formats?: string[]
  }) => api.post('/nclex/sessions', data),
  getSession: (id: string) => api.get(`/nclex/sessions/${id}`),
  submitAnswer: (
    id: string,
    data: { questionId: string; response: unknown; timeSpent?: number }
  ) => api.post(`/nclex/sessions/${id}/answer`, data),
  abandonSession: (id: string) => api.post(`/nclex/sessions/${id}/abandon`),
  getSessionReview: (id: string) => api.get(`/nclex/sessions/${id}/review`),
  checkExitAccess: () => api.get('/nclex/exit-access'),
  getPublicPlans: () => api.get('/nclex/plans'),
  createUpgradeIntent: (planId: string) =>
    api.post('/nclex/create-upgrade-intent', { planId }),
  confirmStripeUpgrade: (paymentIntentId: string) =>
    api.post('/nclex/confirm-stripe-upgrade', { paymentIntentId }),
  getLiveSessions: () => api.get('/nclex/live-sessions'),
  getOrderHistory: () => api.get('/nclex/order-history'),
  getSiteSettings: () => api.get('/nclex/site-settings'),
  suggestTest: (data: {
    topicStats: Array<{ topic: string; total: number; used: number; pct: number }>
    studyGoal?: string
    examDate?: string | null
  }) => api.post('/nclex/ai/suggest', data),
}

export default api
