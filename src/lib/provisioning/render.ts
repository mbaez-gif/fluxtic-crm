// Generadores deterministas de archivos para el stack de cada cliente.
// Toda interpolación de input externo pasa primero por safeSlug() /
// validateDomainFormat() para evitar inyección.

import type {
  ClientTenant,
  CreateClientPayload,
  ProductMetadata,
} from '@/types/provisioning'
import type { ClientSecrets } from './secrets'
import { safeSlug, validateDomainFormat } from './validators'

// ── Convenciones de naming ────────────────────────────────
//
// Para slug `clinica-san-martin`:
//   project name    : fluxtic-clinica-san-martin
//   postgres db     : clinica_san_martin
//   postgres user   : clinica_san_martin
//   postgres ctr    : postgres-clinica-san-martin
//   redis ctr       : redis-clinica-san-martin
//   api ctr         : api-clinica-san-martin
//   app ctr         : app-clinica-san-martin
//   n8n ctr         : n8n-clinica-san-martin
//   network         : clinica-san-martin_internal

export function namingFor(slug: string) {
  const s = safeSlug(slug)
  const underscore = s.replace(/-/g, '_')
  return {
    slug:               s,
    dockerProjectName:  `fluxtic-${s}`,
    postgresDb:         underscore,
    n8nDb:              `${underscore}_n8n`,
    postgresUser:       underscore,
    postgresContainer:  `postgres-${s}`,
    redisContainer:     `redis-${s}`,
    apiContainer:       `api-${s}`,
    appContainer:       `app-${s}`,
    n8nContainer:       `n8n-${s}`,
    network:            `${s}_internal`,
    folderPath:         `/opt/fluxtic/clients/${s}`,
    backupPath:         `/opt/fluxtic/backups/${s}`,
  }
}

// ── .env del cliente ──────────────────────────────────────
export function renderEnvFile(opts: {
  payload:  CreateClientPayload
  secrets:  ClientSecrets
  product:  ProductMetadata
  naming:   ReturnType<typeof namingFor>
  adminEmail: string
}): string {
  const { payload, secrets, product, naming, adminEmail } = opts

  // Validación defensiva sobre los dominios (vienen ya validados, pero
  // los dominios entran al docker-compose y a Traefik, así que reverificamos)
  for (const d of [payload.domains.crmDomain, payload.domains.n8nDomain]) {
    const r = validateDomainFormat(d)
    if (!r.ok) throw new Error(`Dominio inválido en render: ${r.reason}`)
  }
  if (payload.domains.apiDomain) {
    const r = validateDomainFormat(payload.domains.apiDomain)
    if (!r.ok) throw new Error(`apiDomain inválido en render: ${r.reason}`)
  }

  const lines = [
    `# Fluxtic — ${payload.client.name}`,
    `# Generado por la consola de provisionamiento`,
    `# Producto: ${product.name} v${product.version}`,
    `# Modo: ${payload.infra.mode}`,
    ``,
    `# ── Identidad del stack ──`,
    `FLUXTIC_SLUG=${naming.slug}`,
    `FLUXTIC_MODE=${payload.infra.mode}`,
    `FLUXTIC_PRODUCT=${product.productType}`,
    `FLUXTIC_PRODUCT_VERSION=${product.version}`,
    ``,
    `# ── Dominios ──`,
    `CRM_DOMAIN=${payload.domains.crmDomain}`,
    `N8N_DOMAIN=${payload.domains.n8nDomain}`,
    `API_DOMAIN=${payload.domains.apiDomain ?? `api-${naming.slug}.fluxtic.com`}`,
    ``,
    `# ── PostgreSQL ──`,
    `POSTGRES_USER=${naming.postgresUser}`,
    `POSTGRES_PASSWORD=${secrets.postgresPassword}`,
    `POSTGRES_DB=${naming.postgresDb}`,
    `N8N_DB=${naming.n8nDb}`,
    ``,
    `# ── Redis ──`,
    `REDIS_PASSWORD=${secrets.redisPassword}`,
    ``,
    `# ── n8n ──`,
    `N8N_USER=admin`,
    `N8N_PASSWORD=${secrets.n8nBasicAuthPass}`,
    `N8N_ENCRYPTION_KEY=${secrets.n8nEncryptionKey}`,
    ``,
    `# ── API ──`,
    `API_JWT_SECRET=${secrets.apiJwtSecret}`,
    `WEBHOOK_SECRET=${secrets.webhookSecret}`,
    `ADMIN_INITIAL_EMAIL=${adminEmail}`,
    ``,
    `# ── Branding ──`,
    `BRAND_DISPLAY_NAME=${payload.branding.displayName}`,
    `BRAND_PRIMARY=${payload.branding.primaryColor}`,
    `BRAND_SECONDARY=${payload.branding.secondaryColor}`,
    `BRAND_SUPPORT_EMAIL=${payload.branding.supportEmail ?? ''}`,
    `BRAND_SUPPORT_WHATSAPP=${payload.branding.supportWhatsapp ?? ''}`,
    ``,
    `# ── Variables requeridas por el producto ──`,
    ...product.requiredEnv.map(k => `# ${k} (revisada arriba)`),
    ``,
    `# ── Integraciones (pendientes de credenciales) ──`,
    ...payload.integrations.enabled.map(i => `# ${i.toUpperCase()} = PENDIENTE`),
    ``,
  ]

  return lines.join('\n')
}

