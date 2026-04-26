export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
const FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const FIREBASE_API_KEY  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function saveLeadToFirestore(data: Record<string, string | null>) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/leads?key=${FIREBASE_API_KEY}`
  const now  = new Date().toISOString()

  const fields: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data)) {
    if (key === 'creadoEn' || key === 'actualizadoEn') {
      fields[key] = { timestampValue: now }
    } else {
      fields[key] = val ? { stringValue: val } : { nullValue: null }
    }
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  })

  if (!res.ok) throw new Error(`Firestore error: ${await res.text()}`)
  const doc = await res.json()
  return doc.name?.split('/').pop() ?? null
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })
    }

    const conversationText = messages
      .map((m: { role: string; content: string }) =>
        `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
      .join('\n')

    const prompt = `Analizá esta conversación de precalificación y extraé los datos del lead.
Respondé ÚNICAMENTE con JSON válido, sin markdown:

CONVERSACIÓN:
${conversationText}

JSON esperado:
{
  "nombre": "nombre completo o vacío",
  "empresa": "nombre de la empresa o vacío",
  "email": "email o vacío",
  "telefono": "teléfono o vacío",
  "rubro": "industria o sector",
  "problema": "principal desafío mencionado",
  "urgencia": "inmediata o proximos_meses o explorando",
  "tamanoEquipo": "cantidad aproximada",
  "resumen": "resumen de 2-3 oraciones para el consultor",
  "prioridad": "alta o media o baja"
}`

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    })

    const data  = await response.json()
    const text  = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let leadData: Record<string, string | null> = {}
    try { leadData = JSON.parse(clean) } catch { leadData = {} }

    // Save to Firestore via REST (no SDK)
    let leadId = null
    if (leadData.email || leadData.nombre) {
      const conversationLog = messages
        .map((m: { role: string; content: string }) =>
          `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`)
        .join('\n\n')

      const notas = [
        `[Bot IA]`,
        leadData.rubro    ? `Rubro: ${leadData.rubro}` : '',
        leadData.problema ? `Problema: ${leadData.problema}` : '',
        leadData.urgencia ? `Urgencia: ${leadData.urgencia}` : '',
        leadData.tamanoEquipo ? `Equipo: ${leadData.tamanoEquipo}` : '',
        leadData.prioridad ? `Prioridad: ${leadData.prioridad}` : '',
        leadData.resumen  ? `\nResumen: ${leadData.resumen}` : '',
        `\nConversación:\n${conversationLog}`,
      ].filter(Boolean).join('\n')

      leadId = await saveLeadToFirestore({
        nombre:        leadData.nombre || 'Sin nombre',
        empresa:       leadData.empresa || 'Sin empresa',
        email:         leadData.email || '',
        telefono:      leadData.telefono || '',
        fuente:        'chat_bot',
        estado:        'nuevo',
        responsableId: '',
        notas,
        creadoEn:      '__timestamp__',
        actualizadoEn: '__timestamp__',
      })

      // Slack notification
      if (process.env.SLACK_WEBHOOK_URL) {
        fetch(process.env.SLACK_WEBHOOK_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🤖 Nuevo lead por bot\n*${leadData.nombre || 'Sin nombre'}* — ${leadData.empresa || 'Sin empresa'}\nProblema: ${leadData.problema || '-'}\nPrioridad: ${leadData.prioridad || 'media'}`,
          }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true, leadData, leadId })
  } catch (err) {
    console.error('Extract lead error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
