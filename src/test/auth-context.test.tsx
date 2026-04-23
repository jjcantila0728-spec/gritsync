import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

// Mock Supabase
vi.mock('@/lib/supabase', () => {
  const mockSignUp = vi.fn()
  const mockSignIn = vi.fn()
  const mockSignOut = vi.fn()
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()
  const mockFrom = vi.fn()

  return {
    supabase: {
      auth: {
        signUp: mockSignUp,
        signInWithPassword: mockSignIn,
        signOut: mockSignOut,
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
      },
      from: mockFrom,
    },
    handleSupabaseError: vi.fn((error: any) => {
      throw new Error(error?.message || 'An unexpected error occurred')
    }),
  }
})

import * as supabaseModule from '@/lib/supabase'

// Test component that uses auth
function TestComponent() {
  const { user, loading, signIn, signUp, signOut, isAdmin, isClient } = useAuth()

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <div data-testid="role">{user?.role || 'No role'}</div>
      <button onClick={() => signIn('test@example.com', 'password')}>Sign In</button>
      <button onClick={() => signUp('John', 'Doe', 'test@example.com', 'password')}>Sign Up</button>
      <button onClick={() => signOut()}>Sign Out</button>
      <div data-testid="is-admin">{isAdmin() ? 'true' : 'false'}</div>
      <div data-testid="is-client">{isClient() ? 'true' : 'false'}</div>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(supabaseModule.supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    })
    ;(supabaseModule.supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should provide auth context to children', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should handle sign in', async () => {
    const user = { id: 'user-123', email: 'test@example.com' }
    const session = { user }

    ;(supabaseModule.supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: { user, session },
      error: null,
    })

      ;(supabaseModule.supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                email: 'test@example.com',
                role: 'client',
                full_name: 'Test User',
              },
              error: null,
            }),
          }
        }
        return {}
      })

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    const signInButton = screen.getByText('Sign In')
    await userEvent.click(signInButton)

      await waitFor(() => {
        expect(supabaseModule.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password',
        })
      })
  })

  it('should handle sign up', async () => {
    const user = { id: 'user-123', email: 'test@example.com' }
    const session = { user }

    ;(supabaseModule.supabase.auth.signUp as any).mockResolvedValue({
      data: { user, session },
      error: null,
    })

      ;(supabaseModule.supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'user-123',
                email: 'test@example.com',
                role: 'client',
                full_name: 'John Doe',
              },
              error: null,
            }),
          }
        }
        return {}
      })

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    const signUpButton = screen.getByText('Sign Up')
    await userEvent.click(signUpButton)

      await waitFor(() => {
        expect(supabaseModule.supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password',
          options: {
            data: {
              first_name: 'John',
              last_name: 'Doe',
            },
          },
        })
      })
  })

  it('should handle sign out', async () => {
    ;(supabaseModule.supabase.auth.signOut as any).mockResolvedValue({ error: null })

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    const signOutButton = screen.getByText('Sign Out')
    await userEvent.click(signOutButton)

      await waitFor(() => {
        expect(supabaseModule.supabase.auth.signOut).toHaveBeenCalled()
      })
  })

  it('should correctly identify admin role', async () => {
    const user = { id: 'admin-123', email: 'admin@example.com' }
    const session = { user }

    ;(supabaseModule.supabase.auth.getSession as any).mockResolvedValue({
      data: { session },
    })

      ;(supabaseModule.supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'admin-123',
                email: 'admin@example.com',
                role: 'admin',
                full_name: 'Admin User',
              },
              error: null,
            }),
          }
        }
        return {}
      })

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true')
    })
  })

  it('should correctly identify client role', async () => {
    const user = { id: 'client-123', email: 'client@example.com' }
    const session = { user }

    ;(supabaseModule.supabase.auth.getSession as any).mockResolvedValue({
      data: { session },
    })

      ;(supabaseModule.supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'client-123',
                email: 'client@example.com',
                role: 'client',
                full_name: 'Client User',
              },
              error: null,
            }),
          }
        }
        return {}
      })

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('is-client')).toHaveTextContent('true')
    })
  })
})

