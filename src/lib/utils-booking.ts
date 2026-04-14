// ============================================================================
// BOOKING SYSTEM - UTILIDADES TYPESCRIPT
// ============================================================================
// Funciones auxiliares para cálculo de disponibilidad, validación de slots
// y manejo de zonas horarias.

import { format, addMinutes, isBefore, isAfter, startOfDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ============================================================================
// TIPOS
// ============================================================================

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface ServiceWithAvailability {
  id: string;
  name: string;
  description: string;
  duration_min: number;
  price: number;
  color: string;
  category: string;
}

export interface AppointmentRecord {
  id: string;
  service_id: string;
  start_time: string; // ISO 8601
  end_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  short_id: string; // ID corto para el cliente
  service?: ServiceWithAvailability;
  notes?: string;
}

export interface AvailabilityRecord {
  id: string;
  service_id: string | null; // Null si es global
  day_of_week: number; // 0-6
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  is_global: boolean;
}

// ============================================================================
// UTILIDADES DE FECHA
// ============================================================================

/**
 * Obtiene el día de la semana (0=Domingo, 6=Sábado)
 * Compatible con el schema de Supabase
 */
export const getDayOfWeek = (date: Date): number => {
  return date.getDay();
};

/**
 * Convierte un string HH:MM a minutos desde medianoche
 */
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convierte minutos desde medianoche a string HH:MM
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Crea un objeto Date a partir de una fecha y hora (HH:MM)
 */
export const createDateTimeFromTime = (date: Date, timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

/**
 * Formatea una fecha para mostrar al usuario (ej: "Lunes, 15 de Abril")
 */
export const formatDateForDisplay = (date: Date, locale = es): string => {
  return format(date, "EEEE, d 'de' MMMM", { locale });
};

/**
 * Formatea un horario para mostrar (ej: "09:30 - 10:00")
 */
export const formatTimeRange = (start: Date, end: Date): string => {
  return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
};

// ============================================================================
// LÓGICA DE DISPONIBILIDAD - FUNCIÓN PRINCIPAL
// ============================================================================

/**
 * Calcula los slots disponibles para un servicio en un día específico.
 * Combina la disponibilidad teórica con las citas existentes.
 *
 * @param date - Fecha para la cual calcular slots
 * @param service - Servicio seleccionado (contiene duración)
 * @param availabilities - Registros de disponibilidad del servicio
 * @param appointments - Citas confirmadas/pendientes del servicio
 * @param slotInterval - Intervalo de inicio (grid)
 * @returns Array de TimeSlots disponibles
 */
export const calculateAvailableSlots = (
  date: Date,
  service: ServiceWithAvailability,
  availabilities: AvailabilityRecord[],
  appointments: AppointmentRecord[],
  lunchBreak?: { start: string, end: string, enabled: boolean }
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const dayOfWeek = getDayOfWeek(date);
  const durationMinutes = service.duration_min;

  // Filtrar disponibilidades: prioritizar globales, si no hay, usar las del servicio
  let todayAvailabilities = availabilities.filter(
    (avail) => avail.is_global && avail.day_of_week === dayOfWeek
  );

  if (todayAvailabilities.length === 0) {
    todayAvailabilities = availabilities.filter(
      (avail) => avail.service_id === service.id && avail.day_of_week === dayOfWeek
    );
  }

  if (todayAvailabilities.length === 0) {
    return []; // No hay disponibilidad para este día
  }

  const lunchStartMin = lunchBreak?.enabled ? timeToMinutes(lunchBreak.start) : -1;
  const lunchEndMin = lunchBreak?.enabled ? timeToMinutes(lunchBreak.end) : -1;

  // Procesar cada bloque de disponibilidad
  for (const availability of todayAvailabilities) {
    const startMinutes = timeToMinutes(availability.start_time);
    const endMinutes = timeToMinutes(availability.end_time);

    // Generar slots consecutivos (una tras otra)
    for (let slotMinutes = startMinutes; slotMinutes + durationMinutes <= endMinutes; slotMinutes += durationMinutes) {
      const slotStart = createDateTimeFromTime(date, minutesToTime(slotMinutes));
      const slotEnd = addMinutes(slotStart, durationMinutes);

      // Verificar colisión con horario de colación
      const currentSlotStartMin = slotMinutes;
      const currentSlotEndMin = slotMinutes + durationMinutes;
      
      const overlapsLunch = lunchBreak?.enabled && (
        (currentSlotStartMin < lunchEndMin && currentSlotEndMin > lunchStartMin)
      );

      if (overlapsLunch) continue;

      // Verificar si el slot está ocupado por CUALQUIER cita existente
      const isOccupied = isSlotOccupied(slotStart, slotEnd, appointments);

      slots.push({
        start: slotStart,
        end: slotEnd,
        available: !isOccupied,
      });
    }
  }

  // Ordenar slots por tiempo y filtrar solo los disponibles
  return slots
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .filter((slot) => slot.available && isAfter(slot.start, new Date()));
};

/**
 * Verifica si un slot colisiona con una cita existente
 */
export const isSlotOccupied = (
  slotStart: Date,
  slotEnd: Date,
  appointments: AppointmentRecord[]
): boolean => {
  return appointments.some((appointment) => {
    if (appointment.status === 'cancelled') return false;

    const appointmentStart = parseISO(appointment.start_time);
    const appointmentEnd = parseISO(appointment.end_time);

    // Detectar solapamiento: [a1, a2) ∩ [b1, b2) ≠ ∅
    return isBefore(slotStart, appointmentEnd) && isBefore(appointmentStart, slotEnd);
  });
};

/**
 * Obtiene los próximos 30 días disponibles para reserva
 */
export const getAvailableDates = (
  availabilities: AvailabilityRecord[],
  days = 30
): Date[] => {
  const availableDates: Date[] = [];
  const today = startOfDay(new Date());
  const daysOfWeek = new Set(availabilities.map((a) => a.day_of_week));

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    if (daysOfWeek.has(getDayOfWeek(date))) {
      availableDates.push(date);
    }
  }

  return availableDates;
};

/**
 * Valida que una cita sea válida antes de guardarla
 */
export const validateAppointment = (
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  slotStart: Date,
  slotEnd: Date
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!customerName || customerName.trim().length < 2) {
    errors.push('El nombre debe tener al menos 2 caracteres.');
  }

  if (!customerEmail || !isValidEmail(customerEmail)) {
    errors.push('El email no es válido.');
  }

  if (!customerPhone || customerPhone.trim().length < 8) {
    errors.push('El teléfono es obligatorio y debe tener al menos 8 dígitos.');
  }

  if (!isBefore(new Date(), slotStart)) {
    errors.push('No puedes reservar un horario en el pasado.');
  }

  if (!isBefore(slotStart, slotEnd)) {
    errors.push('El horario de inicio debe ser antes del horario de fin.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Valida formato de email simple
 */
export const isValidEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Formatea un monto de dinero para mostrar
 */
export const formatPrice = (price: number, currency = 'CLP'): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(price);
};

/**
 * Obtiene el nombre del día de la semana en español
 */
export const getDayNameInSpanish = (date: Date): string => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[getDayOfWeek(date)];
};

/**
 * Genera un código corto único para identificar tickets/servicios
 */
export const generateShortId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Evitamos caracteres ambiguos
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// ============================================================================
// UTILIDADES PARA SUPABASE
// ============================================================================

/**
 * Prepara los datos para insertar una cita en Supabase
 */
export const prepareAppointmentData = (
  serviceId: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string | undefined,
  slotStart: Date,
  slotEnd: Date,
  notes?: string
) => {
  return {
    service_id: serviceId,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone || null,
    start_time: slotStart.toISOString(),
    end_time: slotEnd.toISOString(),
    status: 'pending' as 'pending' | 'confirmed' | 'cancelled' | 'completed',
    notes: notes || null,
    short_id: generateShortId(),
  };
};

/**
 * Calcula información resumida para mostrar en la confirmación
 */
export const getSummaryInfo = (
  service: ServiceWithAvailability,
  slotStart: Date,
  slotEnd: Date
) => {
  return {
    serviceName: service.name,
    serviceColor: service.color,
    date: formatDateForDisplay(slotStart),
    time: formatTimeRange(slotStart, slotEnd),
    duration: `${service.duration_min} minutos`,
    price: formatPrice(service.price),
  };
};
