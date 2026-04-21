import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
  Calendar,
  Settings,
  User,
  Link as LinkIcon,
  MapPin,
  Phone as PhoneIcon,
  Save,
  Coffee,
  Scissors,
  Stethoscope,
  Dumbbell,
  Wrench,
  Smartphone,
  Music,
  Heart,
  Camera,
  Briefcase,
  Gamepad,
  Truck,
  Check
} from 'lucide-react';
import {
  useAvailability,
  useCreateAvailability,
  useDeleteAvailability,
  useBusinessSettings,
  useUpdateBusinessSettings,
  useAuth,
  useProfile,
  useUpdateProfile
} from '../lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const DAYS_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

const AVAILABLE_ICONS = [
  { name: 'User', icon: User },
  { name: 'Scissors', icon: Scissors },
  { name: 'Stethoscope', icon: Stethoscope },
  { name: 'Dumbbell', icon: Dumbbell },
  { name: 'Coffee', icon: Coffee },
  { name: 'Wrench', icon: Wrench },
  { name: 'Smartphone', icon: Smartphone },
  { name: 'Music', icon: Music },
  { name: 'Heart', icon: Heart },
  { name: 'Camera', icon: Camera },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Gamepad', icon: Gamepad },
  { name: 'Truck', icon: Truck },
];

