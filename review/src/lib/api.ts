import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://gritsync.com/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
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

export const nclexApi = {
  getSessionReview: (id: string) => api.get(`/nclex/sessions/${id}/review`),
}
