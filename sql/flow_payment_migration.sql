-- Migration: Add Flow payment fields to appointments table
-- Run this in Supabase SQL Editor

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS flow_commerce_order TEXT,
  ADD COLUMN IF NOT EXISTS flow_token          TEXT,
  ADD COLUMN IF NOT EXISTS paid                BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_amount         INTEGER;

-- Índice para lookups por token (usado en BookingReturn polling)
CREATE INDEX IF NOT EXISTS idx_appointments_flow_token
  ON appointments (flow_token);

-- Índice para idempotencia en confirm-flow-payment
CREATE INDEX IF NOT EXISTS idx_appointments_flow_commerce_order
  ON appointments (flow_commerce_order);
