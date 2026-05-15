// ─────────────────────────────────────────────
// Tipos compartidos para el módulo de Turnos
// ─────────────────────────────────────────────

export type EstadoTurno =
  | 'PENDIENTE'
  | 'PENDIENTE_PAGO_MP'
  | 'PENDIENTE_VALIDACION_MANUAL'
  | 'CONFIRMADO'
  | 'EN_CURSO'
  | 'PENDIENTE_FACTURAR'
  | 'COMPLETADO'
  | 'CANCELADO'
  | 'NO_SHOW'
  | 'VENCIDO'
  | 'RECHAZADO';

export interface Turno {
  id: string;
  fecha: string;          // ISO date YYYY-MM-DD
  hora_inicio: string;    // HH:MM
  hora_fin: string;       // HH:MM
  duracion_min: number;
  estado: EstadoTurno;
  precio: number;
  senia?: number;
  notas?: string;
  cliente: {
    id: string;
    nombre: string;
    apellido: string;
    telefono: string;
    segmento: 'FINAL' | 'MAYORISTA' | 'VIP';
  };
  servicio: {
    id: string;
    nombre: string;
    categoria: string;
    duracion_min: number;
    precio: number;
  };
  profesional: {
    id: string;
    nombre: string;
    apellido: string;
    color?: string;
  };
  automatizaciones?: {
    confirmacion_enviada: boolean;
    recordatorio_enviado: boolean;
    recordatorio_respondido?: boolean;
    seguimiento_enviado: boolean;
  };
}

export interface Servicio {
  id: string;
  nombre: string;
  categoria: string;
  duracion_min: number;
  precio: number;
}

export interface Profesional {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  color?: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  segmento: 'FINAL' | 'MAYORISTA' | 'VIP';
}

export interface NuevoTurnoPayload {
  cliente_id: string;
  servicio_id: string;
  profesional_id: string;
  fecha: string;
  hora_inicio: string;
  senia?: number;
  notas?: string;
}
