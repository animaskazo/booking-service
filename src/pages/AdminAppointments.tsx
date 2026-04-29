import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  User,
  Mail,
  Phone,
  Tag,
  AlertCircle,
  FileText,
  CreditCard
} from 'lucide-react';
import {
  useAppointmentsByDateRange,
  useUpdateAppointmentStatus,
  useDeleteAppointment,
  useAvailability,
  useBusinessSettings,
  useServices,
  useCreateAppointment,
  useTickets,
  sendBookingEmail,
  useCreateTicket,
  useTicketByAppointment,
  useUpdateTicket
} from '../lib/supabase-client';
import { isSlotOccupied, generateShortId, formatPrice, formatDateForDisplay, formatTimeRange } from '../lib/utils-booking';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { ChevronRight as ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminAppointments() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date, time: string } | null>(null);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const navigate = useNavigate();
  const { data: tickets = [] } = useTickets();

  const { data: existingTicket } = useTicketByAppointment(selectedApp?.id);
  const createTicketMutation = useCreateTicket();
  const updateTicketMutation = useUpdateTicket();

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fechas de la semana
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  const { data: appointments = [] } = useAppointmentsByDateRange(weekDays[0], addDays(weekDays[6], 1));
  const { data: globalAvailabilities = [] } = useAvailability(null);
  const { data: bSettings = { lunch_start: '13:00', lunch_end: '14:00', has_lunch_break: true, slot_interval: 30 } } = useBusinessSettings();
  const { data: services = [] } = useServices();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Calcular rango de horas visibles basado en disponibilidad global
  const visibleHours = useMemo(() => {
    if (globalAvailabilities.length === 0) return { start: 9, end: 18 };

    let min = 24;
    let max = 0;

    globalAvailabilities.forEach(avail => {
      const hStart = parseInt(avail.start_time.split(':')[0]);
      const hEnd = parseInt(avail.end_time.split(':')[0]) + 1;
      if (hStart < min) min = hStart;
      if (hEnd > max) max = hEnd;
    });

    // Margen de seguridad
    return {
      start: Math.max(0, min - 1),
      end: Math.min(24, max + 1)
    };
  }, [globalAvailabilities]);

  const hoursArray = useMemo(() => {
    const hours = [];
    for (let h = visibleHours.start; h < visibleHours.end; h++) {
      hours.push(h);
    }
    return hours;
  }, [visibleHours]);

  const updateStatus = useUpdateAppointmentStatus();
  const deleteAppointment = useDeleteAppointment();
  const createAppointmentMutation = useCreateAppointment();



  // Corregir handleNext (tenía un error en el código original de arriba, decía -7 en ambos)
  const handlePrevPeriod = () => setCurrentDate(addDays(currentDate, isMobile ? -1 : -7));
  const handleNextPeriod = () => setCurrentDate(addDays(currentDate, isMobile ? 1 : 7));
  const handleToday = () => setCurrentDate(new Date());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <Badge className="bg-green-100 text-[#0e7c36] hover:bg-green-200 border-none">Confirmada</Badge>;
      case 'pending': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">Agendada</Badge>;
      case 'completed': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none">Realizada</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none">Cancelada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: status as 'pending' | 'confirmed' | 'cancelled' | 'completed' });
    } catch (err) {
      console.error(err);
    }
  };

  const { showConfirm, showError } = useDialog();

  const handleDelete = async (id: string) => {
    showConfirm(
      'Eliminar cita',
      '¿Estás seguro de eliminar esta cita de forma permanente? Esta acción no se puede deshacer.',
      async () => {
        try {
          await deleteAppointment.mutateAsync(id);
        } catch (err) {
          console.error(err);
        }
      },
      'ELIMINAR'
    );
  };

  const handleCreateManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) return;

    const formData = new FormData(e.currentTarget);
    const serviceId = formData.get('serviceId') as string;
    const service = services.find(s => s.id === serviceId);

    if (!service) return;

    const startTime = new Date(selectedSlot.date);
    const [hours, minutes] = selectedSlot.time.split(':');
    startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(startTime.getMinutes() + (bSettings.slot_interval || 30));

    // Validar colisión (cruzar contra todas las citas de la semana)
    if (isSlotOccupied(startTime, endTime, appointments)) {
      showError('Horario no disponible', 'Este horario ya está ocupado por otra cita. Por favor elige otro momento.');
      return;
    }

    try {
      const result = await createAppointmentMutation.mutateAsync({
        service_id: serviceId,
        customer_name: formData.get('name') as string,
        customer_email: formData.get('email') as string,
        customer_phone: formData.get('phone') as string,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'confirmed' as 'pending' | 'confirmed' | 'cancelled' | 'completed',
        notes: formData.get('notes') as string || 'Creado manualmente por admin',
        short_id: generateShortId()
      });

      // Enviar email de confirmación para reserva manual
      sendBookingEmail({
        customerName: formData.get('name') as string,
        customerEmail: formData.get('email') as string,
        serviceName: service.name,
        date: formatDateForDisplay(startTime),
        time: formatTimeRange(startTime, endTime),
        shortId: result.short_id,
        notes: (formData.get('notes') as string) || undefined,
        techSupportEmail: 'fernando.rg@live.cl'
      });

      setSelectedSlot(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Agenda</h1>
          <p className="text-slate-500">Control total de turnos y disponibilidad del negocio</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border-2 border-dashed border-blue-500" /> Agendada</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500 border border-green-600" /> Confirmada</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-purple-500 border border-purple-600" /> Realizada</div>
          </div>
          <Tabs value={view} onValueChange={(v: any) => setView(v)} className="bg-slate-100 p-1 rounded-xl">
            <TabsList className="bg-transparent">
              <TabsTrigger value="calendar" className="rounded-lg">Calendario</TabsTrigger>
              <TabsTrigger value="list" className="rounded-lg">Lista</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="space-y-6">
          {/* Calendar Navigation */}
          <div className="flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded-xl border gap-4">
            <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-start">
              <Button variant="outline" size="icon" onClick={handlePrevPeriod} className="h-10 w-10 border-slate-200">
                <ChevronLeft className="w-5 h-5 text-slate-700" />
              </Button>
              <div className="flex flex-col items-center">
                <h2 className="text-lg font-bold text-slate-900 capitalize leading-none">
                  {format(currentDate, isMobile ? "EEEE d 'de' MMMM" : "MMMM yyyy", { locale: es })}
                </h2>
                {!isMobile && (
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Vista Semanal</p>
                )}
              </div>
              <Button variant="outline" size="icon" onClick={handleNextPeriod} className="h-10 w-10 border-slate-200">
                <ChevronRight className="w-5 h-5 text-slate-700" />
              </Button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                className="flex-1 md:flex-none font-bold text-slate-700 bg-white border-slate-200 h-10 px-6 uppercase text-[10px] tracking-widest"
                onClick={handleToday}
              >
                Hoy
              </Button>
              {isMobile && (
                <Badge variant="outline" className="px-3 py-1.5 rounded-lg border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                  Día
                </Badge>
              )}
            </div>
          </div>

          {/* Weekly/Daily Grid */}
          <div className="bg-white rounded-2xl border shadow-lg overflow-hidden flex flex-col">
            <div className={`grid ${isMobile ? 'grid-cols-[60px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'} divide-x border-b bg-slate-50/50`}>
              <div className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center flex items-center justify-center">Hora</div>
              {(isMobile ? [currentDate] : weekDays).map((day, i) => (
                <div key={i} className={`p-4 text-center ${isSameDay(day, new Date()) ? 'bg-slate-900/5' : ''}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(day, 'EEE', { locale: es })}</p>
                  <p className={`text-xl md:text-2xl font-black ${isSameDay(day, new Date()) ? 'text-slate-900' : 'text-slate-500'}`}>
                    {format(day, 'dd')}
                  </p>
                </div>
              ))}
            </div>

            <ScrollArea className="h-[70vh] md:h-[700px]">
              <div className={`grid ${isMobile ? 'grid-cols-[60px_1fr]' : 'grid-cols-[80px_repeat(7,1fr)]'} divide-x min-h-full`}>
                {/* Hours Column */}
                <div className="divide-y bg-slate-50/30">
                  {hoursArray.map((hour) => (
                    <div key={hour} className="h-24 md:h-32 p-2 text-[10px] font-bold text-slate-400 border-b relative flex items-start justify-center">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {(isMobile ? [currentDate] : weekDays).map((day, dayIdx) => {
                  const dayApps = appointments.filter(a => isSameDay(parseISO(a.start_time), day));
                  const isToday = isSameDay(day, new Date());
                  const interval = bSettings.slot_interval || 30;
                  const slotsPerHover = 60 / interval;

                  return (
                    <div key={dayIdx} className={`divide-y relative min-h-full ${isToday ? 'bg-slate-50/40' : ''}`}>
                      {hoursArray.map((hour) => (
                        <div key={hour} className="h-24 md:h-32 border-b group relative divide-y divide-slate-100/30">
                          {/* Sub-slots within the hour */}
                          {[...Array(slotsPerHover)].map((_, i) => {
                            const minutes = i * interval;
                            const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                            return (
                              <button
                                key={i}
                                onClick={() => setSelectedSlot({ date: day, time: timeStr })}
                                className="w-full relative hover:bg-slate-900/5 transition-colors z-0 flex items-start justify-end pr-1 pt-0.5"
                                style={{ height: `${100 / slotsPerHover}%` }}
                              >
                                <span className="opacity-0 group-hover:opacity-20 text-[8px] font-bold">{timeStr}</span>
                              </button>
                            );
                          })}

                          {/* Render appointments for this specific hour */}
                          {dayApps.filter(a => parseISO(a.start_time).getHours() === hour).map(app => {
                            const start = parseISO(app.start_time);
                            // Height relative to the hour cell (24 or 32 units)
                            const top = (start.getMinutes() / 60) * 100;
                            const duration = (new Date(app.end_time).getTime() - new Date(app.start_time).getTime()) / (1000 * 60);
                            const height = (duration / 60) * 100;

                            const isPending = app.status === 'pending';
                            const isCompleted = app.status === 'completed';
                            const isConfirmed = app.status === 'confirmed';

                            let sColor = '#3b82f6';
                            if (isConfirmed) sColor = '#0e7c36';
                            if (isCompleted) sColor = '#a855f7';

                            return (
                              <div
                                key={app.id}
                                className={`group absolute left-1 right-1 rounded-sm p-1.5 md:p-2 text-[10px] md:text-[11px] font-bold overflow-visible z-10 border-none cursor-pointer flex flex-col justify-center shadow-sm transition-all duration-300 hover:brightness-105 hover:shadow-md
                                  ${isPending ? 'border-dashed' : 'border-solid'}
                                `}
                                style={{
                                  top: `calc(${top}% + 2px)`,
                                  height: `calc(${height}% - 4px)`,
                                  backgroundColor: `${sColor}${isPending ? '15' : '25'}`,
                                  borderLeft: `4px solid ${sColor}`,
                                  color: sColor
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedApp(app);
                                }}
                              >
                                {/* Tooltip Flotante */}
                                <div className="invisible group-hover:visible absolute bottom-full left-0 mb-2 z-[200] w-48 p-3 bg-slate-900 text-white rounded-xl shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reserva #{app.short_id || app.id.slice(0, 5)}</p>
                                    <p className="text-sm font-bold truncate text-white">{app.customer_name}</p>
                                    <p className="text-[10px] text-slate-300 flex items-center gap-1.5 font-medium">
                                      <Tag className="w-3 h-3" /> {app.service?.name}
                                    </p>
                                    <p className="text-[10px] text-slate-300 flex items-center gap-1.5 font-medium">
                                      <Clock className="w-3 h-3" /> {format(parseISO(app.start_time), 'HH:mm')} - {format(parseISO(app.end_time), 'HH:mm')}
                                    </p>
                                  </div>
                                  <div className="absolute top-full left-4 w-2 h-2 bg-slate-900 rotate-45 -translate-y-1" />
                                </div>

                                <div className="flex flex-col items-center justify-center">
                                  <p className="truncate leading-tight font-black text-center tracking-tight">
                                    #{app.short_id || app.id.slice(0, 5)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar cliente, email o short ID..."
                className="pl-10 h-11 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="confirmed">Confirmadas</option>
                <option value="completed">Completadas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">ID</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Servicio</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Fecha y Hora</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Estado</th>
                    <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments
                    .filter(a => {
                      const matchesSearch =
                        a.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.short_id?.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
                      return matchesSearch && matchesStatus;
                    })
                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                    .map(app => (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <Badge variant="outline" className="font-mono text-[10px]">{app.short_id || '---'}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{app.customer_name}</div>
                          <div className="text-xs text-slate-500">{app.customer_email}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: app.service?.color }} />
                            <span className="font-medium text-slate-700">{app.service?.name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-bold text-slate-700">{format(parseISO(app.start_time), 'HH:mm')} - {format(parseISO(app.end_time), 'HH:mm')}</div>
                          <div className="text-xs text-slate-500">{format(parseISO(app.start_time), 'dd MMM, yyyy', { locale: es })}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1 items-start">
                            {app.paid ? (
                              <Badge className="bg-emerald-50 hover:bg-emerald-50 pointer-events-none text-emerald-700 border border-emerald-200/50 text-[9px] font-black tracking-widest uppercase shadow-none py-0 px-2 h-5 flex items-center justify-center rounded-md">Pagado</Badge>
                            ) : (
                              <Badge className="bg-amber-50 hover:bg-amber-50 pointer-events-none text-amber-700 border border-amber-200/50 text-[9px] font-black tracking-widest uppercase shadow-none py-0 px-2 h-5 flex items-center justify-center rounded-md">Por Pagar</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="text-blue-600 h-8 w-8" title="Ver Detalles" onClick={() => setSelectedApp(app)}>
                              <Search className="w-4 h-4" />
                            </Button>
                            {(() => {
                              const ticketForApp = tickets.find((t: any) => t.appointment_id === app.id);
                              return ticketForApp ? (
                                <Button size="icon" variant="ghost" className="text-emerald-600 h-8 w-8" title="Ver Ticket" onClick={() => navigate(`/admin/tickets/${ticketForApp.id}`)}>
                                  <FileText className="w-4 h-4" />
                                </Button>
                              ) : app.status !== 'pending' ? (
                                <Button size="icon" variant="ghost" className="text-blue-500 h-8 w-8" title="Iniciar Ticket" disabled={createTicketMutation.isPending} onClick={async () => {
                                  const newTicket = await createTicketMutation.mutateAsync(app.id);
                                  navigate(`/admin/tickets/${newTicket.id}`);
                                }}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              ) : null;
                            })()}
                            {app.status === 'pending' && (
                              <Button size="icon" variant="ghost" className="text-green-600 h-8 w-8" title="Confirmar" onClick={() => handleStatusUpdate(app.id, 'confirmed')}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {app.status === 'confirmed' && (
                              <Button size="icon" variant="ghost" className="text-slate-600 h-8 w-8" title="Marcar como realizada" onClick={() => handleStatusUpdate(app.id, 'completed')}>
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="text-red-400 h-8 w-8" title="Eliminar" onClick={() => handleDelete(app.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {appointments.length === 0 && (
                <div className="p-20 text-center text-slate-400">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  No hay citas registradas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Reserva Manual */}
      {selectedSlot && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSlot(null)} />
          
          <div className="flex min-h-full items-center justify-center p-4">
            <Card className="relative z-10 w-full max-w-lg shadow-2xl overflow-hidden rounded-[32px] border border-slate-100 bg-white" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 pb-6">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-slate-900 p-1.5 rounded-lg text-white">
                      <Plus className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-xl">Nueva Reserva Manual</CardTitle>
                  </div>
                  <CardDescription className="flex items-center gap-1.5 font-medium text-slate-500">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {format(selectedSlot.date, "EEEE d 'de' MMMM", { locale: es })} a las {selectedSlot.time}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => setSelectedSlot(null)}>
                  <XCircle className="w-6 h-6" />
                </Button>
              </div>
            </CardHeader>
            <form onSubmit={handleCreateManual}>
              <CardContent className="p-0 overflow-y-auto max-h-[70vh]">
                <div className="p-8 space-y-8">
                  {/* Appointment Details Section */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-px bg-slate-200" /> Detalles de la Cita
                    </p>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-slate-400" /> Servicio Solicitado
                        </Label>
                        <div className="relative">
                          <select name="serviceId" required className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-4 pr-10 py-2 text-sm focus:ring-2 focus:ring-slate-900 outline-none appearance-none font-medium">
                            <option value="">Selecciona un servicio...</option>
                            {services.map(s => <option key={s.id} value={s.id}>{s.name} - {formatPrice(s.price)}</option>)}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Information Section */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-px bg-slate-200" /> Información del Cliente
                    </p>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" /> Nombre Completo
                        </Label>
                        <Input name="name" required placeholder="Ej: Juan Pérez" className="h-12 rounded-xl bg-slate-50/50 focus:bg-white border-slate-200" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                          </Label>
                          <Input name="email" type="email" required placeholder="juan@gmail.com" className="h-12 rounded-xl bg-slate-50/50 focus:bg-white border-slate-200" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> Teléfono
                          </Label>
                          <Input name="phone" required placeholder="+56 9..." className="h-12 rounded-xl bg-slate-50/50 focus:bg-white border-slate-200" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Internal Notes Section */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-px bg-slate-200" /> Configuración Adicional
                    </p>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-slate-400" /> Notas Internas
                      </Label>
                      <textarea
                        name="notes"
                        placeholder="Agrega recordatorios o detalles especiales para esta cita..."
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white p-4 text-sm outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="p-8 bg-slate-50 border-t flex flex-row-reverse gap-4">
                <Button
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-xs transition-all active:scale-95"
                  disabled={createAppointmentMutation.isPending}
                >
                  {createAppointmentMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> PROCESANDO...
                    </div>
                  ) : 'CONFIRMAR RESERVA'}
                </Button>
                <Button type="button" variant="outline" className="h-12 px-6 border-slate-200 font-bold hover:bg-white uppercase tracking-widest text-xs transition-all active:scale-95" onClick={() => setSelectedSlot(null)}>
                  CANCELAR
                </Button>
              </div>
            </form>
          </Card>
          </div>
        </div>
      )}

      {selectedApp && (
        <div className="fixed inset-0 z-[999] overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedApp(null)} />
          
          <div className="flex min-h-full items-center justify-center p-4">
            <Card className="relative z-10 w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 rounded-[32px] border border-slate-100 bg-white" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="bg-slate-50/50 border-b border-slate-100/60">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">Detalle de Reserva</CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">{selectedApp.short_id}</Badge>
                  </div>
                  <CardDescription>
                    Información completa de la cita
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => setSelectedApp(null)}>
                  <XCircle className="w-6 h-6" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                
                {/* Columna Izquierda: Cliente e Info */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedApp.customer_name}</h3>
                    <p className="text-slate-500 font-medium flex items-center gap-2 mt-1 text-sm">
                      <Mail className="w-3.5 h-3.5" /> {selectedApp.customer_email}
                    </p>
                    {selectedApp.customer_phone && (
                      <p className="text-slate-500 font-medium flex items-center gap-2 text-sm mt-0.5">
                        <Phone className="w-3.5 h-3.5" /> {selectedApp.customer_phone}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Tag className="w-3 h-3" /> Servicio</p>
                      <p className="font-bold text-slate-900 text-sm">{selectedApp.service?.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><CalendarIcon className="w-3 h-3" /> Fecha</p>
                      <p className="font-bold text-slate-900 text-sm capitalize">{format(parseISO(selectedApp.start_time), "d 'de' MMMM", { locale: es })}</p>
                    </div>
                    <div className="space-y-1 mt-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3" /> Horario</p>
                      <p className="font-bold text-slate-900 text-sm">{format(parseISO(selectedApp.start_time), 'HH:mm')} - {format(parseISO(selectedApp.end_time), 'HH:mm')}</p>
                    </div>
                    <div className="space-y-1 mt-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Estado</p>
                      <div>{getStatusBadge(selectedApp.status)}</div>
                    </div>
                    {selectedApp.flow_commerce_order && (
                      <div className="space-y-1 mt-2 col-span-2 pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><CreditCard className="w-3 h-3" /> Orden Flow</p>
                        <p className="font-bold text-slate-900 font-mono text-[11px]">{selectedApp.flow_commerce_order}</p>
                      </div>
                    )}
                  </div>

                  {selectedApp.notes && (
                    <div className="bg-slate-50 p-4 rounded-xl space-y-1 border border-slate-100/60">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas Internas</p>
                      <p className="text-xs text-slate-600 leading-relaxed italic">"{selectedApp.notes}"</p>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Ticket Técnico */}
                <div className="space-y-4">
                  {existingTicket ? (
                    <div className="bg-slate-50/80 border border-slate-100 rounded-[24px] p-5 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Orden Técnica</p>
                          <Badge className="bg-slate-900 text-white border-none font-bold uppercase text-[10px] tracking-widest px-2.5 py-1 rounded-lg">
                            {existingTicket.status === 'evaluating' ? 'Pendiente' : 
                             existingTicket.status === 'quoted' ? 'Presupuesto' :
                             (existingTicket.status === 'accepted' || existingTicket.status === 'repairing') ? 'En Reparación' :
                             existingTicket.status === 'ready' ? 'Listo' : 
                             existingTicket.status === 'rejected' ? 'Rechazado' : 'Retirado'}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Presupuesto</p>
                          <p className="text-lg font-black text-slate-900">{formatPrice(existingTicket.total_budget || 0)}</p>
                        </div>
                      </div>

                      {existingTicket.status === 'quoted' && (
                        <div className="flex gap-2.5 pt-1">
                          <Button
                            variant="outline"
                            className="flex-1 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 h-10 font-bold uppercase tracking-widest text-[10px] transition-all rounded-xl"
                            onClick={() => updateTicketMutation.mutate({ id: existingTicket.id, status: 'rejected' })}
                          >
                            <XCircle className="w-4 h-4 mr-1.5" /> Rechazar
                          </Button>
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-10 font-bold uppercase tracking-widest text-[10px] transition-all rounded-xl shadow-lg shadow-emerald-600/10"
                            onClick={() => updateTicketMutation.mutate({ id: existingTicket.id, status: 'accepted' })}
                          >
                            <CheckCircle className="w-4 h-4 mr-1.5" /> Aceptar
                          </Button>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        className="w-full justify-center text-slate-500 hover:text-slate-800 bg-white border-slate-200 h-10 font-bold uppercase tracking-widest text-[10px] transition-all rounded-xl shadow-sm"
                        onClick={() => navigate(`/admin/tickets/${existingTicket.id}`)}
                      >
                        Gestionar Detalles <ChevronRightIcon className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-200 rounded-[24px] p-6 text-center text-xs text-slate-400 font-medium flex flex-col justify-center items-center gap-2 h-full min-h-[160px]">
                      <AlertCircle className="w-5 h-5 opacity-40 text-slate-400" />
                      <span>Sin ticket técnico asociado</span>
                    </div>
                  )}
                </div>

              </div>

              <div className="flex items-center pt-6 border-t border-slate-100 gap-3 w-full">
                {/* Eliminar Cita */}
                <Button
                  variant="outline"
                  size="icon"
                  className="w-12 h-12 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 font-bold rounded-xl transition-all flex items-center justify-center shadow-sm"
                  onClick={() => { handleDelete(selectedApp.id); setSelectedApp(null); }}
                  title="Eliminar Cita"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                {/* Iniciar Ticket Técnico */}
                {!existingTicket && selectedApp.status !== 'pending' && (
                  <Button
                    variant="outline"
                    className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 h-12 font-bold uppercase tracking-widest text-[10px] rounded-xl px-4 transition-all shadow-sm flex items-center justify-center gap-2"
                    disabled={createTicketMutation.isPending}
                    onClick={async () => {
                      const t = await createTicketMutation.mutateAsync(selectedApp.id);
                      navigate(`/admin/tickets/${t.id}`);
                    }}
                  >
                    <Plus className="w-4 h-4 text-blue-500" />
                    Iniciar Ticket
                  </Button>
                )}

                {/* Confirmar / Finalizar Cita */}
                {selectedApp.status === 'pending' && (
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 h-12 font-bold uppercase tracking-widest text-[10px] rounded-xl px-5 transition-all shadow-sm flex items-center justify-center gap-2 ml-auto"
                    onClick={() => { handleStatusUpdate(selectedApp.id, 'confirmed'); setSelectedApp(null); }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Cita
                  </Button>
                )}
                
                {selectedApp.status === 'confirmed' && (
                  <Button
                    variant="outline"
                    className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 h-12 font-bold uppercase tracking-widest text-[10px] rounded-xl px-5 transition-all shadow-sm flex items-center justify-center gap-2 ml-auto"
                    onClick={() => { handleStatusUpdate(selectedApp.id, 'completed'); setSelectedApp(null); }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Finalizar Cita
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <label className={`text-sm font-medium leading-none ${className}`}>{children}</label>;
}
