import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function PortalTurnosPage() {
  return (
    <PagePlaceholder
      titulo="Mis turnos"
      descripcion="Próximos turnos confirmados y pendientes"
      endpoint="GET /portal/mis-turnos"
      proximamente={[
        'Vista de próximos turnos confirmados',
        'Cancelar / reprogramar (según reglas de la clínica)',
        'Solicitar nuevo turno online',
        'Recordatorios de preparación previa',
      ]}
    />
  )
}
