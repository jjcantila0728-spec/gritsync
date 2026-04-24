// Re-export all API service functions
export * from './api-service'

// Legacy auth API stubs (now handled by AuthContext)
export const authAPI = {
  register: async () => {
    // This is now handled by AuthContext.signUp
    throw new Error('Use AuthContext.signUp instead')
  },

  login: async () => {
    // This is now handled by AuthContext.signIn
    throw new Error('Use AuthContext.signIn instead')
  },

  me: async () => {
    // This is now handled by AuthContext
    throw new Error('Use AuthContext.user instead')
  },

  changePassword: async () => {
    // This is now handled by AuthContext.changePassword
    throw new Error('Use AuthContext.changePassword instead')
  },

  requestPasswordReset: async () => {
    // This is now handled by AuthContext.requestPasswordReset
    throw new Error('Use AuthContext.requestPasswordReset instead')
  },

  resetPassword: async () => {
    // This is now handled by AuthContext.resetPassword
    throw new Error('Use AuthContext.resetPassword instead')
  },

  logout: () => {
    // This is now handled by AuthContext.signOut
    throw new Error('Use AuthContext.signOut instead')
  },
}


