import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BookingSystemMVP from './components/BookingSystem';
import AdminServices from './pages/AdminServices';
import AdminAppointments from './pages/AdminAppointments';
import Login from './pages/Login';
import AdminLayout from './components/AdminLayout';
import AdminSettings from './pages/AdminSettings';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BookingSystemMVP />} />
        <Route path="/login" element={<Login />} />
        
        {/* Panel Administrativo Protegido con Layout */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          } 
        >
          {/* Sub-rutas que se renderizan dentro del Outlet del Layout */}
          <Route index element={<AdminAppointments />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
