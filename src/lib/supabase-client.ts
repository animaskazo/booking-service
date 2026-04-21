// ============================================================================
// SUPABASE CLIENT & REACT QUERY CONFIG
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { ServiceWithAvailability, AppointmentRecord, AvailabilityRecord, prepareAppointmentData } from './utils-booking';

// ============================================================================
// INICIALIZAR CLIENTE SUPABASE
// ============================================================================

// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// AUTH HOOKS
// ============================================================================

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
};

// ============================================================================
// TIPOS PARA SUPABASE
// ============================================================================

export type Database = {
  public: {
    Tables: {
      services: {
        Row: ServiceWithAvailability;
        Insert: Omit<ServiceWithAvailability, 'id'>;
        Update: Partial<ServiceWithAvailability>;
      };
      availability: {
        Row: AvailabilityRecord;
        Insert: Omit<AvailabilityRecord, 'id'>;
      };
      appointments: {
        Row: AppointmentRecord;
        Insert: Omit<AppointmentRecord, 'id'>;
      };
    };
  };
};

// ============================================================================
// REACT QUERY SETUP
// ============================================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 10,  // 10 minutos (antes: cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ============================================================================
// HOOKS - QUERIES
// ============================================================================

/**
 * Obtiene todos los servicios disponibles
 */
export const useServices = (userId?: string) => {
  return useQuery({
    queryKey: ['services', userId],
    queryFn: async () => {
      let query = supabase
        .from('services')
        .select('*')
        .order('name');

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        // En vista pública sin ID, tal vez no devolver nada o requerir un ID
        // Por ahora, si no hay ID devolvemos todo (comportamiento anterior)
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ServiceWithAvailability[];
    },
  });
};

/**
 * Obtiene la disponibilidad de un servicio específico
 */
export const useAvailability = (serviceId: string | null, userId?: string) => {
  return useQuery({
    queryKey: ['availability', serviceId, userId],
    queryFn: async () => {
      let query = supabase.from('availability').select('*');
      
      if (serviceId) {
        // Traer solo los del servicio especifico (asumiendo que RLS maneja el aislamiento)
        // O si queremos traer globales del usuario + servicio:
        query = query.or(`service_id.eq.${serviceId},is_global.eq.true`);
      } else {
        // Solo globales
        query = query.eq('is_global', true);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('day_of_week', { ascending: true });

      if (error) throw error;
      return data as AvailabilityRecord[];
    },
  });
};

/**
 * Obtiene las citas de un servicio para un rango de fechas
 */
export const useAppointmentsByDateRange = (
  startDate: Date | null,
  endDate: Date | null,
  userId?: string
) => {
  return useQuery({
    queryKey: ['appointments', 'global_range', startDate?.toISOString(), endDate?.toISOString(), userId],
    queryFn: async () => {
      if (!startDate || !endDate) return [];

      let query = supabase
        .from('appointments')
        .select('*, service:services(*)')
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AppointmentRecord[];
    },
    enabled: !!startDate && !!endDate,
  });
};

/**
 * Obtiene citas por email del cliente (para ver sus reservas)
 */
export const useMyAppointments = (email: string | null) => {
  return useQuery({
    queryKey: ['my-appointments', email],
    queryFn: async () => {
      if (!email) return [];

      const { data, error } = await supabase
        .from('appointments')
        .select('*, services:service_id(name, duration_min)')
        .eq('customer_email', email)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!email,
  });
};

// ============================================================================
// HOOKS - MUTATIONS
// ============================================================================

/**
 * Hook para crear una nueva cita
 */
export const useCreateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appointmentData, userId }: { appointmentData: any, userId?: string }) => {
      const finalData = userId ? { ...appointmentData, user_id: userId } : appointmentData;
      const { data, error } = await supabase
        .from('appointments')
        .insert([finalData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidar caches relacionados
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });

      // Opcionalmente guardar en localStorage para mostrar confirmación
      sessionStorage.setItem(
        'last_appointment',
        JSON.stringify({
          id: data.id,
          email: data.customer_email,
          createdAt: new Date().toISOString(),
        })
      );
    },
    onError: (error: any) => {
      console.error('Error creating appointment:', error);
      throw new Error(error.message || 'Error al crear la cita');
    },
  });
};

/**
 * Hook para cancelar una cita
 */
export const useCancelAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
    },
  });
};

// ============================================================================
// HOOKS - ADMIN MUTATIONS (SERVICES & AVAILABILITY)
// ============================================================================

