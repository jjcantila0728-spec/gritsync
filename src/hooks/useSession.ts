import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ensureValidSession,
  requireAuth,
  getAuthenticatedUserId,
  forceRefreshSession,
  isSessionExpired,
} from '@/lib/session-utils';
import type { Session } from '@/lib/session-utils';

export interface UseSessionOptions {
  autoRefresh?: boolean;
  checkInterval?: number;
  requireValid?: boolean;
}

export interface SessionState {
  session: Session | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  isValid: boolean;
  isExpired: boolean;
}

export function useSession(options: UseSessionOptions = {}) {
  const {
    autoRefresh = true,
    checkInterval = 60000,
    requireValid = false,
  } = options;

  const { user } = useAuth();

  const [state, setState] = useState<SessionState>({
    session: null,
    userId: null,
    loading: true,
    error: null,
    isValid: false,
    isExpired: false,
  });

  const checkSession = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const session = await ensureValidSession();
      const expired = await isSessionExpired();

      if (session) {
        const userId = session.user?.id || null;
        setState({
          session,
          userId,
          loading: false,
          error: null,
          isValid: true,
          isExpired: expired,
        });
      } else {
        setState({
          session: null,
          userId: null,
          loading: false,
          error: requireValid ? 'No valid session' : null,
          isValid: false,
          isExpired: true,
        });
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error?.message || 'Failed to check session',
        isValid: false,
      }));
    }
  }, [requireValid]);

  const refreshSession = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const session = await forceRefreshSession();
      
      if (session) {
        const userId = session.user?.id || null;
        setState(prev => ({
          ...prev,
          session,
          userId,
          loading: false,
          isValid: true,
          error: null,
        }));
        return session;
      } else {
        setState(prev => ({
          ...prev,
          session: null,
          userId: null,
          loading: false,
          isValid: false,
        }));
        return null;
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error?.message || 'Failed to refresh session',
        isValid: false,
      }));
      return null;
    }
  }, []);

  const ensureAuth = useCallback(async (): Promise<Session> => {
    return await requireAuth();
  }, []);

  const getUserId = useCallback(async (): Promise<string> => {
    return await getAuthenticatedUserId();
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession, user]);

  useEffect(() => {
    if (autoRefresh && state.session) {
      const interval = setInterval(() => {
        checkSession();
      }, checkInterval);

      return () => {
        clearInterval(interval);
      };
    }
  }, [autoRefresh, checkInterval, state.session, checkSession]);

  return {
    session: state.session,
    userId: state.userId,
    loading: state.loading,
    error: state.error,
    isValid: state.isValid,
    isExpired: state.isExpired,
    checkSession,
    refreshSession,
    ensureAuth,
    getUserId,
  };
}