// ── docker-compose.yml del cliente ────────────────────────
//
// Esta plantilla replica la estructura de DelfinaPazBueno/docker-compose.yml
// pero usando exclusivamente nombres derivados del slug ya validado.

export function renderDockerCompose(opts: {
  naming:    ReturnType<typeof namingFor>
  payload:   CreateClientPayload
}): string {
  const { naming, payload } = opts
  const tz = 'America/Argentina/Buenos_Aires'

  return [
    `version: "3.8"`,
    ``,
    `# ──────────────────────────────────────────────────────────────────`,
    `# Stack Fluxtic — ${payload.client.name} (${naming.slug})`,
    `# Generado por la consola de provisionamiento`,
    `# ──────────────────────────────────────────────────────────────────`,
    ``,
    `services:`,
    `  ${naming.postgresContainer}:`,
    `    image: postgres:16-alpine`,
    `    container_name: ${naming.postgresContainer}`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      POSTGRES_USER:     \${POSTGRES_USER}`,
    `      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}`,
    `      POSTGRES_DB:       \${POSTGRES_DB}`,
    `      PGDATA:            /var/lib/postgresql/data/pgdata`,
    `    volumes:`,
    `      - ./postgres/data:/var/lib/postgresql/data`,
    `      - ./postgres/init:/docker-entrypoint-initdb.d:ro`,
    `    networks: [${naming.network}]`,
    `    healthcheck:`,
    `      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER}"]`,
    `      interval: 10s`,
    `      timeout:  5s`,
    `      retries:  5`,
    ``,
    `  ${naming.redisContainer}:`,
    `    image: redis:7-alpine`,
    `    container_name: ${naming.redisContainer}`,
    `    restart: unless-stopped`,
    `    command: redis-server --requirepass \${REDIS_PASSWORD} --appendonly yes`,
    `    volumes:`,
    `      - ./redis/data:/data`,
    `    networks: [${naming.network}]`,
    `    healthcheck:`,
    `      test: ["CMD", "redis-cli", "-a", "\${REDIS_PASSWORD}", "ping"]`,
    `      interval: 10s`,
    `      timeout:  5s`,
    `      retries:  5`,
    ``,
    `  ${naming.n8nContainer}:`,
    `    image: n8nio/n8n:latest`,
    `    container_name: ${naming.n8nContainer}`,
    `    restart: unless-stopped`,
    `    depends_on:`,
    `      ${naming.postgresContainer}: { condition: service_healthy }`,
    `    environment:`,
    `      N8N_HOST:               ${payload.domains.n8nDomain}`,
    `      N8N_PORT:               "5678"`,
    `      N8N_PROTOCOL:           https`,
    `      WEBHOOK_URL:            https://${payload.domains.n8nDomain}/`,
    `      N8N_EDITOR_BASE_URL:    https://${payload.domains.n8nDomain}`,
    `      N8N_PROXY_HOPS:         "1"`,
    `      DB_TYPE:                postgresdb`,
    `      DB_POSTGRESDB_HOST:     ${naming.postgresContainer}`,
    `      DB_POSTGRESDB_PORT:     "5432"`,
    `      DB_POSTGRESDB_DATABASE: \${N8N_DB}`,
    `      DB_POSTGRESDB_USER:     \${POSTGRES_USER}`,
    `      DB_POSTGRESDB_PASSWORD: \${POSTGRES_PASSWORD}`,
    `      DB_POSTGRESDB_SCHEMA:   public`,
    `      N8N_ENCRYPTION_KEY:     \${N8N_ENCRYPTION_KEY}`,
    `      N8N_BASIC_AUTH_ACTIVE:  "true"`,
    `      N8N_BASIC_AUTH_USER:    \${N8N_USER}`,
    `      N8N_BASIC_AUTH_PASSWORD: \${N8N_PASSWORD}`,
    `      GENERIC_TIMEZONE:       ${tz}`,
    `      TZ:                     ${tz}`,
    `      EXECUTIONS_DATA_SAVE_ON_ERROR: all`,
    `    volumes:`,
    `      - ./n8n/data:/home/node/.n8n`,
    `    networks: [${naming.network}, proxy]`,
    `    labels:`,
    `      - "traefik.enable=true"`,
    `      - "traefik.docker.network=proxy"`,
    `      - "traefik.http.routers.${naming.n8nContainer}.rule=Host(\`${payload.domains.n8nDomain}\`)"`,
    `      - "traefik.http.routers.${naming.n8nContainer}.entrypoints=websecure"`,
    `      - "traefik.http.routers.${naming.n8nContainer}.tls.certresolver=le"`,
    `      - "traefik.http.services.${naming.n8nContainer}.loadbalancer.server.port=5678"`,
    ``,
    `  ${naming.apiContainer}:`,
    `    image: ghcr.io/fluxtic/${payload.product.productType}-api:latest`,
    `    container_name: ${naming.apiContainer}`,
    `    restart: unless-stopped`,
    `    depends_on:`,
    `      ${naming.postgresContainer}: { condition: service_healthy }`,
    `    environment:`,
    `      DATABASE_URL: postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@${naming.postgresContainer}:5432/\${POSTGRES_DB}`,
    `      JWT_SECRET:   \${API_JWT_SECRET}`,
    `      TZ:           ${tz}`,
    `    networks: [${naming.network}, proxy]`,
    `    labels:`,
    `      - "traefik.enable=true"`,
    `      - "traefik.docker.network=proxy"`,
    `      - "traefik.http.routers.${naming.apiContainer}.rule=Host(\`\${API_DOMAIN}\`)"`,
    `      - "traefik.http.routers.${naming.apiContainer}.entrypoints=websecure"`,
    `      - "traefik.http.routers.${naming.apiContainer}.tls.certresolver=le"`,
    `      - "traefik.http.services.${naming.apiContainer}.loadbalancer.server.port=3000"`,
    ``,
    `  ${naming.appContainer}:`,
    `    image: ghcr.io/fluxtic/${payload.product.productType}-app:latest`,
    `    container_name: ${naming.appContainer}`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      NEXT_PUBLIC_API_URL: https://\${API_DOMAIN}`,
    `      NEXT_PUBLIC_BRAND_NAME: \${BRAND_DISPLAY_NAME}`,
    `      NEXT_PUBLIC_BRAND_PRIMARY: \${BRAND_PRIMARY}`,
    `      NEXT_PUBLIC_BRAND_SECONDARY: \${BRAND_SECONDARY}`,
    `      TZ: ${tz}`,
    `    networks: [${naming.network}, proxy]`,
    `    labels:`,
    `      - "traefik.enable=true"`,
    `      - "traefik.docker.network=proxy"`,
    `      - "traefik.http.routers.${naming.appContainer}.rule=Host(\`${payload.domains.crmDomain}\`)"`,
    `      - "traefik.http.routers.${naming.appContainer}.entrypoints=websecure"`,
    `      - "traefik.http.routers.${naming.appContainer}.tls.certresolver=le"`,
    `      - "traefik.http.services.${naming.appContainer}.loadbalancer.server.port=3000"`,
    ``,
    `networks:`,
    `  ${naming.network}:`,
    `    driver: bridge`,
    `  proxy:`,
    `    external: true`,
  ].join('\n')
}

