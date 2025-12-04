/**
 * End-to-End Authentication Tests
 * 
 * These tests use REAL Supabase to test actual registration and login flows.
 * They create and clean up test users automatically.
 * 
 * Requirements:
 * - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env
 * - Email confirmation should be disabled in Supabase Dashboard for testing
 * 
 * Run with: npm test e2e-auth
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables
config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Get Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables!\n' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file'
  )
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Test user data
interface TestUser {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: 'client' | 'admin'
}

// Store created user IDs for cleanup
const createdUserIds: string[] = []

// Helper function to generate unique test email
// Using example.com domain which is valid for testing
function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  return `${prefix}-${timestamp}-${random}@example.com`
}

// Helper function to create a test user
async function createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
  const user: TestUser = {
    email: generateTestEmail(),
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'client',
    ...userData,
  }

  // Sign up the user
  const { data, error } = await supabase.auth.signUp({
    email: user.email,
    password: user.password,
    options: {
      data: {
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role || 'client',
      },
    },
  })

  if (error) {
    // Log detailed error for debugging
    console.error('SignUp error details:', {
      message: error.message,
      status: error.status,
      name: error.name,
    })
    throw new Error(`Failed to create test user: ${error.message} (Status: ${error.status})`)
  }

  // Check if user was created even if there's no session
  if (!data.user) {
    throw new Error('SignUp succeeded but no user was returned')
  }

  if (data.user) {
    createdUserIds.push(data.user.id)
    
    // Wait for the trigger to create the profile (longer wait for reliability)
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Check if profile exists
    const { data: profileCheck, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('Error checking profile:', checkError.message, checkError.code)
    }

    // If profile exists, update it; if not, the trigger should have created it
    if (profileCheck) {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          first_name: user.firstName,
          last_name: user.lastName,
          role: user.role || 'client',
        })
        .eq('id', data.user.id)

      if (updateError) {
        console.warn('Could not update user profile:', updateError.message, updateError.code)
      }
    } else {
      console.warn('Profile not found after signup - trigger may not have run')
      // Don't throw - the test will verify if profile exists
    }
  }

  return user
}

// Helper function to cleanup test users
async function cleanupTestUsers() {
  for (const userId of createdUserIds) {
    try {
      // Sign in as the user first (if we have the session)
      await supabase.auth.signOut()
      
      // Try to delete via admin API if available
      // Note: This requires service role key, which we don't have in tests
      // So we'll just sign them out and let them be inactive
      
      // Delete from public.users table (if RLS allows)
      await supabase
        .from('users')
        .delete()
        .eq('id', userId)
        .catch(() => {
          // Ignore errors - user might not exist or RLS might block
        })
    } catch (error) {
      // Ignore cleanup errors
      console.warn(`Could not cleanup user ${userId}:`, error)
    }
  }
  createdUserIds.length = 0
}

describe('E2E Authentication Tests', () => {
  beforeAll(async () => {
    // Ensure we start with a clean session
    await supabase.auth.signOut()
    
    // Verify database setup
    console.log('\n🔍 Verifying database setup...')
    
    // Check if generate_grit_id function exists
    try {
      const { error: funcError } = await supabase.rpc('generate_grit_id')
      if (funcError && funcError.message.includes('function') && funcError.message.includes('does not exist')) {
        console.warn('⚠️  generate_grit_id() function not found. Run FIX_REGISTRATION_ERROR.sql')
      }
    } catch (e) {
      // Ignore RPC errors in test
    }
    
    // Check if we can query users table (tests RLS)
    const { error: queryError } = await supabase.from('users').select('count').limit(1)
    if (queryError && queryError.code === 'PGRST301') {
      console.warn('⚠️  RLS policies may be blocking. Run SIMPLE_FIX_403.sql')
    }
  })

  afterAll(async () => {
    // Cleanup all test users
    await cleanupTestUsers()
    await supabase.auth.signOut()
  })

  beforeEach(async () => {
    // Sign out before each test
    await supabase.auth.signOut()
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  })

  describe('User Registration', () => {
    it('should successfully register a new user', async () => {
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
      const testUser = await createTestUser({
        firstName: 'John',
        lastName: 'Doe',
      })

      expect(testUser.email).toBeDefined()
      expect(testUser.password).toBeDefined()
      
      // Verify user was created in auth
      const { data: session } = await supabase.auth.getSession()
      // Note: After signUp, we might not have a session immediately
      // depending on email confirmation settings
      
      // Wait a bit for profile to be created
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Try to sign in to verify the account works
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      expect(signInError).toBeNull()
      expect(signInData?.user).toBeDefined()
      expect(signInData?.user?.email).toBe(testUser.email)
    }, 30000)

    it('should create user profile in public.users table', async () => {
      const testUser = await createTestUser({
        firstName: 'Jane',
        lastName: 'Smith',
      })

      // Sign in to get the user ID
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      expect(signInData?.user).toBeDefined()
      const userId = signInData!.user!.id

      // Wait for profile to be created
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      expect(profileError).toBeNull()
      expect(profile).toBeDefined()
      expect(profile?.email).toBe(testUser.email)
      expect(profile?.first_name).toBe('Jane')
      expect(profile?.last_name).toBe('Smith')
      expect(profile?.role).toBe('client')
      expect(profile?.grit_id).toBeDefined()
    }, 30000)

    it('should prevent duplicate email registration', async () => {
      const testUser = await createTestUser()

      // Try to register again with the same email
      const { data, error } = await supabase.auth.signUp({
        email: testUser.email,
        password: 'AnotherPassword123!',
      })

      // Should fail with email already registered error
      expect(error).toBeDefined()
      expect(
        error?.message.includes('already') ||
        error?.message.includes('exists') ||
        error?.message.includes('registered')
      ).toBe(true)
    }, 30000)

    it('should generate a unique GRIT-ID for new users', async () => {
      const testUser = await createTestUser()

      // Sign in
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      const userId = signInData!.user!.id

      // Wait for profile
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Check GRIT-ID
      const { data: profile } = await supabase
        .from('users')
        .select('grit_id')
        .eq('id', userId)
        .single()

      expect(profile?.grit_id).toBeDefined()
      expect(profile?.grit_id).toMatch(/^GRIT\d{6}$/)
    }, 30000)
  })

  describe('User Login', () => {
    let testUser: TestUser

    beforeEach(async () => {
      // Create a test user for login tests
      testUser = await createTestUser({
        firstName: 'Login',
        lastName: 'Test',
      })
    })

    it('should successfully login with correct credentials', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      expect(error).toBeNull()
      expect(data?.user).toBeDefined()
      expect(data?.user?.email).toBe(testUser.email)
      expect(data?.session).toBeDefined()
    }, 30000)

    it('should fail login with incorrect password', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: 'WrongPassword123!',
      })

      expect(error).toBeDefined()
      expect(data?.user).toBeNull()
      expect(
        error?.message.includes('password') ||
        error?.message.includes('credentials') ||
        error?.message.includes('invalid')
      ).toBe(true)
    }, 30000)

    it('should fail login with non-existent email', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      })

      expect(error).toBeDefined()
      expect(data?.user).toBeNull()
    }, 30000)

    it('should load user profile after login', async () => {
      // Sign in
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      expect(signInData?.user).toBeDefined()
      const userId = signInData!.user!.id

      // Wait for profile
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Load profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      expect(profileError).toBeNull()
      expect(profile).toBeDefined()
      expect(profile?.email).toBe(testUser.email)
      expect(profile?.first_name).toBe('Login')
      expect(profile?.last_name).toBe('Test')
    }, 30000)
  })

  describe('User Profile Management', () => {
    let testUser: TestUser

    beforeEach(async () => {
      testUser = await createTestUser({
        firstName: 'Profile',
        lastName: 'Test',
      })
    })

    it('should allow users to read their own profile', async () => {
      // Sign in
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      const userId = signInData!.user!.id

      // Wait for profile
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Read profile
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      expect(error).toBeNull()
      expect(profile).toBeDefined()
      expect(profile?.id).toBe(userId)
    }, 30000)

    it('should allow users to update their own profile', async () => {
      // Sign in
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      const userId = signInData!.user!.id

      // Wait for profile
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Update profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('users')
        .update({
          first_name: 'Updated',
          last_name: 'Name',
        })
        .eq('id', userId)
        .select()
        .single()

      expect(updateError).toBeNull()
      expect(updatedProfile).toBeDefined()
      expect(updatedProfile?.first_name).toBe('Updated')
      expect(updatedProfile?.last_name).toBe('Name')
    }, 30000)
  })

  describe('Session Management', () => {
    let testUser: TestUser

    beforeEach(async () => {
      testUser = await createTestUser()
    })

    it('should maintain session after login', async () => {
      // Sign in
      await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      // Check session
      const { data: session } = await supabase.auth.getSession()
      expect(session?.session).toBeDefined()
      expect(session?.session?.user?.email).toBe(testUser.email)
    }, 30000)

    it('should clear session after sign out', async () => {
      // Sign in
      await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      })

      // Sign out
      const { error: signOutError } = await supabase.auth.signOut()
      expect(signOutError).toBeNull()

      // Check session is cleared
      const { data: session } = await supabase.auth.getSession()
      expect(session?.session).toBeNull()
    }, 30000)
  })
})

