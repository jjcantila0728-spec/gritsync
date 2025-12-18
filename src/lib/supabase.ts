export { 
  apiClient,
  authAPI,
  applicationsAPI,
  paymentsAPI,
  notificationsAPI,
  quotationsAPI,
  donationsAPI,
  careersAPI,
  testimonialsAPI,
  settingsAPI,
  dashboardAPI,
  usersAPI,
} from './api-client';

export class AppError extends Error {
  type: string;
  severity: string;
  
  constructor(message: string, type = 'UNKNOWN', severity = 'MEDIUM') {
    super(message);
    this.type = type;
    this.severity = severity;
    this.name = 'AppError';
  }
}

export const ErrorType = {
  NETWORK: 'NETWORK',
  AUTH: 'AUTH',
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  SERVER: 'SERVER',
  UNKNOWN: 'UNKNOWN',
} as const;

export const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export function handleSupabaseError(error: any): never {
  throw new AppError(error?.message || 'An error occurred');
}

export function normalizeError(error: any, _context?: any): AppError {
  if (error instanceof AppError) {
    return error;
  }
  return new AppError(error?.message || 'An error occurred');
}

export function getUserFriendlyMessage(error: any): string {
  if (error instanceof AppError) {
    return error.message;
  }
  return error?.message || 'An unexpected error occurred';
}

export function classifyError(error: any): { type: string; severity: string } {
  if (error?.status === 401 || error?.message?.includes('auth')) {
    return { type: ErrorType.AUTH, severity: ErrorSeverity.MEDIUM };
  }
  if (error?.status === 404) {
    return { type: ErrorType.NOT_FOUND, severity: ErrorSeverity.LOW };
  }
  if (error?.status >= 500) {
    return { type: ErrorType.SERVER, severity: ErrorSeverity.HIGH };
  }
  return { type: ErrorType.UNKNOWN, severity: ErrorSeverity.MEDIUM };
}

export const supabase = null;
