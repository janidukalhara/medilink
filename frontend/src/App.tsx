import React, { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import HomePage from "./pages/Homepage";
import Navbar from "./components/shared/Navbar";
import LoadingSpinner from "./components/shared/LoadingSpinner";

// Auth
const LoginForm = lazy(() => import("./components/auth/LoginForm"));
const RegisterForm = lazy(() => import("./components/auth/RegisterForm"));

// Patient
const PatientDashboard = lazy(() => import("./pages/PatientDashboard"));
const PrescriptionsListPage = lazy(
  () => import("./pages/PrescriptionsListPage"),
);
const PrescriptionDetail = lazy(() => import("./pages/PrescriptionDetail"));
const UploadPage = lazy(() => import("./pages/UploadPage"));

// Pharmacy
const PharmacyDashboard = lazy(() => import("./pages/PharmacyDashboard"));
const PharmacyRequestsPage = lazy(() => import("./pages/PharmacyRequestsPage"));
const QuotationForm = lazy(() => import("./pages/QuotationForm"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));

// Admin
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
import AdminLayout from "./components/common/AdminLayout";

// Shared
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));

function ScrollToLocation() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
      else window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
}

function ProtectedRoute({
  children,
  roles,
}: {
  children: JSX.Element;
  roles?: string[];
}) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  if (!user) return <HomePage />;
  const paths: Record<string, string> = {
    patient: "/patient",
    pharmacy: "/pharmacy",
    admin: "/admin",
  };
  return <Navigate to={paths[user.role] || "/login"} replace />;
}

// FIX: Layout wrapper for non-admin routes
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="workspace-shell min-h-screen">
      <Navbar />
      <main className="workspace-main pb-10">{children}</main>
    </div>
  );
}

// FIX: Admin routes use AdminLayout, not the generic Navbar layout
function AdminRoute({ children }: { children: JSX.Element }) {
  return (
    <ProtectedRoute roles={["admin"]}>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    // FIX: Wrap entire app in ErrorBoundary to catch unhandled render errors
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <ScrollToLocation />
            <Toaster
              position="top-right"
              toastOptions={{ duration: 4500, style: { fontSize: "14px" } }}
            />
            <Suspense
              fallback={
                <div className="flex justify-center py-20">
                  <LoadingSpinner size="lg" />
                </div>
              }
            >
              <Routes>
                {/* Public */}
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<RegisterForm />} />
                <Route path="/" element={<RoleRedirect />} />

                {/* Patient — each route wrapped in its own ErrorBoundary */}
                <Route
                  path="/patient"
                  element={
                    <ProtectedRoute roles={["patient"]}>
                      <Layout>
                        <ErrorBoundary>
                          <PatientDashboard />
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/upload"
                  element={
                    <ProtectedRoute roles={["patient"]}>
                      <Layout>
                        <ErrorBoundary>
                          <UploadPage />
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/prescriptions"
                  element={
                    <ProtectedRoute roles={["patient"]}>
                      <Layout>
                        <ErrorBoundary>
                          <PrescriptionsListPage />
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patient/prescriptions/:id"
                  element={
                    <ProtectedRoute roles={["patient"]}>
                      <Layout>
                        <ErrorBoundary>
                          <PrescriptionDetail />
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Pharmacy */}
                <Route
                  path="/pharmacy"
                  element={
                    <ProtectedRoute roles={["pharmacy"]}>
                      <Layout>
                        <ErrorBoundary>
                          <PharmacyDashboard />
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pharmacy/requests"
                  element={
                    <ProtectedRoute roles={["pharmacy"]}>
                      <Layout>
                        <ErrorBoundary>
                          <PharmacyRequestsPage />
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pharmacy/requests/:id"
                  element={
                    <ProtectedRoute roles={["pharmacy"]}>
                      <Layout>
                        <ErrorBoundary>
                          <QuotationForm />
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pharmacy/inventory"
                  element={
                    <ProtectedRoute roles={["pharmacy"]}>
                      <Layout>
                        <ErrorBoundary>
                          <InventoryPage />
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Admin — uses dedicated AdminLayout */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <ErrorBoundary>
                        <AdminDashboard />
                      </ErrorBoundary>
                    </AdminRoute>
                  }
                />

                {/* Shared */}
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ErrorBoundary>
                          <NotificationsPage />
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
