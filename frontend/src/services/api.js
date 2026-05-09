import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// Blocks
export const blockAPI = {
  getAll: () => api.get('/blocks'),
  create: (data) => api.post('/blocks', data),
  update: (id, data) => api.put(`/blocks/${id}`, data),
  delete: (id) => api.delete(`/blocks/${id}`),
};

// Floors
export const floorAPI = {
  getAll: (blockId) => api.get('/floors', { params: blockId ? { blockId } : {} }),
  create: (data) => api.post('/floors', data),
  update: (id, data) => api.put(`/floors/${id}`, data),
  delete: (id) => api.delete(`/floors/${id}`),
};

// Classrooms
export const classroomAPI = {
  getAll: () => api.get('/classrooms'),
  create: (data) => api.post('/classrooms', data),
  update: (id, data) => api.put(`/classrooms/${id}`, data),
  delete: (id) => api.delete(`/classrooms/${id}`),
};

// Devices
export const deviceAPI = {
  getAll: () => api.get('/devices'),
  create: (data) => api.post('/devices', data),
  update: (id, data) => api.put(`/devices/${id}`, data),
  delete: (id) => api.delete(`/devices/${id}`),
  toggleJammer: (id) => api.put(`/devices/${id}/jammer`),
  toggleMonitoring: (id) => api.put(`/devices/${id}/monitoring`),
};

// Detection
export const detectionAPI = {
  getLogs: (params) => api.get('/detection/logs', { params }),
  getTodayStats: () => api.get('/detection/stats/today'),
  getAnalytics: (days) => api.get('/detection/analytics', { params: { days } }),
  clearLogs: () => api.delete('/detection/logs'),
};

// Dashboard
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// Users
export const userAPI = {
  getAll: () => api.get('/users'),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export default api;
