import { type NextRequest, NextResponse } from 'next/server'
import { createCalendarEvent, getUpcomingEvents } from '@/lib/google/calendar'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      uid, titulo, descripcion,
      fechaInicio, fechaFin, attendees,
      vinculadoTipo, vinculadoId, addMeet,
    } = body

    if (!uid || !titulo || !fechaInicio || !fechaFin || !vinculadoTipo || !vinculadoId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const result = await createCalendarEvent({
      uid,
      titulo,
      descripcion,
      fechaInicio:   new Date(fechaInicio),
      fechaFin:      new Date(fechaFin),
      attendees:     attendees ?? [],
      vinculadoTipo,
      vinculadoId,
      addMeet:       addMeet ?? true,
    })

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
  } catch (err) {
    console.error('Calendar API error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid  = searchParams.get('uid')
  const days = parseInt(searchParams.get('days') ?? '7')

  if (!uid) {
    return NextResponse.json({ error: 'uid requerido' }, { status: 400 })
  }

  const events = await getUpcomingEvents(uid, days)
  return NextResponse.json({ events })
}
