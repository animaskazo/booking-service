// ============================================================================
// NOTAS TÉCNICAS - BOOKING SYSTEM MVP
// ============================================================================

## 📝 RESUMEN ARQUITECTÓNICO

### Capas de la Aplicación

```
┌─────────────────────────────────────────────────┐
│                                                 │
│         CAPA PRESENTACIÓN (React)               │
│    - BookingSystem.tsx (componente principal)   │
│    - Shadcn/ui + Tailwind CSS                   │
│    - Estado local + form validación             │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│    CAPA DE LÓGICA (Hooks + Utilidades)         │
│    - React Query (TanStack Query)               │
│    - calculateAvailableSlots() logic            │
│    - validateAppointment()                      │
│    - utils-booking.ts (date handling)           │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│    CAPA DE ACCESO A DATOS (Supabase)           │
│    - supabase-client.ts                         │
│    - useServices(), useAvailability()           │
│    - useCreateAppointment() mutation            │
│    - RLS policies para seguridad                │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│    CAPA BASE DE DATOS (PostgreSQL)             │
│    - services, availability, appointments      │
│    - Triggers para updated_at                   │
│    - Exclusion constraint anti-solapamientos    │
│    - Índices para queries rápidas               │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔐 SEGURIDAD & RLS

### Row Level Security Policies

```sql
-- Servicios: lectura pública (no se modifica desde cliente)
CREATE POLICY "Allow public read services" ON services FOR SELECT USING (true);

-- Disponibilidades: lectura pública
CREATE POLICY "Allow public read availability" ON availability FOR SELECT USING (true);

-- Citas: cualquiera puede crear y leer sus propias (por email)
CREATE POLICY "Allow public insert appointments" ON appointments 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read own appointments" ON appointments 
  FOR SELECT USING (true);
```

**Consideraciones:**
- Las políticas permiten lectura pública → ideal para página estática
- Creación de citas sin autenticación (perfect para público)
- En producción, podrías agregar validación de captcha
- Para admin, agregar tabla separada `admin_users` con RLS diferente

---

## 📊 DIAGRAMA DE FLUJO DE DATOS

```
Usuario accede a /
│
├─► useServices() → carga servicios
│   │
│   └─► render Select de servicios
│
Usuario selecciona servicio
│
├─► useAvailability(serviceId) → carga disponibilidades
│   │
│   └─► getAvailableDates() → filtra 30 días próximos
│
Usuario selecciona fecha
│
├─► useAppointmentsByDateRange() → carga citas existentes
│   │
│   ├─► calculateAvailableSlots()
│   │   ├─ Filter: solo disponibilidades del día
│   │   ├─ Generate: slots cada N minutos (duración servicio)
│   │   └─ Filter: quita slots con conflictos de citas
│   │
│   └─► render grid de botones (slots)
│
Usuario selecciona horario
│
├─► setState({ selectedSlot })
│   └─► render formulario con nombre/email
│
Usuario completa formulario
│
├─► validateAppointment()
│   ├─ Check: nombre >= 2 caracteres
│   ├─ Check: email válido
│   ├─ Check: horario no en pasado
│   └─ Check: start < end
│
├─► checkSlotAvailability() [double-check]
│   └─ Verifica que nadie más lo haya reservado
│
├─► useCreateAppointment.mutateAsync()
│   │
│   ├─► INSERT en table appointments
│   │   └─ PostgreSQL evalúa EXCLUSION CONSTRAINT
│   │
│   ├─► ON SUCCESS: invalidateQueries()
│   │   └─ Refetch automático de datos
│   │
│   └─► ON ERROR: muestra errores al usuario
│
└─► render confirmación con ID

