export {
  apiClient,
  authAPI as authAPIClient,
  applicationsAPI,
  applicationPaymentsAPI,
  paymentsAPI,
  notificationsAPI,
  quotationsAPI,
  donationsAPI,
  careersAPI,
  careersApplicationsAPI,
  clientsAPI,
  testimonialsAPI,
  settingsAPI,
  dashboardAPI,
  usersAPI,
  promoCodesAPI,
  adminAPI,
  timelineStepsAPI,
  documentsAPI,
} from './api-client';

// Stubbed Supabase client for compatibility - all operations return empty/null
// This allows code that was written for Supabase to compile without errors
const createQueryBuilder = (): any => {
  const result = { data: [] as any[], error: null }
  const singleResult = { data: null, error: null }
  
  const builder: any = {
    eq: (..._args: any[]) => builder,
    neq: (..._args: any[]) => builder,
    gt: (..._args: any[]) => builder,
    gte: (..._args: any[]) => builder,
    lt: (..._args: any[]) => builder,
    lte: (..._args: any[]) => builder,
    like: (..._args: any[]) => builder,
    ilike: (..._args: any[]) => builder,
    is: (..._args: any[]) => builder,
    in: (..._args: any[]) => builder,
    contains: (..._args: any[]) => builder,
    containedBy: (..._args: any[]) => builder,
    range: (..._args: any[]) => builder,
    order: (..._args: any[]) => builder,
    limit: (..._args: any[]) => builder,
    offset: (..._args: any[]) => builder,
    select: (..._args: any[]) => builder,
    or: (..._args: any[]) => builder,
    match: (..._args: any[]) => builder,
    filter: (..._args: any[]) => builder,
    maybeSingle: async () => singleResult,
    single: async () => singleResult,
    then: (resolve: any) => resolve(result),
    ...result,
  }
  return builder
}

export const supabase = {
  from: (_table: string) => ({
    select: (..._args: any[]) => createQueryBuilder(),
    insert: (..._args: any[]) => ({
      select: (..._args: any[]) => createQueryBuilder(),
      ...createQueryBuilder(),
    }),
    update: (..._args: any[]) => createQueryBuilder(),
    delete: () => createQueryBuilder(),
    upsert: (..._args: any[]) => ({
      select: (..._args: any[]) => createQueryBuilder(),
      ...createQueryBuilder(),
    }),
  }),
  storage: {
    from: (_bucket: string) => ({
      upload: async (..._args: any[]) => ({ data: null, error: null }),
      download: async (..._args: any[]) => ({ data: null, error: null }),
      remove: async (..._args: any[]) => ({ data: null, error: null }),
      createSignedUrl: async (..._args: any[]) => ({ data: null, error: null }),
      getPublicUrl: (..._args: any[]) => ({ data: { publicUrl: '' } }),
      list: async (..._args: any[]) => ({ data: [], error: null }),
    }),
  },
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async (..._args: any[]) => ({ error: null }),
    updateUser: async (..._args: any[]) => ({ data: null, error: null }),
    onAuthStateChange: (..._args: any[]) => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  functions: {
    invoke: async (..._args: any[]): Promise<{ data: any; error: any }> => ({ data: null, error: null }),
  },
  channel: (_name: string) => ({
    on: (..._args: any[]) => ({ subscribe: () => {} }),
  }),
  removeChannel: async () => {},
  rpc: async (..._args: any[]) => ({ data: null, error: null }),
};

// Make supabase available globally for legacy code compatibility
(globalThis as any).supabase = supabase;

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

