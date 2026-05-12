import React from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Calendar,
  Settings,
  Briefcase,
  LogOut,
  Menu,
  X,
  ChevronRight,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase, useAuth } from '../lib/supabase-client';

const sidebarItems = [
  { name: 'Calendario', path: '/admin', icon: Calendar },
  { name: 'Servicios', path: '/admin/services', icon: Briefcase },
  { name: 'Tickets Soporte', path: '/admin/tickets', icon: FileText },
  { name: 'Configuración', path: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800 shadow-xl">
        <div className="p-9">
          <img
            src="/powerfix-blanco.png"
            alt="Powerfix Logo"
            className="w-40 h-auto"
          />
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

      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-40 shadow-lg border-b border-slate-800">
        <div className="flex items-center">
          <img
            src="/powerfix-blanco.png"
            alt="Powerfix Logo"
            className="h-8 w-auto"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-red-400 p-2"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
          </Button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900 z-50 pt-20 flex flex-col">
          {/* Mobile Menu Header */}
          <div className="px-6 py-6 border-b border-slate-800 flex items-center justify-between bg-white/5">
            <span className="text-white font-bold text-lg">Menú</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="bg-slate-800 p-2 rounded-lg text-slate-400"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 px-6 py-8 space-y-2">
            {sidebarItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/admin' && location.pathname === '/admin');
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-4 p-4 rounded-xl text-lg font-bold transition-all
                    ${isActive
                      ? 'bg-white text-slate-900 shadow-xl'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'}
                  `}
                >
                  <item.icon className={`w-6 h-6 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-6 mt-auto border-t border-slate-800 bg-slate-950/50">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-400/10 p-4 rounded-xl font-bold"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Desktop */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-8 z-10 shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">
              {sidebarItems.find(item => location.pathname === item.path || (item.path === '/admin' && location.pathname === '/admin'))?.name || 'Administración'}
            </h2>
          </div>

          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-red-500 hover:bg-red-50 font-bold rounded-lg transition-all"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pt-16 md:pt-0 bg-white">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

