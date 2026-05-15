# Módulo de Provisionamiento (Plataforma → Clientes Fluxtic)

Consola interna del CRM de Fluxtic para dar de alta nuevas instancias verticales
(Fluxtic Salud, Beauty, Gastro, CRM personalizado) sin entrar manualmente por
SSH al servidor.

---

## 1. Estado de esta entrega

Esta primera entrega implementa la **Versión 1** descrita en la spec:

- Wizard completo (10 pasos).
- Persistencia de cliente, dominios, integraciones, usuarios iniciales,
  workflows, backups y job de provisionamiento en Firestore.
- Generación en backend de `.env`, `docker-compose.yml` y `metadata.json`
  del cliente.
- Vista de **comandos SSH sugeridos** para ejecutar manualmente la primera vez.
- Logs paso a paso del job (con estados `PENDIENTE`, `EN_PROCESO`,
  `COMPLETADO`, `ERROR`, `CANCELADO`).
- Estado final del job: `PENDING_MANUAL_EXECUTION`.
- Pantalla de listado, detalle, progreso y logs.

La **Versión 2** (ejecución controlada desde backend) y la **Versión 3**
(cola de jobs + worker + healthchecks reales + import de workflows n8n por
API + backups automatizados) quedan documentadas como evolución más abajo.

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

## 11. Evolución a worker / cola de jobs (V3)

Cuando se necesite ejecutar realmente Docker desde backend:

1. Un servicio Node separado (no Next.js serverless) en la misma VM que
   los stacks de clientes. Lo llamamos `fluxtic-provisioner`.
2. Cola de jobs en Redis (BullMQ) o tabla `provisioning_jobs` con
   `status = QUEUED`. El worker hace polling o suscripción.
3. El worker:
   - Lee el job de Firestore.
   - Ejecuta `docker compose -f /opt/fluxtic/clients/<slug>/docker-compose.yml up -d`.
   - Reporta progreso escribiendo logs en `provisioning_logs`.
   - Ejecuta healthchecks (`curl https://<crm>/api/health`).
   - Marca el job como `COMPLETADO` o `ERROR`.
4. Importación de workflows n8n via API REST de cada instancia n8n con un
   token interno.
5. Backups: cron en la VM + entrada en `provisioning_client_backups` con
   timestamp y tamaño.

El CRM se mantiene como **panel de control**: nunca corre el worker.
