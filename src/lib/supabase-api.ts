export { 
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

export function clearAuthCache(): void {
}

export async function getCurrentUserId(): Promise<string> {
  const { authAPI } = await import('./api-client');
  const user = await authAPI.getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export function getSignedFileUrl(_path: string): string {
  console.warn('getSignedFileUrl not implemented - file storage not available');
  return '';
}

export function getFileUrl(_path: string): string {
  console.warn('getFileUrl not implemented - file storage not available');
  return '';
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
