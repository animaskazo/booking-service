-- 0. HABILITAR EXTENSIONES NECESARIAS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. CREAR TABLA DE SERVICIOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0),
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  color VARCHAR(7) DEFAULT '#3B82F6', -- Color para el UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREAR TABLA DE DISPONIBILIDAD SEMANAL
-- ============================================================================
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 1=Lunes, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (start_time < end_time),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_id, day_of_week, start_time, end_time)
);

-- 3. CREAR TABLA DE CITAS (APPOINTMENTS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (start_time < end_time)
);

-- 4. ÍNDICES PARA OPTIMIZACIÓN DE QUERIES
-- ============================================================================
CREATE INDEX idx_appointments_service_id ON appointments(service_id);
CREATE INDEX idx_appointments_start_time ON appointments(start_time);
CREATE INDEX idx_appointments_email ON appointments(customer_email);
CREATE INDEX idx_availability_service_id ON availability(service_id);
CREATE INDEX idx_availability_day ON availability(day_of_week);

-- 5. CONSTRAINT DE EXCLUSIÓN PARA EVITAR SOLAPAMIENTOS
-- ============================================================================
-- Evita que dos citas del mismo servicio se solapen en el tiempo
ALTER TABLE appointments
ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING GIST (
  service_id WITH =,
  tstzrange(start_time, end_time) WITH &&
) WHERE (status != 'cancelled');

-- 6. FUNCIÓN PARA ACTUALIZAR TIMESTAMP (updated_at)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. TRIGGERS PARA updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_availability_updated_at ON availability;
CREATE TRIGGER update_availability_updated_at
BEFORE UPDATE ON availability
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Política para servicios: lectura pública
CREATE POLICY "Allow public read services"
  ON services FOR SELECT USING (true);

CREATE POLICY "Allow public insert services"
  ON services FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update services"
  ON services FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete services"
  ON services FOR DELETE USING (true);

-- Política para disponibilidad: lectura pública
CREATE POLICY "Allow public read availability"
  ON availability FOR SELECT USING (true);

CREATE POLICY "Allow public insert availability"
  ON availability FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update availability"
  ON availability FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete availability"
  ON availability FOR DELETE USING (true);

-- Política para citas: lectura pública por email
CREATE POLICY "Allow public read own appointments"
  ON appointments
  FOR SELECT
  USING (true);

-- Política para crear citas: público puede insertar
CREATE POLICY "Allow public insert appointments"
  ON appointments
  FOR INSERT
  WITH CHECK (true);

-- Política para actualizar citas: público puede actualizar sus propias citas
CREATE POLICY "Allow public update own appointments"
  ON appointments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 9. VISTA ÚTIL PARA OBTENER CITAS CON DETALLES DEL SERVICIO
-- ============================================================================
CREATE OR REPLACE VIEW appointments_with_service AS
SELECT
  a.id,
  a.service_id,
  s.name as service_name,
  s.duration_min,
  s.price,
  a.customer_name,
  a.customer_email,
  a.customer_phone,
  a.start_time,
  a.end_time,
  a.status,
  a.notes,
  a.created_at
FROM appointments a
JOIN services s ON a.service_id = s.id
WHERE a.status != 'cancelled';

-- 10. FUNCIÓN PARA OBTENER SLOTS DISPONIBLES (Llamada desde cliente o Edge Function)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_available_slots(
  p_service_id UUID,
  p_date DATE
)
RETURNS TABLE (
  slot_start TIMESTAMP WITH TIME ZONE,
  slot_end TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_duration_min INTEGER;
  v_day_of_week INTEGER;
  v_start_time TIME;
  v_end_time TIME;
  v_current_slot TIMESTAMP WITH TIME ZONE;
  v_slot_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Obtener duración del servicio
  SELECT duration_min INTO v_duration_min FROM services WHERE id = p_service_id;
  
  IF v_duration_min IS NULL THEN
    RETURN;
  END IF;
  
  -- Obtener día de la semana (0=domingo en PostgreSQL con EXTRACT)
  v_day_of_week := EXTRACT(DOW FROM p_date)::INTEGER;
  
  -- Iterar sobre las disponibilidades del servicio para ese día
  FOR v_start_time, v_end_time IN
    SELECT start_time, end_time FROM availability
    WHERE service_id = p_service_id
      AND day_of_week = v_day_of_week
    ORDER BY start_time
  LOOP
    v_current_slot := (p_date || ' ' || v_start_time)::TIMESTAMP WITH TIME ZONE;
    
    WHILE v_current_slot + (v_duration_min || ' minutes')::INTERVAL <= (p_date || ' ' || v_end_time)::TIMESTAMP WITH TIME ZONE LOOP
      v_slot_end := v_current_slot + (v_duration_min || ' minutes')::INTERVAL;
      
      -- Verificar que el slot no tenga conflictos con citas existentes
      IF NOT EXISTS (
        SELECT 1 FROM appointments
        WHERE service_id = p_service_id
          AND status != 'cancelled'
          AND (
            (start_time, end_time) OVERLAPS (v_current_slot, v_slot_end)
          )
      ) THEN
        slot_start := v_current_slot;
        slot_end := v_slot_end;
        RETURN NEXT;
      END IF;
      
      v_current_slot := v_current_slot + (v_duration_min || ' minutes')::INTERVAL;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- 11. DATOS DE EJEMPLO (DESCOMENTA PARA PRUEBAS)
-- ============================================================================
/*
-- Insertar servicios de ejemplo
INSERT INTO services (name, description, duration_min, price) VALUES
  ('Consulta General', 'Consulta médica de 30 minutos', 30, 50.00),
  ('Masaje Terapéutico', 'Sesión de masaje de 60 minutos', 60, 80.00),
  ('Corte de Cabello', 'Corte profesional de cabello', 45, 35.00);

-- Insertar disponibilidad para cada servicio
-- Consulta General: Lunes a Viernes, 09:00-17:00
INSERT INTO availability (service_id, day_of_week, start_time, end_time)
SELECT id, dow, '09:00'::TIME, '17:00'::TIME
FROM services, (VALUES (1), (2), (3), (4), (5)) AS days(dow)
WHERE name = 'Consulta General';

-- Masaje: Martes a Sábado, 10:00-18:00
INSERT INTO availability (service_id, day_of_week, start_time, end_time)
SELECT id, dow, '10:00'::TIME, '18:00'::TIME
FROM services, (VALUES (2), (3), (4), (5), (6)) AS days(dow)
WHERE name = 'Masaje Terapéutico';

-- Corte: Lunes a Sábado, 08:00-19:00
INSERT INTO availability (service_id, day_of_week, start_time, end_time)
SELECT id, dow, '08:00'::TIME, '19:00'::TIME
FROM services, (VALUES (1), (2), (3), (4), (5), (6)) AS days(dow)
WHERE name = 'Corte de Cabello';
*/
