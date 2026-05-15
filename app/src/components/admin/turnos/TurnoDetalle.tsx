'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Turno, EstadoTurno } from '@/types/turnos';
import {
  ESTADO_LABEL,
  ESTADO_CLASS,
  formatPrecio,
  rangoHora,
  inicialNombre,
  NOMBRES_MES,
} from '@/lib/calendario';
import { apiClient } from '@/lib/api';
import styles from './TurnoDetalle.module.css';

interface Props {
  turno: Turno | null;
  onClose: () => void;
  onTurnoActualizado: (t: Turno) => void;
}

const HORAS = Array.from({ length: 49 }, (_, i) => {
  const totalMin = 8 * 60 + i * 15;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
});

const ESTADOS_DISPONIBLES: EstadoTurno[] = ['PENDIENTE', 'CONFIRMADO', 'EN_CURSO', 'PENDIENTE_FACTURAR', 'COMPLETADO'];

export default function TurnoDetalle({ turno, onClose, onTurnoActualizado }: Props) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [notas, setNotas] = useState(turno?.notas ?? '');
  const [error, setError] = useState('');
  const [reagendando, setReagendando] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState(turno?.fecha ?? '');
  const [nuevaHora, setNuevaHora] = useState(turno?.hora_inicio ?? '');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toast, setToast] = useState('');

  if (!turno) return null;

  const fecha = new Date(turno.fecha + 'T00:00:00');
  const fechaStr = `${NOMBRES_MES[fecha.getMonth()].slice(0, 3)} ${fecha.getDate()}, ${fecha.getFullYear()}`;
  const estadoActual = turno.estado;
  const turnoFinalizado = estadoActual === 'CANCELADO' || estadoActual === 'COMPLETADO';

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function cambiarEstado(nuevoEstado: EstadoTurno) {
    if (!turno) return;
    setGuardando(true); setError('');
    try {
      const res = await apiClient<{ data: Turno } | Turno>(`/turnos/${turno.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const actualizado = (res as any).data ?? res;
      onTurnoActualizado(actualizado);
      showToast(`Marcado como ${ESTADO_LABEL[nuevoEstado]}`);
    } catch {
      setError('Error al actualizar estado');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarNotas() {
    if (!turno) return;
    setGuardando(true); setError('');
    try {
      const res = await apiClient<{ data: Turno } | Turno>(`/turnos/${turno.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notas }),
      });
      const actualizado = (res as any).data ?? res;
      onTurnoActualizado(actualizado);
      showToast('Notas guardadas');
    } catch {
      setError('Error al guardar notas');
    } finally {
      setGuardando(false);
    }
  }

  async function reagendar() {
    if (!turno || !nuevaFecha || !nuevaHora) return;
    setGuardando(true); setError('');
    try {
      const res = await apiClient<{ data: Turno } | Turno>(`/turnos/${turno.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fecha: nuevaFecha, hora_inicio: nuevaHora }),
      });
      const actualizado = (res as any).data ?? res;
      onTurnoActualizado(actualizado);
      setReagendando(false);
      showToast(`Reagendado a ${nuevaFecha} ${nuevaHora}`);
    } catch {
      setError('Error al reagendar');
    } finally {
      setGuardando(false);
    }
  }

  async function cancelarTurno() {
    setConfirmCancel(false);
    await cambiarEstado('CANCELADO');
  }

  return (
    <aside className={styles.panel}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Confirm cancelar */}
      {confirmCancel && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmTitle}>Cancelar turno</div>
            <div className={styles.confirmMsg}>
              ¿Cancelar el turno de <strong>{turno.cliente.nombre} {turno.cliente.apellido}</strong>?
              <br />
              <span style={{ fontSize: 11, color: '#8C847A', display: 'block', marginTop: 6 }}>
                Esta acción se puede revertir cambiando el estado.
              </span>
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost} onClick={() => setConfirmCancel(false)} disabled={guardando}>Volver</button>
              <button className={styles.btnDanger} onClick={cancelarTurno} disabled={guardando}>
                Sí, cancelar turno
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.head}>
        <span className={styles.headTitle}>Detalle de turno</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Cliente */}
        <div className={styles.section}>
          <div className={styles.clienteRow}>
            <div className={styles.clienteAv}>{inicialNombre(turno.cliente.nombre, turno.cliente.apellido)}</div>
            <div className={styles.clienteInfo}>
              <div className={styles.clienteNombre}>{turno.cliente.nombre} {turno.cliente.apellido}</div>
              <div className={styles.clienteTel}>{turno.cliente.telefono || 'Sin teléfono'}</div>
            </div>
            <span className={`${styles.estadoBadge} ${styles['s_' + ESTADO_CLASS[estadoActual]]}`}>
              {ESTADO_LABEL[estadoActual]}
            </span>
          </div>
        </div>

        {/* Info turno */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Información del turno</div>
          <div className={styles.row}><span className={styles.key}>Servicio</span><span className={styles.val}>{turno.servicio.nombre}</span></div>
          <div className={styles.row}><span className={styles.key}>Profesional</span><span className={styles.val}>{turno.profesional.nombre} {turno.profesional.apellido}</span></div>
          <div className={styles.row}><span className={styles.key}>Fecha</span><span className={styles.val}>{fechaStr}</span></div>
          <div className={styles.row}><span className={styles.key}>Horario</span><span className={styles.val}>{rangoHora(turno.hora_inicio, turno.duracion_min)}</span></div>
          <div className={styles.row}><span className={styles.key}>Duración</span><span className={styles.val}>{turno.duracion_min} min</span></div>
          <div className={styles.row}><span className={styles.key}>Precio</span><span className={styles.val}>{formatPrecio(turno.precio)}</span></div>
          {turno.senia && (
            <div className={styles.row}><span className={styles.key}>Seña</span><span className={styles.val}>{formatPrecio(turno.senia)}</span></div>
          )}
        </div>

        {/* Reagendar */}
        {!turnoFinalizado && (
          reagendando ? (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Reagendar turno</div>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nueva fecha</label>
                  <input type="date" className={styles.formInp} value={nuevaFecha}
                    onChange={e => setNuevaFecha(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nueva hora</label>
                  <select className={styles.formSel} value={nuevaHora} onChange={e => setNuevaHora(e.target.value)}>
                    {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.reagendarActions}>
                <button className={styles.btnGhost} onClick={() => setReagendando(false)} disabled={guardando}>Cancelar</button>
                <button className={styles.btnPrimary} onClick={reagendar} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Confirmar nuevo horario'}
                </button>
              </div>
            </div>
          ) : (
            <button className={styles.btnSecondary} onClick={() => setReagendando(true)} disabled={guardando}>
              🔄 Reagendar turno
            </button>
          )
        )}

        {/* Cambiar estado */}
        {!turnoFinalizado && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Cambiar estado</div>
            <div className={styles.estadoBtns}>
              {ESTADOS_DISPONIBLES.map(estado => (
                <button
                  key={estado}
                  className={estadoActual === estado ? styles.estadoBtnActive : styles.estadoBtn}
                  onClick={() => cambiarEstado(estado)}
                  disabled={guardando || estadoActual === estado}
                >
                  {ESTADO_LABEL[estado]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Automatizaciones */}
        {turno.automatizaciones && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Automatizaciones</div>
            <div className={styles.row}>
              <span className={styles.key}>Confirmación WA</span>
              <span className={turno.automatizaciones.confirmacion_enviada ? styles.valOk : styles.valPending}>
                {turno.automatizaciones.confirmacion_enviada ? '✓ Enviada' : '⏳ Pendiente'}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.key}>Recordatorio 24hs</span>
              <span className={turno.automatizaciones.recordatorio_enviado ? styles.valOk : styles.valPending}>
                {turno.automatizaciones.recordatorio_enviado ? '✓ Enviado' : '⏳ Pendiente'}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.key}>Seguimiento</span>
              <span className={turno.automatizaciones.seguimiento_enviado ? styles.valOk : styles.valPending}>
                {turno.automatizaciones.seguimiento_enviado ? '✓ Enviado' : '⏳ Pendiente'}
              </span>
            </div>
          </div>
        )}

        {/* Notas */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Notas</div>
          <textarea
            className={styles.notasTxt}
            placeholder="Agregar nota…"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            disabled={guardando}
          />
          {notas !== (turno.notas ?? '') && (
            <button className={styles.btnPrimary} onClick={guardarNotas} disabled={guardando} style={{ marginTop: 8, width: '100%' }}>
              Guardar notas
            </button>
          )}
        </div>
      </div>

      {/* Footer con acción de cancelar */}
      {!turnoFinalizado && (
        <div className={styles.footer}>
          {(estadoActual === 'CONFIRMADO' || estadoActual === 'EN_CURSO' || estadoActual === 'PENDIENTE_FACTURAR') && (
            <button
              className={styles.btnCobrar}
              onClick={() => { onClose(); router.push(`/admin/caja?turnoId=${turno.id}`) }}
              disabled={guardando}
            >
              💰 Cobrar turno
            </button>
          )}
          <button className={styles.btnDangerFull} onClick={() => setConfirmCancel(true)} disabled={guardando}>
            ✕ Cancelar turno
          </button>
        </div>
      )}
    </aside>
  );
}
