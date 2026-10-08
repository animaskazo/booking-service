-- MIGRACIÓN: short_id secuencial numérico (6 dígitos con ceros)
-- Ejecutar en Supabase SQL Editor
-- Las citas nuevas obtienen 000001, 000002, ... Los códigos antiguos se mantienen.
-- ============================================================================

-- 1. Secuencia global para numerar citas
CREATE SEQUENCE IF NOT EXISTS appointment_number_seq;

-- 2. Avanzar la secuencia por encima de cualquier short_id puramente numérico existente
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(short_id::INTEGER), 0) INTO max_num
  FROM appointments
  WHERE short_id ~ '^[0-9]+$';
  IF max_num < 1 THEN
    -- Sin códigos numéricos previos: el primero será 000001
    PERFORM setval('appointment_number_seq', 1, false);
  ELSE
    PERFORM setval('appointment_number_seq', max_num);
  END IF;
END $$;

-- 3. Función que genera el siguiente código con padding a 6 dígitos
CREATE OR REPLACE FUNCTION next_short_id()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT LPAD(nextval('appointment_number_seq')::TEXT, 6, '0')
$$;

-- 4. Usar la secuencia como valor por defecto al insertar sin short_id
ALTER TABLE appointments ALTER COLUMN short_id SET DEFAULT next_short_id();
