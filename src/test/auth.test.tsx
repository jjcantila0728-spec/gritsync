import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Register } from '@/pages/Register'
import { Login } from '@/pages/Login'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock Supabase
vi.mock('@/lib/supabase', () => {
  const mockSignUp = vi.fn()
  const mockSignIn = vi.fn()
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()
  const mockFrom = vi.fn()

  return {
    supabase: {
      auth: {
        signUp: mockSignUp,
        signInWithPassword: mockSignIn,
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signOut: vi.fn(),
      },
      from: mockFrom,
    },
    handleSupabaseError: vi.fn((error: any) => {
      throw new Error(error?.message || 'An unexpected error occurred')
    }),
  }
})

import * as supabaseModule from '@/lib/supabase'

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

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('Registration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(supabaseModule.supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    })
    ;(supabaseModule.supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    // Set up default Supabase from mock with proper chain
    ;(supabaseModule.supabase.from as any).mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnThis(),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return {}
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Form Validation', () => {
    it('should show error when first name is empty', async () => {
      renderWithProviders(<Register />)

      // Wait for form to be ready
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
      }, { timeout: 3000 })

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form, { preventDefault: () => {} })
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
        fireEvent.submit(form, { preventDefault: () => {} })
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
        fireEvent.submit(form, { preventDefault: () => {} })
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Last name is required/i)
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
        fireEvent.submit(form, { preventDefault: () => {} })
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
      const passwordInput = screen.getByPlaceholderText('••••••••')

      await user.type(firstNameInput, 'John')
      await user.type(lastNameInput, 'Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, '12345')

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form, { preventDefault: () => {} })
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
        fireEvent.submit(form, { preventDefault: () => {} })
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Passwords do not match/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })
  })

  describe('Successful Registration', () => {
    it('should successfully register with valid data', async () => {
      const user = userEvent.setup()
      ;(supabaseModule.supabase.auth.signUp as any).mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'john@example.com' },
          session: { user: { id: 'user-123' } },
        },
        error: null,
      })

      const mockSelect = vi.fn().mockResolvedValue({
        data: {
          id: 'user-123',
          email: 'john@example.com',
          role: 'client',
          full_name: 'John Doe',
        },
        error: null,
      })

      ;(supabaseModule.supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            select: vi.fn().mockReturnThis(),
            single: mockSelect,
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
      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(termsCheckbox)

      const submitButton = screen.getByRole('button', { name: /sign up/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(supabaseModule.supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'john@example.com',
          password: 'password123',
          options: {
            data: {
              first_name: 'John',
              last_name: 'Doe',
            },
          },
        }, { timeout: 3000 })
      })
    })

    it('should handle registration error', async () => {
      const user = userEvent.setup()
      ;(supabaseModule.supabase.auth.signUp as any).mockResolvedValue({
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
      await user.type(emailInput, 'existing@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(termsCheckbox)

      const form = screen.getByRole('button', { name: /sign up/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form, { preventDefault: () => {} })
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/User already exists/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })
  })

  describe('UI Interactions', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Register />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
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
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
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
  })
})

describe('Login Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(supabaseModule.supabase.auth.getSession as any).mockResolvedValue({
      data: { session: null },
    })
    ;(supabaseModule.supabase.auth.onAuthStateChange as any).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    // Set up default Supabase from mock with proper chain
    ;(supabaseModule.supabase.from as any).mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnThis(),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return {}
    })
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
        fireEvent.submit(form, { preventDefault: () => {} })
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
        fireEvent.submit(form, { preventDefault: () => {} })
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Please enter a valid email address/i)
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
        fireEvent.submit(form, { preventDefault: () => {} })
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Password is required/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })
  })

  describe('Successful Login', () => {
    it('should successfully login with valid credentials', async () => {
      const user = userEvent.setup()
      ;(supabaseModule.supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'john@example.com' },
          session: { user: { id: 'user-123' } },
        },
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
                email: 'john@example.com',
                role: 'client',
                full_name: 'John Doe',
              },
              error: null,
            }),
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

      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'password123')

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(supabaseModule.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'john@example.com',
          password: 'password123',
        }, { timeout: 3000 })
      })
    })

    it('should handle login error with invalid credentials', async () => {
      const user = userEvent.setup()
      ;(supabaseModule.supabase.auth.signInWithPassword as any).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      renderWithProviders(<Login />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
      }, { timeout: 3000 })

      const emailInput = screen.getByPlaceholderText('Enter your email')
      const passwordInput = screen.getByPlaceholderText('Enter your password')

      await user.type(emailInput, 'john@example.com')
      await user.type(passwordInput, 'wrongpassword')

      const form = screen.getByRole('button', { name: /sign in/i }).closest('form') as HTMLFormElement
      if (form) {
        fireEvent.submit(form, { preventDefault: () => {} })
      }

      await waitFor(() => {
        const errorTexts = screen.queryAllByText(/Invalid login credentials/i)
        expect(errorTexts.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
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
  })
})

