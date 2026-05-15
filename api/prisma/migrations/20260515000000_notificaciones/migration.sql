-- ─────────────────────────────────────────────────────────────────
-- Migracion: tabla de notificaciones del panel admin
-- Fecha: 2026-05-15
-- ─────────────────────────────────────────────────────────────────

CREATE TYPE "TipoNotificacion" AS ENUM (
  'TURNO_NUEVO',
  'TURNO_CONFIRMADO',
  'TURNO_CANCELADO',
  'TURNO_VENCIDO',
  'PAGO_APROBADO',
  'PAGO_RECHAZADO',
  'COMPROBANTE_PENDIENTE',
  'COMPROBANTE_APROBADO',
  'SISTEMA'
);

CREATE TABLE "notificaciones" (
  "id"            TEXT NOT NULL,
  "tipo"          "TipoNotificacion" NOT NULL,
  "titulo"        TEXT NOT NULL,
  "mensaje"       TEXT NOT NULL,
  "referencia_id" TEXT,
  "url_destino"   TEXT,
  "leida"         BOOLEAN NOT NULL DEFAULT false,
  "leida_at"      TIMESTAMP(3),
  "usuario_id"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notificaciones_leida_createdAt_idx"
  ON "notificaciones" ("leida", "createdAt" DESC);

CREATE INDEX "notificaciones_usuario_id_leida_idx"
  ON "notificaciones" ("usuario_id", "leida");
