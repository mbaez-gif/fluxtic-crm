import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function CoberturasPage() {
  return (
    <PagePlaceholder
      titulo="Obras sociales y prepagas"
      descripcion="Catálogo de coberturas y planes"
      endpoint="GET /coberturas"
      proximamente={[
        'CRUD de obras sociales y prepagas',
        'Planes anidados por cobertura',
        'Gestión de autorizaciones de prácticas',
      ]}
    />
  )
}
