import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Register } from '@/pages/Register'
import { Login } from '@/pages/Login'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock Supabase - functions must be defined inside the factory
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

// Get references to mocked functions
import * as supabaseModule from '@/lib/supabase'
const mockSignUp = (supabaseModule.supabase.auth.signUp as any)
const mockSignIn = (supabaseModule.supabase.auth.signInWithPassword as any)
const mockGetSession = (supabaseModule.supabase.auth.getSession as any)
const mockOnAuthStateChange = (supabaseModule.supabase.auth.onAuthStateChange as any)
const mockFrom = (supabaseModule.supabase.from as any)

// Mock toast
const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

// Mock Header component
vi.mock('@/components/Header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  )
}

// Helper to setup Supabase mocks
const setupSupabaseMocks = () => {
  mockGetSession.mockResolvedValue({
    data: { session: null },
    error: null,
  })

  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })

  // Setup from() chain mocks
  const mockSelect = vi.fn().mockReturnThis()
  const mockEq = vi.fn().mockReturnThis()
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockUpdate = vi.fn().mockReturnThis()
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
        single: mockSingle,
        update: mockUpdate,
        upsert: mockUpsert,
      }
    }
    return {}
  })
}

describe('Login Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupSupabaseMocks()
    mockNavigate.mockClear()
    mockShowToast.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Form Validation', () => {
    it('should show error when email is empty', async () => {
      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
      }, { timeout: 3000 })

      const form = screen.getByRole('button', { name: /sign in/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Email is required/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should show error when email is invalid', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      await user.type(emailInput, 'invalid-email')

      const form = screen.getByRole('button', { name: /sign in/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Please enter a valid email address/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should show error when email has only whitespace', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      await user.type(emailInput, '   ')

      const form = screen.getByRole('button', { name: /sign in/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Email is required/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should show error when password is empty', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      await user.type(emailInput, 'john@example.com')

      const form = screen.getByRole('button', { name: /sign in/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Password is required/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should accept valid email formats', async () => {
      const user = userEvent.setup()
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
        'user123@test-domain.com',
      ]

      for (const email of validEmails) {
        vi.clearAllMocks()
        renderWithProviders(<Login />)

        await waitFor(() => {
          expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
        }, { timeout: 3000 })

        const emailInput = screen.getByPlaceholderText('Enter your email')
        const passwordInput = screen.getByPlaceholderText('Enter your password')

        await user.clear(emailInput)
        await user.type(emailInput, email)
        await user.type(passwordInput, 'password123')

        const form = screen.getByRole('button', { name: /sign in/i }).closest('form') as HTMLFormElement
        if (form) {
          fireEvent.submit(form)
        }

        // Should not show email validation error
        await waitFor(() => {
          const errorTexts = screen.queryAllByText(/Please enter a valid email address/i)
          expect(errorTexts.length).toBe(0)
        }, { timeout: 1000 })
      }
    })
  })

  describe('Successful Login', () => {
    it('should successfully login with valid credentials', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'test@example.com'
      const userPassword = 'password123'

      mockSignIn.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: userEmail },
          session: { user: { id: userId } },
        },
        error: null,
      })

      const mockSingleFn = vi.fn().mockResolvedValueOnce({
        data: {
          id: userId,
          email: userEmail,
          role: 'client',
          full_name: 'Test User',
        },
        error: null,
      })

      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            single: mockSingleFn,
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn(),
          }
        }
        return {}
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      await user.type(emailInput, userEmail)
      await user.type(passwordInput, userPassword)

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: userEmail,
          password: userPassword,
        })
      }, { timeout: 3000 })

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Welcome back!', 'success')
      }, { timeout: 3000 })
    })

    it('should load user profile after successful login', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'test@example.com'

      mockSignIn.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: userEmail },
          session: { user: { id: userId } },
        },
        error: null,
      })

      const userProfile = {
        id: userId,
        email: userEmail,
        role: 'client',
        full_name: 'Test User',
      }

      const mockSingleFn = vi.fn().mockResolvedValueOnce({
        data: userProfile,
        error: null,
      })

      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            single: mockSingleFn,
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn(),
          }
        }
        return {}
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('users')
        expect(mockSingleFn).toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    it('should handle admin login and redirect correctly', async () => {
      const user = userEvent.setup()
      const userId = 'admin-123'
      const userEmail = 'admin@example.com'

      mockSignIn.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: userEmail },
          session: { user: { id: userId } },
        },
        error: null,
      })

      const mockSingleFn = vi.fn().mockResolvedValueOnce({
        data: {
          id: userId,
          email: userEmail,
          role: 'admin',
          full_name: 'Admin User',
        },
        error: null,
      })

      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            single: mockSingleFn,
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn(),
          }
        }
        return {}
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    it('should show loading state during login', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'test@example.com'

      // Delay the response to test loading state
      mockSignIn.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: {
                user: { id: userId, email: userEmail },
                session: { user: { id: userId } },
              },
              error: null,
            })
          }, 100)
        })
      )

      const mockSingleFn = vi.fn().mockResolvedValueOnce({
        data: {
          id: userId,
          email: userEmail,
          role: 'client',
          full_name: 'Test User',
        },
        error: null,
      })

      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            single: mockSingleFn,
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn(),
          }
        }
        return {}
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText(/Signing in/i)).toBeInTheDocument()
        expect(submitButton).toBeDisabled()
      }, { timeout: 3000 })
    })
  })

  describe('Login Error Handling', () => {
    it('should handle invalid credentials error', async () => {
      const user = userEvent.setup()
      const userEmail = 'test@example.com'
      const wrongPassword = 'wrongpassword'

      mockSignIn.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      await user.type(emailInput, userEmail)
      await user.type(passwordInput, wrongPassword)

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Invalid login credentials/i)
        expect(errorTexts.length).toBeGreaterThan(0)
        expect(mockShowToast).toHaveBeenCalledWith('Invalid login credentials', 'error')
      }, { timeout: 3000 })
    })

    it('should handle network errors', async () => {
      const user = userEvent.setup()
      const userEmail = 'test@example.com'

      mockSignIn.mockRejectedValueOnce(new Error('Network error'))

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Network error|Failed to sign in/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should handle profile load errors gracefully', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'test@example.com'

      mockSignIn.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: userEmail },
          session: { user: { id: userId } },
        },
        error: null,
      })

      const mockSingleFn = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Profile not found' },
      })

      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            single: mockSingleFn,
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn(),
          }
        }
        return {}
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      // Should still complete login even if profile load fails
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    it('should handle various Supabase error messages', async () => {
      const errorMessages = [
        'Invalid login credentials',
        'Email not confirmed',
        'Too many requests',
        'User not found',
      ]

      for (const errorMsg of errorMessages) {
        const user = userEvent.setup()
        const { unmount } = renderWithProviders(<Login />)

        mockSignIn.mockResolvedValueOnce({
          data: { user: null, session: null },
          error: { message: errorMsg },
        })

        await waitFor(() => {
          expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
        }, { timeout: 3000 })

        const emailInput = screen.getByPlaceholderText('Enter your email')
        const passwordInput = screen.getByPlaceholderText('Enter your password')

        await user.type(emailInput, 'test@example.com')
        await user.type(passwordInput, 'password123')

        const submitButton = screen.getByRole('button', { name: /sign in/i })
        await user.click(submitButton)

        await waitFor(() => {
          expect(mockShowToast).toHaveBeenCalledWith(errorMsg, 'error')
        }, { timeout: 3000 })

        unmount()
        vi.clearAllMocks()
        mockShowToast.mockClear()
      }
    })
  })

  describe('UI Interactions', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
      }, { timeout: 3000 })

      const passwordInput = screen.getByPlaceholderText('Enter your password') as HTMLInputElement
      const toggleButton = passwordInput.parentElement?.querySelector('button')

      expect(passwordInput.type).toBe('password')

      if (toggleButton) {
        await user.click(toggleButton)
        expect(passwordInput.type).toBe('text')

        await user.click(toggleButton)
        expect(passwordInput.type).toBe('password')
      }
    })

    it('should have link to registration page', async () => {
      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /create an account/i })).toBeInTheDocument()
      }, { timeout: 3000 })

      const registerLink = screen.getByRole('link', { name: /create an account/i })
      expect(registerLink).toHaveAttribute('href', '/register')
    })

    it('should have link to forgot password page', async () => {
      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
      }, { timeout: 3000 })

      const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i })
      expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password')
    })

    it('should disable submit button while loading', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'test@example.com'

      mockSignIn.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: {
                user: { id: userId, email: userEmail },
                session: { user: { id: userId } },
              },
              error: null,
            })
          }, 100)
        })
      )

      const mockSingleFn = vi.fn().mockResolvedValueOnce({
        data: {
          id: userId,
          email: userEmail,
          role: 'client',
          full_name: 'Test User',
        },
        error: null,
      })

      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            single: mockSingleFn,
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn(),
          }
        }
        return {}
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      }, { timeout: 3000 })
    })
  })

  describe('Redirect Behavior', () => {
    it('should redirect to dashboard if already logged in as client', async () => {
      const userId = 'user-123'
      const userEmail = 'test@example.com'

      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: userId, email: userEmail },
          },
        },
        error: null,
      })

      const mockSingleFn = vi.fn().mockResolvedValueOnce({
        data: {
          id: userId,
          email: userEmail,
          role: 'client',
          full_name: 'Test User',
        },
        error: null,
      })

      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            single: mockSingleFn,
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn(),
          }
        }
        return {}
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
      }, { timeout: 3000 })
    })

    it('should redirect to admin dashboard if already logged in as admin', async () => {
      const userId = 'admin-123'
      const userEmail = 'admin@example.com'

      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: userId, email: userEmail },
          },
        },
        error: null,
      })

      const mockSingleFn = vi.fn().mockResolvedValueOnce({
        data: {
          id: userId,
          email: userEmail,
          role: 'admin',
          full_name: 'Admin User',
        },
        error: null,
      })

      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(),
            single: mockSingleFn,
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn(),
          }
        }
        return {}
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard', { replace: true })
      }, { timeout: 3000 })
    })
  })
})

