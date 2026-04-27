// ============================================================================
// BOOKING SYSTEM - COMPONENTE PRINCIPAL
// ============================================================================
// React component con Shadcn/ui, Calendar, formulario y lógica de slots.
// Totalmente responsivo y optimizado para mobile.

import React, { useState, useMemo } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, CalendarIcon, Clock, Loader2, AlertCircle, CheckCircle2, Tag } from 'lucide-react';

import {
  calculateAvailableSlots,
  formatDateForDisplay,
  formatTimeRange,
  formatPrice,
  validateAppointment,
  getSummaryInfo,
  prepareAppointmentData,
  getAvailableDates,
  ServiceWithAvailability,
} from '../lib/utils-booking';
import {
  useServices,
  useAvailability,
  useAppointmentsByDateRange,
  useCreateAppointment,
  checkSlotAvailability,
  useBusinessSettings,
  sendBookingEmail,
} from '../lib/supabase-client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    notes: '',
    errors: [],
  });

  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [shortId, setShortId] = useState<string | null>(null);

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

  // Rango de fechas para buscar citas (próximos 30 días)
  const dateRangeStart = new Date();
  const dateRangeEnd = addDays(dateRangeStart, 30);

  const { data: appointments = [] } = useAppointmentsByDateRange(
    dateRangeStart,
    dateRangeEnd
  );

  // Mutation para crear cita
  const createAppointment = useCreateAppointment();

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
    setState((prev) => ({
      ...prev,
      [field]: e.target.value,
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

    try {
      // Validación de último minuto: verificar que el slot siga disponible
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
        return;
      }

      // Preparar datos y crear cita
      const appointmentData = prepareAppointmentData(
        state.selectedService.id,
        state.customerName,
        state.customerEmail,
        state.customerPhone || undefined,
        state.selectedSlot.start,
        state.selectedSlot.end,
        state.notes || undefined
      );

      const result = await createAppointment.mutateAsync(appointmentData);

      // 3. Disparar email de confirmación (sin esperar a que termine para no bloquear la UI)
      sendBookingEmail({
        customerName: state.customerName,
        customerEmail: state.customerEmail,
        serviceName: state.selectedService.name,
        date: formatDateForDisplay(state.selectedSlot.start),
        time: formatTimeRange(state.selectedSlot.start, state.selectedSlot.end),
        shortId: result.short_id,
        notes: state.notes || undefined,
        techSupportEmail: 'fernando.rg@live.cl'
      });

      // Éxito
      setShortId(result.short_id);
      setBookingConfirmed(true);
      setCurrentStep('confirmation');
      setState((prev) => ({ ...prev, errors: [] }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        errors: [error.message || 'Error al crear la cita. Intenta nuevamente.'],
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
    <div className="flex gap-2 justify-center flex-wrap">
      {(['service', 'date', 'details', 'confirmation'] as const).map((step, idx) => (
        <React.Fragment key={step}>
          <button
            onClick={() => {
              if (step === 'service' || state.selectedService) {
                handleGoToStep(step);
              }
            }}
            className={`
              w-10 h-10 rounded-full font-semibold transition-all text-sm
              ${currentStep === step
                ? 'bg-slate-900 text-white scale-110'
                : bookingConfirmed || (['service', 'date', 'details'].includes(step) && state.selectedService)
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer'
                  : 'bg-gray-200 text-gray-500'
              }
            `}
          >
            {idx + 1}
          </button>
          {idx < 3 && <div className="w-1 h-1 rounded-full bg-gray-300 self-center" />}
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

      <Button
        onClick={() => setCurrentStep('date')}
        disabled={!state.selectedService}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-30"
      >
        CONTINUAR
      </Button>
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
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 p-6 shadow-xl shadow-slate-200/40 flex flex-col">
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
        <div className="lg:col-span-5 flex flex-col h-full bg-white rounded-3xl border border-slate-100 p-6 shadow-xl shadow-slate-200/40">
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
                <ScrollArea className="flex-1 min-h-[300px] pr-4">
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    {availableSlots.map((slot, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSlot(slot.start, slot.end)}
                        className={`
                          h-14 rounded-2xl font-bold transition-all border-2
                          ${state.selectedSlot?.start.getTime() === slot.start.getTime()
                            ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20 scale-[0.98]'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-900 hover:bg-slate-50 hover:text-slate-900'
                          }
                        `}
                      >
                        {format(slot.start, 'HH:mm')}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Navigation Footer */}
      <div className="sticky bottom-0 -mx-6 -mb-8 mt-10 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 flex gap-4 z-30">
        <Button
          variant="outline"
          onClick={() => setCurrentStep('service')}
          className="flex-1 h-12 font-bold uppercase tracking-widest text-xs border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
        >
          ATRÁS
        </Button>
        <Button
          onClick={() => setCurrentStep('details')}
          disabled={!state.selectedSlot}
          className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-30"
        >
          CONTINUAR
        </Button>
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
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Nombre completo *</Label>
          <Input
            id="name"
            placeholder="Juan Pérez"
            value={state.customerName}
            onChange={handleInputChange('customerName')}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="juan@ejemplo.com"
            value={state.customerEmail}
            onChange={handleInputChange('customerEmail')}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="phone">Teléfono *</Label>
          <Input
            id="phone"
            placeholder="+56 9 1234 5678"
            value={state.customerPhone}
            onChange={handleInputChange('customerPhone')}
            className="mt-2"
            required
          />
        </div>

        <div>
          <Label htmlFor="notes">Notas adicionales</Label>
          <textarea
            id="notes"
            placeholder="Cuéntanos si tienes alguna solicitud especial..."
            value={state.notes}
            onChange={handleInputChange('notes')}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
            rows={3}
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

      {/* Sticky Navigation Footer */}
      <div className="sticky bottom-0 -mx-6 -mb-8 mt-10 p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 flex gap-4 z-30">
        <Button
          variant="outline"
          onClick={() => setCurrentStep('date')}
          className="flex-1 h-12 font-bold uppercase tracking-widest text-xs border-slate-200 hover:bg-slate-50 transition-all active:scale-95"
        >
          ATRÁS
        </Button>
        <Button
          onClick={handleConfirmBooking}
          disabled={!state.customerName || !state.customerEmail || !state.customerPhone || createAppointment.isPending}
          className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-30"
        >
          {createAppointment.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              PROCESANDO...
            </>
          ) : (
            'CONFIRMAR RESERVA'
          )}
        </Button>
      </div>
    </div>
  );

  const renderStepConfirmation = () => {
    const summary = state.selectedService && state.selectedSlot
      ? getSummaryInfo(state.selectedService, state.selectedSlot.start, state.selectedSlot.end)
      : null;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-[500px] flex flex-col">
        {/* Header Uber Style */}
        <div className="bg-slate-900 text-white p-10 -mx-8 -mt-8 mb-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-full">
            <CheckCircle2 className="w-6 h-6 text-slate-900" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">Reserva confirmada</h2>
            <p className="text-slate-400 text-sm font-medium">Gracias por elegirnos, {state.customerName.split(' ')[0]}</p>
          </div>
        </div>

        {summary && (
          <div className="flex-1 space-y-8 px-2">
            {/* Main Info Section */}
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b pb-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servicio</p>
                  <p className="text-2xl font-bold text-slate-900">{summary.serviceName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: summary.serviceColor }} />
                    <span className="text-xs font-medium text-slate-500">{summary.duration} de sesión</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tighter">{summary.price}</p>
                </div>
              </div>

              {/* Date & Time Section */}
              <div className="grid grid-cols-2 gap-8 border-b pb-6">
                <div className="space-y-1 border-r border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</p>
                  <p className="text-lg font-bold text-slate-900 capitalize">{summary.date}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horario</p>
                  <p className="text-lg font-bold text-slate-900">{summary.time}</p>
                </div>
              </div>

              {/* Reference Info */}
              <div className="flex items-center justify-between py-4 px-6 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border shadow-sm">
                    <Tag className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID de Reserva</p>
                    <p className="text-sm font-black text-slate-900 font-mono tracking-wider">{shortId}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => window.print()} className="text-slate-500 hover:text-slate-900 text-xs font-bold uppercase tracking-widest">
                  Imprimir
                </Button>
              </div>
            </div>

            {/* Bottom Message */}
            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50 flex items-start gap-4">
              <div className="mt-1"><AlertCircle className="w-5 h-5 text-blue-600" /></div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-blue-900">Tu cita está lista</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Te recomendamos llegar 5 minutos antes. Hemos enviado un comprobante a tu correo para que lo tengas a mano.
                </p>
              </div>
            </div>

            {/* Uber-like Button */}
            <div className="pt-4">
              <Button
                onClick={handleReset}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-xs transition-all active:scale-95"
              >
                VOLVER AL INICIO
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ========================================================================
  // RENDERIZADO PRINCIPAL
  // ========================================================================

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header & Step Indicator Unified */}
        {!bookingConfirmed && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-slate-200 shadow-lg">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Sistema de Reservas</h1>
                <p className="text-sm text-slate-500">Agenda tu cita en pocos pasos</p>
              </div>
            </div>

            <div className="flex items-center">
              {renderStepIndicator()}
            </div>
          </div>
        )}

        {/* Main Card */}
        <Card className="shadow-xl">
          <CardContent className="p-6 sm:p-8">
            {!bookingConfirmed && currentStep === 'service' && renderStepService()}
            {!bookingConfirmed && currentStep === 'date' && renderStepDateTime()}
            {!bookingConfirmed && currentStep === 'details' && renderStepDetails()}
            {bookingConfirmed && renderStepConfirmation()}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>¿Preguntas? Contáctanos en hola@digital-solutions.work</p>
        </div>
      </div>
    </div>
  );
};

export default BookingSystemMVP;
