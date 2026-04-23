import { useState, useEffect } from 'react'
import { testSupabaseConnections, getTestSummary, type TestResult } from '@/lib/test-supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loading } from '@/components/ui/Loading'

export function TestSupabase() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(false)
  const [lastTest, setLastTest] = useState<Date | null>(null)

  const runTests = async () => {
    setLoading(true)
    try {
      const testResults = await testSupabaseConnections()
      setResults(testResults)
      setLastTest(new Date())
    } catch (error: any) {
      console.error('Test error:', error)
      setResults([
        {
          name: 'Test Execution',
          status: 'error',
          message: `Failed to run tests: ${error.message}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runTests()
  }, [])

  const summary = getTestSummary(results)

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return '✓'
      case 'error':
        return '✗'
      case 'warning':
        return '⚠'
      default:
        return '•'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Supabase Connection Tests</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Test all Supabase service connections and configurations
        </p>
      </div>

      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">Test Summary</h2>
              {lastTest && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last tested: {lastTest.toLocaleString()}
                </p>
              )}
            </div>
            <Button onClick={runTests} disabled={loading}>
              {loading ? 'Running Tests...' : 'Run Tests Again'}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loading />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Tests</div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {summary.success}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Success</div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {summary.errors}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Errors</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {summary.warnings}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Warnings</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        {results.map((result, index) => (
          <Card key={index}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-2xl ${getStatusColor(result.status)}`}>
                    {getStatusIcon(result.status)}
                  </span>
                  <h3 className="text-lg font-semibold">{result.name}</h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    result.status === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : result.status === 'error'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {result.status.toUpperCase()}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 ml-11 mb-3">{result.message}</p>
              {result.details && (
                <details className="ml-11">
                  <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                    View Details
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs overflow-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </Card>
        ))}
      </div>

      {results.length === 0 && !loading && (
        <Card>
          <div className="p-6 text-center text-gray-600 dark:text-gray-400">
            No test results available. Click "Run Tests Again" to start testing.
          </div>
        </Card>
      )}
    </div>
  )
}

