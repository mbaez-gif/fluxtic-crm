# Fluxtic Salud

CRM clínico para clínicas, consultorios y centros médicos. Forkeado de la base operativa Delfina Paz y reconvertido al dominio salud.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind
- **Backend**: Fastify + Prisma 5
- **Base de datos**: PostgreSQL 16
- **Storage**: MinIO (S3-compatible) para documentos clínicos
- **Cache**: Redis
- **Automatizaciones**: n8n
- **Orquestación**: Docker Compose + Traefik

## Estructura

```
.
├── app/                   # Next.js — admin + portal paciente
│   ├── src/app/admin/     # Backoffice (dashboard, pacientes, agenda, HC, ...)
│   ├── src/app/portal/    # Portal del paciente
│   ├── src/lib/           # api client, auth, permissions (espejo de policies)
│   └── src/components/    # Sidebar, Topbar, PagePlaceholder
├── api/                   # Fastify + Prisma
│   ├── src/lib/           # prisma (soft-delete), audit, policies, auth.plugin
│   ├── src/routes/        # health, sedes, especialidades, profesionales,
│   │                      # prestaciones, coberturas, pacientes, turnos,
│   │                      # historia-clinica, documentos, facturacion,
│   │                      # insumos, auditoria, portal, auth, dashboard
│   ├── prisma/
│   │   ├── schema.prisma  # Schema clínico (35 modelos)
│   │   ├── migrations/    # Baseline
│   │   └── seed.ts        # 5 usuarios + 2 sedes + 4 profesionales + 10 pacientes + 20 turnos
│   └── legacy-delfina/    # Código heredado para referencia (no compilado)
├── infra/                 # Variables de entorno de referencia
├── postgres/init/         # Scripts init de DBs
└── docker-compose.yml
```

## Roles

`ADMIN_GENERAL`, `RECEPCION`, `FACTURACION`, `MEDICO`, `COORDINADOR_MEDICO`, `PACIENTE`, `AUDITOR`.

Matriz de permisos en `api/src/lib/policies.ts` (espejo client-side en `app/src/lib/permissions.ts`).

## Levantar el stack

```bash
# 1. Configurar variables
cp infra/env.example .env
# editar .env: POSTGRES_USER, POSTGRES_PASSWORD, NEXTAUTH_SECRET, etc.

# 2. Levantar infra
docker compose up -d postgres-salud redis-salud minio-salud

# 3. Aplicar migraciones y seed
cd api && npm install
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="..." npm run db:seed

# 4. Levantar API y admin
docker compose up -d api-salud admin-salud
```

## Usuarios demo (post-seed)

Password: `Salud2026!`

| Email                       | Rol                | Vista al loguear     |
|-----------------------------|--------------------|----------------------|
| admin@clinica.com           | ADMIN_GENERAL      | `/admin/dashboard`   |
| recepcion@clinica.com       | RECEPCION          | `/admin/dashboard`   |
| facturacion@clinica.com     | FACTURACION        | `/admin/facturacion` |
| medico@clinica.com          | MEDICO             | `/admin/agenda`      |
| paciente@clinica.com        | PACIENTE           | `/portal/turnos`     |

## Endpoints API (resumen)

| Recurso              | Endpoint principal                |
|----------------------|-----------------------------------|
| Health               | `GET /health`                     |
| Login                | `POST /auth/login`                |
| Sedes                | `/sedes`                          |
| Especialidades       | `/especialidades`                 |
| Profesionales        | `/profesionales`                  |
| Prestaciones         | `/prestaciones`                   |
| Coberturas           | `/coberturas`                     |
| Pacientes            | `/pacientes`                      |
| Agenda               | `/turnos` (filtros: sede, fecha, profesional) |
| Historia clínica     | `/historia-clinica/paciente/:id`  |
| Documentos clínicos  | `/documentos/presign-upload`      |
| Facturación          | `/facturacion/comprobantes,pagos,caja,deudas` |
| Insumos              | `/insumos` + `/insumos/alertas`   |
| Auditoría            | `/auditoria` (filtros: entidad, usuario, fecha) |
| Portal paciente      | `/portal/mis-turnos, mi-historia, mis-documentos, mis-pagos` |
| Dashboard            | `/dashboard`                      |

## Validar que todo compila

```bash
cd api && npx tsc --noEmit          # API ✓
cd app && npx next build            # Admin + portal ✓
```

## Etapa 1 vs siguientes

**Foundation cerrada (commits C01-C18)**:
- Stack levantado, branding clínico, schema Prisma completo (35 modelos)
- Soft-delete con extension Prisma + audit log obligatorio en HC
- 18 endpoints REST con permisos por rol
- Frontend admin: dashboard funcional + ficha de paciente + auditoría funcional + 13 módulos con stubs apuntando a su API
- Portal del paciente con middleware de redirección por rol
- Seed con 5 usuarios demo y datos mínimos para demo

**Próximas iteraciones (no etapa 1)**:
- Pantallas CRUD completas para los módulos administrativos (los stubs marcan qué pantalla espera cada endpoint)
- Vista calendario de agenda con drag&drop
- Línea de tiempo de historia clínica en la ficha del paciente
- Wizard de reserva pública de turnos
- Workflows n8n migrados desde Delfina (recordatorios, confirmaciones)
- Reportes operativos con PDF/Excel
- Firma criptográfica de evoluciones
