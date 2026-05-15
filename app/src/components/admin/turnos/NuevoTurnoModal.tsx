'use client';

import { useState, useEffect } from 'react';
import type { Servicio, Profesional, Cliente, NuevoTurnoPayload, Turno } from '@/types/turnos';
import { formatFechaISO, formatPrecio } from '@/lib/calendario';
import { apiClient } from '@/lib/api';
import NuevoClienteModal from '@/components/admin/clientes/NuevoClienteModal';

import styles from './NuevoTurnoModal.module.css';

interface Props {
  open: boolean;
  fechaInicial?: string;
  horaInicial?: string;
  onClose: () => void;
  onTurnoCreado: (t: Turno) => void;
}

export default function NuevoTurnoModal({ open, fechaInicial, horaInicial, onClose, onTurnoCreado }: Props) {
  const [servicios, setServicios]         = useState<Servicio[]>([]);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);

  const [clientesBusqueda, setClientesBusqueda] = useState<Cliente[]>([]);
  const [busquedaCliente, setBusquedaCliente]   = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [modalClienteAbierto, setModalClienteAbierto] = useState(false);

  const [form, setForm] = useState<Partial<NuevoTurnoPayload>>({
    fecha:       fechaInicial ?? formatFechaISO(new Date()),
    hora_inicio: horaInicial  ?? '09:00',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!open) return;
    setCargandoCatalogo(true);
    Promise.all([
      apiClient<{ data: Servicio[] } | Servicio[]>('/servicios').catch(() => ({ data: [] as Servicio[] })),
      apiClient<{ data: Profesional[] } | Profesional[]>('/profesionales').catch(() => ({ data: [] as Profesional[] })),
    ]).then(([svcRes, proRes]) => {
      // Normalizar — la API puede devolver array directo o { data: [] }
      const svcs = Array.isArray(svcRes) ? svcRes : (svcRes as { data: Servicio[] }).data ?? [];
      const pros = Array.isArray(proRes) ? proRes : (proRes as { data: Profesional[] }).data ?? [];
      setServicios(svcs);
      setProfesionales(pros);
    }).finally(() => setCargandoCatalogo(false));
  }, [open]);

  useEffect(() => {
    if (fechaInicial) setForm(f => ({ ...f, fecha: fechaInicial }));
    if (horaInicial)  setForm(f => ({ ...f, hora_inicio: horaInicial }));
  }, [fechaInicial, horaInicial]);

  useEffect(() => {
    if (busquedaCliente.length < 2) { setClientesBusqueda([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      try {
        const res = await apiClient<{ data: Cliente[] } | Cliente[]>(
          `/clientes?q=${encodeURIComponent(busquedaCliente)}&limit=6`
        );
        const lista = Array.isArray(res) ? res : (res as { data: Cliente[] }).data ?? [];
        setClientesBusqueda(lista);
        setShowDropdown(true);
      } catch { /* */ }
    }, 280);
    return () => clearTimeout(t);
  }, [busquedaCliente]);

  function seleccionarCliente(c: Cliente) {
    setClienteSeleccionado(c);
    setBusquedaCliente('');
    setClientesBusqueda([]);
    setShowDropdown(false);
  }

  function handleClienteCreado(c: { id: string; nombre: string; apellido: string; telefono: string | null; segmento: "FINAL" | "MAYORISTA" | "VIP"; email: string | null; origen: string; activo: boolean; createdAt: string }) {
    seleccionarCliente({ id: c.id, nombre: c.nombre, apellido: c.apellido, telefono: c.telefono ?? '', segmento: c.segmento });
    setModalClienteAbierto(false);
  }

  const HORAS = Array.from({ length: 26 }, (_, i) => {
    const totalMin = 8 * 60 + i * 30;
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  });

  const svcSeleccionado = servicios.find(s => s.id === form.servicio_id);

  async function handleSubmit() {
    setError('');
    if (!clienteSeleccionado) { setError('Seleccioná o creá una cliente'); return; }
    if (!form.servicio_id)    { setError('Seleccioná un servicio'); return; }
    if (!form.profesional_id) { setError('Seleccioná una profesional'); return; }
    if (!form.fecha)          { setError('Ingresá la fecha'); return; }
    if (!form.hora_inicio)    { setError('Ingresá la hora'); return; }

    setGuardando(true);
    try {
      const payload = {
        cliente_id:     clienteSeleccionado.id,
        servicio_id:    form.servicio_id,
        profesional_id: form.profesional_id,
        fecha:          form.fecha,
        hora_inicio:    form.hora_inicio,
        senia:          form.senia,
        notas:          form.notas,
      };
      // La API devuelve { data: Turno }
      const res = await apiClient<{ data: Turno } | Turno>('/turnos', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      // Normalizar respuesta
      const turno = ('data' in (res as object) && !Array.isArray(res))
        ? (res as { data: Turno }).data
        : res as Turno;
      onTurnoCreado(turno);
      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear el turno');
    } finally {
      setGuardando(false);
    }
  }

  function handleClose() {
    setForm({ fecha: formatFechaISO(new Date()), hora_inicio: '09:00' });
    setBusquedaCliente('');
    setClienteSeleccionado(null);
    setClientesBusqueda([]);
    setShowDropdown(false);
    setError('');
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div className={styles.overlay}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.head}>
            <div className={styles.title}>Nuevo turno</div>
            <button className={styles.closeBtn} onClick={handleClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className={styles.body}>
            {/* Cliente */}
            <div className={styles.field}>
              <label className={styles.label}>Cliente *</label>
              {clienteSeleccionado ? (
                <div className={styles.clienteChip}>
                  <div className={styles.chipAv}>{clienteSeleccionado.nombre[0]}{clienteSeleccionado.apellido[0]}</div>
                  <div className={styles.chipInfo}>
                    <strong>{clienteSeleccionado.nombre} {clienteSeleccionado.apellido}</strong>
                    {clienteSeleccionado.telefono && <span>{clienteSeleccionado.telefono}</span>}
                  </div>
                  <button className={styles.chipRemove} onClick={() => setClienteSeleccionado(null)}>×</button>
                </div>
              ) : (
                <div className={styles.clienteWrap}>
                  <div className={styles.searchWrap}>
                    <svg className={styles.searchIcon} width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                      className={styles.input} style={{ paddingLeft: 34 }}
                      placeholder="Buscar por nombre o teléfono…"
                      value={busquedaCliente}
                      onChange={e => setBusquedaCliente(e.target.value)}
                      onFocus={() => clientesBusqueda.length > 0 && setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    />
                    {showDropdown && clientesBusqueda.length > 0 && (
                      <ul className={styles.dropdown}>
                        {clientesBusqueda.map(c => (
                          <li key={c.id} className={styles.dropdownItem} onMouseDown={() => seleccionarCliente(c)}>
                            <strong>{c.nombre} {c.apellido}</strong>
                            <span>{c.telefono}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button className={styles.btnCrearCliente} type="button" onClick={() => setModalClienteAbierto(true)}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Nueva
                  </button>
                </div>
              )}
            </div>

            <div className={styles.grid2}>
              {/* Servicio */}
              <div className={styles.field}>
                <label className={styles.label}>Servicio *</label>
                {cargandoCatalogo ? (
                  <div className={styles.loadingField}>Cargando…</div>
                ) : servicios.length === 0 ? (
                  <div className={styles.warningField}>⚠️ Sin servicios en la BD</div>
                ) : (
                  <>
                    <select className={styles.select} value={form.servicio_id ?? ''}
                      onChange={e => setForm(f => ({ ...f, servicio_id: e.target.value }))}>
                      <option value="">Seleccionar…</option>
                      {servicios.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre} ({s.duracion_min}min)</option>
                      ))}
                    </select>
                    {svcSeleccionado && (
                      <div className={styles.hint}>{svcSeleccionado.duracion_min} min · {formatPrecio(svcSeleccionado.precio)}</div>
                    )}
                  </>
                )}
              </div>

              {/* Profesional */}
              <div className={styles.field}>
                <label className={styles.label}>Profesional *</label>
                {cargandoCatalogo ? (
                  <div className={styles.loadingField}>Cargando…</div>
                ) : (
                  <select className={styles.select} value={form.profesional_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, profesional_id: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {profesionales.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Fecha */}
              <div className={styles.field}>
                <label className={styles.label}>Fecha *</label>
                <input type="date" className={styles.input} value={form.fecha ?? ''}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>

              {/* Hora */}
              <div className={styles.field}>
                <label className={styles.label}>Hora *</label>
                <select className={styles.select} value={form.hora_inicio ?? '09:00'}
                  onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}>
                  {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              {/* Seña */}
              <div className={styles.field}>
                <label className={styles.label}>Seña</label>
                <input type="number" className={styles.input} placeholder="0"
                  value={form.senia ?? ''}
                  onChange={e => setForm(f => ({ ...f, senia: Number(e.target.value) || undefined }))} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Notas</label>
              <textarea className={styles.textarea} placeholder="Observaciones, alergias, preferencias…"
                value={form.notas ?? ''}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            {error && <div className={styles.error}>{error}</div>}
          </div>

          <div className={styles.footer}>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={handleClose}>Cancelar</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit}
              disabled={guardando || cargandoCatalogo || servicios.length === 0}>
              {guardando ? 'Creando…' : 'Crear turno'}
            </button>
          </div>
        </div>
      </div>

      <NuevoClienteModal
        open={modalClienteAbierto}
        onClose={() => setModalClienteAbierto(false)}
        onClienteCreado={handleClienteCreado}
      />
    </>
  );
}
