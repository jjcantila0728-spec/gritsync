/**
 * Analytics API
 * Handles analytics data retrieval and reporting
 * NOTE: This feature is currently stubbed pending full migration
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

// Stubbed API - feature pending migration
export const analyticsAPI = {
  getApplicationAnalytics: async (_range: AnalyticsDateRange): Promise<ApplicationAnalytics> => ({
    total: 0,
    by_status: {},
    by_service_type: {},
    daily_trends: [],
    approval_rate: 0,
    rejection_rate: 0,
    avg_processing_days: 0,
  }),
  getFinancialAnalytics: async (_range: AnalyticsDateRange): Promise<FinancialAnalytics> => ({
    total_revenue: 0,
    total_transactions: 0,
    by_payment_type: {},
    by_payment_method: {},
    daily_revenue: [],
    avg_transaction_value: 0,
    outstanding_balance: 0,
  }),
  getUserAnalytics: async (_range: AnalyticsDateRange): Promise<UserAnalytics> => ({
    total_users: 0,
    by_role: {},
    active_users: 0,
    new_users_daily: [],
    users_with_applications: 0,
  }),
  getDocumentAnalytics: async (_range: AnalyticsDateRange): Promise<DocumentAnalytics> => ({
    total_documents: 0,
    by_status: {},
    by_document_type: {},
    approval_rate: 0,
    rejection_rate: 0,
    avg_processing_days: 0,
  }),
  getCustomReports: async (): Promise<CustomReport[]> => [],
  createReport: async (_report: Partial<CustomReport>): Promise<CustomReport | null> => null,
  updateReport: async (_id: string, _report: Partial<CustomReport>): Promise<CustomReport | null> => null,
  deleteReport: async (_id: string): Promise<boolean> => false,
  runReport: async (_id: string): Promise<any> => null,
  getReportSchedules: async (): Promise<ReportSchedule[]> => [],
  createSchedule: async (_schedule: Partial<ReportSchedule>): Promise<ReportSchedule | null> => null,
  updateSchedule: async (_id: string, _schedule: Partial<ReportSchedule>): Promise<ReportSchedule | null> => null,
  deleteSchedule: async (_id: string): Promise<boolean> => false,
}
