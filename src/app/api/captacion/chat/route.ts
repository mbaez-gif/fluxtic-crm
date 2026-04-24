import { type NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const SYSTEM_PROMPT = `Sos un asistente comercial de Fluxtic, una consultora tecnológica especializada en ayudar a PyMEs a digitalizar y optimizar sus procesos.

Tu rol es hacer una precalificación amigable de potenciales clientes en una conversación natural.

OBJETIVO: Obtener la siguiente información durante la conversación:
1. Nombre completo
2. Empresa
3. Email de contacto
4. Teléfono (opcional)
5. Rubro o industria
6. Principal desafío o problema que quieren resolver
7. Urgencia (inmediata / próximos meses / explorando)
8. Tamaño aproximado del equipo

INSTRUCCIONES:
- Sé cálido, profesional y conciso
- Hacé UNA sola pregunta por vez
- No preguntés todo de golpe
- Si ya tenés la info de un campo, no la volvás a pedir
- Cuando tengas nombre, empresa, email y el problema principal, indicá que un consultor los contactará pronto
- Respondé siempre en español
- Máximo 2-3 oraciones por respuesta
- Si preguntan algo sobre Fluxtic, respondé brevemente y volvé a la precalificación

Cuando tengas suficiente información para crear el lead, terminá tu mensaje con exactamente este texto en una línea nueva:
[LEAD_COMPLETO]`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })
    }

    // Build conversation history for Gemini
    const contents = [
      { role: 'user',  parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: '¡Hola! Soy el asistente de Fluxtic. Estoy aquí para entender cómo podemos ayudarte. ¿Cuál es tu nombre?' }] },
      ...messages.map((m: { role: string; content: string }) => ({
        role:  m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    ]

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature:     0.7,
          maxOutputTokens: 300,
        },
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Error al llamar a Gemini' }, { status: 500 })
    }

    const data    = await response.json()
    const text    = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const isReady = text.includes('[LEAD_COMPLETO]')
    const clean   = text.replace('[LEAD_COMPLETO]', '').trim()

    return NextResponse.json({ success: true, message: clean, leadReady: isReady })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
