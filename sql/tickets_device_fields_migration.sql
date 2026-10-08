-- MIGRACIÓN: Campos de ficha del equipo en tickets
-- Ejecutar en Supabase SQL Editor
-- Campos: Modelo, Falla (reported_issue), N° Serie, Password
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='device_model') THEN
    ALTER TABLE tickets ADD COLUMN device_model TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='reported_issue') THEN
    ALTER TABLE tickets ADD COLUMN reported_issue TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='serial_number') THEN
    ALTER TABLE tickets ADD COLUMN serial_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='device_password') THEN
    ALTER TABLE tickets ADD COLUMN device_password TEXT;
  END IF;
END $$;

-- Backfill: copiar notes de la cita como falla cuando esté vacía
UPDATE tickets t
SET reported_issue = a.notes
FROM appointments a
WHERE t.appointment_id = a.id
  AND (t.reported_issue IS NULL OR t.reported_issue = '')
  AND a.notes IS NOT NULL AND a.notes <> '';
