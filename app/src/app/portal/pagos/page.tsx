import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function PortalPagosPage() {
  return (
    <PagePlaceholder
      titulo="Mis pagos"
      descripcion="Historial de pagos y comprobantes pendientes"
      endpoint="GET /portal/mis-pagos"
    />
  )
}