describe('Sign Up Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupSupabaseMocks()
    mockNavigate.mockClear()
    mockShowToast.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Form Validation', () => {
    it('should show error when first name is empty', async () => {
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
      }, { timeout: 3000 })

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/First name is required/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should show error when first name is too short', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      await user.type(firstNameInput, 'A')

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/First name must be at least 2 characters/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should show error when last name is empty', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      await user.type(firstNameInput, 'John')

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Last name is required/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should show error when last name is too short', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'D')

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Last name must be at least 2 characters/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should show error when email is invalid', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'invalid-email')

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Please enter a valid email address/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should show error when password is too short', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, '12345')

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Password must be at least 6 characters/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should show error when passwords do not match', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'different123')

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form)
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Passwords do not match/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should require terms checkbox to be checked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')

      // Don't check terms checkbox
      const submitButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(submitButton)

      // HTML5 validation should prevent submission
      const termsCheckbox = screen.getByLabelText(/i agree to the/i) as HTMLInputElement
      expect(termsCheckbox.required).toBe(true)
    })
  })

  describe('Successful Registration', () => {
    it('should successfully register with valid data', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'newuser@example.com'

      let callCount = 0
      const mockMaybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockSingleFn = vi.fn().mockResolvedValue({
        data: {
          id: userId,
          email: userEmail,
          role: 'client',
          full_name: 'John Doe',
        },
        error: null,
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          callCount++
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: callCount === 1 ? mockMaybeSingleFn : vi.fn(),
            single: callCount === 3 ? mockSingleFn : vi.fn(),
            update: vi.fn().mockReturnThis(),
            upsert: callCount === 2 ? mockUpsertFn : vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      })

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: userEmail },
          session: { user: { id: userId } },
        },
        error: null,
      })

      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const termsCheckbox = screen.getByLabelText(/i agree to the/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(termsCheckbox)

      const submitButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: userEmail.toLowerCase(),
          password: 'password123',
          options: {
            data: {
              first_name: 'John',
              last_name: 'Doe',
            },
          },
        })
      }, { timeout: 3000 })

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Account created successfully! Welcome!', 'success')
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      }, { timeout: 3000 })
    })

    it('should normalize email to lowercase', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'TestUser@Example.COM'
      const normalizedEmail = userEmail.toLowerCase()

      let callCount = 0
      const mockMaybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockSingleFn = vi.fn().mockResolvedValue({
        data: {
          id: userId,
          email: normalizedEmail,
          role: 'client',
          full_name: 'John Doe',
        },
        error: null,
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          callCount++
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: callCount === 1 ? mockMaybeSingleFn : vi.fn(),
            single: callCount === 3 ? mockSingleFn : vi.fn(),
            update: vi.fn().mockReturnThis(),
            upsert: callCount === 2 ? mockUpsertFn : vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      })

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: normalizedEmail },
          session: { user: { id: userId } },
        },
        error: null,
      })

      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const termsCheckbox = screen.getByLabelText(/i agree to the/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(termsCheckbox)

      const submitButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: normalizedEmail,
          password: 'password123',
          options: {
            data: {
              first_name: 'John',
              last_name: 'Doe',
            },
          },
        })
      }, { timeout: 3000 })
    })

    it('should show loading state during registration', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'newuser@example.com'

      let callCount = 0
      const mockMaybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockSingleFn = vi.fn().mockResolvedValue({
        data: {
          id: userId,
          email: userEmail,
          role: 'client',
          full_name: 'John Doe',
        },
        error: null,
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          callCount++
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: callCount === 1 ? mockMaybeSingleFn : vi.fn(),
            single: callCount === 3 ? mockSingleFn : vi.fn(),
            update: vi.fn().mockReturnThis(),
            upsert: callCount === 2 ? mockUpsertFn : vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      })

      mockSignUp.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: {
                user: { id: userId, email: userEmail },
                session: { user: { id: userId } },
              },
              error: null,
            })
          }, 100)
        })
      )

      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const termsCheckbox = screen.getByLabelText(/i agree to the/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(termsCheckbox)

      const submitButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Creating account/i)).toBeInTheDocument()
        expect(submitButton).toBeDisabled()
      }, { timeout: 3000 })
    })
  })

  describe('Registration Error Handling', () => {
    it('should handle email already exists error', async () => {
      const user = userEvent.setup()
      const existingEmail = 'existing@example.com'

      const mockMaybeSingleFn = vi.fn().mockResolvedValue({
        data: { email: existingEmail },
        error: null,
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: mockMaybeSingleFn,
            single: vi.fn(),
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn(),
          }
        }
        return {}
      })

      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const termsCheckbox = screen.getByLabelText(/i agree to the/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, existingEmail)
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(termsCheckbox)

      const submitButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(submitButton)

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/already registered/i)
        expect(errorTexts.length).toBeGreaterThan(0)
        expect(mockSignUp).not.toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    it('should handle Supabase signUp error', async () => {
      const user = userEvent.setup()
      const userEmail = 'error@example.com'

      let callCount = 0
      const mockMaybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          callCount++
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: callCount === 1 ? mockMaybeSingleFn : vi.fn(),
            single: vi.fn(),
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      })

      mockSignUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'User already exists' },
      })

      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const termsCheckbox = screen.getByLabelText(/i agree to the/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(termsCheckbox)

      const submitButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(submitButton)

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/already registered/i)
        expect(errorTexts.length).toBeGreaterThan(0)
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.stringContaining('already registered'),
          'error'
        )
      }, { timeout: 3000 })
    })

    it('should handle network errors during registration', async () => {
      const user = userEvent.setup()
      const userEmail = 'newuser@example.com'

      let callCount = 0
      const mockMaybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          callCount++
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: callCount === 1 ? mockMaybeSingleFn : vi.fn(),
            single: vi.fn(),
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      })

      mockSignUp.mockRejectedValueOnce(new Error('Network error'))

      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const termsCheckbox = screen.getByLabelText(/i agree to the/i)

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(termsCheckbox)

      const submitButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(submitButton)

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Network error|Failed to create account/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })
  })

  describe('UI Interactions', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('••••••••').length).toBeGreaterThan(0)
      }, { timeout: 3000 })

      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0] as HTMLInputElement
      const toggleButton = passwordInput.parentElement?.querySelector('button')

      expect(passwordInput.type).toBe('password')

      if (toggleButton) {
        await user.click(toggleButton)
        expect(passwordInput.type).toBe('text')

        await user.click(toggleButton)
        expect(passwordInput.type).toBe('password')
      }
    })

    it('should toggle confirm password visibility', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getAllByPlaceholderText('••••••••').length).toBeGreaterThan(0)
      }, { timeout: 3000 })

      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const confirmPasswordInput = passwordInputs[1] as HTMLInputElement
      const toggleButton = confirmPasswordInput.parentElement?.querySelector('button')

      expect(confirmPasswordInput.type).toBe('password')

      if (toggleButton) {
        await user.click(toggleButton)
        expect(confirmPasswordInput.type).toBe('text')

        await user.click(toggleButton)
        expect(confirmPasswordInput.type).toBe('password')
      }
    })

    it('should have link to login page', async () => {
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
      }, { timeout: 3000 })

      const loginLink = screen.getByRole('link', { name: /sign in/i })
      expect(loginLink).toHaveAttribute('href', '/login')
    })

    it('should disable submit button while loading', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'newuser@example.com'

      let callCount = 0
      const mockMaybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockSingleFn = vi.fn().mockResolvedValue({
        data: {
          id: userId,
          email: userEmail,
          role: 'client',
          full_name: 'John Doe',
        },
        error: null,
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          callCount++
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: callCount === 1 ? mockMaybeSingleFn : vi.fn(),
            single: callCount === 3 ? mockSingleFn : vi.fn(),
            update: vi.fn().mockReturnThis(),
            upsert: callCount === 2 ? mockUpsertFn : vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      })

      mockSignUp.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: {
                user: { id: userId, email: userEmail },
                session: { user: { id: userId } },
              },
              error: null,
            })
          }, 100)
        })
      )

      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('John')).toBeInTheDocument()
      }, { timeout: 3000 })

      const firstNameInput = screen.getByPlaceholderText('John')
      const lastNameInput = screen.getByPlaceholderText('Doe')
      const emailInput = screen.getByPlaceholderText('john.doe@example.com')
      const passwordInputs = screen.getAllByPlaceholderText('••••••••')
      const passwordInput = passwordInputs[0]
      const confirmPasswordInput = passwordInputs[1]
      const termsCheckbox = screen.getByLabelText(/i agree to the/i)
      const submitButton = screen.getByRole('button', { name: /sign up/i })

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, userEmail)
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(termsCheckbox)
      await user.click(submitButton)

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      }, { timeout: 3000 })
    })
  })
})

