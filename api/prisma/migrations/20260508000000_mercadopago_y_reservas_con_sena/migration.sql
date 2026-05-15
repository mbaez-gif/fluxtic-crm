-- ─────────────────────────────────────────────────────────────────
-- Migración: Mercado Pago + Reservas con Seña
-- Fecha: 2026-05-08
-- ─────────────────────────────────────────────────────────────────
-- Esta migración agrega:
--  1. Modelo HorarioProfesional + backfill default
--  2. Campos de seña + buffer en Servicio
--  3. Estados nuevos en EstadoTurno
--  4. Campos nuevos en Turno + backfill de monto_total
--  5. Tablas PagoSena y ComprobanteManual
--  6. Campos nuevos en EventoN8n
--  7. Valor LINK_PUBLICO en OrigenCliente
-- ─────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════
-- PARTE 1: NUEVOS ENUMS
-- ═════════════════════════════════════════════════════════════════

CREATE TYPE "TipoSena" AS ENUM ('SIN_SENA', 'PORCENTAJE', 'MONTO_FIJO');

CREATE TYPE "OrigenReserva" AS ENUM (
  'ADMIN',
  'LINK_PUBLICO',
  'WHATSAPP',
  'INSTAGRAM',
  'TIENDANUBE'
);

CREATE TYPE "EstadoPagoSena" AS ENUM (
  'CREADO',
  'PENDIENTE',
  'APROBADO',
  'RECHAZADO',
  'VENCIDO',
  'REEMBOLSADO',
  'VALIDACION_MANUAL'
);

CREATE TYPE "EstadoComprobante" AS ENUM (
  'PENDIENTE',
  'APROBADO',
  'RECHAZADO',
  'REQUIERE_REVISION'
);

-- ═════════════════════════════════════════════════════════════════
-- PARTE 2: VALORES NUEVOS EN ENUMS EXISTENTES
-- ═════════════════════════════════════════════════════════════════

-- EstadoTurno: agregar 4 valores nuevos
ALTER TYPE "EstadoTurno" ADD VALUE IF NOT EXISTS 'PENDIENTE_PAGO_MP';
ALTER TYPE "EstadoTurno" ADD VALUE IF NOT EXISTS 'PENDIENTE_VALIDACION_MANUAL';
ALTER TYPE "EstadoTurno" ADD VALUE IF NOT EXISTS 'VENCIDO';
ALTER TYPE "EstadoTurno" ADD VALUE IF NOT EXISTS 'RECHAZADO';

-- OrigenCliente: agregar LINK_PUBLICO
ALTER TYPE "OrigenCliente" ADD VALUE IF NOT EXISTS 'LINK_PUBLICO';

-- ═════════════════════════════════════════════════════════════════
-- PARTE 3: SERVICIO — campos de seña y buffer
-- ═════════════════════════════════════════════════════════════════

ALTER TABLE "servicios"
  ADD COLUMN "sena_tipo" "TipoSena" NOT NULL DEFAULT 'SIN_SENA',
  ADD COLUMN "sena_porcentaje" DECIMAL(5, 2),
  ADD COLUMN "sena_monto_fijo" DECIMAL(10, 2),
  ADD COLUMN "buffer_min" INTEGER NOT NULL DEFAULT 5;

-- ═════════════════════════════════════════════════════════════════
-- PARTE 4: TURNO — campos nuevos
-- monto_total NO puede ser null pero los turnos viejos no lo tienen.
-- Estrategia: crear nullable → backfill con precio → hacer NOT NULL
-- ═════════════════════════════════════════════════════════════════

-- 4.1 Agregar columnas nuevas (monto_total nullable temporalmente)
ALTER TABLE "turnos"
  ADD COLUMN "observaciones" TEXT,
  ADD COLUMN "monto_total" DECIMAL(10, 2),
  ADD COLUMN "monto_sena" DECIMAL(10, 2),
  ADD COLUMN "sena_requerida" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reserva_expira_en" TIMESTAMP(3),
  ADD COLUMN "origen_reserva" "OrigenReserva" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "mp_preference_id" TEXT,
  ADD COLUMN "mp_init_point" TEXT,
  ADD COLUMN "mp_external_reference" TEXT;

-- 4.2 Backfill: monto_total = precio (los turnos viejos)
UPDATE "turnos" SET "monto_total" = "precio" WHERE "monto_total" IS NULL;

-- 4.3 Hacer NOT NULL
ALTER TABLE "turnos" ALTER COLUMN "monto_total" SET NOT NULL;

-- 4.4 Índices nuevos
CREATE INDEX "turnos_reserva_expira_en_idx" ON "turnos"("reserva_expira_en");
CREATE INDEX "turnos_mp_external_reference_idx" ON "turnos"("mp_external_reference");

-- ═════════════════════════════════════════════════════════════════
-- PARTE 5: HORARIOS POR PROFESIONAL
-- ═════════════════════════════════════════════════════════════════

