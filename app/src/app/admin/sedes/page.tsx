import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function SedesPage() {
  return (
    <PagePlaceholder
      titulo="Sedes"
      descripcion="Sedes de atención y consultorios asignados"
      endpoint="GET /sedes"
      proximamente={[
        'Listado de sedes con sus consultorios',
        'Asignación de profesionales por sede',
        'Configuración de horarios por sede',
      ]}
    />
  )
}
