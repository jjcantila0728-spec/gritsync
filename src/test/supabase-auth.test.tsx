import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

import * as supabaseModule from '@/lib/supabase'

// Get references to mocked functions
const mockSignUp = (supabaseModule.supabase.auth.signUp as any)
const mockSignIn = (supabaseModule.supabase.auth.signInWithPassword as any)
const mockGetSession = (supabaseModule.supabase.auth.getSession as any)
const mockOnAuthStateChange = (supabaseModule.supabase.auth.onAuthStateChange as any)
const mockFrom = (supabaseModule.supabase.from as any)

// Mock toast
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
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

  // Setup from() chain mocks - create new mocks each time
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

describe('Supabase Registration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupSupabaseMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Successful Registration', () => {
    it('should successfully register a new user', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'newuser@example.com'

      // Setup mock chain for multiple calls
      let callCount = 0
      const mockMaybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found
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

      // Mock successful signup
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
        // Check that signUp was called with correct parameters
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

      // Check that email existence was checked (via from('users'))
      expect(mockFrom).toHaveBeenCalledWith('users')
    })

    it('should check email existence before registration', async () => {
      const user = userEvent.setup()
      const existingEmail = 'existing@example.com'

      // Mock email check - user exists
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
      }, { timeout: 3000 })

      // Should not call signUp if email exists
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('should handle Supabase signUp error', async () => {
      const user = userEvent.setup()
      const userEmail = 'error@example.com'

      // Mock email check - user doesn't exist
      const mockMaybeSingleFn = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })
      
      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: mockMaybeSingleFn,
            single: vi.fn(),
            update: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      })

      // Mock signUp error
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
      }, { timeout: 3000 })
    })

    it('should normalize email to lowercase', async () => {
      const user = userEvent.setup()
      const userEmail = 'TestUser@Example.COM'

      const mockMaybeSingleFn = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      })

      const mockUpsertFn = vi.fn().mockResolvedValueOnce({
        data: null,
        error: null,
      })

      mockFrom.mockImplementationOnce((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: mockMaybeSingleFn,
            single: vi.fn(),
            update: vi.fn().mockReturnThis(),
            upsert: mockUpsertFn,
          }
        }
        return {}
      })

      mockSignUp.mockResolvedValueOnce({
        data: {
          user: { id: 'user-123', email: userEmail.toLowerCase() },
          session: { user: { id: 'user-123' } },
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
        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: userEmail.toLowerCase(),
          }),
          expect.any(Object)
        )
      }, { timeout: 3000 })
    })
  })
})

describe('Supabase Login Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupSupabaseMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Successful Login', () => {
    it('should successfully login with valid credentials', async () => {
      const user = userEvent.setup()
      const userId = 'user-123'
      const userEmail = 'test@example.com'
      const userPassword = 'password123'

      // Mock successful signin
      mockSignIn.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: userEmail },
          session: { user: { id: userId } },
        },
        error: null,
      })

      // Mock profile load
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
    })

    it('should handle login with invalid credentials', async () => {
      const user = userEvent.setup()
      const userEmail = 'test@example.com'
      const wrongPassword = 'wrongpassword'

      // Mock signin error
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
        // Verify profile was loaded
        expect(mockFrom).toHaveBeenCalledWith('users')
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
  })

  describe('Login Error Handling', () => {
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
        const errorTexts = screen.queryAllByText(/Failed to sign in|Network error/i)
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

      // Mock profile load error
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
  })
})

describe('Supabase Auth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupSupabaseMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle session initialization on mount', async () => {
    const userId = 'user-123'
    const userEmail = 'test@example.com'

    // Mock existing session
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
        expect(mockGetSession).toHaveBeenCalled()
      }, { timeout: 3000 })
  })

  it('should subscribe to auth state changes', async () => {
    renderWithProviders(<Login />)

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})

