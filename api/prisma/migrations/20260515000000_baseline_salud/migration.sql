-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN_GENERAL', 'RECEPCION', 'FACTURACION', 'MEDICO', 'COORDINADOR_MEDICO', 'PACIENTE', 'AUDITOR');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'EN_SALA_ESPERA', 'EN_ATENCION', 'ATENDIDO', 'CANCELADO', 'AUSENTE');

-- CreateEnum
CREATE TYPE "ModalidadTurno" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "EstadoPaciente" AS ENUM ('ACTIVO', 'INACTIVO', 'EN_SEGUIMIENTO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('FEMENINO', 'MASCULINO', 'OTRO', 'SIN_DATO');

-- CreateEnum
CREATE TYPE "TipoAntecedente" AS ENUM ('PERSONAL', 'FAMILIAR', 'QUIRURGICO', 'OBSTETRICO', 'GINECOLOGICO', 'TRAUMATICO', 'OTRO');

-- CreateEnum
CREATE TYPE "SeveridadAlergia" AS ENUM ('LEVE', 'MODERADA', 'SEVERA', 'CRITICA');

-- CreateEnum
CREATE TYPE "EstadoAutorizacion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "TipoDocumentoClinico" AS ENUM ('EVOLUCION', 'ESTUDIO', 'INFORME', 'IMAGEN', 'RECETA', 'CONSENTIMIENTO', 'INDICACION', 'OTRO');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('VER', 'CREAR', 'MODIFICAR', 'ELIMINAR', 'EXPORTAR', 'FIRMAR', 'DESCARGAR', 'LOGIN', 'LOGOUT', 'ACCESO_DENEGADO');

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('BORRADOR', 'EMITIDO', 'PAGADO', 'PAGO_PARCIAL', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('RECIBO', 'FACTURA', 'PRESUPUESTO', 'NOTA_CREDITO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'MERCADOPAGO', 'CHEQUE', 'COBERTURA');

-- CreateEnum
CREATE TYPE "TipoCobertura" AS ENUM ('PARTICULAR', 'OBRA_SOCIAL', 'PREPAGA');

-- CreateEnum
CREATE TYPE "CanalComunicacion" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "TipoComunicacion" AS ENUM ('CONFIRMACION_TURNO', 'RECORDATORIO_48H', 'RECORDATORIO_24H', 'RECORDATORIO_2H', 'PREPARACION_PREVIA', 'POSTCONSULTA', 'SEGUIMIENTO', 'REACTIVACION', 'PAGO_PENDIENTE', 'CONFIRMACION_PAGO', 'CAMPANIA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoComunicacion" AS ENUM ('PENDIENTE', 'ENVIADA', 'ENTREGADA', 'LEIDA', 'RESPONDIDA', 'FALLIDA');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE', 'USO_PRESTACION', 'VENCIMIENTO');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('TURNO_PROXIMO', 'TURNO_CANCELADO', 'PACIENTE_EN_SALA', 'PAGO_RECIBIDO', 'COMPROBANTE_PENDIENTE', 'STOCK_CRITICO', 'VENCIMIENTO_INSUMO', 'AUTORIZACION_PENDIENTE', 'OTRO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "telefono" TEXT,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "es_profesional" BOOLEAN NOT NULL DEFAULT false,
    "es_paciente" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilProfesional" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "matricula_jurisdiccion" TEXT,
    "especialidad_id" TEXT NOT NULL,
    "subespecialidad" TEXT,
    "duracion_consulta_min" INTEGER NOT NULL DEFAULT 30,
    "porcentaje_liquidacion" DECIMAL(5,2),
    "color_agenda" TEXT DEFAULT '#0F766E',
    "bio" TEXT,
    "firma_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilProfesional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sede" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultorio" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "numero" TEXT,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Especialidad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfesionalSede" (
    "profesional_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "asignado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfesionalSede_pkey" PRIMARY KEY ("profesional_id","sede_id")
);

-- CreateTable
CREATE TABLE "HorarioProfesional" (
    "id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "sede_id" TEXT,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorarioProfesional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "fecha_nacimiento" TIMESTAMP(3),
    "sexo" "Sexo" NOT NULL DEFAULT 'SIN_DATO',
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "ocupacion" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoPaciente" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactoEmergencia" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "vinculo" TEXT,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "prioritario" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactoEmergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoberturaMedica" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCobertura" NOT NULL,
    "codigo" TEXT,
    "cuit" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "observaciones" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoberturaMedica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCobertura" (
    "id" TEXT NOT NULL,
    "cobertura_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "porcentaje_cobertura" DECIMAL(5,2),
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanCobertura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacienteCobertura" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "cobertura_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "numero_afiliado" TEXT NOT NULL,
    "vigencia_desde" TIMESTAMP(3),
    "vigencia_hasta" TIMESTAMP(3),
    "principal" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PacienteCobertura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Autorizacion" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "cobertura_id" TEXT NOT NULL,
    "prestacion_id" TEXT,
    "numero" TEXT,
    "estado" "EstadoAutorizacion" NOT NULL DEFAULT 'PENDIENTE',
    "monto_autorizado" DECIMAL(12,2),
    "vigencia_desde" TIMESTAMP(3),
    "vigencia_hasta" TIMESTAMP(3),
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Autorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prestacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "especialidad_id" TEXT,
    "duracion_min" INTEGER NOT NULL DEFAULT 30,
    "precio_particular" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "requiere_autorizacion" BOOLEAN NOT NULL DEFAULT false,
    "requiere_consentimiento" BOOLEAN NOT NULL DEFAULT false,
    "requiere_preparacion" BOOLEAN NOT NULL DEFAULT false,
    "instrucciones_preparacion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prestacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfesionalPrestacion" (
    "profesional_id" TEXT NOT NULL,
    "prestacion_id" TEXT NOT NULL,
    "precio_propio" DECIMAL(12,2),
    "asignado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfesionalPrestacion_pkey" PRIMARY KEY ("profesional_id","prestacion_id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "prestacion_id" TEXT,
    "sede_id" TEXT NOT NULL,
    "consultorio_id" TEXT,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "duracion_min" INTEGER NOT NULL DEFAULT 30,
    "modalidad" "ModalidadTurno" NOT NULL DEFAULT 'PRESENCIAL',
    "estado" "EstadoTurno" NOT NULL DEFAULT 'PENDIENTE',
    "sobreturno" BOOLEAN NOT NULL DEFAULT false,
    "lista_espera" BOOLEAN NOT NULL DEFAULT false,
    "motivo_consulta" TEXT,
    "observaciones" TEXT,
    "creado_por_id" TEXT,
    "cancelado_at" TIMESTAMP(3),
    "cancelado_motivo" TEXT,
    "ingreso_sala_at" TIMESTAMP(3),
    "inicio_atencion_at" TIMESTAMP(3),
    "fin_atencion_at" TIMESTAMP(3),
    "recordatorio_48h_enviado" BOOLEAN NOT NULL DEFAULT false,
    "recordatorio_24h_enviado" BOOLEAN NOT NULL DEFAULT false,
    "recordatorio_2h_enviado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioEstadoTurno" (
    "id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "estado_anterior" "EstadoTurno",
    "estado_nuevo" "EstadoTurno" NOT NULL,
    "usuario_id" TEXT,
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CambioEstadoTurno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriaClinica" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "numero" TEXT,
    "grupo_sanguineo" TEXT,
    "factor_rh" TEXT,
    "observaciones_generales" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoriaClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolucionClinica" (
    "id" TEXT NOT NULL,
    "historia_id" TEXT NOT NULL,
    "turno_id" TEXT,
    "profesional_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo_consulta" TEXT,
    "subjetivo" TEXT,
    "objetivo" TEXT,
    "analisis" TEXT,
    "plan" TEXT,
    "texto_libre" TEXT,
    "firmado_at" TIMESTAMP(3),
    "firmado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "EvolucionClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Antecedente" (
    "id" TEXT NOT NULL,
    "historia_id" TEXT NOT NULL,
    "tipo" "TipoAntecedente" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3),
    "cie10" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Antecedente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alergia" (
    "id" TEXT NOT NULL,
    "historia_id" TEXT NOT NULL,
    "sustancia" TEXT NOT NULL,
    "severidad" "SeveridadAlergia" NOT NULL DEFAULT 'LEVE',
    "reaccion" TEXT,
    "fecha_inicio" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Alergia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicacionHabitual" (
    "id" TEXT NOT NULL,
    "historia_id" TEXT NOT NULL,
    "medicamento" TEXT NOT NULL,
    "dosis" TEXT,
    "frecuencia" TEXT,
    "via" TEXT,
    "desde" TIMESTAMP(3),
    "hasta" TIMESTAMP(3),
    "motivo" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "MedicacionHabitual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnostico" (
    "id" TEXT NOT NULL,
    "historia_id" TEXT NOT NULL,
    "evolucion_id" TEXT,
    "cie10" TEXT,
    "descripcion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Diagnostico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicacion" (
    "id" TEXT NOT NULL,
    "historia_id" TEXT NOT NULL,
    "evolucion_id" TEXT,
    "usuario_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visible_paciente" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Indicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estudio" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha_solicitud" TIMESTAMP(3),
    "fecha_resultado" TIMESTAMP(3),
    "resultado_texto" TEXT,
    "documento_id" TEXT,
    "solicitado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Estudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoClinico" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "tipo" "TipoDocumentoClinico" NOT NULL,
    "nombre" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url_publica" TEXT,
    "mime_type" TEXT,
    "tamano_bytes" INTEGER,
    "subido_por_id" TEXT,
    "visible_paciente" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "DocumentoClinico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consentimiento" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "firmado_at" TIMESTAMP(3),
    "documento_url" TEXT,
    "creado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Consentimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comprobante" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "tipo" "TipoComprobante" NOT NULL DEFAULT 'RECIBO',
    "paciente_id" TEXT NOT NULL,
    "turno_id" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'BORRADOR',
    "observaciones" TEXT,
    "creado_por_id" TEXT,
    "anulado_at" TIMESTAMP(3),
    "anulado_motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemComprobante" (
    "id" TEXT NOT NULL,
    "comprobante_id" TEXT NOT NULL,
    "prestacion_id" TEXT,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precio_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemComprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "comprobante_id" TEXT,
    "paciente_id" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "referencia_externa" TEXT,
    "cobertura_id" TEXT,
    "registrado_por_id" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" TEXT NOT NULL,
    "pago_id" TEXT,
    "usuario_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "concepto" TEXT NOT NULL,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deuda" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "comprobante_id" TEXT,
    "monto_original" DECIMAL(12,2) NOT NULL,
    "saldo_actual" DECIMAL(12,2) NOT NULL,
    "fecha_origen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidacion" (
    "id" TEXT NOT NULL,
    "profesional_id" TEXT NOT NULL,
    "periodo_inicio" TIMESTAMP(3) NOT NULL,
    "periodo_fin" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,
    "pagada_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionItem" (
    "id" TEXT NOT NULL,
    "liquidacion_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "comprobante_id" TEXT,

    CONSTRAINT "LiquidacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "stock_actual" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "proveedor" TEXT,
    "precio_unitario" DECIMAL(12,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "motivo_eliminacion" TEXT,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoteInsumo" (
    "id" TEXT NOT NULL,
    "insumo_id" TEXT NOT NULL,
    "numero_lote" TEXT NOT NULL,
    "vencimiento" TIMESTAMP(3),
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoteInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" TEXT NOT NULL,
    "insumo_id" TEXT NOT NULL,
    "lote_id" TEXT,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "observaciones" TEXT,
    "usuario_id" TEXT,
    "prestacion_id" TEXT,
    "turno_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsumoPrestacion" (
    "insumo_id" TEXT NOT NULL,
    "prestacion_id" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "InsumoPrestacion_pkey" PRIMARY KEY ("insumo_id","prestacion_id")
);

-- CreateTable
CREATE TABLE "PlantillaMensaje" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "canal" "CanalComunicacion" NOT NULL,
    "tipo" "TipoComunicacion" NOT NULL,
    "asunto" TEXT,
    "cuerpo" TEXT NOT NULL,
    "variables" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComunicacionPaciente" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "turno_id" TEXT,
    "canal" "CanalComunicacion" NOT NULL,
    "tipo" "TipoComunicacion" NOT NULL,
    "destino" TEXT NOT NULL,
    "asunto" TEXT,
    "cuerpo" TEXT NOT NULL,
    "estado" "EstadoComunicacion" NOT NULL DEFAULT 'PENDIENTE',
    "enviada_at" TIMESTAMP(3),
    "entregada_at" TIMESTAMP(3),
    "leida_at" TIMESTAMP(3),
    "respondida_at" TIMESTAMP(3),
    "error_mensaje" TEXT,
    "external_id" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComunicacionPaciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomatizacionLog" (
    "id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "workflow_id" TEXT,
    "payload" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "error_mensaje" TEXT,
    "duracion_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomatizacionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "accion" "AccionAuditoria" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "descripcion" TEXT,
    "diff" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "contexto" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionClinica" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nombre" TEXT NOT NULL DEFAULT 'Fluxtic Salud',
    "razon_social" TEXT,
    "cuit" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "sitio_web" TEXT,
    "logo_url" TEXT,
    "color_principal" TEXT NOT NULL DEFAULT '#0F766E',
    "color_acento" TEXT NOT NULL DEFAULT '#2563EB',
    "zona_horaria" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionClinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionAgenda" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "duracion_slot_min" INTEGER NOT NULL DEFAULT 30,
    "permite_sobreturnos" BOOLEAN NOT NULL DEFAULT true,
    "permite_lista_espera" BOOLEAN NOT NULL DEFAULT true,
    "anticipacion_min_horas" INTEGER NOT NULL DEFAULT 2,
    "cancelacion_min_horas" INTEGER NOT NULL DEFAULT 24,
    "recordatorio_48h" BOOLEAN NOT NULL DEFAULT true,
    "recordatorio_24h" BOOLEAN NOT NULL DEFAULT true,
    "recordatorio_2h" BOOLEAN NOT NULL DEFAULT false,
    "marcar_no_show_min_minutos" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionFacturacion" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "requiere_sena" BOOLEAN NOT NULL DEFAULT false,
    "monto_sena_default" DECIMAL(12,2),
    "porcentaje_sena" DECIMAL(5,2),
    "acepta_mercadopago" BOOLEAN NOT NULL DEFAULT false,
    "acepta_transferencia" BOOLEAN NOT NULL DEFAULT true,
    "numerador_recibo" INTEGER NOT NULL DEFAULT 1,
    "prefijo_recibo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionFacturacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT,
    "link" TEXT,
    "metadata" TEXT,
    "leida_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPaciente" (
    "id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "proposito" TEXT NOT NULL,
    "usado_at" TIMESTAMP(3),
    "expira_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenPaciente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilProfesional_usuario_id_key" ON "PerfilProfesional"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilProfesional_matricula_key" ON "PerfilProfesional"("matricula");

-- CreateIndex
CREATE INDEX "PerfilProfesional_especialidad_id_idx" ON "PerfilProfesional"("especialidad_id");

-- CreateIndex
CREATE INDEX "Consultorio_sede_id_idx" ON "Consultorio"("sede_id");

-- CreateIndex
CREATE UNIQUE INDEX "Consultorio_sede_id_nombre_key" ON "Consultorio"("sede_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Especialidad_nombre_key" ON "Especialidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Especialidad_codigo_key" ON "Especialidad"("codigo");

-- CreateIndex
CREATE INDEX "HorarioProfesional_profesional_id_dia_semana_idx" ON "HorarioProfesional"("profesional_id", "dia_semana");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_usuario_id_key" ON "Paciente"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_dni_key" ON "Paciente"("dni");

-- CreateIndex
CREATE INDEX "Paciente_apellido_nombre_idx" ON "Paciente"("apellido", "nombre");

-- CreateIndex
CREATE INDEX "Paciente_deleted_at_idx" ON "Paciente"("deleted_at");

-- CreateIndex
CREATE INDEX "ContactoEmergencia_paciente_id_idx" ON "ContactoEmergencia"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "CoberturaMedica_nombre_key" ON "CoberturaMedica"("nombre");

-- CreateIndex
CREATE INDEX "PlanCobertura_cobertura_id_idx" ON "PlanCobertura"("cobertura_id");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCobertura_cobertura_id_nombre_key" ON "PlanCobertura"("cobertura_id", "nombre");

-- CreateIndex
CREATE INDEX "PacienteCobertura_paciente_id_idx" ON "PacienteCobertura"("paciente_id");

-- CreateIndex
CREATE INDEX "PacienteCobertura_cobertura_id_idx" ON "PacienteCobertura"("cobertura_id");

-- CreateIndex
CREATE INDEX "Autorizacion_paciente_id_idx" ON "Autorizacion"("paciente_id");

-- CreateIndex
CREATE INDEX "Autorizacion_estado_idx" ON "Autorizacion"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Prestacion_codigo_key" ON "Prestacion"("codigo");

-- CreateIndex
CREATE INDEX "Prestacion_especialidad_id_idx" ON "Prestacion"("especialidad_id");

-- CreateIndex
CREATE INDEX "Turno_paciente_id_idx" ON "Turno"("paciente_id");

-- CreateIndex
CREATE INDEX "Turno_profesional_id_fecha_hora_idx" ON "Turno"("profesional_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "Turno_sede_id_fecha_hora_idx" ON "Turno"("sede_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "Turno_estado_idx" ON "Turno"("estado");

-- CreateIndex
CREATE INDEX "Turno_deleted_at_idx" ON "Turno"("deleted_at");

-- CreateIndex
CREATE INDEX "CambioEstadoTurno_turno_id_idx" ON "CambioEstadoTurno"("turno_id");

-- CreateIndex
CREATE UNIQUE INDEX "HistoriaClinica_paciente_id_key" ON "HistoriaClinica"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "HistoriaClinica_numero_key" ON "HistoriaClinica"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "EvolucionClinica_turno_id_key" ON "EvolucionClinica"("turno_id");

-- CreateIndex
CREATE INDEX "EvolucionClinica_historia_id_fecha_idx" ON "EvolucionClinica"("historia_id", "fecha");

-- CreateIndex
CREATE INDEX "EvolucionClinica_deleted_at_idx" ON "EvolucionClinica"("deleted_at");

-- CreateIndex
CREATE INDEX "Antecedente_historia_id_tipo_idx" ON "Antecedente"("historia_id", "tipo");

-- CreateIndex
CREATE INDEX "Antecedente_deleted_at_idx" ON "Antecedente"("deleted_at");

-- CreateIndex
CREATE INDEX "Alergia_historia_id_idx" ON "Alergia"("historia_id");

-- CreateIndex
CREATE INDEX "Alergia_deleted_at_idx" ON "Alergia"("deleted_at");

-- CreateIndex
CREATE INDEX "MedicacionHabitual_historia_id_idx" ON "MedicacionHabitual"("historia_id");

-- CreateIndex
CREATE INDEX "MedicacionHabitual_deleted_at_idx" ON "MedicacionHabitual"("deleted_at");

-- CreateIndex
CREATE INDEX "Diagnostico_historia_id_idx" ON "Diagnostico"("historia_id");

-- CreateIndex
CREATE INDEX "Diagnostico_cie10_idx" ON "Diagnostico"("cie10");

-- CreateIndex
CREATE INDEX "Diagnostico_deleted_at_idx" ON "Diagnostico"("deleted_at");

-- CreateIndex
CREATE INDEX "Indicacion_historia_id_idx" ON "Indicacion"("historia_id");

-- CreateIndex
CREATE INDEX "Indicacion_deleted_at_idx" ON "Indicacion"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Estudio_documento_id_key" ON "Estudio"("documento_id");

-- CreateIndex
CREATE INDEX "Estudio_paciente_id_idx" ON "Estudio"("paciente_id");

-- CreateIndex
CREATE INDEX "Estudio_deleted_at_idx" ON "Estudio"("deleted_at");

-- CreateIndex
CREATE INDEX "DocumentoClinico_paciente_id_tipo_idx" ON "DocumentoClinico"("paciente_id", "tipo");

-- CreateIndex
CREATE INDEX "DocumentoClinico_deleted_at_idx" ON "DocumentoClinico"("deleted_at");

-- CreateIndex
CREATE INDEX "Consentimiento_paciente_id_idx" ON "Consentimiento"("paciente_id");

-- CreateIndex
CREATE INDEX "Consentimiento_deleted_at_idx" ON "Consentimiento"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Comprobante_numero_key" ON "Comprobante"("numero");

-- CreateIndex
CREATE INDEX "Comprobante_paciente_id_idx" ON "Comprobante"("paciente_id");

-- CreateIndex
CREATE INDEX "Comprobante_fecha_idx" ON "Comprobante"("fecha");

-- CreateIndex
CREATE INDEX "Comprobante_estado_idx" ON "Comprobante"("estado");

-- CreateIndex
CREATE INDEX "Comprobante_deleted_at_idx" ON "Comprobante"("deleted_at");

-- CreateIndex
CREATE INDEX "ItemComprobante_comprobante_id_idx" ON "ItemComprobante"("comprobante_id");

-- CreateIndex
CREATE INDEX "Pago_paciente_id_idx" ON "Pago"("paciente_id");

-- CreateIndex
CREATE INDEX "Pago_fecha_idx" ON "Pago"("fecha");

-- CreateIndex
CREATE INDEX "Pago_deleted_at_idx" ON "Pago"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoCaja_pago_id_key" ON "MovimientoCaja"("pago_id");

-- CreateIndex
CREATE INDEX "MovimientoCaja_fecha_idx" ON "MovimientoCaja"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Deuda_comprobante_id_key" ON "Deuda"("comprobante_id");

-- CreateIndex
CREATE INDEX "Deuda_paciente_id_idx" ON "Deuda"("paciente_id");

-- CreateIndex
CREATE INDEX "Liquidacion_profesional_id_idx" ON "Liquidacion"("profesional_id");

-- CreateIndex
CREATE INDEX "LiquidacionItem_liquidacion_id_idx" ON "LiquidacionItem"("liquidacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "Insumo_codigo_key" ON "Insumo"("codigo");

-- CreateIndex
CREATE INDEX "Insumo_deleted_at_idx" ON "Insumo"("deleted_at");

-- CreateIndex
CREATE INDEX "LoteInsumo_vencimiento_idx" ON "LoteInsumo"("vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "LoteInsumo_insumo_id_numero_lote_key" ON "LoteInsumo"("insumo_id", "numero_lote");

-- CreateIndex
CREATE INDEX "MovimientoStock_insumo_id_created_at_idx" ON "MovimientoStock"("insumo_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaMensaje_codigo_key" ON "PlantillaMensaje"("codigo");

-- CreateIndex
CREATE INDEX "ComunicacionPaciente_paciente_id_idx" ON "ComunicacionPaciente"("paciente_id");

-- CreateIndex
CREATE INDEX "ComunicacionPaciente_turno_id_idx" ON "ComunicacionPaciente"("turno_id");

-- CreateIndex
CREATE INDEX "ComunicacionPaciente_estado_idx" ON "ComunicacionPaciente"("estado");

-- CreateIndex
CREATE INDEX "AutomatizacionLog_evento_idx" ON "AutomatizacionLog"("evento");

-- CreateIndex
CREATE INDEX "AutomatizacionLog_created_at_idx" ON "AutomatizacionLog"("created_at");

-- CreateIndex
CREATE INDEX "AuditLog_entidad_entidad_id_idx" ON "AuditLog"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "AuditLog_usuario_id_created_at_idx" ON "AuditLog"("usuario_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_accion_created_at_idx" ON "AuditLog"("accion", "created_at");

-- CreateIndex
CREATE INDEX "Notificacion_usuario_id_leida_at_idx" ON "Notificacion"("usuario_id", "leida_at");

-- CreateIndex
CREATE INDEX "Notificacion_created_at_idx" ON "Notificacion"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPaciente_token_key" ON "TokenPaciente"("token");

-- CreateIndex
CREATE INDEX "TokenPaciente_paciente_id_idx" ON "TokenPaciente"("paciente_id");

-- CreateIndex
CREATE INDEX "TokenPaciente_token_idx" ON "TokenPaciente"("token");

-- AddForeignKey
ALTER TABLE "PerfilProfesional" ADD CONSTRAINT "PerfilProfesional_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilProfesional" ADD CONSTRAINT "PerfilProfesional_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "Especialidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultorio" ADD CONSTRAINT "Consultorio_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfesionalSede" ADD CONSTRAINT "ProfesionalSede_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "PerfilProfesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfesionalSede" ADD CONSTRAINT "ProfesionalSede_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioProfesional" ADD CONSTRAINT "HorarioProfesional_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "PerfilProfesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactoEmergencia" ADD CONSTRAINT "ContactoEmergencia_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCobertura" ADD CONSTRAINT "PlanCobertura_cobertura_id_fkey" FOREIGN KEY ("cobertura_id") REFERENCES "CoberturaMedica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacienteCobertura" ADD CONSTRAINT "PacienteCobertura_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacienteCobertura" ADD CONSTRAINT "PacienteCobertura_cobertura_id_fkey" FOREIGN KEY ("cobertura_id") REFERENCES "CoberturaMedica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacienteCobertura" ADD CONSTRAINT "PacienteCobertura_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "PlanCobertura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacion" ADD CONSTRAINT "Autorizacion_cobertura_id_fkey" FOREIGN KEY ("cobertura_id") REFERENCES "CoberturaMedica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacion" ADD CONSTRAINT "Autorizacion_prestacion_id_fkey" FOREIGN KEY ("prestacion_id") REFERENCES "Prestacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prestacion" ADD CONSTRAINT "Prestacion_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "Especialidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfesionalPrestacion" ADD CONSTRAINT "ProfesionalPrestacion_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "PerfilProfesional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfesionalPrestacion" ADD CONSTRAINT "ProfesionalPrestacion_prestacion_id_fkey" FOREIGN KEY ("prestacion_id") REFERENCES "Prestacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "PerfilProfesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_prestacion_id_fkey" FOREIGN KEY ("prestacion_id") REFERENCES "Prestacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_consultorio_id_fkey" FOREIGN KEY ("consultorio_id") REFERENCES "Consultorio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioEstadoTurno" ADD CONSTRAINT "CambioEstadoTurno_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "Turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriaClinica" ADD CONSTRAINT "HistoriaClinica_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolucionClinica" ADD CONSTRAINT "EvolucionClinica_historia_id_fkey" FOREIGN KEY ("historia_id") REFERENCES "HistoriaClinica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolucionClinica" ADD CONSTRAINT "EvolucionClinica_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolucionClinica" ADD CONSTRAINT "EvolucionClinica_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "PerfilProfesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolucionClinica" ADD CONSTRAINT "EvolucionClinica_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antecedente" ADD CONSTRAINT "Antecedente_historia_id_fkey" FOREIGN KEY ("historia_id") REFERENCES "HistoriaClinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alergia" ADD CONSTRAINT "Alergia_historia_id_fkey" FOREIGN KEY ("historia_id") REFERENCES "HistoriaClinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicacionHabitual" ADD CONSTRAINT "MedicacionHabitual_historia_id_fkey" FOREIGN KEY ("historia_id") REFERENCES "HistoriaClinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostico" ADD CONSTRAINT "Diagnostico_historia_id_fkey" FOREIGN KEY ("historia_id") REFERENCES "HistoriaClinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostico" ADD CONSTRAINT "Diagnostico_evolucion_id_fkey" FOREIGN KEY ("evolucion_id") REFERENCES "EvolucionClinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicacion" ADD CONSTRAINT "Indicacion_historia_id_fkey" FOREIGN KEY ("historia_id") REFERENCES "HistoriaClinica"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicacion" ADD CONSTRAINT "Indicacion_evolucion_id_fkey" FOREIGN KEY ("evolucion_id") REFERENCES "EvolucionClinica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Indicacion" ADD CONSTRAINT "Indicacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudio" ADD CONSTRAINT "Estudio_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudio" ADD CONSTRAINT "Estudio_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "DocumentoClinico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoClinico" ADD CONSTRAINT "DocumentoClinico_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoClinico" ADD CONSTRAINT "DocumentoClinico_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consentimiento" ADD CONSTRAINT "Consentimiento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consentimiento" ADD CONSTRAINT "Consentimiento_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemComprobante" ADD CONSTRAINT "ItemComprobante_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemComprobante" ADD CONSTRAINT "ItemComprobante_prestacion_id_fkey" FOREIGN KEY ("prestacion_id") REFERENCES "Prestacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "Comprobante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deuda" ADD CONSTRAINT "Deuda_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deuda" ADD CONSTRAINT "Deuda_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "Comprobante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "PerfilProfesional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionItem" ADD CONSTRAINT "LiquidacionItem_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "Liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteInsumo" ADD CONSTRAINT "LoteInsumo_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsumoPrestacion" ADD CONSTRAINT "InsumoPrestacion_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsumoPrestacion" ADD CONSTRAINT "InsumoPrestacion_prestacion_id_fkey" FOREIGN KEY ("prestacion_id") REFERENCES "Prestacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicacionPaciente" ADD CONSTRAINT "ComunicacionPaciente_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComunicacionPaciente" ADD CONSTRAINT "ComunicacionPaciente_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "Turno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

