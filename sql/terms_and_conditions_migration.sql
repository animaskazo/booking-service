-- Configuración de términos por negocio y respaldo de aceptación por reserva.
-- Ejecutar una vez en Supabase SQL Editor antes de desplegar el frontend y las Edge Functions.

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS terms_title TEXT NOT NULL DEFAULT 'Términos y condiciones',
  ADD COLUMN IF NOT EXISTS terms_content TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS terms_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_title_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS terms_content_snapshot TEXT;