export default function AdminSettings() {
  const { user } = useAuth();
  const { data: globalAvailabilities = [], isLoading } = useAvailability(null, user?.id);
  const createAvailability = useCreateAvailability();
  const deleteAvailability = useDeleteAvailability();
  const { data: settings = { slot_interval: 30 } } = useBusinessSettings(user?.id);
  const updateSettings = useUpdateBusinessSettings();
  const { data: profile } = useProfile(user?.id);
  const updateProfile = useUpdateProfile();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedIcon, setSelectedIcon] = useState('User');

  useEffect(() => {
    if (profile?.icon_name) {
      setSelectedIcon(profile.icon_name);
    }
  }, [profile]);

  const handleAddGlobalHours = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const startTime = formData.get('startTime') as string;
    const endTime = formData.get('endTime') as string;

    if (selectedDays.length === 0) return alert('Selecciona al menos un día');

    try {
      for (const day of selectedDays) {
        await createAvailability.mutateAsync([{
          service_id: null,
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
          is_global: true
        }]);
      }
      setShowAdd(false);
      setSelectedDays([]);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="space-y-12 pb-24 font-sans">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-slate-200 px-3 py-1 mb-2">Workspace Central</Badge>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Configuración</h1>
          <p className="text-slate-500 font-medium">Personaliza tu presencia en el marketplace y ajusta tu operación</p>
        </div>
      </div>

      {/* SECCIÓN 1: PERFIL PERFIL */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <User className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Perfil y Marca</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-slate-900">
          <div className="lg:col-span-2">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardContent className="p-8">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                      await updateProfile.mutateAsync({
                        full_name: formData.get('businessName'),
                        slug: formData.get('slug'),
                        description: formData.get('description'),
                        phone: formData.get('phone'),
                        city: formData.get('city'),
                        service_type: formData.get('service_type'),
                        icon_name: selectedIcon
                      });
                    alert('Perfil actualizado con éxito');
                  }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest flex items-center gap-1.5">Nombre Público</label>
                      <input name="businessName" key={profile?.full_name} defaultValue={profile?.full_name} required className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all outline-none font-bold" placeholder="Ej: Barbería El Estilo" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-blue-500 ml-1 uppercase tracking-widest flex items-center gap-1.5">Identificador URL (Slug)</label>
                      <input name="slug" key={profile?.slug} defaultValue={profile?.slug} required className="w-full h-12 px-4 rounded-xl border border-blue-100 bg-blue-50/10 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none font-mono text-sm" placeholder="ej: mi-barberia" />
                    </div>
                  </div>

                  {/* Selector de Icono */}
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest flex items-center gap-1.5">Icono del Negocio</label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                      {AVAILABLE_ICONS.map((item) => {
                        const IconComp = item.icon;
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setSelectedIcon(item.name)}
                            className={`
                              relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all
                              ${selectedIcon === item.name 
                                ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}
                            `}
                          >
                            <IconComp className="w-5 h-5 mb-1" />
                            {selectedIcon === item.name && (
                              <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 shadow-md">
                                <Check className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest">Breve Descripción</label>
                    <textarea name="description" key={profile?.description} defaultValue={profile?.description} rows={2} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all outline-none resize-none font-medium" placeholder="Cuéntale a tus clientes qué servicios ofreces..." />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest flex items-center gap-1.5">Teléfono</label>
                      <input name="phone" key={profile?.phone} defaultValue={profile?.phone} className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all outline-none" placeholder="+56 9..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest flex items-center gap-1.5">Ciudad</label>
                      <input name="city" key={profile?.city} defaultValue={profile?.city} className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all outline-none" placeholder="Santiago, Chile" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-widest flex items-center gap-1.5 text-blue-600">Categoría Marketplace</label>
                      <select name="service_type" key={profile?.service_type} defaultValue={profile?.service_type} className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all outline-none appearance-none font-bold">
                        <option value="General">General</option>
                        <option value="Barbería">Barbería</option>
                        <option value="Salud">Salud</option>
                        <option value="Consultoría">Consultoría</option>
                        <option value="Gaming">Gaming</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button type="submit" size="lg" className="h-12 px-8 rounded-xl bg-slate-900 text-white font-bold transition-all" disabled={updateProfile.isPending}>
                      {updateProfile.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Guardar Información
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 text-slate-900">
            <Card className="border-slate-200 shadow-sm border-dashed border-2 bg-slate-50/50 h-full flex flex-col justify-center">
              <CardHeader className="text-center p-8">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-xl border border-slate-100 text-slate-900 mb-6 group-hover:rotate-6 transition-transform">
                  <LinkIcon className="w-10 h-10" />
                </div>
                <CardTitle className="text-xl font-black">Tu Enlace</CardTitle>
                <CardDescription>Usa este link para tus redes sociales</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0">
                <div 
                  onClick={() => {
                    const identifier = profile?.slug || user?.id || '';
                    const url = window.location.origin + '/b/' + identifier;
                    navigator.clipboard.writeText(url);
                    alert('¡Link copiado!');
                  }}
                  className="group relative cursor-pointer"
                >
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 font-mono text-xs text-slate-500 break-all transition-all hover:border-slate-900 hover:shadow-lg">
                    {window.location.origin}/b/<span className="text-slate-900 font-bold">{profile?.slug || 'usuario...'}</span>
                    <div className="absolute inset-0 bg-slate-900/5 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl transition-all">
                      <span className="bg-white px-3 py-1 rounded-lg text-[10px] font-black shadow-lg border border-slate-100">COPIAR</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* SECCIÓN 2: HORARIOS */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Calendar className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Horarios de Atención</h2>
          </div>
          {!showAdd && (
            <Button onClick={() => setShowAdd(true)} variant="outline" className="h-10 px-4 rounded-xl border-slate-200 font-bold">
              <Plus className="w-4 h-4 mr-2" /> Añadir Franja
            </Button>
          )}
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden text-slate-900">
          <CardContent className="p-0">
            {showAdd && (
              <div className="p-8 bg-slate-50/50 border-b animate-in fade-in slide-in-from-top-4">
                <form onSubmit={handleAddGlobalHours} className="max-w-2xl mx-auto space-y-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-xl">
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecciona los días</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_ES.map((day, i) => (
                        <Button
                          key={i}
                          type="button"
                          variant={selectedDays.includes(i) ? 'default' : 'outline'}
                          onClick={() => toggleDay(i)}
                          className={`h-10 px-4 rounded-xl text-sm font-bold transition-all shadow-none ${!selectedDays.includes(i) && 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50' }`}
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Apertura</label>
                      <input name="startTime" type="time" required className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none" defaultValue="09:00" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Cierre</label>
                      <input name="endTime" type="time" required className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none" defaultValue="18:00" />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="flex-1 h-11 rounded-xl bg-slate-900 font-bold" disabled={createAvailability.isPending}>
                      Confirmar
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowAdd(false)} className="h-11 rounded-xl px-8">Cancelar</Button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-px bg-slate-100">
              {isLoading ? (
                <div className="col-span-full p-12 text-center text-slate-400 italic font-medium"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Cargando...</div>
              ) : [1, 2, 3, 4, 5, 6, 0].map(dayNum => {
                const daySlots = globalAvailabilities.filter(a => a.day_of_week === dayNum);
                return (
                  <div key={dayNum} className="p-6 bg-white hover:bg-slate-50/50 transition-colors border-r last:border-r-0">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{DAYS_ES[dayNum].slice(0, 3)}</span>
                      {daySlots.length === 0 && <span className="text-[10px] font-bold text-slate-300 uppercase opacity-30">Cerrado</span>}
                    </div>
                    <div className="space-y-2">
                      {daySlots.map(slot => (
                        <div key={slot.id} className="group flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-[10px] font-mono font-bold text-slate-600">{slot.start_time.slice(0, 5)}-{slot.end_time.slice(0, 5)}</span>
                          <button onClick={() => deleteAvailability.mutateAsync({ id: slot.id, serviceId: null })} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SECCIÓN 3: SISTEMA */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <Settings className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Parámetros del Sistema</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-900">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-6 border-b">
              <CardTitle className="text-base font-bold">Generación de Turnos</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Intervalo base</label>
                  <span className="text-xl font-black text-slate-900">{settings.slot_interval} min</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[15, 20, 30, 45, 60].map(duration => (
                    <Button
                      key={duration}
                      variant={settings.slot_interval === duration ? 'default' : 'outline'}
                      onClick={() => updateSettings.mutate({ slot_interval: duration })}
                      className={`h-11 rounded-lg text-xs font-bold transition-all shadow-none ${settings.slot_interval !== duration && 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
                    >
                      {duration}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-6 border-b">
              <CardTitle className="text-base font-bold">Bloques de Descanso</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex gap-4 items-center">
                  <Coffee className={`w-5 h-5 ${settings.has_lunch_break ? 'text-emerald-500' : 'text-slate-300'}`} />
                  <div>
                    <p className="font-bold text-sm text-slate-900">Hora de Colación</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Bloqueo automático diario</p>
                  </div>
                </div>
                <button onClick={() => updateSettings.mutate({ has_lunch_break: !settings.has_lunch_break })} className={`w-12 h-6 rounded-full transition-colors relative ${settings.has_lunch_break ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${settings.has_lunch_break ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {settings.has_lunch_break && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Inicio</label>
                    <input type="time" defaultValue={settings.lunch_start} onBlur={(e) => updateSettings.mutate({ lunch_start: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fin</label>
                    <input type="time" defaultValue={settings.lunch_end} onBlur={(e) => updateSettings.mutate({ lunch_end: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none font-mono text-sm" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
