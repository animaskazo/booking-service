# 🚀 BOOKING SYSTEM MVP - QUICK START (5 MIN)

## 1️⃣ Clonar y Setup

```bash
# Crear proyecto Vite + React
npm create vite@latest booking-system -- --template react-ts

cd booking-system

# Instalar dependencias
npm install @supabase/supabase-js @tanstack/react-query date-fns
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Instalar Shadcn/ui
npx shadcn-ui@latest init

# Agregar componentes específicos
npx shadcn-ui@latest add button card input label select alert calendar
```

## 2️⃣ Copiar Archivos

1. Copiar `01_database_schema.sql` → guardar en `sql/` proyecto
2. Copiar `02_utils_booking.ts` → `src/lib/utils-booking.ts`
3. Copiar `03_supabase_client.ts` → `src/lib/supabase-client.ts`
4. Copiar `04_BookingSystem.tsx` → `src/components/BookingSystem.tsx`
5. Copiar `05_main_and_app.tsx` → reemplazar `src/main.tsx` y crear `src/App.tsx`
6. Copiar configuraciones de `06_config_files.ts` → files correspondientes

## 3️⃣ Configurar Supabase

### En Supabase Dashboard:

1. **New Project** → Rellenar credenciales
2. **SQL Editor** → Ejecutar `01_database_schema.sql` completo
3. **Settings → API** → Copiar:
   - Project URL
   - Anon public key

### Crear `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

## 4️⃣ Insertar Datos de Ejemplo

En SQL Editor de Supabase, ejecutar:

```sql
-- Servicios
INSERT INTO services (name, description, duration_min, price, color) VALUES
  ('Consulta Médica', 'Consulta de 30 minutos', 30, 50.00, '#3B82F6'),
  ('Masaje', 'Sesión de 60 minutos', 60, 80.00, '#10B981'),
  ('Corte de Cabello', 'Corte profesional', 45, 35.00, '#F59E0B');

-- Disponibilidad: Lunes a Viernes 9-17hrs
INSERT INTO availability (service_id, day_of_week, start_time, end_time)
SELECT services.id, dow, '09:00'::TIME, '17:00'::TIME
FROM services
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS days(dow)
WHERE services.name IN ('Consulta Médica', 'Corte de Cabello');

-- Disponibilidad: Martes a Sábado 10-18hrs (Masaje)
INSERT INTO availability (service_id, day_of_week, start_time, end_time)
SELECT services.id, dow, '10:00'::TIME, '18:00'::TIME
FROM services
CROSS JOIN (VALUES (2), (3), (4), (5), (6)) AS days(dow)
WHERE services.name = 'Masaje';
```

## 5️⃣ Instalar Dependencias Faltantes

```bash
npm install react-router-dom lucide-react
npm install -D @types/react-router-dom
```

## 6️⃣ Correr en desarrollo

```bash
npm run dev
```

Acceder a `http://localhost:5173`

---

## ✅ Verificar Funcionamiento

1. **Servicios cargan** → Ves 3 servicios (Consulta, Masaje, Corte)
2. **Calendario funciona** → Puedes seleccionar fechas
3. **Slots se calculan** → Ver horarios disponibles
4. **Cita se guarda** → Email confirmación (opcional)

## 🎨 Personalizar Colores

En `src/lib/utils-booking.ts`:

```typescript
// Cambiar colores primarios
export const PRIMARY_COLOR = '#3B82F6'; // Azul
export const SUCCESS_COLOR = '#10B981'; // Verde
```

En `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      primary: '#3B82F6',
      success: '#10B981',
    },
  },
}
```

## 📱 Deploy a Vercel (1 minuto)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# En dashboard Vercel:
# Settings → Environment Variables
# Agregar:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
```

---

## 🐛 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "VITE_SUPABASE_URL is undefined" | Reiniciar `npm run dev` después de crear `.env.local` |
| Slots vacíos | Verificar que disponibilidades existan para el día (día de semana correcto) |
| Cita no se guarda | Abrir DevTools > Network → revisar error de Supabase |
| Estilos rotos | `npm run build` → `npm run preview` |

---

## 📋 Estructura Final

```
booking-system/
├── src/
│   ├── lib/
│   │   ├── utils-booking.ts
│   │   └── supabase-client.ts
│   ├── components/
│   │   ├── BookingSystem.tsx
│   │   └── ui/ (shadcn components)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── sql/
│   └── 01_database_schema.sql
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── .env.local
```

---

**Ready to ship! 🚀**

Próximos pasos:
- [ ] Email de confirmación (Edge Function en Supabase)
- [ ] Dashboard admin (CRUD servicios)
- [ ] Integración Stripe para pagos
- [ ] SMS reminders (Twilio)

---

**Time to implement: ~15 minutos**  
**Líneas de código: ~2,500 (production-ready)**
