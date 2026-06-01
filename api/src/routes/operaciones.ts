/**
 * Centro de Operaciones — endpoint agregador para secretaría.
 *
 * Devuelve en una sola llamada todo lo que la pantalla `/admin/operaciones`
 * necesita: KPIs del día, turnos con flags operativos (deuda, cobertura,
 * recordatorio, médico atrasado) y estado de cada consultorio (libre/ocupado/
 * demorado, paciente actual y próximo).
 *
 * Se apoya en endpoints existentes para transiciones de estado
 * (`POST /turnos/:id/estado`) — esta ruta solo consolida lectura.
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { parseOrFail } from '../lib/zod-helpers'

const querySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sede_id: z.string().optional(),
  profesional_id: z.string().optional(),
  consultorio_id: z.string().optional(),
  estado: z.string().optional(), // CSV: PENDIENTE,CONFIRMADO,...
})

export async function operacionesRoutes(app: FastifyInstance) {
  app.get('/dia', async (req) => {
    const user = req.requirePermiso('agenda:ver', { flexible: true })
    const q = parseOrFail(querySchema, req.query ?? {})

    // Rango del día en TZ del servidor (clínicas operan en horario local)
    const fechaStr = q.fecha ?? new Date().toISOString().slice(0, 10)
    const desde = new Date(`${fechaStr}T00:00:00`)
    const hasta = new Date(`${fechaStr}T23:59:59.999`)

    const estadosFiltro = q.estado
      ? q.estado.split(',').map((s) => s.trim()).filter(Boolean)
      : null

    const where: any = {
      fecha_hora: { gte: desde, lte: hasta },
      deleted_at: null,
    }
    if (q.sede_id) where.sede_id = q.sede_id
    if (q.profesional_id) where.profesional_id = q.profesional_id
    if (q.consultorio_id) where.consultorio_id = q.consultorio_id
    if (estadosFiltro) where.estado = { in: estadosFiltro as any }

    // Médico solo ve sus turnos (consistente con /turnos)
    if (user.rol === 'MEDICO' && user.perfil_profesional_id) {
      where.profesional_id = user.perfil_profesional_id
    }

    const [turnos, sedes, profesionales, consultorios] = await Promise.all([
      prisma.turno.findMany({
        where,
        include: {
          paciente: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              dni: true,
              telefono: true,
              email: true,
              observaciones: true,
              coberturas: {
                where: { activa: true, principal: true },
                include: { cobertura: { select: { id: true, nombre: true, tipo: true } } },
                take: 1,
              },
              deudas: { select: { saldo_actual: true } },
            },
          },
          profesional: {
            include: {
              usuario: { select: { nombre: true, apellido: true } },
              especialidad: { select: { id: true, nombre: true } },
            },
          },
          prestacion: { select: { id: true, nombre: true, duracion_min: true, precio_particular: true } },
          sede: { select: { id: true, nombre: true } },
          consultorio: { select: { id: true, nombre: true, numero: true } },
          comprobantes: {
            where: { deleted_at: null },
            select: { id: true, numero: true, total: true, saldo: true, estado: true },
          },
          comunicaciones: {
            where: { tipo: { in: ['CONFIRMACION_TURNO', 'RECORDATORIO_24H', 'RECORDATORIO_2H'] } },
            select: { tipo: true, estado: true, enviada_at: true },
            orderBy: { created_at: 'desc' },
            take: 5,
          },
        },
        orderBy: { fecha_hora: 'asc' },
      }),
      prisma.sede.findMany({ where: { activa: true }, select: { id: true, nombre: true } }),
      prisma.perfilProfesional.findMany({
        include: {
          usuario: { select: { nombre: true, apellido: true } },
          especialidad: { select: { id: true, nombre: true } },
        },
      }),
      prisma.consultorio.findMany({
        where: {
          activo: true,
          ...(q.sede_id ? { sede_id: q.sede_id } : {}),
        },
        select: { id: true, nombre: true, numero: true, sede_id: true },
      }),
    ])

    const ahora = new Date()

    const turnosEnriquecidos = turnos.map((t) => {
      const cobertura = t.paciente.coberturas[0] ?? null
      const deudaSaldo = t.paciente.deudas.reduce(
        (s, d) => s + Number(d.saldo_actual ?? 0),
        0,
      )
      const comprobanteAbierto = t.comprobantes.find((c) => Number(c.saldo ?? 0) > 0)
      const saldoComprobante = comprobanteAbierto ? Number(comprobanteAbierto.saldo) : 0
      const minutosHastaTurno = Math.round((t.fecha_hora.getTime() - ahora.getTime()) / 60000)
      const horaPasada = minutosHastaTurno < 0

      const flags = {
        sin_confirmar: t.estado === 'PENDIENTE' && minutosHastaTurno < 24 * 60,
        sin_cobertura: !cobertura,
        con_deuda: deudaSaldo > 0,
        con_saldo_comprobante: saldoComprobante > 0,
        recordatorio_no_enviado:
          !t.recordatorio_24h_enviado &&
          minutosHastaTurno > 0 &&
          minutosHastaTurno < 48 * 60 &&
          (t.estado === 'PENDIENTE' || t.estado === 'CONFIRMADO'),
        medico_atrasado:
          (t.estado === 'CONFIRMADO' && horaPasada && minutosHastaTurno < -10) ||
          (t.estado === 'EN_SALA_ESPERA' &&
            t.ingreso_sala_at &&
            (ahora.getTime() - t.ingreso_sala_at.getTime()) / 60000 > 15),
        copago_pendiente:
          t.requiere_copago &&
          t.metodo_copago !== 'SIN_COPAGO' &&
          !comprobanteAbierto,
      }

      return {
        id: t.id,
        fecha_hora: t.fecha_hora,
        duracion_min: t.duracion_min,
        estado: t.estado,
        modalidad: t.modalidad,
        sobreturno: t.sobreturno,
        motivo_consulta: t.motivo_consulta,
        observaciones: t.observaciones,
        mensaje_interno: t.mensaje_interno,
        ingreso_sala_at: t.ingreso_sala_at,
        inicio_atencion_at: t.inicio_atencion_at,
        fin_atencion_at: t.fin_atencion_at,
        cancelado_motivo: t.cancelado_motivo,
        paciente: {
          id: t.paciente.id,
          nombre: t.paciente.nombre,
          apellido: t.paciente.apellido,
          dni: t.paciente.dni,
          telefono: t.paciente.telefono,
          email: t.paciente.email,
          observaciones: t.paciente.observaciones,
        },
        profesional: {
          id: t.profesional.id,
          nombre: `${t.profesional.usuario.nombre} ${t.profesional.usuario.apellido ?? ''}`.trim(),
          color: t.profesional.color_agenda,
          especialidad: t.profesional.especialidad?.nombre ?? null,
        },
        prestacion: t.prestacion
          ? { id: t.prestacion.id, nombre: t.prestacion.nombre, duracion_min: t.prestacion.duracion_min }
          : null,
        sede: t.sede,
        consultorio: t.consultorio,
        cobertura: cobertura
          ? {
              nombre: cobertura.cobertura.nombre,
              tipo: cobertura.cobertura.tipo,
              numero_afiliado: cobertura.numero_afiliado,
            }
          : null,
        deuda_saldo: deudaSaldo,
        comprobante_saldo: saldoComprobante,
        comprobante_id: comprobanteAbierto?.id ?? null,
        comunicaciones: t.comunicaciones,
        flags,
        minutos_hasta_turno: minutosHastaTurno,
      }
    })

    // KPIs del día
    const porEstado: Record<string, number> = {}
    for (const t of turnosEnriquecidos) porEstado[t.estado] = (porEstado[t.estado] ?? 0) + 1
    const total = turnosEnriquecidos.length
    const atendidos = porEstado['ATENDIDO'] ?? 0
    const ausentes = porEstado['AUSENTE'] ?? 0
    const cancelados = porEstado['CANCELADO'] ?? 0
    const cerrados = atendidos + ausentes + cancelados
    const ausentismoPct = cerrados > 0 ? Math.round((ausentes / cerrados) * 100) : 0

    // Demora promedio (ingreso_sala → inicio_atencion) sobre los turnos del día
    const demoras = turnosEnriquecidos
      .filter((t) => t.ingreso_sala_at && t.inicio_atencion_at)
      .map(
        (t) =>
          (new Date(t.inicio_atencion_at!).getTime() -
            new Date(t.ingreso_sala_at!).getTime()) /
          60000,
      )
    const demoraPromedio =
      demoras.length > 0 ? Math.round(demoras.reduce((s, n) => s + n, 0) / demoras.length) : null

    const saldoPendienteTotal = turnosEnriquecidos.reduce(
      (s, t) => s + t.deuda_saldo + t.comprobante_saldo,
      0,
    )

    // Estado de consultorios — derivado de turnos del día
    const consultoriosEstado = consultorios.map((c) => {
      const turnosConsult = turnosEnriquecidos.filter((t) => t.consultorio?.id === c.id)
      const enAtencion = turnosConsult.find((t) => t.estado === 'EN_ATENCION')
      const enEspera = turnosConsult.filter((t) => t.estado === 'EN_SALA_ESPERA')
      const proximo = turnosConsult.find(
        (t) =>
          (t.estado === 'CONFIRMADO' || t.estado === 'PENDIENTE') &&
          new Date(t.fecha_hora).getTime() > ahora.getTime(),
      )
      const ultimoAtendido = [...turnosConsult]
        .reverse()
        .find((t) => t.estado === 'ATENDIDO')

      let estadoConsult: 'LIBRE' | 'OCUPADO' | 'DEMORADO' | 'INACTIVO' = 'LIBRE'
      let demoraMin: number | null = null
      if (enAtencion) {
        estadoConsult = 'OCUPADO'
        if (enAtencion.inicio_atencion_at) {
          const programado = new Date(enAtencion.fecha_hora).getTime()
          const real = new Date(enAtencion.inicio_atencion_at).getTime()
          demoraMin = Math.max(0, Math.round((real - programado) / 60000))
          if (demoraMin > 15) estadoConsult = 'DEMORADO'
        }
      } else if (enEspera.length > 0) {
        const espera = enEspera[0]
        if (espera.ingreso_sala_at) {
          demoraMin = Math.round(
            (ahora.getTime() - new Date(espera.ingreso_sala_at).getTime()) / 60000,
          )
          estadoConsult = demoraMin > 15 ? 'DEMORADO' : 'OCUPADO'
        }
      } else if (turnosConsult.length === 0) {
        estadoConsult = 'INACTIVO'
      }

      const medico = enAtencion?.profesional ?? proximo?.profesional ?? ultimoAtendido?.profesional ?? null

      return {
        id: c.id,
        nombre: c.nombre,
        numero: c.numero,
        sede_id: c.sede_id,
        estado: estadoConsult,
        demora_min: demoraMin,
        medico_actual: medico,
        paciente_actual: enAtencion
          ? {
              id: enAtencion.paciente.id,
              nombre: `${enAtencion.paciente.nombre} ${enAtencion.paciente.apellido}`,
              turno_id: enAtencion.id,
              inicio_atencion_at: enAtencion.inicio_atencion_at,
            }
          : null,
        proximo_paciente: proximo
          ? {
              id: proximo.paciente.id,
              nombre: `${proximo.paciente.nombre} ${proximo.paciente.apellido}`,
              turno_id: proximo.id,
              fecha_hora: proximo.fecha_hora,
            }
          : null,
        en_espera_count: enEspera.length,
        turnos_dia_count: turnosConsult.length,
      }
    })

    return {
      fecha: fechaStr,
      kpis: {
        total,
        por_estado: porEstado,
        ausentismo_pct: ausentismoPct,
        demora_promedio_min: demoraPromedio,
        saldo_pendiente_total: saldoPendienteTotal,
        sin_confirmar: turnosEnriquecidos.filter((t) => t.flags.sin_confirmar).length,
        con_deuda: turnosEnriquecidos.filter((t) => t.flags.con_deuda).length,
        con_alerta:
          turnosEnriquecidos.filter(
            (t) => t.flags.medico_atrasado || t.flags.copago_pendiente,
          ).length,
      },
      turnos: turnosEnriquecidos,
      consultorios: consultoriosEstado,
      sedes,
      profesionales: profesionales.map((p) => ({
        id: p.id,
        nombre: `${p.usuario.nombre} ${p.usuario.apellido ?? ''}`.trim(),
        especialidad: p.especialidad?.nombre ?? null,
        color: p.color_agenda,
      })),
    }
  })
}
