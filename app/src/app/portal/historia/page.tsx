import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function PortalHistoriaPage() {
  return (
    <PagePlaceholder
      titulo="Mi historia clínica"
      descripcion="Evoluciones firmadas e indicaciones autorizadas a verse desde el portal"
      endpoint="GET /portal/mi-historia"
      proximamente={[
        'Línea de tiempo de consultas con su motivo y plan',
        'Indicaciones autorizadas (no toda la HC se expone)',
        'Solo evoluciones firmadas por el profesional son visibles',
      ]}
    />
  )
}
