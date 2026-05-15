import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function HistoriaClinicaPage() {
  return (
    <PagePlaceholder
      titulo="Historia clínica"
      descripcion="Acceso a la historia clínica de un paciente. Toda visualización queda auditada."
      endpoint="GET /historia-clinica/paciente/:id"
      proximamente={[
        'Buscador de pacientes con permiso de acceso',
        'Línea de tiempo de evoluciones (SOAP)',
        'Antecedentes, alergias, medicación habitual, diagnósticos',
        'Indicaciones y estudios solicitados',
        'Adjuntos clínicos firmados con MinIO',
      ]}
    >
      <div style={{ background: 'var(--info-l)', color: 'var(--info)', padding: 14, borderRadius: 8, fontSize: 13 }}>
        Buscá un paciente en <a href="/admin/pacientes" style={{ color: 'var(--teal)', fontWeight: 500 }}>Pacientes</a> y abrí su ficha para ver la historia clínica.
      </div>
    </PagePlaceholder>
  )
}
