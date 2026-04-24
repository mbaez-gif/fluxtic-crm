import { google }               from 'googleapis'
import { getAuthenticatedClient } from './oauth'
import { createDoc }            from '@/lib/firebase/firestore'
import type { CalendarEvent, CalendarVinculadoTipo } from '@/types/integrations'
import { Timestamp }            from 'firebase/firestore'

export async function createCalendarEvent({
  uid, titulo, descripcion, fechaInicio, fechaFin,
  attendees, vinculadoTipo, vinculadoId, addMeet = true,
}: {
  uid:           string
  titulo:        string
  descripcion?:  string
  fechaInicio:   Date
  fechaFin:      Date
  attendees:     string[]
  vinculadoTipo: CalendarVinculadoTipo
  vinculadoId:   string
  addMeet?:      boolean
}): Promise<{ success: boolean; eventId?: string; meetLink?: string; error?: string }> {
  try {
    const auth     = await getAuthenticatedClient(uid)
    const calendar = google.calendar({ version: 'v3', auth })

    const res = await calendar.events.insert({
      calendarId:            'primary',
      sendUpdates:           'all',
      conferenceDataVersion: addMeet ? 1 : 0,
      requestBody: {
        summary:     titulo,
        description: descripcion,
        start: { dateTime: fechaInicio.toISOString(), timeZone: 'Europe/Madrid' },
        end:   { dateTime: fechaFin.toISOString(),   timeZone: 'Europe/Madrid' },
        attendees: attendees.map(email => ({ email })),
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

    const googleEventId            = res.data.id ?? ''
    const meetLink: string | undefined =
      res.data.conferenceData?.entryPoints?.[0]?.uri ?? undefined

    await createDoc<CalendarEvent>('calendarEvents', {
      googleEventId,
      titulo,
      descripcion:   descripcion ?? '',
      fechaInicio:   Timestamp.fromDate(fechaInicio),
      fechaFin:      Timestamp.fromDate(fechaFin),
      vinculadoTipo,
      vinculadoId,
      responsableId: uid,
      attendees,
      meetLink:      meetLink ?? '',
    })

    return { success: true, eventId: googleEventId, meetLink }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Error al crear evento'
    return { success: false, error }
  }
}

export async function getUpcomingEvents(
  uid:   string,
  days = 7
): Promise<Array<{
  id:          string
  titulo:      string
  fechaInicio: string
  fechaFin:    string
  attendees:   string[]
  meetLink?:   string
}>> {
  try {
    const auth     = await getAuthenticatedClient(uid)
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

    return (res.data.items ?? []).map(e => ({
      id:          e.id ?? '',
      titulo:      e.summary ?? 'Sin título',
      fechaInicio: e.start?.dateTime ?? e.start?.date ?? '',
      fechaFin:    e.end?.dateTime   ?? e.end?.date   ?? '',
      attendees:   (e.attendees ?? []).map(a => a.email ?? '').filter(Boolean),
      meetLink:    e.conferenceData?.entryPoints?.[0]?.uri ?? undefined,
    }))
  } catch {
    return []
  }
}
