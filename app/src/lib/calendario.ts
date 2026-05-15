// ─────────────────────────────────────────────
// Helpers para el calendario semanal
// ─────────────────────────────────────────────

export const HORA_INICIO = 8;   // 8:00
export const HORA_FIN    = 21;  // 21:00
export const SLOT_H      = 56;  // px por hora

/**
 * Devuelve los 6 días laborales de la semana que contiene `base`
 * (lunes a sábado).
 */
export function semanaDeFeha(base: Date): Date[] {
  const d = new Date(base);
  // día de semana JS: 0=dom, 1=lun … 6=sab
  const dow = d.getDay();
  // retroceder al lunes
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));

  return Array.from({ length: 6 }, (_, i) => {
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + i);
    return dia;
  });
}

export function formatFechaISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function hoyISO(): string {
  return formatFechaISO(new Date());
}

/** "lun", "mar", etc. */
export const NOMBRES_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const NOMBRES_DIA_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const NOMBRES_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

/** Posición top en px para un evento que empieza en hora HH:MM */
export function topParaHora(horaMin: string): number {
  const [h, m] = horaMin.split(':').map(Number);
  return ((h - HORA_INICIO) + m / 60) * SLOT_H;
}

/** Altura en px para una duración en minutos */
export function alturaParaDuracion(duracionMin: number): number {
  return (duracionMin / 60) * SLOT_H - 4; // 4px de margen
}

/** Columnas de horas del lado izquierdo */
export function horasDelDia(): string[] {
  return Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => {
    const h = HORA_INICIO + i;
    return `${h}:00`;
  });
}

/** "9:00 – 10:00" */
export function rangoHora(inicio: string, durMin: number): string {
  const [h, m] = inicio.split(':').map(Number);
  const totalMin = h * 60 + m + durMin;
  const hf = Math.floor(totalMin / 60);
  const mf = totalMin % 60;
  return `${inicio} – ${hf}:${mf.toString().padStart(2, '0')}`;
}

export function esHoy(d: Date): boolean {
  const hoy = new Date();
  return (
    d.getDate() === hoy.getDate() &&
    d.getMonth() === hoy.getMonth() &&
    d.getFullYear() === hoy.getFullYear()
  );
}

export function inicialNombre(nombre: string, apellido: string): string {
  return `${nombre[0]}${apellido[0]}`.toUpperCase();
}

/** Estado → clase CSS */
export const ESTADO_CLASS: Record<string, string> = {
  PENDIENTE:           'pendiente',
  CONFIRMADO:          'confirmado',
  EN_CURSO:            'en_curso',
  PENDIENTE_FACTURAR:  'pendiente_facturar',
  COMPLETADO:          'completado',
  CANCELADO:           'cancelado',
};

export const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE:           'Pendiente',
  CONFIRMADO:          'Confirmado',
  EN_CURSO:            'En curso',
  PENDIENTE_FACTURAR:  'Pend. facturar',
  COMPLETADO:          'Completado',
  CANCELADO:           'Cancelado',
};

/** Color de evento según profesional (fallback por nombre) */
const COLORES_PRO = ['blush', 'sage', 'rose', 'gold'];
export function colorProfesional(id: string): string {
  // hash simple del id para color consistente
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLORES_PRO[n % COLORES_PRO.length];
}

/** Formatear precio ARS */
export function formatPrecio(n: number): string {
  return `$${n.toLocaleString('es-AR')}`;
}
