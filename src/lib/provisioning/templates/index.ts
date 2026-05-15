// Catálogo de productos verticales de Fluxtic.
// En V1 las metadatas viven embebidas en este archivo y son la fuente
// de verdad para el wizard, las validaciones y el `metadata.json` que
// se guarda junto a cada cliente.
//
// En V2/V3 estas metadatas se leerán desde
// /opt/fluxtic/templates/<producto>/metadata.json en el servidor de
// provisionamiento; pero los nombres, versión y campos serán los mismos.

import type { ProductMetadata, ProductType } from '@/types/provisioning'

const SALUD: ProductMetadata = {
  productType: 'salud',
  name:        'Fluxtic Salud',
  version:     '1.0.0',
  description:
    'CRM clínico: agenda médica, pacientes, historia clínica, ' +
    'profesionales, facturación, comunicaciones, automatizaciones y reportes.',
  modules: [
    'dashboard',
    'agenda_medica',
    'pacientes',
    'historia_clinica',
    'profesionales',
    'facturacion',
    'comunicaciones',
    'automatizaciones',
    'reportes',
    'configuracion',
  ],
  roles: [
    'ADMIN_GENERAL',
    'RECEPCION',
    'FACTURACION',
    'MEDICO',
    'PACIENTE',
    'AUDITOR',
  ],
  demoUsers: [
    { email: 'admin@cliente.com',       role: 'ADMIN_GENERAL', nombre: 'Administrador' },
    { email: 'recepcion@cliente.com',   role: 'RECEPCION',     nombre: 'Recepción' },
    { email: 'medico@cliente.com',      role: 'MEDICO',        nombre: 'Dr. Demo' },
    { email: 'facturacion@cliente.com', role: 'FACTURACION',   nombre: 'Facturación' },
    { email: 'paciente.demo@cliente.com', role: 'PACIENTE',    nombre: 'Paciente Demo' },
  ],
  workflows: [
    'confirmacion_turno',
    'recordatorio_48hs',
    'recordatorio_24hs',
    'recordatorio_2hs',
    'cancelacion_turno',
    'reprogramacion',
    'pago_aprobado',
    'comprobante_recibido',
    'seguimiento_postconsulta',
    'reporte_diario',
    'paciente_inactivo',
  ],
  requiredEnv: [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'N8N_USER',
    'N8N_PASSWORD',
    'N8N_ENCRYPTION_KEY',
    'API_JWT_SECRET',
  ],
}

const BEAUTY: ProductMetadata = {
  productType: 'beauty',
  name:        'Fluxtic Beauty',
  version:     '1.0.0',
  description:
    'CRM para estética y peluquería: agenda, clientes, ventas, fichas, ' +
    'pagos, fidelización y campañas WhatsApp.',
  modules: [
    'dashboard',
    'agenda',
    'clientes',
    'fichas',
    'productos',
    'ventas',
    'pagos',
    'fidelizacion',
    'comunicaciones',
    'reportes',
    'configuracion',
  ],
  roles: ['ADMIN_GENERAL', 'RECEPCION', 'PROFESIONAL', 'CAJA', 'AUDITOR'],
  demoUsers: [
    { email: 'admin@cliente.com',     role: 'ADMIN_GENERAL', nombre: 'Administradora' },
    { email: 'recepcion@cliente.com', role: 'RECEPCION',     nombre: 'Recepción' },
    { email: 'pro@cliente.com',       role: 'PROFESIONAL',   nombre: 'Profesional Demo' },
    { email: 'caja@cliente.com',      role: 'CAJA',          nombre: 'Caja' },
  ],
  workflows: [
    'confirmacion_turno',
    'recordatorio_24hs',
    'cancelacion_turno',
    'cumpleanos_cliente',
    'pago_aprobado',
    'campania_promocion',
    'reporte_diario',
    'cliente_inactivo',
  ],
  requiredEnv: [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'N8N_USER',
    'N8N_PASSWORD',
    'N8N_ENCRYPTION_KEY',
    'API_JWT_SECRET',
  ],
}

const GASTRO: ProductMetadata = {
  productType: 'gastro',
  name:        'Fluxtic Gastro',
  version:     '1.0.0',
  description:
    'CRM gastronómico: reservas, salones, mesas, comandas, caja, ' +
    'inventario y campañas de fidelización.',
  modules: [
    'dashboard',
    'reservas',
    'mesas',
    'comandas',
    'menu',
    'caja',
    'inventario',
    'clientes',
    'reportes',
    'configuracion',
  ],
  roles: ['ADMIN_GENERAL', 'MAITRE', 'MOZO', 'CAJA', 'COCINA', 'AUDITOR'],
  demoUsers: [
    { email: 'admin@cliente.com', role: 'ADMIN_GENERAL', nombre: 'Administrador' },
    { email: 'maitre@cliente.com', role: 'MAITRE',       nombre: 'Maître Demo' },
    { email: 'mozo@cliente.com',  role: 'MOZO',          nombre: 'Mozo Demo' },
    { email: 'caja@cliente.com',  role: 'CAJA',          nombre: 'Caja Demo' },
  ],
  workflows: [
    'confirmacion_reserva',
    'recordatorio_2hs',
    'cancelacion_reserva',
    'comanda_lista',
    'cierre_de_caja',
    'reporte_diario',
    'campania_promocion',
  ],
  requiredEnv: [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'N8N_USER',
    'N8N_PASSWORD',
    'N8N_ENCRYPTION_KEY',
    'API_JWT_SECRET',
  ],
}

const PERSONALIZADO: ProductMetadata = {
  productType: 'personalizado',
  name:        'CRM Personalizado',
  version:     '0.1.0',
  description:
    'Stack base configurable. Sin módulos preinstalados — el equipo ' +
    'Fluxtic agrega los necesarios después del provisionamiento.',
  modules: ['dashboard', 'configuracion'],
  roles: ['ADMIN_GENERAL', 'OPERADOR', 'AUDITOR'],
  demoUsers: [
    { email: 'admin@cliente.com', role: 'ADMIN_GENERAL', nombre: 'Administrador' },
  ],
  workflows: [],
  requiredEnv: [
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'N8N_USER',
    'N8N_PASSWORD',
    'N8N_ENCRYPTION_KEY',
    'API_JWT_SECRET',
  ],
}

const CATALOG: Record<ProductType, ProductMetadata> = {
  salud:         SALUD,
  beauty:        BEAUTY,
  gastro:        GASTRO,
  personalizado: PERSONALIZADO,
}

export function listProducts(): ProductMetadata[] {
  return Object.values(CATALOG)
}

export function getProduct(type: ProductType): ProductMetadata {
  const p = CATALOG[type]
  if (!p) throw new Error(`Producto desconocido: ${type}`)
  return p
}
