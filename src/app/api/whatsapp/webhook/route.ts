export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

const FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const FIREBASE_API_KEY  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const WA_VERIFY_TOKEN   = process.env.WA_VERIFY_TOKEN ?? 'fluxtic_verify_2026'

// ── Firestore REST helpers ────────────────────────────────
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
    if (k === 'creadoEn' || k === 'actualizadoEn' || k === 'lastMessageAt') {
      fields[k] = { timestampValue: now }
    } else {
      fields[k] = toFSValue(v)
    }
  }
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${col}?key=${FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) }
  )
}

async function queryFirestore(col: string, field: string, value: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from:  [{ collectionId: col }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
        limit: 1,
      },
    }),
  })
  const data = await res.json()
  if (Array.isArray(data) && data[0]?.document) {
    const doc = data[0].document
    return { id: doc.name.split('/').pop(), fields: doc.fields }
  }
  return null
}

async function updateFirestore(col: string, id: string, data: Record<string, unknown>) {
  const now    = new Date().toISOString()
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (k === 'actualizadoEn' || k === 'lastMessageAt') {
      fields[k] = { timestampValue: now }
    } else {
      fields[k] = toFSValue(v)
    }
  }
  const fieldPaths = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&')
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${col}/${id}?${fieldPaths}&key=${FIREBASE_API_KEY}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) }
  )
}

// ── GET — Meta webhook verification ──────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ── POST — Receive messages from Meta ────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Process each entry
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue

        const value    = change.value
        const messages = value.messages ?? []
        const contacts = value.contacts ?? []
        const metadata = value.metadata ?? {}

        for (const msg of messages) {
          const fromNumber  = msg.from                          // sender number
          const toNumber    = metadata.display_phone_number     // our number
          const contactName = contacts.find((c: any) => c.wa_id === fromNumber)?.profile?.name ?? fromNumber
          const msgText     = msg.text?.body ?? msg.caption ?? `[${msg.type}]`
          const waMessageId = msg.id

          // Find or create conversation
          let conversationId: string
          const existing = await queryFirestore('waConversations', 'contactNumber', fromNumber)

          if (existing) {
            conversationId = existing.id
            await updateFirestore('waConversations', conversationId, {
              lastMessage:   msgText,
              lastMessageAt: '__ts__',
              actualizadoEn: '__ts__',
              unreadCount:   (parseInt(existing.fields?.unreadCount?.integerValue ?? '0') + 1),
              status:        'open',
            })
          } else {
            // Create new conversation
            await saveToFirestore('waConversations', {
              contactNombre:  contactName,
              contactNumber:  fromNumber,
              lastMessage:    msgText,
              lastMessageAt:  '__ts__',
              status:         'open',
              unreadCount:    1,
              creadoEn:       '__ts__',
              actualizadoEn:  '__ts__',
            })
            const newConv = await queryFirestore('waConversations', 'contactNumber', fromNumber)
            conversationId = newConv?.id ?? 'unknown'
          }

          // Save message
          await saveToFirestore('waMessages', {
            conversationId,
            waMessageId,
            direction:   'inbound',
            type:        msg.type ?? 'text',
            body:        msgText,
            status:      'received',
            fromNumber,
            toNumber:    toNumber ?? '',
            creadoEn:    '__ts__',
          })

          // Slack notification for new inbound message
          if (process.env.SLACK_WEBHOOK_URL) {
            fetch(process.env.SLACK_WEBHOOK_URL, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: `💬 *WhatsApp* — Nuevo mensaje de ${contactName} (${fromNumber})\n"${msgText}"`,
              }),
            }).catch(() => {})
          }
        }

        // Process status updates
        for (const status of value.statuses ?? []) {
          const waMessageId = status.id
          const newStatus   = status.status  // sent | delivered | read | failed
          // Find message by waMessageId and update — simplified
          console.log(`WA status update: ${waMessageId} → ${newStatus}`)
        }
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
