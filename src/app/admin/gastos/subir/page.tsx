'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter }         from 'next/navigation'
import { useAuthContext }    from '@/components/auth/AuthProvider'
import { PageHeader }        from '@/components/layout/PageHeader'
import { Spinner }           from '@/components/ui'
import { db }                from '@/lib/firebase/config'
import { collection, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { createGasto, logAudit, getPeriodoActual, getCategorias, getMediosPago } from '@/lib/firebase/admin'
import type { Categoria, MedioPago, GastoTipo, GastoEstado, Moneda, AIInterpretation } from '@/types/admin'
import { SOCIOS, GASTO_TIPO_LABEL, MONEDA_SYMBOL } from '@/types/admin'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft, Upload, FileText, Sparkles, CheckCircle,
  AlertCircle, AlertTriangle, X, Eye, RotateCcw,
  Save, Info, ChevronRight,
} from 'lucide-react'

type Step = 'upload' | 'processing' | 'review' | 'confirmed'

interface DraftForm {
  fecha:           string
  periodo:         string
  proveedorNombre: string
  proveedorTaxId:  string
  descripcion:     string
  categoriaId:     string
  categoriaNombre: string
  tipo:            GastoTipo
  importe:         string
  moneda:          Moneda
  tipoCambio:      string
  pagadoPorUid:    string
  pagadoPorNombre: string
  medioPagoId:     string
  medioPagoNombre: string
  estado:          GastoEstado
  distribuirEntreSocios: boolean
  notas:           string
  // AI extras
  documentNumber:  string
  cae:             string
  caeDueDate:      string
}

function ConfidenceBadge({ value }: { value?: number }) {
  if (!value && value !== 0) return null
  const pct = Math.round(value * 100)
  const color = value >= 0.8 ? 'text-flux-teal' : value >= 0.5 ? 'text-amber-400' : 'text-red-400'
  return (
    <span className={cn('text-2xs font-medium ml-1.5', color)}>
      {pct}% confianza
    </span>
  )
}

