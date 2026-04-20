import axios from 'axios';

// FIX: Single axios instance — removed duplicate in utils/api.ts
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
    // FIX: Handle both expired and invalid token responses
    if (err.response?.status === 401) {
      const errorMsg = err.response?.data?.error || '';
      // Only redirect if it's truly an auth error, not a 401 from a specific resource
      if (errorMsg === 'Token expired' || errorMsg === 'Invalid token' || errorMsg === 'Not authenticated') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
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
  changeFulfillment: (id: string, fulfillmentType: 'delivery' | 'pickup') => api.put(`/quotations/${id}/fulfillment`, { fulfillmentType }),
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
  getAllPharmacies: (params?: any) => api.get('/admin/pharmacies', { params }),
  approvePharmacy: (id: string) => api.put(`/admin/pharmacies/${id}/approve`),
  rejectPharmacy: (id: string) => api.put(`/admin/pharmacies/${id}/reject`),
  updatePharmacy: (id: string, data: any) => api.put(`/admin/pharmacies/${id}`, data),
  deletePharmacy: (id: string) => api.delete(`/admin/pharmacies/${id}`),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  getUserById: (id: string) => api.get(`/admin/users/${id}`),
  toggleUser: (id: string) => api.put(`/admin/users/${id}/toggle`),
};

export const analyticsAPI = {
  patient: () => api.get('/analytics/patient'),
  pharmacy: () => api.get('/analytics/pharmacy'),
};
