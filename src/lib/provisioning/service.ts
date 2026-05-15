import 'server-only'
import type {
  CreateClientPayload,
  CreateClientResponse,
  IntegrationType,
  IntegrationStatus,
  JobStep,
  ProductMetadata,
  WorkflowStatus,
} from '@/types/provisioning'
import {
  validateSlugFormat, validateDomainFormat, validateEmail,
  validateHexColor, validateProductType, validateMode,
} from './validators'
import { getProduct } from './templates'
import { buildClientSecrets, hashSecret } from './secrets'
import {
  namingFor,
  renderEnvFile,
  renderDockerCompose,
  buildClientTenantData,
  buildManualSshCommands,
} from './render'
import {
  findClientBySlug,
  findDomainCollision,
  createClient,
  createJob,
  markJobStarted,
  bumpJobStep,
  markJobFinished,
  updateJob,
  appendLog,
  saveDomain,
  saveIntegration,
  saveInitialUser,
  saveWorkflow,
  saveBackupConfig,
  saveFileBundle,
} from './store'

// Ordered list of steps for V1.
// `FINALIZADO` se reemplaza por `COMPILANDO_INSTRUCCIONES_SSH` que cierra
// en `PENDING_MANUAL_EXECUTION` hasta que exista ejecución real.
const STEPS_V1: JobStep[] = [
  'VALIDANDO_DATOS',
  'CREANDO_CLIENTE',
  'GENERANDO_SECRETOS',
  'GENERANDO_ENV',
  'GENERANDO_COMPOSE',
  'PREPARANDO_BACKUP',
  'REGISTRANDO_USUARIOS',
  'REGISTRANDO_INTEGRACIONES',
  'REGISTRANDO_WORKFLOWS',
  'COMPILANDO_INSTRUCCIONES_SSH',
]

export class ProvisioningError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
  }
}

