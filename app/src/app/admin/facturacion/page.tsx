import PagePlaceholder from '@/components/ui/PagePlaceholder'

export default function FacturacionPage() {
  return (
    <PagePlaceholder
      titulo="Facturación y cobros"
      descripcion="Comprobantes, pagos, caja diaria, deudas y liquidaciones"
      endpoint="GET /facturacion/comprobantes · /facturacion/pagos · /facturacion/caja · /facturacion/deudas"
      proximamente={[
        'Emisión de comprobantes con prestaciones',
        'Registro de pagos (efectivo, MP, transferencia, cobertura)',
        'Caja diaria con cierre por usuario',
        'Liquidación por profesional',
      ]}
    />
  )
}
