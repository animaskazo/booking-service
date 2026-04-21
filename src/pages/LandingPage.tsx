import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Search,
  MapPin,
  ArrowRight, 
  Star,
  Sparkles,
  Scissors,
  Stethoscope,
  Briefcase,
  Gamepad,
  MoreHorizontal,
  Loader2,
  Dumbbell,
  Coffee,
  Wrench,
  Smartphone,
  Music,
  Heart,
  Camera,
  Truck,
  User
} from 'lucide-react';
import { useAllProfiles } from '../lib/supabase-client';

const ICON_MAP: Record<string, any> = {
  User,
  Scissors,
  Stethoscope,
  Dumbbell,
  Coffee,
  Wrench,
  Smartphone,
  Music,
  Heart,
  Camera,
  Briefcase,
  Gamepad,
  Truck,
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { data: profiles = [], isLoading } = useAllProfiles();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const categories = [
    { name: 'Todos', icon: <MoreHorizontal className="w-4 h-4" /> },
    { name: 'Barbería', icon: <Scissors className="w-4 h-4" /> },
    { name: 'Salud', icon: <Stethoscope className="w-4 h-4" /> },
    { name: 'Consultoría', icon: <Briefcase className="w-4 h-4" /> },
    { name: 'Gaming', icon: <Gamepad className="w-4 h-4" /> },
  ];

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         profile.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || profile.service_type === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-slate-900 selection:text-white pb-20">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 md:px-12 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center rotate-3 shadow-lg">
              <Calendar className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-black tracking-tighter uppercase italic text-slate-900">BookingPro</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Soy Profesional
            </Button>
            <Button onClick={() => navigate('/register')}>
              Crear mi Agenda
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Marketplace */}
      <section className="bg-white border-b border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Explora servicios locales</span>
          </div>
          
          <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-slate-950 mb-6 leading-none">
            Encuentra y reserva <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-slate-900">tu próxima cita.</span>
          </h1>

          {/* Buscador Principal */}
          <div className="max-w-3xl mx-auto mt-10 relative group">
            <div className="relative flex flex-col md:flex-row gap-2 bg-white p-2 rounded-2xl md:rounded-full shadow-2xl border border-slate-100 items-center">
              <div className="flex items-center flex-1 px-4 w-full">
                <Search className="w-5 h-5 text-slate-400 mr-3" />
                <input 
                  type="text" 
                  placeholder="¿Qué servicio buscas? (ej: Barbería, Dentista, Santiago...)"
                  className="w-full h-12 outline-none text-slate-700 font-medium bg-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button size="lg" className="w-full md:w-auto px-10">
                Buscar ahora
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Bar */}
      <div className="sticky top-[68px] z-40 bg-white/50 backdrop-blur-sm shadow-sm py-4 mb-12">
        <div className="max-w-7xl mx-auto px-6 overflow-x-auto">
          <div className="flex items-center justify-center gap-3">
            {categories.map((cat) => (
              <Button
                key={cat.name}
                variant={selectedCategory === cat.name ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat.name)}
                size="sm"
                className="rounded-full px-5 h-9"
              >
                {cat.icon}
                <span className="ml-2">{cat.name}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Section */}
      <main className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {searchTerm || selectedCategory !== 'Todos' ? 'Resultados encontrados' : 'Negocios Destacados'}
          </h2>
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{filteredProfiles.length} resultados</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="font-bold">Cargando marketplace...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200 px-6">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No encontramos resultados</h3>
            <p className="text-slate-500 max-w-sm">Prueba buscando con otras palabras o selecciona una categoría diferente.</p>
            <Button variant="link" onClick={() => { setSearchTerm(''); setSelectedCategory('Todos'); }} className="mt-4">
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProfiles.map((p) => (
              <CardBusiness key={p.id} profile={p} onClick={() => navigate(`/b/${p.slug}`)} />
            ))}
          </div>
        )}
      </main>

      {/* CTA para Profesionales */}
      <section className="max-w-5xl mx-auto px-6 mt-24">
        <div className="bg-slate-900 rounded-[3rem] p-10 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] pointer-events-none" />
          <h3 className="text-3xl md:text-5xl font-black mb-6 tracking-tight italic">¿Eres profesional?</h3>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">Únete al marketplace de agendamiento más moderno de Latinoamérica. Crea tu perfil en 2 minutos.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => navigate('/register')} size="lg" variant="secondary" className="w-full sm:w-auto font-bold h-14 px-10">
              Empezar Gratis <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button onClick={() => navigate('/login')} variant="outline" className="w-full sm:w-auto font-bold h-14 px-10 bg-transparent text-white border-white/20 hover:bg-white/10">
              Acceso Staff
            </Button>
          </div>
        </div>
      </section>

      <footer className="mt-24 py-12 border-t border-slate-100 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Calendar className="text-slate-400 w-5 h-5" />
          <span className="text-sm font-black text-slate-400 tracking-tighter uppercase italic">BookingPro</span>
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">&copy; 2026 Superdigital Solutions</p>
      </footer>
    </div>
  );
}

function CardBusiness({ profile, onClick }: { profile: any, onClick: () => void }) {
  const IconComp = ICON_MAP[profile.icon_name || 'User'] || User;

  return (
    <div 
      onClick={onClick}
      className="group bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-2xl hover:border-blue-100 hover:-translate-y-2 transition-all cursor-pointer flex flex-col h-full"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-50 group-hover:scale-110 group-hover:bg-blue-50 group-hover:border-blue-100 transition-all">
          <IconComp className="w-8 h-8 text-slate-300 group-hover:text-blue-600" />
        </div>
        <div className="flex gap-1 text-blue-500">
          <Star className="w-4 h-4 fill-current" />
          <Star className="w-4 h-4 fill-current" />
          <Star className="w-4 h-4 fill-current" />
          <Star className="w-4 h-4 fill-current" />
          <Star className="w-4 h-4 fill-current" />
        </div>
      </div>

      <div className="flex-1">
        <BadgeCategory category={profile.service_type || 'Servicio'} />
        <h3 className="text-xl font-black text-slate-900 mt-2 line-clamp-1">{profile.full_name}</h3>
        <p className="text-slate-500 text-sm mt-3 line-clamp-2 leading-relaxed font-medium">
          {profile.description || 'Sin descripción disponible.'}
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-400">
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-widest">{profile.city || 'Ubicación remota'}</span>
        </div>
        <Button variant="ghost" size="sm" className="font-bold text-blue-600 group-hover:translate-x-1 transition-transform p-0">
          Reservar <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function BadgeCategory({ category }: { category: string }) {
  return (
    <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border border-slate-100">
      {category}
    </span>
  );
}
