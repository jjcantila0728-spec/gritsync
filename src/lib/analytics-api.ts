/**
 * Analytics API
 * Handles analytics data retrieval and reporting
 */


export interface AnalyticsDateRange {
  startDate: string
  endDate: string
}

export interface ApplicationAnalytics {
  total: number
  by_status: Record<string, number>
  by_service_type: Record<string, number>
  daily_trends: Array<{ date: string; count: number }>
  approval_rate: number
  rejection_rate: number
  avg_processing_days: number
}

export interface FinancialAnalytics {
  total_revenue: number
  total_transactions: number
  by_payment_type: Record<string, { count: number; total: number }>
  by_payment_method: Record<string, { count: number; total: number }>
  daily_revenue: Array<{ date: string; revenue: number; transactions: number }>
  avg_transaction_value: number
  outstanding_balance: number
}

export interface UserAnalytics {
  total_users: number
  by_role: Record<string, number>
  active_users: number
  new_users_daily: Array<{ date: string; count: number }>
  users_with_applications: number
}

export interface DocumentAnalytics {
  total_documents: number
  by_status: Record<string, number>
  by_document_type: Record<string, number>
  approval_rate: number
  rejection_rate: number
  avg_processing_days: number
}

export interface CustomReport {
  id?: string
  name: string
  description?: string
  report_config: Record<string, any>
  is_public?: boolean
  created_by_user_id?: string
  created_at?: string
  updated_at?: string
  last_run_at?: string
}

export interface ReportSchedule {
  id?: string
  report_id: string
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom'
  schedule_config: Record<string, any>
  recipients: string[]
  format?: 'pdf' | 'csv' | 'excel' | 'json'
  is_active?: boolean
  last_run_at?: string
  next_run_at?: string
  created_at?: string
  updated_at?: string
}

export const analyticsAPI = {
  /**
   * Get application analytics
   */
  async getApplicationAnalytics(
    dateRange?: AnalyticsDateRange
  ): Promise<ApplicationAnalytics> {
    const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = dateRange?.endDate || new Date().toISOString()

    const { data, error } = await supabase.rpc('get_application_analytics', {
      p_start_date: startDate,
      p_end_date: endDate,
    })

    if (error) throw new Error(error.message)
    return data as ApplicationAnalytics
  },

  /**
   * Get financial analytics
   */
  async getFinancialAnalytics(
    dateRange?: AnalyticsDateRange
  ): Promise<FinancialAnalytics> {
    const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = dateRange?.endDate || new Date().toISOString()

    const { data, error } = await supabase.rpc('get_financial_analytics', {
      p_start_date: startDate,
      p_end_date: endDate,
    })

    if (error) throw new Error(error.message)
    return data as FinancialAnalytics
  },

  /**
   * Get user analytics
   */
  async getUserAnalytics(
    dateRange?: AnalyticsDateRange
  ): Promise<UserAnalytics> {
    const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = dateRange?.endDate || new Date().toISOString()

    const { data, error } = await supabase.rpc('get_user_analytics', {
      p_start_date: startDate,
      p_end_date: endDate,
    })

    if (error) throw new Error(error.message)
    return data as UserAnalytics
  },

  /**
   * Get document analytics
   */
  async getDocumentAnalytics(
    dateRange?: AnalyticsDateRange
  ): Promise<DocumentAnalytics> {
    const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = dateRange?.endDate || new Date().toISOString()

    const { data, error } = await supabase.rpc('get_document_analytics', {
      p_start_date: startDate,
      p_end_date: endDate,
    })

    if (error) throw new Error(error.message)
    return data as DocumentAnalytics
  },

  /**
   * Get cached analytics (if available)
   */
  async getCachedAnalytics(cacheKey: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('analytics_cache')
      .select('cache_data')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) return null
    return data.cache_data
  },

  /**
   * Set cached analytics
   */
  async setCachedAnalytics(
    cacheKey: string,
    data: any,
    expiresInMinutes: number = 60
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()

    await supabase
      .from('analytics_cache')
      .upsert({
        cache_key: cacheKey,
        cache_data: data,
        expires_at: expiresAt,
      })
  },

  /**
   * Get all custom reports
   */
  async getCustomReports(): Promise<CustomReport[]> {
    const { data, error } = await supabase
      .from('custom_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []) as CustomReport[]
  },

  /**
   * Get custom report by ID
   */
  async getCustomReportById(id: string): Promise<CustomReport | null> {
    const { data, error } = await supabase
      .from('custom_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(error.message)
    }

    return data as CustomReport
  },

  /**
   * Create custom report
   */
  async createCustomReport(report: Omit<CustomReport, 'id' | 'created_at' | 'updated_at'>): Promise<CustomReport> {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('custom_reports')
      .insert({
        ...report,
        created_by_user_id: user?.id || null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as CustomReport
  },

  /**
   * Update custom report
   */
  async updateCustomReport(id: string, updates: Partial<CustomReport>): Promise<CustomReport> {
    const { data, error } = await supabase
      .from('custom_reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return data as CustomReport
  },

  /**
   * Delete custom report
   */
  async deleteCustomReport(id: string): Promise<void> {
    const { error } = await supabase
      .from('custom_reports')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
  },
}



