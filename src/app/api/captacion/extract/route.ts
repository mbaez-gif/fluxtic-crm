import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function POST(req: NextRequest) {
  try {
    const { messages, conversationId } = await req.json()

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
  "tamanoEquipo": "cantidad aproximada de personas",
  "resumen": "resumen de 2-3 oraciones del lead para el consultor",
  "prioridad": "alta o media o baja basado en urgencia y problema"
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

    let leadData
    try { leadData = JSON.parse(clean) } catch { leadData = {} }

    // Save lead to Firestore if we have minimum data
    let leadId = null
    if (leadData.email || leadData.nombre) {
      const conversationText2 = messages
        .map((m: { role: string; content: string }) =>
          `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`)
        .join('\n\n')

      const ref = await addDoc(collection(db, 'leads'), {
        nombre:        leadData.nombre || 'Sin nombre',
        empresa:       leadData.empresa || 'Sin empresa',
        email:         leadData.email || '',
        telefono:      leadData.telefono || '',
        fuente:        'chat_bot',
        estado:        'nuevo',
        responsableId: '',
        notas:         `[Bot IA]\nRubro: ${leadData.rubro || '-'}\nProblema: ${leadData.problema || '-'}\nUrgencia: ${leadData.urgencia || '-'}\nEquipo: ${leadData.tamanoEquipo || '-'}\nPrioridad: ${leadData.prioridad || '-'}\n\nResumen: ${leadData.resumen || '-'}\n\nConversación:\n${conversationText2}`,
        creadoEn:      serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })
      leadId = ref.id

      // Slack notification
      if (process.env.SLACK_WEBHOOK_URL) {
        fetch(process.env.SLACK_WEBHOOK_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🤖 Nuevo lead captado por bot\n*${leadData.nombre || 'Sin nombre'}* — ${leadData.empresa || 'Sin empresa'}\nProblema: ${leadData.problema || '-'}\nPrioridad: ${leadData.prioridad || 'media'}`,
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
