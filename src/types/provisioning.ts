import type { Timestamp } from 'firebase/firestore'

// ── Productos ─────────────────────────────────────────────
export type ProductType = 'salud' | 'beauty' | 'gastro' | 'personalizado'

export type DeploymentMode = 'demo' | 'produccion'

export interface ProductMetadata {
  productType:  ProductType
  name:         string
  version:      string
  description:  string
  modules:      string[]
  roles:        string[]
  demoUsers:    { email: string; role: string; nombre?: string }[]
  workflows:    string[]
  requiredEnv:  string[]
}

// ── ClientTenant ──────────────────────────────────────────
// Estado del stack
export type ClientStatus =
  | 'creando'
  | 'pendiente_manual'   // V1 — esperando ejecución SSH
  | 'activo'
  | 'pausado'
  | 'error'
  | 'detenido'

export interface ClientTenant {
  id:                 string
  name:               string          // nombre comercial
  legalName:          string | null   // razón social
  cuit:               string | null
  contactEmail:       string
  contactPhone:       string | null
  responsable:        string | null
  rubro:              string | null
  observaciones:      string | null

  slug:               string
  productType:        ProductType
  templateVersion:    string
  mode:               DeploymentMode
  status:             ClientStatus

  crmDomain:          string
  n8nDomain:          string
  apiDomain:          string | null

  folderPath:         string          // /opt/fluxtic/clients/<slug>
  dockerProjectName:  string
  postgresDb:         string
  postgresUser:       string
  postgresContainer:  string
  apiContainer:       string
  appContainer:       string
  n8nContainer:       string
  backupPath:         string

  // Branding
  brandingDisplayName: string
  brandingPrimary:     string  // hex
  brandingSecondary:   string  // hex
  brandingLoginText:   string | null
  brandingSenderName:  string | null
  brandingSupportEmail: string | null
  brandingSupportWhatsapp: string | null
  brandingLogoUrl:     string | null

  // Tracking
  createdAt:          Timestamp | Date
  updatedAt:          Timestamp | Date
  createdById:        string
  createdByName:      string | null
  lastBackupAt:       Timestamp | Date | null
}

// ── ProvisioningJob ───────────────────────────────────────
export type JobStatus =
  | 'PENDIENTE'
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
  // V2 / V3
  | 'CREANDO_CARPETA'
  | 'COPIANDO_TEMPLATE'
  | 'DOCKER_NETWORK'
  | 'DOCKER_COMPOSE_UP'
  | 'PRISMA_GENERATE'
  | 'PRISMA_MIGRATE'
  | 'SEED'
  | 'N8N_IMPORT_WORKFLOWS'
  | 'HEALTHCHECKS'
  | 'FINALIZADO'

export interface ProvisioningJob {
  id:              string
  clientTenantId:  string
  status:          JobStatus
  currentStep:     JobStep | null
  totalSteps:      number
  completedSteps:  number
  startedAt:       Timestamp | Date | null
  finishedAt:      Timestamp | Date | null
  errorMessage:    string | null
  createdById:     string
  createdByName:   string | null
  createdAt:       Timestamp | Date
  updatedAt:       Timestamp | Date
}

// ── ProvisioningLog ───────────────────────────────────────
export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug'

export interface ProvisioningLog {
  id:        string
  jobId:     string
  step:      JobStep
  level:     LogLevel
  message:   string
  metadata:  Record<string, unknown> | null
  createdAt: Timestamp | Date
}

// ── ClientDomain ──────────────────────────────────────────
export type DomainType = 'crm' | 'n8n' | 'api'
export type DomainStatus = 'pendiente_dns' | 'configurando_ssl' | 'activo' | 'error'

export interface ClientDomain {
  id:              string
  clientTenantId:  string
  type:            DomainType
  domain:          string
  status:          DomainStatus
  isSubdomainFluxtic: boolean
  createdAt:       Timestamp | Date
}

// ── ClientIntegration ─────────────────────────────────────
export type IntegrationType =
  | 'whatsapp_meta'
  | 'whatsapp_twilio'
  | 'mercadopago'
  | 'smtp'
  | 'google_calendar'
  | 'n8n'
  | 'webhooks_internos'

