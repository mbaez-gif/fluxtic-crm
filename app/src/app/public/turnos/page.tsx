'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import s from './page.module.css'
import Turnstile from './Turnstile'
import GoogleAutofill from './GoogleAutofill'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
const GOOGLE_CLIENT_ID  = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

const HERO_IMG = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80'
const ABOUT_IMG = 'https://images.unsplash.com/photo-1522335789203-aaa92a7e95a4?auto=format&fit=crop&w=1200&q=80'
const SERVICE_FALLBACKS = [
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',
]

type Servicio = {
  id: string
  nombre: string
  categoria?: string
  duracion_min: number
  precio: number
  descripcion?: string
  foto_url?: string
}

type Profesional = { id: string; nombre: string; apellido?: string; color?: string }
type Slot = { inicio: string; fin: string }
type DisponibilidadResp = { por_profesional: Array<{ profesional_id: string; profesional_nombre: string; slots: Slot[] }> }

type ConfigSena = {
  metodo_sena: 'MERCADOPAGO' | 'TRANSFERENCIA' | 'AMBOS' | 'SIN_SENA'
  alias_transferencia: string | null
  titular_alias: string | null
  mensaje_sena: string | null
  vencimiento_transf_horas: number
  vencimiento_mp_minutos: number
  whatsapp_negocio: string | null
  nombre_negocio: string
}

type ReservaResp = {
  turno: { id: string; estado: string }
  requiere_pago: boolean
  metodo_pago: 'MERCADOPAGO' | 'TRANSFERENCIA' | null
  monto_sena: number
  init_point: string | null
  alias_transferencia: string | null
  titular_alias: string | null
  mensaje_sena: string | null
  cliente_conflicto_datos?: boolean
  cliente_detalle_conflicto?: string
}

type Step = 1 | 2 | 3 | 4 | 5

interface ApiError extends Error {
  status?: number
  code?: string
}

