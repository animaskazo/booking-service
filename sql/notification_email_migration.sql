-- MIGRACIÓN PARA CORREO DE NOTIFICACIONES CONFIGURABLE
-- Ejecuta este script en el editor SQL de tu panel de Supabase
-- ============================================================================

-- 1. Asegurar que existe la columna notification_email en business_settings
ALTER TABLE business_settings 
  ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255) DEFAULT 'contacto@powerfix.cl';
