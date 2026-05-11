import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Infrastructure from './pages/Infrastructure';
import Devices from './pages/Devices';
import DetectionLogs from './pages/DetectionLogs';
import Users from './pages/Users';
import MonitoringDashboard from './pages/MonitoringDashboard';
import Reports from './pages/Reports';


const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/monitoring" replace />;
  return children;
};

export default function App() {
  const { user } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/dashboard' : '/monitoring'} replace /> : <Login />} />

        <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to={user?.role === 'admin' ? '/dashboard' : '/monitoring'} replace />} />
          <Route path="dashboard"      element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
          <Route path="infrastructure" element={<ProtectedRoute adminOnly><Infrastructure /></ProtectedRoute>} />
          <Route path="devices"        element={<ProtectedRoute adminOnly><Devices /></ProtectedRoute>} />
          <Route path="logs"           element={<ProtectedRoute><DetectionLogs /></ProtectedRoute>} />
          <Route path="users"          element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
          <Route path="monitoring"     element={<ProtectedRoute><MonitoringDashboard /></ProtectedRoute>} />
          <Route path="reports"        element={<ProtectedRoute><Reports /></ProtectedRoute>} />

        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
