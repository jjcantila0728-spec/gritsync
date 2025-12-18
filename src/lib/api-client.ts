const API_BASE = '/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

export interface User {
  id: string;
  email: string;
  role: 'client' | 'admin';
  first_name?: string | null;
  last_name?: string | null;
  grit_id?: string;
  avatar_path?: string | null;
  created_at?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const authAPI = {
  async signUp(email: string, password: string, firstName: string, lastName: string, role: string = 'client'): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/signup', {
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      role,
    });
    apiClient.setToken(response.token);
    return response;
  },

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    apiClient.setToken(response.token);
    return response;
  },

  async signOut(): Promise<void> {
    await apiClient.post('/auth/logout');
    apiClient.setToken(null);
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      return await apiClient.get<User>('/auth/me');
    } catch {
      return null;
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  },

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },
};

export const applicationsAPI = {
  async getAll() {
    return apiClient.get<any[]>('/applications');
  },

  async getById(id: string) {
    return apiClient.get<any>(`/applications/${id}`);
  },

  async getServiceTypes() {
    return apiClient.get<string[]>('/applications/service-types');
  },

  async create(data: any) {
    return apiClient.post<any>('/applications', data);
  },

  async update(id: string, data: any) {
    return apiClient.patch<any>(`/applications/${id}`, data);
  },

  async delete(id: string) {
    return apiClient.delete(`/applications/${id}`);
  },

  async addTimelineStep(applicationId: string, data: any) {
    return apiClient.post<any>(`/applications/${applicationId}/timeline`, data);
  },

  async updateTimelineStep(applicationId: string, stepId: string, data: any) {
    return apiClient.patch<any>(`/applications/${applicationId}/timeline/${stepId}`, data);
  },

  async updateStatus(id: string, status: string) {
    return apiClient.patch<any>(`/applications/${id}/status`, { status });
  },
};

export const applicationPaymentsAPI = {
  async getAll() {
    return apiClient.get<any[]>('/application-payments');
  },

  async getByApplicationId(applicationId: string) {
    return apiClient.get<any[]>(`/application-payments/application/${applicationId}`);
  },

  async getByApplication(applicationId: string) {
    return apiClient.get<any[]>(`/application-payments/application/${applicationId}`);
  },

  async getPendingApproval() {
    return apiClient.get<any[]>('/application-payments/pending-approval');
  },

  async create(applicationId: string, paymentType?: string, amount?: number) {
    return apiClient.post<any>('/application-payments', { applicationId, paymentType, amount });
  },

  async update(id: string, data: any) {
    return apiClient.patch<any>(`/application-payments/${id}`, data);
  },

  async delete(id: string) {
    return apiClient.delete(`/application-payments/${id}`);
  },

  async approvePayment(id: string) {
    return apiClient.post<any>(`/application-payments/${id}/approve`);
  },

  async rejectPayment(id: string, reason?: string) {
    return apiClient.post<any>(`/application-payments/${id}/reject`, { reason });
  },

  async getReceipt(id: string) {
    return apiClient.get<any>(`/application-payments/${id}/receipt`);
  },

  async createPaymentIntent(paymentId: string) {
    return apiClient.post<any>(`/application-payments/${paymentId}/create-intent`);
  },

  async complete(id: string, _unused?: any, paymentIntentId?: string, paymentMethod?: string, gcashDetails?: any, proofOfPaymentFile?: File) {
    const data: any = { paymentIntentId, paymentMethod, gcashDetails };
    if (proofOfPaymentFile) {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(proofOfPaymentFile);
      });
      data.proofOfPayment = { filename: proofOfPaymentFile.name, data: base64, mimeType: proofOfPaymentFile.type };
    }
    return apiClient.post<any>(`/application-payments/${id}/complete`, data);
  },

  async checkRetaker(applicationId: string) {
    return apiClient.get<{ isRetaker: boolean }>(`/application-payments/${applicationId}/check-retaker`);
  },
};

export const timelineStepsAPI = {
  async getByApplicationId(applicationId: string) {
    return apiClient.get<any[]>(`/timeline-steps/application/${applicationId}`);
  },

  async getByApplication(applicationId: string) {
    return apiClient.get<any[]>(`/timeline-steps/application/${applicationId}`);
  },

  async create(data: any) {
    return apiClient.post<any>('/timeline-steps', data);
  },

  async update(applicationId: string, stepKey: string, status?: string, data?: any) {
    return apiClient.patch<any>(`/timeline-steps/application/${applicationId}/${stepKey}`, { status, data });
  },

  async delete(id: string) {
    return apiClient.delete(`/timeline-steps/${id}`);
  },
};

