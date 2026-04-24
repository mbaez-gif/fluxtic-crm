# Fluxtic CRM — Sprint 4: Integraciones Google + Slack

## Variables de entorno nuevas

Añade estas variables en Vercel → Settings → Environment Variables:

```env
# Google OAuth (crear en Google Cloud Console)
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REDIRECT_URI=https://fluxtic-crm.vercel.app/api/auth/google/callback

# Slack (crear en api.slack.com/apps)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# Indicador visual en UI
NEXT_PUBLIC_SLACK_CONFIGURED=true
```

---

## Configurar Google OAuth (10 minutos)

1. Ve a https://console.cloud.google.com
2. Crea un proyecto nuevo o selecciona uno existente
3. Habilita estas APIs:
   - Gmail API
   - Google Calendar API
   - Google Sheets API
   - Google Drive API
4. Ve a **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: `https://fluxtic-crm.vercel.app/api/auth/google/callback`
7. Copia el Client ID y Client Secret → pégalos en Vercel

---

## Configurar Slack Webhook (5 minutos)

1. Ve a https://api.slack.com/apps → **Create New App** → From scratch
2. Nombre: `Fluxtic CRM`
3. Ve a **Incoming Webhooks** → activar → **Add New Webhook to Workspace**
4. Selecciona el canal (ej: `#crm-alertas`)
5. Copia la Webhook URL → pégala en Vercel como `SLACK_WEBHOOK_URL`

---

## Cómo integrar con el proyecto existente

Copia estos archivos sobre tu proyecto Sprint 1+2+3:

```
fluxtic-s4/src/
├── app/
│   ├── api/
│   │   ├── auth/google/callback/route.ts  ← OAuth callback
│   │   ├── gmail/send/route.ts            ← Enviar emails
│   │   ├── calendar/events/route.ts       ← Crear/listar eventos
│   │   ├── sheets/export/route.ts         ← Exportar datos
│   │   └── leads/webhook/route.ts         ← Capturar leads externos
│   ├── formulario/
│   │   ├── layout.tsx
│   │   └── page.tsx                       ← Formulario público
│   └── integraciones/
│       ├── layout.tsx
│       └── page.tsx                       ← Panel de integraciones
├── components/layout/
│   └── Sidebar.tsx                        ← Actualizado con link Integraciones
├── lib/
│   ├── google/
│   │   ├── oauth.ts                       ← Gestión tokens OAuth
│   │   ├── gmail.ts                       ← Gmail service
│   │   ├── calendar.ts                    ← Calendar service
│   │   └── sheets.ts                      ← Sheets service
│   └── slack.ts                           ← Notificaciones Slack
└── types/
    └── integrations.ts                    ← Tipos nuevos

```

---

## Instalar dependencia nueva

Después de copiar los archivos, ejecuta:

```bash
npm install googleapis
```

Y añádelo al package.json en dependencies:
```json
"googleapis": "^140.0.0"
```

---

## Qué funciona en este sprint

| Funcionalidad | URL / Acceso |
|---|---|
| Panel de integraciones | `/integraciones` |
| Conectar Google | Botón en `/integraciones` |
| Enviar email de prueba | Panel en `/integraciones` |
| Exportar leads a Sheets | Botón en `/integraciones` |
| Exportar pipeline a Sheets | Botón en `/integraciones` |
| Exportar clientes a Sheets | Botón en `/integraciones` |
| Formulario público captación | `/formulario` |
| API captura leads externos | `POST /api/leads/webhook` |
| API enviar email | `POST /api/gmail/send` |
| API crear evento Calendar | `POST /api/calendar/events` |
| Notificaciones Slack | Automático en eventos clave |

---

## Formulario embebible en tu web

La URL pública del formulario es:
`https://fluxtic-crm.vercel.app/formulario`

Para embeber en cualquier web:
```html
<iframe
  src="https://fluxtic-crm.vercel.app/formulario"
  width="100%"
  height="700"
  frameborder="0">
</iframe>
```

O redirigir directamente a esa URL desde un botón de tu web.

---

## Notificaciones Slack automáticas

Una vez configurado el webhook, Slack recibirá alertas cuando:
- 🟢 Nuevo lead captado (formulario web u otro canal)
- 🏆 Oportunidad ganada
- 🔴 Oportunidad perdida
- ⚠️ Abono próximo a vencer (7 días)
- 🔔 Tarea vencida
- 📧 Email enviado desde el CRM
- 🤝 Nuevo cliente creado
