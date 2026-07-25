import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardPage from '@/pages/DashboardPage';
import MastersPage from '@/pages/MastersPage';
import DepartmentPage from '@/pages/DepartmentPage';
import MyTasksPage from '@/pages/MyTasksPage';
import NotificationsPage from '@/pages/NotificationsPage';
import MobileProjectsPage from '@/pages/MobileProjectsPage';
import MilestonesPage from '@/pages/MilestonesPage';
import POAPage from '@/pages/POAPage';
import { useParams } from 'react-router-dom';
import type { ReactNode } from 'react';

function ProjectPage() {
  const { projectId } = useParams();
  return <DashboardPage filterProjectId={projectId} />;
}
function DeptPage() {
  const { projectId, departmentId } = useParams();
  return <DashboardPage filterProjectId={projectId} filterDepartmentId={departmentId} />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  if (profile?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="settings" element={<AdminRoute><MastersPage /></AdminRoute>} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="milestones" element={<MilestonesPage />} />
          <Route path="poa" element={<POAPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="projects-mobile" element={<MobileProjectsPage />} />
          <Route path="project/:projectId" element={<ProjectPage />} />
          <Route path="project/:projectId/department/:departmentId" element={<DeptPage />} />
        </Route>
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
