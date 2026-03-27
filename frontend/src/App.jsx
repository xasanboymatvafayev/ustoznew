import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';
import MentorPanel from './pages/MentorPanel';
import StudentPanel from './pages/StudentPanel';
import './styles/global.css';

const ProtectedRoute = ({ children, role }) => {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
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
