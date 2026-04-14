// ============================================================================
// BOOKING SYSTEM - COMPONENTE PRINCIPAL
// ============================================================================
// React component con Shadcn/ui, Calendar, formulario y lógica de slots.
// Totalmente responsivo y optimizado para mobile.

import React, { useState, useMemo } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, CalendarIcon, Clock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
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

      // Éxito
      setConfirmationId(result.id);
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
    setConfirmationId(null);
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
              <div className="space-y-3">
                {catServices.map((service) => (
                  <Card
                    key={service.id}
                    onClick={() => handleSelectService(service.id)}
                    className={`
                      relative cursor-pointer transition-all hover:shadow-lg hover:scale-[1.01] overflow-hidden
                      ${state.selectedService?.id === service.id ? 'border-slate-900 shadow-md bg-slate-50/50 scale-[1.01]' : 'border-slate-100 bg-white'}
                    `}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-bold">{service.name}</CardTitle>
                        <div
                          className="w-3 h-3 rounded-full mt-1.5 shadow-sm"
                          style={{ backgroundColor: service.color }}
                        />
                      </div>
                      {service.description && (
                        <CardDescription className="line-clamp-2 text-slate-500">{service.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div className="flex gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-slate-400" />
                            {service.duration_min} min
                          </span>
                          <span className="font-bold text-slate-700">
                            {formatPrice(service.price)}
                          </span>
                        </div>
                        {state.selectedService?.id === service.id && (
                          <div className="bg-slate-900 rounded-full p-1">
                             <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
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
        className="w-full"
        size="lg"
      >
        Continuar
      </Button>
    </div>
  );

  const renderStepDateTime = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Fecha y Horario</h2>
        <p className="text-gray-600">
          {state.selectedDate 
            ? `Horarios disponibles para el ${formatDateForDisplay(state.selectedDate)}`
            : 'Selecciona una fecha para ver horarios'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Lado Izquierdo: Calendario */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
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
            className="flex justify-center"
          />
        </div>

        {/* Lado Derecho: Slots */}
        <div className="space-y-4">
          {!state.selectedDate ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed p-6 text-center">
              <CalendarIcon className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Selecciona un día para ver los turnos</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Turnos {format(state.selectedDate, 'dd/MM')}
                </h3>
              </div>

              {availableSlots.length === 0 ? (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    No hay horarios disponibles.
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[280px] pr-2">
                  <div className="grid grid-cols-2 gap-2">
                    {availableSlots.map((slot, idx) => (
                      <Button
                        key={idx}
                        variant={
                          state.selectedSlot?.start.getTime() === slot.start.getTime()
                            ? 'default'
                            : 'outline'
                        }
                        onClick={() => handleSelectSlot(slot.start, slot.end)}
                        className="h-11 text-sm font-semibold transition-all"
                      >
                        {format(slot.start, 'HH:mm')}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {state.selectedSlot && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200 animate-in fade-in slide-in-from-top-1">
                  <p className="text-green-900 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    Seleccionado: {formatTimeRange(state.selectedSlot.start, state.selectedSlot.end)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-6 border-t border-slate-100">
        <Button variant="outline" onClick={() => setCurrentStep('service')} className="flex-1 rounded-xl">
          Atrás
        </Button>
        <Button
          onClick={() => setCurrentStep('details')}
          disabled={!state.selectedSlot}
          className="flex-1"
        >
          Continuar
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

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setCurrentStep('date')} className="flex-1">
          Atrás
        </Button>
        <Button
          onClick={handleConfirmBooking}
          disabled={!state.customerName || !state.customerEmail || !state.customerPhone || createAppointment.isPending}
          className="flex-1"
        >
          {createAppointment.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : (
            'Confirmar reserva'
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
      <div className="space-y-6">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">¡Reserva confirmada!</h2>
          <p className="text-gray-600 mb-2">Tu cita ha sido agendada exitosamente.</p>
          <div className="bg-slate-100 w-fit mx-auto px-4 py-1.5 rounded-full border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2">Orden:</span>
            <span className="text-lg font-black text-slate-900 tracking-tighter">{shortId}</span>
          </div>
        </div>

        {summary && (
          <Card className="overflow-hidden border-2 border-blue-100 shadow-md">
            <div className="h-2 w-full" style={{ backgroundColor: summary.serviceColor }} />
            <CardHeader className="bg-slate-50/50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Detalles de la Cita</CardTitle>
                <Badge variant="secondary" className="bg-white border">Confirmada</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-between items-start pb-2 border-b border-dashed">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Servicio</p>
                  <p className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: summary.serviceColor }} />
                    {summary.serviceName}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Precio</p>
                  <p className="text-lg font-bold text-slate-900">{summary.price}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-dashed">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha</p>
                  <p className="font-semibold text-slate-700">{summary.date}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Horario</p>
                  <p className="font-semibold text-slate-700">{summary.time}</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Duración</p>
                  <p className="text-sm font-medium text-slate-600">{summary.duration}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cliente</p>
                  <p className="text-sm font-medium text-slate-700">{state.customerName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-slate-900" />
          <AlertDescription className="text-blue-900">
            Se ha enviado un email de confirmación a <strong>{state.customerEmail}</strong>
          </AlertDescription>
        </Alert>

        <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 space-y-2">
          <p>
            <strong>Ticket ID:</strong> {shortId}
          </p>
          <p>
            <strong>ID de sistema:</strong> {confirmationId?.slice(0, 8).toUpperCase()}
          </p>
          <p>Por favor llega 10 minutos antes de tu cita.</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Hacer otra reserva
          </Button>
          <Button onClick={() => window.print()} className="flex-1">
            Imprimir comprobante
          </Button>
        </div>
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
          <p>¿Preguntas? Contáctanos en support@booking.local</p>
        </div>
      </div>
    </div>
  );
};

export default BookingSystemMVP;
