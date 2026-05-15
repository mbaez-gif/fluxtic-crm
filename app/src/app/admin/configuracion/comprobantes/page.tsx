
'use client';

import { Suspense } from 'react'
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './comprobantes.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com';

interface Comprobante {
  id: string;
  turno_id: string;
  cliente_nombre: string;
  telefono: string | null;
  servicio: string | null;
  profesional: string | null;
  turno_fecha: string | null;
  hora_inicio: string | null;
  monto: number;
  fecha_subida: string;
  archivo_url: string;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  notas_admin: string | null;
  origen: string;
  validado_at?: string | null;
}

interface TurnoBusqueda {
  id: string;
  fecha: string;
  hora_inicio: string;
  cliente: { nombre: string; apellido: string };
  servicio: { nombre: string };
}

type FiltroEstado = 'todos' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

function ComprobantesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idDestacado = searchParams.get('id');
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('PENDIENTE');
  const [seleccionado, setSeleccionado] = useState<Comprobante | null>(null);
  const [modalRechazo, setModalRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Modal carga manual
  const [modalCarga, setModalCarga] = useState(false);
  const [turnoQuery, setTurnoQuery] = useState('');
  const [turnosResultados, setTurnosResultados] = useState<TurnoBusqueda[]>([]);
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<TurnoBusqueda | null>(null);
  const [montoManual, setMontoManual] = useState('');
  const [archivoBase64, setArchivoBase64] = useState('');
  const [archivoNombre, setArchivoNombre] = useState('');
  const [urlManual, setUrlManual] = useState('');
  const [cargandoManual, setCargandoManual] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/configuracion/comprobantes-pendientes`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Error al cargar');
      const data = await res.json();
      setComprobantes(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setError('No se pudieron cargar los comprobantes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Cuando hay ?id=COMP_ID (desde una notificación), buscarlo en la lista,
  // cambiar el filtro si está en otro estado, abrir el detalle y hacer scroll.
  useEffect(() => {
    if (!idDestacado || cargando) return;
    const comp = comprobantes.find(c => c.id === idDestacado);
    if (!comp) {
      // Si no está en la lista actual, probablemente el filtro lo oculta.
      // Cambio a "todos" implícitamente buscando primero por estado del comp.
      // Como no sabemos su estado, lo pedimos a un GET puntual seria ideal —
      // por ahora cambiamos a APROBADO/RECHAZADO si no aparece en el filtro
      // PENDIENTE.
      if (filtro !== 'PENDIENTE') return;
      setFiltro('APROBADO');
      return;
    }
    setSeleccionado(comp);
    requestAnimationFrame(() => {
      const el = document.getElementById(`comp-${idDestacado}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    // Limpiar query param para que no vuelva a destacar al volver de otra pantalla
    const t = setTimeout(() => {
      router.replace('/admin/configuracion/comprobantes', { scroll: false });
    }, 2500);
    return () => clearTimeout(t);
  }, [idDestacado, cargando, comprobantes, filtro, router]);

  // Búsqueda de turnos para carga manual
  useEffect(() => {
    if (turnoQuery.length < 3) { setTurnosResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/turnos?q=${encodeURIComponent(turnoQuery)}&limit=10`);
        const d = await res.json();
        setTurnosResultados((d.data ?? d ?? []).slice(0, 8));
      } catch { setTurnosResultados([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [turnoQuery]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoNombre(file.name);
    const reader = new FileReader();
    reader.onload = ev => setArchivoBase64(ev.target?.result as string ?? '');
    reader.readAsDataURL(file);
  }

  async function cargarManual() {
    if (!turnoSeleccionado) { showToast('Seleccioná un turno', false); return; }
    setCargandoManual(true);
    try {
      const body: any = {
        turno_id: turnoSeleccionado.id,
        monto: montoManual ? Number(montoManual) : undefined,
        origen: 'ADMIN',
      };
      if (archivoBase64 && archivoNombre) {
        body.archivo_base64 = archivoBase64;
        body.archivo_nombre = archivoNombre;
      } else if (urlManual.trim()) {
        body.archivo_url = urlManual.trim();
      } else {
        body.archivo_url = '';
      }
      const res = await fetch(`${API_BASE}/configuracion/comprobantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error al cargar');
      }
      const nuevo: Comprobante = await res.json();
      setComprobantes(prev => [nuevo, ...prev]);
      setModalCarga(false);
      resetModalCarga();
      showToast('Comprobante cargado correctamente');
      setFiltro('PENDIENTE');
    } catch (e: any) {
      showToast(e.message || 'Error al cargar', false);
    } finally {
      setCargandoManual(false);
    }
  }

  function resetModalCarga() {
    setTurnoQuery(''); setTurnosResultados([]); setTurnoSeleccionado(null);
    setMontoManual(''); setArchivoBase64(''); setArchivoNombre(''); setUrlManual('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function aprobar(id: string) {
    setProcesando(true);
    try {
      const res = await fetch(`${API_BASE}/configuracion/comprobantes-pendientes/${id}/aprobar`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al aprobar'); }
      const actualizado: Comprobante = await res.json();
      setComprobantes(prev => prev.map(c => c.id === id ? actualizado : c));
      setSeleccionado(actualizado);
      showToast('Comprobante aprobado y turno confirmado');
    } catch (e: any) {
      showToast(e.message || 'Error al aprobar', false);
    } finally { setProcesando(false); }
  }

  async function rechazar(id: string) {
    setProcesando(true);
    try {
      const res = await fetch(`${API_BASE}/configuracion/comprobantes-pendientes/${id}/rechazar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoRechazo || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al rechazar'); }
      const actualizado: Comprobante = await res.json();
      setComprobantes(prev => prev.map(c => c.id === id ? actualizado : c));
      setSeleccionado(actualizado);
      setModalRechazo(false); setMotivoRechazo('');
      showToast('Comprobante rechazado');
    } catch (e: any) {
      showToast(e.message || 'Error al rechazar', false);
    } finally { setProcesando(false); }
  }

  function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatFechaSolo(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  }

  const filtrados = comprobantes.filter(c => filtro === 'todos' ? true : c.estado === filtro);
  const countPendientes = comprobantes.filter(c => c.estado === 'PENDIENTE').length;

  return (
    <div className={styles.page}>
      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastError}`}>{toast.msg}</div>
      )}

      {/* Modal rechazo */}
      {modalRechazo && seleccionado && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) { setModalRechazo(false); setMotivoRechazo(''); } }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>Rechazar comprobante</h2>
              <button className={styles.closeBtn} onClick={() => { setModalRechazo(false); setMotivoRechazo(''); }}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>
                Comprobante de <strong>{seleccionado.cliente_nombre}</strong>. Podés indicar el motivo.
              </p>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Motivo (opcional)</label>
                <textarea className={styles.formTxt} rows={3}
                  placeholder="Ej: El comprobante no es legible, monto incorrecto…"
                  value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => { setModalRechazo(false); setMotivoRechazo(''); }} disabled={procesando}>Cancelar</button>
              <button className={styles.btnDanger} onClick={() => rechazar(seleccionado.id)} disabled={procesando}>
                {procesando ? 'Rechazando…' : 'Rechazar comprobante'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal carga manual */}
      {modalCarga && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) { setModalCarga(false); resetModalCarga(); } }}>
          <div className={styles.modal} style={{ maxWidth: 480 }}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>Cargar comprobante manual</h2>
              <button className={styles.closeBtn} onClick={() => { setModalCarga(false); resetModalCarga(); }}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {/* Buscar turno */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Turno *</label>
                {turnoSeleccionado ? (
                  <div className={styles.turnoSelBox}>
                    <span>
                      <strong>{turnoSeleccionado.cliente.nombre} {turnoSeleccionado.cliente.apellido}</strong>
                      {' · '}{turnoSeleccionado.servicio.nombre}
                      {' · '}{formatFechaSolo(turnoSeleccionado.fecha)} {turnoSeleccionado.hora_inicio?.slice(0, 5)}
                    </span>
                    <button type="button" className={styles.btnXs} onClick={() => { setTurnoSeleccionado(null); setTurnoQuery(''); }}>✕</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      className={styles.formInp}
                      placeholder="Buscar por nombre del cliente…"
                      value={turnoQuery}
                      onChange={e => setTurnoQuery(e.target.value)}
                      autoFocus
                    />
                    {turnosResultados.length > 0 && (
                      <div className={styles.dropdown}>
                        {turnosResultados.map((t: TurnoBusqueda) => (
                          <div key={t.id} className={styles.dropdownItem} onClick={() => { setTurnoSeleccionado(t); setTurnoQuery(''); setTurnosResultados([]); }}>
                            <span className={styles.dropdownMain}>{t.cliente.nombre} {t.cliente.apellido}</span>
                            <span className={styles.dropdownSub}>{t.servicio.nombre} · {formatFechaSolo(t.fecha)} {t.hora_inicio?.slice(0, 5)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Monto */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Monto informado</label>
                <input className={styles.formInp} type="number" placeholder="Ej: 5000"
                  value={montoManual} onChange={e => setMontoManual(e.target.value)} min="0" />
              </div>

              {/* Archivo o URL */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Comprobante (imagen o PDF)</label>
                <input ref={fileRef} type="file" accept="image/*,application/pdf"
                  onChange={handleFile} className={styles.formFile} />
                {archivoNombre && <div className={styles.archivoNombreTag}>📎 {archivoNombre}</div>}
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>O pegar URL del comprobante</label>
                <input className={styles.formInp} type="url" placeholder="https://…"
                  value={urlManual} onChange={e => setUrlManual(e.target.value)}
                  disabled={!!archivoBase64} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => { setModalCarga(false); resetModalCarga(); }} disabled={cargandoManual}>Cancelar</button>
              <button className={styles.btnAprobar} onClick={cargarManual} disabled={cargandoManual || !turnoSeleccionado}>
                {cargandoManual ? 'Cargando…' : 'Registrar comprobante'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.layout}>
        {/* Columna principal */}
        <div className={styles.main}>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Señas recibidas</h1>
              <p className={styles.pageSub}>
                Transferencias y señas pendientes de validación
                {countPendientes > 0 && <span className={styles.badge}>{countPendientes} pendientes</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={styles.btnPrimary} onClick={() => setModalCarga(true)}>
                + Cargar manual
              </button>
              <button className={styles.btnGhost} onClick={cargar} style={{ fontSize: 11 }}>↻ Actualizar</button>
            </div>
          </div>

          <div className={styles.toolbar}>
            {(['todos', 'PENDIENTE', 'APROBADO', 'RECHAZADO'] as const).map(f => (
              <button key={f} className={filtro === f ? styles.btnActive : styles.btnFilter} onClick={() => setFiltro(f)}>
                {f === 'todos' ? 'Todos' : f.charAt(0) + f.slice(1).toLowerCase()}
                {f === 'PENDIENTE' && countPendientes > 0 && (
                  <span className={styles.filterBadge}>{countPendientes}</span>
                )}
              </button>
            ))}
            <span className={styles.count}>{filtrados.length} comprobantes</span>
          </div>

          {cargando && <div className={styles.loadingBar}><div className={styles.loadingInner} /></div>}
          {error && (
            <div className={styles.errorBanner}>{error}
              <button className={styles.retryBtn} onClick={cargar}>Reintentar</button>
            </div>
          )}

          {!error && !cargando && (
            <div className={styles.card}>
              {filtrados.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🧾</div>
                  <div className={styles.emptyTitle}>
                    {filtro === 'PENDIENTE' ? 'No hay comprobantes pendientes de validación' : 'Sin comprobantes'}
                  </div>
                  <div className={styles.emptySub}>
                    {filtro === 'PENDIENTE'
                      ? 'Los comprobantes aparecerán acá cuando un cliente envíe una transferencia para reservar un turno.'
                      : 'Probá con otro filtro o cargá uno manualmente.'}
                  </div>
                  {filtro === 'PENDIENTE' && (
                    <button className={styles.btnPrimary} onClick={() => setModalCarga(true)} style={{ marginTop: 14 }}>
                      + Cargar comprobante manual
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.tblWrap}>
                  <table className={styles.tbl}>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Servicio / Turno</th>
                        <th>Monto</th>
                        <th>Recibido</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.map(c => (
                        <tr
                          key={c.id}
                          id={`comp-${c.id}`}
                          className={`${seleccionado?.id === c.id ? styles.rowSelected : ''} ${idDestacado === c.id ? styles.rowHighlight : ''}`}
                          onClick={() => setSeleccionado(c)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div className={styles.tblNombre}>{c.cliente_nombre}</div>
                            {c.telefono && <div className={styles.tblMuted}>{c.telefono}</div>}
                          </td>
                          <td>
                            <div className={styles.tblServicio}>{c.servicio ?? '—'}</div>
                            {c.turno_fecha && (
                              <div className={styles.tblMuted}>
                                {formatFechaSolo(c.turno_fecha)}{c.hora_inicio ? ` ${c.hora_inicio.slice(0,5)}` : ''}
                              </div>
                            )}
                          </td>
                          <td className={styles.tblMonto}>
                            {c.monto > 0 ? `$${Number(c.monto).toLocaleString('es-AR')}` : '—'}
                          </td>
                          <td className={styles.tblMuted}>{formatFecha(c.fecha_subida)}</td>
                          <td>
                            <span className={`${styles.chip} ${styles['chip' + c.estado]}`}>
                              {c.estado === 'PENDIENTE' ? 'Pendiente' : c.estado === 'APROBADO' ? 'Aprobado' : 'Rechazado'}
                            </span>
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

        {/* Panel lateral — comprobante formateado */}
        {seleccionado && (
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div className={styles.panelTitle}>Seña recibida</div>
              <button className={styles.panelClose} onClick={() => setSeleccionado(null)}>✕</button>
            </div>
            <div className={styles.panelBody}>

              {/* Tarjeta tipo comprobante */}
              <div className={styles.receiptCard}>
                <div className={styles.receiptHeader}>
                  <div className={styles.receiptBrand}>Delfina <em>Paz</em></div>
                  <span className={`${styles.chip} ${styles['chip' + seleccionado.estado]}`}>
                    {seleccionado.estado === 'PENDIENTE' ? 'Pendiente' : seleccionado.estado === 'APROBADO' ? 'Aprobado' : 'Rechazado'}
                  </span>
                </div>

                <div className={styles.receiptAmount}>
                  {seleccionado.monto > 0
                    ? `$${Number(seleccionado.monto).toLocaleString('es-AR')}`
                    : <span className={styles.receiptAmountNull}>Monto no informado</span>
                  }
                  <div className={styles.receiptAmountLabel}>Seña recibida</div>
                </div>

                <div className={styles.receiptDivider} />

                <div className={styles.receiptRow}>
                  <span className={styles.receiptKey}>Cliente</span>
                  <span className={styles.receiptVal}>{seleccionado.cliente_nombre}</span>
                </div>
                {seleccionado.telefono && (
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptKey}>Teléfono</span>
                    <span className={styles.receiptVal}>{seleccionado.telefono}</span>
                  </div>
                )}
                {seleccionado.servicio && (
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptKey}>Servicio</span>
                    <span className={styles.receiptVal}>{seleccionado.servicio}</span>
                  </div>
                )}
                {seleccionado.profesional && (
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptKey}>Profesional</span>
                    <span className={styles.receiptVal}>{seleccionado.profesional}</span>
                  </div>
                )}
                {seleccionado.turno_fecha && (
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptKey}>Turno</span>
                    <span className={styles.receiptVal}>
                      {formatFechaSolo(seleccionado.turno_fecha)}
                      {seleccionado.hora_inicio ? ` · ${seleccionado.hora_inicio.slice(0, 5)} hs` : ''}
                    </span>
                  </div>
                )}
                <div className={styles.receiptRow}>
                  <span className={styles.receiptKey}>Recibido</span>
                  <span className={styles.receiptVal}>{formatFecha(seleccionado.fecha_subida)}</span>
                </div>
                {seleccionado.validado_at && (
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptKey}>Validado</span>
                    <span className={styles.receiptVal}>{formatFecha(seleccionado.validado_at as unknown as string)}</span>
                  </div>
                )}

                {seleccionado.notas_admin && (
                  <>
                    <div className={styles.receiptDivider} />
                    <div className={styles.receiptNotas}>{seleccionado.notas_admin}</div>
                  </>
                )}
              </div>

              {/* Archivo adjunto */}
              <div className={styles.panelSection}>
                <div className={styles.panelSectionLabel}>Comprobante adjunto</div>
                {seleccionado.archivo_url && !/^https?:\/\/(www\.)?example\.(com|org|net)/i.test(seleccionado.archivo_url) ? (
                  <a href={seleccionado.archivo_url} target="_blank" rel="noopener noreferrer" className={styles.archivoLink}>
                    <div className={styles.archivoPreview}>
                      {/\.(jpe?g|png|gif|webp)$/i.test(seleccionado.archivo_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={seleccionado.archivo_url} alt="Comprobante" className={styles.archivoImg}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className={styles.archivoDoc}>
                          <span className={styles.archivoDocIcon}>📄</span>
                          <span className={styles.archivoDocLabel}>Ver archivo adjunto</span>
                        </div>
                      )}
                    </div>
                    <span className={styles.archivoUrl}>Abrir en nueva pestaña →</span>
                  </a>
                ) : (
                  <div className={styles.sinArchivo}>Sin comprobante adjunto</div>
                )}
              </div>

            </div>

            {seleccionado.estado === 'PENDIENTE' && (
              <div className={styles.panelFooter}>
                <button className={styles.btnAprobar} onClick={() => aprobar(seleccionado.id)} disabled={procesando}>
                  {procesando ? 'Procesando…' : '✓ Confirmar seña'}
                </button>
                <button className={styles.btnDanger} onClick={() => setModalRechazo(true)} disabled={procesando}>
                  ✕ Rechazar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



export default function ComprobantesPage() {
  return (
    <Suspense fallback={null}>
      <ComprobantesPageContent />
    </Suspense>
  )
}
