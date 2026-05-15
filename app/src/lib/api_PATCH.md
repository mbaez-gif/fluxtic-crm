# Patch api.ts — agregar tipo y función getDashboard

Al final del archivo `app/src/lib/api.ts`, agregar:

```typescript
// ── Dashboard ─────────────────────────────────────────────────────
export interface DashboardData {
  ingresos_hoy: number
  delta_ingresos_pct: number
  cantidad_ventas_hoy: number
  turnos_confirmados: number
  turnos_pendientes: number
  total_turnos_hoy: number
  stock_critico: number
}

export async function getDashboard(): Promise<DashboardData> {
  return apiClient<DashboardData>('/reportes/resumen?periodo=mes')
}
```

(El page.tsx ya usa `apiClient<DashboardData>('/reportes/resumen?periodo=mes')` directamente, así que este paso es opcional pero recomendado para mantener consistencia.)
