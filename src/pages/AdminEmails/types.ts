import { ReceivedEmail } from '@/lib/resend-inbox-api'

export type Tab = 'inbox' | 'sent' | 'scheduled' | 'analytics' | 'campaigns' | 'subscribers' | 'ab-testing' | 'templates' | 'signatures' | 'email-setup'

export interface EnrichedReceivedEmail extends ReceivedEmail {
  senderName?: string
  senderAvatar?: string
  isRead?: boolean
}





