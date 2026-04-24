/**
 * A/B Testing API
 * Manages A/B tests for email campaigns
 */

import { supabase } from './api-client'

export interface ABTestVariant {
  name: string
  subject?: string
  content?: string
  sender_name?: string
  sender_email?: string
  send_time?: string
  [key: string]: any
}

export interface ABTest {
  id?: string
  campaign_id?: string
  name: string
  description?: string
  test_type: 'subject' | 'content' | 'sender' | 'send_time'
  variants: ABTestVariant[]
  sample_size?: number
  sample_percentage?: number
  winner_criteria: 'open_rate' | 'click_rate' | 'conversion_rate' | 'engagement_score'
  winner_variant?: string
  test_duration_hours?: number
  auto_send_winner?: boolean
  status?: 'draft' | 'scheduled' | 'running' | 'analyzing' | 'completed' | 'cancelled'
  started_at?: string
  completed_at?: string
  winner_selected_at?: string
  confidence_level?: number
  metadata?: Record<string, any>
  created_by_user_id?: string
  created_at?: string
  updated_at?: string
}

export interface ABTestResult {
  id?: string
  ab_test_id: string
  variant_name: string
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  bounced_count: number
  unsubscribed_count: number
  converted_count: number
  open_rate: number
  click_rate: number
  bounce_rate: number
  conversion_rate: number
  engagement_score: number
  avg_time_to_open?: number
  created_at?: string
  updated_at?: string
}

export interface ABTestRecipient {
  id?: string
  ab_test_id: string
  variant_name: string
  recipient_email: string
  recipient_user_id?: string
  email_log_id?: string
  sent_at?: string
  opened_at?: string
  clicked_at?: string
  converted_at?: string
  created_at?: string
}

export interface ABTestStats {
  draft_count: number
  running_count: number
  completed_count: number
  cancelled_count: number
  total_count: number
  avg_test_duration_hours: number
  tests_with_winners: number
}