// Punto de entrada del POST /api/provisioning/clients
export async function provisionClient(opts: {
  payload:  CreateClientPayload
  uid:      string
  userName: string | null
}): Promise<CreateClientResponse> {
  const { payload, uid, userName } = opts

  // ── 0. Validación sincrónica (antes de tocar Firestore) ──
  validateInput(payload)

  // ── 1. Crear job en estado PENDIENTE ──
  const product   = getProduct(payload.product.productType)
  const naming    = namingFor(payload.client.slug)

  // No tenemos clientId todavía; creamos job sin clientTenantId y lo
  // updateamos luego. Para simplificar y mantener consistencia,
  // creamos primero el cliente y después el job.
  const tenantData = buildClientTenantData({ payload, product, naming, uid, userName })
  const clientId = await createClient(tenantData)
  const jobId    = await createJob({
    clientTenantId: clientId,
    totalSteps:     STEPS_V1.length,
    uid,
    userName,
  })

  await markJobStarted(jobId, 'VALIDANDO_DATOS')
  await appendLog({
    jobId, step: 'VALIDANDO_DATOS', level: 'info',
    message: 'Datos validados correctamente',
    metadata: { slug: naming.slug, productType: product.productType },
  })
  await bumpJobStep(jobId, 'CREANDO_CLIENTE', 1)

  // ── 2. Chequeos asincrónicos contra Firestore ──
  await validateAgainstDb(payload)
  await appendLog({
    jobId, step: 'CREANDO_CLIENTE', level: 'success',
    message: `Cliente ${payload.client.name} registrado (id: ${clientId})`,
  })
  await bumpJobStep(jobId, 'GENERANDO_SECRETOS', 2)

  // ── 3. Generar secretos (en memoria, nunca al log) ──
  const secrets = buildClientSecrets()
  await appendLog({
    jobId, step: 'GENERANDO_SECRETOS', level: 'info',
    message: 'Secretos generados (no se loguean)',
  })
  await bumpJobStep(jobId, 'GENERANDO_ENV', 3)

  // ── 4. Generar .env ──
  const envFile = renderEnvFile({
    payload, secrets, product, naming, adminEmail: payload.users.adminEmail,
  })
  await appendLog({
    jobId, step: 'GENERANDO_ENV', level: 'success',
    message: `.env generado (${envFile.split('\n').length} líneas)`,
  })
  await bumpJobStep(jobId, 'GENERANDO_COMPOSE', 4)

  // ── 5. Generar docker-compose ──
  const composeFile = renderDockerCompose({ naming, payload })
  await appendLog({
    jobId, step: 'GENERANDO_COMPOSE', level: 'success',
    message: `docker-compose.yml generado (${composeFile.split('\n').length} líneas)`,
  })
  await bumpJobStep(jobId, 'PREPARANDO_BACKUP', 5)

  // ── 6. Backup config ──
  await saveBackupConfig({
    clientTenantId: clientId,
    enabled:        payload.infra.createBackupFolder,
    frequency:      payload.infra.mode === 'produccion' ? 'diario' : 'deshabilitado',
    backupPath:     naming.backupPath,
    lastBackupAt:   null,
    status:         payload.infra.createBackupFolder ? 'pendiente' : 'pendiente',
  })
  await appendLog({
    jobId, step: 'PREPARANDO_BACKUP', level: 'info',
    message: payload.infra.createBackupFolder
      ? `Backup configurado en ${naming.backupPath}`
      : 'Backup deshabilitado por configuración del wizard',
  })
  await bumpJobStep(jobId, 'REGISTRANDO_USUARIOS', 6)

  // ── 7. Usuarios iniciales ──
  await saveInitialUser({
    clientTenantId:                    clientId,
    email:                             payload.users.adminEmail.toLowerCase(),
    nombre:                            payload.users.adminName,
    role:                              product.roles[0] ?? 'ADMIN_GENERAL',
    temporaryPasswordEncryptedOrHidden: hashSecret(secrets.adminTempPassword),
    mustChangePassword:                payload.users.forcePasswordChange,
    isDemo:                            false,
  })

  if (payload.users.createDemoUsers) {
    for (const demo of product.demoUsers) {
      // Saltar el admin si choca con el demo
      if (demo.email.toLowerCase() === payload.users.adminEmail.toLowerCase()) continue
      await saveInitialUser({
        clientTenantId:                     clientId,
        email:                              demo.email.toLowerCase(),
        nombre:                             demo.nombre ?? demo.email,
        role:                               demo.role,
        temporaryPasswordEncryptedOrHidden: '__demo_user_set_on_first_login__',
        mustChangePassword:                 true,
        isDemo:                             true,
      })
    }
  }
  await appendLog({
    jobId, step: 'REGISTRANDO_USUARIOS', level: 'success',
    message: `Admin registrado (${payload.users.adminEmail})` +
      (payload.users.createDemoUsers ? ` + ${product.demoUsers.length} usuarios demo` : ''),
  })
  await bumpJobStep(jobId, 'REGISTRANDO_INTEGRACIONES', 7)

  // ── 8. Integraciones (pendientes de credenciales en V1) ──
  await saveDomain({
    clientTenantId:     clientId,
    type:               'crm',
    domain:             payload.domains.crmDomain,
    status:             'pendiente_dns',
    isSubdomainFluxtic: payload.domains.isSubdomainFluxtic,
  })
  await saveDomain({
    clientTenantId:     clientId,
    type:               'n8n',
    domain:             payload.domains.n8nDomain,
    status:             'pendiente_dns',
    isSubdomainFluxtic: payload.domains.isSubdomainFluxtic,
  })
  if (payload.domains.apiDomain) {
    await saveDomain({
      clientTenantId:     clientId,
      type:               'api',
      domain:             payload.domains.apiDomain,
      status:             'pendiente_dns',
      isSubdomainFluxtic: payload.domains.isSubdomainFluxtic,
    })
  }

  const integrationStatus: IntegrationStatus = 'pendiente_credenciales'
  const wantedIntegrations: IntegrationType[] = payload.integrations.enabled
  for (const i of wantedIntegrations) {
    await saveIntegration({
      clientTenantId: clientId,
      type:           i,
      status:         integrationStatus,
      config:         null,
    })
  }
  await appendLog({
    jobId, step: 'REGISTRANDO_INTEGRACIONES', level: 'info',
    message: `${wantedIntegrations.length} integraciones registradas como ${integrationStatus}`,
  })
  await bumpJobStep(jobId, 'REGISTRANDO_WORKFLOWS', 8)

  // ── 9. Workflows ──
  const workflowStatus: WorkflowStatus =
    payload.workflows.defaultStatus === 'pausado' ? 'pausado' : 'pendiente_credenciales'
  for (const w of product.workflows) {
    await saveWorkflow({
      clientTenantId: clientId,
      name:           w,
      displayName:    workflowDisplay(w),
      type:           inferType(w),
      n8nWorkflowId:  null,
      status:         workflowStatus,
    })
  }
  await appendLog({
    jobId, step: 'REGISTRANDO_WORKFLOWS', level: 'info',
    message: `${product.workflows.length} workflows del producto registrados como ${workflowStatus}`,
  })
  await bumpJobStep(jobId, 'COMPILANDO_INSTRUCCIONES_SSH', 9)

  // ── 10. Persistir bundle de archivos y compilar comandos SSH ──
  const metadataJson = JSON.stringify(
    {
      slug:           naming.slug,
      product:        product.productType,
      productVersion: product.version,
      mode:           payload.infra.mode,
      crmDomain:      payload.domains.crmDomain,
      n8nDomain:      payload.domains.n8nDomain,
      apiDomain:      payload.domains.apiDomain ?? `api-${naming.slug}.fluxtic.com`,
      containers: {
        postgres: naming.postgresContainer,
        redis:    naming.redisContainer,
        api:      naming.apiContainer,
        app:      naming.appContainer,
        n8n:      naming.n8nContainer,
      },
      folderPath: naming.folderPath,
      backupPath: naming.backupPath,
    },
    null,
    2,
  )
  await saveFileBundle({
    clientTenantId: clientId,
    envFile,
    composeFile,
    metadataJson,
    createdById:    uid,
  })

  // ── Modo: manual (V1) o worker (V2) ──
  // En modo worker dejamos el job en QUEUED para que el daemon
  // fluxtic-provisioner lo levante. En modo manual mantenemos la
  // V1: comandos SSH + PENDING_MANUAL_EXECUTION.
  const mode = (process.env.PROVISIONING_MODE === 'worker') ? 'worker' : 'manual'

  if (mode === 'worker') {
    await appendLog({
      jobId, step: 'COMPILANDO_INSTRUCCIONES_SSH', level: 'success',
      message: 'Bundle listo. Job encolado para el worker fluxtic-provisioner.',
    })
    // Pasos totales en modo worker: 9 del CRM + 9 del worker.
    // El worker sumará a partir de completedSteps actual (= 9).
    await updateJob(jobId, {
      status:      'QUEUED',
      currentStep: null,
      totalSteps:  STEPS_V1.length - 1 + 9,
    })
    return {
      ok:       true,
      clientId,
      jobId,
      mode:     'worker',
      revealOnce: {
        adminEmail:       payload.users.adminEmail,
        adminPassword:    secrets.adminTempPassword,
        postgresPassword: secrets.postgresPassword,
        n8nBasicAuthPass: secrets.n8nBasicAuthPass,
        n8nEncryptionKey: secrets.n8nEncryptionKey,
      },
      manualSshCommands: [],
    }
  }

  const sshCommands = buildManualSshCommands({ naming })
  await appendLog({
    jobId, step: 'COMPILANDO_INSTRUCCIONES_SSH', level: 'success',
    message: 'Bundle de archivos y comandos SSH listos para descarga única',
  })

  await markJobFinished(jobId, 'PENDING_MANUAL_EXECUTION')

  return {
    ok:       true,
    clientId,
    jobId,
    mode:     'manual',
    revealOnce: {
      adminEmail:       payload.users.adminEmail,
      adminPassword:    secrets.adminTempPassword,
      postgresPassword: secrets.postgresPassword,
      n8nBasicAuthPass: secrets.n8nBasicAuthPass,
      n8nEncryptionKey: secrets.n8nEncryptionKey,
    },
    manualSshCommands: sshCommands,
  }
}

