// ── Slack Webhook Service ─────────────────────────────────
// Envía notificaciones al canal de Slack del equipo Fluxtic
// Configurar SLACK_WEBHOOK_URL en las variables de entorno

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? ''

interface SlackBlock {
  type:  string
  text?: { type: string; text: string; emoji?: boolean }
  fields?: Array<{ type: string; text: string }>
}

async function sendSlack(blocks: SlackBlock[], text: string) {
  if (!WEBHOOK_URL) {
    console.warn('SLACK_WEBHOOK_URL no configurado')
    return
  }
  try {
    await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, blocks }),
    })
  } catch (err) {
    console.error('Error enviando a Slack:', err)
  }
}

// ── Eventos del CRM ───────────────────────────────────────

export async function notifyNuevoLead(nombre: string, empresa: string, fuente: string) {
  await sendSlack([
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `🟢 *Nuevo lead captado*` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Nombre:*\n${nombre}` },
        { type: 'mrkdwn', text: `*Empresa:*\n${empresa}` },
        { type: 'mrkdwn', text: `*Fuente:*\n${fuente}` },
      ],
    },
  ], `Nuevo lead: ${nombre} (${empresa})`)
}

export async function notifyOportunidadGanada(titulo: string, valor: number, empresa: string) {
  await sendSlack([
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `🏆 *¡Oportunidad ganada!*` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Oportunidad:*\n${titulo}` },
        { type: 'mrkdwn', text: `*Cliente:*\n${empresa}` },
        { type: 'mrkdwn', text: `*Valor:*\n€${valor.toLocaleString('es-ES')}` },
      ],
    },
  ], `¡Oportunidad ganada! ${titulo} — €${valor.toLocaleString('es-ES')}`)
}

export async function notifyOportunidadPerdida(titulo: string, empresa: string) {
  await sendSlack([
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `🔴 *Oportunidad perdida*\n${titulo} — ${empresa}` },
    },
  ], `Oportunidad perdida: ${titulo}`)
}

export async function notifyAbonoVence(clienteNombre: string, monto: number, dias: number) {
  await sendSlack([
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Abono próximo a vencer*\n*${clienteNombre}* — €${monto.toLocaleString('es-ES')} — vence en *${dias} días*`,
      },
    },
  ], `Abono por vencer: ${clienteNombre}`)
}

export async function notifyTareaVencida(titulo: string, responsable: string) {
  await sendSlack([
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔔 *Tarea vencida*\n"${titulo}" asignada a *${responsable}*`,
      },
    },
  ], `Tarea vencida: ${titulo}`)
}

export async function notifyEmailEnviado(destinatario: string, asunto: string) {
  await sendSlack([
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📧 *Email enviado*\nPara: ${destinatario}\nAsunto: ${asunto}`,
      },
    },
  ], `Email enviado a ${destinatario}`)
}

export async function notifyNuevoCliente(empresa: string, responsable: string) {
  await sendSlack([
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `🤝 *Nuevo cliente*` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Empresa:*\n${empresa}` },
        { type: 'mrkdwn', text: `*Responsable:*\n${responsable}` },
      ],
    },
  ], `Nuevo cliente: ${empresa}`)
}
