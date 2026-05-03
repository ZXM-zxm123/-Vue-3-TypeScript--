import axios from 'axios';
import type {
  User,
  Account,
  Bill,
  Budget,
  BudgetStatus,
  Rule,
  DashboardData
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (username: string, password: string) =>
    api.post<User>('/register', { username, password }),
  login: (username: string, password: string) =>
    api.post<{ token: string; userId: number; username: string }>('/login', { username, password })
};

export const accountAPI = {
  getAll: () => api.get<Account[]>('/accounts'),
  create: (data: { name: string; type: string; balance?: number }) =>
    api.post<Account>('/accounts', data),
  update: (id: number, data: { name: string; type: string; balance: number }) =>
    api.put<Account>(`/accounts/${id}`, data),
  delete: (id: number) => api.delete(`/accounts/${id}`)
};

export const billAPI = {
  getAll: (params?: { startDate?: string; endDate?: string; category?: string; accountId?: number }) =>
    api.get<Bill[]>('/bills', { params }),
  create: (data: { amount: number; description: string; category?: string; date: string; accountId: number }) =>
    api.post<Bill>('/bills', data),
  upload: (formData: FormData) =>
    api.post<{ uploaded: number; bills: Bill[] }>('/bills/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  delete: (id: number) => api.delete(`/bills/${id}`)
};

export const budgetAPI = {
  getAll: () => api.get<Budget[]>('/budgets'),
  create: (data: { category: string; amount: number; period?: string }) =>
    api.post<Budget>('/budgets', data),
  getStatus: () => api.get<BudgetStatus[]>('/budgets/status')
};

export const ruleAPI = {
  getAll: () => api.get<Rule[]>('/rules'),
  create: (data: { keyword: string; category: string }) =>
    api.post<Rule>('/rules', data),
  delete: (id: number) => api.delete(`/rules/${id}`)
};

export const dashboardAPI = {
  getData: () => api.get<DashboardData>('/dashboard')
};

export const exportAPI = {
  exportPDF: () => api.get('/export/pdf', { responseType: 'blob' })
};

export default api;
