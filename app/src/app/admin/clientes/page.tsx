'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import NuevoClienteModal from '@/components/admin/clientes/NuevoClienteModal';
import styles from './clientes.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com';

interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  email: string | null;
  segmento: 'FINAL' | 'MAYORISTA' | 'VIP';
  origen: string;
  activo: boolean;
  cant_turnos?: number;
  ultimo_turno?: string | null;
  total_compras?: string;
  notas?: string | null;
  createdAt: string;
}

interface TurnoCliente {
  id: string;
  fecha: string;
  hora_inicio: string;
  estado: string;
  servicio: { nombre: string };
  profesional: { nombre: string };
  precio: number;
}

const SEG_LABEL: Record<string, string> = { FINAL: 'Final', MAYORISTA: 'Mayorista', VIP: 'VIP' };
const SEG_CLASS: Record<string, string> = { FINAL: 'segFinal', MAYORISTA: 'segMayor', VIP: 'segVip' };
const ORIGEN_LABEL: Record<string, string> = {
  MANUAL: 'Manual', WHATSAPP: 'WhatsApp', INSTAGRAM_DM: 'Instagram',
  TIENDANUBE: 'Tienda Nube', BOCA_A_BOCA: 'Boca a boca',
};
const ESTADO_CLASS: Record<string, string> = {
  PENDIENTE: 'sPendiente', CONFIRMADO: 'sConfirmado',
  EN_CURSO: 'sEnCurso', COMPLETADO: 'sCompletado', CANCELADO: 'sCancelado',
};

