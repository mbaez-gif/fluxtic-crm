/**
 * Disparador de webhooks hacia n8n.
 *
 * Centraliza el call POST a `${N8N_WEBHOOK_BASE_URL}/webhook/{evento}`.
 * Best-effort: si n8n no responde no rompe el flujo aguas arriba.
 *
 * Eventos que dispara el CRM hoy:
 *   - turno-creado               (al crear reserva publica)
 *   - turno-confirmado-manual    (admin confirma desde el CRM)
 *   - comprobante-aprobado       (admin aprueba transferencia)
 *   - pago-aprobado              (webhook MP)
 *   - pago-rechazado             (webhook MP)
 *   - pago-validacion-manual     (webhook MP caso borde)
 */

export async function dispararEventoN8n(evento: string, payload: Record<string, unknown>): Promise<void> {
  const baseUrl = process.env.N8N_WEBHOOK_BASE_URL || process.env.N8N_WEBHOOK_URL
  if (!baseUrl) return

  const url = `${baseUrl.replace(/\/$/, '')}/webhook/${evento}`

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[n8n] No se pudo disparar ${evento}: ${msg}`)
  }
}
