/**
 * Seed Etapa 1 — Fluxtic Salud
 * Idempotente: usa upsert por campo natural donde es posible.
 *
 * Datos de demo:
 *  - 5 usuarios demo (admin, recepción, médico, facturación, paciente)
 *  - 2 sedes (Centro y Zona Norte), 3 consultorios cada una
 *  - 3 especialidades, 5 prestaciones
 *  - 4 profesionales con perfil + horarios + sedes
 *  - 5 obras sociales con 2 planes cada una
 *  - 10 pacientes (incluyendo el del usuario demo)
 *  - 20 turnos distribuidos en los próximos 7 días
 *  - Configuración singleton de la clínica
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PWD_DEFAULT = 'Salud2026!'

async function main() {
  console.log('🌱 Seeding Fluxtic Salud...')

  // ── Singletons de configuración ──────────────────────────────
  await prisma.configuracionClinica.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', nombre: 'Clínica Demo Fluxtic Salud', telefono: '+54 11 5555-0000', email: 'contacto@clinica.demo' },
    update: {},
  })
  await prisma.configuracionAgenda.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
  await prisma.configuracionFacturacion.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', acepta_transferencia: true },
    update: {},
  })

  // ── Plantillas de mensajes (WhatsApp) ────────────────────────
  const plantillas = [
    {
      codigo: 'wa_confirmacion_turno',
      canal: 'WHATSAPP' as const,
      tipo: 'CONFIRMACION_TURNO' as const,
      asunto: null,
      cuerpo: 'Hola {{nombre}} 👋 Confirmamos tu turno con {{profesional}} ({{especialidad}}) el *{{fecha}}* a las *{{hora}}* en {{sede}}. Si no podés asistir respondé *CANCELAR*.',
      variables: ['nombre', 'profesional', 'especialidad', 'fecha', 'hora', 'sede'],
    },
    {
      codigo: 'wa_recordatorio_48h',
      canal: 'WHATSAPP' as const,
      tipo: 'RECORDATORIO_48H' as const,
      asunto: null,
      cuerpo: 'Hola {{nombre}}, te recordamos tu turno con {{profesional}} en 48 hs, el {{fecha}} a las {{hora}}.',
      variables: ['nombre', 'profesional', 'fecha', 'hora'],
    },
    {
      codigo: 'wa_recordatorio_24h',
      canal: 'WHATSAPP' as const,
      tipo: 'RECORDATORIO_24H' as const,
      asunto: null,
      cuerpo: 'Hola {{nombre}} 😊 Mañana a las {{hora}} tenés turno con {{profesional}} en {{sede}}. Respondé *SI* para confirmar o *NO* para cancelar.',
      variables: ['nombre', 'profesional', 'sede', 'hora'],
    },
    {
      codigo: 'wa_recordatorio_2h',
      canal: 'WHATSAPP' as const,
      tipo: 'RECORDATORIO_2H' as const,
      asunto: null,
      cuerpo: 'Hola {{nombre}}, te esperamos en {{sede_direccion}} en 2 hs para tu turno con {{profesional}}.',
      variables: ['nombre', 'profesional', 'sede_direccion'],
    },
    {
      codigo: 'wa_preparacion_previa',
      canal: 'WHATSAPP' as const,
      tipo: 'PREPARACION_PREVIA' as const,
      asunto: null,
      cuerpo: 'Hola {{nombre}}, para tu {{prestacion}} del {{fecha}} es importante que: {{instrucciones_preparacion}}',
      variables: ['nombre', 'prestacion', 'fecha', 'instrucciones_preparacion'],
    },
    {
      codigo: 'wa_postconsulta',
      canal: 'WHATSAPP' as const,
      tipo: 'POSTCONSULTA' as const,
      asunto: null,
      cuerpo: 'Hola {{nombre}}, ¿cómo te sentís después de tu consulta con {{profesional}}? Si tenés dudas sobre las indicaciones podés responder este mensaje.',
      variables: ['nombre', 'profesional'],
    },
    {
      codigo: 'wa_pago_pendiente',
      canal: 'WHATSAPP' as const,
      tipo: 'PAGO_PENDIENTE' as const,
      asunto: null,
      cuerpo: 'Hola {{nombre}}, para confirmar tu turno necesitamos el pago de seña de ${{monto}}. Podés pagarlo acá: {{init_point}}',
      variables: ['nombre', 'monto', 'init_point'],
    },
    {
      codigo: 'wa_confirmacion_pago',
      canal: 'WHATSAPP' as const,
      tipo: 'CONFIRMACION_PAGO' as const,
      asunto: null,
      cuerpo: '✅ Recibimos tu pago. Tu turno con {{profesional}} del {{fecha}} {{hora}} quedó confirmado.',
      variables: ['profesional', 'fecha', 'hora'],
    },
    {
      codigo: 'wa_reactivacion',
      canal: 'WHATSAPP' as const,
      tipo: 'REACTIVACION' as const,
      asunto: null,
      cuerpo: 'Hola {{nombre}} 💙 Hace tiempo no te vemos por la clínica. ¿Querés agendar un chequeo? Respondé este mensaje o ingresá a {{link_portal}}.',
      variables: ['nombre', 'link_portal'],
    },
  ]
  for (const p of plantillas) {
    const { variables, ...rest } = p
    await prisma.plantillaMensaje.upsert({
      where: { codigo: p.codigo },
      create: { ...rest, variables: JSON.stringify(variables) },
      update: {},
    })
  }

  // ── Especialidades ───────────────────────────────────────────
  const esp = {
    clinica: await prisma.especialidad.upsert({
      where: { nombre: 'Clínica Médica' },
      create: { nombre: 'Clínica Médica', codigo: 'CLI' },
      update: {},
    }),
    cardiologia: await prisma.especialidad.upsert({
      where: { nombre: 'Cardiología' },
      create: { nombre: 'Cardiología', codigo: 'CAR' },
      update: {},
    }),
    pediatria: await prisma.especialidad.upsert({
      where: { nombre: 'Pediatría' },
      create: { nombre: 'Pediatría', codigo: 'PED' },
      update: {},
    }),
  }

  // ── Sedes y consultorios ─────────────────────────────────────
  const sedeExistsCentro = await prisma.sede.findFirst({ where: { nombre: 'Sede Centro' } })
  const sedeCentro = sedeExistsCentro
    ?? await prisma.sede.create({
      data: {
        nombre: 'Sede Centro',
        direccion: 'Av. Corrientes 1234',
        ciudad: 'Buenos Aires',
        provincia: 'CABA',
        telefono: '+54 11 4321-0000',
        email: 'centro@clinica.demo',
      },
    })

  const sedeExistsNorte = await prisma.sede.findFirst({ where: { nombre: 'Sede Norte' } })
  const sedeNorte = sedeExistsNorte
    ?? await prisma.sede.create({
      data: {
        nombre: 'Sede Norte',
        direccion: 'Av. Cabildo 4567',
        ciudad: 'Buenos Aires',
        provincia: 'CABA',
        telefono: '+54 11 4321-1111',
        email: 'norte@clinica.demo',
      },
    })

  const consultoriosData = [
    { sede_id: sedeCentro.id, nombre: 'Consultorio 1', numero: '101' },
    { sede_id: sedeCentro.id, nombre: 'Consultorio 2', numero: '102' },
    { sede_id: sedeCentro.id, nombre: 'Consultorio 3', numero: '103' },
    { sede_id: sedeNorte.id, nombre: 'Consultorio 1', numero: '201' },
    { sede_id: sedeNorte.id, nombre: 'Consultorio 2', numero: '202' },
    { sede_id: sedeNorte.id, nombre: 'Consultorio 3', numero: '203' },
  ]
  const consultorios = await Promise.all(
    consultoriosData.map((c) =>
      prisma.consultorio.upsert({
        where: { sede_id_nombre: { sede_id: c.sede_id, nombre: c.nombre } },
        create: c,
        update: {},
      }),
    ),
  )

  // ── Prestaciones ─────────────────────────────────────────────
  const prestacionesData = [
    { codigo: 'CON-CLI', nombre: 'Consulta clínica', especialidad_id: esp.clinica.id, duracion_min: 30, precio_particular: 8000 },
    { codigo: 'CON-CAR', nombre: 'Consulta cardiológica', especialidad_id: esp.cardiologia.id, duracion_min: 45, precio_particular: 12000 },
    { codigo: 'CON-PED', nombre: 'Consulta pediátrica', especialidad_id: esp.pediatria.id, duracion_min: 30, precio_particular: 9000 },
    { codigo: 'ECG', nombre: 'Electrocardiograma', especialidad_id: esp.cardiologia.id, duracion_min: 20, precio_particular: 6000, requiere_preparacion: true, instrucciones_preparacion: 'Concurrir sin lociones ni cremas en el pecho.' },
    { codigo: 'CTR-PED', nombre: 'Control pediátrico de niño sano', especialidad_id: esp.pediatria.id, duracion_min: 40, precio_particular: 10000 },
  ]
  const prestaciones = await Promise.all(
    prestacionesData.map((p) =>
      prisma.prestacion.upsert({
        where: { codigo: p.codigo },
        create: { ...p, precio_particular: p.precio_particular as any },
        update: {},
      }),
    ),
  )

  // ── Coberturas y planes ──────────────────────────────────────
  const coberturasData = [
    { nombre: 'OSDE', tipo: 'PREPAGA' as const },
    { nombre: 'Swiss Medical', tipo: 'PREPAGA' as const },
    { nombre: 'Galeno', tipo: 'PREPAGA' as const },
    { nombre: 'IOMA', tipo: 'OBRA_SOCIAL' as const },
    { nombre: 'PAMI', tipo: 'OBRA_SOCIAL' as const },
  ]
  const coberturas = await Promise.all(
    coberturasData.map((c) =>
      prisma.coberturaMedica.upsert({
        where: { nombre: c.nombre },
        create: c,
        update: {},
      }),
    ),
  )
  for (const c of coberturas) {
    for (const planNombre of ['Plan 210', 'Plan 410']) {
      await prisma.planCobertura.upsert({
        where: { cobertura_id_nombre: { cobertura_id: c.id, nombre: planNombre } },
        create: { cobertura_id: c.id, nombre: planNombre, porcentaje_cobertura: 80 as any },
        update: {},
      })
    }
  }

  // ── Usuarios demo ────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(PWD_DEFAULT, 10)
  const usuariosBase = [
    { email: 'admin@clinica.com',       nombre: 'Admin',        apellido: 'General',     rol: 'ADMIN_GENERAL' as const, es_profesional: false, es_paciente: false },
    { email: 'recepcion@clinica.com',   nombre: 'Recepción',    apellido: 'Demo',        rol: 'RECEPCION' as const,     es_profesional: false, es_paciente: false },
    { email: 'facturacion@clinica.com', nombre: 'Facturación',  apellido: 'Demo',        rol: 'FACTURACION' as const,   es_profesional: false, es_paciente: false },
    { email: 'medico@clinica.com',      nombre: 'Carlos',       apellido: 'Méndez',      rol: 'MEDICO' as const,        es_profesional: true,  es_paciente: false },
    { email: 'paciente@clinica.com',    nombre: 'Lucía',        apellido: 'Pérez',       rol: 'PACIENTE' as const,      es_profesional: false, es_paciente: true },
  ]
  const usuariosCreados = await Promise.all(
    usuariosBase.map((u) =>
      prisma.usuario.upsert({
        where: { email: u.email },
        create: { ...u, password: passwordHash },
        update: { rol: u.rol, es_profesional: u.es_profesional, es_paciente: u.es_paciente },
      }),
    ),
  )
  const userMedico    = usuariosCreados.find((u) => u.email === 'medico@clinica.com')!
  const userPaciente  = usuariosCreados.find((u) => u.email === 'paciente@clinica.com')!

  // ── Profesionales (incluye al médico demo) ───────────────────
  const usuariosProfData = [
    { email: 'medico@clinica.com',       matricula: 'MN-12345', especialidad_id: esp.clinica.id,     subespecialidad: null,            duracion: 30 },
    { email: 'cardio@clinica.com',       matricula: 'MN-22001', especialidad_id: esp.cardiologia.id, subespecialidad: 'Hemodinamia',   duracion: 45 },
    { email: 'pediatra@clinica.com',     matricula: 'MN-33445', especialidad_id: esp.pediatria.id,   subespecialidad: null,            duracion: 30 },
    { email: 'clinica2@clinica.com',     matricula: 'MN-15678', especialidad_id: esp.clinica.id,     subespecialidad: null,            duracion: 30 },
  ]
  for (const p of usuariosProfData) {
    if (p.email !== 'medico@clinica.com') {
      await prisma.usuario.upsert({
        where: { email: p.email },
        create: {
          email: p.email,
          password: passwordHash,
          nombre: p.email.split('@')[0].charAt(0).toUpperCase() + p.email.split('@')[0].slice(1),
          apellido: 'Demo',
          rol: 'MEDICO',
          es_profesional: true,
        },
        update: {},
      })
    }
  }

  const profesionales: Array<{ id: string; especialidad_id: string }> = []
  for (const p of usuariosProfData) {
    const u = await prisma.usuario.findUnique({ where: { email: p.email } })
    if (!u) continue
    const perfil = await prisma.perfilProfesional.upsert({
      where: { usuario_id: u.id },
      create: {
        usuario_id: u.id,
        matricula: p.matricula,
        especialidad_id: p.especialidad_id,
        subespecialidad: p.subespecialidad,
        duracion_consulta_min: p.duracion,
      },
      update: { especialidad_id: p.especialidad_id, duracion_consulta_min: p.duracion },
    })
    profesionales.push({ id: perfil.id, especialidad_id: p.especialidad_id })

    // Asignar a ambas sedes
    for (const sede of [sedeCentro, sedeNorte]) {
      await prisma.profesionalSede.upsert({
        where: { profesional_id_sede_id: { profesional_id: perfil.id, sede_id: sede.id } },
        create: { profesional_id: perfil.id, sede_id: sede.id },
        update: {},
      })
    }

    // Horarios: lunes a viernes 9-13 y 14-18 en Centro
    const existingHorarios = await prisma.horarioProfesional.count({ where: { profesional_id: perfil.id } })
    if (existingHorarios === 0) {
      for (let dia = 1; dia <= 5; dia++) {
        await prisma.horarioProfesional.createMany({
          data: [
            { profesional_id: perfil.id, sede_id: sedeCentro.id, dia_semana: dia, hora_inicio: '09:00', hora_fin: '13:00' },
            { profesional_id: perfil.id, sede_id: sedeCentro.id, dia_semana: dia, hora_inicio: '14:00', hora_fin: '18:00' },
          ],
        })
      }
    }

    // Asignar prestaciones según especialidad
    const prestacionesEsp = prestaciones.filter((pr) => pr.especialidad_id === p.especialidad_id)
    for (const pr of prestacionesEsp) {
      await prisma.profesionalPrestacion.upsert({
        where: { profesional_id_prestacion_id: { profesional_id: perfil.id, prestacion_id: pr.id } },
        create: { profesional_id: perfil.id, prestacion_id: pr.id },
        update: {},
      })
    }
  }

  // ── Pacientes ────────────────────────────────────────────────
  const pacientesData = [
    { dni: '28456789', nombre: 'Lucía',     apellido: 'Pérez',     sexo: 'FEMENINO' as const, telefono: '+54 9 11 5555-0001', email: 'paciente@clinica.com', usuario_id: userPaciente.id },
    { dni: '32145678', nombre: 'Juan',      apellido: 'García',    sexo: 'MASCULINO' as const, telefono: '+54 9 11 5555-0002' },
    { dni: '35678910', nombre: 'María',     apellido: 'Rodríguez', sexo: 'FEMENINO' as const, telefono: '+54 9 11 5555-0003' },
    { dni: '40123456', nombre: 'Diego',     apellido: 'Martínez',  sexo: 'MASCULINO' as const, telefono: '+54 9 11 5555-0004' },
    { dni: '42567890', nombre: 'Sofía',     apellido: 'López',     sexo: 'FEMENINO' as const, telefono: '+54 9 11 5555-0005' },
    { dni: '37890123', nombre: 'Mateo',     apellido: 'Fernández', sexo: 'MASCULINO' as const, telefono: '+54 9 11 5555-0006' },
    { dni: '29456123', nombre: 'Camila',    apellido: 'González',  sexo: 'FEMENINO' as const, telefono: '+54 9 11 5555-0007' },
    { dni: '33789456', nombre: 'Tomás',     apellido: 'Romero',    sexo: 'MASCULINO' as const, telefono: '+54 9 11 5555-0008' },
    { dni: '38234567', nombre: 'Valentina', apellido: 'Sánchez',   sexo: 'FEMENINO' as const, telefono: '+54 9 11 5555-0009' },
    { dni: '41345678', nombre: 'Lautaro',   apellido: 'Torres',    sexo: 'MASCULINO' as const, telefono: '+54 9 11 5555-0010' },
  ]
  const pacientes: { id: string; dni: string }[] = []
  for (const p of pacientesData) {
    const existing = await prisma.paciente.findUnique({ where: { dni: p.dni } })
    const paciente = existing
      ?? await prisma.paciente.create({ data: p as any })
    pacientes.push({ id: paciente.id, dni: paciente.dni })
    // Crear historia clínica si no existe
    await prisma.historiaClinica.upsert({
      where: { paciente_id: paciente.id },
      create: { paciente_id: paciente.id },
      update: {},
    })
    // Asignar cobertura a algunos pacientes
    if (pacientes.length % 2 === 0) {
      const cobertura = coberturas[pacientes.length % coberturas.length]
      const yaTiene = await prisma.pacienteCobertura.findFirst({ where: { paciente_id: paciente.id, cobertura_id: cobertura.id } })
      if (!yaTiene) {
        await prisma.pacienteCobertura.create({
          data: {
            paciente_id: paciente.id,
            cobertura_id: cobertura.id,
            numero_afiliado: `${cobertura.nombre.slice(0, 3).toUpperCase()}-${1000 + pacientes.length}`,
            principal: true,
          },
        })
      }
    }
  }

  // ── Turnos distribuidos próximos 7 días ──────────────────────
  const existingTurnos = await prisma.turno.count()
  if (existingTurnos < 20) {
    const ahora = new Date()
    ahora.setMinutes(0, 0, 0)
    for (let i = 0; i < 20; i++) {
      const fecha = new Date(ahora.getTime() + (i % 7) * 24 * 3600 * 1000 + (9 + (i % 6)) * 3600 * 1000)
      const pac = pacientes[i % pacientes.length]
      const prof = profesionales[i % profesionales.length]
      const prestacionesProf = prestaciones.filter((pr) => pr.especialidad_id === prof.especialidad_id)
      const prest = prestacionesProf[i % prestacionesProf.length]
      const consult = consultorios[i % consultorios.length]
      const estado = i < 12 ? 'PENDIENTE' : i < 18 ? 'CONFIRMADO' : 'EN_SALA_ESPERA'
      await prisma.turno.create({
        data: {
          paciente_id: pac.id,
          profesional_id: prof.id,
          prestacion_id: prest.id,
          sede_id: consult.sede_id,
          consultorio_id: consult.id,
          fecha_hora: fecha,
          duracion_min: prest.duracion_min,
          estado: estado as any,
          motivo_consulta: estado === 'PENDIENTE' ? 'Primera consulta' : null,
        },
      })
    }
  }

  // ── Turnos del día actual en estados mixtos (demo Centro de Operaciones) ──
  // Idempotente: solo se ejecuta si hoy hay menos de 6 turnos.
  const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0)
  const hoyFin    = new Date(); hoyFin.setHours(23, 59, 59, 999)
  const turnosHoy = await prisma.turno.count({ where: { fecha_hora: { gte: hoyInicio, lte: hoyFin } } })
  if (turnosHoy < 6) {
    const pacsDemo = await prisma.paciente.findMany({ take: 10, orderBy: { created_at: 'asc' } })
    const profsDemo = await prisma.perfilProfesional.findMany({ include: { prestaciones: { include: { prestacion: true } } } })
    const consultsDemo = await prisma.consultorio.findMany()
    const ahoraMs = Date.now()

    // (hora, estado relativo a la hora actual)
    const plan = [
      { offsetHs: -3,  estado: 'ATENDIDO' },
      { offsetHs: -2,  estado: 'ATENDIDO' },
      { offsetHs: -2,  estado: 'AUSENTE' },
      { offsetHs: -1,  estado: 'ATENDIDO' },
      { offsetHs: -1,  estado: 'CANCELADO' },
      { offsetHs: 0,   estado: 'EN_ATENCION' },
      { offsetHs: 0,   estado: 'EN_SALA_ESPERA' },
      { offsetHs: 1,   estado: 'CONFIRMADO' },
      { offsetHs: 2,   estado: 'CONFIRMADO' },
      { offsetHs: 3,   estado: 'PENDIENTE' },
      { offsetHs: 4,   estado: 'PENDIENTE' },
      { offsetHs: 5,   estado: 'PENDIENTE' },
    ]

    for (let i = 0; i < plan.length; i++) {
      const p = plan[i]
      const prof = profsDemo[i % profsDemo.length]
      const prest = prof.prestaciones[0]?.prestacion
      if (!prest) continue
      const pac = pacsDemo[i % pacsDemo.length]
      const consult = consultsDemo[i % consultsDemo.length]
      const fecha = new Date(ahoraMs + p.offsetHs * 3600 * 1000)
      fecha.setMinutes(0, 0, 0)

      const data: any = {
        paciente_id: pac.id,
        profesional_id: prof.id,
        prestacion_id: prest.id,
        sede_id: consult.sede_id,
        consultorio_id: consult.id,
        fecha_hora: fecha,
        duracion_min: prest.duracion_min,
        estado: p.estado,
        motivo_consulta: p.estado === 'PENDIENTE' ? 'Consulta de control' : null,
        recordatorio_24h_enviado: p.estado !== 'PENDIENTE',
      }
      if (p.estado === 'EN_SALA_ESPERA') {
        data.ingreso_sala_at = new Date(fecha.getTime() - 5 * 60000)
      }
      if (p.estado === 'EN_ATENCION') {
        data.ingreso_sala_at = new Date(fecha.getTime() - 10 * 60000)
        data.inicio_atencion_at = new Date(fecha.getTime() - 2 * 60000)
      }
      if (p.estado === 'ATENDIDO') {
        data.ingreso_sala_at = new Date(fecha.getTime() - 5 * 60000)
        data.inicio_atencion_at = new Date(fecha.getTime() + 2 * 60000)
        data.fin_atencion_at = new Date(fecha.getTime() + prest.duracion_min * 60000)
      }
      if (p.estado === 'CANCELADO') {
        data.cancelado_at = new Date(fecha.getTime() - 30 * 60000)
        data.cancelado_motivo = 'Reagendado por paciente'
      }
      await prisma.turno.create({ data })
    }
  }

  // ── Asociar Usuario PACIENTE con Paciente ──────────────────
  await prisma.paciente.update({
    where: { dni: '28456789' },
    data: { usuario_id: userPaciente.id },
  })

  // ── Una evolución demo firmada para mostrar en portal ──────
  const hcLucia = await prisma.historiaClinica.findUnique({ where: { paciente_id: (await prisma.paciente.findUnique({ where: { dni: '28456789' } }))!.id } })
  if (hcLucia) {
    const existEvol = await prisma.evolucionClinica.findFirst({ where: { historia_id: hcLucia.id } })
    if (!existEvol) {
      const perfilMedico = await prisma.perfilProfesional.findFirst({ where: { usuario_id: userMedico.id } })
      if (perfilMedico) {
        await prisma.evolucionClinica.create({
          data: {
            historia_id: hcLucia.id,
            profesional_id: perfilMedico.id,
            usuario_id: userMedico.id,
            motivo_consulta: 'Control anual',
            subjetivo: 'Paciente refiere buen estado general',
            objetivo: 'TA 120/80, FC 72 lpm, examen físico normal',
            analisis: 'Sin hallazgos patológicos',
            plan: 'Continuar con hábitos saludables, control en 12 meses',
            firmado_at: new Date(),
            firmado_por_id: perfilMedico.id,
          },
        })
        await prisma.alergia.create({
          data: { historia_id: hcLucia.id, sustancia: 'Penicilina', severidad: 'MODERADA', reaccion: 'Rash cutáneo' },
        })
        await prisma.antecedente.create({
          data: { historia_id: hcLucia.id, tipo: 'PERSONAL', descripcion: 'HTA controlada' },
        })
      }
    }
  }

  // ── Medicamentos del vademécum (idempotente por codigo_externo o nombre) ──
  const medicamentos = [
    { codigo_externo: 'KAI-001', nombre_comercial: 'Amoxidal 500',    principio_activo: 'Amoxicilina',      laboratorio: 'Roemmers',    presentacion: '500 mg comprimidos', via_admin: 'Oral', prescripcion_requerida: true },
    { codigo_externo: 'KAI-002', nombre_comercial: 'Ibupirac 600',    principio_activo: 'Ibuprofeno',       laboratorio: 'Pfizer',      presentacion: '600 mg comprimidos', via_admin: 'Oral', prescripcion_requerida: false },
    { codigo_externo: 'KAI-003', nombre_comercial: 'Atenolol Beta',   principio_activo: 'Atenolol',         laboratorio: 'Beta',        presentacion: '50 mg comprimidos',  via_admin: 'Oral', prescripcion_requerida: true,
      interacciones: [{ principio: 'Verapamilo', severidad: 'SEVERA', descripcion: 'Bradicardia severa, bloqueo AV' }] },
    { codigo_externo: 'KAI-004', nombre_comercial: 'Enalapril Bagó',  principio_activo: 'Enalapril',        laboratorio: 'Bagó',        presentacion: '10 mg comprimidos',  via_admin: 'Oral', prescripcion_requerida: true,
      interacciones: [{ principio: 'Potasio', severidad: 'MODERADA', descripcion: 'Hiperkalemia' }] },
    { codigo_externo: 'KAI-005', nombre_comercial: 'Metformina 850',  principio_activo: 'Metformina',       laboratorio: 'Gador',       presentacion: '850 mg comprimidos', via_admin: 'Oral', prescripcion_requerida: true },
    { codigo_externo: 'KAI-006', nombre_comercial: 'Paracetamol',     principio_activo: 'Paracetamol',      laboratorio: 'Genérico',    presentacion: '500 mg comprimidos', via_admin: 'Oral', prescripcion_requerida: false },
    { codigo_externo: 'KAI-007', nombre_comercial: 'Omeprazol Raffo', principio_activo: 'Omeprazol',        laboratorio: 'Raffo',       presentacion: '20 mg cápsulas',     via_admin: 'Oral', prescripcion_requerida: true },
    { codigo_externo: 'KAI-008', nombre_comercial: 'Losartan Roemmers', principio_activo: 'Losartan',       laboratorio: 'Roemmers',    presentacion: '50 mg comprimidos',  via_admin: 'Oral', prescripcion_requerida: true },
    { codigo_externo: 'KAI-009', nombre_comercial: 'Salbutamol Genfar', principio_activo: 'Salbutamol',     laboratorio: 'Genfar',      presentacion: 'Aerosol 100mcg',     via_admin: 'Inhalatoria', prescripcion_requerida: true },
    { codigo_externo: 'KAI-010', nombre_comercial: 'Levotiroxina',    principio_activo: 'Levotiroxina',     laboratorio: 'Glaxo',       presentacion: '50 mcg comprimidos', via_admin: 'Oral', prescripcion_requerida: true },
    { codigo_externo: 'KAI-011', nombre_comercial: 'Clonazepam',      principio_activo: 'Clonazepam',       laboratorio: 'Roche',       presentacion: '0.5 mg comprimidos', via_admin: 'Oral', prescripcion_requerida: true,
      interacciones: [{ principio: 'Alcohol', severidad: 'SEVERA', descripcion: 'Depresión SNC' }] },
    { codigo_externo: 'KAI-012', nombre_comercial: 'Cefalexina 500',  principio_activo: 'Cefalexina',       laboratorio: 'Bagó',        presentacion: '500 mg cápsulas',    via_admin: 'Oral', prescripcion_requerida: true },
  ]
  for (const m of medicamentos) {
    const { interacciones, ...rest } = m as any
    await prisma.medicamento.upsert({
      where: { codigo_externo: m.codigo_externo },
      create: { ...rest, interacciones: interacciones ? JSON.stringify(interacciones) : null },
      update: {},
    })
  }

  // ── Turnos en distintos estados (atendidos + ausentes + cancelados) ──
  // Re-usar pacientes y profesionales del seed previo
  const turnosAdicionales = await prisma.turno.count({ where: { estado: 'ATENDIDO' } })
  if (turnosAdicionales === 0) {
    const ahora = new Date()
    const pacs = await prisma.paciente.findMany({ take: 8, orderBy: { created_at: 'asc' } })
    const profs = await prisma.perfilProfesional.findMany({ include: { prestaciones: { include: { prestacion: true } } } })
    const consultorios = await prisma.consultorio.findMany({ take: 4 })

    // 12 turnos pasados (mezcla de estados)
    for (let i = 0; i < 12; i++) {
      const diasAtras = (i % 30) + 1
      const hora = 9 + (i % 8)
      const fecha = new Date(ahora.getTime() - diasAtras * 24 * 3600 * 1000)
      fecha.setHours(hora, 0, 0, 0)
      const prof = profs[i % profs.length]
      const prest = prof.prestaciones[0]?.prestacion
      if (!prest) continue
      const pac = pacs[i % pacs.length]
      const consult = consultorios[i % consultorios.length]
      const estado = i < 8 ? 'ATENDIDO' : i < 10 ? 'AUSENTE' : 'CANCELADO'
      await prisma.turno.create({
        data: {
          paciente_id: pac.id,
          profesional_id: prof.id,
          prestacion_id: prest.id,
          sede_id: consult.sede_id,
          consultorio_id: consult.id,
          fecha_hora: fecha,
          duracion_min: prest.duracion_min,
          estado: estado as any,
          motivo_consulta: estado === 'ATENDIDO' ? 'Control de rutina' : null,
          recordatorio_24h_enviado: true,
          recordatorio_48h_enviado: i % 2 === 0,
          ...(estado === 'ATENDIDO' ? {
            inicio_atencion_at: new Date(fecha.getTime() + 5 * 60000),
            fin_atencion_at: new Date(fecha.getTime() + prest.duracion_min * 60000),
          } : {}),
          ...(estado === 'CANCELADO' ? { cancelado_at: new Date(fecha.getTime() - 24 * 3600 * 1000), cancelado_motivo: 'Cancelado por paciente' } : {}),
        },
      })
    }
  }

  // ── Comprobantes + Pagos + Deudas (para reflejar en caja y reportes) ──
  const comprobantesExistentes = await prisma.comprobante.count()
  if (comprobantesExistentes === 0) {
    const pacsConTurnos = await prisma.turno.findMany({
      where: { estado: 'ATENDIDO' },
      include: { paciente: true, prestacion: true },
      take: 8,
    })

    for (let i = 0; i < pacsConTurnos.length; i++) {
      const t = pacsConTurnos[i]
      const monto = t.prestacion ? Number(t.prestacion.precio_particular) : 8000
      const pagado = i < 6  // 6 pagados, 2 con saldo
      const comp = await prisma.comprobante.create({
        data: {
          paciente_id: t.paciente_id,
          turno_id: t.id,
          tipo: 'RECIBO',
          subtotal: monto,
          descuento: 0,
          total: monto,
          total_pagado: pagado ? monto : 0,
          saldo: pagado ? 0 : monto,
          estado: pagado ? 'PAGADO' : 'EMITIDO',
          items: {
            create: [{
              prestacion_id: t.prestacion_id,
              descripcion: t.prestacion?.nombre ?? 'Consulta',
              cantidad: 1,
              precio_unitario: monto,
              subtotal: monto,
            }],
          },
        },
      })
      if (pagado) {
        const medios = ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'MERCADOPAGO'] as const
        const medio = medios[i % medios.length]
        const pago = await prisma.pago.create({
          data: {
            comprobante_id: comp.id,
            paciente_id: t.paciente_id,
            monto,
            medio,
            fecha: t.fin_atencion_at ?? t.fecha_hora,
          },
        })
        await prisma.movimientoCaja.create({
          data: {
            pago_id: pago.id,
            usuario_id: userMedico.id,
            tipo: 'INGRESO',
            monto,
            medio,
            concepto: `${t.prestacion?.nombre ?? 'Consulta'}`,
            fecha: pago.fecha,
          },
        })
      } else {
        await prisma.deuda.create({
          data: {
            paciente_id: t.paciente_id,
            comprobante_id: comp.id,
            monto_original: monto,
            saldo_actual: monto,
            fecha_origen: t.fecha_hora,
          },
        })
      }
    }
  }

  // ── Comunicaciones (historial de WhatsApp enviado) ─────────────
  const comunicacionesExistentes = await prisma.comunicacionPaciente.count()
  if (comunicacionesExistentes === 0) {
    const turnosRecientes = await prisma.turno.findMany({
      include: { paciente: true },
      orderBy: { fecha_hora: 'desc' },
      take: 10,
    })
    for (const t of turnosRecientes) {
      if (!t.paciente.telefono) continue
      const tipos: Array<['CONFIRMACION_TURNO' | 'RECORDATORIO_24H' | 'POSTCONSULTA', string]> = [
        ['CONFIRMACION_TURNO', `Hola ${t.paciente.nombre}, confirmamos tu turno.`],
        ['RECORDATORIO_24H',   `Hola ${t.paciente.nombre}, te recordamos tu turno mañana.`],
      ]
      if (t.estado === 'ATENDIDO') {
        tipos.push(['POSTCONSULTA', `Hola ${t.paciente.nombre}, ¿cómo te sentís después de tu consulta?`])
      }
      for (const [tipo, cuerpo] of tipos) {
        await prisma.comunicacionPaciente.create({
          data: {
            paciente_id: t.paciente_id,
            turno_id: t.id,
            canal: 'WHATSAPP',
            tipo,
            destino: t.paciente.telefono,
            cuerpo,
            estado: tipo === 'POSTCONSULTA' ? 'RESPONDIDA' : 'ENTREGADA',
            enviada_at: new Date(t.fecha_hora.getTime() - 24 * 3600 * 1000),
            entregada_at: new Date(t.fecha_hora.getTime() - 24 * 3600 * 1000 + 60000),
          },
        })
      }
    }
  }

  // ── Alertas clínicas adicionales en algunos pacientes ──────────
  const alertasExistentes = await prisma.alertaClinica.count()
  if (alertasExistentes === 0) {
    const pacsAlerta = await prisma.paciente.findMany({ take: 4, orderBy: { created_at: 'asc' } })
    if (pacsAlerta[1]) {
      await prisma.alertaClinica.create({
        data: { paciente_id: pacsAlerta[1].id, titulo: 'Hipertensión arterial controlada', descripcion: 'En tratamiento con Enalapril 10mg/día', severidad: 'ADVERTENCIA' },
      })
    }
    if (pacsAlerta[2]) {
      await prisma.alertaClinica.create({
        data: { paciente_id: pacsAlerta[2].id, titulo: 'Alergia severa a AINEs', descripcion: 'No prescribir Ibuprofeno ni AAS', severidad: 'CRITICA' },
      })
    }
    if (pacsAlerta[3]) {
      await prisma.alertaClinica.create({
        data: { paciente_id: pacsAlerta[3].id, titulo: 'Diabetes tipo 2', descripcion: 'Metformina 850mg/día — control trimestral', severidad: 'INFO' },
      })
    }
  }

  // ── Insumos básicos para mostrar stock ─────────────────────────
  const insumosExistentes = await prisma.insumo.count()
  if (insumosExistentes === 0) {
    const insumos = [
      { codigo: 'INS-001', nombre: 'Guantes de látex talle M', unidad: 'caja', stock_actual: 12, stock_minimo: 10 },
      { codigo: 'INS-002', nombre: 'Gasas estériles 10x10', unidad: 'pack',    stock_actual: 8,  stock_minimo: 15 },
      { codigo: 'INS-003', nombre: 'Alcohol en gel 500ml',   unidad: 'unidad', stock_actual: 24, stock_minimo: 10 },
      { codigo: 'INS-004', nombre: 'Jeringas 5ml',           unidad: 'caja',   stock_actual: 6,  stock_minimo: 20 },
      { codigo: 'INS-005', nombre: 'Baja-lenguas',           unidad: 'pack',   stock_actual: 18, stock_minimo: 5 },
    ]
    for (const i of insumos) {
      await prisma.insumo.create({ data: i as any })
    }
  }

  console.log('✅ Seed completo')
  console.log('---')
  console.log('Usuarios demo (password: ' + PWD_DEFAULT + ')')
  usuariosBase.forEach((u) => console.log(`  ${u.rol.padEnd(20)} ${u.email}`))
  console.log('---')
  console.log('Datos sembrados:')
  console.log(`  ${await prisma.paciente.count()} pacientes`)
  console.log(`  ${await prisma.perfilProfesional.count()} profesionales`)
  console.log(`  ${await prisma.especialidad.count()} especialidades`)
  console.log(`  ${await prisma.prestacion.count()} prestaciones`)
  console.log(`  ${await prisma.sede.count()} sedes (${await prisma.consultorio.count()} consultorios)`)
  console.log(`  ${await prisma.coberturaMedica.count()} coberturas (${await prisma.planCobertura.count()} planes)`)
  console.log(`  ${await prisma.turno.count()} turnos`)
  console.log(`  ${await prisma.comprobante.count()} comprobantes (${await prisma.pago.count()} pagos, ${await prisma.deuda.count()} deudas)`)
  console.log(`  ${await prisma.comunicacionPaciente.count()} comunicaciones`)
  console.log(`  ${await prisma.medicamento.count()} medicamentos`)
  console.log(`  ${await prisma.insumo.count()} insumos`)
  console.log(`  ${await prisma.alertaClinica.count()} alertas clínicas`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
