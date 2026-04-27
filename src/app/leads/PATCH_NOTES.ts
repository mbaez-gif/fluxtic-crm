// Add this import to leads/page.tsx
import { notifyNewLead, notifyLeadCalificado } from '@/lib/notificationTriggers'

// In LeadModal handleSave — after createDoc:
// await notifyNewLead({ nombre: form.nombre, empresa: form.empresa, fuente: form.fuente })

// In LeadDrawer handleCambiarEstado — when estado === 'calificado':
// await notifyLeadCalificado({ nombre: lead.nombre, empresa: lead.empresa })

// PATCH for leads/page.tsx handleSave in LeadModal:
export const LEADS_NOTIF_PATCH = `
  async function handleSave() {
    if (!form.nombre || !form.empresa || !form.email) return
    setSaving(true)
    try {
      if (lead) {
        await updateDocById('leads', lead.id, form)
        // Notify if status changed to calificado
        if (form.estado === 'calificado' && lead.estado !== 'calificado') {
          await notifyLeadCalificado({ nombre: form.nombre, empresa: form.empresa })
        }
      } else {
        await createDoc('leads', { ...form, responsableId: profile?.uid ?? '' })
        // Notify all socios about new lead
        await notifyNewLead({ nombre: form.nombre, empresa: form.empresa, fuente: form.fuente })
      }
      onClose()
    } finally { setSaving(false) }
  }
`
