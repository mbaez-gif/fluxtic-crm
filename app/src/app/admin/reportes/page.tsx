import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function ReportesPage() {
  return (
    <PagePlaceholder
      titulo="Reportes clínicos y administrativos"
      descripcion="Turnos, no-show, ocupación, facturación, deuda, pacientes y prestaciones"
      proximamente={[
        'Reportes operativos diarios / semanales / mensuales',
        'Productividad por profesional y por especialidad',
        'Facturación por período y por cobertura',
        'Pacientes nuevos, recurrentes e inactivos',
        'Efectividad de recordatorios',
      ]}
    />
  )
}
