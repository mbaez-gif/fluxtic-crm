-- CreateEnum
CREATE TYPE "SegmentoPaciente" AS ENUM ('GENERAL', 'VIP', 'CRONICO', 'SEGUIMIENTO', 'PARTICULAR', 'COBERTURA');

-- CreateEnum
CREATE TYPE "CanalOrigen" AS ENUM ('RECEPCION', 'WHATSAPP', 'WEB', 'INSTAGRAM', 'REFERIDO', 'CAMPANIA', 'PORTAL_PACIENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "SeveridadAlertaClinica" AS ENUM ('INFO', 'ADVERTENCIA', 'CRITICA');

-- CreateEnum
CREATE TYPE "TipoBloqueoAgenda" AS ENUM ('DIA_COMPLETO', 'RANGO_HORARIO', 'PROFESIONAL', 'SEDE', 'CONSULTORIO');

-- CreateEnum
CREATE TYPE "EstadoReceta" AS ENUM ('BORRADOR', 'FIRMADA', 'ENVIADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoOrdenMedica" AS ENUM ('RECETA', 'ORDEN_ESTUDIO', 'CERTIFICADO', 'INDICACION_MEDICA');

-- CreateEnum
CREATE TYPE "EstadoVideoconsulta" AS ENUM ('PENDIENTE', 'EN_CURSO', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ProveedorVideoconsulta" AS ENUM ('JITSI', 'GOOGLE_MEET', 'WHEREBY', 'ZOOM', 'CUSTOM');

-- AlterTable
ALTER TABLE "Paciente" ADD COLUMN     "campania_origen" TEXT,
ADD COLUMN     "canal_origen" "CanalOrigen" NOT NULL DEFAULT 'RECEPCION',
ADD COLUMN     "referido_por" TEXT,
ADD COLUMN     "segmento" "SegmentoPaciente" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "total_gastado" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total_turnos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultima_atencion_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Prestacion" ADD COLUMN     "permite_telemedicina" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Turno" ADD COLUMN     "computa_disponibilidad" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mensaje_interno" TEXT,
ADD COLUMN     "mensaje_paciente" TEXT,
ADD COLUMN     "videoconsulta_estado" "EstadoVideoconsulta",
ADD COLUMN     "videoconsulta_fin_at" TIMESTAMP(3),
ADD COLUMN     "videoconsulta_inicio_at" TIMESTAMP(3),
ADD COLUMN     "videoconsulta_proveedor" "ProveedorVideoconsulta",
ADD COLUMN     "videoconsulta_room" TEXT,
ADD COLUMN     "videoconsulta_url" TEXT;

-- CreateTable
CREATE TABLE "BloqueoAgenda" (
    "id" TEXT NOT NULL,
    "tipo" "TipoBloqueoAgenda" NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "profesional_id" TEXT,
    "sede_id" TEXT,
    "consultorio_id" TEXT,
    "motivo" TEXT NOT NULL,
    "cancela_turnos" BOOLEAN NOT NULL DEFAULT false,
    "turnos_cancelados" INTEGER NOT NULL DEFAULT 0,
    "creado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloqueoAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeriadoClinica" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "cierra_total" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeriadoClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertaClinica" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "severidad" "SeveridadAlertaClinica" NOT NULL DEFAULT 'INFO',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creada_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertaClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receta" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "tipo" "TipoOrdenMedica" NOT NULL DEFAULT 'RECETA',
    "paciente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "evolucion_id" TEXT,
    "turno_id" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoReceta" NOT NULL DEFAULT 'BORRADOR',
    "diagnostico_cie10" TEXT,
    "diagnostico_texto" TEXT,
    "observaciones" TEXT,
    "firmada_at" TIMESTAMP(3),
    "firma_hash" TEXT,
    "enviada_at" TIMESTAMP(3),
    "enviada_canal" TEXT,
    "pdf_url" TEXT,
    "proveedor_externo" TEXT,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Receta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemReceta" (
    "id" TEXT NOT NULL,
    "receta_id" TEXT NOT NULL,
    "medicamento_id" TEXT,
    "descripcion" TEXT NOT NULL,
    "presentacion" TEXT,
    "cantidad" TEXT,
    "posologia" TEXT,
    "duracion" TEXT,
    "via" TEXT,
    "observaciones" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemReceta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicamento" (
    "id" TEXT NOT NULL,
    "codigo_externo" TEXT,
    "nombre_comercial" TEXT NOT NULL,
    "principio_activo" TEXT NOT NULL,
    "laboratorio" TEXT,
    "presentacion" TEXT,
    "via_admin" TEXT,
    "prescripcion_requerida" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "interacciones" TEXT,
    "contraindicaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaHistoriaClinica" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "especialidad_id" TEXT,
    "estructura" TEXT NOT NULL,
    "texto_base" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creada_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaHistoriaClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncuestaSatisfaccion" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "turno_id" TEXT,
    "profesional_id" TEXT,
    "enviada_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondida_at" TIMESTAMP(3),
    "puntaje" INTEGER,
    "nps_score" INTEGER,
    "comentario" TEXT,
    "recomendaria" BOOLEAN,
    "canal_envio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncuestaSatisfaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloqueoAgenda_desde_hasta_idx" ON "BloqueoAgenda"("desde", "hasta");

-- CreateIndex
CREATE INDEX "BloqueoAgenda_profesional_id_idx" ON "BloqueoAgenda"("profesional_id");

-- CreateIndex
CREATE INDEX "BloqueoAgenda_sede_id_idx" ON "BloqueoAgenda"("sede_id");

-- CreateIndex
CREATE UNIQUE INDEX "FeriadoClinica_fecha_key" ON "FeriadoClinica"("fecha");

-- CreateIndex
CREATE INDEX "AlertaClinica_paciente_id_activa_idx" ON "AlertaClinica"("paciente_id", "activa");

-- CreateIndex
CREATE UNIQUE INDEX "Receta_numero_key" ON "Receta"("numero");

-- CreateIndex
CREATE INDEX "Receta_paciente_id_idx" ON "Receta"("paciente_id");

-- CreateIndex
CREATE INDEX "Receta_profesional_id_idx" ON "Receta"("profesional_id");

-- CreateIndex
CREATE INDEX "Receta_estado_idx" ON "Receta"("estado");

-- CreateIndex
CREATE INDEX "Receta_deleted_at_idx" ON "Receta"("deleted_at");

-- CreateIndex
CREATE INDEX "ItemReceta_receta_id_idx" ON "ItemReceta"("receta_id");

-- CreateIndex
CREATE UNIQUE INDEX "Medicamento_codigo_externo_key" ON "Medicamento"("codigo_externo");

-- CreateIndex
CREATE INDEX "Medicamento_principio_activo_idx" ON "Medicamento"("principio_activo");

-- CreateIndex
CREATE INDEX "Medicamento_nombre_comercial_idx" ON "Medicamento"("nombre_comercial");

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaHistoriaClinica_codigo_key" ON "PlantillaHistoriaClinica"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "EncuestaSatisfaccion_turno_id_key" ON "EncuestaSatisfaccion"("turno_id");

-- CreateIndex
CREATE INDEX "EncuestaSatisfaccion_paciente_id_idx" ON "EncuestaSatisfaccion"("paciente_id");

-- CreateIndex
CREATE INDEX "EncuestaSatisfaccion_respondida_at_idx" ON "EncuestaSatisfaccion"("respondida_at");

-- CreateIndex
CREATE INDEX "Paciente_segmento_idx" ON "Paciente"("segmento");

-- CreateIndex
CREATE INDEX "Paciente_canal_origen_idx" ON "Paciente"("canal_origen");

-- AddForeignKey
ALTER TABLE "BloqueoAgenda" ADD CONSTRAINT "BloqueoAgenda_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "PerfilProfesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueoAgenda" ADD CONSTRAINT "BloqueoAgenda_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueoAgenda" ADD CONSTRAINT "BloqueoAgenda_consultorio_id_fkey" FOREIGN KEY ("consultorio_id") REFERENCES "Consultorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaClinica" ADD CONSTRAINT "AlertaClinica_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receta" ADD CONSTRAINT "Receta_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReceta" ADD CONSTRAINT "ItemReceta_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "Receta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReceta" ADD CONSTRAINT "ItemReceta_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "Medicamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncuestaSatisfaccion" ADD CONSTRAINT "EncuestaSatisfaccion_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

