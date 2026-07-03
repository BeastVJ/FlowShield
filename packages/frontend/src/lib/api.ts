import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Inject access token into every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          const { accessToken, refreshToken: newRefresh } = data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefresh);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
};

// Projects
export const projectsApi = {
  list: () => api.get('/projects'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post('/projects', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// API Keys
export const keysApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/keys`),
  create: (projectId: string, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/keys`, data),
  updatePolicy: (projectId: string, keyId: string, data: Record<string, unknown>) =>
    api.patch(`/projects/${projectId}/keys/${keyId}`, data),
  rotate: (projectId: string, keyId: string) =>
    api.post(`/projects/${projectId}/keys/${keyId}/rotate`),
  revoke: (projectId: string, keyId: string) =>
    api.delete(`/projects/${projectId}/keys/${keyId}`),
};

// Rate Limit
export const rateLimitApi = {
  check: (data: { key: string; identifier: string }) =>
    api.post('/rate-limit/check', data),
};

// Analytics
export const analyticsApi = {
  get: (projectId: string, params?: Record<string, string>) =>
    api.get(`/analytics/${projectId}`, { params }),
  realtime: (projectId: string) =>
    api.get(`/analytics/${projectId}/realtime`),
  logs: (projectId: string, params?: Record<string, string>) =>
    api.get(`/analytics/${projectId}/logs`, { params }),
};

// Audit
export const auditApi = {
  list: (params?: Record<string, string>) =>
    api.get('/audit', { params }),
};

export default api;