// ── Comandos SSH sugeridos (V1) ───────────────────────────
//
// Esta lista se entrega al super_admin después de crear el cliente.
// Son acciones idempotentes que deberían correrse una sola vez en el
// servidor donde vive la infraestructura compartida (Traefik, red proxy).
//
// IMPORTANTE: no se ejecutan automáticamente. Se muestran como texto.
export function buildManualSshCommands(opts: {
  naming:   ReturnType<typeof namingFor>
}): string[] {
  const { naming } = opts
  return [
    `# 1. Crear estructura de carpetas en el servidor`,
    `sudo mkdir -p ${naming.folderPath}/postgres/data ${naming.folderPath}/postgres/init`,
    `sudo mkdir -p ${naming.folderPath}/redis/data ${naming.folderPath}/n8n/data`,
    `sudo mkdir -p ${naming.backupPath}`,
    ``,
    `# 2. Subir docker-compose.yml y .env (descargados del panel)`,
    `sudo nano ${naming.folderPath}/.env             # pegá el .env del panel`,
    `sudo nano ${naming.folderPath}/docker-compose.yml`,
    `sudo chmod 600 ${naming.folderPath}/.env`,
    ``,
    `# 3. Verificar que existe la red proxy (Traefik global)`,
    `docker network inspect proxy >/dev/null 2>&1 || docker network create proxy`,
    ``,
    `# 4. Levantar el stack`,
    `cd ${naming.folderPath} && docker compose up -d`,
    ``,
    `# 5. Verificar healthchecks`,
    `docker compose -f ${naming.folderPath}/docker-compose.yml ps`,
    ``,
    `# 6. Ejecutar migraciones de la API (la primera vez)`,
    `docker compose -f ${naming.folderPath}/docker-compose.yml exec ${naming.apiContainer} npx prisma migrate deploy`,
    `docker compose -f ${naming.folderPath}/docker-compose.yml exec ${naming.apiContainer} node dist/seed.js`,
    ``,
    `# 7. Apuntar DNS de los dominios al servidor (si no es subdominio fluxtic.com automático)`,
    ``,
    `# 8. Volver al panel, marcar el cliente como ACTIVO y compartir credenciales con el cliente`,
  ]
}

