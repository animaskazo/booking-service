import React, { useState } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  useAvailability,
  useCreateAvailability,
  useDeleteAvailability,
  useBusinessSettings,
  useUpdateBusinessSettings
} from '../lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const DAYS_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

export default function AdminSettings() {
  // Pasamos null para que el hook traiga solo las globales basándose en los cambios que hicimos
  const { data: globalAvailabilities = [], isLoading } = useAvailability(null);
  const createAvailability = useCreateAvailability();
  const deleteAvailability = useDeleteAvailability();
  const { data: settings = { slot_interval: 30 } } = useBusinessSettings();
  const updateSettings = useUpdateBusinessSettings();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

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
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configuración de Negocio</h1>
          <p className="text-slate-500">Define el horario laboral compartido por todos los servicios</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Horario Laboral General</CardTitle>
                  <CardDescription>Los turnos de todos los servicios se generarán dentro de estos rangos</CardDescription>
                </div>
                {!showAdd && (
                  <Button onClick={() => setShowAdd(true)} size="sm" className="bg-slate-900">
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir Rango
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {showAdd && (
                <div className="p-6 bg-slate-50 border-b animate-in fade-in slide-in-from-top-4">
                  <form onSubmit={handleAddGlobalHours} className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Días de la semana</label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_ES.map((day, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleDay(i)}
                            className={`
                              px-4 py-2 rounded-full border text-sm transition-colors duration-200
                              ${selectedDays.includes(i)
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'}
                            `}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Apertura</label>
                        <input name="startTime" type="time" required className="w-full p-2 border rounded-xl" defaultValue="09:00" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Cierre</label>
                        <input name="endTime" type="time" required className="w-full p-2 border rounded-xl" defaultValue="18:00" />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" disabled={createAvailability.isPending}>
                        {createAvailability.isPending ? 'Guardando...' : 'Guardar Horario'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100/50">
                {isLoading ? (
                  <div className="col-span-full p-8 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Cargando horarios...
                  </div>
                ) : globalAvailabilities.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-slate-400">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No has definido un horario laboral global aún.</p>
                  </div>
                ) : (
                  [1, 2, 3, 4, 5, 6, 0].map(dayNum => {
                    const daySlots = globalAvailabilities.filter(a => a.day_of_week === dayNum);
                    
                    return (
                      <div key={dayNum} className="p-4 bg-white flex flex-col gap-2 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{DAYS_ES[dayNum]}</span>
                          {daySlots.length === 0 && <Badge variant="ghost" className="text-[10px] text-slate-300 font-bold">Cerrado</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {daySlots.map(slot => (
                            <Badge key={slot.id} variant="secondary" className="bg-slate-50 border-slate-200 text-slate-700 pl-2 pr-1 py-1 flex items-center gap-1.5 transition-all duration-300 hover:bg-white hover:shadow-sm">
                              <span className="text-[10px] font-bold">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</span>
                              <button
                                onClick={() => deleteAvailability.mutateAsync({ id: slot.id, serviceId: null })}
                                className="p-0.5 hover:text-red-500 rounded-md transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b py-4">
              <CardTitle className="text-base font-black uppercase tracking-widest text-slate-400">Parámetros Globales</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Intervalo */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <label className="text-xs font-black text-slate-900 uppercase tracking-widest">Intervalo (Min)</label>
                   <Badge variant="outline" className="font-mono text-slate-900 bg-slate-50 border-slate-200 px-3">{settings.slot_interval} min</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[15, 20, 30, 45, 60].map((duration) => (
                    <button
                      key={duration}
                      onClick={() => updateSettings.mutate({ slot_interval: duration })}
                      className={`
                        flex-1 h-10 rounded-lg border transition-all duration-300 flex items-center justify-center text-xs font-bold
                        ${settings.slot_interval === duration
                          ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                          : 'bg-white border-slate-100 text-slate-500 hover:border-slate-400 hover:bg-slate-50'}
                      `}
                    >
                      {duration}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colación */}
              <div className="space-y-4 pt-6 border-t">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <label className="text-xs font-black text-slate-900 uppercase tracking-widest">Colación / Break</label>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Espacio bloqueado</p>
                  </div>
                  <button
                    onClick={() => updateSettings.mutate({ has_lunch_break: !settings.has_lunch_break })}
                    className={`
                      relative inline-flex h-5 w-10 items-center rounded-full transition-colors
                      ${settings.has_lunch_break ? 'bg-emerald-500' : 'bg-slate-200'}
                    `}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.has_lunch_break ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                
                {settings.has_lunch_break && (
                  <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Inicio</label>
                      <input
                        type="time"
                        defaultValue={settings.lunch_start}
                        onBlur={(e) => updateSettings.mutate({ lunch_start: e.target.value })}
                        className="w-full h-10 p-2 border border-slate-200 rounded-lg text-sm font-mono bg-slate-50/50 focus:bg-white outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Fin</label>
                      <input
                        type="time"
                        defaultValue={settings.lunch_end}
                        onBlur={(e) => updateSettings.mutate({ lunch_end: e.target.value })}
                        className="w-full h-10 p-2 border border-slate-200 rounded-lg text-sm font-mono bg-slate-50/50 focus:bg-white outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
