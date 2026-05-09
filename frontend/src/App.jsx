import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';
import MentorPanel from './pages/MentorPanel';
import StudentPanel from './pages/StudentPanel';
import './styles/global.css';

const ProtectedRoute = ({ children, role, centerId }) => {
  const { user, token } = useAuth();

  if (!token) {
    const loginPath = centerId ? `/center/${centerId}/login` : '/login';
    return <Navigate to={loginPath} replace />;
  }

  // Token mavjud lekin boshqa center ga tegishli bo'lsa — chiqarib yuboramiz
  if (centerId && user?.center_id && String(user.center_id) !== String(centerId)) {
    const loginPath = `/center/${centerId}/login`;
    return <Navigate to={loginPath} replace />;
  }

  if (role && user?.role !== role) {
    const loginPath = centerId ? `/center/${centerId}/login` : '/login';
    return <Navigate to={loginPath} replace />;
  }

  return children;
};

// /center/:centerId/* uchun wrapper
function CenterApp() {
  const { centerId } = useParams();
  if (centerId) localStorage.setItem('center_id', centerId);

  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="admin/*" element={
        <ProtectedRoute role="admin" centerId={centerId}><AdminPanel /></ProtectedRoute>
      } />
      <Route path="mentor/*" element={
        <ProtectedRoute role="mentor" centerId={centerId}><MentorPanel /></ProtectedRoute>
      } />
      <Route path="student/*" element={
        <ProtectedRoute role="student" centerId={centerId}><StudentPanel /></ProtectedRoute>
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
