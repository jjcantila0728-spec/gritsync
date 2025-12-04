// Centralized Logging Utility

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  info: (message, ...args) => {
    if (isDevelopment || process.env.LOG_LEVEL === 'debug') {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args)
    }
  },

  error: (message, error = null, ...args) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args)
    if (error) {
      console.error('Error details:', error.message)
      if (isDevelopment && error.stack) {
        console.error('Stack trace:', error.stack)
      }
    }
  },

  warn: (message, ...args) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args)
  },

  debug: (message, ...args) => {
    if (isDevelopment || process.env.LOG_LEVEL === 'debug') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args)
    }
  }
}