export async function getCurrentUserId(): Promise<string> {
  const { authAPI } = await import('./api-client');
  const user = await authAPI.getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export function clearAuthCache(): void {}

export const authAPI = {
  register: async () => {
    throw new Error('Use AuthContext.signUp instead')
  },
  login: async () => {
    throw new Error('Use AuthContext.signIn instead')
  },
  me: async () => {
    throw new Error('Use AuthContext.user instead')
  },
  changePassword: async () => {
    throw new Error('Use AuthContext.changePassword instead')
  },
  requestPasswordReset: async () => {
    throw new Error('Use AuthContext.requestPasswordReset instead')
  },
  resetPassword: async () => {
    throw new Error('Use AuthContext.resetPassword instead')
  },
  logout: () => {
    throw new Error('Use AuthContext.signOut instead')
  },
}

export const userDetailsAPI = {
  async get(userId?: string) {
    const { apiClient, usersAPI } = await import('./api-client');
    if (userId) {
      return usersAPI.getById(userId);
    }
    return apiClient.get<any>('/users/me');
  },
  async getByUserId(userId: string) {
    const { usersAPI } = await import('./api-client');
    return usersAPI.getById(userId);
  },
  async update(userId: string, data: any) {
    const { usersAPI } = await import('./api-client');
    return usersAPI.update(userId, data);
  },
  async save(data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.patch<any>('/users/me', data);
  }
};

export const userPreferencesAPI = {
  async get(userId: string) {
    const { usersAPI } = await import('./api-client');
    return usersAPI.getPreferences(userId);
  },
  async update(userId: string, data: any) {
    const { usersAPI } = await import('./api-client');
    return usersAPI.updatePreferences(userId, data);
  },
  async save(data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.patch<any>('/users/me/preferences', data);
  },
  async generate2FASecret() {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/users/me/2fa/generate', {});
  },
  async generateBackupCodes() {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/users/me/2fa/backup-codes', {});
  },
  async verify2FACode(code: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/users/me/2fa/verify', { code });
  }
};

export const userDocumentsAPI = {
  async getAll() {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>('/documents');
  },
  async getByUserId(userId: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>(`/documents/user/${userId}`);
  },
  async getById(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any>(`/documents/${id}`);
  },
  async getDownloadUrl(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.get<{ url: string }>(`/documents/${id}/url`);
  },
  async upload(documentType: string, file: File, applicationId?: string) {
    const { apiClient } = await import('./api-client');
    
    // Convert file to base64
    const reader = new FileReader();
    const fileData = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    return apiClient.post<any>('/documents/upload', {
      filename: file.name,
      fileData,
      mimeType: file.type,
      documentType,
      applicationId,
    });
  },
  async delete(documentId: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.delete(`/documents/${documentId}`);
  },
  async uploadForUser(userId: string, documentType: string, file: File, applicationId?: string) {
    const { apiClient } = await import('./api-client');
    
    // Convert file to base64
    const reader = new FileReader();
    const fileData = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    return apiClient.post<any>('/documents/upload-for-user', {
      userId,
      filename: file.name,
      fileData,
      mimeType: file.type,
      documentType,
      applicationId,
    });
  }
};

// applicationPaymentsAPI is now exported from api-client.ts

export const servicesAPI = {
  async getAll() {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>('/services');
  },
  async getAllAdmin() {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>('/services/all');
  },
  async getById(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any>(`/services/${id}`);
  },
  async getAllByServiceAndState(serviceName: string, state: string) {
    const { apiClient } = await import('./api-client');
    try {
      return await apiClient.get<any[]>(`/services/by-service-state?service_name=${encodeURIComponent(serviceName)}&state=${encodeURIComponent(state)}`);
    } catch {
      return [];
    }
  },
  async getByServiceStateAndPaymentType(serviceType: string, serviceState: string, paymentType: string) {
    const { apiClient } = await import('./api-client');
    try {
      return await apiClient.get<any>(`/services/by-type?serviceType=${encodeURIComponent(serviceType)}&serviceState=${encodeURIComponent(serviceState)}&paymentType=${encodeURIComponent(paymentType)}`);
    } catch {
      return null;
    }
  },
  async create(data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/services', data);
  },
  async createOrUpdate(data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/services/create-or-update', data);
  },
  async update(id: string, data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.patch<any>(`/services/${id}`, data);
  },
  async delete(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.delete(`/services/${id}`);
  }
};

export const serviceRequiredDocumentsAPI = {
  async getAll() {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>('/service-required-documents');
  },
  async getByServiceId(serviceId: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>(`/service-required-documents/service/${serviceId}`);
  },
  async getByServiceTypes(serviceTypes: string[]) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any[]>('/service-required-documents/by-types', { serviceTypes });
  },
  async create(data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/service-required-documents', data);
  },
  async update(id: string, data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.patch<any>(`/service-required-documents/${id}`, data);
  },
  async delete(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.delete(`/service-required-documents/${id}`);
  }
};

