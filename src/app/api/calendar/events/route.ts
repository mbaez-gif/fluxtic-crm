export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// NO Firebase SDK imports — tokens received from client in request body

async function getOAuthClient(tokens: {
  access_token: string
  refresh_token?: string
  expiry_date?: number
}) {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2.setCredentials(tokens)
  return oauth2
}

export async function POST(req: NextRequest) {
  try {
    const {
      access_token, refresh_token, expiry_date,
      titulo, descripcion, fechaInicio, fechaFin,
      attendees, vinculadoTipo, vinculadoId, addMeet,
    } = await req.json()

    if (!access_token || !titulo || !fechaInicio || !fechaFin) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const auth     = await getOAuthClient({ access_token, refresh_token, expiry_date })
    const calendar = google.calendar({ version: 'v3', auth })

    const res = await calendar.events.insert({
      calendarId:            'primary',
      sendUpdates:           'all',
      conferenceDataVersion: addMeet ? 1 : 0,
      requestBody: {
        summary:     titulo,
        description: descripcion,
        start: { dateTime: new Date(fechaInicio).toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
        end:   { dateTime: new Date(fechaFin).toISOString(),   timeZone: 'America/Argentina/Buenos_Aires' },
        attendees: (attendees ?? []).map((email: string) => ({ email })),
        ...(addMeet && {
          conferenceData: {
            createRequest: {
              requestId:             `fluxtic-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      },
    })

    const meetLink = res.data.conferenceData?.entryPoints?.[0]?.uri ?? undefined

    return NextResponse.json({
      success:  true,
      eventId:  res.data.id,
      meetLink,
      htmlLink: res.data.htmlLink,
    })
  } catch (err: unknown) {
    console.error('Calendar API error:', err)
    const error = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const access_token  = searchParams.get('access_token')
  const refresh_token = searchParams.get('refresh_token') ?? undefined
  const days          = parseInt(searchParams.get('days') ?? '7')

  if (!access_token) {
    return NextResponse.json({ error: 'access_token requerido' }, { status: 400 })
  }

  try {
    const auth     = await getOAuthClient({ access_token, refresh_token })
    const calendar = google.calendar({ version: 'v3', auth })

    const now    = new Date()
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const res = await calendar.events.list({
      calendarId:   'primary',
      timeMin:      now.toISOString(),
      timeMax:      future.toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   20,
    })

    const events = (res.data.items ?? []).map(e => ({
      id:          e.id ?? '',
      titulo:      e.summary ?? 'Sin título',
      fechaInicio: e.start?.dateTime ?? e.start?.date ?? '',
      fechaFin:    e.end?.dateTime   ?? e.end?.date   ?? '',
      attendees:   (e.attendees ?? []).map(a => a.email ?? '').filter(Boolean),
      meetLink:    e.conferenceData?.entryPoints?.[0]?.uri ?? undefined,
    }))

    return NextResponse.json({ events })
  } catch (err) {
    console.error('Calendar list error:', err)
    return NextResponse.json({ events: [] })
  }
}
