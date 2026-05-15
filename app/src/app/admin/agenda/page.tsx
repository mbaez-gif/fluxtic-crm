import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function AgendaPage() {
  return (
    <PagePlaceholder
      titulo="Agenda médica"
      descripcion="Vista de turnos por profesional, especialidad, sede y consultorio"
      endpoint="GET /turnos"
      proximamente={[
        'Vista calendario semanal por profesional',
        'Filtros por sede / consultorio / modalidad',
        'Drag & drop para reprogramar',
        'Crear turno con detección de superposición',
        'Transiciones de estado (sala de espera, en atención, atendido)',
      ]}
    />
  )
}
