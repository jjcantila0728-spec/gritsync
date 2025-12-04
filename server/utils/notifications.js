import { generateId } from './index.js'
import { getSupabaseAdmin } from '../db/supabase.js'
import { logger } from './logger.js'
import { shouldSendEmailNotification, sendNotificationEmail } from './email.js'

/**
 * Create notification with email support
 * @param {string} userId - User ID to send notification to
 * @param {string|null} applicationId - Application ID (optional)
 * @param {string} type - Notification type: 'timeline_update' | 'status_change' | 'payment' | 'general'
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @returns {Promise<string|null>} Notification ID or null if failed
 */
export async function createNotification(userId, applicationId, type, title, message) {
  try {
    const notificationId = generateId()
    const supabase = getSupabaseAdmin()
    
    // Always create the in-app notification
    const { error } = await supabase
      .from('notifications')
      .insert({
        id: notificationId,
        user_id: userId,
        application_id: applicationId || null,
        type,
        title,
        message,
        read: false
      })
    
    if (error) {
      throw error
    }
    
    // Check if email notifications are enabled for this type
    const shouldSendEmail = await shouldSendEmailNotification(type)
    
    // If email notifications are enabled, send email
    if (shouldSendEmail) {
      try {
        // Get user information for email
        const { data: userData } = await supabase
          .from('users')
          .select('email, full_name, first_name, last_name')
          .eq('id', userId)
          .single()
        
        if (userData?.email) {
          const userName = userData.full_name || 
                          (userData.first_name && userData.last_name 
                            ? `${userData.first_name} ${userData.last_name}` 
                            : userData.first_name || 'User')
          
          // Send email asynchronously (don't wait for it to complete)
          sendNotificationEmail(userData.email, type, {
            userName,
            title,
            message,
            applicationId: applicationId || undefined,
          }).catch((emailError) => {
            logger.error('Failed to send notification email', { error: emailError, userId, type })
            // Don't throw - email failure shouldn't break notification creation
          })
        }
      } catch (emailError) {
        logger.error('Error sending notification email', { error: emailError, userId, type })
        // Don't throw - email failure shouldn't break notification creation
      }
    }
    
    return notificationId
  } catch (error) {
    logger.error('Error creating notification', error)
    return null
  }
}


