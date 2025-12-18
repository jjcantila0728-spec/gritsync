import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

const API_BASE = 'http://localhost:3001';

interface TestUser {
  id: string;
  email: string;
  token: string;
}

let adminUser: TestUser | null = null;
let clientUser: TestUser | null = null;

async function apiRequest(endpoint: string, options: any = {}) {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, ok: response.ok };
}

describe('Database API Tests', () => {
  describe('Health Check', () => {
    it('should return ok status', async () => {
      const res = await apiRequest('/api/health');
      expect(res.ok).toBe(true);
      expect(res.data.status).toBe('ok');
    });
  });

  describe('Authentication', () => {
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    it('should register a new user', async () => {
      const res = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: {
          email: testEmail,
          password: testPassword,
          first_name: 'Test',
          last_name: 'User',
          role: 'client',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.user).toBeDefined();
      expect(res.data.user.email).toBe(testEmail);
      expect(res.data.token).toBeDefined();
      
      clientUser = {
        id: res.data.user.id,
        email: res.data.user.email,
        token: res.data.token,
      };
    });

    it('should not allow duplicate registration', async () => {
      const res = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: {
          email: testEmail,
          password: testPassword,
          first_name: 'Test',
          last_name: 'User',
        },
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(409);
    });

    it('should login with correct credentials', async () => {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.user).toBeDefined();
      expect(res.data.token).toBeDefined();
    });

    it('should not login with wrong password', async () => {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: testEmail,
          password: 'WrongPassword123!',
        },
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
    });

    it('should get current user with valid token', async () => {
      const res = await apiRequest('/api/auth/me', {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(res.data.email).toBe(testEmail);
    });

    it('should not get user without token', async () => {
      const res = await apiRequest('/api/auth/me');
      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
    });
  });

  describe('Admin User Setup', () => {
    const adminEmail = `admin_${Date.now()}@example.com`;
    const adminPassword = 'AdminPassword123!';

    it('should create admin user', async () => {
      const res = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: {
          email: adminEmail,
          password: adminPassword,
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.user.role).toBe('admin');
      
      adminUser = {
        id: res.data.user.id,
        email: res.data.user.email,
        token: res.data.token,
      };
    });
  });

  describe('Applications API', () => {
    let applicationId: string;

    it('should create an application', async () => {
      const res = await apiRequest('/api/applications', {
        method: 'POST',
        token: clientUser?.token,
        body: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          mobile_number: '+1234567890',
          application_type: 'nclex',
          service_type: 'NCLEX Processing',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.id).toBeDefined();
      expect(res.data.grit_app_id).toBeDefined();
      applicationId = res.data.id;
    });

    it('should get all applications', async () => {
      const res = await apiRequest('/api/applications', {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
    });

    it('should get application by id', async () => {
      const res = await apiRequest(`/api/applications/${applicationId}`, {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(res.data.id).toBe(applicationId);
    });

    it('should update application', async () => {
      const res = await apiRequest(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        token: clientUser?.token,
        body: {
          status: 'in_progress',
          notes: 'Updated via test',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.status).toBe('in_progress');
    });

    it('should add timeline step', async () => {
      const res = await apiRequest(`/api/applications/${applicationId}/timeline`, {
        method: 'POST',
        token: clientUser?.token,
        body: {
          step_key: 'documents_submitted',
          step_name: 'Documents Submitted',
          status: 'pending',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.step_key).toBe('documents_submitted');
    });
  });

  describe('Notifications API', () => {
    let notificationId: string;

    it('should create notification', async () => {
      const res = await apiRequest('/api/notifications', {
        method: 'POST',
        token: clientUser?.token,
        body: {
          title: 'Test Notification',
          message: 'This is a test notification',
          type: 'general',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.id).toBeDefined();
      notificationId = res.data.id;
    });

    it('should get all notifications', async () => {
      const res = await apiRequest('/api/notifications', {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should get unread notifications', async () => {
      const res = await apiRequest('/api/notifications/unread', {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should mark notification as read', async () => {
      const res = await apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(res.data.read).toBe(true);
    });
  });

  describe('Quotations API', () => {
    let quotationId: string;

    it('should create quotation', async () => {
      const res = await apiRequest('/api/quotations', {
        method: 'POST',
        token: clientUser?.token,
        body: {
          amount: 1500,
          description: 'NCLEX Processing Service',
          service: 'NCLEX Processing',
          state: 'New York',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.id).toBeDefined();
      quotationId = res.data.id;
    });

    it('should get all quotations', async () => {
      const res = await apiRequest('/api/quotations', {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should get quotation by id', async () => {
      const res = await apiRequest(`/api/quotations/${quotationId}`, {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(res.data.id).toBe(quotationId);
    });

    it('should update quotation', async () => {
      const res = await apiRequest(`/api/quotations/${quotationId}`, {
        method: 'PATCH',
        token: clientUser?.token,
        body: {
          status: 'paid',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.status).toBe('paid');
    });
  });

  describe('Settings API', () => {
    it('should get all settings', async () => {
      const res = await apiRequest('/api/settings');
      expect(res.ok).toBe(true);
    });

    it('should set a setting (admin only)', async () => {
      const res = await apiRequest('/api/settings', {
        method: 'POST',
        token: adminUser?.token,
        body: {
          key: 'test_setting',
          value: 'test_value',
          description: 'A test setting',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.key).toBe('test_setting');
    });

    it('should get specific setting', async () => {
      const res = await apiRequest('/api/settings/test_setting');
      expect(res.ok).toBe(true);
      expect(res.data.value).toBe('test_value');
    });
  });

  describe('Testimonials API', () => {
    let testimonialId: string;

    it('should create testimonial (public)', async () => {
      const res = await apiRequest('/api/testimonials', {
        method: 'POST',
        body: {
          name: 'Test Reviewer',
          email: 'reviewer@example.com',
          content: 'Great service! Highly recommended.',
          rating: 5,
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.status).toBe('pending');
      testimonialId = res.data.id;
    });

    it('should get approved testimonials', async () => {
      const res = await apiRequest('/api/testimonials');
      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should get all testimonials (admin)', async () => {
      const res = await apiRequest('/api/testimonials/all', {
        token: adminUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should update testimonial status (admin)', async () => {
      const res = await apiRequest(`/api/testimonials/${testimonialId}`, {
        method: 'PATCH',
        token: adminUser?.token,
        body: {
          status: 'approved',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.status).toBe('approved');
    });
  });

  describe('Careers API', () => {
    let careerId: string;

    it('should create career (admin)', async () => {
      const res = await apiRequest('/api/careers', {
        method: 'POST',
        token: adminUser?.token,
        body: {
          title: 'Test Nurse Position',
          description: 'A test job posting',
          location: 'New York, NY',
          employment_type: 'full-time',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.id).toBeDefined();
      careerId = res.data.id;
    });

    it('should get active careers (public)', async () => {
      const res = await apiRequest('/api/careers');
      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should get career by id', async () => {
      const res = await apiRequest(`/api/careers/${careerId}`);
      expect(res.ok).toBe(true);
      expect(res.data.id).toBe(careerId);
    });

    it('should apply to career (public)', async () => {
      const res = await apiRequest(`/api/careers/${careerId}/apply`, {
        method: 'POST',
        body: {
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane.doe@example.com',
          mobile_number: '+1234567890',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.career_id).toBe(careerId);
    });
  });

  describe('Donations API', () => {
    it('should create donation (public)', async () => {
      const res = await apiRequest('/api/donations', {
        method: 'POST',
        body: {
          donor_name: 'Test Donor',
          donor_email: 'donor@example.com',
          amount: 100,
          message: 'Happy to support!',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.id).toBeDefined();
    });

    it('should get all donations (admin)', async () => {
      const res = await apiRequest('/api/donations', {
        token: adminUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });
  });

  describe('Dashboard API', () => {
    it('should get dashboard stats (admin)', async () => {
      const res = await apiRequest('/api/dashboard/stats', {
        token: adminUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(res.data.totalUsers).toBeDefined();
      expect(res.data.totalApplications).toBeDefined();
    });

    it('should get recent applications (admin)', async () => {
      const res = await apiRequest('/api/dashboard/recent-applications', {
        token: adminUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should get user stats (client)', async () => {
      const res = await apiRequest('/api/dashboard/user-stats', {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(res.data.totalApplications).toBeDefined();
    });
  });

  describe('Users API', () => {
    it('should get user by id', async () => {
      const res = await apiRequest(`/api/users/${clientUser?.id}`, {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(res.data.id).toBe(clientUser?.id);
    });

    it('should update user profile', async () => {
      const res = await apiRequest(`/api/users/${clientUser?.id}`, {
        method: 'PATCH',
        token: clientUser?.token,
        body: {
          first_name: 'Updated',
          last_name: 'Name',
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.first_name).toBe('Updated');
    });

    it('should get user preferences', async () => {
      const res = await apiRequest(`/api/users/${clientUser?.id}/preferences`, {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(res.data.email_notifications_enabled).toBeDefined();
    });

    it('should update user preferences', async () => {
      const res = await apiRequest(`/api/users/${clientUser?.id}/preferences`, {
        method: 'PATCH',
        token: clientUser?.token,
        body: {
          email_notifications_enabled: false,
        },
      });

      expect(res.ok).toBe(true);
      expect(res.data.email_notifications_enabled).toBe(false);
    });

    it('should get all users (admin)', async () => {
      const res = await apiRequest('/api/users', {
        token: adminUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });
  });

  describe('Payments API', () => {
    it('should get all payments', async () => {
      const res = await apiRequest('/api/payments', {
        token: clientUser?.token,
      });

      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });
  });
});
