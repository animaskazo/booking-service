import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BookingSystemMVP from './components/BookingSystem';
import AdminServices from './pages/AdminServices';
import AdminAppointments from './pages/AdminAppointments';
import Login from './pages/Login';
import AdminLayout from './components/AdminLayout';
import AdminSettings from './pages/AdminSettings';
import AdminTickets from './pages/AdminTickets';
import AdminTicketDetail from './pages/AdminTicketDetail';
import TicketMobileUpload from './pages/TicketMobileUpload';
import BookingReturn from './pages/BookingReturn';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DialogProvider } from './components/ui/dialog-provider';
import { PublicTrackingProvider } from './lib/public-tracking-context';
import TrackReservation from './pages/TrackReservation';
import ReservationStatus from './pages/ReservationStatus';
import TicketDetailPublic from './pages/TicketDetailPublic';

export default function App() {
  return (
    <DialogProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BookingSystemMVP />} />
          <Route path="/login" element={<Login />} />
          <Route path="/booking/return" element={<BookingReturn />} />
          <Route path="/tickets/:id/upload" element={<TicketMobileUpload />} />
          
          {/* Seguimiento Público */}
          <Route path="/track" element={<PublicTrackingProvider><TrackReservation /></PublicTrackingProvider>} />
          <Route path="/track/status" element={<PublicTrackingProvider><ReservationStatus /></PublicTrackingProvider>} />
          <Route path="/track/ticket" element={<PublicTrackingProvider><TicketDetailPublic /></PublicTrackingProvider>} />
          
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
            <Route path="tickets" element={<AdminTickets />} />
            <Route path="tickets/:id" element={<AdminTicketDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DialogProvider>
  );
}
