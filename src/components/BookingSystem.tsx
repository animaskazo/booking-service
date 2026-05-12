// ============================================================================
// BOOKING SYSTEM - COMPONENTE PRINCIPAL
// ============================================================================
// React component con Shadcn/ui, Calendar, formulario y lógica de slots.
// Totalmente responsivo y optimizado para mobile.

import React, { useState, useMemo } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Clock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

import {
  calculateAvailableSlots,
  formatDateForDisplay,
  formatPrice,
  validateAppointment,
  getSummaryInfo,
  getAvailableDates,
  prepareAppointmentData,
  ServiceWithAvailability,
  formatRut,
} from '../lib/utils-booking';
import {
  useServices,
  useAvailability,
  useAppointmentsByDateRange,
  checkSlotAvailability,
  useBusinessSettings,
  createFlowPayment,
  useCreateAppointment,
} from '../lib/supabase-client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

// ============================================================================
// TIPOS LOCALES
// ============================================================================

type BookingStep = 'service' | 'date' | 'details' | 'confirmation';

interface BookingState {
  selectedService: ServiceWithAvailability | null;
  selectedDate: Date | null;
  selectedSlot: { start: Date; end: Date } | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerRut: string;
  notes: string;
  errors: string[];
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const BookingSystemMVP: React.FC = () => {
  // Estado del formulario
  const [state, setState] = useState<BookingState>({
    selectedService: null,
    selectedDate: null,
    selectedSlot: null,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerRut: '',
    notes: '',
    errors: [],
  });

  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [shortId, setShortId] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  // Mutations
  const createAppointmentMutation = useCreateAppointment();

  // Queries
  const { data: services = [], isLoading: servicesLoading } = useServices();

  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, ServiceWithAvailability[]> = {};
    services.forEach((service) => {
      const cat = service.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(service);
    });
    return grouped;
  }, [services]);
  const { data: availabilities = [] } = useAvailability(state.selectedService?.id || null);

  // Rango de fechas para buscar citas (próximos 30 días), memorizado para evitar bucle infinito
  const { dateRangeStart, dateRangeEnd } = useMemo(() => {
    const start = startOfDay(new Date());
    const end = addDays(start, 30);
    return { dateRangeStart: start, dateRangeEnd: end };
  }, []);

  const { data: appointments = [] } = useAppointmentsByDateRange(
    dateRangeStart,
    dateRangeEnd
  );

  // Configuración global
  const { data: bSettings = { slot_interval: 30 } } = useBusinessSettings();

  // Calcular fechas disponibles (basado en disponibilidades del servicio)
  const availableDates = useMemo(
    () => getAvailableDates(availabilities),
    [availabilities]
  );

  // Calcular slots disponibles para la fecha seleccionada
  const availableSlots = useMemo(() => {
    if (!state.selectedService || !state.selectedDate) return [];

    return calculateAvailableSlots(
      state.selectedDate,
      state.selectedService,
      availabilities,
      appointments,
      {
        start: bSettings.lunch_start,
        end: bSettings.lunch_end,
        enabled: bSettings.has_lunch_break
      }
    );
  }, [state.selectedService, state.selectedDate, availabilities, appointments, bSettings]);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleSelectService = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      setState((prev) => ({
        ...prev,
        selectedService: service,
        selectedDate: null,
        selectedSlot: null,
      }));
    }
  };

  const handleSelectDate = (date: Date) => {
    setState((prev) => ({
      ...prev,
      selectedDate: date,
      selectedSlot: null,
    }));
  };

  const handleSelectSlot = (slotStart: Date, slotEnd: Date) => {
    setState((prev) => ({
      ...prev,
      selectedSlot: { start: slotStart, end: slotEnd },
    }));
  };

  const handleGoToStep = (step: BookingStep) => {
    setCurrentStep(step);
  };

  const handleInputChange = (field: keyof Omit<BookingState, 'selectedService' | 'selectedDate' | 'selectedSlot' | 'errors'>) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    let value = e.target.value;

    // Formateo especial para RUT
    if (field === 'customerRut') {
      value = formatRut(value);
    }

    setState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConfirmBooking = async () => {
    if (!state.selectedService || !state.selectedSlot) {
      setState((prev) => ({
        ...prev,
        errors: ['Datos incompletos. Por favor intenta nuevamente.'],
      }));
      return;
    }

    // Validar datos del cliente
    const validation = validateAppointment(
      state.customerName,
      state.customerEmail,
      state.customerPhone,
      state.customerRut,
      state.selectedSlot.start,
      state.selectedSlot.end
    );

    if (!validation.valid) {
      setState((prev) => ({
        ...prev,
        errors: validation.errors,
      }));
      return;
    }

    setIsPaying(true);
    setState((prev) => ({ ...prev, errors: [] }));

    try {
      // Verificar disponibilidad de último minuto
      const isAvailable = await checkSlotAvailability(
        state.selectedService.id,
        state.selectedSlot.start,
        state.selectedSlot.end
      );

      if (!isAvailable) {
        setState((prev) => ({
          ...prev,
          errors: ['El horario fue reservado por otro cliente. Por favor selecciona otro.'],
        }));
        setCurrentStep('date');
        setIsPaying(false);
        return;
      }

      // Iniciar pago en Flow o agendar directamente si es gratis
      if (state.selectedService.price > 0) {
        const { url } = await createFlowPayment({
          serviceId: state.selectedService.id,
          serviceName: state.selectedService.name,
          amount: state.selectedService.price,
          customerEmail: state.customerEmail,
          customerName: state.customerName,
          slotStart: state.selectedSlot.start.toISOString(),
          slotEnd: state.selectedSlot.end.toISOString(),
          notes: state.notes || undefined,
          phone: state.customerPhone || undefined,
          rut: state.customerRut || undefined,
        });

        // Redirigir a Flow — el usuario sale del sitio
        window.location.href = url;
      } else {
        // Agendamiento GRATIS directo
        const appointmentData = prepareAppointmentData(
          state.selectedService.id,
          state.customerName,
          state.customerEmail,
          state.customerPhone,
          state.customerRut,
          state.selectedSlot.start,
          state.selectedSlot.end,
          state.notes,
          state.selectedService.user_id
        );

        const result = await createAppointmentMutation.mutateAsync({
          ...appointmentData,
          status: 'confirmed', // Marcar como confirmada de inmediato
          paid: true,
          paid_amount: 0
        } as any);

        if (result) {
          setShortId(result.short_id);
          setBookingConfirmed(true);
        }
        setIsPaying(false);
      }
    } catch (error: any) {
      setIsPaying(false);
      setState((prev) => ({
        ...prev,
        errors: [error.message || 'Error al procesar la reserva. Intenta nuevamente.'],
      }));
    }
  };

  const handleReset = () => {
    setState({
      selectedService: null,
      selectedDate: null,
      selectedSlot: null,
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerRut: '',
      notes: '',
      errors: [],
    });
    setCurrentStep('service');
    setBookingConfirmed(false);
    setShortId(null);
  };

  // ========================================================================
  // RENDERIZADO POR PASO
  // ========================================================================

  const renderStepIndicator = () => (
    <div className="flex gap-1.5 items-center justify-end flex-wrap">
      {(['service', 'date', 'details', 'confirmation'] as const).map((step, idx) => (
        <React.Fragment key={step}>
          <button
            onClick={() => {
              if (step === 'service' || state.selectedService) {
                handleGoToStep(step);
              }
            }}
            disabled={bookingConfirmed}
            className={`
              w-6 h-6 rounded-full font-black transition-all text-[10px] flex items-center justify-center
              ${currentStep === step
                ? 'bg-slate-900 text-white shadow-md'
                : (bookingConfirmed || (['service', 'date', 'details'].includes(step) && state.selectedService))
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer border border-slate-200'
                  : 'bg-slate-200/50 text-slate-400 border border-slate-100 cursor-not-allowed'
              }
            `}
          >
            {idx + 1}
          </button>
          {idx < 3 && <div className="w-2.5 h-[2px] bg-slate-200 rounded-full" />}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStepService = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Selecciona un servicio</h2>
        <p className="text-gray-600">Elige el servicio que deseas reservar</p>
      </div>

      {servicesLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
        </div>
      ) : services.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No hay servicios disponibles en este momento.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-8">
          {Object.entries(servicesByCategory).map(([category, catServices]) => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="h-4 w-1 bg-slate-900 rounded-full" />
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{category}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {catServices.map((service) => (
                  <Card
                    key={service.id}
                    onClick={() => handleSelectService(service.id)}
                    className={`
                      relative cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden flex flex-col h-full group
                      ${state.selectedService?.id === service.id ? 'border-slate-900 shadow-md bg-slate-50/50 ring-1 ring-slate-900' : 'border-slate-200 bg-white'}
                    `}
                  >
                    <CardHeader className="p-4 pb-2 flex-none">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-base leading-tight font-bold text-slate-900 line-clamp-2">{service.name}</CardTitle>
                        <div
                          className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 shadow-sm"
                          style={{ backgroundColor: service.color }}
                        />
                      </div>
                      {service.description && (
                        <CardDescription className="line-clamp-2 text-xs mt-1 text-slate-500 leading-relaxed">{service.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="p-4 pt-3 mt-auto bg-slate-50/50 border-t border-slate-100 flex-none">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-black text-slate-900 text-sm">
                            {formatPrice(service.price)}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                            <Clock className="w-3 h-3" />
                            {service.duration_min} min
                          </span>
                        </div>
                        {state.selectedService?.id === service.id ? (
                          <div className="bg-slate-900 rounded-full p-1.5 shadow-sm animate-in zoom-in duration-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-slate-300 transition-colors" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );

  const renderStepDateTime = () => (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Fecha y Horario</h2>
          <p className="text-slate-500 font-medium">Selecciona el momento ideal para tu cita</p>
        </div>
        {state.selectedDate && (
          <Badge variant="outline" className="w-fit bg-slate-50 text-slate-600 border-slate-200 px-4 py-1.5 rounded-full font-bold">
            {formatDateForDisplay(state.selectedDate)}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        {/* Lado Izquierdo: Calendario (Más ancho) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-100 p-4 shadow-xl shadow-slate-200/40 flex flex-col">
          <CalendarComponent
            mode="single"
            selected={state.selectedDate || undefined}
            onSelect={(date) => {
              if (date) handleSelectDate(date);
            }}
            disabled={(date) => {
              const today = startOfDay(new Date());
              const nextMonth = addDays(today, 30);
              return date < today || date > nextMonth || !availableDates.some(
                (d) => d.getTime() === startOfDay(date).getTime()
              );
            }}
            locale={es}
            className="w-full"
          />
        </div>

        {/* Lado Derecho: Slots (Más compacto y estilizado) */}
        <div className="lg:col-span-7 flex flex-col h-full bg-white rounded-3xl border border-slate-100 p-5 shadow-xl shadow-slate-200/40">
          {!state.selectedDate ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                <CalendarIcon className="w-8 h-8 opacity-20" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-600">Elige un día</p>
                <p className="text-xs text-slate-400">Verás los horarios disponibles para ese día.</p>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full space-y-6">
              <div className="flex items-center gap-3 flex-none">
                <div className="h-8 w-1 bg-slate-900 rounded-full" />
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">
                  Horarios Disponibles
                </h3>
              </div>

              {availableSlots.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-amber-50/50 rounded-2xl border border-amber-100 space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto opacity-50" />
                  <p className="text-sm font-bold text-amber-800">No hay turnos hoy</p>
                  <p className="text-xs text-amber-600">Intenta con otra fecha cercana.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Morning slots */}
                  {availableSlots.filter(s => s.start.getHours() < 13).length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Mañana
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableSlots.filter(s => s.start.getHours() < 13).map((slot, idx) => (
                          <button
                            key={`am-${idx}`}
                            onClick={() => handleSelectSlot(slot.start, slot.end)}
                            className={`
                              flex flex-col items-center justify-center py-2.5 px-2 rounded-xl font-bold transition-all border
                              ${state.selectedSlot?.start.getTime() === slot.start.getTime()
                                ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/20'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-900 hover:bg-slate-50'
                              }
                            `}
                          >
                            <span className="text-sm font-black leading-none">{format(slot.start, 'HH:mm')}</span>
                            <span className={`text-[9px] mt-0.5 font-medium leading-none ${state.selectedSlot?.start.getTime() === slot.start.getTime() ? 'text-slate-300' : 'text-slate-400'}`}>
                              → {format(slot.end, 'HH:mm')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Afternoon slots */}
                  {availableSlots.filter(s => s.start.getHours() >= 13).length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
                        Tarde
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableSlots.filter(s => s.start.getHours() >= 13).map((slot, idx) => (
                          <button
                            key={`pm-${idx}`}
                            onClick={() => handleSelectSlot(slot.start, slot.end)}
                            className={`
                              flex flex-col items-center justify-center py-2.5 px-2 rounded-xl font-bold transition-all border
                              ${state.selectedSlot?.start.getTime() === slot.start.getTime()
                                ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/20'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-900 hover:bg-slate-50'
                              }
                            `}
                          >
                            <span className="text-sm font-black leading-none">{format(slot.start, 'HH:mm')}</span>
                            <span className={`text-[9px] mt-0.5 font-medium leading-none ${state.selectedSlot?.start.getTime() === slot.start.getTime() ? 'text-slate-300' : 'text-slate-400'}`}>
                              → {format(slot.end, 'HH:mm')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );

  const renderStepDetails = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Tu información</h2>
        <p className="text-gray-600">Completa tus datos para confirmar la cita</p>
      </div>

      {/* Mini Resumen del Servicio */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center animate-in fade-in slide-in-from-right-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: state.selectedService?.color }} />
            <p className="font-bold text-slate-800">{state.selectedService?.name}</p>
          </div>
          <p className="text-sm text-slate-600">
            {state.selectedDate && formatDateForDisplay(state.selectedDate)} • {state.selectedSlot && format(state.selectedSlot.start, 'HH:mm')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">{formatPrice(state.selectedService?.price || 0)}</p>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Total a pagar</p>
          <p className={`text-[10px] font-bold mt-1 text-right ${state.selectedService?.name.toLowerCase().includes('express') ? 'text-amber-600' : 'text-emerald-600'}`}>
            {state.selectedService?.name.toLowerCase().includes('express')
              ? '⚠ Servicio Express: Este valor NO se abona a la reparación.'
              : '✓ Este valor se abonará a la reparación.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name" className="text-xs font-bold text-slate-700">Nombre completo *</Label>
            <Input
              id="name"
              placeholder="Juan Pérez"
              value={state.customerName}
              onChange={handleInputChange('customerName')}
              className="mt-1.5 h-10 border-slate-200"
            />
          </div>

          <div>
            <Label htmlFor="rut" className="text-xs font-bold text-slate-700">RUT *</Label>
            <Input
              id="rut"
              placeholder="12345678-k"
              value={state.customerRut}
              onChange={handleInputChange('customerRut')}
              className="mt-1.5 h-10 border-slate-200"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email" className="text-xs font-bold text-slate-700">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="juan@ejemplo.com"
              value={state.customerEmail}
              onChange={handleInputChange('customerEmail')}
              className="mt-1.5 h-10 border-slate-200"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-xs font-bold text-slate-700">Teléfono *</Label>
            <Input
              id="phone"
              placeholder="+56 9 1234 5678"
              value={state.customerPhone}
              onChange={handleInputChange('customerPhone')}
              className="mt-1.5 h-10 border-slate-200"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="notes" className="text-xs font-bold text-slate-700">Notas adicionales</Label>
          <textarea
            id="notes"
            placeholder="Cuéntanos alguna observación..."
            value={state.notes}
            onChange={handleInputChange('notes')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 mt-1.5 bg-white resize-none h-12"
          />
        </div>
      </div>

      {state.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {state.errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderStepConfirmation = () => {
    const summary = state.selectedService && state.selectedSlot
      ? getSummaryInfo(state.selectedService, state.selectedSlot.start, state.selectedSlot.end)
      : null;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-[500px] flex flex-col items-center justify-center py-4">
        <div className="max-w-md w-full flex-1 flex flex-col">
          <div className="flex-1">
            {/* Header Uber Style */}
            <div className="text-center space-y-3 pb-8 mb-8 border-b border-slate-100 flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase">¡Reserva Confirmada!</h2>
              <p className="text-slate-500 text-sm font-medium">Hemos reservado tu espacio, {state.customerName.split(' ')[0]}</p>
            </div>

            {summary && (
              <div className="space-y-8 px-2">
                {/* Main Info Section */}
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servicio solicitado</p>
                      <p className="text-xl font-bold text-slate-900 leading-tight">{summary.serviceName}</p>
                      <div className="flex flex-col gap-1.5 mt-1">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] px-2 py-0.5 w-fit">
                          {summary.duration}
                        </Badge>
                        <p className={`text-[9px] font-bold uppercase tracking-tight ${summary.serviceName.toLowerCase().includes('express') ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {summary.serviceName.toLowerCase().includes('express')
                            ? 'Tarifa express no reembolsable'
                            : 'Monto abonable a reparación'}
                        </p>
                      </div>
                    </div>
                    <div className="sm:text-right bg-slate-50 p-3 rounded-2xl border border-slate-100 min-w-[100px]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total</p>
                      <p className="text-xl font-black text-slate-900 tracking-tighter">{summary.price}</p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-y border-slate-100">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</p>
                        <p className="text-sm font-bold text-slate-900 capitalize">{summary.date}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horario</p>
                        <p className="text-sm font-bold text-slate-900">{summary.time}</p>
                      </div>
                    </div>
                  </div>

                  {/* ID Section */}
                  <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl shadow-lg shadow-slate-200">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">ID de Reserva</p>
                      <p className="text-lg font-black font-mono tracking-widest">{shortId}</p>
                    </div>
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>
                </div>

                {/* Email Confirmation */}
                <div className="text-center pt-4">
                  <p className="text-xs text-slate-400 font-medium">
                    Hemos enviado los detalles a <span className="text-slate-900 font-bold">{state.customerEmail}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ========================================================================
  // RENDERIZADO PRINCIPAL
  // ========================================================================

  // Render footer buttons based on current step
  const renderFooter = () => {
    if (bookingConfirmed) {
      return (
        <Button
          onClick={handleReset}
          className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95"
        >
          VOLVER AL INICIO
        </Button>
      );
    }
    if (currentStep === 'service') {
      return (
        <div className="flex justify-end">
          <Button
            onClick={() => setCurrentStep('date')}
            disabled={!state.selectedService}
            className="px-10 h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-30"
          >
            CONTINUAR
          </Button>
        </div>
      );
    }
    if (currentStep === 'date') {
      return (
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('service')}
            className="px-6 h-10 font-bold uppercase tracking-widest text-[10px] border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
          >
            ATRÁS
          </Button>
          <Button
            onClick={() => setCurrentStep('details')}
            disabled={!state.selectedSlot}
            className="px-10 h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-30"
          >
            CONTINUAR
          </Button>
        </div>
      );
    }
    if (currentStep === 'details') {
      return (
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('date')}
            className="px-6 h-10 font-bold uppercase tracking-widest text-[10px] border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
          >
            ATRÁS
          </Button>
          <Button
            onClick={handleConfirmBooking}
            disabled={!state.customerName || !state.customerEmail || !state.customerPhone || !state.customerRut || isPaying}
            className="px-10 h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-30"
          >
            {isPaying ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{state.selectedService?.price === 0 ? 'AGENDANDO...' : 'REDIRIGIENDO...'}</>
            ) : (
              state.selectedService?.price === 0 ? 'CONFIRMAR Y AGENDAR' : 'PAGAR PARA RESERVAR'
            )}
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Header with Logo and Step indicator */}
        {!bookingConfirmed && (
          <div className="flex justify-between items-center px-4 md:px-2">
            <img src="/powerfix-negro.png" alt="Powerfix Logo" className="h-5 sm:h-4 w-auto" />
            {renderStepIndicator()}
          </div>
        )}

        {/* Content area — Natural flow */}
        <div className="bg-white shadow-xl shadow-slate-200/50 rounded-[2.5rem] border border-slate-100 overflow-hidden">
          <div className="px-6 sm:px-12 pt-12 pb-8">
            {!bookingConfirmed && currentStep === 'service' && renderStepService()}
            {!bookingConfirmed && currentStep === 'date' && renderStepDateTime()}
            {!bookingConfirmed && currentStep === 'details' && renderStepDetails()}
            {bookingConfirmed && renderStepConfirmation()}
          </div>

          {/* Footer — Bottom of content */}
          <div className="px-6 sm:px-12 py-6 border-t border-slate-50 bg-white">
            {renderFooter()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingSystemMVP;
