-- MIGRACIÓN PARA SEGUIMIENTO DE REPUESTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticket_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tracking_number TEXT,
  reference_link TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'purchased', 'shipped', 'received')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE ticket_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read ticket_parts" ON ticket_parts FOR SELECT USING (true);
CREATE POLICY "Allow public insert ticket_parts" ON ticket_parts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update ticket_parts" ON ticket_parts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete ticket_parts" ON ticket_parts FOR DELETE USING (true);
