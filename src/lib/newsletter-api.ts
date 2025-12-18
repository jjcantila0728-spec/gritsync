const NEWSLETTER_STORAGE_KEY = 'gritsync_newsletter_subscriptions'

export interface NewsletterSubscription {
  id: string
  email: string
  subscriptionType: 'visa_bulletin' | 'general' | 'all'
  subscribedAt: string
  isActive: boolean
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function getStoredSubscriptions(): NewsletterSubscription[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(NEWSLETTER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveSubscriptions(subscriptions: NewsletterSubscription[]): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(NEWSLETTER_STORAGE_KEY, JSON.stringify(subscriptions))
  } catch (error) {
    console.error('Failed to save subscriptions:', error)
  }
}

export async function subscribeToNewsletter(
  email: string, 
  subscriptionType: 'visa_bulletin' | 'general' | 'all' = 'visa_bulletin'
): Promise<{ success: boolean; message: string }> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { success: false, message: 'Please enter a valid email address' }
  }
  
  const subscriptions = getStoredSubscriptions()
  const existing = subscriptions.find(s => s.email.toLowerCase() === email.toLowerCase())
  
  if (existing) {
    if (existing.isActive) {
      return { success: false, message: 'This email is already subscribed' }
    }
    existing.isActive = true
    existing.subscribedAt = new Date().toISOString()
    saveSubscriptions(subscriptions)
    return { success: true, message: 'Welcome back! Your subscription has been reactivated.' }
  }
  
  const newSubscription: NewsletterSubscription = {
    id: generateId(),
    email: email.toLowerCase(),
    subscriptionType,
    subscribedAt: new Date().toISOString(),
    isActive: true
  }
  
  subscriptions.push(newSubscription)
  saveSubscriptions(subscriptions)
  
  return { success: true, message: 'Successfully subscribed to visa bulletin updates!' }
}

export async function unsubscribeFromNewsletter(email: string): Promise<{ success: boolean; message: string }> {
  const subscriptions = getStoredSubscriptions()
  const subscription = subscriptions.find(s => s.email.toLowerCase() === email.toLowerCase())
  
  if (!subscription) {
    return { success: false, message: 'Email not found in our subscription list' }
  }
  
  subscription.isActive = false
  saveSubscriptions(subscriptions)
  
  return { success: true, message: 'You have been unsubscribed from visa bulletin updates.' }
}

export function isEmailSubscribed(email: string): boolean {
  const subscriptions = getStoredSubscriptions()
  const subscription = subscriptions.find(s => s.email.toLowerCase() === email.toLowerCase())
  return subscription?.isActive ?? false
}

export function getActiveSubscribers(type?: 'visa_bulletin' | 'general' | 'all'): NewsletterSubscription[] {
  const subscriptions = getStoredSubscriptions()
  return subscriptions.filter(s => {
    if (!s.isActive) return false
    if (!type) return true
    return s.subscriptionType === type || s.subscriptionType === 'all'
  })
}
