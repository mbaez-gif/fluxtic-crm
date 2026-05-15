// Minimal copy de los tipos que el worker necesita del CRM.
// El contrato de Firestore es estable; si cambia algo del schema
// ambos tienen que actualizarse.

export type ProductType = 'salud' | 'beauty' | 'gastro' | 'personalizado'
export type DeploymentMode = 'demo' | 'produccion'

export type ClientStatus =
  | 'creando'
  | 'pendiente_manual'
  | 'activo'
  | 'pausado'
  | 'error'
  | 'detenido'

export type JobStatus =
  | 'PENDIENTE'
  | 'QUEUED'           // NUEVO en V2: encolado, esperando worker
  | 'EN_PROCESO'
  | 'COMPLETADO'
  | 'ERROR'
  | 'CANCELADO'
  | 'PENDING_MANUAL_EXECUTION'

export type JobStep =
  | 'VALIDANDO_DATOS'
  | 'CREANDO_CLIENTE'
  | 'GENERANDO_SECRETOS'
  | 'GENERANDO_ENV'
  | 'GENERANDO_COMPOSE'
  | 'PREPARANDO_BACKUP'
  | 'REGISTRANDO_USUARIOS'
  | 'REGISTRANDO_INTEGRACIONES'
  | 'REGISTRANDO_WORKFLOWS'
  | 'COMPILANDO_INSTRUCCIONES_SSH'
  // V2 — worker
  | 'CLAIMING_JOB'
  | 'PREPARING_FOLDER'
  | 'WRITING_FILES'
  | 'ENSURING_NETWORK'
  | 'PULLING_IMAGES'
  | 'STARTING_STACK'
  | 'WAITING_HEALTH'
  | 'RUNNING_MIGRATIONS'
  | 'VERIFYING_ENDPOINT'
  | 'FINALIZADO'

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug'

export interface ClientTenantDoc {
  name:               string
  slug:               string
  productType:        ProductType
  templateVersion:    string
  mode:               DeploymentMode
  status:             ClientStatus
  crmDomain:          string
  n8nDomain:          string
  apiDomain:          string | null
  folderPath:         string
  dockerProjectName:  string
  postgresContainer:  string
  apiContainer:       string
  appContainer:       string
  n8nContainer:       string
  backupPath:         string
}

export interface FileBundleDoc {
  envFile:      string
  composeFile:  string
  metadataJson: string
  revealed:     boolean
}

export interface JobDoc {
  clientTenantId:  string
  status:          JobStatus
  currentStep:     JobStep | null
  totalSteps:      number
  completedSteps:  number
  errorMessage:    string | null
  // V2 lease
  workerId?:       string
  leaseExpiresAt?: unknown
}
