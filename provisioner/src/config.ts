// Configuración del worker. Todas las opciones vienen de variables de
// entorno declaradas en el unit de systemd
// (provisioner/systemd/fluxtic-provisioner.service).

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Falta variable de entorno requerida: ${name}`)
  return v
}

export const config = {
  // Firebase Admin (usa la misma service account que el CRM)
  firebase: {
    projectId:   required('FIREBASE_ADMIN_PROJECT_ID'),
    clientEmail: required('FIREBASE_ADMIN_CLIENT_EMAIL'),
    privateKey:  required('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
  },

  // Raíz física donde se montan los stacks de clientes.
  // El worker rechaza cualquier path que no empiece por acá.
  fluxticRoot:  process.env.FLUXTIC_ROOT  ?? '/opt/fluxtic/clients',
  backupRoot:   process.env.BACKUP_ROOT   ?? '/opt/fluxtic/backups',

  // Identidad del worker para el lease distribuido sobre Firestore.
  // Si corren varios workers (no es el caso en V2 single-VM) cada uno
  // tiene un ID propio. Por defecto usamos el hostname.
  workerId:     process.env.WORKER_ID     ?? `worker-${process.pid}`,

  // Loop / lease
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  leaseTtlSeconds: Number(process.env.LEASE_TTL_SECONDS ?? 600), // 10 minutos
  healthcheckTimeoutMs: Number(process.env.HEALTHCHECK_TIMEOUT_MS ?? 180000), // 3 minutos

  // Docker
  dockerBin: process.env.DOCKER_BIN ?? 'docker',
  // Red Traefik compartida — debe existir antes de levantar cualquier cliente
  proxyNetwork: process.env.PROXY_NETWORK ?? 'proxy',
} as const

export const COL = {
  clients:     'provisioning_clients',
  jobs:        'provisioning_jobs',
  logs:        'provisioning_logs',
  domains:     'provisioning_client_domains',
  fileBundles: 'provisioning_file_bundles',
} as const