export const documentsAPI = {
  async getAll() {
    return [] as any[];
  },

  async getById(_id: string) {
    return null;
  },

  async getByApplication(applicationId: string) {
    return apiClient.get<any[]>(`/documents/application/${applicationId}`);
  },

  async getByApplicationId(applicationId: string) {
    return apiClient.get<any[]>(`/documents/application/${applicationId}`);
  },

  async create(data: any) {
    return apiClient.post<any>('/documents', data);
  },

  async update(id: string, data: any) {
    return apiClient.patch<any>(`/documents/${id}`, data);
  },

  async delete(id: string) {
    return apiClient.delete(`/documents/${id}`);
  },

  async upload(file: File, metadata?: any) {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) formData.append('metadata', JSON.stringify(metadata));
    return apiClient.post<any>('/documents/upload', formData);
  },

  async download(id: string) {
    return apiClient.get<Blob>(`/documents/${id}/download`);
  },
};

export const paymentsAPI = {
  async getAll() {
    return apiClient.get<any[]>('/payments');
  },

  async getById(id: string) {
    return apiClient.get<any>(`/payments/${id}`);
  },

  async getByApplication(applicationId: string) {
    return apiClient.get<any[]>(`/payments/application/${applicationId}`);
  },

  async create(data: any) {
    return apiClient.post<any>('/payments', data);
  },

  async update(id: string, data: any) {
    return apiClient.patch<any>(`/payments/${id}`, data);
  },

  async delete(id: string) {
    return apiClient.delete(`/payments/${id}`);
  },

  async createPaymentIntent(data: any) {
    return apiClient.post<any>('/payments/create-intent', data);
  },

  async updateStatus(id: string, status: string, data?: any) {
    return apiClient.patch<any>(`/payments/${id}/status`, { status, ...data });
  },
};

export const notificationsAPI = {
  async getAll(_unreadOnly?: boolean, _limit?: number) {
    return apiClient.get<any[]>('/notifications');
  },

  async getUnread() {
    return apiClient.get<any[]>('/notifications/unread');
  },

  async getUnreadCount() {
    const unread = await apiClient.get<any[]>('/notifications/unread');
    return unread?.length || 0;
  },

  async create(data: any) {
    return apiClient.post<any>('/notifications', data);
  },

  async markAsRead(id: string) {
    return apiClient.patch<any>(`/notifications/${id}/read`, {});
  },

  async markAllAsRead() {
    return apiClient.post('/notifications/mark-all-read');
  },

  async delete(id: string) {
    return apiClient.delete(`/notifications/${id}`);
  },
};

export const quotationsAPI = {
  async getAll() {
    return apiClient.get<any[]>('/quotations');
  },

  async getById(id: string) {
    return apiClient.get<any>(`/quotations/${id}`);
  },

  async getByIdPublic(id: string) {
    return apiClient.get<any>(`/quotations/${id}/public`);
  },

  async create(data: any) {
    return apiClient.post<any>('/quotations', data);
  },

  async createPublic(data: any) {
    return apiClient.post<any>('/quotations/public', data);
  },

  async update(id: string, data: any) {
    return apiClient.patch<any>(`/quotations/${id}`, data);
  },

  async delete(id: string) {
    return apiClient.delete(`/quotations/${id}`);
  },

  async generateGQId() {
    return apiClient.get<{ gqId: string }>('/quotations/generate-id');
  },
};

export const donationsAPI = {
  async getAll() {
    return apiClient.get<any[]>('/donations');
  },

  async getById(id: string) {
    return apiClient.get<any>(`/donations/${id}`);
  },

  async getPublicStats() {
    return apiClient.get<{ totalDonated: number; totalDonors: number; goal: number }>('/donations/public-stats');
  },

  async getStats() {
    // Admin stats - stubbed for now
    return { totalDonated: 0, totalDonors: 0, goal: 50000, monthlyDonations: [], recentDonations: [] };
  },

  async create(data: any) {
    return apiClient.post<any>('/donations', data);
  },

  async update(id: string, data: any) {
    return apiClient.patch<any>(`/donations/${id}`, data);
  },
};

export const clientsAPI = {
  async getAll() {
    return apiClient.get<User[]>('/admin/clients');
  },

  async getById(id: string) {
    return apiClient.get<User>(`/admin/clients/${id}`);
  },

  async getAllWithGmailAccounts() {
    // Stubbed - returns clients with their gmail connection status
    return [] as any[];
  },
};

export const careersAPI = {
  async getAll() {
    return apiClient.get<any[]>('/careers');
  },

  async getAllAdmin() {
    return apiClient.get<any[]>('/careers/all');
  },

  async getById(id: string) {
    return apiClient.get<any>(`/careers/${id}`);
  },

  async create(data: any) {
    return apiClient.post<any>('/careers', data);
  },

  async update(id: string, data: any) {
    return apiClient.patch<any>(`/careers/${id}`, data);
  },

  async delete(id: string) {
    return apiClient.delete(`/careers/${id}`);
  },

  async apply(careerId: string, data: any) {
    return apiClient.post<any>(`/careers/${careerId}/apply`, data);
  },

  async getApplications(careerId: string) {
    return apiClient.get<any[]>(`/careers/${careerId}/applications`);
  },
};

