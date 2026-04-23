import { supabase } from './supabase'

export interface TestResult {
  name: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: any
}

export async function testSupabaseConnections(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // Test 1: Client Initialization
  try {
    if (!supabase) {
      results.push({
        name: 'Client Initialization',
        status: 'error',
        message: 'Supabase client is not initialized',
      })
    } else {
      results.push({
        name: 'Client Initialization',
        status: 'success',
        message: 'Supabase client initialized successfully',
        details: {
          url: 'Supabase client initialized',
        },
      })
    }
  } catch (error: any) {
    results.push({
      name: 'Client Initialization',
      status: 'error',
      message: `Failed to initialize client: ${error.message}`,
    })
  }

  // Test 2: Database Connection (Test Query)
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)

    if (error) {
      results.push({
        name: 'Database Connection',
        status: 'error',
        message: `Database query failed: ${error.message}`,
        details: { error: error },
      })
    } else {
      results.push({
        name: 'Database Connection',
        status: 'success',
        message: 'Successfully connected to database',
        details: { queryResult: data },
      })
    }
  } catch (error: any) {
    results.push({
      name: 'Database Connection',
      status: 'error',
      message: `Database connection error: ${error.message}`,
    })
  }

  // Test 3: Authentication Service
  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      results.push({
        name: 'Authentication Service',
        status: 'error',
        message: `Auth service error: ${error.message}`,
      })
    } else {
      results.push({
        name: 'Authentication Service',
        status: 'success',
        message: session ? 'Auth service connected (user logged in)' : 'Auth service connected (no active session)',
        details: { hasSession: !!session },
      })
    }
  } catch (error: any) {
    results.push({
      name: 'Authentication Service',
      status: 'error',
      message: `Auth service error: ${error.message}`,
    })
  }

  // Test 4: Storage Connection
  try {
    const { data, error } = await supabase.storage.listBuckets()

    if (error) {
      results.push({
        name: 'Storage Connection',
        status: 'error',
        message: `Storage connection failed: ${error.message}`,
        details: { error: error },
      })
    } else {
      const documentsBucket = data?.find(bucket => bucket.name === 'documents')
      results.push({
        name: 'Storage Connection',
        status: documentsBucket ? 'success' : 'warning',
        message: documentsBucket
          ? 'Storage connected and documents bucket found'
          : 'Storage connected but documents bucket not found',
        details: {
          buckets: data?.map(b => b.name) || [],
          hasDocumentsBucket: !!documentsBucket,
        },
      })
    }
  } catch (error: any) {
    results.push({
      name: 'Storage Connection',
      status: 'error',
      message: `Storage connection error: ${error.message}`,
    })
  }

  // Test 5: Realtime Connection
  try {
    const channel = supabase.channel('test-connection')
    const subscribePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Realtime subscription timeout'))
      }, 5000)

      channel
        .subscribe((status) => {
          clearTimeout(timeout)
          if (status === 'SUBSCRIBED') {
            resolve(status)
          } else if (status === 'CHANNEL_ERROR') {
            reject(new Error('Channel error'))
          }
        })
    })

    await subscribePromise
    supabase.removeChannel(channel)

    results.push({
      name: 'Realtime Connection',
      status: 'success',
      message: 'Realtime service connected successfully',
    })
  } catch (error: any) {
    results.push({
      name: 'Realtime Connection',
      status: 'warning',
      message: `Realtime connection issue: ${error.message}`,
      details: { note: 'Realtime may require specific configuration in Supabase dashboard' },
    })
  }

  // Test 6: RLS Policies (Test if user can query their own data)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('id', user.id)
        .single()

      if (error) {
        results.push({
          name: 'RLS Policies',
          status: 'error',
          message: `RLS policy test failed: ${error.message}`,
          details: { error: error },
        })
      } else {
        results.push({
          name: 'RLS Policies',
          status: 'success',
          message: 'RLS policies working correctly (can access own data)',
          details: { userRole: (data as { role?: string } | null)?.role },
        })
      }
    } else {
      results.push({
        name: 'RLS Policies',
        status: 'warning',
        message: 'RLS test skipped (no authenticated user)',
        details: { note: 'Login to test RLS policies' },
      })
    }
  } catch (error: any) {
    results.push({
      name: 'RLS Policies',
      status: 'error',
      message: `RLS test error: ${error.message}`,
    })
  }

  // Test 7: Environment Variables
  const envVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set (hidden)' : 'Missing',
  }

  const hasAllEnvVars = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY

  results.push({
    name: 'Environment Variables',
    status: hasAllEnvVars ? 'success' : 'error',
    message: hasAllEnvVars
      ? 'All required environment variables are set'
      : 'Missing required environment variables',
    details: envVars,
  })

  return results
}

export function getTestSummary(results: TestResult[]): {
  total: number
  success: number
  errors: number
  warnings: number
} {
  return {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    errors: results.filter(r => r.status === 'error').length,
    warnings: results.filter(r => r.status === 'warning').length,
  }
}