function FieldRow({ label, aiValue, children, confidence, aiOnly }: {
  label:       string
  aiValue?:    string | number | null
  children:    React.ReactNode
  confidence?: number
  aiOnly?:     boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-medium text-flux-text2">{label}</label>
        {confidence !== undefined && <ConfidenceBadge value={confidence} />}
        {aiValue && (
          <span className="text-2xs text-flux-text3 ml-auto flex items-center gap-1">
            <Sparkles size={9} className="text-flux-teal" />
            IA: {aiValue}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export default function SubirFacturaPage() {
  const router = useRouter()
  const { user, profile } = useAuthContext()

  const [step,          setStep]          = useState<Step>('upload')
  const [file,          setFile]          = useState<File | null>(null)
  const [filePreview,   setFilePreview]   = useState<string | null>(null)
  const [processing,    setProcessing]    = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [interpretation, setInterpretation] = useState<AIInterpretation | null>(null)
  const [duplicates,    setDuplicates]    = useState<any[]>([])
  const [categorias,    setCategorias]    = useState<Categoria[]>([])
  const [medios,        setMedios]        = useState<MedioPago[]>([])
  const [dragOver,      setDragOver]      = useState(false)
  const [error,         setError]         = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<DraftForm>({
    fecha:           new Date().toISOString().split('T')[0],
    periodo:         getPeriodoActual(),
    proveedorNombre: '',
    proveedorTaxId:  '',
    descripcion:     '',
    categoriaId:     '',
    categoriaNombre: '',
    tipo:            'operating',
    importe:         '',
    moneda:          'ARS',
    tipoCambio:      '',
    pagadoPorUid:    '',
    pagadoPorNombre: '',
    medioPagoId:     '',
    medioPagoNombre: '',
    estado:          'paid',
    distribuirEntreSocios: true,
    notas:           '',
    documentNumber:  '',
    cae:             '',
    caeDueDate:      '',
  })

  useEffect(() => {
    getCategorias().then(setCategorias)
    getMediosPago().then(setMedios)
    if (user && profile) {
      setForm(f => ({ ...f, pagadoPorUid: user.uid, pagadoPorNombre: profile.nombre }))
    }
  }, [user, profile])

  // File conversion to base64
  function fileToBase64(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload  = () => res((reader.result as string).split(',')[1])
      reader.onerror = rej
      reader.readAsDataURL(f)
    })
  }

  function handleFileSelect(f: File) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(f.type)) {
      setError('Tipo de archivo no permitido. Usá PDF, JPG, PNG o WebP.')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('El archivo no puede superar 10 MB.')
      return
    }
    setError('')
    setFile(f)
    if (f.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(f))
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  // Map AI interpretation to form fields
  function mapInterpretationToForm(ai: AIInterpretation): Partial<DraftForm> {
    const mapped: Partial<DraftForm> = {}

    if (ai.vendorName)    mapped.proveedorNombre = ai.vendorName
    if (ai.vendorTaxId)   mapped.proveedorTaxId  = ai.vendorTaxId
    if (ai.description)   mapped.descripcion     = ai.description
    if (ai.documentDate)  mapped.fecha           = ai.documentDate
    if (ai.suggestedPeriod) mapped.periodo       = ai.suggestedPeriod
    if (ai.totalAmount)   mapped.importe         = String(ai.totalAmount)
    if (ai.currency)      mapped.moneda          = ai.currency as Moneda
    if (ai.documentNumber) mapped.documentNumber = ai.documentNumber
    if (ai.cae)           mapped.cae             = ai.cae
    if (ai.caeDueDate)    mapped.caeDueDate       = ai.caeDueDate
    if (ai.suggestedExpenseType) mapped.tipo     = ai.suggestedExpenseType as GastoTipo

    // Match category by name
    if (ai.suggestedCategoryName) {
      const cat = categorias.find(c =>
        c.nombre.toLowerCase().includes(ai.suggestedCategoryName!.toLowerCase().slice(0, 8)))
      if (cat) {
        mapped.categoriaId    = cat.id
        mapped.categoriaNombre = cat.nombre
      }
    }

    // USD always requires review → add note
    if (ai.currency === 'USD') {
      mapped.notas = 'Gasto en USD — revisar tipo de cambio antes de confirmar.'
    }

    return mapped
  }

  async function handleProcess() {
    if (!file) return
    setProcessing(true)
    setStep('processing')
    setError('')

    try {
      const base64 = await fileToBase64(file)

      const res  = await fetch('/api/admin/process-document', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fileBase64: base64, mimeType: file.type, fileName: file.name }),
      })
      const data = await res.json()

      if (!data.success || !data.interpretation) {
        setError(data.error ?? 'Error al interpretar el documento.')
        setStep('upload')
        return
      }

      const ai = data.interpretation as AIInterpretation
      setInterpretation(ai)

      // Pre-fill form with AI data
      const mapped = mapInterpretationToForm(ai)
      setForm(f => ({ ...f, ...mapped }))

      // Check duplicates
      if (ai.totalAmount || ai.vendorName) {
        const dupRes  = await fetch('/api/admin/duplicate-check', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            vendorName:     ai.vendorName,
            vendorTaxId:    ai.vendorTaxId,
            documentNumber: ai.documentNumber,
            totalAmount:    ai.totalAmount,
            currency:       ai.currency,
            documentDate:   ai.documentDate,
          }),
        })
        const dupData = await dupRes.json()
        if (dupData.hasDuplicates) setDuplicates(dupData.suspects)
      }

      setStep('review')
    } catch (err) {
      console.error(err)
      setError('Error de conexión al procesar el documento.')
      setStep('upload')
    } finally {
      setProcessing(false)
    }
  }

  async function handleConfirm() {
    if (!user || !profile) return
    if (!form.proveedorNombre || !form.importe || !form.categoriaNombre) {
      setError('Completá al menos proveedor, importe y categoría antes de confirmar.')
      return
    }
    setSaving(true)
    try {
      const monto = parseFloat(form.importe)
      const tc    = form.tipoCambio ? parseFloat(form.tipoCambio) : undefined
      const importeARS = form.moneda !== 'ARS' && tc ? monto * tc : undefined

      const gastoId = await createGasto({
        fecha:          Timestamp.fromDate(new Date(form.fecha)),
        periodo:        form.periodo,
        descripcion:    form.descripcion || form.proveedorNombre,
        tipo:           form.tipo,
        fuente:         'ai_document',
        importe:        monto,
        moneda:         form.moneda,
        ...(tc         && { tipoCambio: tc }),
        ...(importeARS && { importeARS }),
        proveedorNombre: form.proveedorNombre,
        proveedorTaxId:  form.proveedorTaxId || undefined,
        categoriaId:     form.categoriaId || undefined,
        categoriaNombre: form.categoriaNombre,
        cargadoPorUid:   user.uid,
        cargadoPorNombre: profile.nombre,
        cargadoPorEmail:  user.email ?? '',
        pagadoPorUid:    form.pagadoPorUid || user.uid,
        pagadoPorNombre: form.pagadoPorNombre || profile.nombre,
        medioPagoId:     form.medioPagoId || undefined,
        medioPagoNombre: form.medioPagoNombre || undefined,
        tieneComprobante: true,
        distribuirEntreSocios: form.distribuirEntreSocios,
        distribucion: form.distribuirEntreSocios
          ? SOCIOS.map(s => ({
              uid:        s.uid,
              nombre:     s.nombre,
              porcentaje: 33.33,
              monto:      monto / 3,
              moneda:     form.moneda,
              pagado:     false,
            }))
          : undefined,
        estado:          form.estado,
        approvalStatus:  'not_required',
        esReintegrable:  false,
        esRecurrente:    interpretation?.suggestedIsRecurring ?? false,
        incluidoEnCierre: false,
        informadoPorMail: false,
        notas:           form.notas || undefined,
        documentNumber:  form.documentNumber || undefined,
        cae:             form.cae || undefined,
        caeDueDate:      form.caeDueDate || undefined,
      } as any)

      // Log audit
      await logAudit({
        entidadTipo:   'gasto',
        entidadId:     gastoId,
        accion:        'created',
        usuarioUid:    user.uid,
        usuarioNombre: profile.nombre,
        notas:         `Gasto creado desde factura IA: ${form.proveedorNombre} — $${monto}`,
      })

      // Log document
      await addDoc(collection(db, 'adminDocumentos'), {
        gastoId,
        fileName:        file?.name ?? '',
        fileType:        file?.type ?? '',
        fileSize:        file?.size ?? 0,
        processingStatus: 'confirmed',
        aiInterpretation: interpretation,
        cargadoPorUid:   user.uid,
        cargadoPorNombre: profile.nombre,
        creadoEn:        serverTimestamp(),
        actualizadoEn:   serverTimestamp(),
      })

      setStep('confirmed')
      setTimeout(() => router.push('/admin/gastos'), 2000)
    } catch (err) {
      console.error(err)
      setError('Error al guardar el gasto.')
    } finally {
      setSaving(false)
    }
  }

  // ── RENDER ─────────────────────────────────────────────

  if (step === 'confirmed') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <CheckCircle size={52} className="text-flux-teal mx-auto" />
          <p className="font-display font-bold text-xl text-flux-white">¡Gasto guardado!</p>
          <p className="text-sm text-flux-text3">Redirigiendo a Gastos…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Subir factura o comprobante"
        subtitle="Gemini analiza el documento y completa el formulario automáticamente"
        actions={
          <Link href="/admin/gastos" className="btn-ghost flex items-center gap-2 text-sm">
            <ArrowLeft size={14} /> Volver
          </Link>
        }
      />

      <div className="px-8 pb-10 space-y-6 max-w-4xl">

        {/* Steps indicator */}
        <div className="flex items-center gap-2">
          {(['upload', 'processing', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                step === s ? 'bg-flux-teal text-flux-bg' :
                ['processing', 'review'].indexOf(step) > ['upload', 'processing', 'review'].indexOf(s)
                  ? 'bg-flux-teal/30 text-flux-teal' : 'bg-flux-muted text-flux-text3'
              )}>
                {['processing', 'review'].indexOf(step) > ['upload', 'processing', 'review'].indexOf(s)
                  ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={cn('text-xs', step === s ? 'text-flux-text1 font-medium' : 'text-flux-text3')}>
                {s === 'upload' ? 'Subir archivo' : s === 'processing' ? 'Procesando' : 'Revisar y confirmar'}
              </span>
              {i < 2 && <ChevronRight size={14} className="text-flux-text3" />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all',
                dragOver ? 'border-flux-teal bg-flux-tealGlow/20' :
                file ? 'border-flux-teal bg-flux-tealGlow/10' : 'border-flux-border hover:border-flux-teal/50'
              )}
            >
              <input ref={fileRef} type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />

              {file ? (
                <div className="space-y-3">
                  {filePreview && (
                    <img src={filePreview} alt="preview"
                      className="max-h-40 mx-auto rounded-lg object-contain" />
                  )}
                  <div className="flex items-center justify-center gap-2">
                    <FileText size={20} className="text-flux-teal" />
                    <span className="font-medium text-flux-text1">{file.name}</span>
                    <button onClick={e => { e.stopPropagation(); setFile(null); setFilePreview(null) }}
                      className="text-flux-text3 hover:text-flux-danger ml-2">
                      <X size={16} />
                    </button>
                  </div>
                  <p className="text-2xs text-flux-text3">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload size={36} className="text-flux-text3 mx-auto" />
                  <div>
                    <p className="font-medium text-flux-text1">Arrastrá o hacé clic para subir</p>
                    <p className="text-sm text-flux-text3 mt-1">PDF, JPG, PNG o WebP · Máximo 10 MB</p>
                  </div>
                  <p className="text-xs text-flux-text3">
                    Facturas · Tickets · Recibos · Comprobantes bancarios · Transferencias
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-950/40 border border-red-800/40 rounded-xl text-sm text-red-300">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {file && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-3 bg-flux-tealGlow/10 border border-flux-teal/20 rounded-xl text-sm flex-1">
                  <Sparkles size={14} className="text-flux-teal" />
                  <span className="text-flux-text1">
                    Gemini va a analizar el documento e intentar completar todos los campos del gasto automáticamente.
                  </span>
                </div>
                <button onClick={handleProcess}
                  className="btn-primary flex items-center gap-2 shrink-0">
                  <Sparkles size={14} /> Analizar con IA
                </button>
              </div>
            )}

            <div className="flux-card space-y-2">
              <p className="text-xs font-medium text-flux-text2 flex items-center gap-1.5">
                <Info size={12} /> ¿Qué extrae la IA?
              </p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  'Proveedor y CUIT',
                  'Fecha del comprobante',
                  'Importe total e impuestos',
                  'Moneda (ARS/USD)',
                  'Número de factura',
                  'CAE y vencimiento',
                  'Categoría sugerida',
                  'Si es gasto recurrente',
                  'Medio de pago detectado',
                  'CBU / Alias bancario',
                ].map(item => (
                  <div key={item} className="flex items-center gap-1.5 text-xs text-flux-text3">
                    <CheckCircle size={10} className="text-flux-teal shrink-0" /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-flux-tealGlow flex items-center justify-center">
                <Sparkles size={32} className="text-flux-teal" />
              </div>
              <div className="absolute inset-0 rounded-2xl border-2 border-flux-teal animate-ping opacity-30" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-display font-bold text-lg text-flux-white">Gemini está leyendo el documento…</p>
              <p className="text-sm text-flux-text3">Esto puede tardar hasta 30 segundos</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-flux-teal animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="space-y-5">

            {/* AI summary */}
            {interpretation && (
              <div className="flux-card border-flux-teal/30 bg-flux-tealGlow/5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-flux-teal flex items-center gap-2">
                    <Sparkles size={14} /> Interpretación de Gemini
                  </p>
                  <button onClick={() => { setStep('upload'); setFile(null); setFilePreview(null) }}
                    className="text-2xs text-flux-text3 hover:text-flux-text1 flex items-center gap-1">
                    <RotateCcw size={10} /> Volver a subir
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Proveedor',  value: interpretation.vendorName,   conf: interpretation.confidence?.vendorName },
                    { label: 'Importe',    value: interpretation.totalAmount ? `${interpretation.currency} ${interpretation.totalAmount}` : null, conf: interpretation.confidence?.totalAmount },
                    { label: 'Fecha',      value: interpretation.documentDate, conf: interpretation.confidence?.documentDate },
                    { label: 'N° comprobante', value: interpretation.documentNumber, conf: interpretation.confidence?.documentNumber },
                  ].map(({ label, value, conf }) => value && (
                    <div key={label} className="text-xs">
                      <p className="text-flux-text3">{label}</p>
                      <p className="text-flux-text1 font-medium mt-0.5">{value}</p>
                      {conf !== undefined && <ConfidenceBadge value={conf} />}
                    </div>
                  ))}
                </div>

                {interpretation.reviewReasons && interpretation.reviewReasons.length > 0 && (
                  <div className="border-t border-flux-border/50 pt-3 space-y-1">
                    <p className="text-2xs text-amber-400 font-medium">Campos para revisar manualmente:</p>
                    {interpretation.reviewReasons.map((r, i) => (
                      <p key={i} className="text-2xs text-flux-text3 flex items-center gap-1">
                        <AlertTriangle size={9} className="text-amber-400 shrink-0" /> {r}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Duplicate warning */}
            {duplicates.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-950/40 border border-amber-800/40 rounded-xl">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Posible gasto duplicado</p>
                  <p className="text-xs text-amber-400/80 mt-0.5">
                    Ya existe un gasto similar. Revisá antes de confirmar.
                  </p>
                  {duplicates.map(d => (
                    <p key={d.id} className="text-2xs text-flux-text3 mt-1">
                      • {d.proveedorNombre} — ${d.importe} — {d.matchReason}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-950/40 border border-red-800/40 rounded-xl text-sm text-red-300">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* Review form */}
            <div className="flux-card space-y-5">
              <h2 className="text-sm font-medium text-flux-text1 border-b border-flux-border pb-3">
                Revisá y corregí los datos antes de confirmar
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Proveedor *" aiValue={interpretation?.vendorName} confidence={interpretation?.confidence?.vendorName}>
                  <input className="flux-input" value={form.proveedorNombre}
                    onChange={e => setForm(f => ({ ...f, proveedorNombre: e.target.value }))} />
                </FieldRow>
                <FieldRow label="CUIT / Tax ID" aiValue={interpretation?.vendorTaxId}>
                  <input className="flux-input" placeholder="20-12345678-9" value={form.proveedorTaxId}
                    onChange={e => setForm(f => ({ ...f, proveedorTaxId: e.target.value }))} />
                </FieldRow>
              </div>

              <FieldRow label="Descripción" aiValue={interpretation?.description}>
                <input className="flux-input" value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </FieldRow>

              <div className="grid grid-cols-3 gap-4">
                <FieldRow label="Importe *" aiValue={interpretation?.totalAmount?.toString()} confidence={interpretation?.confidence?.totalAmount}>
                  <input type="number" className="flux-input" value={form.importe}
                    onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} />
                </FieldRow>
                <FieldRow label="Moneda *" aiValue={interpretation?.currency} confidence={interpretation?.confidence?.currency}>
                  <select className="flux-input" value={form.moneda}
                    onChange={e => setForm(f => ({ ...f, moneda: e.target.value as Moneda }))}>
                    <option value="ARS">ARS $</option>
                    <option value="USD">USD $</option>
                    <option value="EUR">EUR €</option>
                  </select>
                </FieldRow>
                {form.moneda !== 'ARS' && (
                  <FieldRow label="Tipo de cambio (ARS)" >
                    <input type="number" className={cn('flux-input', !form.tipoCambio && 'border-amber-500')}
                      placeholder="Requerido para USD/EUR"
                      value={form.tipoCambio}
                      onChange={e => setForm(f => ({ ...f, tipoCambio: e.target.value }))} />
                  </FieldRow>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Fecha *" aiValue={interpretation?.documentDate} confidence={interpretation?.confidence?.documentDate}>
                  <input type="date" className="flux-input" value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </FieldRow>
                <FieldRow label="Período imputado">
                  <input type="month" className="flux-input" value={form.periodo}
                    onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
                </FieldRow>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Categoría *" aiValue={interpretation?.suggestedCategoryName} confidence={interpretation?.confidence?.category}>
                  <select className="flux-input" value={form.categoriaId}
                    onChange={e => {
                      const cat = categorias.find(c => c.id === e.target.value)
                      setForm(f => ({ ...f, categoriaId: e.target.value, categoriaNombre: cat?.nombre ?? '' }))
                    }}>
                    <option value="">Seleccioná…</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Tipo de gasto" aiValue={interpretation?.suggestedExpenseType} confidence={interpretation?.confidence?.expenseType}>
                  <select className="flux-input" value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as GastoTipo }))}>
                    {Object.entries(GASTO_TIPO_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </FieldRow>
              </div>

              {/* Quién pagó — OBLIGATORIO revisar */}
              <div>
                <p className="text-xs font-medium text-flux-text2 mb-2 flex items-center gap-1.5">
                  ¿Quién pagó? * <span className="text-amber-400 text-2xs">(siempre revisar)</span>
                </p>
                <div className="flex gap-2">
                  {SOCIOS.map(s => (
                    <button key={s.uid} onClick={() => setForm(f => ({ ...f, pagadoPorUid: s.uid, pagadoPorNombre: s.nombre }))}
                      className={cn('flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all',
                        form.pagadoPorUid === s.uid ? 'border-flux-teal bg-flux-tealGlow' : 'border-flux-border hover:border-flux-muted')}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-flux-bg"
                        style={{ backgroundColor: s.color }}>
                        {s.nombre.charAt(0)}
                      </div>
                      <span className={cn('text-xs font-medium', form.pagadoPorUid === s.uid ? 'text-flux-teal' : 'text-flux-text2')}>
                        {s.nombre}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Medio de pago" aiValue={interpretation?.paymentMethodDetected}>
                  <select className="flux-input" value={form.medioPagoId}
                    onChange={e => {
                      const m = medios.find(mp => mp.id === e.target.value)
                      setForm(f => ({ ...f, medioPagoId: e.target.value, medioPagoNombre: m?.nombre ?? '' }))
                    }}>
                    <option value="">Sin especificar</option>
                    {medios.filter(m => m.activo).map(m => (
                      <option key={m.id} value={m.id}>{m.nombre} ({m.ownerNombre})</option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow label="Estado">
                  <select className="flux-input" value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value as GastoEstado }))}>
                    <option value="paid">Pagado</option>
                    <option value="pending_payment">Pendiente de pago</option>
                    <option value="draft">Borrador</option>
                  </select>
                </FieldRow>
              </div>

              {/* Datos de factura electrónica argentina */}
              {(form.cae || interpretation?.cae) && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-flux-surface rounded-xl border border-flux-border">
                  <p className="col-span-2 text-2xs text-flux-teal font-medium">Factura electrónica argentina</p>
                  <FieldRow label="CAE" aiValue={interpretation?.cae}>
                    <input className="flux-input text-xs font-mono" value={form.cae}
                      onChange={e => setForm(f => ({ ...f, cae: e.target.value }))} />
                  </FieldRow>
                  <FieldRow label="Vencimiento CAE" aiValue={interpretation?.caeDueDate}>
                    <input type="date" className="flux-input" value={form.caeDueDate}
                      onChange={e => setForm(f => ({ ...f, caeDueDate: e.target.value }))} />
                  </FieldRow>
                </div>
              )}

              <FieldRow label="Notas">
                <textarea rows={2} className="flux-input resize-none text-sm" value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </FieldRow>

              {interpretation?.suggestedIsRecurring && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-950/30 border border-blue-800/30 rounded-lg">
                  <Info size={13} className="text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-300">
                    Gemini detectó que este podría ser un <strong>gasto recurrente</strong>.
                    Si es así, crealo también como gasto recurrente en el submódulo correspondiente.
                  </p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setStep('upload'); setFile(null); setFilePreview(null); setInterpretation(null) }}
                className="btn-ghost">
                Cancelar
              </button>
              <button onClick={handleConfirm} disabled={saving}
                className="btn-primary flex items-center gap-2">
                {saving ? <><Spinner size={14} /> Guardando…</> : <><Save size={14} /> Confirmar y guardar gasto</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
