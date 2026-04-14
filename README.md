# 🎯 Booking System MVP - Guía Completa

**Booking System moderno, escalable y production-ready** construido con React, Supabase, Shadcn/ui y TanStack Query.

---

## 📋 Tabla de Contenidos

1. [Stack Tecnológico](#stack-tecnológico)
2. [Instalación Rápida](#instalación-rápida)
3. [Configuración de Supabase](#configuración-de-supabase)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Guía de Desarrollo](#guía-de-desarrollo)
6. [Deploy a Producción](#deploy-a-producción)
7. [Características](#características)
8. [Troubleshooting](#troubleshooting)

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + Vite + TypeScript |
| **UI Components** | Shadcn/ui + Tailwind CSS |
| **Estado** | TanStack Query (React Query) |
| **Manejo de Fechas** | date-fns |
| **Backend/DB** | Supabase (PostgreSQL) + RLS |
| **Autenticación** | Supabase RLS |
| **Deploy** | Vercel / Netlify |

---

## 🚀 Instalación Rápida

### 1. Clonar repositorio

```bash
git clone https://github.com/tu-usuario/booking-system-mvp.git
cd booking-system-mvp
```

### 2. Instalar dependencias

```bash
npm install
# o
yarn install
```

### 3. Crear archivo `.env.local`

```bash
cp .env.example .env.local
```

Rellenar con las variables de Supabase:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Acceder a `http://localhost:3000`

---

## ⚙️ Configuración de Supabase

### Paso 1: Crear Proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com)
2. Crear nuevo proyecto
3. Copiar `URL` y `Anon Key` a `.env.local`

### Paso 2: Ejecutar Script SQL

1. En Supabase Dashboard → SQL Editor
2. Crear nueva query
3. Copiar contenido de `01_database_schema.sql`
4. Ejecutar (▶️)

**El script crea:**
- ✅ Tabla `services`
- ✅ Tabla `availability`
- ✅ Tabla `appointments`
- ✅ Indices para optimización
- ✅ Constraint de exclusión (no solapamientos)
- ✅ RLS policies
- ✅ Función `get_available_slots()`

### Paso 3: Insertar Datos de Ejemplo (Opcional)

Descomentar la sección al final de `01_database_schema.sql` para insertar servicios de prueba:

```sql
-- Descomenta las secciones INSERT para agregar datos de ejemplo
INSERT INTO services (name, description, duration_min, price) VALUES...
```

### Paso 4: Habilitar Email (Recomendado)

Para enviar confirmaciones por email:

1. **Opción A:** Usar Supabase Email (Resend)
   - Dashboard → Email Settings
   - Copiar template HTML en `emails/appointment-confirmation.html`

2. **Opción B:** Edge Function personalizada
   - Crear Edge Function `send-appointment-email`
   - Usar Resend API o SendGrid

---

## 📁 Estructura del Proyecto

```
src/
├── components/
│   ├── BookingSystem.tsx          # Componente principal
│   └── ui/                         # Shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── calendar.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       └── ...
├── lib/
│   ├── supabase-client.ts         # Cliente Supabase + React Query
│   ├── utils-booking.ts           # Lógica de disponibilidad
│   └── utils.ts                   # Utilidades generales
├── pages/
│   ├── Home.tsx
│   └── NotFound.tsx
├── App.tsx                        # Router principal
├── main.tsx                       # Entry point
└── index.css                      # Tailwind + variables CSS

public/
└── ...

vite.config.ts
tsconfig.json
package.json
.env.local
```

---

## 🔧 Guía de Desarrollo

### Entender el Flujo

1. **Usuario selecciona servicio** → Se cargan disponibilidades
2. **Usuario elige fecha** → Se filtran fechas disponibles (solo con slot)
3. **Usuario elige horario** → Se calculan slots libres (sin conflictos)
4. **Usuario ingresa datos** → Validación de email y nombre
5. **Confirmar cita** → Mutación a Supabase + Constraint CHECK

### Modificar Disponibilidades

Editar en Supabase SQL:

```sql
-- Cambiar horario de servicio
UPDATE availability
SET start_time = '08:00', end_time = '18:00'
WHERE service_id = 'xxx' AND day_of_week = 1; -- Lunes
```

### Añadir Nuevo Servicio

```typescript
// En BookingSystem.tsx o formulario admin
const { mutate: createService } = useMutation({
  mutationFn: async (data) => {
    return await supabase
      .from('services')
      .insert([data])
      .select()
      .single();
  },
});
```

### Personalizar Estilos

- **Colores:** Editar `tailwind.config.ts` theme
- **Componentes Shadcn:** Ubicados en `src/components/ui/`
- **Fuentes:** Agregar en `index.css` via Google Fonts

### Debug de Disponibilidad

Función helper para verificar slots:

```typescript
// En componente o console
import { calculateAvailableSlots } from '@/lib/utils-booking';

const slots = calculateAvailableSlots(
  selectedDate,
  service,
  availabilities,
  appointments
);

console.log('Available slots:', slots);
```

---

## 📦 Deploy a Producción

### Opción 1: Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configurar variables de entorno en Vercel dashboard
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
```

### Opción 2: Netlify

```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

Configurar variables en Netlify dashboard → Site settings → Build & deploy.

### Opción 3: Docker + VPS (Hetzner/DigitalOcean)

**Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "preview"]
```

**Deploy:**

```bash
docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... -t booking-system .

docker run -p 3000:3000 booking-system
```

### Checklist Pre-Deploy

- ✅ Variables de entorno configuradas
- ✅ RLS policies activas en Supabase
- ✅ Datos de ejemplo insertados
- ✅ `npm run build` ejecutado sin errores
- ✅ Testar flujo completo en staging
- ✅ SSL habilitado en dominio
- ✅ Email de confirmación funcional (opcional)

---

## ✨ Características

### ✅ Implementadas

- [x] Selección de servicios con precios
- [x] Calendario interactivo (Shadcn Calendar)
- [x] Cálculo inteligente de slots disponibles
- [x] Validación de disponibilidad en tiempo real
- [x] Formulario de reserva con validación
- [x] Constraint PostgreSQL anti-solapamientos
- [x] RLS para seguridad de datos
- [x] Confirmación visual del booking
- [x] Diseño SaaS moderno + responsivo
- [x] Dark mode ready
- [x] Indexación SQL para performance

### 🔄 Próximas Fases (Roadmap)

- [ ] Email de confirmación automático
- [ ] SMS notifications (Twilio)
- [ ] Dashboard admin (CRUD servicios)
- [ ] Cancelación/Rescheduling de citas
- [ ] Sistema de recordatorios
- [ ] Integración con Stripe/Mercado Pago
- [ ] WhatsApp Business API integration
- [ ] Reportes y analytics
- [ ] Multi-idioma
- [ ] Zona horaria automática

---

## 📞 Troubleshooting

### Error: "VITE_SUPABASE_URL is undefined"

**Solución:**
1. Verificar que `.env.local` existe en raíz
2. Reiniciar servidor dev (`npm run dev`)
3. Usar `VITE_` como prefijo (obligatorio en Vite)

### Error: "Exclusion constraint violation"

**Causa:** Dos citas se solapan.

**Solución:**
```sql
-- Revisar citas existentes
SELECT * FROM appointments
WHERE service_id = 'xxx'
AND status != 'cancelled'
ORDER BY start_time;

-- Cancelar cita conflictiva si es necesario
UPDATE appointments SET status = 'cancelled' WHERE id = 'xxx';
```

### Slots no se muestran

**Debugging:**

```typescript
console.log('Availabilities:', availabilities);
console.log('Appointments:', appointments);
console.log('Selected date:', selectedDate);
console.log('Day of week:', selectedDate.getDay()); // Debe coincidir con DB
console.log('Calculated slots:', availableSlots);
```

**Verificar que:**
- ✅ Disponibilidades existen para el día (0=Dom, 1=Lun, etc.)
- ✅ Fecha no esté en el pasado
- ✅ Horario actual < horarios disponibles

### Performance lento

**Optimizaciones:**

```typescript
// En useAppointmentsByDateRange
const { data, isFetching } = useAppointmentsByDateRange(
  serviceId,
  dateRangeStart,
  dateRangeEnd
);

// Limitar rango de fechas
const dateRangeEnd = addDays(dateRangeStart, 7); // Solo 7 días adelante
```

---

## 📖 Documentación Adicional

- [Supabase Docs](https://supabase.com/docs)
- [React Query Docs](https://tanstack.com/query/latest)
- [Shadcn/ui Components](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [date-fns](https://date-fns.org/docs/Getting-Started)

---

## 🤝 Contribuir

Reportar issues o sugerencias en GitHub Issues.

---

## 📄 Licencia

MIT License - Libre para uso comercial y educativo.

---

## 📧 Soporte

**Email:** support@booking-system.local  
**Issues:** GitHub Issues  
**Documentación:** [Wiki](https://github.com/tu-usuario/booking-system-mvp/wiki)

---

**Hecho con ❤️ para Fer | Superdigital Solutions**
