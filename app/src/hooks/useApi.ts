'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ── Lookups (caché largo, datos relativamente estables) ────────
export function useSedes() {
  return useQuery({
    queryKey: ['sedes'],
    queryFn: () => api.get<any[]>('/sedes'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useEspecialidades() {
  return useQuery({
    queryKey: ['especialidades'],
    queryFn: () => api.get<any[]>('/especialidades'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useProfesionales(especialidadId?: string) {
  return useQuery({
    queryKey: ['profesionales', especialidadId ?? null],
    queryFn: () => api.get<any[]>(`/profesionales${especialidadId ? `?especialidad_id=${especialidadId}` : ''}`),
    staleTime: 2 * 60 * 1000,
  })
}

export function usePrestaciones(especialidadId?: string) {
  return useQuery({
    queryKey: ['prestaciones', especialidadId ?? null],
    queryFn: () => api.get<any[]>(`/prestaciones${especialidadId ? `?especialidad_id=${especialidadId}` : ''}`),
    staleTime: 2 * 60 * 1000,
  })
}

export function useCoberturas() {
  return useQuery({
    queryKey: ['coberturas'],
    queryFn: () => api.get<any[]>('/coberturas'),
    staleTime: 10 * 60 * 1000,
  })
}

// ── Turnos / agenda ────────────────────────────────────────────
export interface FiltrosAgenda {
  desde: string  // ISO
  hasta: string  // ISO
  profesional_id?: string
  sede_id?: string
  estado?: string
}

export function useTurnos(filtros: FiltrosAgenda) {
  return useQuery({
    queryKey: ['turnos', filtros],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, String(v)) })
      return api.get<any[]>(`/turnos?${params.toString()}`)
    },
    staleTime: 30 * 1000,
  })
}

export function useBloqueos(desde: string, hasta: string, filtros: { profesional_id?: string; sede_id?: string } = {}) {
  return useQuery({
    queryKey: ['bloqueos', desde, hasta, filtros],
    queryFn: async () => {
      const params = new URLSearchParams({ desde, hasta })
      if (filtros.profesional_id) params.set('profesional_id', filtros.profesional_id)
      if (filtros.sede_id) params.set('sede_id', filtros.sede_id)
      return api.get<any[]>(`/bloqueos?${params.toString()}`)
    },
    staleTime: 60 * 1000,
  })
}

// ── Pacientes ──────────────────────────────────────────────────
export interface FiltrosPacientes {
  q?: string
  estado?: string
  segmento?: string
  canal_origen?: string
  cobertura_id?: string
  limit?: number
  offset?: number
}

export function usePacientes(filtros: FiltrosPacientes) {
  return useQuery({
    queryKey: ['pacientes', filtros],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, String(v)) })
      return api.get<{ data: any[]; total: number }>(`/pacientes?${params.toString()}`)
    },
    staleTime: 30 * 1000,
  })
}

export function useBuscarPacientes(q: string) {
  return useQuery({
    queryKey: ['pacientes-search', q],
    queryFn: () => api.get<{ data: any[]; total: number }>(`/pacientes?q=${encodeURIComponent(q)}&limit=20`),
    enabled: q.length >= 2,
    staleTime: 10 * 1000,
  })
}

export function usePaciente(id: string | undefined) {
  return useQuery({
    queryKey: ['paciente', id],
    queryFn: () => api.get<any>(`/pacientes/${id}`),
    enabled: !!id,
  })
}

export function useHistorialPaciente(id: string | undefined) {
  return useQuery({
    queryKey: ['paciente-historial', id],
    queryFn: () => api.get<any>(`/pacientes/${id}/historial`),
    enabled: !!id,
  })
}

export function useCrearPaciente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/pacientes', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pacientes'] }),
  })
}

export function useActualizarPaciente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/pacientes/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['pacientes'] })
      qc.invalidateQueries({ queryKey: ['paciente', vars.id] })
    },
  })
}

export function useAlertasClinicas(pacienteId: string | undefined) {
  return useQuery({
    queryKey: ['alertas-clinicas', pacienteId],
    queryFn: () => api.get<any[]>(`/clinico/alertas/paciente/${pacienteId}`),
    enabled: !!pacienteId,
  })
}

export function useCrearAlertaClinica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/clinico/alertas', body),
    onSuccess: (_d, body: any) => {
      qc.invalidateQueries({ queryKey: ['alertas-clinicas', body.paciente_id] })
      qc.invalidateQueries({ queryKey: ['paciente', body.paciente_id] })
    },
  })
}

export function useEliminarAlertaClinica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/clinico/alertas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas-clinicas'] }),
  })
}

// ── Historia clínica ───────────────────────────────────────────
export function useHistoriaClinica(pacienteId: string | undefined) {
  return useQuery({
    queryKey: ['hc', pacienteId],
    queryFn: () => api.get<any>(`/historia-clinica/paciente/${pacienteId}`),
    enabled: !!pacienteId,
  })
}

