export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

const WA_PHONE_ID    = process.env.WA_PHONE_NUMBER_ID
const WA_TOKEN       = process.env.WA_ACCESS_TOKEN
const FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const FIREBASE_API_KEY  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

function toFSValue(val: unknown): unknown {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'string')  return { stringValue: val }
  if (typeof val === 'number')  return { integerValue: String(Math.floor(val)) }
  if (typeof val === 'boolean') return { booleanValue: val }
  return { stringValue: String(val) }
}

async function saveToFirestore(col: string, data: Record<string, unknown>) {
  const now    = new Date().toISOString()
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (k === 'creadoEn' || k === 'actualizadoEn') {
      fields[k] = { timestampValue: now }
    } else {
      fields[k] = toFSValue(v)
    }
  }
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${col}?key=${FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) }
  )
  const doc = await res.json()
  return doc.name?.split('/').pop() ?? null
}

export async function POST(req: NextRequest) {
  try {
    const {
      to,               // phone number without +
      type = 'text',    // text | template
      body,             // for text messages
      templateName,     // for template messages
      templateVars,     // { nombre: 'Juan', empresa: 'Acme' }
      conversationId,
      senderNombre,
    } = await req.json()

    if (!to || (!body && !templateName)) {
      return NextResponse.json({ error: 'to y body/templateName son requeridos' }, { status: 400 })
    }

    if (!WA_PHONE_ID || !WA_TOKEN) {
      return NextResponse.json({ error: 'WhatsApp no configurado. Falta WA_PHONE_NUMBER_ID o WA_ACCESS_TOKEN.' }, { status: 500 })
    }

    // Build Meta API payload
    let payload: Record<string, unknown>

    if (type === 'template' && templateName) {
      // Build template components with variables
      const components = templateVars && Object.keys(templateVars).length > 0
        ? [{
            type: 'body',
            parameters: Object.values(templateVars).map(v => ({
              type: 'text',
              text: String(v),
            })),
          }]
        : []

      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name:     templateName,
          language: { code: 'es_AR' },
          ...(components.length > 0 && { components }),
        },
      }
    } else {
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body, preview_url: false },
      }
    }

    // Send via Meta Cloud API
    const waRes = await fetch(
      `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${WA_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    )

    const waData = await waRes.json()

    if (!waRes.ok) {
      console.error('Meta API error:', waData)
      return NextResponse.json({
        error: waData.error?.message ?? 'Error al enviar mensaje de WhatsApp',
      }, { status: 500 })
    }

    const waMessageId = waData.messages?.[0]?.id ?? ''

    // Save outbound message to Firestore
    if (conversationId) {
      await saveToFirestore('waMessages', {
        conversationId,
        waMessageId,
        direction:    'outbound',
        type:         type === 'template' ? 'template' : 'text',
        body:         body ?? `[Template: ${templateName}]`,
        status:       'sent',
        fromNumber:   WA_PHONE_ID,
        toNumber:     to,
        templateName: templateName ?? null,
        senderNombre: senderNombre ?? 'Fluxtic',
        creadoEn:     '__ts__',
      })
    }

    return NextResponse.json({ success: true, waMessageId })
  } catch (err) {
    console.error('WhatsApp send error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
