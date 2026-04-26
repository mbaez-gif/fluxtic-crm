export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function POST(req: NextRequest) {
  try {
    const { notas, seccion } = await req.json()

    if (!notas?.trim()) {
      return NextResponse.json({ error: 'Se requieren notas para analizar' }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })
    }

    const prompt = `Sos un consultor tecnológico experto en diagnóstico de PyMEs.
Analizá las siguientes notas de una reunión de diagnóstico y extraé respuestas estructuradas para el formulario.

NOTAS DE LA REUNIÓN:
${notas}

${seccion ? `ENFOCATE EN: ${seccion}` : 'Analizá todo el contenido'}

Respondé ÚNICAMENTE con un JSON válido con esta estructura (sin markdown, sin explicaciones):
{
  "hallazgos": "principales problemas detectados",
  "oportunidades": "oportunidades de mejora identificadas",
  "contexto": "descripción del negocio si se menciona",
  "tecnologia": "herramientas tecnológicas mencionadas",
  "procesos": "procesos internos identificados",
  "seguridad": "aspectos de seguridad mencionados",
  "numeros": "datos económicos o financieros mencionados",
  "cierre": "objetivos y próximos pasos mencionados",
  "tipoCliente": "abono o proyecto o no_califica (tu recomendación basada en las notas)",
  "prioridad": "alta o media o baja",
  "resumenEjecutivo": "resumen de 2-3 oraciones para el consultor",
  "proximaAccion": "acción recomendada más urgente"
}`

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.3,
          maxOutputTokens: 1000,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Error al llamar a Gemini API' }, { status: 500 })
    }

    const data  = await response.json()
    const text  = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Parse JSON from response
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let parsed

    try {
      parsed = JSON.parse(clean)
    } catch {
      // If JSON parse fails, return raw text
      return NextResponse.json({ success: true, raw: text, parsed: null })
    }

    return NextResponse.json({ success: true, parsed })
  } catch (err) {
    console.error('Gemini route error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
