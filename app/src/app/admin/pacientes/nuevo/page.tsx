'use client'

import Link from 'next/link'
import PacienteForm from '@/components/admin/pacientes/PacienteForm'

export default function NuevoPacientePage() {
  return (
    <div style={{ padding: 24 }}>
      <Link href="/admin/pacientes" style={{ fontSize: 13, color: 'var(--muted)' }}>← Pacientes</Link>
      <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--noir)', marginTop: 8, marginBottom: 4 }}>Nuevo paciente</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Al crear el paciente se inicializa automáticamente su historia clínica.
      </p>
      <PacienteForm />
    </div>
  )
}
