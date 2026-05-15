'use client';

import { useState, useEffect } from 'react';
import styles from './NuevoClienteModal.module.css';

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
  notas?: string | null;
  total_compras?: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  clienteEditar?: Cliente | null;
  onClose: () => void;
  onClienteCreado: (c: Cliente) => void;
}

const initForm = {
  nombre: '', apellido: '', telefono: '', email: '',
  segmento: 'FINAL' as 'FINAL' | 'MAYORISTA' | 'VIP',
  origen: 'MANUAL', notas: '',
};

export default function NuevoClienteModal({ open, clienteEditar, onClose, onClienteCreado }: Props) {
  const esEdicion = !!clienteEditar;
  const [form, setForm] = useState(initForm);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (clienteEditar) {
        setForm({
          nombre:   clienteEditar.nombre,
          apellido: clienteEditar.apellido ?? '',
          telefono: clienteEditar.telefono ?? '',
          email:    clienteEditar.email ?? '',
          segmento: clienteEditar.segmento,
          origen:   clienteEditar.origen,
          notas:    clienteEditar.notas ?? '',
        });
      } else {
        setForm(initForm);
      }
      setError('');
    }
  }, [open, clienteEditar]);

  async function handleGuardar() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setGuardando(true); setError('');

    try {
      const url = esEdicion
        ? `${API_BASE}/clientes/${clienteEditar!.id}`
        : `${API_BASE}/clientes`;
      const method = esEdicion ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:   form.nombre.trim(),
          apellido: form.apellido.trim() || null,
          telefono: form.telefono.trim() || null,
          email:    form.email.trim() || null,
          segmento: form.segmento,
          origen:   form.origen,
          notas:    form.notas.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }

      const cliente: Cliente = await res.json();
      onClienteCreado(cliente);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.title}>{esEdicion ? 'Editar cliente' : 'Nueva cliente'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          {error && <div className={styles.errorBanner}>{error}</div>}
          <div className={styles.grid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre *</label>
              <input className={styles.inp} value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre…" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Apellido</label>
              <input className={styles.inp} value={form.apellido}
                onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                placeholder="Apellido…" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Teléfono</label>
              <input className={styles.inp} type="tel" value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                placeholder="+54 341 …" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email</label>
              <input className={styles.inp} type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@…" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Segmento</label>
              <select className={styles.sel} value={form.segmento}
                onChange={e => setForm(f => ({ ...f, segmento: e.target.value as any }))}>
                <option value="FINAL">Consumidor final</option>
                <option value="MAYORISTA">Mayorista</option>
                <option value="VIP">VIP</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Origen</label>
              <select className={styles.sel} value={form.origen}
                onChange={e => setForm(f => ({ ...f, origen: e.target.value }))}>
                <option value="MANUAL">Manual</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="INSTAGRAM_DM">Instagram DM</option>
                <option value="TIENDANUBE">Tienda Nube</option>
                <option value="BOCA_A_BOCA">Boca a boca</option>
              </select>
            </div>
            <div className={`${styles.formGroup} ${styles.full}`}>
              <label className={styles.label}>Notas</label>
              <textarea className={styles.txt} value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Preferencias, alergias, observaciones…" />
            </div>
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={onClose} disabled={guardando}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleGuardar} disabled={guardando}>
            {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
