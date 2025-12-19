/**
 * Newsletter API
 * Handles newsletter subscriptions via backend API
 */

import { apiClient } from './api-client'

export interface NewsletterSubscription {
  id: string
  email: string
  subscription_type: 'visa_bulletin' | 'general' | 'all'
  subscribed_at?: string
  is_active: boolean
  unsubscribed_at?: string
  created_at?: string
}

export async function subscribeToNewsletter(
  email: string, 
  subscriptionType: 'visa_bulletin' | 'general' | 'all' = 'visa_bulletin'
): Promise<{ success: boolean; message: string }> {
  try {
    await apiClient.post('/newsletter/subscribe', { 
      email, 
      subscription_type: subscriptionType 
    })
    return { success: true, message: 'Successfully subscribed to newsletter!' }
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || 'Failed to subscribe to newsletter' 
    }
  }
}

export async function unsubscribeFromNewsletter(
  email: string
): Promise<{ success: boolean; message: string }> {
  try {
    await apiClient.post('/newsletter/unsubscribe', { email })
    return { success: true, message: 'Successfully unsubscribed from newsletter' }
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || 'Failed to unsubscribe from newsletter' 
    }
  }
}

export async function getSubscriptionStatus(
  email: string
): Promise<{ isSubscribed: boolean; subscription?: NewsletterSubscription }> {
  try {
    const subscription = await apiClient.get<NewsletterSubscription>(`/newsletter/status?email=${encodeURIComponent(email)}`)
    return { isSubscribed: subscription.is_active, subscription }
  } catch {
    return { isSubscribed: false }
  }
}

export async function getAllSubscribers(): Promise<NewsletterSubscription[]> {
  try {
    return await apiClient.get<NewsletterSubscription[]>('/newsletter/subscribers')
  } catch {
    return []
  }
}

export async function getActiveSubscribers(): Promise<NewsletterSubscription[]> {
  try {
    const subscribers = await apiClient.get<NewsletterSubscription[]>('/newsletter/subscribers')
    return subscribers.filter(s => s.is_active)
  } catch {
    return []
  }
}

export async function getSubscribersByType(
  type: 'visa_bulletin' | 'general' | 'all'
): Promise<NewsletterSubscription[]> {
  try {
    return await apiClient.get<NewsletterSubscription[]>(`/newsletter/subscribers?type=${type}`)
  } catch {
    return []
  }
}

export async function isEmailSubscribed(
  email: string
): Promise<boolean> {
  const { isSubscribed } = await getSubscriptionStatus(email)
  return isSubscribed
}