export const abTestingAPI = {
  /**
   * Get all A/B tests
   */
  async getAll(filters?: {
    status?: string
    campaign_id?: string
    limit?: number
  }): Promise<ABTest[]> {
    let query = supabase
      .from('email_ab_tests')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.campaign_id) {
      query = query.eq('campaign_id', filters.campaign_id)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return (data || []) as ABTest[]
  },

  /**
   * Get A/B test by ID
   */
  async getById(id: string): Promise<ABTest | null> {
    const { data, error } = await supabase
      .from('email_ab_tests')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message)
    }

    return data as ABTest
  },

  /**
   * Create new A/B test
   */
  async create(test: Omit<ABTest, 'id' | 'created_at' | 'updated_at'>): Promise<ABTest> {
    const { data: { user } } = await supabase.auth.getUser()

    const testData = {
      ...test,
      created_by_user_id: user?.id || null,
      status: test.status || 'draft',
      sample_size: test.sample_size || 100,
      sample_percentage: test.sample_percentage || 10,
      test_duration_hours: test.test_duration_hours || 24,
      auto_send_winner: test.auto_send_winner !== undefined ? test.auto_send_winner : true,
      winner_criteria: test.winner_criteria || 'open_rate',
      metadata: test.metadata || {},
    }

    const { data, error } = await supabase
      .from('email_ab_tests')
      .insert(testData)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as ABTest
  },

  /**
   * Update A/B test
   */
  async update(id: string, updates: Partial<ABTest>): Promise<ABTest> {
    const { data, error } = await supabase
      .from('email_ab_tests')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as ABTest
  },

  /**
   * Delete A/B test
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('email_ab_tests')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  /**
   * Start A/B test
   */
  async start(id: string): Promise<ABTest> {
    return await this.update(id, {
      status: 'running',
      started_at: new Date().toISOString(),
    })
  },

  /**
   * Stop A/B test
   */
  async stop(id: string): Promise<ABTest> {
    return await this.update(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
  },

  /**
   * Cancel A/B test
   */
  async cancel(id: string): Promise<ABTest> {
    return await this.update(id, {
      status: 'cancelled',
    })
  },

  /**
   * Get A/B test results
   */
  async getResults(testId: string): Promise<ABTestResult[]> {
    const { data, error } = await supabase
      .from('email_ab_test_results')
      .select('*')
      .eq('ab_test_id', testId)
      .order('engagement_score', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []) as ABTestResult[]
  },

  /**
   * Calculate metrics for a test
   */
  async calculateMetrics(testId: string): Promise<void> {
    const { error } = await supabase.rpc('calculate_ab_test_metrics', {
      test_id: testId,
    })

    if (error) throw new Error(error.message)
  },

  /**
   * Determine winner
   */
  async determineWinner(testId: string): Promise<{
    success: boolean
    winner_variant?: string
    open_rate?: number
    click_rate?: number
    engagement_score?: number
    error?: string
  }> {
    const { data, error } = await supabase.rpc('determine_ab_test_winner', {
      test_id: testId,
    })

    if (error) throw new Error(error.message)
    return data as any
  },

  /**
   * Add recipient to test variant
   */
  async addRecipient(recipient: Omit<ABTestRecipient, 'id' | 'created_at'>): Promise<ABTestRecipient> {
    const { data, error } = await supabase
      .from('email_ab_test_recipients')
      .insert({
        ...recipient,
        sent_at: recipient.sent_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as ABTestRecipient
  },

  /**
   * Record email open
   */
  async recordOpen(recipientId: string): Promise<void> {
    const { error } = await supabase
      .from('email_ab_test_recipients')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', recipientId)

    if (error) throw new Error(error.message)
  },

  /**
   * Record email click
   */
  async recordClick(recipientId: string): Promise<void> {
    const { error } = await supabase
      .from('email_ab_test_recipients')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', recipientId)

    if (error) throw new Error(error.message)
  },

  /**
   * Record conversion
   */
  async recordConversion(recipientId: string): Promise<void> {
    const { error } = await supabase
      .from('email_ab_test_recipients')
      .update({ converted_at: new Date().toISOString() })
      .eq('id', recipientId)

    if (error) throw new Error(error.message)
  },

  /**
   * Get recipients for a test
   */
  async getRecipients(testId: string, variantName?: string): Promise<ABTestRecipient[]> {
    let query = supabase
      .from('email_ab_test_recipients')
      .select('*')
      .eq('ab_test_id', testId)

    if (variantName) {
      query = query.eq('variant_name', variantName)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return (data || []) as ABTestRecipient[]
  },

  /**
   * Get A/B testing statistics
   */
  async getStats(): Promise<ABTestStats> {
    const { data, error } = await supabase
      .from('ab_test_stats')
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return data as ABTestStats
  },

  /**
   * Assign recipients to variants (random distribution)
   */
  assignToVariant(variants: ABTestVariant[], recipientIndex: number): string {
    const variantIndex = recipientIndex % variants.length
    return variants[variantIndex].name
  },

  /**
   * Calculate statistical significance
   */
  calculateSignificance(
    variantA: ABTestResult,
    variantB: ABTestResult
  ): {
    significant: boolean
    confidenceLevel: number
    pValue: number
  } {
    // Simplified z-test for proportions
    const p1 = variantA.open_rate / 100
    const n1 = variantA.sent_count
    const p2 = variantB.open_rate / 100
    const n2 = variantB.sent_count

    if (n1 === 0 || n2 === 0) {
      return { significant: false, confidenceLevel: 0, pValue: 1 }
    }

    const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2)
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2))
    
    if (se === 0) {
      return { significant: false, confidenceLevel: 0, pValue: 1 }
    }

    const zScore = Math.abs((p1 - p2) / se)
    
    // Approximate p-value from z-score
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)))
    const confidenceLevel = (1 - pValue) * 100

    return {
      significant: pValue < 0.05, // 95% confidence
      confidenceLevel: Math.round(confidenceLevel * 100) / 100,
      pValue: Math.round(pValue * 10000) / 10000,
    }
  },

  /**
   * Normal CDF approximation (for statistical calculations)
   */
  normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x))
    const d = 0.3989423 * Math.exp(-x * x / 2)
    const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return x > 0 ? 1 - probability : probability
  },

  /**
   * Get recommendation for test duration
   */
  getRecommendedDuration(sampleSize: number, expectedEffect: number = 0.1): number {
    // Simplified calculation: larger sample = longer test
    // Base: 24 hours for 100 recipients
    const baseHours = 24
    const scaleFactor = sampleSize / 100
    return Math.max(12, Math.min(168, Math.round(baseHours * scaleFactor))) // Min 12h, max 168h (1 week)
  },

  /**
   * Validate A/B test configuration
   */
  validate(test: Partial<ABTest>): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!test.name || test.name.trim() === '') {
      errors.push('Test name is required')
    }

    if (!test.test_type) {
      errors.push('Test type is required')
    }

    if (!test.variants || test.variants.length < 2) {
      errors.push('At least 2 variants are required')
    }

    if (test.variants && test.variants.length > 10) {
      errors.push('Maximum 10 variants allowed')
    }

    if (test.sample_size && test.sample_size < 10) {
      errors.push('Sample size must be at least 10')
    }

    if (test.sample_percentage && (test.sample_percentage < 1 || test.sample_percentage > 100)) {
      errors.push('Sample percentage must be between 1 and 100')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },
}