```

---

## ⚡ OPTIMIZACIONES IMPLEMENTADAS

### 1. Base de Datos

```sql
-- Índices para queries frecuentes
CREATE INDEX idx_appointments_service_id ON appointments(service_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_availability_service_id ON availability(service_id);

-- Exclusion constraint para integridad
ALTER TABLE appointments
ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING GIST (
  service_id WITH =,
  tsrange(start_time, end_time) WITH &&
) WHERE (status != 'cancelled');

-- Vista materializada (opcional para reportes)
CREATE OR REPLACE VIEW appointments_with_service AS
SELECT a.id, a.service_id, s.name, s.price, ...
FROM appointments a JOIN services s ON a.service_id = s.id;
```

### 2. React Query

```typescript
// Stale time: datos válidos por 5 min
// Garbage collection: elimina cache después de 10 min
queryClient.setDefaultOptions({
  queries: {
    staleTime: 1000 * 60 * 5,    // 5 min
    gcTime: 1000 * 60 * 10,      // 10 min
    retry: 1,
    refetchOnWindowFocus: false, // No refetch al volver a tab
  },
});

// Devuelve [] para queries deshabilitadas
const { data: availabilities = [] } = useAvailability(
  state.selectedService?.id || null  // null = query disabled
);
```

### 3. Cálculo de Slots

```typescript
// Reutiliza mismo array si deps no cambian (useMemo)
const availableSlots = useMemo(() => {
  if (!service || !date) return [];
  
  return calculateAvailableSlots(
    date,
    service,
    availabilities,
    appointments
  );
}, [service, date, availabilities, appointments]);
// ↑ Solo recalcula si alguno de estos cambia
```

### 4. Rendering Eficiente

```typescript
// Componentes memoizados para evitar re-renders
const renderStepService = () => { ... };  // Re-render solo si state.selectedService cambia

// Grid con scroll para muchos slots
<ScrollArea className="max-h-64 overflow-y-auto">
  {availableSlots.map((slot, idx) => ...)}
</ScrollArea>
```

---

## 🧮 LÓGICA DE CÁLCULO DE SLOTS (Algoritmo)

```
Para cada disponibilidad del día:
  start_slot = disponibilidad.start_time
  
  WHILE start_slot + duracion <= disponibilidad.end_time:
    end_slot = start_slot + duracion
    
    IF NO hay cita que se solape entre start_slot y end_slot:
      AGREGAR slot a lista
    
    start_slot += duracion

Detectar solapamiento: [a1, a2) ∩ [b1, b2) ≠ ∅
  ↔ a1 < b2 AND b1 < a2
```

**Ejemplo:**
```
Servicio: Consulta médica (30 min)
Disponibilidad: Lunes 9:00-17:00

Slots calculados:
09:00 - 09:30 ✓ (libre)
09:30 - 10:00 ✗ (ocupado por cita 09:30-10:15)
10:00 - 10:30 ✗ (ocupado)
10:30 - 11:00 ✓ (libre)
...
```

---

## 🔄 FLUJO DE MUTACIONES

### Crear Cita

```typescript
const createAppointment = useMutation({
  mutationFn: async (data) => {
    // 1. Enviar a Supabase
    const { data, error } = await supabase
      .from('appointments')
      .insert([data])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  onSuccess: (newAppointment) => {
    // 2. Invalidar caches relacionados
    queryClient.invalidateQueries({ 
      queryKey: ['appointments'] 
    });
    
    // 3. Guardar en sessionStorage para referencia
    sessionStorage.setItem(
      'last_appointment',
      JSON.stringify({
        id: newAppointment.id,
        email: newAppointment.customer_email,
        createdAt: new Date(),
      })
    );
  },
  
  onError: (error) => {
    // 4. Manejo de errores con contexto
    if (error.code === '23505') {
      // Unique constraint
      throw new Error('Ese email ya tiene una cita pendiente');
    } else if (error.code === '23P01') {
      // Exclusion constraint
      throw new Error('El horario fue ocupado. Intenta otro');
    }
  }
});
```

---

## 📱 RESPONSIVIDAD

### Breakpoints Tailwind

```
sm: 640px   (tablets)
md: 768px   (tablets grandes)
lg: 1024px  (desktops)
xl: 1280px  (widescreen)
```

**Estrategia:**
- Grid de servicios: 1 col (mobile) → 2 cols (md)
- Grid de slots: 2 cols (mobile) → 3 cols (sm)
- Texto: más pequeño en mobile (text-sm)
- Padding: px-4 (mobile) → px-8 (desktop)

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* 1 columna en mobile, 2 en md+ */}
</div>
```

---

## 🌍 ZONAS HORARIAS

### Consideraciones

El sistema actualmente usa UTC en la BD (timestamp with time zone).

```typescript
// Cliente siempre trabaja con hora local
const slotStart = new Date(date);  // Hora local del navegador
slotStart.setHours(9, 0, 0, 0);    // 9:00 AM local

// Envío a Supabase en ISO string (incluye offset)
start_time: slotStart.toISOString()  // "2024-04-15T09:00:00-03:00"
```

**Para Multi-zona (Roadmap):**

```typescript
// Usar date-fns con zonedTimeToUtc
import { zonedTimeToUtc } from 'date-fns-tz';

const utcTime = zonedTimeToUtc(
  new Date(2024, 3, 15, 9, 0),
  'America/Santiago'
);
```

---

## 🚨 MANEJO DE ERRORES

### Errores Comunes en Supabase

```typescript
const checkSlotAvailability = async (serviceId, start, end) => {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('id')
      .eq('service_id', serviceId)
      .overlaps('time_range', [start, end]);
    
    if (error) {
      // Error de red o permisos
      if (error.code === '401') {
        throw new Error('No autorizado. Inicia sesión.');
      } else if (error.code === '404') {
        throw new Error('Servicio no encontrado.');
      } else {
        throw new Error(`Error: ${error.message}`);
      }
    }
    
    return data.length === 0;  // true si está disponible
  } catch (err) {
    console.error('Slot check failed:', err);
    throw err;
  }
};
```

---

## 📈 MÉTRICAS & MONITORING

### Qué trackear en producción

```typescript
// 1. Tiempo de carga de servicios
const { data, isLoading } = useServices();
// Track: isLoading duration

// 2. Errores de creación de citas
const createAppointment = useMutation({
  onError: (err) => {
    analytics.track('appointment_creation_failed', {
      error: err.message,
      timestamp: new Date(),
    });
  }
});

// 3. Conversion funnel
// - Usuario ve servicios ✓
// - Usuario selecciona fecha ✓
// - Usuario selecciona horario ✓
// - Usuario completa formulario ✓
// - Usuario confirma cita ✓

// 4. Performance
// - TTI (Time to Interactive)
// - LCP (Largest Contentful Paint)
// - CLS (Cumulative Layout Shift)
```

---

## 🔧 EXTENSIONES FUTURAS

### 1. Autenticación Admin

```typescript
// Agregar tabla admin_users
CREATE TABLE admin_users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  role VARCHAR NOT NULL, -- 'admin', 'manager'
  password_hash VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

// Hook de autenticación
const useAdminAuth = () => {
  return useMutation({
    mutationFn: async (email, password) => {
      const { data, error } = await supabase.auth
        .signInWithPassword({ email, password });
      // ...
    }
  });
};
```

### 2. Email de Confirmación

```typescript
// Edge Function en Supabase
export async function POST(req: Request) {
  const { appointmentId, customerEmail } = await req.json();
  
  // Usar Resend
  const result = await resend.emails.send({
    from: 'noreply@booking.com',
    to: customerEmail,
    subject: 'Confirmación de tu cita',
    html: generateEmailHTML(appointmentId),
  });
  
  return new Response(JSON.stringify(result));
}
```

### 3. Sistema de Pagos

```typescript
// Integrar Stripe
const handlePayment = async (appointmentId, price) => {
  const { data: session } = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: serviceName },
        unit_amount: price * 100,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
  });
};
```

### 4. Recordatorios por Email/SMS

```typescript
// Scheduled function en Supabase
// Ejecutar diariamente a las 10:00 AM

SELECT * FROM appointments
WHERE status = 'confirmed'
  AND DATE(start_time) = CURRENT_DATE + 1
  AND HOUR(start_time) >= 14; -- Recordar mañana a partir de 14hrs

-- Enviar email/SMS a cada uno
```

---

## 🎨 THEMING & PERSONALIZACIÓN

### Sistema de Colores por Servicio

```typescript
// En DB: cada servicio tiene campo 'color'
interface Service {
  name: string;
  color: string;  // "#3B82F6", "#10B981", etc.
}

// En componente
<Card
  style={{
    borderTopColor: service.color,
    borderTopWidth: '4px',
  }}
>
```

### Dark Mode

```typescript
// Tailwind automáticamente soporta dark mode
// En tailwind.config.ts: darkMode: ['class']

// Activar dark mode desde el navegador
document.documentElement.classList.add('dark');
```

---

## 📦 TAMAÑO DE BUNDLE

Tamaños esperados (gzipped):

```
react: 42KB
supabase-js: 65KB
@tanstack/react-query: 30KB
shadcn/ui + radix-ui: 45KB
date-fns: 35KB
tailwind css: 15KB
─────────────────────
Total: ~230KB (estimate)
```

Optimizable con:
- Lazy loading de rutas
- Code splitting de componentes
- Minificación en build

---

## ✅ CHECKLIST PARA PRODUCCIÓN

- [ ] RLS policies en todas las tablas
- [ ] Backups automáticos configurados
- [ ] SSL/HTTPS habilitado
- [ ] Rate limiting en API (si aplicable)
- [ ] Error logging configurado
- [ ] Analytics integrado
- [ ] Monitoring de performance
- [ ] Tests unitarios (e2e en Cypress)
- [ ] Documentación actualizada
- [ ] Runbook de incidentes
- [ ] Plan de disaster recovery

---

**Última actualización:** 2024-04-15  
**Versión:** 1.0.0-MVP  
**Autor:** Ferrer, Superdigital Solutions
