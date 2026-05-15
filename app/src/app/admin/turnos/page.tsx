'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Turno, Profesional } from '@/types/turnos';
import {
  semanaDeFeha,
  formatFechaISO,
  NOMBRES_MES,
  NOMBRES_DIA_FULL,
  hoyISO,
} from '@/lib/calendario';
import { apiClient } from '@/lib/api';
import CalendarioSemanal from '@/components/admin/turnos/CalendarioSemanal';
import CalendarioDiario from '@/components/admin/turnos/CalendarioDiario';
import TurnoDetalle from '@/components/admin/turnos/TurnoDetalle';
import NuevoTurnoModal from '@/components/admin/turnos/NuevoTurnoModal';
import styles from './turnos.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com';

type Vista = 'semana' | 'dia';

export default function TurnosPage() {
  const [vista, setVista] = useState<Vista>('semana');
  const [fechaBase, setFechaBase] = useState(new Date());
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtroProId, setFiltroProId] = useState('');
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<Turno | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [slotFecha, setSlotFecha] = useState('');
  const [slotHora, setSlotHora] = useState('');
  const [toast, setToast] = useState('');

  const dias = semanaDeFeha(fechaBase);
  // Para vista semanal: rango de la semana. Para vista diaria: solo el día.
  const fechaInicio = vista === 'semana' ? formatFechaISO(dias[0]) : formatFechaISO(fechaBase);
  const fechaFin = vista === 'semana' ? formatFechaISO(dias[dias.length - 1]) : formatFechaISO(fechaBase);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const cargarTurnos = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const res = await apiClient<{ data: Turno[] } | Turno[]>(
        `/turnos?fecha_desde=${fechaInicio}&fecha_hasta=${fechaFin}`
      );
      const lista = Array.isArray(res) ? res : (res as { data: Turno[] }).data ?? [];
      setTurnos(lista);
    } catch {
      setError('No se pudieron cargar los turnos.');
    } finally {
      setCargando(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { cargarTurnos(); }, [cargarTurnos]);

  useEffect(() => {
    apiClient<{ data: Profesional[] } | Profesional[]>('/profesionales').then(res => {
      const lista = Array.isArray(res) ? res : (res as any).data ?? [];
      setProfesionales(lista);
    }).catch(() => {});
  }, []);

  function irHoy() { setFechaBase(new Date()); }
  function anterior() {
    const d = new Date(fechaBase);
    d.setDate(d.getDate() - (vista === 'semana' ? 7 : 1));
    setFechaBase(d);
  }
  function siguiente() {
    const d = new Date(fechaBase);
    d.setDate(d.getDate() + (vista === 'semana' ? 7 : 1));
    setFechaBase(d);
  }

  function handleSlotClick(fecha: string, hora: string) {
    setSlotFecha(fecha);
    setSlotHora(hora);
    setModalAbierto(true);
  }

  function handleTurnoCreado() {
    setModalAbierto(false);
    cargarTurnos();
  }

  function handleTurnoActualizado(actualizado: Turno) {
    setTurnoSeleccionado(actualizado);
    cargarTurnos();
  }

  async function handleTurnoMoved(turnoId: string, nuevaFecha: string, nuevaHora: string) {
    try {
      await fetch(`${API_BASE}/turnos/${turnoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: nuevaFecha, hora_inicio: nuevaHora }),
      });
      showToast(`Turno movido a ${nuevaFecha} ${nuevaHora}`);
      cargarTurnos();
    } catch {
      showToast('Error al mover el turno');
    }
  }

  const labelSemana = () => {
    const lun = dias[0];
    const sab = dias[dias.length - 1];
    if (lun.getMonth() === sab.getMonth()) {
      return `${lun.getDate()} – ${sab.getDate()} de ${NOMBRES_MES[lun.getMonth()]} ${lun.getFullYear()}`;
    }
    return `${lun.getDate()} ${NOMBRES_MES[lun.getMonth()]} – ${sab.getDate()} ${NOMBRES_MES[sab.getMonth()]}`;
  };

  const labelDia = () => {
    const dow = NOMBRES_DIA_FULL[fechaBase.getDay()];
    return `${dow} ${fechaBase.getDate()} de ${NOMBRES_MES[fechaBase.getMonth()]}`;
  };

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Turnos</h1>
          <p className={styles.pageSub}>Gestión de agenda y reservas</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => { setSlotFecha(hoyISO()); setSlotHora('09:00'); setModalAbierto(true); }}>
          + Nuevo turno
        </button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.navWrap}>
          <button className={styles.navBtn} onClick={anterior}>‹</button>
          <span className={styles.fechaLabel}>{vista === 'semana' ? labelSemana() : labelDia()}</span>
          <button className={styles.navBtn} onClick={siguiente}>›</button>
          <button className={styles.btnGhost} style={{ fontSize: 11 }} onClick={irHoy}>Hoy</button>
        </div>

        {/* Toggle vista */}
        <div className={styles.vistaToggle}>
          <button className={vista === 'dia' ? styles.vistaActive : styles.vistaBtn} onClick={() => setVista('dia')}>Día</button>
          <button className={vista === 'semana' ? styles.vistaActive : styles.vistaBtn} onClick={() => setVista('semana')}>Semana</button>
        </div>

        <div className={styles.filtros}>
          <button
            className={filtroProId === '' ? styles.filtroActive : styles.filtro}
            onClick={() => setFiltroProId('')}
          >
            Todas
          </button>
          {profesionales.map(p => (
            <button
              key={p.id}
              className={filtroProId === p.id ? styles.filtroActive : styles.filtro}
              onClick={() => setFiltroProId(p.id)}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

      {vista === 'semana' && (
        <div className={styles.dragHint}>💡 Arrastrá un turno para cambiar su horario</div>
      )}

      {error && <div className={styles.errorBanner}>{error}</div>}
      {cargando && <div className={styles.loadingBar}><div className={styles.loadingInner} /></div>}

      {/* Calendario */}
      {vista === 'semana' ? (
        <CalendarioSemanal
          semanaBase={fechaBase}
          turnos={turnos}
          filtroProId={filtroProId}
          onTurnoClick={setTurnoSeleccionado}
          onSlotClick={handleSlotClick}
          onTurnoMoved={handleTurnoMoved}
        />
      ) : (
        <CalendarioDiario
          fecha={fechaBase}
          turnos={turnos}
          filtroProId={filtroProId}
          onTurnoClick={setTurnoSeleccionado}
          onSlotClick={handleSlotClick}
        />
      )}

      {/* Panel detalle */}
      {turnoSeleccionado && (
        <TurnoDetalle
          turno={turnoSeleccionado}
          onClose={() => setTurnoSeleccionado(null)}
          onTurnoActualizado={handleTurnoActualizado}
        />
      )}

      {/* Modal nuevo turno */}
      <NuevoTurnoModal
        open={modalAbierto}
        fechaInicial={slotFecha}
        horaInicial={slotHora}
        onClose={() => setModalAbierto(false)}
        onTurnoCreado={handleTurnoCreado}
      />
    </div>
  );
}
