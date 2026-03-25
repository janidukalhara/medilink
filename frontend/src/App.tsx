import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/shared/Navbar';
import LoadingSpinner from './components/shared/LoadingSpinner';

// Auth
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';

// Patient
import PatientDashboard from './pages/PatientDashboard';
import PrescriptionsListPage from './pages/PrescriptionsListPage';
import PrescriptionDetail from './pages/PrescriptionDetail';
import UploadPage from './pages/UploadPage';

// Pharmacy
import PharmacyDashboard from './pages/PharmacyDashboard';
import PharmacyRequestsPage from './pages/PharmacyRequestsPage';
import QuotationForm from './pages/QuotationForm';
import InventoryPage from './pages/InventoryPage';

// Admin
import AdminDashboard from './pages/AdminDashboard';

// Shared
import NotificationsPage from './pages/NotificationsPage';

function ProtectedRoute({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  const paths: Record<string, string> = { patient: '/patient', pharmacy: '/pharmacy', admin: '/admin' };
  return <Navigate to={paths[user.role] || '/login'} replace />;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="pb-10">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{ duration: 4500, style: { fontSize: '14px' } }} />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/" element={<RoleRedirect />} />

            {/* Patient */}
            <Route path="/patient" element={<ProtectedRoute roles={['patient']}><Layout><PatientDashboard /></Layout></ProtectedRoute>} />
            <Route path="/patient/upload" element={<ProtectedRoute roles={['patient']}><Layout><UploadPage /></Layout></ProtectedRoute>} />
            <Route path="/patient/prescriptions" element={<ProtectedRoute roles={['patient']}><Layout><PrescriptionsListPage /></Layout></ProtectedRoute>} />
            <Route path="/patient/prescriptions/:id" element={<ProtectedRoute roles={['patient']}><Layout><PrescriptionDetail /></Layout></ProtectedRoute>} />

            {/* Pharmacy */}
            <Route path="/pharmacy" element={<ProtectedRoute roles={['pharmacy']}><Layout><PharmacyDashboard /></Layout></ProtectedRoute>} />
            <Route path="/pharmacy/requests" element={<ProtectedRoute roles={['pharmacy']}><Layout><PharmacyRequestsPage /></Layout></ProtectedRoute>} />
            <Route path="/pharmacy/requests/:id" element={<ProtectedRoute roles={['pharmacy']}><Layout><QuotationForm /></Layout></ProtectedRoute>} />
            <Route path="/pharmacy/inventory" element={<ProtectedRoute roles={['pharmacy']}><Layout><InventoryPage /></Layout></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Layout><AdminDashboard /></Layout></ProtectedRoute>} />

            {/* Shared */}
            <Route path="/notifications" element={<ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
