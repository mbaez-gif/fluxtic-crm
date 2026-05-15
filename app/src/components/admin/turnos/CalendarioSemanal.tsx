'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import type { Turno } from '@/types/turnos';
import {
  semanaDeFeha,
  horasDelDia,
  topParaHora,
  alturaParaDuracion,
  esHoy,
  formatFechaISO,
  NOMBRES_DIA,
  SLOT_H,
  HORA_INICIO,
} from '@/lib/calendario';
import styles from './CalendarioSemanal.module.css';

interface Props {
  semanaBase: Date;
  turnos: Turno[];
  filtroProId: string;
  onTurnoClick: (t: Turno) => void;
  onSlotClick: (fecha: string, hora: string) => void;
  onTurnoMoved?: (turnoId: string, nuevaFecha: string, nuevaHora: string) => void;
}

interface DragState {
  turnoId: string;
  offsetY: number; // px desde el top del evento donde se agarró
}

export default function CalendarioSemanal({
  semanaBase,
  turnos,
  filtroProId,
  onTurnoClick,
  onSlotClick,
  onTurnoMoved,
}: Props) {
  const dias = useMemo(() => semanaDeFeha(semanaBase), [semanaBase]);
  const horas = useMemo(() => horasDelDia(), []);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragOver, setDragOver] = useState<{ fecha: string; hora: string } | null>(null);
  const [movedTurnos, setMovedTurnos] = useState<Record<string, { fecha: string; hora_inicio: string }>>({});

  const turnosFiltrados = filtroProId
    ? turnos.filter((t) => t.profesional.id === filtroProId)
    : turnos;

  const turnosPorFecha = useMemo(() => {
    const mapa: Record<string, Turno[]> = {};
    turnosFiltrados.forEach((t) => {
      // Usar posición movida si existe
      const pos = movedTurnos[t.id];
      const fecha = pos ? pos.fecha : t.fecha;
      if (!mapa[fecha]) mapa[fecha] = [];
      mapa[fecha].push(t);
    });
    return mapa;
  }, [turnosFiltrados, movedTurnos]);

  // Calcular hora desde posición Y dentro de la columna
  function yToHora(y: number): string {
    const totalMin = Math.max(0, Math.round((y / SLOT_H) * 60));
    const horaBase = HORA_INICIO * 60 + totalMin;
    // Snap a 15 minutos
    const snapped = Math.round(horaBase / 15) * 15;
    const h = Math.floor(snapped / 60);
    const m = snapped % 60;
    const hClamped = Math.max(HORA_INICIO, Math.min(20, h));
    return `${hClamped}:${m.toString().padStart(2, '0')}`;
  }

  function handleDragStart(e: React.DragEvent, t: Turno) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    setDragging({ turnoId: t.id, offsetY });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('turnoId', t.id);
    // Ghost image transparente
    const ghost = document.createElement('div');
    ghost.style.cssText = 'width:1px;height:1px;opacity:0;position:fixed;top:-100px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  function handleDragOver(e: React.DragEvent, fecha: string, colRef: HTMLDivElement | null) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!colRef || !dragging) return;
    const rect = colRef.getBoundingClientRect();
    const y = e.clientY - rect.top + (colRef.closest('.'+styles.body) as HTMLElement)?.scrollTop - dragging.offsetY;
    const hora = yToHora(Math.max(0, y));
    setDragOver({ fecha, hora });
  }

  function handleDrop(e: React.DragEvent, fecha: string, colRef: HTMLDivElement | null) {
    e.preventDefault();
    const turnoId = e.dataTransfer.getData('turnoId');
    if (!turnoId || !colRef || !dragging) return;
    const rect = colRef.getBoundingClientRect();
    const scrollTop = (colRef.closest('[class*="body"]') as HTMLElement)?.scrollTop ?? 0;
    const y = e.clientY - rect.top + scrollTop - dragging.offsetY;
    const hora = yToHora(Math.max(0, y));
    
    setMovedTurnos(prev => ({ ...prev, [turnoId]: { fecha, hora_inicio: hora } }));
    setDragging(null);
    setDragOver(null);
    onTurnoMoved?.(turnoId, fecha, hora);
  }

  function handleDragEnd() {
    setDragging(null);
    setDragOver(null);
  }

  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});

  return (
    <div className={styles.wrap}>
      {/* Header días */}
      <div className={styles.header}>
        <div className={styles.timeLabel} />
        {dias.map((dia) => {
          const hoy = esHoy(dia);
          return (
            <div key={dia.toISOString()} className={`${styles.dayHeader} ${hoy ? styles.today : ''}`}>
              <div className={styles.dayName}>{NOMBRES_DIA[dia.getDay()]}</div>
              <div className={`${styles.dayNum} ${hoy ? styles.todayNum : ''}`}>{dia.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className={styles.body} ref={bodyRef}>
        {/* Columna horas */}
        <div className={styles.timeCol}>
          {horas.map((h) => (
            <div key={h} className={styles.timeSlot} style={{ height: SLOT_H }}>{h}</div>
          ))}
        </div>

        {/* Columnas días */}
        {dias.map((dia) => {
          const iso = formatFechaISO(dia);
          const turnosDelDia = turnosPorFecha[iso] ?? [];
          const hoy = esHoy(dia);
          const isDragTarget = dragOver?.fecha === iso;

          return (
            <div
              key={iso}
              className={`${styles.dayCol} ${hoy ? styles.todayCol : ''} ${isDragTarget ? styles.dragTarget : ''}`}
              ref={el => { colRefs.current[iso] = el; }}
              onDragOver={e => handleDragOver(e, iso, colRefs.current[iso])}
              onDrop={e => handleDrop(e, iso, colRefs.current[iso])}
            >
              {/* Slots vacíos */}
              {horas.map((h) => (
                <div
                  key={h}
                  className={styles.emptySlot}
                  style={{ height: SLOT_H }}
                  onClick={() => onSlotClick(iso, h)}
                />
              ))}

              {/* Preview drag */}
              {isDragTarget && dragOver && dragging && (() => {
                const turno = turnos.find(t => t.id === dragging.turnoId);
                if (!turno) return null;
                const top = topParaHora(dragOver.hora);
                const height = Math.max(28, alturaParaDuracion(turno.duracion_min));
                return (
                  <div
                    className={styles.dragPreview}
                    style={{ top, height }}
                  >
                    <div className={styles.evNombre}>{turno.cliente.nombre}</div>
                    <div className={styles.evServicio}>{dragOver.hora}</div>
                  </div>
                );
              })()}

              {/* Eventos */}
              {turnosDelDia
                .filter(t => t.estado !== 'CANCELADO' && t.hora_inicio)
                .map(t => {
                  const pos = movedTurnos[t.id];
                  const horaInicio = pos ? pos.hora_inicio : t.hora_inicio;
                  const top = topParaHora(horaInicio);
                  const height = Math.max(28, alturaParaDuracion(t.duracion_min));
                  const hexColor = t.profesional?.color || '#C8A882';
                  const isDraggingThis = dragging?.turnoId === t.id;
                  const isMoved = !!pos;

                  return (
                    <div
                      key={t.id}
                      className={`
                        ${styles.evento}
                        ${styles[`estado_${t.estado.toLowerCase()}`]}
                        ${isDraggingThis ? styles.dragging : ''}
                        ${isMoved ? styles.moved : ''}
                      `}
                      style={{ top, height, background: hexColor }}
                      draggable
                      onDragStart={e => handleDragStart(e, t)}
                      onDragEnd={handleDragEnd}
                      onClick={e => {
                        if (!isDraggingThis) onTurnoClick(t);
                      }}
                      title={`${t.cliente.nombre} ${t.cliente.apellido} · ${t.servicio.nombre} · ${horaInicio}`}
                    >
                      <div className={styles.dragHandle}>⠿</div>
                      <div className={styles.evContent}>
                        <div className={styles.evNombre}>
                          {t.cliente.nombre} {t.cliente.apellido[0]}.
                        </div>
                        {height > 32 && (
                          <div className={styles.evServicio}>{t.servicio.nombre}</div>
                        )}
                        {height > 52 && (
                          <div className={styles.evPro}>{t.profesional.nombre}</div>
                        )}
                        {isMoved && (
                          <div className={styles.evMovido}>⚠ Sin guardar</div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