// ── Validaciones reusables ────────────────────────────────
export function validateInput(payload: CreateClientPayload): void {
  if (!payload || typeof payload !== 'object') {
    throw new ProvisioningError('INVALID_PAYLOAD', 'Payload vacío')
  }
  const { client, product, domains, infra, branding, users, integrations, workflows } = payload
  if (!client)       throw new ProvisioningError('MISSING_STEP', 'Falta paso 1: cliente')
  if (!product)      throw new ProvisioningError('MISSING_STEP', 'Falta paso 2: producto')
  if (!domains)      throw new ProvisioningError('MISSING_STEP', 'Falta paso 3: dominios')
  if (!infra)        throw new ProvisioningError('MISSING_STEP', 'Falta paso 4: infraestructura')
  if (!branding)     throw new ProvisioningError('MISSING_STEP', 'Falta paso 5: branding')
  if (!users)        throw new ProvisioningError('MISSING_STEP', 'Falta paso 6: usuarios')
  if (!integrations) throw new ProvisioningError('MISSING_STEP', 'Falta paso 7: integraciones')
  if (!workflows)    throw new ProvisioningError('MISSING_STEP', 'Falta paso 8: workflows')

  const slugCheck = validateSlugFormat(client.slug)
  if (!slugCheck.ok)
    throw new ProvisioningError('INVALID_SLUG', slugCheck.reason ?? 'Slug inválido')

  if (!validateProductType(product.productType))
    throw new ProvisioningError('INVALID_PRODUCT', 'Producto no válido')

  if (!validateMode(infra.mode))
    throw new ProvisioningError('INVALID_MODE', 'Modo no válido')

  for (const d of [domains.crmDomain, domains.n8nDomain]) {
    const r = validateDomainFormat(d)
    if (!r.ok) throw new ProvisioningError('INVALID_DOMAIN', r.reason ?? 'Dominio inválido')
  }
  if (domains.apiDomain) {
    const r = validateDomainFormat(domains.apiDomain)
    if (!r.ok) throw new ProvisioningError('INVALID_DOMAIN', r.reason ?? 'apiDomain inválido')
  }

  if (!validateEmail(client.contactEmail).ok)
    throw new ProvisioningError('INVALID_EMAIL', 'Email de contacto inválido')
  if (!validateEmail(users.adminEmail).ok)
    throw new ProvisioningError('INVALID_EMAIL', 'Email del admin inválido')
  if (!users.adminName?.trim())
    throw new ProvisioningError('INVALID_ADMIN_NAME', 'Nombre del admin obligatorio')

  if (!validateHexColor(branding.primaryColor).ok)
    throw new ProvisioningError('INVALID_COLOR', 'Color primario inválido')
  if (!validateHexColor(branding.secondaryColor).ok)
    throw new ProvisioningError('INVALID_COLOR', 'Color secundario inválido')
  if (!branding.displayName?.trim())
    throw new ProvisioningError('INVALID_BRAND', 'Nombre visible obligatorio')
}

async function validateAgainstDb(payload: CreateClientPayload) {
  const existing = await findClientBySlug(payload.client.slug)
  if (existing) {
    throw new ProvisioningError('SLUG_TAKEN', `Ya existe un cliente con slug ${payload.client.slug}`)
  }
  const domains = [payload.domains.crmDomain, payload.domains.n8nDomain]
  if (payload.domains.apiDomain) domains.push(payload.domains.apiDomain)
  for (const d of domains) {
    const collision = await findDomainCollision(d)
    if (collision) {
      throw new ProvisioningError('DOMAIN_TAKEN', `Dominio ${d} ya está asignado a otro cliente`)
    }
  }
}

function workflowDisplay(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function inferType(name: string): string {
  if (name.startsWith('recordatorio')) return 'recordatorio'
  if (name.startsWith('confirmacion')) return 'confirmacion'
  if (name.startsWith('cancelacion'))  return 'cancelacion'
  if (name.startsWith('pago'))         return 'pago'
  if (name.startsWith('reporte'))      return 'reporte'
  if (name.startsWith('campania'))     return 'marketing'
  return 'otro'
}
