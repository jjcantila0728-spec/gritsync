// Re-export Supabase API for backward compatibility
// The app now uses Supabase directly - this file maintains API compatibility
export * from './supabase-api'

// Legacy auth API (now handled by AuthContext with Supabase)
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

// Applications API - now uses Supabase
// Re-exported from supabase-api.ts above

// All APIs are now re-exported from supabase-api.ts
// This maintains backward compatibility while using Supabase