export type IntegrationStatus = 'pendiente_credenciales' | 'activa' | 'deshabilitada' | 'error'

export interface ClientIntegration {
  id:              string
  clientTenantId:  string
  type:            IntegrationType
  status:          IntegrationStatus
  config:          Record<string, unknown> | null   // nunca contiene secretos en plano
  createdAt:       Timestamp | Date
  updatedAt:       Timestamp | Date
}

// ── ClientInitialUser ─────────────────────────────────────
export interface ClientInitialUser {
  id:                              string
  clientTenantId:                  string
  email:                           string
  nombre:                          string
  role:                            string
  temporaryPasswordEncryptedOrHidden: string  // un hash o el placeholder "__revealed_once__"
  mustChangePassword:              boolean
  isDemo:                          boolean
  createdAt:                       Timestamp | Date
}

// ── ClientWorkflow ────────────────────────────────────────
export type WorkflowStatus = 'activo' | 'pausado' | 'pendiente_credenciales'

export interface ClientWorkflow {
  id:              string
  clientTenantId:  string
  name:            string           // p.ej. "confirmacion_turno"
  displayName:     string           // p.ej. "Confirmación de turno"
  type:            string           // categoría libre
  n8nWorkflowId:   string | null    // se completa cuando el import real exista (V3)
  status:          WorkflowStatus
  createdAt:       Timestamp | Date
}

// ── ClientBackupConfig ────────────────────────────────────
export type BackupFrequency = 'diario' | 'cada_6h' | 'semanal' | 'deshabilitado'
export type BackupStatus    = 'pendiente' | 'activo' | 'error'

export interface ClientBackupConfig {
  id:              string
  clientTenantId:  string
  enabled:         boolean
  frequency:       BackupFrequency
  backupPath:      string
  lastBackupAt:    Timestamp | Date | null
  status:          BackupStatus
  createdAt:       Timestamp | Date
  updatedAt:       Timestamp | Date
}

// ── Wizard payload (lo que viaja del front al backend) ────
export interface WizardClientStep {
  name:          string
  legalName?:    string
  cuit?:         string
  contactEmail:  string
  contactPhone?: string
  responsable?:  string
  rubro?:        string
  observaciones?: string
  slug:          string
}

export interface WizardProductStep {
  productType: ProductType
}

export interface WizardDomainStep {
  crmDomain:           string
  n8nDomain:           string
  apiDomain?:          string
  isSubdomainFluxtic:  boolean
}

export interface WizardInfraStep {
  mode:               DeploymentMode
  createOwnDatabase:  boolean
  createOwnN8n:       boolean
  createBackupFolder: boolean
}

export interface WizardBrandingStep {
  displayName:      string
  primaryColor:     string
  secondaryColor:   string
  loginText?:       string
  senderName?:      string
  supportEmail?:    string
  supportWhatsapp?: string
  logoUrl?:         string
}

export interface WizardUsersStep {
  adminEmail:       string
  adminName:        string
  forcePasswordChange: boolean
  createDemoUsers:  boolean
}

export interface WizardIntegrationsStep {
  enabled: IntegrationType[]
}

export interface WizardWorkflowsStep {
  defaultStatus: 'pausado' | 'pendiente_credenciales'
}

export interface CreateClientPayload {
  client:       WizardClientStep
  product:      WizardProductStep
  domains:      WizardDomainStep
  infra:        WizardInfraStep
  branding:     WizardBrandingStep
  users:        WizardUsersStep
  integrations: WizardIntegrationsStep
  workflows:    WizardWorkflowsStep
}

// ── Respuestas API ────────────────────────────────────────
export interface ValidateSlugResponse {
  ok:        boolean
  available: boolean
  reason?:   string
}

export interface ValidateDomainResponse {
  ok:        boolean
  available: boolean
  reason?:   string
}

export interface CreateClientResponse {
  ok:           boolean
  clientId:     string
  jobId:        string
  revealOnce: {
    adminEmail:        string
    adminPassword:     string
    postgresPassword:  string
    n8nBasicAuthPass:  string
    n8nEncryptionKey:  string
  }
  manualSshCommands: string[]
}

export interface JobWithCounts extends ProvisioningJob {
  progressPct: number
}