// timelineStepsAPI is now exported from api-client.ts

export const processingAccountsAPI = {
  async getAll() {
    return [] as any[];
  },
  async getById(_id: string) {
    return null as any;
  },
  async getByApplication(applicationId: string) {
    const { apiClient } = await import('./api-client');
    try {
      return await apiClient.get<any[]>(`/processing-accounts/application/${applicationId}`);
    } catch {
      return [] as any[];
    }
  },
  async create(applicationId: string, data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/processing-accounts', { applicationId, ...data });
  },
  async update(id: string, data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.patch<any>(`/processing-accounts/${id}`, data);
  },
  async delete(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.delete(`/processing-accounts/${id}`);
  }
};

export const trackingAPI = {
  async track(trackingId: string) {
    const { applicationsAPI } = await import('./api-client');
    return applicationsAPI.getById(trackingId);
  },
  async getByApplicationId(applicationId: string) {
    const { applicationsAPI } = await import('./api-client');
    return applicationsAPI.getById(applicationId);
  }
};

// clientsAPI is now exported from api-client.ts

export const sponsorshipsAPI = {
  async getAll() {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>('/sponsorships');
  },
  async getById(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any>(`/sponsorships/${id}`);
  },
  async create(data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/sponsorships', data);
  },
  async update(id: string, data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.patch<any>(`/sponsorships/${id}`, data);
  },
  async delete(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.delete(`/sponsorships/${id}`);
  }
};

export const careerApplicationsAPI = {
  async getAll() {
    const { careersAPI } = await import('./api-client');
    const careers = await careersAPI.getAllAdmin();
    const applications: any[] = [];
    for (const career of careers) {
      const careerApps = await careersAPI.getApplications(career.id);
      applications.push(...careerApps);
    }
    return applications;
  },
  async getByUserId(_userId: string) {
    return [];
  },
  async create(careerId: string, data: any) {
    const { careersAPI } = await import('./api-client');
    return careersAPI.apply(careerId, data);
  }
};

export const partnerAgenciesAPI = {
  async getAll() {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>('/partner-agencies');
  },
  async getAllAdmin() {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>('/partner-agencies/all');
  },
  async getById(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any>(`/partner-agencies/${id}`);
  },
  async create(data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/partner-agencies', data);
  },
  async update(id: string, data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.patch<any>(`/partner-agencies/${id}`, data);
  },
  async delete(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.delete(`/partner-agencies/${id}`);
  }
};

export async function getSignedFileUrl(documentId: string, _expiresIn?: number, _silent?: boolean): Promise<string> {
  const token = localStorage.getItem('auth_token');
  return `/api/documents/${documentId}/download?token=${encodeURIComponent(token || '')}`;
}

export function getFileUrl(documentId: string, _expiresIn?: number): string {
  return `/api/documents/${documentId}/download`;
}

export function getSignedFileUrlSync(documentId: string, _expiresIn?: number, _silent?: boolean): string {
  const token = localStorage.getItem('auth_token');
  return `/api/documents/${documentId}/download?token=${encodeURIComponent(token || '')}`;
}

// documentsAPI is now exported from api-client.ts
