// Centralized Logging Utility with Structured Logging for Production

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')

// Log levels: error < warn < info < debug
const logLevels = { error: 0, warn: 1, info: 2, debug: 3 }
const currentLogLevel = logLevels[logLevel] || 2

/**
 * Format log entry for structured logging
 */
function formatLogEntry(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...data
  }

  // In production, output as JSON for log aggregation tools
  if (isProduction) {
    return JSON.stringify(entry)
  }

  // In development, output as readable format
  const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : ''
  return `[${entry.level}] ${entry.timestamp} - ${message}${dataStr}`
}

export const logger = {
  info: (message, data = {}) => {
    if (currentLogLevel >= logLevels.info) {
      console.log(formatLogEntry('info', message, data))
    }
  },

  error: (message, error = null, data = {}) => {
    if (currentLogLevel >= logLevels.error) {
      const errorData = {
        ...data,
        error: error ? {
          message: error.message,
          name: error.name,
          code: error.code,
          ...(isDevelopment && error.stack ? { stack: error.stack } : {})
        } : null
      }
      console.error(formatLogEntry('error', message, errorData))
    }
  },

  warn: (message, data = {}) => {
    if (currentLogLevel >= logLevels.warn) {
      console.warn(formatLogEntry('warn', message, data))
    }
  },

  debug: (message, data = {}) => {
    if (currentLogLevel >= logLevels.debug) {
      console.log(formatLogEntry('debug', message, data))
    }
  },

  // Performance logging
  performance: (operation, duration, data = {}) => {
    if (currentLogLevel >= logLevels.info) {
      logger.info(`Performance: ${operation}`, {
        ...data,
        duration: `${duration}ms`,
        operation
      })
    }
  }
}


