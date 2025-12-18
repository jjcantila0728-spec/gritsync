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
  async get(userId: string) {
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
  async getAll(_userId: string) {
    return [];
  },
  async upload(_userId: string, _file: File, _metadata: any) {
    console.warn('File upload not implemented yet');
    return null;
  },
  async delete(_documentId: string) {
    console.warn('Document delete not implemented yet');
    return null;
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
  async create(data: any) {
    const { paymentsAPI } = await import('./api-client');
    return paymentsAPI.create(data);
  },
  async update(id: string, data: any) {
    const { paymentsAPI } = await import('./api-client');
    return paymentsAPI.update(id, data);
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
  async create(data: any) {
    const { apiClient } = await import('./api-client');
    return apiClient.post<any>('/services', data);
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
    return [];
  },
  async getByServiceId(_serviceId: string) {
    return [];
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
  async getByApplicationId(_applicationId: string) {
    return null;
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
