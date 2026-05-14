import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'

/**
 * Tests for AuthContext against the local-Postgres `db.auth` shim.
 * `@/lib/api-client` is mocked so no backend is needed.
 */

// --- mock the data layer ------------------------------------------------------
// `vi.mock` is hoisted above imports, so the mock objects must be created via
// `vi.hoisted` to be referenceable here.
const { auth } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    updateUser: vi.fn(),
  },
}))
vi.mock('@/lib/api-client', () => ({ db: { auth } }))
// signOut() dynamically imports clearAuthCache from api-service — keep it light
vi.mock('@/lib/api-service', () => ({ clearAuthCache: vi.fn() }))

import { AuthProvider, useAuth } from '@/contexts/AuthContext'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

function mockNoSession() {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
}
function mockSession(user: any) {
  // The real /auth/me always echoes the role into user_metadata/app_metadata,
  // which is where AuthContext reads it from — mirror that here.
  const authUser = {
    ...user,
    user_metadata: { role: user.role, first_name: user.first_name, last_name: user.last_name, grit_id: user.grit_id, ...(user.user_metadata || {}) },
    app_metadata: { role: user.role, ...(user.app_metadata || {}) },
  }
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 't', refresh_token: 'r', user: authUser } }, error: null })
  auth.getUser.mockResolvedValue({ data: { user: authUser }, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

describe('AuthContext', () => {
  it('starts unauthenticated and finishes loading when there is no session', async () => {
    mockNoSession()
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('loads the user profile from db.auth.getUser when a session exists', async () => {
    mockSession({ id: 'u1', email: 'jane@example.com', first_name: 'Jane', last_name: 'Doe', role: 'admin', created_at: '2024-01-01' })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.user).not.toBeNull())
    expect(result.current.user?.email).toBe('jane@example.com')
    expect(result.current.user?.first_name).toBe('Jane')
    expect(result.current.isAdmin()).toBe(true)
    expect(result.current.isClient()).toBe(false)
  })

  it('reads the role from user_metadata when there is no top-level role', async () => {
    mockSession({ id: 'u2', email: 'c@example.com', created_at: '2024-01-01', user_metadata: { role: 'client' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.user).not.toBeNull())
    expect(result.current.isClient()).toBe(true)
    expect(result.current.isAdmin()).toBe(false)
  })

  it('signIn() calls db.auth.signInWithPassword and resolves on success', async () => {
    mockNoSession()
    auth.signInWithPassword.mockResolvedValue({ data: { session: {}, user: {} }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.signIn('a@b.com', 'pw')
    })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' })
  })

  it('signIn() throws the backend error message on failure', async () => {
    mockNoSession()
    auth.signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(result.current.signIn('a@b.com', 'bad')).rejects.toThrow('Invalid login credentials')
  })

  it('signUp() forwards the form fields and returns the verification result', async () => {
    mockNoSession()
    auth.signUp.mockResolvedValue({ data: { requiresVerification: true, personal_email: 'me@gmail.com' }, error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let out: any
    await act(async () => {
      out = await result.current.signUp('Jane', 'Doe', '5551234567', 'pw', 'client', 'me@gmail.com')
    })
    expect(out).toEqual({ requiresVerification: true, personal_email: 'me@gmail.com' })
    expect(auth.signUp).toHaveBeenCalledWith({
      email: '',
      password: 'pw',
      options: { data: { first_name: 'Jane', last_name: 'Doe', mobile: '5551234567', role: 'client', personal_email: 'me@gmail.com' } },
    })
  })

  it('signOut() calls db.auth.signOut and clears the user', async () => {
    mockSession({ id: 'u1', email: 'a@b.com', role: 'client', created_at: '2024-01-01' })
    auth.signOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.user).not.toBeNull())

    await act(async () => {
      await result.current.signOut()
    })
    expect(auth.signOut).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })

  it('useAuth() throws when used outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/)
  })
})
