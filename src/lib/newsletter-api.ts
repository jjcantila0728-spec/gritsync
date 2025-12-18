
export interface NewsletterSubscription {
  id: string
  email: string
  subscription_type: 'visa_bulletin' | 'general' | 'all'
  subscribed_at: string
  is_active: boolean
  unsubscribed_at?: string
}

export async function subscribeToNewsletter(
  email: string, 
  subscriptionType: 'visa_bulletin' | 'general' | 'all' = 'visa_bulletin'
): Promise<{ success: boolean; message: string }> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { success: false, message: 'Please enter a valid email address' }
  }
  
  const normalizedEmail = email.toLowerCase().trim()
  
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle()
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking subscription:', fetchError)
      return { success: false, message: 'Unable to process subscription. Please try again.' }
    }
    
    if (existing) {
      if (existing.is_active) {
        return { success: false, message: 'This email is already subscribed' }
      }
      
      const { error: updateError } = await supabase
        .from('newsletter_subscriptions')
        .update({ 
          is_active: true, 
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
          subscription_type: subscriptionType
        })
        .eq('id', existing.id)
      
      if (updateError) {
        console.error('Error reactivating subscription:', updateError)
        return { success: false, message: 'Unable to reactivate subscription. Please try again.' }
      }
      
      return { success: true, message: 'Welcome back! Your subscription has been reactivated.' }
    }
    
    const { error: insertError } = await supabase
      .from('newsletter_subscriptions')
      .insert({
        email: normalizedEmail,
        subscription_type: subscriptionType,
        subscribed_at: new Date().toISOString(),
        is_active: true
      })
    
    if (insertError) {
      console.error('Error creating subscription:', insertError)
      if (insertError.code === '23505') {
        return { success: false, message: 'This email is already subscribed' }
      }
      return { success: false, message: 'Unable to create subscription. Please try again.' }
    }
    
    return { success: true, message: 'Successfully subscribed to visa bulletin updates!' }
  } catch (error) {
    console.error('Subscription error:', error)
    return { success: false, message: 'An unexpected error occurred. Please try again.' }
  }
}

export async function unsubscribeFromNewsletter(email: string): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase().trim()
  
  try {
    const { data: subscription, error: fetchError } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle()
    
    if (fetchError) {
      console.error('Error finding subscription:', fetchError)
      return { success: false, message: 'Unable to process unsubscription. Please try again.' }
    }
    
    if (!subscription) {
      return { success: false, message: 'Email not found in our subscription list' }
    }
    
    const { error: updateError } = await supabase
      .from('newsletter_subscriptions')
      .update({ 
        is_active: false,
        unsubscribed_at: new Date().toISOString()
      })
      .eq('id', subscription.id)
    
    if (updateError) {
      console.error('Error unsubscribing:', updateError)
      return { success: false, message: 'Unable to unsubscribe. Please try again.' }
    }
    
    return { success: true, message: 'You have been unsubscribed from visa bulletin updates.' }
  } catch (error) {
    console.error('Unsubscription error:', error)
    return { success: false, message: 'An unexpected error occurred. Please try again.' }
  }
}

export async function isEmailSubscribed(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim()
  
  try {
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('is_active')
      .eq('email', normalizedEmail)
      .maybeSingle()
    
    if (error) {
      console.error('Error checking subscription status:', error)
      return false
    }
    
    return data?.is_active ?? false
  } catch {
    return false
  }
}

export async function getActiveSubscribers(
  type?: 'visa_bulletin' | 'general' | 'all'
): Promise<NewsletterSubscription[]> {
  try {
    let query = supabase
      .from('newsletter_subscriptions')
      .select('*')
      .eq('is_active', true)
    
    if (type && type !== 'all') {
      query = query.or(`subscription_type.eq.${type},subscription_type.eq.all`)
    }
    
    const { data, error } = await query.order('subscribed_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching subscribers:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error getting subscribers:', error)
    return []
  }
}

export async function getSubscriberCount(
  type?: 'visa_bulletin' | 'general' | 'all'
): Promise<number> {
  try {
    let query = supabase
      .from('newsletter_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
    
    if (type && type !== 'all') {
      query = query.or(`subscription_type.eq.${type},subscription_type.eq.all`)
    }
    
    const { count, error } = await query
    
    if (error) {
      console.error('Error counting subscribers:', error)
      return 0
    }
    
    return count || 0
  } catch {
    return 0
  }
}
