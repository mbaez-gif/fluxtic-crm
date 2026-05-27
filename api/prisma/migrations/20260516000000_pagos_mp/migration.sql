-- CreateEnum
CREATE TYPE "OrigenReserva" AS ENUM ('ADMIN', 'PORTAL_PACIENTE', 'LINK_PUBLICO', 'WHATSAPP', 'TELEFONO', 'N8N');

-- CreateEnum
CREATE TYPE "MetodoCopago" AS ENUM ('SIN_COPAGO', 'MERCADOPAGO', 'TRANSFERENCIA', 'AMBOS');

-- CreateEnum
CREATE TYPE "EstadoPagoMercadoPago" AS ENUM ('CREADO', 'PENDIENTE', 'APROBADO', 'RECHAZADO', 'VENCIDO', 'REEMBOLSADO', 'VALIDACION_MANUAL');

-- CreateEnum
CREATE TYPE "EstadoComprobanteTransferencia" AS ENUM ('PENDIENTE_REVISION', 'APROBADO', 'RECHAZADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoTurno" ADD VALUE 'PENDIENTE_PAGO_MP';
ALTER TYPE "EstadoTurno" ADD VALUE 'PENDIENTE_VALIDACION_MANUAL';
ALTER TYPE "EstadoTurno" ADD VALUE 'VENCIDO';

-- AlterTable
ALTER TABLE "Turno" ADD COLUMN     "grupo_reserva_id" TEXT,
ADD COLUMN     "metodo_copago" "MetodoCopago" NOT NULL DEFAULT 'SIN_COPAGO',
ADD COLUMN     "monto_copago" DECIMAL(12,2),
ADD COLUMN     "monto_total" DECIMAL(12,2),
ADD COLUMN     "mp_external_reference" TEXT,
ADD COLUMN     "mp_init_point" TEXT,
ADD COLUMN     "mp_preference_id" TEXT,
ADD COLUMN     "origen_reserva" "OrigenReserva" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN     "requiere_copago" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reserva_expira_en" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PagoMercadoPago" (
    "id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "external_reference" TEXT NOT NULL,
    "preference_id" TEXT,
    "payment_id" TEXT,
    "merchant_order_id" TEXT,
    "status" "EstadoPagoMercadoPago" NOT NULL DEFAULT 'CREADO',
    "status_detail" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "init_point" TEXT,
    "payer_email" TEXT,
    "payer_id" TEXT,
    "webhook_payload" TEXT,
    "raw_payment_response" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagoMercadoPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComprobanteTransferencia" (
    "id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "archivo_url" TEXT NOT NULL,
    "storage_key" TEXT,
    "monto_detectado" DECIMAL(12,2),
    "fecha_detectada" TIMESTAMP(3),
    "alias_detectado" TEXT,
    "observaciones_paciente" TEXT,
    "estado" "EstadoComprobanteTransferencia" NOT NULL DEFAULT 'PENDIENTE_REVISION',
    "revisado_por_id" TEXT,
    "revisado_at" TIMESTAMP(3),
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComprobanteTransferencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PagoMercadoPago_external_reference_key" ON "PagoMercadoPago"("external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "PagoMercadoPago_payment_id_key" ON "PagoMercadoPago"("payment_id");

-- CreateIndex
CREATE INDEX "PagoMercadoPago_turno_id_idx" ON "PagoMercadoPago"("turno_id");

-- CreateIndex
CREATE INDEX "PagoMercadoPago_status_idx" ON "PagoMercadoPago"("status");

-- CreateIndex
CREATE INDEX "ComprobanteTransferencia_turno_id_idx" ON "ComprobanteTransferencia"("turno_id");

-- CreateIndex
CREATE INDEX "ComprobanteTransferencia_estado_idx" ON "ComprobanteTransferencia"("estado");

-- CreateIndex
CREATE INDEX "Turno_reserva_expira_en_idx" ON "Turno"("reserva_expira_en");

-- CreateIndex
CREATE INDEX "Turno_mp_external_reference_idx" ON "Turno"("mp_external_reference");

-- CreateIndex
CREATE INDEX "Turno_grupo_reserva_id_idx" ON "Turno"("grupo_reserva_id");

-- AddForeignKey
ALTER TABLE "PagoMercadoPago" ADD CONSTRAINT "PagoMercadoPago_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "Turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobanteTransferencia" ADD CONSTRAINT "ComprobanteTransferencia_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "Turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

