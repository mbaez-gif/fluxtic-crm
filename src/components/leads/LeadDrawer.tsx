'use client'

import { useState } from 'react'
import { useRouter }        from 'next/navigation'
import { useAuthContext }   from '@/components/auth/AuthProvider'
import { db }               from '@/lib/firebase/config'
import { addDoc, updateDoc, doc, collection, serverTimestamp } from 'firebase/firestore'
import { cn }               from '@/lib/utils'
import { format }           from 'date-fns'
import { es }               from 'date-fns/locale'
import type { Lead }        from '@/types'
import type { Timestamp }   from 'firebase/firestore'
import {
  X, Mail, Phone, Building2, User, Tag,
  MessageCircle, ExternalLink, CheckCircle,
  ArrowRight, Pencil, FileText, Stethoscope,
  TrendingUp, Calendar,
} from 'lucide-react'

function toDate(ts: Timestamp | Date | string | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if ((ts as any).toDate) return (ts as any).toDate()
  return new Date()
}

const ESTADO_COLOR: Record<string, string> = {
  nuevo:      'bg-flux-muted text-flux-text2',
  contactado: 'bg-blue-950 text-blue-400',
  calificado: 'bg-flux-tealGlow text-flux-teal',
  descartado: 'bg-red-950 text-red-400',
}

interface Props {
  lead:    Lead
  onClose: () => void
  onEdit:  () => void
  onRefresh: () => void
}

