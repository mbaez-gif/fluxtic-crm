import { Badge } from '@/components/ui'
import type {
  ClientStatus, JobStatus, IntegrationStatus,
  WorkflowStatus, DomainStatus, BackupStatus,
} from '@/types/provisioning'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'teal'

function tone(status: string): { tone: Tone; label: string } {
  switch (status) {
    // Cliente
    case 'activo':                    return { tone: 'success', label: 'Activo' }
    case 'pausado':                   return { tone: 'default', label: 'Pausado' }
    case 'detenido':                  return { tone: 'default', label: 'Detenido' }
    case 'pendiente_manual':          return { tone: 'warning', label: 'Pendiente manual' }
    case 'creando':                   return { tone: 'info',    label: 'Creando' }
    case 'error':                     return { tone: 'danger',  label: 'Error' }

    // Job
    case 'PENDIENTE':                 return { tone: 'default', label: 'Pendiente' }
    case 'EN_PROCESO':                return { tone: 'info',    label: 'En proceso' }
    case 'COMPLETADO':                return { tone: 'success', label: 'Completado' }
    case 'ERROR':                     return { tone: 'danger',  label: 'Error' }
    case 'CANCELADO':                 return { tone: 'default', label: 'Cancelado' }
    case 'PENDING_MANUAL_EXECUTION':  return { tone: 'warning', label: 'Pendiente SSH' }

    // Integración / Workflow
    case 'pendiente_credenciales':    return { tone: 'warning', label: 'Pendiente cred.' }
    case 'activa':                    return { tone: 'success', label: 'Activa' }
    case 'deshabilitada':             return { tone: 'default', label: 'Deshabilitada' }

    // Dominio
    case 'pendiente_dns':             return { tone: 'warning', label: 'Pendiente DNS' }
    case 'configurando_ssl':          return { tone: 'info',    label: 'SSL' }

    // Backup
    case 'pendiente':                 return { tone: 'warning', label: 'Pendiente' }

    default:                          return { tone: 'default', label: status }
  }
}

export function StatusBadge({
  status,
}: { status: ClientStatus | JobStatus | IntegrationStatus | WorkflowStatus | DomainStatus | BackupStatus | string }) {
  const { tone: t, label } = tone(String(status))
  return <Badge variant={t}>{label}</Badge>
}