export const careersApplicationsAPI = {
  async getAll() {
    return apiClient.get<any[]>('/careers/applications');
  },

  async getByUserId(_userId: string) {
    return [] as any[];
  },

  async create(careerId: string, data: any) {
    return apiClient.post<any>(`/careers/${careerId}/apply`, data);
  },

  async updateStatus(applicationId: string, status: string, notes?: string) {
    return apiClient.patch<any>(`/careers/applications/${applicationId}/status`, { status, notes });
  },

  async forwardToAgency(applicationId: string, agencyId: string, notes?: string) {
    return apiClient.post<any>(`/careers/applications/${applicationId}/forward`, { agencyId, notes });
  },
};

export const testimonialsAPI = {
  async getAll() {
    return apiClient.get<any[]>('/testimonials');
  },

  async getAllAdmin() {
    return apiClient.get<any[]>('/testimonials/all');
  },

  async getById(id: string) {
    return apiClient.get<any>(`/testimonials/${id}`);
  },

  async create(data: any) {
    return apiClient.post<any>('/testimonials', data);
  },

  async update(id: string, data: any) {
    return apiClient.patch<any>(`/testimonials/${id}`, data);
  },

  async delete(id: string) {
    return apiClient.delete(`/testimonials/${id}`);
  },
};

export const settingsAPI = {
  async getAll() {
    return apiClient.get<Record<string, string | null>>('/settings');
  },

  async get(key: string) {
    return apiClient.get<any>(`/settings/${key}`);
  },

  async set(key: string, value: string, description?: string) {
    return apiClient.post<any>('/settings', { key, value, description });
  },
};

export const dashboardAPI = {
  async getStats() {
    return apiClient.get<any>('/dashboard/stats');
  },

  async getRecentApplications() {
    return apiClient.get<any[]>('/dashboard/recent-applications');
  },

  async getRecentUsers() {
    return apiClient.get<any[]>('/dashboard/recent-users');
  },

  async getUserStats() {
    return apiClient.get<any>('/dashboard/user-stats');
  },
};

export const usersAPI = {
  async getAll() {
    return apiClient.get<User[]>('/users');
  },

  async getById(id: string) {
    return apiClient.get<User>(`/users/${id}`);
  },

  async getByEmail(email: string) {
    return apiClient.get<User>(`/users/email/${encodeURIComponent(email)}`);
  },

  async getAdmins() {
    return apiClient.get<User[]>('/users/admins');
  },

  async update(id: string, data: any) {
    return apiClient.patch<User>(`/users/${id}`, data);
  },

  async getPreferences(id: string) {
    return apiClient.get<any>(`/users/${id}/preferences`);
  },

  async updatePreferences(id: string, data: any) {
    return apiClient.patch<any>(`/users/${id}/preferences`, data);
  },
};

export interface PromoCodeValidationResponse {
  valid: boolean;
  discount_amount?: number;
  discount_type?: string;
  discount_value?: number;
  code?: string;
  promo_id?: string;
  error?: string;
}

export const promoCodesAPI = {
  async validate(code: string, amount: number, serviceFeeAmount?: number | null, applicationType?: string | null): Promise<PromoCodeValidationResponse> {
    return apiClient.post<PromoCodeValidationResponse>('/promo-codes/validate', {
      code,
      amount,
      serviceFeeAmount,
      applicationType
    });
  },

  async use(promoId: string): Promise<{ success: boolean }> {
    return apiClient.post('/promo-codes/use', { promoId });
  }
};

export const adminAPI = {
  async getUsdToPhpRate(): Promise<number> {
    try {
      const settings = await settingsAPI.getAll();
      const rate = settings['usd_to_php_rate'];
      return rate ? parseFloat(rate) : 56.00;
    } catch {
      return 56.00;
    }
  }
};

export const emailsAPI = {
  async send(to: string | string[], subject: string, html?: string, text?: string) {
    return apiClient.post<{ success: boolean; data?: any; error?: string }>('/emails/send', {
      to, subject, html, text
    });
  },
  
  async sendWelcome(email: string, name: string) {
    return apiClient.post<{ success: boolean; error?: string }>('/emails/welcome', { email, name });
  },
  
  async sendApplicationStatus(email: string, name: string, status: string, applicationId: string) {
    return apiClient.post<{ success: boolean; error?: string }>('/emails/application-status', {
      email, name, status, applicationId
    });
  },
  
  async sendPaymentConfirmation(email: string, name: string, amount: string, description: string) {
    return apiClient.post<{ success: boolean; error?: string }>('/emails/payment-confirmation', {
      email, name, amount, description
    });
  },
  
  async sendQuotation(email: string, name: string, quotationDetails: any) {
    return apiClient.post<{ success: boolean; error?: string }>('/emails/quotation', {
      email, name, quotationDetails
    });
  }
};
