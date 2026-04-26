import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy, limit,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type {
  Gasto, Proveedor, Categoria, MedioPago,
  CierreMensual, AuditLog, AuditAccion,
  CATEGORIAS_INICIALES, SaldoSocio, CompensacionPago,
} from '@/types/admin'
import { SOCIOS } from '@/types/admin'

// ── Gastos ────────────────────────────────────────────────
export async function createGasto(data: Omit<Gasto, 'id' | 'creadoEn' | 'actualizadoEn'>) {
  const ref = await addDoc(collection(db, 'adminGastos'), {
    ...data,
    creadoEn:      serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  })
  return ref.id
}

export async function updateGasto(id: string, data: Partial<Gasto>) {
  await updateDoc(doc(db, 'adminGastos', id), {
    ...data,
    actualizadoEn: serverTimestamp(),
  })
}

export async function cancelGasto(id: string, uid: string) {
  await updateDoc(doc(db, 'adminGastos', id), {
    estado:        'cancelled',
    anuladoEn:     serverTimestamp(),
    anuladoPorUid: uid,
    actualizadoEn: serverTimestamp(),
  })
}

export async function getGastosByPeriodo(periodo: string): Promise<Gasto[]> {
  const q = query(
    collection(db, 'adminGastos'),
    where('periodo', '==', periodo),
    orderBy('fecha', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Gasto)
}

// ── Proveedores ───────────────────────────────────────────
export async function createProveedor(data: Omit<Proveedor, 'id' | 'creadoEn' | 'actualizadoEn'>) {
  const ref = await addDoc(collection(db, 'adminProveedores'), {
    ...data,
    nombreNormalizado: normalizeStr(data.nombre),
    creadoEn:          serverTimestamp(),
    actualizadoEn:     serverTimestamp(),
  })
  return ref.id
}

export async function updateProveedor(id: string, data: Partial<Proveedor>) {
  const update: Record<string, unknown> = { ...data, actualizadoEn: serverTimestamp() }
  if (data.nombre) update.nombreNormalizado = normalizeStr(data.nombre)
  await updateDoc(doc(db, 'adminProveedores', id), update)
}

export async function searchProveedores(term: string): Promise<Proveedor[]> {
  const norm = normalizeStr(term)
  const snap = await getDocs(collection(db, 'adminProveedores'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as Proveedor)
    .filter(p => p.activo && p.nombreNormalizado.includes(norm))
    .slice(0, 10)
}

// ── Categorías ────────────────────────────────────────────
export async function getCategorias(): Promise<Categoria[]> {
  const q    = query(collection(db, 'adminCategorias'), orderBy('sortOrder'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Categoria)
}

export async function seedCategorias(items: typeof CATEGORIAS_INICIALES) {
  const existing = await getCategorias()
  if (existing.length > 0) return  // already seeded

  for (const item of items) {
    await addDoc(collection(db, 'adminCategorias'), {
      ...item,
      parentId:     null,
      activo:       true,
      creadoEn:     serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    })
  }
}

// ── Medios de pago ────────────────────────────────────────
export async function createMedioPago(data: Omit<MedioPago, 'id' | 'creadoEn' | 'actualizadoEn'>) {
  const ref = await addDoc(collection(db, 'adminMediosPago'), {
    ...data,
    creadoEn:      serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  })
  return ref.id
}

export async function getMediosPago(): Promise<MedioPago[]> {
  const snap = await getDocs(collection(db, 'adminMediosPago'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as MedioPago)
}

// ── Cierre mensual ────────────────────────────────────────
export function calcularSaldos(gastos: Gasto[]): {
  saldos:       SaldoSocio[]
  compensaciones: CompensacionPago[]
} {
  // Init totals per socio
  const totales: Record<string, { pagado: number; corresponde: number }> = {}
  for (const s of SOCIOS) {
    totales[s.uid] = { pagado: 0, corresponde: 0 }
  }

  for (const g of gastos) {
    if (g.estado === 'cancelled') continue
    const montoARS = g.importeARS ?? g.importe

    // Who paid
    if (totales[g.pagadoPorUid]) {
      totales[g.pagadoPorUid].pagado += montoARS
    }

    // Distribution
    if (g.distribuirEntreSocios && g.distribucion?.length) {
      for (const d of g.distribucion) {
        if (totales[d.uid]) {
          totales[d.uid].corresponde += d.monto
        }
      }
    } else {
      // Split equally among all socios
      const share = montoARS / SOCIOS.length
      for (const s of SOCIOS) {
        if (totales[s.uid]) totales[s.uid].corresponde += share
      }
    }
  }

  const saldos: SaldoSocio[] = SOCIOS.map(s => ({
    uid:              s.uid,
    nombre:           s.nombre,
    totalPagado:      totales[s.uid]?.pagado ?? 0,
    totalCorresponde: totales[s.uid]?.corresponde ?? 0,
    saldo:            (totales[s.uid]?.pagado ?? 0) - (totales[s.uid]?.corresponde ?? 0),
  }))

  // Calculate minimum compensation payments
  const compensaciones = calcularCompensaciones(saldos)

  return { saldos, compensaciones }
}

// Minimum number of transfers to settle debts
function calcularCompensaciones(saldos: SaldoSocio[]): CompensacionPago[] {
  const compensaciones: CompensacionPago[] = []

  // Creditors (positive balance = others owe them)
  // Debtors (negative balance = they owe others)
  const creditors = saldos
    .filter(s => s.saldo > 0.01)
    .map(s => ({ ...s, restante: s.saldo }))
  const debtors = saldos
    .filter(s => s.saldo < -0.01)
    .map(s => ({ ...s, restante: Math.abs(s.saldo) }))

  let ci = 0; let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]
    const debtor   = debtors[di]
    const monto    = Math.min(creditor.restante, debtor.restante)

    if (monto > 0.01) {
      compensaciones.push({
        deUid:    debtor.uid,
        deNombre: debtor.nombre,
        aUid:     creditor.uid,
        aNombre:  creditor.nombre,
        monto:    Math.round(monto * 100) / 100,
        moneda:   'ARS',
      })
    }

    creditor.restante -= monto
    debtor.restante   -= monto

    if (creditor.restante < 0.01) ci++
    if (debtor.restante   < 0.01) di++
  }

  return compensaciones
}

export async function createCierre(
  periodo: string,
  gastos:  Gasto[],
  uid:     string
): Promise<string> {
  const { saldos, compensaciones } = calcularSaldos(gastos)

  const totalARS = gastos
    .filter(g => g.estado !== 'cancelled' && g.moneda === 'ARS')
    .reduce((acc, g) => acc + g.importe, 0)
  const totalUSD = gastos
    .filter(g => g.estado !== 'cancelled' && g.moneda === 'USD')
    .reduce((acc, g) => acc + g.importe, 0)

  const ref = await addDoc(collection(db, 'adminCierres'), {
    periodo,
    estado:          'draft',
    totalGastosARS:  totalARS,
    totalGastosUSD:  totalUSD,
    cantidadGastos:  gastos.filter(g => g.estado !== 'cancelled').length,
    saldosPorSocio:  saldos,
    compensaciones,
    gastoIds:        gastos.map(g => g.id),
    cerradoPorUid:   uid,
    cerradoEn:       serverTimestamp(),
    creadoEn:        serverTimestamp(),
    actualizadoEn:   serverTimestamp(),
  })

  // Mark gastos as included in cierre
  for (const g of gastos) {
    if (g.estado !== 'cancelled') {
      await updateDoc(doc(db, 'adminGastos', g.id), {
        incluidoEnCierre: true,
        cierreId:         ref.id,
        actualizadoEn:    serverTimestamp(),
      })
    }
  }

  return ref.id
}

// ── Auditoría ─────────────────────────────────────────────
export async function logAudit(params: {
  entidadTipo:  string
  entidadId:    string
  accion:       AuditAccion
  usuarioUid:   string
  usuarioNombre: string
  cambios?:     Record<string, { antes: unknown; despues: unknown }>
  notas?:       string
}) {
  await addDoc(collection(db, 'adminAuditLog'), {
    ...params,
    creadoEn: serverTimestamp(),
  })
}

// ── Utils ─────────────────────────────────────────────────
export function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function getPeriodoActual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonto(monto: number, moneda: string): string {
  const sym = moneda === 'USD' ? 'USD ' : moneda === 'EUR' ? '€' : '$'
  return `${sym}${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