/**
 * Obtiene la configuración global del negocio
 */
export const useBusinessSettings = (userId?: string) => {
  return useQuery({
    queryKey: ['business_settings', userId],
    queryFn: async () => {
      if (!userId) {
        // Si no hay userID (vista pública), esto necesita una forma de saber a quién consultar
        // Por ahora mantenemos el default
        return { 
          id: 'default', 
          slot_interval: 30,
          lunch_start: '13:00',
          lunch_end: '14:00',
          has_lunch_break: true
        };
      }

      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || { 
        id: userId, 
        slot_interval: 30,
        lunch_start: '13:00',
        lunch_end: '14:00',
        has_lunch_break: true
      };
    },
    enabled: !!userId
  });
};

/**
 * Actualiza la configuración global del negocio
 */
export const useUpdateBusinessSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: { 
      slot_interval?: number, 
      lunch_start?: string, 
      lunch_end?: string, 
      has_lunch_break?: boolean 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa");
      
      const { data, error } = await supabase
        .from('business_settings')
        .upsert({ id: user.id, ...settings, updated_at: new Date().toISOString() })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_settings'] });
    },
  });
};

/**
 * Hook para crear un nuevo servicio
 */
export const useCreateService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (service: Omit<ServiceWithAvailability, 'id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('services').insert([{ ...service, user_id: user?.id }]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

/**
 * Hook para actualizar un servicio existente
 */
export const useUpdateService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...service }: Partial<ServiceWithAvailability> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('services').update(service).eq('id', id).eq('user_id', user?.id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

/**
 * Hook para eliminar un servicio
 */
export const useDeleteService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('services').delete().eq('id', id).eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

/**
 * Hook para crear registros de disponibilidad
 */
export const useCreateAvailability = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (availabilities: Omit<AvailabilityRecord, 'id'>[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      const finalAvails = availabilities.map(a => ({ ...a, user_id: user?.id }));
      const { data, error } = await supabase.from('availability').insert(finalAvails).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['availability', variables[0].service_id] });
      }
    },
  });
};

/**
 * Hook para eliminar un registro de disponibilidad
 */
export const useDeleteAvailability = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, serviceId }: { id: string; serviceId: string | null }) => {
      const { error } = await supabase.from('availability').delete().eq('id', id);
      console.log('Deleting availability for', serviceId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['availability', variables.serviceId] });
    },
  });
};

// ============================================================================
// FUNCIONES UTILITARIAS PARA QUERIES
// ============================================================================

/**
 * Obtiene un servicio por ID
 */
export const getServiceById = async (serviceId: string): Promise<ServiceWithAvailability> => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single();

  if (error) throw error;
  return data as ServiceWithAvailability;
};

/**
 * Comprueba si un slot está disponible antes de reservar
 * (Validación de último minuto antes de guardar)
 */
export const checkSlotAvailability = async (
  serviceId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('id')
    .eq('service_id', serviceId)
    .neq('status', 'cancelled')
    .lt('start_time', endTime.toISOString())
    .gt('end_time', startTime.toISOString())
    .limit(1);

  if (error) throw error;
  return data.length === 0; // True si está disponible (sin conflictos)
};

/**
 * Obtiene todas las citas para la vista de administración
 */
export const useAppointmentsAdmin = () => {
  return useQuery({
    queryKey: ['appointments', 'admin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          service:service_id (
            name,
            color,
            category
          )
        `)
        .eq('user_id', user?.id)
        .order('start_time', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });
};

/**
 * Actualiza el estado de una cita
 */
export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentRecord['status'] }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};

/**
 * Elimina (cancela) una cita
 */
export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
};

/**
 * Obtiene el perfil del negocio por ID de usuario o por nombre de usuario (slug)
 */
export const useProfile = (identifier?: string) => {
  return useQuery({
    queryKey: ['profile', identifier],
    queryFn: async () => {
      if (!identifier) return null;
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      let query = supabase.from('profiles').select('*');
      
      if (isUUID) {
        query = query.eq('id', identifier);
      } else {
        query = query.eq('slug', identifier);
      }

      const { data, error } = await query.single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!identifier
  });
};

/**
 * Obtiene todos los perfiles públicos para el Marketplace
 */
export const useAllProfiles = () => {
  return useQuery({
    queryKey: ['profiles-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .not('full_name', 'is', null)
        .not('slug', 'is', null)
        .order('full_name');
        
      if (error) throw error;
      return data;
    }
  });
};
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa");
      
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...profile, updated_at: new Date().toISOString() })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};
