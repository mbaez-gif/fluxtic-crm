import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function PrestacionesPage() {
  return (
    <PagePlaceholder
      titulo="Prestaciones"
      descripcion="Catálogo de consultas, prácticas, estudios y procedimientos"
      endpoint="GET /prestaciones"
      proximamente={[
        'Filtros por especialidad y por profesional habilitado',
        'Precio particular vs precio por cobertura',
        'Flags: requiere autorización / consentimiento / preparación',
        'Asociación de insumos consumidos por prestación',
      ]}
    />
  )
}
