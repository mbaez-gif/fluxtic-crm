'use client'

import type { Permisos, Rol } from '@/types/usuarios'
import { PERMISOS_FULL } from '@/types/usuarios'
import styles from './PermisosEditor.module.css'

interface Props {
  rol: Rol
  permisos: Permisos
  onChange: (permisos: Permisos) => void
  disabled?: boolean
}

type PermisoGroup = {
  label: string
  items: { key: keyof Permisos; label: string }[]
}

const GRUPOS: PermisoGroup[] = [
  {
    label: 'Caja',
    items: [
      { key: 'puede_ver_caja',                label: 'Ver caja / POS' },
      { key: 'puede_cobrar',                  label: 'Cobrar turnos pendientes' },
      { key: 'puede_reimprimir_comprobantes', label: 'Reimprimir comprobantes' },
      { key: 'puede_anular_ventas',           label: 'Anular ventas' },
      { key: 'puede_ver_ventas_dia',          label: 'Ver historial de ventas' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { key: 'puede_gestionar_turnos',   label: 'Gestionar turnos' },
      { key: 'puede_gestionar_clientes', label: 'Gestionar clientes' },
      { key: 'puede_gestionar_servicios', label: 'Gestionar servicios' },
      { key: 'puede_gestionar_productos', label: 'Gestionar productos y stock' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { key: 'puede_ver_reportes',            label: 'Ver reportes y dashboards' },
      { key: 'puede_gestionar_configuracion', label: 'Gestionar configuración' },
      { key: 'puede_gestionar_usuarios',      label: 'Gestionar usuarios' },
      { key: 'puede_gestionar_integraciones', label: 'Gestionar integraciones' },
    ],
  },
]

export default function PermisosEditor({ rol, permisos, onChange, disabled }: Props) {
  if (rol === 'OWNER') {
    return (
      <div className={styles.ownerNote}>
        El rol Owner tiene acceso total al sistema. Los permisos no se pueden restringir.
      </div>
    )
  }

  function toggle(key: keyof Permisos) {
    onChange({ ...permisos, [key]: !permisos[key] })
  }

  function toggleAll(val: boolean) {
    onChange({ ...PERMISOS_FULL, ...Object.fromEntries(Object.keys(PERMISOS_FULL).map(k => [k, val])) } as Permisos)
  }

  const allOn  = Object.values(permisos).every(Boolean)
  const allOff = Object.values(permisos).every(v => !v)

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Permisos</span>
        <div className={styles.headerActions}>
          <button type="button" className={styles.linkBtn} onClick={() => toggleAll(true)}  disabled={disabled || allOn}>Todos</button>
          <span className={styles.sep}>·</span>
          <button type="button" className={styles.linkBtn} onClick={() => toggleAll(false)} disabled={disabled || allOff}>Ninguno</button>
        </div>
      </div>

      {GRUPOS.map(grupo => (
        <div key={grupo.label} className={styles.grupo}>
          <div className={styles.grupoLabel}>{grupo.label}</div>
          <div className={styles.grupoItems}>
            {grupo.items.map(item => (
              <label key={item.key} className={`${styles.switchRow} ${disabled ? styles.disabled : ''}`}>
                <span className={styles.switchLabel}>{item.label}</span>
                <span
                  className={`${styles.switch} ${permisos[item.key] ? styles.on : ''}`}
                  onClick={() => !disabled && toggle(item.key)}
                  role="checkbox"
                  aria-checked={permisos[item.key]}
                  tabIndex={0}
                  onKeyDown={e => e.key === ' ' && !disabled && toggle(item.key)}
                >
                  <span className={styles.thumb} />
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
