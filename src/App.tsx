import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import BookingSystemMVP from './components/BookingSystem';
import AdminServices from './pages/AdminServices';
import AdminAppointments from './pages/AdminAppointments';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminLayout from './components/AdminLayout';
import AdminSettings from './pages/AdminSettings';
import LandingPage from './pages/LandingPage';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/b/:businessId" element={<BookingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
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

function BookingPage() {
  const { businessId } = useParams();
  return <BookingSystemMVP businessId={businessId} />;
}