CREATE TABLE "horarios_profesionales" (
  "id"             TEXT NOT NULL,
  "profesional_id" TEXT NOT NULL,
  "dia_semana"     INTEGER NOT NULL,
  "hora_inicio"    TEXT NOT NULL,
  "hora_fin"       TEXT NOT NULL,
  "activo"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "horarios_profesionales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "horarios_profesionales_profesional_id_dia_semana_hora_inicio_key"
  ON "horarios_profesionales"("profesional_id", "dia_semana", "hora_inicio");

CREATE INDEX "horarios_profesionales_profesional_id_idx"
  ON "horarios_profesionales"("profesional_id");

ALTER TABLE "horarios_profesionales"
  ADD CONSTRAINT "horarios_profesionales_profesional_id_fkey"
  FOREIGN KEY ("profesional_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5.1 Backfill: horario default para profesionales activas existentes
-- Lun-Vie 09:00-19:00, Sáb 09:00-14:00
DO $$
DECLARE
  prof_record RECORD;
  dia INTEGER;
BEGIN
  FOR prof_record IN
    SELECT id FROM "usuarios" WHERE "activo" = true AND "rol" IN ('OWNER', 'ADMIN', 'EMPLEADA')
  LOOP
    -- Lunes a Viernes (1-5): 09:00-19:00
    FOR dia IN 1..5 LOOP
      INSERT INTO "horarios_profesionales"
        ("id", "profesional_id", "dia_semana", "hora_inicio", "hora_fin", "activo", "updatedAt")
      VALUES
        (md5(random()::text || clock_timestamp()::text)::varchar(25),
         prof_record.id, dia, '09:00', '19:00', true, NOW())
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Sábado (6): 09:00-14:00
    INSERT INTO "horarios_profesionales"
      ("id", "profesional_id", "dia_semana", "hora_inicio", "hora_fin", "activo", "updatedAt")
    VALUES
      (md5(random()::text || clock_timestamp()::text)::varchar(25),
       prof_record.id, 6, '09:00', '14:00', true, NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ═════════════════════════════════════════════════════════════════
-- PARTE 6: PAGOS DE SEÑA
-- ═════════════════════════════════════════════════════════════════

CREATE TABLE "pagos_sena" (
  "id"                    TEXT NOT NULL,
  "turno_id"              TEXT NOT NULL,
  "provider"              TEXT NOT NULL DEFAULT 'MERCADOPAGO',
  "external_reference"    TEXT NOT NULL,
  "preference_id"         TEXT,
  "payment_id"            TEXT,
  "merchant_order_id"     TEXT,
  "status"                "EstadoPagoSena" NOT NULL DEFAULT 'CREADO',
  "status_detail"         TEXT,
  "amount"                DECIMAL(10, 2) NOT NULL,
  "currency"              TEXT NOT NULL DEFAULT 'ARS',
  "init_point"            TEXT,
  "payer_email"           TEXT,
  "payer_id"              TEXT,
  "webhook_payload"       JSONB,
  "raw_payment_response"  JSONB,
  "approved_at"           TIMESTAMP(3),
  "rejected_at"           TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pagos_sena_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pagos_sena_external_reference_key"
  ON "pagos_sena"("external_reference");

CREATE UNIQUE INDEX "pagos_sena_payment_id_key"
  ON "pagos_sena"("payment_id");

CREATE INDEX "pagos_sena_turno_id_idx" ON "pagos_sena"("turno_id");
CREATE INDEX "pagos_sena_status_idx" ON "pagos_sena"("status");

ALTER TABLE "pagos_sena"
  ADD CONSTRAINT "pagos_sena_turno_id_fkey"
  FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═════════════════════════════════════════════════════════════════
-- PARTE 7: COMPROBANTES MANUALES (fase 2 — schema preparado)
-- ═════════════════════════════════════════════════════════════════

CREATE TABLE "comprobantes_manuales" (
  "id"                       TEXT NOT NULL,
  "turno_id"                 TEXT NOT NULL,
  "archivo_url"              TEXT NOT NULL,
  "monto_detectado"          DECIMAL(10, 2),
  "fecha_detectada"          TIMESTAMP(3),
  "alias_detectado"          TEXT,
  "num_operacion_detectado"  TEXT,
  "confianza_validacion"     DECIMAL(3, 2),
  "estado"                   "EstadoComprobante" NOT NULL DEFAULT 'PENDIENTE',
  "motivo_revision"          TEXT,
  "validado_por_usuario_id"  TEXT,
  "validado_at"              TIMESTAMP(3),
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,

  CONSTRAINT "comprobantes_manuales_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comprobantes_manuales_turno_id_idx"
  ON "comprobantes_manuales"("turno_id");

CREATE INDEX "comprobantes_manuales_estado_idx"
  ON "comprobantes_manuales"("estado");

ALTER TABLE "comprobantes_manuales"
  ADD CONSTRAINT "comprobantes_manuales_turno_id_fkey"
  FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═════════════════════════════════════════════════════════════════
-- PARTE 8: EVENTOS N8N — campos nuevos
-- ═════════════════════════════════════════════════════════════════

ALTER TABLE "eventos_n8n"
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "error"   TEXT;

CREATE INDEX "eventos_n8n_workflow_name_idx"
  ON "eventos_n8n"("workflow_name");

-- ═════════════════════════════════════════════════════════════════
-- FIN DE LA MIGRACIÓN
-- ═════════════════════════════════════════════════════════════════
