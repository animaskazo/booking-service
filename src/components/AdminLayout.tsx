import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { 
  Calendar, 
  Settings, 
  Briefcase, 
  LogOut, 
  Menu, 
  X,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase, useAuth } from '../lib/supabase-client';

const sidebarItems = [
  { name: 'Calendario', path: '/admin', icon: Calendar },
  { name: 'Servicios', path: '/admin/services', icon: Briefcase },
  { name: 'Configuración', path: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800 shadow-xl">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-xl">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">BookingPro</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/admin' && location.pathname === '/admin');
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium group
                  ${isActive 
                    ? 'bg-white text-slate-900 shadow-lg shadow-white/5' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                `}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-white'}`} />
                {item.name}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">{user?.email?.split('@')[0]}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Administrador</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-6 z-50 shadow-lg">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          <span className="font-bold">BookingPro</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900 z-40 pt-20 px-6 space-y-2">
          {sidebarItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-4 p-4 text-white text-lg font-medium border-b border-slate-800"
            >
              <item.icon className="w-6 h-6 text-slate-400" />
              {item.name}
            </Link>
          ))}
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-400 p-4 mt-10"
            onClick={handleLogout}
          >
            <LogOut className="w-6 h-6 mr-4" />
            Cerrar Sesión
          </Button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pt-16 md:pt-0 overflow-y-auto">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
