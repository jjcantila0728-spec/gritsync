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
    return [];
  },
  async getById(_id: string) {
    return null;
  },
  async create(_data: any) {
    console.warn('Services API not implemented yet');
    return null;
  },
  async update(_id: string, _data: any) {
    console.warn('Services API not implemented yet');
    return null;
  },
  async delete(_id: string) {
    console.warn('Services API not implemented yet');
    return null;
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
  async getAll() {
    return [];
  },
  async getByApplicationId(_applicationId: string) {
    return [];
  },
  async update(_id: string, _data: any) {
    console.warn('Timeline steps API not implemented yet');
    return null;
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
    return [];
  },
  async getById(_id: string) {
    return null;
  },
  async create(_data: any) {
    console.warn('Sponsorships API not implemented yet');
    return null;
  },
  async update(_id: string, _data: any) {
    console.warn('Sponsorships API not implemented yet');
    return null;
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
    return [];
  },
  async getById(_id: string) {
    return null;
  },
  async create(_data: any) {
    console.warn('Partner agencies API not implemented yet');
    return null;
  },
  async update(_id: string, _data: any) {
    console.warn('Partner agencies API not implemented yet');
    return null;
  },
  async delete(_id: string) {
    console.warn('Partner agencies API not implemented yet');
    return null;
  }
};

export function getSignedFileUrl(_path: string): string {
  console.warn('getSignedFileUrl not implemented - file storage not available');
  return '';
}

export function getFileUrl(_path: string): string {
  console.warn('getFileUrl not implemented - file storage not available');
  return '';
}