export function LeadDrawer({ lead, onClose, onEdit, onRefresh }: Props) {
  const { user, profile } = useAuthContext()
  const router  = useRouter()
  const [converting, setConverting] = useState(false)
  const [converted,  setConverted]  = useState(false)
  const [updatingEstado, setUpdatingEstado] = useState(false)

  // WhatsApp link
  const whatsappUrl = lead.telefono
    ? `https://wa.me/${lead.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hola ${lead.nombre.split(' ')[0]}, te contactamos desde Fluxtic. ¿Tenés un momento para conversar?`
      )}`
    : null

  // Gmail compose link
  const gmailUrl = lead.email
    ? `https://mail.google.com/mail/?view=cm&to=${lead.email}&su=Fluxtic - Te contactamos&body=Hola ${lead.nombre.split(' ')[0]},%0D%0A%0D%0AQueríamos contactarte desde Fluxtic para conocer más sobre ${lead.empresa} y ver cómo podemos ayudarte.%0D%0A%0D%0ASaludos,`
    : null

  async function handleConvertirACliente() {
    if (!user || !profile) return
    if (!confirm(`¿Convertir a ${lead.nombre} en cliente? Se creará una ficha de cliente con sus datos.`)) return
    setConverting(true)
    try {
      // Create client
      await addDoc(collection(db, 'clientes'), {
        nombre:   lead.nombre,
        empresa:  lead.empresa,
        email:    lead.email,
        telefono: lead.telefono ?? '',
        sector:   lead.fuente ?? '',
        estado:   'activo',
        contactos: [{
          nombre:   lead.nombre,
          email:    lead.email,
          telefono: lead.telefono ?? '',
          cargo:    'Contacto principal',
        }],
        notas:         lead.notas ?? '',
        leadId:        lead.id,
        creadoEn:      serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })

      // Update lead status to calificado
      await updateDoc(doc(db, 'leads', lead.id), {
        estado:        'calificado',
        actualizadoEn: serverTimestamp(),
      })

      setConverted(true)
      onRefresh()
      setTimeout(() => router.push('/clientes'), 1500)
    } finally {
      setConverting(false)
    }
  }

  async function handleCambiarEstado(estado: string) {
    setUpdatingEstado(true)
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        estado,
        actualizadoEn: serverTimestamp(),
      })
      onRefresh()
    } finally {
      setUpdatingEstado(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-flux-card border-l border-flux-border flex flex-col h-full overflow-y-auto animate-slide-in shadow-card-hover">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-flux-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-flux-teal/20 flex items-center justify-center text-lg font-bold text-flux-teal">
              {lead.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-display font-bold text-flux-white text-base">{lead.nombre}</h2>
              <p className="text-xs text-flux-text3">{lead.empresa}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="text-flux-text3 hover:text-flux-text1 p-2 rounded-lg hover:bg-flux-muted transition-colors">
              <Pencil size={15} />
            </button>
            <button onClick={onClose}
              className="text-flux-text3 hover:text-flux-text1 p-2 rounded-lg hover:bg-flux-muted transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Estado */}
          <div>
            <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-2">Estado</p>
            <div className="flex gap-2 flex-wrap">
              {['nuevo', 'contactado', 'calificado', 'descartado'].map(e => (
                <button key={e} onClick={() => handleCambiarEstado(e)} disabled={updatingEstado}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
                    lead.estado === e
                      ? ESTADO_COLOR[e]
                      : 'bg-flux-muted text-flux-text3 hover:text-flux-text1'
                  )}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Contacto */}
          <div>
            <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-3">Datos de contacto</p>
            <div className="space-y-2">
              {lead.email && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-flux-surface rounded-xl border border-flux-border">
                  <Mail size={15} className="text-flux-teal shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-flux-text3">Email</p>
                    <p className="text-sm text-flux-text1 truncate">{lead.email}</p>
                  </div>
                </div>
              )}
              {lead.telefono && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-flux-surface rounded-xl border border-flux-border">
                  <Phone size={15} className="text-flux-teal shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-flux-text3">Teléfono</p>
                    <p className="text-sm text-flux-text1">{lead.telefono}</p>
                  </div>
                </div>
              )}
              {lead.empresa && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-flux-surface rounded-xl border border-flux-border">
                  <Building2 size={15} className="text-flux-teal shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-flux-text3">Empresa</p>
                    <p className="text-sm text-flux-text1">{lead.empresa}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-flux-surface rounded-xl border border-flux-border">
                <Tag size={15} className="text-flux-teal shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-flux-text3">Fuente</p>
                  <p className="text-sm text-flux-text1 capitalize">{lead.fuente}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 bg-flux-surface rounded-xl border border-flux-border">
                <Calendar size={15} className="text-flux-teal shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-flux-text3">Creado</p>
                  <p className="text-sm text-flux-text1">
                    {format(toDate(lead.creadoEn), "d 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contactar */}
          <div>
            <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-3">Contactar</p>
            <div className="grid grid-cols-2 gap-2">
              {gmailUrl && (
                <a href={gmailUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 px-4 py-4 bg-flux-surface border border-flux-border rounded-xl hover:border-blue-500/50 hover:bg-blue-950/20 transition-all group">
                  <Mail size={20} className="text-blue-400" />
                  <span className="text-xs font-medium text-flux-text2 group-hover:text-blue-300">Email</span>
                </a>
              )}
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 px-4 py-4 bg-flux-surface border border-flux-border rounded-xl hover:border-green-500/50 hover:bg-green-950/20 transition-all group">
                  <MessageCircle size={20} className="text-green-400" />
                  <span className="text-xs font-medium text-flux-text2 group-hover:text-green-300">WhatsApp</span>
                </a>
              )}
              {!gmailUrl && !whatsappUrl && (
                <p className="col-span-2 text-xs text-flux-text3 text-center py-2">
                  Sin datos de contacto cargados
                </p>
              )}
            </div>
          </div>

          {/* Acciones del CRM */}
          <div>
            <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-3">Acciones CRM</p>
            <div className="space-y-2">
              <button onClick={() => router.push('/diagnosticos')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-flux-surface border border-flux-border rounded-xl hover:border-flux-teal/30 hover:bg-flux-tealGlow/10 transition-all text-left group">
                <Stethoscope size={16} className="text-flux-teal shrink-0" />
                <div>
                  <p className="text-sm font-medium text-flux-text1 group-hover:text-flux-white">Nuevo diagnóstico</p>
                  <p className="text-2xs text-flux-text3">Formulario de 30 preguntas</p>
                </div>
                <ArrowRight size={14} className="text-flux-text3 ml-auto" />
              </button>
              <button onClick={() => router.push('/oportunidades')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-flux-surface border border-flux-border rounded-xl hover:border-flux-teal/30 hover:bg-flux-tealGlow/10 transition-all text-left group">
                <TrendingUp size={16} className="text-flux-teal shrink-0" />
                <div>
                  <p className="text-sm font-medium text-flux-text1 group-hover:text-flux-white">Crear oportunidad</p>
                  <p className="text-2xs text-flux-text3">Agregar al pipeline</p>
                </div>
                <ArrowRight size={14} className="text-flux-text3 ml-auto" />
              </button>
            </div>
          </div>

          {/* Notas */}
          {lead.notas && (
            <div>
              <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-2">Notas</p>
              <div className="px-4 py-3 bg-flux-surface border border-flux-border rounded-xl">
                <p className="text-sm text-flux-text2 whitespace-pre-wrap leading-relaxed">{lead.notas}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer — Convertir a cliente */}
        <div className="px-6 py-4 border-t border-flux-border shrink-0">
          {converted ? (
            <div className="flex items-center justify-center gap-2 px-4 py-3 bg-flux-tealGlow border border-flux-teal/30 rounded-xl">
              <CheckCircle size={16} className="text-flux-teal" />
              <span className="text-sm font-medium text-flux-teal">¡Convertido a cliente! Redirigiendo…</span>
            </div>
          ) : lead.estado !== 'descartado' ? (
            <button
              onClick={handleConvertirACliente}
              disabled={converting}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3"
            >
              {converting ? (
                <div className="w-4 h-4 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              Convertir en cliente
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
