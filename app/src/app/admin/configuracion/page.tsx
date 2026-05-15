import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function ConfiguracionPage() {
  return (
    <PagePlaceholder
      titulo="Configuración"
      descripcion="Datos de la clínica, parámetros de agenda y facturación, integraciones"
      proximamente={[
        'Datos de la clínica (nombre, CUIT, razón social)',
        'Parámetros de agenda (slot mínimo, recordatorios)',
        'Parámetros de facturación (numerador, sena, MP)',
        'Plantillas de mensajes y consentimientos',
        'Roles, permisos e integraciones (n8n, WhatsApp)',
      ]}
    />
  )
}