export function buildClientTenantData(opts: {
  payload:    CreateClientPayload
  product:    ProductMetadata
  naming:     ReturnType<typeof namingFor>
  uid:        string
  userName:   string | null
}): Omit<ClientTenant, 'id' | 'createdAt' | 'updatedAt' | 'lastBackupAt'> {
  const { payload, product, naming, uid, userName } = opts
  return {
    name:           payload.client.name,
    legalName:      payload.client.legalName ?? null,
    cuit:           payload.client.cuit ?? null,
    contactEmail:   payload.client.contactEmail,
    contactPhone:   payload.client.contactPhone ?? null,
    responsable:    payload.client.responsable ?? null,
    rubro:          payload.client.rubro ?? null,
    observaciones:  payload.client.observaciones ?? null,

    slug:            naming.slug,
    productType:     product.productType,
    templateVersion: product.version,
    mode:            payload.infra.mode,
    status:          'pendiente_manual',

    crmDomain:       payload.domains.crmDomain,
    n8nDomain:       payload.domains.n8nDomain,
    apiDomain:       payload.domains.apiDomain ?? `api-${naming.slug}.fluxtic.com`,

    folderPath:        naming.folderPath,
    dockerProjectName: naming.dockerProjectName,
    postgresDb:        naming.postgresDb,
    postgresUser:      naming.postgresUser,
    postgresContainer: naming.postgresContainer,
    apiContainer:      naming.apiContainer,
    appContainer:      naming.appContainer,
    n8nContainer:      naming.n8nContainer,
    backupPath:        naming.backupPath,

    brandingDisplayName:     payload.branding.displayName,
    brandingPrimary:         payload.branding.primaryColor,
    brandingSecondary:       payload.branding.secondaryColor,
    brandingLoginText:       payload.branding.loginText  ?? null,
    brandingSenderName:      payload.branding.senderName ?? null,
    brandingSupportEmail:    payload.branding.supportEmail ?? null,
    brandingSupportWhatsapp: payload.branding.supportWhatsapp ?? null,
    brandingLogoUrl:         payload.branding.logoUrl ?? null,

    createdById:   uid,
    createdByName: userName,
  }
}