export function useCrearEvolucion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/historia-clinica/evoluciones', body),
    onSuccess: (_d, body: any) => qc.invalidateQueries({ queryKey: ['hc', body.paciente_id] }),
  })
}

export function useFirmarEvolucion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/historia-clinica/evoluciones/${id}/firmar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hc'] }),
  })
}

export function useCrearAntecedente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/historia-clinica/antecedentes', body),
    onSuccess: (_d, body: any) => qc.invalidateQueries({ queryKey: ['hc', body.paciente_id] }),
  })
}

export function useCrearAlergia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/historia-clinica/alergias', body),
    onSuccess: (_d, body: any) => qc.invalidateQueries({ queryKey: ['hc', body.paciente_id] }),
  })
}

export function useCrearMedicacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/historia-clinica/medicaciones', body),
    onSuccess: (_d, body: any) => qc.invalidateQueries({ queryKey: ['hc', body.paciente_id] }),
  })
}

export function useEliminarItemHc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entity, id, motivo }: { entity: string; id: string; motivo: string }) =>
      api.delete(`/historia-clinica/${entity}/${id}`, { motivo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hc'] }),
  })
}

// ── Plantillas HC por especialidad ─────────────────────────────
export function usePlantillasHc(especialidadId?: string) {
  return useQuery({
    queryKey: ['plantillas-hc', especialidadId ?? null],
    queryFn: () => api.get<any[]>(`/clinico/plantillas-hc${especialidadId ? `?especialidad_id=${especialidadId}` : ''}`),
    staleTime: 10 * 60 * 1000,
  })
}

// ── Mutations para Especialidades/Prestaciones/Profesionales ────
export function useCrearEspecialidad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/especialidades', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['especialidades'] }),
  })
}

export function useActualizarEspecialidad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/especialidades/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['especialidades'] }),
  })
}

export function useCrearPrestacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/prestaciones', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prestaciones'] }),
  })
}

export function useActualizarPrestacion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/prestaciones/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prestaciones'] }),
  })
}

export function useCrearProfesional() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/profesionales', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profesionales'] }),
  })
}

export function useProfesional(id: string | undefined) {
  return useQuery({
    queryKey: ['profesional', id],
    queryFn: () => api.get<any>(`/profesionales/${id}`),
    enabled: !!id,
  })
}

export function useActualizarProfesional() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/profesionales/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['profesionales'] })
      qc.invalidateQueries({ queryKey: ['profesional', vars.id] })
    },
  })
}

export function useAgregarHorario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/profesionales/horarios', body),
    onSuccess: (_d, body: any) => qc.invalidateQueries({ queryKey: ['profesional', body.profesional_id] }),
  })
}

export function useEliminarHorario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/profesionales/horarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profesional'] }),
  })
}

// ── Facturación / Cobros / Caja ────────────────────────────────
export function useComprobantes(filtros: { paciente_id?: string; estado?: string; desde?: string; hasta?: string } = {}) {
  return useQuery({
    queryKey: ['comprobantes', filtros],
    queryFn: () => {
      const params = new URLSearchParams()
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, String(v)) })
      return api.get<any[]>(`/facturacion/comprobantes?${params.toString()}`)
    },
  })
}

export function useComprobante(id: string | undefined) {
  return useQuery({
    queryKey: ['comprobante', id],
    queryFn: () => api.get<any>(`/facturacion/comprobantes/${id}`),
    enabled: !!id,
  })
}

export function useCrearComprobante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/facturacion/comprobantes', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comprobantes'] })
      qc.invalidateQueries({ queryKey: ['caja'] })
    },
  })
}

export function useCrearPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/facturacion/pagos', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comprobantes'] })
      qc.invalidateQueries({ queryKey: ['comprobante'] })
      qc.invalidateQueries({ queryKey: ['caja'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCaja(desde?: string, hasta?: string) {
  return useQuery({
    queryKey: ['caja', desde, hasta],
    queryFn: () => {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      return api.get<any>(`/facturacion/caja?${params.toString()}`)
    },
  })
}

export function useDeudas() {
  return useQuery({
    queryKey: ['deudas'],
    queryFn: () => api.get<any[]>('/facturacion/deudas'),
  })
}

// ── Mutations típicas ──────────────────────────────────────────
export function useCrearTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/turnos', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCambiarEstadoTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, estado, motivo }: { id: string; estado: string; motivo?: string }) =>
      api.post(`/turnos/${id}/estado`, { estado, motivo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['turnos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCancelarTurno() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.delete(`/turnos/${id}`, { motivo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['turnos'] }),
  })
}

export function useCrearBloqueo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: any) => api.post('/bloqueos', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bloqueos'] })
      qc.invalidateQueries({ queryKey: ['turnos'] })
    },
  })
}

export function useEliminarBloqueo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/bloqueos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bloqueos'] }),
  })
}
