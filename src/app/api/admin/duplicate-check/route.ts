import { type NextRequest, NextResponse } from 'next/server'

const FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const FIREBASE_API_KEY  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

export async function POST(req: NextRequest) {
  try {
    const {
      vendorName, vendorTaxId, documentNumber,
      totalAmount, currency,
    } = await req.json()

    if (!FIREBASE_PROJECT || !FIREBASE_API_KEY) {
      return NextResponse.json({ hasDuplicates: false, suspects: [] })
    }

    const suspects: any[] = []

    // Search by CUIT if available
    if (vendorTaxId) {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from:  [{ collectionId: 'adminGastos' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'proveedorTaxId' },
                op:    'EQUAL',
                value: { stringValue: vendorTaxId },
              },
            },
            limit: 5,
          },
        }),
      })

      const data = await res.json()
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (!item.document) return
          const fields = item.document.fields ?? {}
          const docNum  = fields.documentNumber?.stringValue
          const amount  = parseFloat(fields.importe?.integerValue ?? '0')

          if (docNum && docNum === documentNumber) {
            suspects.push({
              id:           item.document.name?.split('/').pop(),
              proveedorNombre: fields.proveedorNombre?.stringValue ?? vendorName,
              importe:      amount,
              matchReason: 'CUIT + Nº comprobante',
            })
          }
        })
      }
    }

    // Search by vendor name + amount if no CUIT match
    if (suspects.length === 0 && vendorName && totalAmount) {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from:  [{ collectionId: 'adminGastos' }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  {
                    fieldFilter: {
                      field: { fieldPath: 'importe' },
                      op:    'EQUAL',
                      value: { integerValue: String(Math.floor(totalAmount)) },
                    },
                  },
                  ...(currency ? [{
                    fieldFilter: {
                      field: { fieldPath: 'moneda' },
                      op:    'EQUAL',
                      value: { stringValue: currency },
                    },
                  }] : []),
                ],
              },
            },
            limit: 5,
          },
        }),
      })

      const data = await res.json()
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (!item.document) return
          const fields      = item.document.fields ?? {}
          const provNombre  = fields.proveedorNombre?.stringValue ?? ''
          const shortSearch = vendorName.toLowerCase().slice(0, 6)

          if (provNombre.toLowerCase().includes(shortSearch)) {
            suspects.push({
              id:              item.document.name?.split('/').pop(),
              proveedorNombre: provNombre,
              importe:         parseFloat(fields.importe?.integerValue ?? '0'),
              matchReason:     'Proveedor + importe',
            })
          }
        })
      }
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
