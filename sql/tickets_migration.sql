-- MIGRACIÓN PARA MÓDULO DE SERVICIO TÉCNICO

-- 1. ACTUALIZAR TABLA DE CITAS (Asegurar campos necesarios)
-- ============================================================================
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='short_id') THEN
        ALTER TABLE appointments ADD COLUMN short_id VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='user_id') THEN
        ALTER TABLE appointments ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. TABLA DE TICKETS (SERVICIO TÉCNICO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id), -- Para multi-tenancy
  status VARCHAR(50) NOT NULL DEFAULT 'evaluating' CHECK (status IN ('evaluating', 'quoted', 'accepted', 'rejected', 'repairing', 'ready', 'closed')),
  description TEXT,
  total_budget DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(appointment_id)
);

-- 3. TABLA DE HALLAZGOS DEL TICKET (ÍTEMS DEL PRESUPUESTO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLA DE HISTORIAL DE REPARACIÓN (EVIDENCIA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  evidence_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TRIGGERS PARA updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;

-- Políticas simplificadas para desarrollo (el usuario ya está logueado en Admin)
CREATE POLICY "Allow public read tickets" ON tickets FOR SELECT USING (true);
CREATE POLICY "Allow public insert tickets" ON tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update tickets" ON tickets FOR UPDATE USING (true);
CREATE POLICY "Allow public delete tickets" ON tickets FOR DELETE USING (true);

CREATE POLICY "Allow public read ticket_findings" ON ticket_findings FOR SELECT USING (true);
CREATE POLICY "Allow public insert ticket_findings" ON ticket_findings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete ticket_findings" ON ticket_findings FOR DELETE USING (true);

CREATE POLICY "Allow public read ticket_history" ON ticket_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert ticket_history" ON ticket_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete ticket_history" ON ticket_history FOR DELETE USING (true);
