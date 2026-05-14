import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
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
      const adminToken = localStorage.getItem('gritsync_admin_token')
      if (adminToken) {
        localStorage.setItem('gritsync_token', adminToken)
        localStorage.removeItem('gritsync_admin_token')
        localStorage.removeItem('gritsync_admin_user')
        window.location.href = '/admin/clients'
      } else {
        localStorage.removeItem('gritsync_token')
        localStorage.removeItem('gritsync_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ─── NCLEX Review ─────────────────────────────────────────────────────────────
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
  // Admin
  getAdminStats: () => api.get('/nclex/admin/stats'),
  listQuestions: (params?: Record<string, unknown>) =>
    api.get('/nclex/admin/questions', { params }),
  createQuestion: (data: Record<string, unknown>) => api.post('/nclex/admin/questions', data),
  getQuestion: (id: string) => api.get(`/nclex/admin/questions/${id}`),
  updateQuestion: (id: string, data: Record<string, unknown>) =>
    api.put(`/nclex/admin/questions/${id}`, data),
  deleteQuestion: (id: string) => api.delete(`/nclex/admin/questions/${id}`),
  listCaseStudies: (params?: Record<string, unknown>) =>
    api.get('/nclex/admin/case-studies', { params }),
  createCaseStudy: (data: Record<string, unknown>) =>
    api.post('/nclex/admin/case-studies', data),
  updateCaseStudy: (id: string, data: Record<string, unknown>) =>
    api.put(`/nclex/admin/case-studies/${id}`, data),
  deleteCaseStudy: (id: string) => api.delete(`/nclex/admin/case-studies/${id}`),
  listExitAccess: () => api.get('/nclex/admin/exit-access'),
  grantExitAccess: (userId: string, data?: { paymentRef?: string }) =>
    api.post(`/nclex/admin/grant-exit/${userId}`, data ?? {}),
  revokeExitAccess: (userId: string) => api.delete(`/nclex/admin/revoke-exit/${userId}`),
  listAdminSessions: (params?: Record<string, unknown>) =>
    api.get('/nclex/admin/sessions', { params }),
  // Subscriptions admin
  listAllProfiles: (params?: Record<string, unknown>) =>
    api.get('/nclex/admin/profiles', { params }),
  listUpgradeRequests: () => api.get('/nclex/admin/upgrade-requests'),
  approveUpgrade: (userId: string) => api.post(`/nclex/admin/approve-upgrade/${userId}`),
  rejectUpgrade: (userId: string) => api.post(`/nclex/admin/reject-upgrade/${userId}`),
  grantSpecialAccess: (userId: string, resource: string) =>
    api.post(`/nclex/admin/special-access/${userId}`, { resource }),
  revokeSpecialAccess: (userId: string, resource: string) =>
    api.delete(`/nclex/admin/special-access/${userId}`, { data: { resource } }),
  // Testimonials
  listPendingTestimonials: () => api.get('/nclex/admin/pending-testimonials'),
  approveTestimonial: (id: string) => api.post(`/nclex/admin/approve-testimonial/${id}`),
  // Subscription plan config
  getSubscriptionPlans: () => api.get('/nclex/admin/subscription-plans'),
  updateSubscriptionPlans: (data: Record<string, unknown>) =>
    api.put('/nclex/admin/subscription-plans', data),
  getPublicPlans: () => api.get('/nclex/plans'),
  // AI question generation
  generateQuestions: (data: {
    format: string
    bank: string
    topic: string
    count: number
    customContext?: string
  }) => api.post('/nclex/admin/generate-questions', data),
  listPendingQuestions: (params?: Record<string, unknown>) =>
    api.get('/nclex/admin/pending-questions', { params }),
  getPendingQuestion: (id: string) => api.get(`/nclex/admin/pending-questions/${id}`),
  updatePendingQuestion: (id: string, data: Record<string, unknown>) =>
    api.put(`/nclex/admin/pending-questions/${id}`, data),
  approvePendingQuestion: (id: string) =>
    api.post(`/nclex/admin/pending-questions/${id}/approve`),
  rejectPendingQuestion: (id: string, rejectionNote?: string) =>
    api.post(`/nclex/admin/pending-questions/${id}/reject`, { rejectionNote }),
  deletePendingQuestion: (id: string) => api.delete(`/nclex/admin/pending-questions/${id}`),
  bulkApprovePending: (ids: string[]) =>
    api.post('/nclex/admin/pending-questions/bulk-approve', { ids }),
  uploadQuestionImage: (formData: FormData) =>
    api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // AI case study generation
  generateCaseStudy: (data: {
    caseType: string
    topic: string
    formats: string[]
    customContext?: string
  }) => api.post('/nclex/admin/generate-case-study', data),
  listPendingCaseStudies: (params?: Record<string, unknown>) =>
    api.get('/nclex/admin/pending-case-studies', { params }),
  getPendingCaseStudy: (id: string) => api.get(`/nclex/admin/pending-case-studies/${id}`),
  updatePendingCaseStudy: (id: string, data: Record<string, unknown>) =>
    api.put(`/nclex/admin/pending-case-studies/${id}`, data),
  approvePendingCaseStudy: (id: string) =>
    api.post(`/nclex/admin/pending-case-studies/${id}/approve`),
  rejectPendingCaseStudy: (id: string, note?: string) =>
    api.post(`/nclex/admin/pending-case-studies/${id}/reject`, { rejectionNote: note }),
  deletePendingCaseStudy: (id: string) => api.delete(`/nclex/admin/pending-case-studies/${id}`),
  suggestTest: (data: {
    topicStats: Array<{ topic: string; total: number; used: number; pct: number }>
    studyGoal?: string
    examDate?: string | null
  }) => api.post('/nclex/ai/suggest', data),
}

export default api
