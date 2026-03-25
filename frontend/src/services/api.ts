import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const authAPI = {
  register: (d: any) => api.post('/auth/register', d),
  login: (d: any) => api.post('/auth/login', d),
  getMe: () => api.get('/auth/me'),
  updateProfile: (d: any) => api.put('/auth/profile', d),
  changePassword: (d: any) => api.put('/auth/change-password', d),
};

export const prescriptionAPI = {
  upload: (fd: FormData) => api.post('/prescriptions/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll: (params?: any) => api.get('/prescriptions', { params }),
  getById: (id: string) => api.get(`/prescriptions/${id}`),
  requestQuotes: (id: string, pharmacyIds: string[]) => api.put(`/prescriptions/${id}/request-quotes`, { pharmacyIds }),
  updateMedicines: (id: string, medicines: any[]) => api.put(`/prescriptions/${id}/medicines`, { medicines }),
  cancel: (id: string) => api.put(`/prescriptions/${id}/cancel`),
};

export const quotationAPI = {
  getPharmacyRequests: (params?: any) => api.get('/quotations/pharmacy-requests', { params }),
  getById: (id: string) => api.get(`/quotations/${id}/detail`),
  submit: (id: string, data: any) => api.put(`/quotations/${id}/submit`, data),
  getForPrescription: (prescriptionId: string) => api.get(`/quotations/prescription/${prescriptionId}`),
  accept: (id: string) => api.put(`/quotations/${id}/accept`),
  updateStatus: (id: string, status: string, data?: any) => api.put(`/quotations/${id}/order-status`, { status, ...data }),
  complete: (id: string) => api.put(`/quotations/${id}/complete`),
};

export const pharmacyAPI = {
  getNearby: (params?: any) => api.get('/pharmacy/nearby', { params }),
  getInventory: (params?: any) => api.get('/pharmacy/inventory', { params }),
  addItem: (data: any) => api.post('/pharmacy/inventory', data),
  updateItem: (id: string, data: any) => api.put(`/pharmacy/inventory/${id}`, data),
  deleteItem: (id: string) => api.delete(`/pharmacy/inventory/${id}`),
  autoGenerateQuotation: (quotationId: string) => api.post(`/pharmacy/quotations/${quotationId}/auto-generate`),
};

export const chatAPI = {
  getMessages: (prescriptionId: string, pharmacyId?: string) =>
    api.get(`/chat/${prescriptionId}`, { params: pharmacyId ? { pharmacyId } : {} }),
  send: (prescriptionId: string, content: string, pharmacyId?: string) =>
    api.post(`/chat/${prescriptionId}`, { content, pharmacyId }),
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getPendingPharmacies: () => api.get('/admin/pharmacies/pending'),
  approvePharmacy: (id: string) => api.put(`/admin/pharmacies/${id}/approve`),
  rejectPharmacy: (id: string) => api.put(`/admin/pharmacies/${id}/reject`),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  toggleUser: (id: string) => api.put(`/admin/users/${id}/toggle`),
};

export const analyticsAPI = {
  patient: () => api.get('/analytics/patient'),
  pharmacy: () => api.get('/analytics/pharmacy'),
};
