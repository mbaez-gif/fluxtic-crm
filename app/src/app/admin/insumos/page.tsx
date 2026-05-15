import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function InsumosPage() {
  return (
    <PagePlaceholder
      titulo="Insumos médicos"
      descripcion="Stock, lotes, vencimientos y movimientos"
      endpoint="GET /insumos"
      proximamente={[
        'Listado con stock actual vs mínimo',
        'Gestión de lotes con vencimiento',
        'Movimientos de entrada / salida / ajuste',
        'Alertas de stock crítico y vencimiento próximo',
      ]}
    />
  )
}
