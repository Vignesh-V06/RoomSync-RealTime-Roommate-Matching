import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import FindRooms from './pages/FindRooms';
import CreateRoom from './pages/CreateRoom';
import OwnerDashboard from './pages/OwnerDashboard';
import ChatDashboard from './pages/ChatDashboard';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';

const HomeRoute = () => {
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/find-rooms" replace /> : <Home />;
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen text-slate-900 dark:text-slate-100 transition-colors duration-200">
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                borderRadius: '12px',
                background: 'var(--bg-surface)',
                color: 'var(--text-page)',
                border: '1px solid var(--border-subtle)'
              }
            }}
          />
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              <Route path="/profile" element={
                <ProtectedRoute><Profile /></ProtectedRoute>
              } />
              <Route path="/find-rooms" element={
                <ProtectedRoute><FindRooms /></ProtectedRoute>
              } />
              <Route path="/create-room" element={
                <ProtectedRoute><CreateRoom /></ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute><OwnerDashboard /></ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute>
                  {(() => {
                    let user = {};
                    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
                    return user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/find-rooms" replace />;
                  })()}
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute><ChatDashboard /></ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
