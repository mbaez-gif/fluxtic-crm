import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function ComunicacionesPage() {
  return (
    <PagePlaceholder
      titulo="Comunicaciones con pacientes"
      descripcion="WhatsApp, email, plantillas y log de envíos"
      endpoint="(en desarrollo)"
      proximamente={[
        'Plantillas configurables (confirmación, recordatorios 48/24/2h, postconsulta)',
        'Log de mensajes con estado (enviado/entregado/leído/respondido)',
        'Campañas de reactivación de pacientes inactivos',
        'Integración con n8n para disparadores automáticos',
      ]}
    />
  )
}
