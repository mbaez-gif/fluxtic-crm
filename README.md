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
├── api/                   # Fastify + Prisma
│   └── prisma/
│       ├── schema.prisma  # Schema clínico
│       └── migrations/
├── infra/                 # Variables de entorno de referencia
├── postgres/init/         # Scripts init de DBs
└── docker-compose.yml
```

## Roles

`ADMIN_GENERAL`, `RECEPCION`, `FACTURACION`, `MEDICO`, `COORDINADOR_MEDICO`, `PACIENTE`, `AUDITOR`.

## Levantar el stack

```bash
cp infra/env.example .env
# editar .env con valores reales
docker compose up -d
cd api && npx prisma migrate deploy && npx prisma db seed
```

## Etapa actual

Etapa 1 — Foundation. Ver progreso en commits.
