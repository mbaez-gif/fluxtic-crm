'use client'

import { useState }        from 'react'
import { useForm }         from 'react-hook-form'
import { zodResolver }     from '@hookform/resolvers/zod'
import { z }               from 'zod'
import { useCollection }   from '@/lib/hooks/useCollection'
import { createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore'
import { db }              from '@/lib/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { PageHeader }      from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import type { Abono, AbonoEstado, AbonoPeriodicidad, Cliente, Pago } from '@/types'
import { cn }              from '@/lib/utils'
import { format, addMonths, addQuarters, addYears, isAfter, addDays } from 'date-fns'
import { es }              from 'date-fns/locale'
import { Timestamp as FSTimestamp } from 'firebase/firestore'
import type { Timestamp }  from 'firebase/firestore'
import {
  Plus, X, CreditCard, Pencil, Trash2,
  MoreHorizontal, CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react'

const ESTADOS: AbonoEstado[]      = ['activo', 'pausado', 'cancelado']
const PERIODICIDADES: AbonoPeriodicidad[] = ['mensual', 'trimestral', 'anual']
const ESTADO_BADGE: Record<AbonoEstado, 'teal' | 'warning' | 'danger'> = {
  activo:   'teal',
  pausado:  'warning',
  cancelado:'danger',
}

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

function nextRenovacion(fecha: Date, periodicidad: AbonoPeriodicidad): Date {
  if (periodicidad === 'mensual')    return addMonths(fecha, 1)
  if (periodicidad === 'trimestral') return addQuarters(fecha, 1)
  return addYears(fecha, 1)
}

const schema = z.object({
  clienteId:    z.string().min(1, 'Selecciona un cliente'),
  nombre:       z.string().min(2, 'Requerido'),
  descripcion:  z.string().min(5, 'Requerido'),
  monto:        z.coerce.number().min(1, 'Debe ser mayor a 0'),
  periodicidad: z.enum(['mensual', 'trimestral', 'anual']),
  fechaInicio:  z.string().min(1, 'Requerido'),
  estado:       z.enum(['activo', 'pausado', 'cancelado']),
})
type FormValues = z.infer<typeof schema>

// ── Modal ─────────────────────────────────────────────────
function AbonoModal({ abono, clientes, onClose }: {
  abono?:   Abono
  clientes: Cliente[]
  onClose:  () => void
}) {
  const isEdit = !!abono
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: abono
      ? { ...abono, fechaInicio: format(toDate(abono.fechaInicio), 'yyyy-MM-dd') }
      : { estado: 'activo', periodicidad: 'mensual' },
  })

  async function onSubmit(values: FormValues) {
    const fechaInicio    = new Date(values.fechaInicio)
    const fechaRenovacion = nextRenovacion(fechaInicio, values.periodicidad)
    const payload = {
      ...values,
      fechaInicio:     FSTimestamp.fromDate(fechaInicio),
      fechaRenovacion: FSTimestamp.fromDate(fechaRenovacion),
    }
    if (isEdit && abono) {
      await updateDocById<Abono>('abonos', abono.id, payload)
    } else {
      await createDoc<Abono>('abonos', payload)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-flux-border">
          <h2 className="font-display font-bold text-base text-flux-white">
            {isEdit ? 'Editar abono' : 'Nuevo abono'}
          </h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Nombre del abono *</label>
              <input className={cn('flux-input', errors.nombre && 'border-flux-danger')}
                placeholder="Ej: Retainer mensual estrategia" {...register('nombre')} />
              {errors.nombre && <p className="mt-1 text-2xs text-flux-danger">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Cliente *</label>
              <select className={cn('flux-input', errors.clienteId && 'border-flux-danger')} {...register('clienteId')}>
                <option value="">Selecciona…</option>
                {clientes.filter(c => c.estado === 'activo').map(c => (
                  <option key={c.id} value={c.id}>{c.empresa}</option>
                ))}
              </select>
              {errors.clienteId && <p className="mt-1 text-2xs text-flux-danger">{errors.clienteId.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado *</label>
              <select className="flux-input" {...register('estado')}>
                {ESTADOS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Monto (€) *</label>
              <input type="number" min="0" className={cn('flux-input', errors.monto && 'border-flux-danger')}
                placeholder="1500" {...register('monto')} />
              {errors.monto && <p className="mt-1 text-2xs text-flux-danger">{errors.monto.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Periodicidad *</label>
              <select className="flux-input" {...register('periodicidad')}>
                {PERIODICIDADES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Fecha inicio *</label>
              <input type="date" className={cn('flux-input', errors.fechaInicio && 'border-flux-danger')} {...register('fechaInicio')} />
              <p className="mt-1 text-2xs text-flux-text3">La fecha de renovación se calculará automáticamente.</p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Descripción del servicio *</label>
              <textarea rows={3} className={cn('flux-input resize-none', errors.descripcion && 'border-flux-danger')}
                placeholder="Qué incluye este abono…" {...register('descripcion')} />
              {errors.descripcion && <p className="mt-1 text-2xs text-flux-danger">{errors.descripcion.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Guardar' : 'Crear abono'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Abono row with payments ───────────────────────────────
function AbonoRow({ abono, clienteNombre, onEdit, onDelete }: {
  abono:         Abono
  clienteNombre: string
  onEdit:        () => void
  onDelete:      () => void
}) {
  const [expanded,    setExpanded]    = useState(false)
  const [registering, setRegistering] = useState(false)

  const { data: pagos, loading: lp } = useCollection<Pago>(`abonos/${abono.id}/pagos` as any, {
    orderField: 'fechaEmitido', orderDir: 'desc',
  })

  const hoy      = new Date()
  const renovDate = toDate(abono.fechaRenovacion)
  const proxima  = isAfter(addDays(hoy, 7), renovDate) && isAfter(renovDate, hoy)
  const vencida  = isAfter(hoy, renovDate) && abono.estado === 'activo'

  async function registrarPago() {
    setRegistering(true)
    try {
      // Registrar pago
      await addDoc(collection(db, `abonos/${abono.id}/pagos`), {
        abonoId:     abono.id,
        monto:       abono.monto,
        fechaEmitido: serverTimestamp(),
        fechaPagado:  serverTimestamp(),
        estado:       'pagado',
        creadoEn:     serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })
      // Calcular próxima renovación
      const nuevaRenovacion = nextRenovacion(renovDate, abono.periodicidad)
      await updateDocById<Abono>('abonos', abono.id, {
        fechaRenovacion: FSTimestamp.fromDate(nuevaRenovacion),
      })
    } finally {
      setRegistering(false)
    }
  }

  return (
    <>
      <tr className={cn(
        'border-b border-flux-border/50 transition-colors group',
        expanded ? 'bg-flux-muted/20' : 'hover:bg-flux-muted/20'
      )}>
        <td className="px-4 py-3">
          <p className="font-medium text-flux-text1 text-sm">{abono.nombre}</p>
          <p className="text-2xs text-flux-text3">{abono.descripcion}</p>
        </td>
        <td className="px-4 py-3 text-xs text-flux-text2">{clienteNombre}</td>
        <td className="px-4 py-3 font-medium text-flux-teal text-sm">
          €{abono.monto.toLocaleString('es-ES')}
          <span className="text-2xs text-flux-text3 font-normal ml-1">/{abono.periodicidad.slice(0, 3)}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {vencida && <AlertTriangle size={12} className="text-flux-danger" />}
            {proxima && !vencida && <AlertTriangle size={12} className="text-flux-warning" />}
            <span className={cn('text-xs', vencida ? 'text-flux-danger' : proxima ? 'text-flux-warning' : 'text-flux-text2')}>
              {format(renovDate, "d MMM yyyy", { locale: es })}
            </span>
          </div>
        </td>
        <td className="px-4 py-3"><Badge variant={ESTADO_BADGE[abono.estado]}>{abono.estado}</Badge></td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            {abono.estado === 'activo' && (
              <button onClick={registrarPago} disabled={registering}
                className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1.5">
                {registering
                  ? <div className="w-3 h-3 border-2 border-flux-border border-t-flux-teal rounded-full animate-spin" />
                  : <CheckCircle size={11} />}
                Pago cobrado
              </button>
            )}
            <button onClick={() => setExpanded(e => !e)}
              className="text-flux-text3 hover:text-flux-text1 p-1 transition-colors">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button onClick={onEdit} className="text-flux-text3 hover:text-flux-text1 p-1 transition-all">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} className="text-flux-text3 hover:text-flux-danger p-1 transition-all">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {/* Pagos expandidos */}
      {expanded && (
        <tr className="border-b border-flux-border/50 bg-flux-surface/30">
          <td colSpan={6} className="px-6 py-3">
            <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-2">Historial de pagos</p>
            {lp ? (
              <div className="flex items-center gap-2 text-flux-text3 text-xs"><Spinner size={12} /> Cargando…</div>
            ) : pagos.length === 0 ? (
              <p className="text-xs text-flux-text3">Sin pagos registrados todavía.</p>
            ) : (
              <div className="space-y-1.5">
                {pagos.map(p => (
                  <div key={p.id} className="flex items-center gap-4 text-xs">
                    <span className="text-flux-text3 w-24">
                      {p.fechaPagado ? format(toDate(p.fechaPagado), "d MMM yyyy", { locale: es }) : '—'}
                    </span>
                    <span className="text-flux-teal font-medium">€{p.monto.toLocaleString('es-ES')}</span>
                    <Badge variant="teal">{p.estado}</Badge>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function AbonosPage() {
  const { data: abonos,  loading: la } = useCollection<Abono>('abonos')
  const { data: clientes,loading: lc } = useCollection<Cliente>('clientes')

  const [modal,     setModal]     = useState<'new' | Abono | null>(null)
  const [filterEst, setFilterEst] = useState<AbonoEstado | 'todos'>('todos')

  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]))

  const mrr = abonos.filter(a => a.estado === 'activo').reduce((acc, a) => {
    if (a.periodicidad === 'mensual')    return acc + a.monto
    if (a.periodicidad === 'trimestral') return acc + a.monto / 3
    return acc + a.monto / 12
  }, 0)

  const filtered = abonos.filter(a => filterEst === 'todos' || a.estado === filterEst)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este abono?')) return
    await deleteDocById('abonos', id)
  }

  const loading = la || lc

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Abonos"
          subtitle={`MRR: €${Math.round(mrr).toLocaleString('es-ES')} · ${abonos.filter(a => a.estado === 'activo').length} activos`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nuevo abono
            </button>
          }
        />

        <div className="px-8 pb-10 space-y-5">
          {/* MRR cards */}
          <div className="grid grid-cols-3 gap-4">
            {(['mensual', 'trimestral', 'anual'] as AbonoPeriodicidad[]).map(p => {
              const total = abonos.filter(a => a.estado === 'activo' && a.periodicidad === p)
                .reduce((acc, a) => acc + a.monto, 0)
              return (
                <div key={p} className="flux-card text-center">
                  <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1 capitalize">{p}</p>
                  <p className="font-display text-xl font-bold text-flux-white">€{total.toLocaleString('es-ES')}</p>
                </div>
              )
            })}
          </div>

          {/* Filters */}
          <div className="flex gap-1.5">
            {(['todos', ...ESTADOS] as const).map(e => (
              <button key={e} onClick={() => setFilterEst(e)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filterEst === e ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center"><Spinner /> Cargando…</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<CreditCard size={40} />} title="Sin abonos"
              description="Los abonos son contratos recurrentes con tus clientes."
              action={<button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2"><Plus size={14} /> Crear abono</button>} />
          ) : (
            <div className="flux-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Abono', 'Cliente', 'Monto', 'Próx. renovación', 'Estado', ''].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(abono => (
                    <AbonoRow
                      key={abono.id}
                      abono={abono}
                      clienteNombre={clienteMap[abono.clienteId]?.empresa ?? '—'}
                      onEdit={() => setModal(abono)}
                      onDelete={() => handleDelete(abono.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal !== null && (
        <AbonoModal
          abono={modal === 'new' ? undefined : modal}
          clientes={clientes}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
