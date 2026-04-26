import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/config'
import { collection, getDocs, query, where } from 'firebase/firestore'

export async function POST(req: NextRequest) {
  try {
    const { vendorName, vendorTaxId, documentNumber, totalAmount, currency, documentDate } = await req.json()

    const suspects: any[] = []

    // Search by vendor tax ID + document number (strongest match)
    if (vendorTaxId && documentNumber) {
      const q = query(collection(db, 'adminGastos'),
        where('proveedorTaxId', '==', vendorTaxId))
      const snap = await getDocs(q)
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.documentNumber === documentNumber) {
          suspects.push({ id: d.id, ...data, matchReason: 'CUIT + Nº comprobante' })
        }
      })
    }

    // Search by vendor name + amount + date
    if (suspects.length === 0 && vendorName && totalAmount) {
      const snap = await getDocs(collection(db, 'adminGastos'))
      snap.docs.forEach(d => {
        const data = d.data()
        const sameName   = data.proveedorNombre?.toLowerCase().includes(vendorName.toLowerCase().slice(0, 6))
        const sameAmount = Math.abs(data.importe - totalAmount) < 0.01
        const sameCurr   = !currency || data.moneda === currency

        if (sameName && sameAmount && sameCurr) {
          suspects.push({ id: d.id, ...data, matchReason: 'Proveedor + importe' })
        }
      })
    }

    return NextResponse.json({
      hasDuplicates: suspects.length > 0,
      suspects:      suspects.slice(0, 3),
    })
  } catch (err) {
    console.error('Duplicate check error:', err)
    return NextResponse.json({ hasDuplicates: false, suspects: [] })
  }
}
