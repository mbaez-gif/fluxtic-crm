'use client';

import { useMemo } from 'react';
import type { Turno } from '@/types/turnos';
import {
  topParaHora,
  alturaParaDuracion,
  formatFechaISO,
  SLOT_H,
  HORA_INICIO,
  ESTADO_LABEL,
  ESTADO_CLASS,
  rangoHora,
} from '@/lib/calendario';
import styles from './CalendarioDiario.module.css';

interface Props {
  fecha: Date;
  turnos: Turno[];
  filtroProId: string;
  onTurnoClick: (t: Turno) => void;
  onSlotClick: (fecha: string, hora: string) => void;
}

export default function CalendarioDiario({ fecha, turnos, filtroProId, onTurnoClick, onSlotClick }: Props) {
  const iso = formatFechaISO(fecha);

  const horas = useMemo(() => {
    return Array.from({ length: 13 }, (_, i) => {
      const h = HORA_INICIO + i;
      return `${h}:00`;
    });
  }, []);

  const turnosDelDia = useMemo(() => {
    let lista = turnos.filter(t => t.fecha === iso && t.estado !== 'CANCELADO' && t.hora_inicio);
    if (filtroProId) lista = lista.filter(t => t.profesional.id === filtroProId);
    return lista.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }, [turnos, iso, filtroProId]);

  const turnosCancelados = turnos.filter(t => t.fecha === iso && t.estado === 'CANCELADO');

  return (
    <div className={styles.wrap}>
      {/* Lista resumen lateral */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <span className={styles.sidebarTitle}>Turnos del día</span>
          <span className={styles.sidebarCount}>{turnosDelDia.length}</span>
        </div>
        <div className={styles.sidebarList}>
          {turnosDelDia.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📅</div>
              <div className={styles.emptyTitle}>Sin turnos</div>
              <div className={styles.emptySub}>Día libre</div>
            </div>
          ) : (
            turnosDelDia.map(t => (
              <div key={t.id} className={styles.listItem} onClick={() => onTurnoClick(t)}>
                <div className={styles.listTime}>{t.hora_inicio}</div>
                <div
                  className={styles.listAv}
                  style={{ background: t.profesional?.color ? `${t.profesional.color}33` : '#F0E8DC' }}
                >
                  {t.cliente.nombre[0]}
                </div>
                <div className={styles.listInfo}>
                  <div className={styles.listName}>{t.cliente.nombre} {t.cliente.apellido}</div>
                  <div className={styles.listSvc}>{t.servicio.nombre} · {t.profesional.nombre}</div>
                </div>
                <span className={`${styles.estadoBadge} ${styles['s_' + ESTADO_CLASS[t.estado]]}`}>
                  {ESTADO_LABEL[t.estado]}
                </span>
              </div>
            ))
          )}

          {turnosCancelados.length > 0 && (
            <>
              <div className={styles.separator}>Cancelados ({turnosCancelados.length})</div>
              {turnosCancelados.map(t => (
                <div key={t.id} className={`${styles.listItem} ${styles.cancelado}`} onClick={() => onTurnoClick(t)}>
                  <div className={styles.listTime}>{t.hora_inicio}</div>
                  <div className={styles.listInfo}>
                    <div className={styles.listName}>{t.cliente.nombre} {t.cliente.apellido}</div>
                    <div className={styles.listSvc}>{t.servicio.nombre}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Timeline visual */}
      <div className={styles.timeline}>
        <div className={styles.timelineBody}>
          <div className={styles.timeCol}>
            {horas.map(h => (
              <div key={h} className={styles.timeSlot} style={{ height: SLOT_H }}>{h}</div>
            ))}
          </div>
          <div className={styles.dayCol}>
            {horas.map(h => (
              <div
                key={h}
                className={styles.emptySlot}
                style={{ height: SLOT_H }}
                onClick={() => onSlotClick(iso, h)}
              />
            ))}

            {turnosDelDia.map(t => {
              const top = topParaHora(t.hora_inicio);
              const height = Math.max(28, alturaParaDuracion(t.duracion_min));
              const hexColor = t.profesional?.color || '#C8A882';

              return (
                <div
                  key={t.id}
                  className={`${styles.evento} ${styles[`estado_${t.estado.toLowerCase()}`]}`}
                  style={{ top, height, background: hexColor }}
                  onClick={() => onTurnoClick(t)}
                  title={`${t.cliente.nombre} ${t.cliente.apellido} · ${t.servicio.nombre}`}
                >
                  <div className={styles.evContent}>
                    <div className={styles.evHora}>{rangoHora(t.hora_inicio, t.duracion_min)}</div>
                    <div className={styles.evNombre}>
                      {t.cliente.nombre} {t.cliente.apellido}
                    </div>
                    {height > 50 && (
                      <div className={styles.evServicio}>{t.servicio.nombre} · {t.profesional.nombre}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
