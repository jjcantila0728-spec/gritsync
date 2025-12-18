import { authAPI } from './api-client';

export interface Session {
  user: {
    id: string;
    email: string;
    role?: string;
  } | null;
  access_token: string | null;
  expires_at?: number;
}

export async function ensureValidSession(): Promise<Session | null> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }
    
    const user = await authAPI.getCurrentUser();
    if (!user) {
      return null;
    }
    
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      access_token: token,
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

export async function requireAuth(): Promise<Session> {
  const session = await ensureValidSession();
  
  if (!session) {
    throw new Error('Authentication required. Please log in.');
  }
  
  return session;
}

let cachedUserId: string | null = null;
let cachedUserIdTimestamp = 0;
const USER_ID_CACHE_TTL = 60 * 1000;

export async function getAuthenticatedUserId(): Promise<string> {
  const now = Date.now();
  if (cachedUserId && now - cachedUserIdTimestamp < USER_ID_CACHE_TTL) {
    return cachedUserId;
  }
  
  const session = await requireAuth();
  
  if (!session.user?.id) {
    cachedUserId = null;
    throw new Error('User ID not found in session');
  }
  
  cachedUserId = session.user.id;
  cachedUserIdTimestamp = now;
  
  return session.user.id;
}

export async function forceRefreshSession(): Promise<Session | null> {
  cachedUserId = null;
  cachedUserIdTimestamp = 0;
  
  return await ensureValidSession();
}

export async function isSessionExpired(): Promise<boolean> {
  const token = localStorage.getItem('auth_token');
  return !token;
}
