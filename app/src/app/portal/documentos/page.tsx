import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function PortalDocumentosPage() {
  return (
    <PagePlaceholder
      titulo="Mis documentos"
      descripcion="Estudios, recetas e informes con visibilidad habilitada"
      endpoint="GET /portal/mis-documentos"
    />
  )
}
