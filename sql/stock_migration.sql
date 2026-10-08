-- MIGRACIÓN: Módulo de control de stock + uso en tickets
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. TABLA DE STOCK
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  photo_url TEXT,
  serial_number TEXT,
  rma TEXT,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_items_user ON stock_items(user_id);

DROP TRIGGER IF EXISTS update_stock_items_updated_at ON stock_items;
CREATE TRIGGER update_stock_items_updated_at
BEFORE UPDATE ON stock_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 2. LINK: repuesto de ticket puede venir del stock
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticket_parts' AND column_name='stock_item_id') THEN
    ALTER TABLE ticket_parts ADD COLUMN stock_item_id UUID REFERENCES stock_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ticket_parts_stock ON ticket_parts(stock_item_id);

-- 3. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_items' AND policyname='Allow public read stock_items') THEN
    CREATE POLICY "Allow public read stock_items" ON stock_items FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_items' AND policyname='Allow public insert stock_items') THEN
    CREATE POLICY "Allow public insert stock_items" ON stock_items FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_items' AND policyname='Allow public update stock_items') THEN
    CREATE POLICY "Allow public update stock_items" ON stock_items FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_items' AND policyname='Allow public delete stock_items') THEN
    CREATE POLICY "Allow public delete stock_items" ON stock_items FOR DELETE USING (true);
  END IF;
END $$;
