# Módulo de Provisionamiento (Plataforma → Clientes Fluxtic)

Consola interna del CRM de Fluxtic para dar de alta nuevas instancias verticales
(Fluxtic Salud, Beauty, Gastro, CRM personalizado) sin entrar manualmente por
SSH al servidor.

---

## 1. Estado de esta entrega

**V1 — Modo manual** (default): wizard completo, persistencia, generación
de `.env` y `docker-compose.yml`, comandos SSH para correr a mano.

**V2 — Modo worker** (implementado): un daemon en la VM
(`provisioner/`, ver [`../provisioner/README.md`](../provisioner/README.md))
toma los jobs encolados por el CRM y ejecuta el despliegue real (docker
compose pull/up, healthchecks, migraciones, verificación HTTP), con
**cleanup automático seguro** si algo falla antes del primer
`docker compose up`.

Se activa cambiando `PROVISIONING_MODE=worker` en el `.env.local` del CRM.
El default sigue siendo `manual` para no romper instalaciones existentes.

**V3** (pendiente): import real de workflows n8n via API REST por
instancia, backups automatizados con cron + retención, panel de
monitoreo agregado.

---

## 2. Decisión técnica importante: Firestore en lugar de Prisma

El spec original pedía modelos Prisma + PostgreSQL. El CRM de Fluxtic actual
**no usa Prisma**: corre con Next.js 14 + Firebase Auth + Firestore. Forzar
Prisma implicaría infraestructura nueva (Postgres + worker + backend Node)
que excede esta entrega.

Por eso esta versión persiste los datos en **colecciones Firestore** pero
**conserva nombre, campos y semántica** del data model pedido. Si más
adelante se introduce Prisma, los contratos TypeScript y los endpoints HTTP
quedan sin cambios; sólo cambia la implementación de la capa de datos.

Equivalencia:

| Modelo Prisma pedido    | Colección Firestore                |
|-------------------------|------------------------------------|
| `ClientTenant`          | `provisioning_clients`             |
| `ProvisioningJob`       | `provisioning_jobs`                |
| `ProvisioningLog`       | `provisioning_logs`                |
| `ClientDomain`          | `provisioning_client_domains`      |
| `ClientIntegration`     | `provisioning_client_integrations` |
| `ClientInitialUser`     | `provisioning_client_users`        |
| `ClientWorkflow`        | `provisioning_client_workflows`    |
| `ClientBackupConfig`    | `provisioning_client_backups`      |

---

## 3. Roles y permisos

Se extiende el tipo `Role` del CRM:

```ts
type Role = 'super_admin' | 'admin' | 'consultor'
```

- `super_admin`: ÚNICO rol con acceso al módulo Plataforma → Clientes Fluxtic.
  Mapea al `SUPER_ADMIN` / `ADMIN_FLUXTIC` de la spec.
- `admin`: rol existente de administración del CRM interno (gastos, cierre).
  **No** ve el módulo de provisionamiento.
- `consultor`: rol operativo. **No** ve el módulo.

Toda ruta del módulo:

- Frontend: gateada en el `Sidebar` y en cada `page.tsx` (`useRequireSuperAdmin`).
- API routes: validan el JWT de Firebase y comprueban que el `users/{uid}.rol`
  sea `super_admin` antes de cualquier escritura.
- Firestore Rules: las colecciones `provisioning_*` sólo permiten lectura y
  escritura a usuarios con `rol == 'super_admin'`.

---

