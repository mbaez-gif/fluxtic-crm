-- ─────────────────────────────────────────────────────────────────
-- Migración: Método de seña dual (MP + transferencia al alias)
-- Fecha: 2026-05-13
-- ─────────────────────────────────────────────────────────────────
-- Agrega los campos necesarios en ConfiguracionReservas para
-- soportar dos métodos de pago de seña simultáneos:
--   1. Mercado Pago (link de Checkout - ya existente)
--   2. Transferencia directa al alias MP del negocio (NUEVO)
--
-- Cuando metodo_sena = AMBOS, la clienta elige al reservar.
-- Cuando metodo_sena = TRANSFERENCIA, la clienta sube comprobante
-- y queda PENDIENTE_VALIDACION_MANUAL hasta que admin valide.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE "configuracion_reservas"
  ADD COLUMN IF NOT EXISTS "vencimiento_transf_horas" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "mp_link_alternativo"      TEXT,
  ADD COLUMN IF NOT EXISTS "alias_transferencia"      TEXT,
  ADD COLUMN IF NOT EXISTS "titular_alias"            TEXT,
  ADD COLUMN IF NOT EXISTS "mensaje_sena"             TEXT;