export default function ClientesPage() {
  const [clientes, setClientes]       = useState<Cliente[]>([]);
  const [total, setTotal]             = useState(0);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState('');
  const [q, setQ]                     = useState('');
  const [segmento, setSegmento]       = useState('');
  const [origen, setOrigen]           = useState('');
  const [activo, setActivo]           = useState('true');
  const [modalAbierto, setModalAbierto]   = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clientePanel, setClientePanel]   = useState<Cliente | null>(null);
  const [turnosPanel, setTurnosPanel]     = useState<TurnoCliente[]>([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);
  const [toast, setToast]             = useState('');
  const [confirm, setConfirm]         = useState<{ cliente: Cliente } | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (segmento) params.set('segmento', segmento);
      if (origen) params.set('origen', origen);
      if (activo) params.set('activo', activo);
      params.set('limit', '50');
      const res = await apiClient<{ data: Cliente[]; total: number }>(`/clientes?${params.toString()}`);
      setClientes(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch { setError('No se pudieron cargar los clientes.'); }
    finally { setCargando(false); }
  }, [q, segmento, origen, activo]);

  useEffect(() => {
    const t = setTimeout(cargar, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [cargar, q]);

  async function abrirPanel(c: Cliente) {
    setClientePanel(c);
    setCargandoTurnos(true);
    setTurnosPanel([]);
    try {
      const res = await fetch(`${API_BASE}/turnos?cliente_id=${c.id}&limit=20`);
      const data = await res.json();
      setTurnosPanel(Array.isArray(data) ? data : data.data ?? []);
    } catch { setTurnosPanel([]); }
    finally { setCargandoTurnos(false); }
  }

  function abrirEditar(c: Cliente) {
    setClienteEditando(c);
    setModalAbierto(true);
  }

  function handleClienteGuardado(c: Cliente) {
    setClientes(prev => {
      const existe = prev.find(x => x.id === c.id);
      if (existe) return prev.map(x => x.id === c.id ? c : x);
      return [c, ...prev];
    });
    if (!clienteEditando) setTotal(t => t + 1);
    setModalAbierto(false);
    setClienteEditando(null);
    showToast(clienteEditando ? 'Cliente actualizada' : 'Cliente creada');
    if (clientePanel?.id === c.id) setClientePanel(c);
  }

  async function handleEliminar(c: Cliente) {
    setConfirm(null);
    try {
      const res = await fetch(`${API_BASE}/clientes/${c.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || 'Error al eliminar');
        return;
      }
      setClientes(prev => prev.filter(x => x.id !== c.id));
      setTotal(t => t - 1);
      if (clientePanel?.id === c.id) setClientePanel(null);
      showToast('Cliente eliminada');
    } catch { showToast('Error al eliminar'); }
  }

  function iniciales(nombre: string, apellido: string) {
    return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase();
  }

  function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Confirm eliminar */}
      {confirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmTitle}>Eliminar cliente</div>
            <div className={styles.confirmMsg}>
              ¿Eliminar a <strong>{confirm.cliente.nombre} {confirm.cliente.apellido}</strong>?
              {(confirm.cliente.cant_turnos ?? 0) > 0 && (
                <span style={{ color: '#C45C5C', display: 'block', marginTop: 6 }}>
                  ⚠ Tiene {confirm.cliente.cant_turnos} turno(s) registrado(s).
                </span>
              )}
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost} onClick={() => setConfirm(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={() => handleEliminar(confirm.cliente)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.layout}>
        {/* Columna principal */}
        <div className={styles.main}>
          {/* Header */}
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Clientes</h1>
              <p className={styles.pageSub}>CRM · {total} clientes registradas</p>
            </div>
            <button className={styles.btnPrimary} onClick={() => { setClienteEditando(null); setModalAbierto(true); }}>
              + Nueva cliente
            </button>
          </div>

          {/* Filtros */}
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input className={styles.searchInp} placeholder="Buscar por nombre o teléfono…" value={q} onChange={e => setQ(e.target.value)} />
              {q && <button className={styles.clearBtn} onClick={() => setQ('')}>×</button>}
            </div>
            <select className={styles.filterSel} value={segmento} onChange={e => setSegmento(e.target.value)}>
              <option value="">Todos los segmentos</option>
              <option value="FINAL">Consumidor final</option>
              <option value="MAYORISTA">Mayorista</option>
              <option value="VIP">VIP</option>
            </select>
            <select className={styles.filterSel} value={origen} onChange={e => setOrigen(e.target.value)}>
              <option value="">Todos los orígenes</option>
              <option value="INSTAGRAM_DM">Instagram</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="TIENDANUBE">Tienda Nube</option>
              <option value="BOCA_A_BOCA">Boca a boca</option>
              <option value="MANUAL">Manual</option>
            </select>
            <select className={styles.filterSel} value={activo} onChange={e => setActivo(e.target.value)}>
              <option value="">Todas</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>
          </div>

          {cargando && <div className={styles.loadingBar}><div className={styles.loadingInner} /></div>}
          {error && <div className={styles.errorBanner}>{error}<button className={styles.retryBtn} onClick={cargar}>Reintentar</button></div>}

          {!error && (
            <div className={styles.card}>
              {clientes.length === 0 && !cargando ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>👤</div>
                  <div className={styles.emptyTitle}>No hay clientes</div>
                  <div className={styles.emptySub}>{q || segmento || origen ? 'Probá con otros filtros' : 'Creá la primera cliente'}</div>
                </div>
              ) : (
                <div className={styles.tblWrap}>
                  <table className={styles.tbl}>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Segmento</th>
                        <th>Teléfono</th>
                        <th>Origen</th>
                        <th>Turnos</th>
                        <th>Compras</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map(c => (
                        <tr
                          key={c.id}
                          className={`${clientePanel?.id === c.id ? styles.rowSelected : ''} ${!c.activo ? styles.rowInactivo : ''}`}
                          onClick={() => abrirPanel(c)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div className={styles.tblName}>
                              <div className={styles.tblAv}>{iniciales(c.nombre, c.apellido)}</div>
                              <div>
                                <div className={styles.tblFullname}>{c.nombre} {c.apellido}</div>
                                {c.email && <div className={styles.tblSub}>{c.email}</div>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.segChip} ${styles[SEG_CLASS[c.segmento] ?? 'segFinal']}`}>
                              {SEG_LABEL[c.segmento] ?? c.segmento}
                            </span>
                          </td>
                          <td className={styles.tblMuted}>{c.telefono ?? '—'}</td>
                          <td className={styles.tblMuted}>{ORIGEN_LABEL[c.origen] ?? c.origen}</td>
                          <td className={styles.tblMuted}>{c.cant_turnos ?? 0}</td>
                          <td className={styles.tblMuted}>
                            {c.total_compras ? `$${Number(c.total_compras).toLocaleString('es-AR')}` : '—'}
                          </td>
                          <td>
                            <span className={`${styles.badge} ${c.activo ? styles.badgeOk : styles.badgeOff}`}>
                              {c.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div className={styles.tblActions}>
                              <button className={styles.actBtn} title="Editar" onClick={() => abrirEditar(c)}>✏️</button>
                              <button className={styles.actBtn} title="Eliminar" onClick={() => setConfirm({ cliente: c })}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel lateral */}
        {clientePanel && (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div className={styles.panelAv}>{iniciales(clientePanel.nombre, clientePanel.apellido)}</div>
              <div className={styles.panelInfo}>
                <div className={styles.panelNombre}>{clientePanel.nombre} {clientePanel.apellido}</div>
                <span className={`${styles.segChip} ${styles[SEG_CLASS[clientePanel.segmento]]}`}>
                  {SEG_LABEL[clientePanel.segmento]}
                </span>
              </div>
              <button className={styles.panelClose} onClick={() => setClientePanel(null)}>✕</button>
            </div>

            <div className={styles.panelBody}>
              {/* Datos */}
              <div className={styles.panelSection}>
                <div className={styles.panelSectionLabel}>Contacto</div>
                <div className={styles.panelRow}>
                  <span className={styles.panelKey}>Teléfono</span>
                  <span className={styles.panelVal}>{clientePanel.telefono || '—'}</span>
                </div>
                <div className={styles.panelRow}>
                  <span className={styles.panelKey}>Email</span>
                  <span className={styles.panelVal}>{clientePanel.email || '—'}</span>
                </div>
                <div className={styles.panelRow}>
                  <span className={styles.panelKey}>Origen</span>
                  <span className={styles.panelVal}>{ORIGEN_LABEL[clientePanel.origen] ?? clientePanel.origen}</span>
                </div>
                <div className={styles.panelRow}>
                  <span className={styles.panelKey}>Desde</span>
                  <span className={styles.panelVal}>{formatFecha(clientePanel.createdAt)}</span>
                </div>
              </div>

              {/* Stats */}
              <div className={styles.panelStats}>
                <div className={styles.panelStat}>
                  <div className={styles.panelStatVal}>{clientePanel.cant_turnos ?? 0}</div>
                  <div className={styles.panelStatLabel}>Turnos</div>
                </div>
                <div className={styles.panelStat}>
                  <div className={styles.panelStatVal}>
                    ${clientePanel.total_compras ? Number(clientePanel.total_compras).toLocaleString('es-AR') : '0'}
                  </div>
                  <div className={styles.panelStatLabel}>Total compras</div>
                </div>
              </div>

              {/* Notas */}
              {clientePanel.notas && (
                <div className={styles.panelSection}>
                  <div className={styles.panelSectionLabel}>Notas</div>
                  <div className={styles.panelNotas}>{clientePanel.notas}</div>
                </div>
              )}

              {/* Historial turnos */}
              <div className={styles.panelSection}>
                <div className={styles.panelSectionLabel}>Historial de turnos</div>
                {cargandoTurnos ? (
                  <div className={styles.panelLoading}>Cargando…</div>
                ) : turnosPanel.length === 0 ? (
                  <div className={styles.panelEmpty}>Sin turnos registrados</div>
                ) : (
                  <div className={styles.turnosList}>
                    {turnosPanel.map(t => (
                      <div key={t.id} className={styles.turnoItem}>
                        <div className={styles.turnoItemHead}>
                          <span className={styles.turnoFecha}>
                            {formatFecha(t.fecha)} · {t.hora_inicio}
                          </span>
                          <span className={`${styles.badge} ${styles[ESTADO_CLASS[t.estado] ?? 'sCompletado']}`}>
                            {t.estado}
                          </span>
                        </div>
                        <div className={styles.turnoServicio}>{t.servicio?.nombre} · {t.profesional?.nombre}</div>
                        <div className={styles.turnoPrecio}>${Number(t.precio).toLocaleString('es-AR')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.panelFooter}>
              <button className={styles.btnGhost} onClick={() => abrirEditar(clientePanel)} style={{ flex: 1, justifyContent: 'center' }}>
                ✏️ Editar
              </button>
              <button className={styles.btnDanger} onClick={() => setConfirm({ cliente: clientePanel })} style={{ flex: 1, justifyContent: 'center' }}>
                🗑 Eliminar
              </button>
            </div>
          </div>
        )}
      </div>

      <NuevoClienteModal
        open={modalAbierto}
        clienteEditar={clienteEditando}
        onClose={() => { setModalAbierto(false); setClienteEditando(null); }}
        onClienteCreado={handleClienteGuardado}
      />
    </div>
  );
}
