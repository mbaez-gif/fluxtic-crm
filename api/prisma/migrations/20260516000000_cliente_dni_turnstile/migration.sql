-- ─────────────────────────────────────────────────────────────────
-- Migracion: DNI en Cliente
-- Fecha: 2026-05-16
-- ─────────────────────────────────────────────────────────────────
-- Suma una columna `dni` opcional pero unica al modelo Cliente.
-- El wizard publico ahora exige DNI; clientes existentes pueden
-- seguir sin DNI hasta que se actualicen.

ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "dni" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_dni_key" ON "clientes" ("dni");