## 4. Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Browser — Wizard de provisionamiento                       │
│  /plataforma/clientes/nuevo                                 │
└─────────────────────────────────────────────────────────────┘
                          │  fetch + Firebase ID token
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js API routes — /api/provisioning/*                   │
│  - Verifican ID token con firebase-admin                    │
│  - Verifican rol super_admin                                 │
│  - Llaman al ProvisioningService                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ProvisioningService (src/lib/provisioning/service.ts)      │
│  - validateInput / validateSlug / validateDomains            │
│  - generateSecrets, generateEnvFile, generateDockerCompose  │
│  - Persiste cliente, job, dominios, logs en Firestore        │
│  - V1: marca el job como PENDING_MANUAL_EXECUTION            │
│         y devuelve los comandos SSH a correr en el servidor  │
│  - V2 (futuro): SSH a infra propia y `docker compose up`     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Firestore: provisioning_clients / provisioning_jobs / ...  │
└─────────────────────────────────────────────────────────────┘
```

El frontend **nunca** ejecuta comandos. Sólo arma el payload y lo manda al
endpoint. El servicio backend tiene un set cerrado de pasos.

---

## 5. Wizard (10 pasos)

| # | Paso              | Datos principales                                       |
|---|-------------------|---------------------------------------------------------|
| 1 | Cliente           | Nombre comercial, razón social, CUIT, email, slug      |
| 2 | Producto          | salud / beauty / gastro / personalizado (carga template)|
| 3 | Dominios          | CRM, n8n, API; subdominio fluxtic.com o propio         |
| 4 | Infraestructura   | DB propia, n8n propio, modo demo/producción            |
| 5 | Branding          | Nombre visible, color principal/secundario, soporte    |
| 6 | Usuarios iniciales| Admin principal + opción crear demo                    |
| 7 | Integraciones     | WhatsApp, Twilio, Meta, MP, SMTP, Google Calendar      |
| 8 | Automatizaciones  | Workflows n8n del producto, estado activo/pausado      |
| 9 | Resumen           | Vista previa antes de crear                            |
| 10| Instalación       | Progreso del job + logs + comandos SSH                 |

Validaciones por paso:

- **Slug**: `^[a-z0-9-]{3,40}$`, único en `provisioning_clients`, no choca
  con la lista negra (`postgres`, `redis`, `traefik`, `n8n`, `api`, `app`,
  `crm`, `admin`, `proxy`, `root`).
- **Dominios**: regex de hostname, sin duplicados en otros clientes, label
  Traefik se genera automático.
- **Email admin**: regex + único entre los usuarios iniciales.
- **Modo**: `demo` o `produccion`.

---

## 6. Endpoints

| Método | Path                                          | Descripción                              |
|--------|-----------------------------------------------|------------------------------------------|
| GET    | `/api/provisioning/products`                  | Lista productos disponibles + metadata   |
| POST   | `/api/provisioning/validate-slug`             | Valida disponibilidad de slug            |
| POST   | `/api/provisioning/validate-domain`           | Valida formato y unicidad de dominio     |
| POST   | `/api/provisioning/clients`                   | Crea cliente + job + arranca pasos       |
| GET    | `/api/provisioning/clients`                   | Lista clientes                            |
| GET    | `/api/provisioning/clients/:id`               | Detalle de cliente                       |
| GET    | `/api/provisioning/clients/:id/files`         | Devuelve `.env` y `docker-compose.yml`   |
| POST   | `/api/provisioning/clients/:id/backup`        | (V2) Dispara backup manual               |
| POST   | `/api/provisioning/clients/:id/start`         | (V2) `docker compose start`              |
| POST   | `/api/provisioning/clients/:id/stop`          | (V2) `docker compose stop`               |
| POST   | `/api/provisioning/clients/:id/restart`       | (V2) `docker compose restart`            |
| GET    | `/api/provisioning/jobs/:id`                  | Estado del job                            |
| GET    | `/api/provisioning/jobs/:id/logs`             | Logs del job                              |
| POST   | `/api/provisioning/jobs/:id/retry`            | (V2) Reintenta desde el paso fallido     |

Todas las rutas:

1. Esperan `Authorization: Bearer <Firebase ID token>`.
2. Verifican el token con `firebase-admin` y leen `users/{uid}.rol`.
3. Devuelven `401` si no hay sesión, `403` si no es `super_admin`.

---

## 7. ProvisioningService — pasos del job

```
1.  PENDIENTE        → VALIDANDO_DATOS
2.  VALIDANDO_DATOS  → CREANDO_CLIENTE
3.  CREANDO_CLIENTE  → GENERANDO_SECRETOS
4.  GENERANDO_SECRETOS → GENERANDO_ENV
5.  GENERANDO_ENV    → GENERANDO_COMPOSE
6.  GENERANDO_COMPOSE → PREPARANDO_BACKUP
7.  PREPARANDO_BACKUP → REGISTRANDO_USUARIOS
8.  REGISTRANDO_USUARIOS → REGISTRANDO_INTEGRACIONES
9.  REGISTRANDO_INTEGRACIONES → REGISTRANDO_WORKFLOWS
10. REGISTRANDO_WORKFLOWS → COMPILANDO_INSTRUCCIONES_SSH
11. COMPILANDO_INSTRUCCIONES_SSH → PENDING_MANUAL_EXECUTION
                                  (estado final en V1)
```

En **V2** se agregarán los pasos: `CREANDO_CARPETA`, `COPIANDO_TEMPLATE`,
`DOCKER_NETWORK`, `DOCKER_COMPOSE_UP`, `PRISMA_GENERATE`, `PRISMA_MIGRATE`,
`SEED`, `N8N_IMPORT_WORKFLOWS`, `HEALTHCHECKS`, `FINALIZADO`.

Cada paso escribe un `ProvisioningLog` con `level` y `metadata`.

---

## 8. Plantillas de productos

Cada producto vive en una carpeta. En V1 las plantillas viven dentro del
repo `DelfinaPazBueno/templates/<producto>/` y se importan en build time
hacia el catálogo del servicio (`src/lib/provisioning/templates/*.ts`).

Estructura por producto:

```
templates/salud/
├── metadata.json          # nombre, módulos, roles, workflows, versión
├── docker-compose.template.yml
├── env.template
├── workflows/             # snapshots de workflows n8n (para V3)
└── seed.template.sql      # seed inicial (opcional)
```

En V2/V3 el `ProvisioningService` lee estas plantillas desde el filesystem
del servidor de provisionamiento (no del entorno serverless del CRM).

---

## 9. Estados visuales

| Estado          | Color    | Cuándo                                |
|-----------------|----------|---------------------------------------|
| `activo`        | verde    | Stack levantado y healthchecks OK     |
| `pendiente`     | amarillo | Esperando acción manual               |
| `error`         | rojo     | Job falló o stack caído               |
| `pausado`       | gris     | Stack detenido manualmente            |
| `en_proceso`    | azul     | Job corriendo                         |

---

## 10. Seguridad (checklist)

Ver `docs/provisioning-security-checklist.md`. Resumen:

- [x] Frontend no ejecuta comandos shell.
- [x] Endpoints validan Firebase ID token.
- [x] Endpoints validan rol `super_admin`.
- [x] Lista cerrada de acciones (no hay endpoint genérico de exec).
- [x] Slug y dominios sanitizados con regex estricto.
- [x] Path traversal imposible: las rutas se arman como
      `/opt/fluxtic/clients/<slug>` con `<slug>` validado.
- [x] Contraseñas temporales se muestran **una sola vez** y luego se borran
      del documento (sólo queda hash para auditoría).
- [x] Auditoría: cada job y cliente registra `createdById`.
- [x] Reglas Firestore restringen colecciones `provisioning_*` a `super_admin`.
- [x] No se commitea ningún secreto al repo: el `.env` generado se devuelve
      sólo al `super_admin` que creó el cliente, una vez.

---

## 11. V2 — Worker `fluxtic-provisioner` (implementado)

El worker vive bajo `provisioner/` en este repo. Es un proceso Node
separado, con su propio `package.json`, `tsconfig.json` y unit de
systemd. Corre como usuario `fluxtic` (grupo `docker`) en la misma VM
que los stacks de los clientes, pero **no comparte el proceso del CRM**.

Flujo:

1. El CRM (en modo `worker`) genera todo, persiste el cliente, el bundle
   (`.env` + `docker-compose.yml` + `metadata.json`) y crea el job con
   `status = QUEUED` y `totalSteps = 9 + 9`.
2. El worker hace polling (cada 5s) sobre `provisioning_jobs` filtrando
   por `QUEUED` (o `EN_PROCESO` con lease expirado).
3. Toma el job con una transacción Firestore que setea
   `status = EN_PROCESO`, `workerId` y `leaseExpiresAt = now + 10min`.
4. Ejecuta los pasos `PREPARING_FOLDER → WRITING_FILES → ENSURING_NETWORK
   → PULLING_IMAGES → STARTING_STACK → WAITING_HEALTH → RUNNING_MIGRATIONS
   → VERIFYING_ENDPOINT → FINALIZADO`. Renueva el lease entre pasos.
5. Si falla **antes** de `STARTING_STACK`, hace cleanup automático
   (borra la carpeta del cliente). Si falla **después**, deja todo
   para inspección manual.
6. Cuando termina marca el cliente como `activo` y el job como
   `COMPLETADO`.

Ver instalación en [`../provisioner/README.md`](../provisioner/README.md).

## 12. V3 — Pendiente

- **Importación de workflows n8n**: una vez que el stack está arriba,
  el worker hace POST a la API REST del n8n del cliente con cada JSON
  de `templates/<producto>/workflows/`. Estado se persiste en
  `ClientWorkflow.n8nWorkflowId`.
- **Backups automatizados**: cron en la VM corre los scripts de
  `DelfinaPazBueno/backup-postgres.sh` adaptados al slug del cliente,
  con retención configurable y verificación de integridad.
- **Panel de monitoreo**: agregado de estados de todos los clientes en
  un dashboard con healthchecks en vivo y alertas.
