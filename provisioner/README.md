# Fluxtic Provisioner — Worker

Servicio en Node que corre como `systemd` en la VM donde viven los stacks
de los clientes. Toma jobs encolados por la consola Plataforma del CRM
de Fluxtic y ejecuta el despliegue real (Docker, healthchecks,
migraciones) sin que un operador tenga que entrar por SSH.

Esta es la **V2** de la arquitectura descripta en
[`../docs/provisioning.md`](../docs/provisioning.md).

## Diagrama

```
┌────────────────────────┐
│  fluxtic-crm (Next.js) │
│  Plataforma → Wizard   │
└──────────┬─────────────┘
           │  POST /api/provisioning/clients
           ▼
┌────────────────────────┐
│  Firestore             │
│  provisioning_jobs     │  status = QUEUED ←── creado por el CRM
│  provisioning_*        │
└──────────┬─────────────┘
           │  poll (5s)
           ▼
┌────────────────────────┐
│  fluxtic-provisioner   │
│  (este servicio)       │
│                        │
│  - claim with lease    │
│  - mkdir folder        │
│  - write .env / compose│
│  - docker compose up   │
│  - waitForHealth       │
│  - run migrations      │
│  - finalize            │
└────────────────────────┘
```

## Instalación rápida

```bash
# En la VM, como root:
git clone <repo> /tmp/fluxtic-crm
cd /tmp/fluxtic-crm/provisioner
sudo bash scripts/install.sh

# Editar las credenciales de Firebase:
sudo nano /etc/fluxtic/provisioner.env

# Habilitar e iniciar:
sudo systemctl enable --now fluxtic-provisioner
sudo journalctl -u fluxtic-provisioner -f
```

Cuando esté corriendo, ajustá la variable `PROVISIONING_MODE=worker` en
las env del CRM para que los nuevos clientes se encolen acá en vez de
mostrar comandos manuales.

## Configuración

Las variables se cargan desde `/etc/fluxtic/provisioner.env`
(propiedad `root`, modo `600`):

| Variable                       | Default                       | Notas                                       |
|--------------------------------|-------------------------------|---------------------------------------------|
| `FIREBASE_ADMIN_PROJECT_ID`    | —                             | requerido                                   |
| `FIREBASE_ADMIN_CLIENT_EMAIL`  | —                             | requerido                                   |
| `FIREBASE_ADMIN_PRIVATE_KEY`   | —                             | requerido, con `\n` literales               |
| `FLUXTIC_ROOT`                 | `/opt/fluxtic/clients`        | raíz de los stacks por cliente              |
| `BACKUP_ROOT`                  | `/opt/fluxtic/backups`        | raíz de las carpetas de backup              |
| `PROXY_NETWORK`                | `proxy`                       | red Docker compartida con Traefik global    |
| `WORKER_ID`                    | `worker-<pid>`                | identidad del worker para el lease          |
| `POLL_INTERVAL_MS`             | `5000`                        | ms entre intentos de claim                  |
| `LEASE_TTL_SECONDS`            | `600`                         | si el worker muere, otro toma el job tras esto |
| `HEALTHCHECK_TIMEOUT_MS`       | `180000`                      | timeout máximo esperando contenedores OK    |
| `DOCKER_BIN`                   | `docker`                      | path al binario docker                      |

## Modelo de claim y lease

- El worker consulta `provisioning_jobs` filtrando por `status == 'QUEUED'`.
- Toma el job con una **transacción Firestore**: setea `status = EN_PROCESO`,
  `workerId` y `leaseExpiresAt = now + LEASE_TTL_SECONDS`.
- Entre paso y paso renueva el lease.
- Si el worker muere en mitad de un job, otro worker (o un reinicio
  del mismo) puede tomar el job **una vez expirado el lease**. Para evitar
  doble ejecución en jobs no idempotentes (por ej. `docker compose up`),
  el TTL por defecto es 10 minutos.

## Cleanup seguro

Si un paso falla, el comportamiento depende de **cuándo** falló:

| Falló en                | Acción                                                |
|-------------------------|-------------------------------------------------------|
| Antes de `STARTING_STACK` | Borra `folderPath` (no había contenedores ni datos) |
| `STARTING_STACK` o después | **No toca nada.** Deja todo para inspección manual. |

Razón: si ya se hizo `docker compose up`, puede haber volúmenes con datos
del cliente. Borrar automáticamente sería peligroso.

## Seguridad

- El servicio corre como usuario `fluxtic` (no root) miembro del grupo
  `docker` — eso le permite hablar con el socket sin más privilegios.
- El unit de systemd aplica `NoNewPrivileges`, `ProtectSystem=strict`,
  `ProtectHome`, `PrivateTmp` y limita `ReadWritePaths` a
  `/opt/fluxtic/clients`, `/opt/fluxtic/backups` y su propio directorio.
- El worker **valida en profundidad** cada slug y cada container name
  contra regex/lista negra antes de hacer cualquier escritura — aunque
  Firestore esté comprometido, un slug malicioso no escapa del root.
- El `.env` del cliente se escribe con permisos `0600`.
- Los logs persisten en `provisioning_logs` con secretos redactados.

Ver [`../docs/provisioning-security-checklist.md`](../docs/provisioning-security-checklist.md).

## Desarrollo local

```bash
npm install
cp scripts/sample.env .env   # exportar las mismas variables
npm run dev
```

## Cómo se relaciona con el CRM

- **`PROVISIONING_MODE=manual`** (default): el CRM funciona como en V1.
  Genera archivos, los muestra, da los comandos SSH. No usa worker.
- **`PROVISIONING_MODE=worker`**: el CRM crea el cliente, el file bundle
  y el job con `status = QUEUED`. Devuelve al usuario el `jobId` y la
  pantalla de progreso. **Este worker es el que ejecuta**.

Vos podés tener el worker corriendo y aún así dejar el CRM en modo
`manual` para testear sin que toque la VM.
