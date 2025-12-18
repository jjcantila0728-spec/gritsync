export {
  apiClient,
  authAPI as authAPIClient,
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
  promoCodesAPI,
  adminAPI,
} from './api-client';

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
    // Get current user's details
    return apiClient.get<any>('/users/me');
  },
  async getByUserId(userId: string) {
    const { usersAPI } = await import('./api-client');
    return usersAPI.getById(userId);
  },
  async update(userId: string, data: any) {
    const { usersAPI } = await import('./api-client');
    return usersAPI.update(userId, data);
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
  }
};

export const applicationPaymentsAPI = {
  async getAll() {
    const { paymentsAPI } = await import('./api-client');
    return paymentsAPI.getAll();
  },
  async getByApplicationId(applicationId: string) {
    const { paymentsAPI } = await import('./api-client');
    return paymentsAPI.getByApplication(applicationId);
  },
  async getByApplication(applicationId: string) {
    const { paymentsAPI } = await import('./api-client');
    return paymentsAPI.getByApplication(applicationId);
  },
  async create(data: any) {
    const { paymentsAPI } = await import('./api-client');
    return paymentsAPI.create(data);
  },
  async update(id: string, data: any) {
    const { paymentsAPI } = await import('./api-client');
    return paymentsAPI.update(id, data);
  },
  async delete(id: string) {
    const { paymentsAPI } = await import('./api-client');
    return paymentsAPI.delete(id);
  }
};

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

export const timelineStepsAPI = {
  async getByApplicationId(applicationId: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>(`/timeline-steps/application/${applicationId}`);
  },
  async create(data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/timeline-steps', data);
  },
  async update(id: string, data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.patch<any>(`/timeline-steps/${id}`, data);
  },
  async delete(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.delete(`/timeline-steps/${id}`);
  }
};

export const processingAccountsAPI = {
  async getAll() {
    return [];
  },
  async getById(_id: string) {
    return null;
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

export const clientsAPI = {
  async getAll() {
    const { usersAPI } = await import('./api-client');
    return usersAPI.getAll();
  },
  async getById(id: string) {
    const { usersAPI } = await import('./api-client');
    return usersAPI.getById(id);
  }
};

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

export function getSignedFileUrl(documentId: string): string {
  const token = localStorage.getItem('auth_token');
  return `/api/documents/${documentId}/download?token=${encodeURIComponent(token || '')}`;
}

export function getFileUrl(documentId: string): string {
  return `/api/documents/${documentId}/download`;
}

export const documentsAPI = {
  async getAll() {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any[]>('/documents');
  },
  async getById(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.get<any>(`/documents/${id}`);
  },
  async upload(filename: string, mimeType: string, fileData: string, documentType?: string, applicationId?: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/documents/upload', { filename, mimeType, fileData, documentType, applicationId });
  },
  async delete(id: string) {
    const { apiClient } = await import('./api-client');
    return apiClient.delete(`/documents/${id}`);
  },
  getDownloadUrl(id: string): string {
    return `/api/documents/${id}/download`;
  }
};
