'use client'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState }  from '@/components/ui'
import { Plus }        from 'lucide-react'

// Módulo proyectos — implementación completa en próximos sprints
export default function Page() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Proyectos"
        actions={
          <button className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Nuevo
          </button>
        }
      />
      <div className="px-8">
        <EmptyState
          title="Módulo en construcción"
          description="Este módulo se implementará en el próximo sprint del backlog MVP."
        />
      </div>
    </div>
  )
}
