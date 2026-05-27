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

// ── Pacientes (con búsqueda autocompletar) ─────────────────────
export function useBuscarPacientes(q: string) {
  return useQuery({
    queryKey: ['pacientes-search', q],
    queryFn: () => api.get<{ data: any[]; total: number }>(`/pacientes?q=${encodeURIComponent(q)}&limit=20`),
    enabled: q.length >= 2,
    staleTime: 10 * 1000,
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