export default function ReservaPublicaPage() {
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)

  const [servicios, setServicios] = useState<Servicio[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [configSena, setConfigSena] = useState<ConfigSena | null>(null)

  const [serviciosSel, setServiciosSel] = useState<string[]>([])
  const [profesionalId, setProfesionalId] = useState<string>('')
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotInicio, setSlotInicio] = useState<string>('')

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [dni, setDni] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState<{ nombre?: boolean; dni?: boolean; telefono?: boolean; email?: boolean }>({})
  const [turnstileToken, setTurnstileToken] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [reservaCreada, setReservaCreada] = useState<ReservaResp | null>(null)
  const [reservasExtra, setReservasExtra] = useState<Array<{ servicio_nombre: string; hora: string }>>([])

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/servicios`).then(r => r.ok ? r.json() : { data: [] }),
      fetch(`${API_URL}/profesionales`).then(r => r.ok ? r.json() : { data: [] }),
      fetch(`${API_URL}/reservas-publicas/config-sena`).then(r => r.ok ? r.json() : null),
    ]).then(([servRes, profRes, cfg]) => {
      const lista: Servicio[] = (servRes?.data ?? []).filter((x: { activo?: boolean }) => x.activo !== false)
      setServicios(lista)
      setProfesionales(profRes?.data ?? [])
      setConfigSena(cfg)
    }).catch(() => setError('No se pudo cargar la información. Probá refrescar la página.'))
  }, [])

  const serviciosObjs = useMemo(
    () => serviciosSel.map(id => servicios.find(x => x.id === id)).filter(Boolean) as Servicio[],
    [serviciosSel, servicios]
  )
  const duracionTotal = useMemo(() => serviciosObjs.reduce((a, x) => a + x.duracion_min, 0), [serviciosObjs])
  const precioTotal = useMemo(() => serviciosObjs.reduce((a, x) => a + x.precio, 0), [serviciosObjs])

  const profesional = useMemo(() => profesionales.find(x => x.id === profesionalId), [profesionales, profesionalId])

  // disponibilidad: buscamos slots para la DURACIÓN TOTAL como si fuera un solo turno largo.
  // pasamos el servicio MÁS LARGO como referencia (la API exige servicio_id) y filtramos por duración total.
  useEffect(() => {
    if (serviciosSel.length === 0 || !profesionalId || !fecha) {
      setSlots([])
      return
    }
    const servicioRef = serviciosObjs[0]?.id
    if (!servicioRef) return

    const url = new URL(`${API_URL}/disponibilidad`)
    url.searchParams.set('servicio_id', servicioRef)
    url.searchParams.set('profesional_id', profesionalId)
    url.searchParams.set('fecha_desde', fecha)
    url.searchParams.set('fecha_hasta', fecha)
    fetch(url.toString())
      .then(r => r.ok ? r.json() : { por_profesional: [] })
      .then((data: DisponibilidadResp) => {
        const prof = data.por_profesional?.find(p => p.profesional_id === profesionalId)
        const raw = prof?.slots ?? []
        // Filtrar slots cuya ventana hasta el siguiente alcance la duración total
        // (la API ya validará por turno individual; acá solo filtramos para que el usuario
        // no elija un slot que claramente no entra)
        const filtrados = raw.filter((slot, i) => {
          if (duracionTotal <= 0) return true
          const finNecesario = new Date(slot.inicio).getTime() + duracionTotal * 60_000
          // si hay slot siguiente, asegurar que cubrimos hasta el fin
          const ultimoFin = new Date(raw[raw.length - 1].fin).getTime()
          return finNecesario <= ultimoFin || i + Math.ceil(duracionTotal / 30) <= raw.length
        })
        setSlots(filtrados)
      })
      .catch(() => setSlots([]))
  }, [serviciosSel, profesionalId, fecha, duracionTotal, serviciosObjs])

  const proximosDias = useMemo(() => {
    const out: string[] = []
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    for (let i = 0; i < 14; i++) {
      const d = new Date(base)
      d.setDate(d.getDate() + i)
      out.push(d.toISOString().slice(0, 10))
    }
    return out
  }, [])

  // ── Validaciones inline ──────────────────────────────────────────
  const errorNombre = !nombre.trim() ? 'Ingresá tu nombre' : ''
  const errorTelefono = (() => {
    if (!telefono.trim()) return 'Ingresá tu teléfono'
    const digitos = telefono.replace(/\D/g, '')
    if (digitos.length < 10) return 'El teléfono debe tener al menos 10 dígitos'
    if (digitos.length > 13) return 'Demasiados dígitos'
    return ''
  })()
  const errorDni = (() => {
    const digitos = dni.replace(/\D/g, '')
    if (!digitos) return 'Ingresá tu DNI'
    if (digitos.length < 6) return 'El DNI debe tener al menos 6 dígitos'
    if (digitos.length > 12) return 'DNI inválido'
    return ''
  })()
  const errorEmail = (() => {
    if (!email.trim()) return ''
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email.trim()) ? '' : 'Email inválido'
  })()
  const datosValidos = !errorNombre && !errorDni && !errorTelefono && !errorEmail

  function onChangeTelefono(raw: string) {
    // máscara AR: solo dígitos, espacios, guiones, paréntesis y +
    const limpio = raw.replace(/[^\d\s\-()+]/g, '')
    setTelefono(limpio)
  }

  const handleGoogleProfile = useCallback((p: { nombre: string; apellido: string; email: string }) => {
    if (p.nombre) setNombre(p.nombre)
    if (p.apellido) setApellido(p.apellido)
    if (p.email) setEmail(p.email)
    // Marcar campos como tocados para que la validacion inline se active
    setTouched(t => ({ ...t, nombre: true, email: true }))
  }, [])

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token)
  }, [])

  function onChangeDni(raw: string) {
    setDni(raw.replace(/\D/g, '').slice(0, 12))
  }

  function toggleServicio(id: string) {
    setServiciosSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function siguiente() {
    setError(null)
    if (step === 1 && serviciosSel.length === 0) return setError('Elegí al menos un servicio.')
    if (step === 2 && !profesionalId) return setError('Elegí una profesional.')
    if (step === 3 && !slotInicio) return setError('Elegí un horario disponible.')
    if (step === 4) {
      setTouched({ nombre: true, dni: true, telefono: true, email: true })
      if (!datosValidos) return setError('Revisá los datos antes de continuar.')
      if (TURNSTILE_SITE_KEY && !turnstileToken) {
        return setError('Esperá un instante mientras verificamos que no sos un bot…')
      }
      return confirmar()
    }
    setStep((step + 1) as Step)
  }

  function volver() {
    setError(null)
    if (step > 1) setStep((step - 1) as Step)
  }

  async function reservarUno(opts: {
    servicio_id: string
    fecha_inicio: Date
  }): Promise<ReservaResp> {
    const body: Record<string, unknown> = {
      servicio_id: opts.servicio_id,
      profesional_id: profesionalId,
      fecha_inicio: opts.fecha_inicio.toISOString(),
      cliente: {
        nombre: nombre.trim(),
        apellido: apellido.trim() || undefined,
        dni: dni.replace(/\D/g, ''),
        telefono: telefono.trim(),
        email: email.trim() || undefined,
      },
      origen: 'LINK_PUBLICO',
      coordinar_por_whatsapp: true,
      turnstile_token: turnstileToken || undefined,
      notas_turno: serviciosObjs.length > 1
        ? `Sesión múltiple: ${serviciosObjs.map(x => x.nombre).join(' + ')}`
        : undefined,
    }
    const res = await fetch(`${API_URL}/reservas-publicas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text()
      let payload: { error?: string; message?: string; code?: string } = {}
      try { payload = JSON.parse(txt) } catch { /* texto plano */ }
      const err: ApiError = new Error(payload.message || payload.error || txt || `HTTP ${res.status}`)
      err.status = res.status
      err.code = payload.error || payload.code
      throw err
    }
    return res.json()
  }

  async function confirmar() {
    if (!nombre.trim() || !telefono.trim()) {
      return setError('Nombre y teléfono son obligatorios.')
    }
    setSubmitting(true)
    setError(null)

    try {
      const base = new Date(slotInicio)
      const primaria = await reservarUno({
        servicio_id: serviciosObjs[0].id,
        fecha_inicio: base,
      })
      setReservaCreada(primaria)

      // Reservar servicios extra en horarios consecutivos.
      const extras: Array<{ servicio_nombre: string; hora: string }> = []
      let offsetMin = serviciosObjs[0].duracion_min
      for (let i = 1; i < serviciosObjs.length; i++) {
        const inicio = new Date(base.getTime() + offsetMin * 60_000)
        try {
          await reservarUno({
            servicio_id: serviciosObjs[i].id,
            fecha_inicio: inicio,
          })
          extras.push({
            servicio_nombre: serviciosObjs[i].nombre,
            hora: inicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          })
        } catch (err) {
          console.error(`No se pudo agendar ${serviciosObjs[i].nombre}`, err)
        }
        offsetMin += serviciosObjs[i].duracion_min
      }
      setReservasExtra(extras)
      setStep(5)
    } catch (err) {
      const e = err as ApiError
      // Conflicto de superposicion (alguien tomo el slot)
      if (e.status === 409 || e.code === 'SLOT_NO_DISPONIBLE') {
        setError('El horario seleccionado ya no está disponible. Refrescamos la disponibilidad — elegí otro horario.')
        setSlotInicio('')         // limpiar el slot ahora invalido
        recargarSlots()           // re-fetch disponibilidad del dia
        setStep(3)                // volver al paso de horario
        return
      }
      // Fuera de horario laboral (validacion del backend)
      if (e.code === 'FUERA_DE_HORARIO') {
        setError('Ese horario no está dentro del horario laboral de la profesional. Elegí otro.')
        setSlotInicio('')
        recargarSlots()
        setStep(3)
        return
      }
      // Datos no coinciden con cliente existente (mismo tel/DNI con datos distintos)
      if (e.code === 'TELEFONO_OTRO_CLIENTE' || e.code === 'DATOS_NO_COINCIDEN') {
        setError(e.message || 'El teléfono ingresado ya está asociado a otro cliente. Revisá los datos o contactanos por WhatsApp.')
        return
      }
      // DNI/Captcha invalido: usuario vuelve a step 4
      if (e.code === 'DNI_REQUERIDO' || e.code === 'DNI_INVALIDO' || e.code === 'TURNSTILE_INVALIDO' || e.code === 'TURNSTILE_FALTANTE') {
        setError(e.message || 'Revisá los datos personales antes de continuar.')
        return
      }
      setError(e.message || 'No pudimos confirmar tu reserva. Probá nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  function recargarSlots() {
    if (!serviciosSel.length || !profesionalId || !fecha) return
    const url = new URL(`${API_URL}/disponibilidad`)
    url.searchParams.set('servicio_id', serviciosObjs[0].id)
    url.searchParams.set('profesional_id', profesionalId)
    url.searchParams.set('fecha_desde', fecha)
    url.searchParams.set('fecha_hasta', fecha)
    fetch(url.toString())
      .then(r => r.ok ? r.json() : { por_profesional: [] })
      .then((data: DisponibilidadResp) => {
        const prof = data.por_profesional?.find(p => p.profesional_id === profesionalId)
        setSlots(prof?.slots ?? [])
      })
      .catch(() => setSlots([]))
  }


  function scrollToReservar() {
    document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className={s.page}>
      {/* ───────── HERO ───────── */}
      <section className={s.hero}>
        <div className={s.heroBg} />
        <div className={s.heroInner}>
          <div>
            <div className={s.heroEyebrow}>Estética & bienestar</div>
            <h1 className={s.heroTitle}>
              Tu momento de <em>cuidado</em>, reservado en segundos.
            </h1>
            <p className={s.heroLead}>
              Profesionales, productos premium y un espacio diseñado para que te sientas
              como te merecés. Elegí tu servicio y agendá online cuando quieras.
            </p>
            <div className={s.heroBtns}>
              <button className={s.btnPrimary} onClick={scrollToReservar}>Reservar turno</button>
              <a className={s.btnGhost} href="#servicios">Ver servicios</a>
            </div>
          </div>
          <div className={s.heroImageWrap}>
            <img src={HERO_IMG} alt="Espacio Delfina Paz" className={s.heroImage} />
            <div className={s.heroBadge}>Tomando turnos esta semana</div>
          </div>
        </div>
      </section>

      {/* ───────── STRIP DE VALORES ───────── */}
      <section className={s.featuresStrip}>
        <div className={s.featuresInner}>
          <div className={s.feature}><h4>+10</h4><p>Años de experiencia</p></div>
          <div className={s.feature}><h4>+5k</h4><p>Clientas felices</p></div>
          <div className={s.feature}><h4>100%</h4><p>Productos premium</p></div>
          <div className={s.feature}><h4>★ 4.9</h4><p>Calificación promedio</p></div>
        </div>
      </section>

      {/* ───────── GALERÍA DE SERVICIOS ───────── */}
      <section className={s.section} id="servicios">
        <div className={s.sectionHead}>
          <div className={s.sectionEyebrow}>Nuestros servicios</div>
          <h2 className={s.sectionTitle}>Tratamientos pensados <em>para vos</em></h2>
          <p className={s.sectionLead}>
            Cada servicio combina técnica profesional con productos de primera línea.
            Mirá lo que ofrecemos y armá tu sesión.
          </p>
        </div>
        <div className={s.servicesGrid}>
          {servicios.slice(0, 6).map((sv, i) => (
            <div key={sv.id} className={s.serviceCard}>
              <div className={s.serviceImg}>
                <img
                  src={sv.foto_url || SERVICE_FALLBACKS[i % SERVICE_FALLBACKS.length]}
                  alt={sv.nombre}
                />
              </div>
              <div className={s.serviceBody}>
                <h3 className={s.serviceName}>{sv.nombre}</h3>
                <p className={s.serviceDesc}>
                  {sv.descripcion || 'Tratamiento personalizado con productos premium.'}
                </p>
                <div className={s.serviceMeta}>
                  <span className={s.serviceDur}>{sv.duracion_min} min</span>
                  <span className={s.servicePrice}>${formatARS(sv.precio)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── SOBRE ───────── */}
      <section className={s.aboutSection} id="sobre">
        <div className={s.aboutInner}>
          <div className={s.aboutImg}>
            <img src={ABOUT_IMG} alt="Sobre Delfina Paz" />
          </div>
          <div className={s.aboutText}>
            <div className={s.sectionEyebrow} style={{ textAlign: 'left' }}>Sobre nosotros</div>
            <h2>
              Un espacio donde la <em>belleza</em> se vive con calma.
            </h2>
            <p>
              Desde hace más de una década acompañamos a nuestras clientas en cada paso
              de su rutina de belleza. Trabajamos con profesionales capacitadas y
              productos seleccionados por su calidad.
            </p>
            <p>
              Reservar online es nuestra forma de respetar tu tiempo: elegís cuándo
              y qué querés, y nos encargamos del resto.
            </p>
            <div className={s.aboutValues}>
              <div className={s.value}>
                <h4>Profesionalismo</h4>
                <p>Equipo certificado y en formación continua.</p>
              </div>
              <div className={s.value}>
                <h4>Productos premium</h4>
                <p>Marcas líderes y respeto por la piel sensible.</p>
              </div>
              <div className={s.value}>
                <h4>Atención personal</h4>
                <p>Cada clienta es única. Adaptamos el servicio.</p>
              </div>
              <div className={s.value}>
                <h4>Tiempo cuidado</h4>
                <p>Reserva online, recordatorios y agenda flexible.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── WIZARD DE RESERVA ───────── */}
      <section className={s.reservar} id="reservar">
        <div className={s.sectionHead}>
          <div className={s.sectionEyebrow}>Reservá tu turno</div>
          <h2 className={s.sectionTitle}>Elegí servicios, fecha y <em>listo</em></h2>
          <p className={s.sectionLead}>
            Podés combinar varios servicios en una misma visita. Te confirmamos
            tu turno al instante.
          </p>
        </div>

        <div className={s.wizardWrap}>
          <div className={s.wizardCard}>
            {step < 5 && (
              <div className={s.steps}>
                {[1, 2, 3, 4].map(n => (
                  <div
                    key={n}
                    className={`${s.stepDot} ${n === step ? s.stepDotActive : ''} ${n < step ? s.stepDotDone : ''}`}
                  />
                ))}
              </div>
            )}

            {error && <div className={s.error}>{error}</div>}

            {step === 1 && (
              <>
                <h2 className={s.h1}>Elegí tus servicios</h2>
                <p className={s.lead}>
                  Podés combinar varios. Te los agendamos uno después del otro con
                  la misma profesional.
                </p>
                <div className={s.list}>
                  {servicios.length === 0 && <span className={s.muted}>Cargando servicios…</span>}
                  {servicios.map(sv => {
                    const sel = serviciosSel.includes(sv.id)
                    return (
                      <div
                        key={sv.id}
                        className={`${s.listItem} ${sel ? s.listItemSelected : ''}`}
                        onClick={() => toggleServicio(sv.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span className={`${s.check} ${sel ? s.checkActive : ''}`}>
                            {sel && <CheckIcon />}
                          </span>
                          <div>
                            <div className={s.itemTitle}>{sv.nombre}</div>
                            <div className={s.itemSub}>{sv.duracion_min} min{sv.categoria ? ` · ${sv.categoria}` : ''}</div>
                          </div>
                        </div>
                        <div className={s.itemPrice}>${formatARS(sv.precio)}</div>
                      </div>
                    )
                  })}
                </div>
                {serviciosSel.length > 0 && (
                  <div className={s.totalChip}>
                    {serviciosSel.length} servicio{serviciosSel.length > 1 ? 's' : ''} · {duracionTotal} min · ${formatARS(precioTotal)}
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <h2 className={s.h1}>Con quién te atendés</h2>
                <p className={s.lead}>Elegí la profesional para toda tu sesión.</p>
                <div className={s.list}>
                  {profesionales.map(p => (
                    <div
                      key={p.id}
                      className={`${s.listItem} ${p.id === profesionalId ? s.listItemSelected : ''}`}
                      onClick={() => setProfesionalId(p.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span
                          className={s.check}
                          style={{ background: p.color || 'var(--rose)', borderColor: 'transparent', color: 'transparent' }}
                        />
                        <div>
                          <div className={s.itemTitle}>{p.nombre} {p.apellido ?? ''}</div>
                          <div className={s.itemSub}>Profesional</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className={s.h1}>Fecha y hora</h2>
                <p className={s.lead}>Estos son los próximos turnos disponibles para tu sesión de {duracionTotal} min.</p>
                <div className={s.dates}>
                  {proximosDias.map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`${s.dateBtn} ${d === fecha ? s.dateBtnActive : ''}`}
                      onClick={() => { setFecha(d); setSlotInicio('') }}
                    >
                      <span>{labelDow(d)}</span>
                      <span className={s.dia}>{labelDia(d)}</span>
                      <span>{labelMes(d)}</span>
                    </button>
                  ))}
                </div>
                <div className={s.slots}>
                  {slots.length === 0 && <span className={s.muted}>No hay horarios disponibles este día.</span>}
                  {slots.map(slot => (
                    <button
                      key={slot.inicio}
                      type="button"
                      className={`${s.slot} ${slot.inicio === slotInicio ? s.slotActive : ''}`}
                      onClick={() => setSlotInicio(slot.inicio)}
                    >
                      {labelHora(slot.inicio)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h2 className={s.h1}>Tus datos</h2>
                <p className={s.lead}>Necesitamos esto para confirmar tu reserva.</p>

                {GOOGLE_CLIENT_ID && (
                  <>
                    <GoogleAutofill clientId={GOOGLE_CLIENT_ID} onProfile={handleGoogleProfile} />
                    <p className={s.helper} style={{ textAlign: 'center', marginTop: -4, marginBottom: 16 }}>
                      O completá los datos abajo.
                    </p>
                  </>
                )}

                {profesional && slotInicio && (
                  <div className={s.summary}>
                    {serviciosObjs.map((sv, i) => {
                      const offset = serviciosObjs.slice(0, i).reduce((a, x) => a + x.duracion_min, 0)
                      const hora = new Date(new Date(slotInicio).getTime() + offset * 60_000)
                      return (
                        <div key={sv.id}>
                          <span>{sv.nombre}</span>
                          <span>
                            {labelHora(hora.toISOString())} · ${formatARS(sv.precio)}
                          </span>
                        </div>
                      )
                    })}
                    <div>
                      <span>Profesional</span>
                      <span>{profesional.nombre} {profesional.apellido ?? ''}</span>
                    </div>
                    <div>
                      <span>Fecha</span>
                      <span>{labelFechaCompleta(slotInicio)}</span>
                    </div>
                    <div>
                      <span>Total</span>
                      <span>${formatARS(precioTotal)}</span>
                    </div>
                  </div>
                )}

                <div className={s.formRow}>
                  <label className={s.label}>Nombre *</label>
                  <input
                    className={s.input}
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, nombre: true }))}
                    placeholder="Tu nombre"
                    aria-invalid={!!errorNombre && !!touched.nombre}
                  />
                  {touched.nombre && errorNombre && (
                    <p className={s.fieldError}>{errorNombre}</p>
                  )}
                </div>
                <div className={s.formRow}>
                  <label className={s.label}>Apellido</label>
                  <input
                    className={s.input}
                    value={apellido}
                    onChange={e => setApellido(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className={s.formRow}>
                  <label className={s.label}>DNI *</label>
                  <input
                    className={s.input}
                    type="text"
                    inputMode="numeric"
                    value={dni}
                    onChange={e => onChangeDni(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, dni: true }))}
                    placeholder="20.123.456"
                    aria-invalid={!!errorDni && !!touched.dni}
                    maxLength={12}
                  />
                  {touched.dni && errorDni && (
                    <p className={s.fieldError}>{errorDni}</p>
                  )}
                  <p className={s.helper}>Si ya sos clienta, lo usamos para confirmar tu identidad.</p>
                </div>
                <div className={s.formRow}>
                  <label className={s.label}>Teléfono *</label>
                  <input
                    className={s.input}
                    type="tel"
                    inputMode="tel"
                    value={telefono}
                    onChange={e => onChangeTelefono(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, telefono: true }))}
                    placeholder="11 5555-1234"
                    aria-invalid={!!errorTelefono && !!touched.telefono}
                    maxLength={20}
                  />
                  {touched.telefono && errorTelefono && (
                    <p className={s.fieldError}>{errorTelefono}</p>
                  )}
                  {!errorTelefono && <p className={s.helper}>Solo dígitos. Sin el 0 ni el 15. Ej: 11 5555-1234.</p>}
                </div>
                <div className={s.formRow}>
                  <label className={s.label}>Email</label>
                  <input
                    className={s.input}
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setTouched(t => ({ ...t, email: true }))}
                    placeholder="opcional@correo.com"
                    aria-invalid={!!errorEmail && !!touched.email}
                  />
                  {touched.email && errorEmail && (
                    <p className={s.fieldError}>{errorEmail}</p>
                  )}
                </div>

                <p className={s.helper}>
                  Confirmás los datos y te llevamos a WhatsApp para coordinar el pago de la seña.
                </p>

                {TURNSTILE_SITE_KEY && (
                  <Turnstile
                    siteKey={TURNSTILE_SITE_KEY}
                    onToken={handleTurnstileToken}
                    onError={() => setTurnstileToken('')}
                  />
                )}
              </>
            )}

            {step === 5 && reservaCreada && (
              <>
                <h2 className={s.h1}>¡Reserva tomada!</h2>
                <p className={s.lead}>
                  Tu turno está apartado. El último paso es coordinar la seña por WhatsApp:
                  el negocio te pasa el link de Mercado Pago o el alias para transferir.
                </p>

                {reservaCreada.cliente_conflicto_datos && (
                  <div className={s.warningBox}>
                    Detectamos que algunos de tus datos difieren de los que ya teníamos registrados.
                    No te preocupes — la reserva está tomada y coordinamos por WhatsApp si hace falta corregir algo.
                  </div>
                )}

                <div className={s.summary}>
                  <div>
                    <span>N° reserva</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}>
                      #{codigoReserva(reservaCreada.turno.id)}
                    </span>
                  </div>
                  {serviciosObjs.map((sv, i) => {
                    const offset = serviciosObjs.slice(0, i).reduce((a, x) => a + x.duracion_min, 0)
                    const hora = new Date(new Date(slotInicio).getTime() + offset * 60_000)
                    return (
                      <div key={sv.id}>
                        <span>{sv.nombre}</span>
                        <span>{labelHora(hora.toISOString())} · ${formatARS(sv.precio)}</span>
                      </div>
                    )
                  })}
                  {profesional && (
                    <div>
                      <span>Profesional</span>
                      <span>{profesional.nombre} {profesional.apellido ?? ''}</span>
                    </div>
                  )}
                  <div>
                    <span>Fecha</span>
                    <span>{labelFechaCompleta(slotInicio)}</span>
                  </div>
                  <div>
                    <span>Total</span>
                    <span>${formatARS(precioTotal)}</span>
                  </div>
                </div>

                {configSena?.whatsapp_negocio ? (
                  <a
                    className={s.btnWhatsapp}
                    href={armarLinkWhatsapp({
                      telefono: configSena.whatsapp_negocio,
                      codigoReserva: codigoReserva(reservaCreada.turno.id),
                      servicios: serviciosObjs.map(sv => sv.nombre),
                      fecha: slotInicio,
                      profesional: profesional ? `${profesional.nombre} ${profesional.apellido ?? ''}`.trim() : '',
                      cliente: nombre.trim(),
                      total: precioTotal,
                      nombreNegocio: configSena.nombre_negocio,
                    })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsappIcon />
                    <span>Coordinar pago por WhatsApp</span>
                  </a>
                ) : (
                  <div className={s.success} style={{ background: '#FBF7F0', borderColor: 'var(--rose-d)', color: 'var(--ink)' }}>
                    <strong>Reserva tomada con código #{codigoReserva(reservaCreada.turno.id)}.</strong>
                    <div style={{ marginTop: 6 }}>
                      Para coordinar el pago, escribinos por Instagram <a href="https://instagram.com" target="_blank" rel="noreferrer">@delfinapaz</a> o
                      al teléfono del negocio. Mencionale a la profesional el código de la reserva.
                    </div>
                  </div>
                )}

                <p className={s.helper} style={{ textAlign: 'center', marginTop: 16 }}>
                  Tu turno queda reservado hasta que confirmemos el pago de la seña.
                </p>
              </>
            )}

            {step < 5 && (
              <div className={s.actions}>
                {step > 1 && (
                  <button className={s.btnSec} type="button" onClick={volver} disabled={submitting}>
                    Volver
                  </button>
                )}
                <button className={s.btnPri} type="button" onClick={siguiente} disabled={submitting}>
                  {step === 4 ? (submitting ? 'Reservando…' : 'Confirmar reserva') : 'Siguiente'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5L4.5 9L10 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WhatsappIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.02 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.889-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884zM20.52 3.449C18.24 1.245 15.24 0 12.057 0 5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.561 0 11.896-5.336 11.899-11.893a11.821 11.821 0 00-3.429-8.413z" />
    </svg>
  )
}

function codigoReserva(id: string): string {
  return id.slice(-8).toUpperCase()
}

function armarLinkWhatsapp(opts: {
  telefono: string
  codigoReserva: string
  servicios: string[]
  fecha: string
  profesional: string
  cliente: string
  total: number
  nombreNegocio: string
}): string {
  const fechaFmt = new Date(opts.fecha).toLocaleString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
  const totalFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(opts.total)
  const serviciosTxt = opts.servicios.join(' + ')
  const lineas = [
    `Hola ${opts.nombreNegocio}, hice una reserva online para *${serviciosTxt}*.`,
    '',
    `Reserva *#${opts.codigoReserva}*`,
    `Cliente: ${opts.cliente}`,
    `Fecha: ${fechaFmt}`,
    opts.profesional ? `Profesional: ${opts.profesional}` : '',
    `Total: $${totalFmt}`,
    '',
    `Necesito coordinar el pago de la seña, ¿me pasás el medio de pago?`,
  ].filter(Boolean).join('\n')
  return `https://wa.me/${opts.telefono}?text=${encodeURIComponent(lineas)}`
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}
function labelDow(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short' })
}
function labelDia(iso: string) {
  return new Date(iso + 'T00:00:00').getDate().toString()
}
function labelMes(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { month: 'short' })
}
function labelHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
function labelFechaCompleta(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
}
