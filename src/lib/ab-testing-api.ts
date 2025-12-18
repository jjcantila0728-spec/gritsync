/**
 * A/B Testing API
 * Manages A/B tests for email campaigns
 * NOTE: This feature is currently stubbed pending full migration
 */

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

// Stubbed API - feature pending migration
export const abTestingAPI = {
  getTests: async (): Promise<ABTest[]> => [],
  getTest: async (_id: string): Promise<ABTest | null> => null,
  createTest: async (_test: Partial<ABTest>): Promise<ABTest | null> => null,
  updateTest: async (_id: string, _test: Partial<ABTest>): Promise<ABTest | null> => null,
  deleteTest: async (_id: string): Promise<boolean> => false,
  getResults: async (_testId: string): Promise<ABTestResult[]> => [],
  getRecipients: async (_testId: string): Promise<ABTestRecipient[]> => [],
  startTest: async (_id: string): Promise<boolean> => false,
  stopTest: async (_id: string): Promise<boolean> => false,
  selectWinner: async (_id: string, _variantName: string): Promise<boolean> => false,
  calculateStatistics: async (_testId: string): Promise<ABTestResult[]> => [],
}
