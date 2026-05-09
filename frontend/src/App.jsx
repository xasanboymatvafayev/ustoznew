import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';
import MentorPanel from './pages/MentorPanel';
import StudentPanel from './pages/StudentPanel';
import './styles/global.css';

const ProtectedRoute = ({ children, role }) => {
  const { user, token } = useAuth();
  if (!token) {
    // center_id saqlash
    const centerId = window.location.pathname.split('/center/')[1]?.split('/')[0];
    const loginPath = centerId ? `/center/${centerId}/login` : '/login';
    return <Navigate to={loginPath} replace />;
  }
  if (role && user?.role !== role) return <Navigate to="/login" replace />;
  return children;
};

// /center/:centerId/* uchun wrapper
function CenterApp() {
  const { centerId } = useParams();
  // centerId ni global saqlaymiz
  if (centerId) localStorage.setItem('center_id', centerId);

  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="admin/*" element={
        <ProtectedRoute role="admin"><AdminPanel /></ProtectedRoute>
      } />
      <Route path="mentor/*" element={
        <ProtectedRoute role="mentor"><MentorPanel /></ProtectedRoute>
      } />
      <Route path="student/*" element={
        <ProtectedRoute role="student"><StudentPanel /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Multi-tenant: /center/:centerId/* */}
          <Route path="/center/:centerId/*" element={<CenterApp />} />

          {/* Fallback standalone routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={
            <ProtectedRoute role="admin"><AdminPanel /></ProtectedRoute>
          } />
          <Route path="/mentor/*" element={
            <ProtectedRoute role="mentor"><MentorPanel /></ProtectedRoute>
          } />
          <Route path="/student/*" element={
            <ProtectedRoute role="student"><StudentPanel /></ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
