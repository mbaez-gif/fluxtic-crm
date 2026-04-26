export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const PROMPT = `Analizá este documento administrativo. Puede ser una factura, recibo, ticket, comprobante de transferencia, comprobante bancario o comprobante de pago.

Devolvé únicamente JSON válido. No uses Markdown. No agregues texto antes ni después del JSON. No inventes datos. Si un dato no está presente, devolvé null.

El JSON debe respetar exactamente esta estructura:
{
  "vendorName": null, "vendorTaxId": null, "documentDate": null, "dueDate": null,
  "documentType": null, "documentNumber": null, "pointOfSale": null, "fullDocumentNumber": null,
  "description": null, "subtotal": null, "taxes": null, "otherTaxes": null, "totalAmount": null,
  "currency": null, "paymentMethodDetected": null, "bankAccountDetected": null,
  "cbuDetected": null, "aliasDetected": null, "cae": null, "caeDueDate": null, "taxCondition": null,
  "suggestedCategoryName": null, "suggestedExpenseType": null, "suggestedPeriod": null,
  "suggestedIsRecurring": false,
  "confidence": { "vendorName": 0, "vendorTaxId": 0, "documentDate": 0, "documentNumber": 0, "totalAmount": 0, "currency": 0, "category": 0, "expenseType": 0 },
  "requiresReview": true,
  "reviewReasons": []
}

Categorías válidas: "Software y suscripciones", "Google Workspace", "IA y automatización", "Infraestructura y hosting", "Dominio y DNS", "Marketing y publicidad", "Diseño gráfico y branding", "Herramientas comerciales", "Comisiones bancarias", "Impuestos y tasas", "Servicios profesionales", "Movilidad y reuniones", "Equipamiento", "Gastos de clientes", "Gastos de proyectos", "Otros".
Tipos válidos: "operating", "fixed_monthly", "annual", "project", "client", "commercial", "marketing", "infrastructure", "reimbursable", "initial_investment", "other".
Si moneda es USD → requiresReview true. Si falta proveedor, fecha o importe → requiresReview true.`

export async function POST(req: NextRequest) {
  try {
    const { fileBase64, mimeType } = await req.json()
    if (!fileBase64 || !mimeType) {
      return NextResponse.json({ error: 'fileBase64 y mimeType requeridos' }, { status: 400 })
    }
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })
    }

    const isPDF   = mimeType === 'application/pdf'
    const isImage = mimeType.startsWith('image/')
    if (!isPDF && !isImage) {
      return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 400 })
    }

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType, data: fileBase64 } }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Error al procesar con Gemini' }, { status: 500 })
    }

    const data  = await response.json()
    const text  = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed
    try { parsed = JSON.parse(clean) }
    catch { return NextResponse.json({ error: 'No se pudo interpretar el documento', raw: text, parsed: null }) }

    return NextResponse.json({ success: true, interpretation: parsed })
  } catch (err) {
    console.error('Process document error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
