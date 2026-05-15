'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader }     from '@/components/layout/PageHeader'
import { Spinner }        from '@/components/ui'
import { useRequireSuperAdmin } from '@/lib/hooks/useRequireSuperAdmin'
import { provisioningApi }   from '@/lib/provisioning/client'
import { suggestSlug, validateSlugFormat, validateDomainFormat, validateEmail, validateHexColor, RESERVED_SLUGS }
  from '@/lib/provisioning/validators'
import { WizardProgress, WizardFooter, WizardSection, Field, inputClass } from '@/components/provisioning/WizardShell'
import { StatusBadge } from '@/components/provisioning/StatusBadge'
import type {
  ProductMetadata, ProductType, DeploymentMode,
  IntegrationType, CreateClientPayload, CreateClientResponse,
} from '@/types/provisioning'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, CheckCircle2, Copy, Check,
} from 'lucide-react'

const STEPS = [
  { id: 1,  label: 'Cliente' },
  { id: 2,  label: 'Producto' },
  { id: 3,  label: 'Dominios' },
  { id: 4,  label: 'Infraestructura' },
  { id: 5,  label: 'Branding' },
  { id: 6,  label: 'Usuarios' },
  { id: 7,  label: 'Integraciones' },
  { id: 8,  label: 'Automatizaciones' },
  { id: 9,  label: 'Resumen' },
  { id: 10, label: 'Instalación' },
]

const INTEGRATIONS: { value: IntegrationType; label: string; description: string }[] = [
  { value: 'whatsapp_meta',    label: 'WhatsApp Cloud (Meta)',  description: 'Mensajes vía Meta Business' },
  { value: 'whatsapp_twilio',  label: 'WhatsApp Twilio',         description: 'Mensajes vía Twilio API' },
  { value: 'mercadopago',      label: 'Mercado Pago',            description: 'Cobros online' },
  { value: 'smtp',             label: 'SMTP (Email)',            description: 'Envío de mails transaccionales' },
  { value: 'google_calendar',  label: 'Google Calendar',         description: 'Sincronización de turnos' },
  { value: 'n8n',              label: 'n8n',                     description: 'Instancia dedicada (recomendado)' },
  { value: 'webhooks_internos',label: 'Webhooks internos',       description: 'Disparadores entre módulos' },
]

interface FormState {
  // Paso 1
  name: string; legalName: string; cuit: string
  contactEmail: string; contactPhone: string
  responsable: string; rubro: string; observaciones: string
  slug: string; slugTouched: boolean
  // Paso 2
  productType: ProductType | ''
  // Paso 3
  crmDomain: string; n8nDomain: string; apiDomain: string
  isSubdomainFluxtic: boolean
  // Paso 4
  mode: DeploymentMode
  createOwnDatabase: boolean
  createOwnN8n: boolean
  createBackupFolder: boolean
  // Paso 5
  displayName: string
  primaryColor: string; secondaryColor: string
  loginText: string; senderName: string
  supportEmail: string; supportWhatsapp: string
  // Paso 6
  adminEmail: string; adminName: string
  forcePasswordChange: boolean
  createDemoUsers: boolean
  // Paso 7
  integrations: IntegrationType[]
  // Paso 8
  workflowDefault: 'pausado' | 'pendiente_credenciales'
}

const INITIAL: FormState = {
  name: '', legalName: '', cuit: '',
  contactEmail: '', contactPhone: '',
  responsable: '', rubro: '', observaciones: '',
  slug: '', slugTouched: false,
  productType: '',
  crmDomain: '', n8nDomain: '', apiDomain: '',
  isSubdomainFluxtic: true,
  mode: 'produccion',
  createOwnDatabase: true,
  createOwnN8n: true,
  createBackupFolder: true,
  displayName: '',
  primaryColor: '#1F4E5F',
  secondaryColor: '#2BB673',
  loginText: '',
  senderName: '',
  supportEmail: '',
  supportWhatsapp: '',
  adminEmail: '',
  adminName: '',
  forcePasswordChange: true,
  createDemoUsers: false,
  integrations: ['n8n', 'webhooks_internos'],
  workflowDefault: 'pausado',
}

export default function NuevoClientePage() {
  const router = useRouter()
  const { ready } = useRequireSuperAdmin()
  const [step,    setStep]    = useState(1)
  const [visited, setVisited] = useState<Set<number>>(new Set([1]))
  const [form,    setForm]    = useState<FormState>(INITIAL)
  const [products, setProducts] = useState<ProductMetadata[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [slugCheck, setSlugCheck] = useState<{ checking: boolean; available?: boolean; reason?: string }>({ checking: false })
  const [crmCheck,  setCrmCheck]  = useState<{ checking: boolean; available?: boolean; reason?: string }>({ checking: false })
  const [n8nCheck,  setN8nCheck]  = useState<{ checking: boolean; available?: boolean; reason?: string }>({ checking: false })
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState<CreateClientResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    setProductsLoading(true)
    provisioningApi.listProducts()
      .then(setProducts)
      .catch(e => setSubmitError(e.message))
      .finally(() => setProductsLoading(false))
  }, [ready])

  // Auto-sugerir slug y subdominios
  useEffect(() => {
    setForm(f => {
      if (f.slugTouched) return f
      const s = suggestSlug(f.name)
      return { ...f, slug: s }
    })
  }, [form.name])

  useEffect(() => {
    if (!form.isSubdomainFluxtic) return
    if (!form.slug) return
    setForm(f => ({
      ...f,
      crmDomain: `crm-${form.slug}.fluxtic.com`,
      n8nDomain: `n8n-${form.slug}.fluxtic.com`,
      apiDomain: `api-${form.slug}.fluxtic.com`,
    }))
  }, [form.slug, form.isSubdomainFluxtic])

  // Cuando se elige producto, prefill branding displayName
  useEffect(() => {
    if (!form.productType) return
    if (form.displayName) return
    setForm(f => ({ ...f, displayName: form.name || products.find(p => p.productType === form.productType)?.name || '' }))
  }, [form.productType, form.name, products, form.displayName])

  // Slug check (debounced)
  useEffect(() => {
    if (!ready) return
    const format = validateSlugFormat(form.slug)
    if (!format.ok) { setSlugCheck({ checking: false, available: false, reason: format.reason }); return }
    setSlugCheck({ checking: true })
    const t = setTimeout(() => {
      provisioningApi.validateSlug(form.slug)
        .then(r => setSlugCheck({ checking: false, ...r }))
        .catch(e => setSlugCheck({ checking: false, available: false, reason: e.message }))
    }, 400)
    return () => clearTimeout(t)
  }, [form.slug, ready])

  // CRM domain check
  useEffect(() => {
    if (!ready || step !== 3) return
    const fmt = validateDomainFormat(form.crmDomain)
    if (!fmt.ok) { setCrmCheck({ checking: false, available: false, reason: fmt.reason }); return }
    setCrmCheck({ checking: true })
    const t = setTimeout(() => {
      provisioningApi.validateDomain(form.crmDomain)
        .then(r => setCrmCheck({ checking: false, ...r }))
        .catch(e => setCrmCheck({ checking: false, available: false, reason: e.message }))
    }, 400)
    return () => clearTimeout(t)
  }, [form.crmDomain, ready, step])

  // n8n domain check
  useEffect(() => {
    if (!ready || step !== 3) return
    const fmt = validateDomainFormat(form.n8nDomain)
    if (!fmt.ok) { setN8nCheck({ checking: false, available: false, reason: fmt.reason }); return }
    setN8nCheck({ checking: true })
    const t = setTimeout(() => {
      provisioningApi.validateDomain(form.n8nDomain)
        .then(r => setN8nCheck({ checking: false, ...r }))
        .catch(e => setN8nCheck({ checking: false, available: false, reason: e.message }))
    }, 400)
    return () => clearTimeout(t)
  }, [form.n8nDomain, ready, step])

  const selectedProduct = useMemo(
    () => products.find(p => p.productType === form.productType) ?? null,
    [products, form.productType]
  )

  // ── Step validators ────────────────────────────────────
  function canAdvance(s: number): boolean {
    switch (s) {
      case 1:
        return !!form.name?.trim()
          && !!form.contactEmail && validateEmail(form.contactEmail).ok
          && slugCheck.available === true
      case 2: return !!form.productType
      case 3:
        return crmCheck.available === true && n8nCheck.available === true
      case 4: return true
      case 5:
        return !!form.displayName.trim()
          && validateHexColor(form.primaryColor).ok
          && validateHexColor(form.secondaryColor).ok
      case 6:
        return !!form.adminEmail && validateEmail(form.adminEmail).ok && !!form.adminName.trim()
      case 7: return true
      case 8: return true
      case 9: return true
      default: return false
    }
  }

  function goNext() {
    if (step === 9) {
      void submit()
      return
    }
    const next = step + 1
    setStep(next)
    setVisited(v => new Set([...Array.from(v), next]))
  }

  function goBack() {
    if (step <= 1 || step === 10) return
    setStep(step - 1)
  }

  async function submit() {
    if (!selectedProduct) return
    setSubmitting(true)
    setSubmitError(null)
    const payload: CreateClientPayload = {
      client: {
        name:          form.name,
        legalName:     form.legalName || undefined,
        cuit:          form.cuit || undefined,
        contactEmail:  form.contactEmail,
        contactPhone:  form.contactPhone || undefined,
        responsable:   form.responsable || undefined,
        rubro:         form.rubro || undefined,
        observaciones: form.observaciones || undefined,
        slug:          form.slug,
      },
      product: { productType: form.productType as ProductType },
      domains: {
        crmDomain:          form.crmDomain,
        n8nDomain:          form.n8nDomain,
        apiDomain:          form.apiDomain || undefined,
        isSubdomainFluxtic: form.isSubdomainFluxtic,
      },
      infra: {
        mode:               form.mode,
        createOwnDatabase:  form.createOwnDatabase,
        createOwnN8n:       form.createOwnN8n,
        createBackupFolder: form.createBackupFolder,
      },
      branding: {
        displayName:     form.displayName,
        primaryColor:    form.primaryColor,
        secondaryColor:  form.secondaryColor,
        loginText:       form.loginText || undefined,
        senderName:      form.senderName || undefined,
        supportEmail:    form.supportEmail || undefined,
        supportWhatsapp: form.supportWhatsapp || undefined,
      },
      users: {
        adminEmail:          form.adminEmail,
        adminName:           form.adminName,
        forcePasswordChange: form.forcePasswordChange,
        createDemoUsers:     form.createDemoUsers,
      },
      integrations: { enabled: form.integrations },
      workflows:    { defaultStatus: form.workflowDefault },
    }

    try {
      const res = await provisioningApi.createClient(payload)
      setResult(res)
      setStep(10)
      setVisited(v => new Set([...Array.from(v), 10]))
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={24} /></div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Nuevo cliente Fluxtic"
        subtitle="Provisionamiento de instancia vertical"
      />
      <WizardProgress steps={STEPS} current={step} visited={visited} />

      {step === 1 && <Step1Cliente form={form} setForm={setForm} slugCheck={slugCheck} />}
      {step === 2 && <Step2Producto form={form} setForm={setForm} products={products} loading={productsLoading} />}
      {step === 3 && <Step3Dominios form={form} setForm={setForm} crmCheck={crmCheck} n8nCheck={n8nCheck} />}
      {step === 4 && <Step4Infra form={form} setForm={setForm} />}
      {step === 5 && <Step5Branding form={form} setForm={setForm} />}
      {step === 6 && <Step6Usuarios form={form} setForm={setForm} product={selectedProduct} />}
      {step === 7 && <Step7Integraciones form={form} setForm={setForm} />}
      {step === 8 && <Step8Automatizaciones form={form} setForm={setForm} product={selectedProduct} />}
      {step === 9 && <Step9Resumen form={form} product={selectedProduct} />}
      {step === 10 && <Step10Instalacion result={result} error={submitError} onGoToClient={() => result && router.push(`/plataforma/clientes/${result.clientId}`)} />}

      {step < 10 && (
        <WizardFooter
          step={step}
          total={STEPS.length}
          canNext={canAdvance(step)}
          loading={submitting && step === 9}
          onBack={goBack}
          onNext={goNext}
          nextLabel={step === 9 ? 'Crear cliente' : 'Siguiente'}
        />
      )}
      {submitError && step !== 10 && (
        <div className="mx-4 md:mx-8 mb-4 p-3 rounded-lg border border-flux-danger/40 bg-flux-danger/10 text-xs text-flux-danger flex items-center gap-2">
          <AlertTriangle size={14} /> {submitError}
        </div>
      )}
    </div>
  )
}

// ── Steps ────────────────────────────────────────────────

function Step1Cliente({ form, setForm, slugCheck }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  slugCheck: { checking: boolean; available?: boolean; reason?: string }
}) {
  return (
    <WizardSection title="Datos del cliente" subtitle="Información comercial y de contacto principal.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre comercial">
          <input className={inputClass()} placeholder="Clínica San Martín"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Razón social (opcional)">
          <input className={inputClass()} placeholder="San Martín Salud S.A."
            value={form.legalName}
            onChange={e => setForm(f => ({ ...f, legalName: e.target.value }))} />
        </Field>
        <Field label="CUIT (opcional)">
          <input className={inputClass()} placeholder="30-12345678-9"
            value={form.cuit}
            onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} />
        </Field>
        <Field label="Rubro">
          <input className={inputClass()} placeholder="Salud / Estética / Gastronomía"
            value={form.rubro}
            onChange={e => setForm(f => ({ ...f, rubro: e.target.value }))} />
        </Field>
        <Field label="Email principal">
          <input className={inputClass()} type="email" placeholder="contacto@cliente.com"
            value={form.contactEmail}
            onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
        </Field>
        <Field label="Teléfono">
          <input className={inputClass()} placeholder="+54 9 11 ..."
            value={form.contactPhone}
            onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
        </Field>
        <Field label="Responsable interno (Fluxtic)">
          <input className={inputClass()} placeholder="Nombre del PM asignado"
            value={form.responsable}
            onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} />
        </Field>
        <Field label="Slug"
          hint={`Sugerido automático. Reservados: ${Array.from(RESERVED_SLUGS).slice(0,5).join(', ')}…`}
          error={
            slugCheck.checking ? null
            : slugCheck.available === false ? slugCheck.reason ?? 'No disponible'
            : null
          }>
          <div className="flex items-center gap-2">
            <input className={cn(inputClass(),
              slugCheck.available === true && 'border-flux-success/60',
              slugCheck.available === false && 'border-flux-danger/60',
            )}
              placeholder="clinica-san-martin"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''), slugTouched: true }))} />
            {slugCheck.checking
              ? <Spinner size={14} />
              : slugCheck.available === true
                ? <CheckCircle2 size={16} className="text-flux-success" />
                : slugCheck.available === false
                  ? <AlertTriangle size={16} className="text-flux-danger" />
                  : null}
          </div>
        </Field>
      </div>
      <Field label="Observaciones internas (opcional)">
        <textarea className={inputClass('min-h-[80px]')}
          value={form.observaciones}
          onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
      </Field>
    </WizardSection>
  )
}

function Step2Producto({ form, setForm, products, loading }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  products: ProductMetadata[]
  loading:  boolean
}) {
  if (loading) return (
    <WizardSection title="Tipo de producto"><div className="flex justify-center py-12"><Spinner size={20}/></div></WizardSection>
  )
  return (
    <WizardSection title="Tipo de producto" subtitle="Elegí la base que se va a desplegar. Las plantillas, roles y workflows quedan precargados.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {products.map(p => (
          <button key={p.productType} type="button"
            onClick={() => setForm(f => ({ ...f, productType: p.productType }))}
            className={cn(
              'text-left p-4 rounded-xl border transition-all',
              form.productType === p.productType
                ? 'border-flux-teal bg-flux-tealGlow'
                : 'border-flux-border hover:border-flux-subtle bg-flux-surface'
            )}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base text-flux-white">{p.name}</h3>
              <span className="text-2xs text-flux-text3">v{p.version}</span>
            </div>
            <p className="text-xs text-flux-text2 mt-1">{p.description}</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {p.modules.slice(0, 6).map(m => (
                <span key={m} className="text-2xs px-2 py-0.5 rounded-full bg-flux-muted text-flux-text2">{m}</span>
              ))}
              {p.modules.length > 6 && <span className="text-2xs text-flux-text3">+{p.modules.length - 6}</span>}
            </div>
          </button>
        ))}
      </div>
    </WizardSection>
  )
}

function Step3Dominios({ form, setForm, crmCheck, n8nCheck }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  crmCheck: { checking: boolean; available?: boolean; reason?: string }
  n8nCheck: { checking: boolean; available?: boolean; reason?: string }
}) {
  return (
    <WizardSection title="Dominios" subtitle="Configurá cómo va a accederse al CRM, n8n y la API del cliente.">
      <div className="flex gap-2 mb-3">
        <button type="button"
          onClick={() => setForm(f => ({ ...f, isSubdomainFluxtic: true }))}
          className={cn('px-3 py-1.5 rounded-lg text-xs border',
            form.isSubdomainFluxtic ? 'border-flux-teal text-flux-teal bg-flux-tealGlow' : 'border-flux-border text-flux-text2')}>
          Subdominio fluxtic.com (automático)
        </button>
        <button type="button"
          onClick={() => setForm(f => ({ ...f, isSubdomainFluxtic: false }))}
          className={cn('px-3 py-1.5 rounded-lg text-xs border',
            !form.isSubdomainFluxtic ? 'border-flux-teal text-flux-teal bg-flux-tealGlow' : 'border-flux-border text-flux-text2')}>
          Dominio propio del cliente
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Dominio CRM"
          error={crmCheck.available === false ? crmCheck.reason ?? null : null}
          hint={!form.isSubdomainFluxtic ? 'Si el DNS aún no apunta al servidor, mostraremos un aviso después de crear.' : undefined}>
          <div className="flex items-center gap-2">
            <input className={inputClass()}
              value={form.crmDomain}
              disabled={form.isSubdomainFluxtic}
              onChange={e => setForm(f => ({ ...f, crmDomain: e.target.value.trim().toLowerCase() }))} />
            {crmCheck.checking ? <Spinner size={14}/> :
              crmCheck.available === true ? <CheckCircle2 size={16} className="text-flux-success"/> :
              crmCheck.available === false ? <AlertTriangle size={16} className="text-flux-danger"/> : null}
          </div>
        </Field>
        <Field label="Dominio n8n"
          error={n8nCheck.available === false ? n8nCheck.reason ?? null : null}>
          <div className="flex items-center gap-2">
            <input className={inputClass()}
              value={form.n8nDomain}
              disabled={form.isSubdomainFluxtic}
              onChange={e => setForm(f => ({ ...f, n8nDomain: e.target.value.trim().toLowerCase() }))} />
            {n8nCheck.checking ? <Spinner size={14}/> :
              n8nCheck.available === true ? <CheckCircle2 size={16} className="text-flux-success"/> :
              n8nCheck.available === false ? <AlertTriangle size={16} className="text-flux-danger"/> : null}
          </div>
        </Field>
        <Field label="Dominio API (opcional)">
          <input className={inputClass()}
            value={form.apiDomain}
            disabled={form.isSubdomainFluxtic}
            onChange={e => setForm(f => ({ ...f, apiDomain: e.target.value.trim().toLowerCase() }))} />
        </Field>
      </div>
    </WizardSection>
  )
}

function Step4Infra({ form, setForm }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
}) {
  return (
    <WizardSection title="Infraestructura" subtitle="Decisiones por defecto del stack del cliente.">
      <div className="flex gap-2 mb-4">
        {(['demo', 'produccion'] as DeploymentMode[]).map(m => (
          <button key={m} type="button"
            onClick={() => setForm(f => ({ ...f, mode: m }))}
            className={cn('px-3 py-1.5 rounded-lg text-xs border capitalize',
              form.mode === m ? 'border-flux-teal text-flux-teal bg-flux-tealGlow' : 'border-flux-border text-flux-text2')}>
            {m === 'demo' ? 'Modo Demo' : 'Modo Producción'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle label="Base PostgreSQL propia"
          description="Cada cliente con su Postgres dedicado (recomendado)."
          checked={form.createOwnDatabase}
          onChange={v => setForm(f => ({ ...f, createOwnDatabase: v }))} />
        <Toggle label="Instancia n8n propia"
          description="n8n dedicado por cliente con sus workflows y credenciales."
          checked={form.createOwnN8n}
          onChange={v => setForm(f => ({ ...f, createOwnN8n: v }))} />
        <Toggle label="Carpeta de backups"
          description={form.mode === 'produccion'
            ? 'Backups diarios automáticos (V3) o por SSH en V1.'
            : 'En modo demo no se recomienda activar backups.'}
          checked={form.createBackupFolder}
          onChange={v => setForm(f => ({ ...f, createBackupFolder: v }))} />
      </div>
      <div className="mt-4 p-3 rounded-lg bg-flux-surface border border-flux-border text-xs text-flux-text2">
        <p className="font-medium text-flux-text1 mb-1">Resumen del modo seleccionado</p>
        {form.mode === 'demo' ? (
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Recursos mínimos, datos de ejemplo</li>
            <li>Usuarios demo</li>
            <li>Workflows pausados</li>
          </ul>
        ) : (
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Contraseñas fuertes</li>
            <li>Backups activos</li>
            <li>Workflows preparados (pendientes de credenciales)</li>
            <li>Sin datos ficticios salvo el admin</li>
            <li>Logs y auditoría activos</li>
          </ul>
        )}
      </div>
    </WizardSection>
  )
}

function Step5Branding({ form, setForm }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
}) {
  return (
    <WizardSection title="Branding" subtitle="Apariencia inicial del CRM del cliente.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre visible del sistema">
          <input className={inputClass()} value={form.displayName}
            onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
        </Field>
        <Field label="Color principal" hint="Hex, p.ej. #1F4E5F">
          <ColorInput value={form.primaryColor} onChange={v => setForm(f => ({ ...f, primaryColor: v }))} />
        </Field>
        <Field label="Color secundario" hint="Hex, p.ej. #2BB673">
          <ColorInput value={form.secondaryColor} onChange={v => setForm(f => ({ ...f, secondaryColor: v }))} />
        </Field>
        <Field label="Email de soporte">
          <input className={inputClass()} value={form.supportEmail}
            onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))} />
        </Field>
        <Field label="WhatsApp de soporte">
          <input className={inputClass()} value={form.supportWhatsapp}
            onChange={e => setForm(f => ({ ...f, supportWhatsapp: e.target.value }))} />
        </Field>
        <Field label="Nombre del remitente (emails)">
          <input className={inputClass()} value={form.senderName}
            onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))} />
        </Field>
      </div>
      <Field label="Texto del login (opcional)">
        <textarea className={inputClass('min-h-[60px]')} value={form.loginText}
          onChange={e => setForm(f => ({ ...f, loginText: e.target.value }))} />
      </Field>
    </WizardSection>
  )
}

function Step6Usuarios({ form, setForm, product }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  product: ProductMetadata | null
}) {
  return (
    <WizardSection title="Usuarios iniciales" subtitle="Admin principal y, opcionalmente, usuarios demo del producto.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre del admin">
          <input className={inputClass()} value={form.adminName}
            onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))} />
        </Field>
        <Field label="Email del admin">
          <input className={inputClass()} type="email" placeholder="admin@cliente.com"
            value={form.adminEmail}
            onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))} />
        </Field>
      </div>
      <Toggle label="Forzar cambio de contraseña en primer login"
        checked={form.forcePasswordChange}
        onChange={v => setForm(f => ({ ...f, forcePasswordChange: v }))} />
      <Toggle label={`Crear usuarios demo del producto${product ? ` (${product.demoUsers.length})` : ''}`}
        description={product ? product.demoUsers.map(u => u.email).join(', ') : ''}
        checked={form.createDemoUsers}
        onChange={v => setForm(f => ({ ...f, createDemoUsers: v }))} />
      {product && (
        <div className="mt-3 p-3 rounded-lg bg-flux-surface border border-flux-border text-xs text-flux-text2">
          <p className="font-medium text-flux-text1 mb-1">Roles del producto</p>
          <div className="flex flex-wrap gap-1.5">
            {product.roles.map(r => (
              <span key={r} className="px-2 py-0.5 rounded-full bg-flux-muted text-flux-text2">{r}</span>
            ))}
          </div>
        </div>
      )}
    </WizardSection>
  )
}

function Step7Integraciones({ form, setForm }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
}) {
  function toggle(t: IntegrationType) {
    setForm(f => f.integrations.includes(t)
      ? { ...f, integrations: f.integrations.filter(x => x !== t) }
      : { ...f, integrations: [...f.integrations, t] })
  }
  return (
    <WizardSection title="Integraciones iniciales" subtitle="Quedarán marcadas como “pendiente de credenciales” hasta que el equipo de Fluxtic las configure.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {INTEGRATIONS.map(i => {
          const on = form.integrations.includes(i.value)
          return (
            <button key={i.value} type="button"
              onClick={() => toggle(i.value)}
              className={cn('text-left p-3 rounded-xl border transition-all',
                on ? 'border-flux-teal bg-flux-tealGlow' : 'border-flux-border hover:border-flux-subtle bg-flux-surface')}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-flux-white">{i.label}</span>
                <span className={cn('w-4 h-4 rounded border', on ? 'bg-flux-teal border-flux-teal' : 'border-flux-subtle')}>
                  {on && <Check size={12} className="text-[#0a0d12]" />}
                </span>
              </div>
              <p className="text-2xs text-flux-text3 mt-1">{i.description}</p>
            </button>
          )
        })}
      </div>
    </WizardSection>
  )
}

function Step8Automatizaciones({ form, setForm, product }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  product: ProductMetadata | null
}) {
  if (!product) return null
  return (
    <WizardSection title="Automatizaciones n8n" subtitle="Workflows del producto. Por defecto quedan pausados hasta tener credenciales.">
      <div className="flex gap-2 mb-3">
        {(['pausado', 'pendiente_credenciales'] as const).map(s => (
          <button key={s} type="button"
            onClick={() => setForm(f => ({ ...f, workflowDefault: s }))}
            className={cn('px-3 py-1.5 rounded-lg text-xs border',
              form.workflowDefault === s ? 'border-flux-teal text-flux-teal bg-flux-tealGlow' : 'border-flux-border text-flux-text2')}>
            {s === 'pausado' ? 'Iniciar pausados' : 'Pendiente credenciales'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {product.workflows.map(w => (
          <div key={w} className="p-2.5 rounded-lg bg-flux-surface border border-flux-border flex items-center justify-between">
            <span className="text-xs text-flux-text1">{w.replace(/_/g, ' ')}</span>
            <StatusBadge status={form.workflowDefault} />
          </div>
        ))}
        {product.workflows.length === 0 && (
          <p className="text-xs text-flux-text3">Este producto no trae workflows pre-armados.</p>
        )}
      </div>
    </WizardSection>
  )
}

function Step9Resumen({ form, product }: { form: FormState; product: ProductMetadata | null }) {
  if (!product) return null
  return (
    <WizardSection title="Resumen" subtitle="Revisá antes de crear. Al confirmar se genera el job de provisionamiento.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <Summary label="Cliente"
          rows={[
            ['Nombre',       form.name],
            ['Razón social', form.legalName || '—'],
            ['Slug',         form.slug],
            ['Email',        form.contactEmail],
            ['Rubro',        form.rubro || '—'],
          ]} />
        <Summary label="Producto"
          rows={[
            ['Tipo',     product.name],
            ['Versión',  product.version],
            ['Modo',     form.mode],
            ['Módulos',  product.modules.length],
            ['Roles',    product.roles.length],
          ]} />
        <Summary label="Dominios"
          rows={[
            ['CRM', form.crmDomain],
            ['n8n', form.n8nDomain],
            ['API', form.apiDomain || `api-${form.slug}.fluxtic.com`],
          ]} />
        <Summary label="Infraestructura"
          rows={[
            ['Postgres propio', form.createOwnDatabase ? 'sí' : 'no'],
            ['n8n propio',      form.createOwnN8n ? 'sí' : 'no'],
            ['Backups',         form.createBackupFolder ? 'sí' : 'no'],
          ]} />
        <Summary label="Branding"
          rows={[
            ['Nombre visible', form.displayName],
            ['Color primario', form.primaryColor],
            ['Color secundario', form.secondaryColor],
          ]} />
        <Summary label="Usuarios"
          rows={[
            ['Admin', `${form.adminName} <${form.adminEmail}>`],
            ['Force change', form.forcePasswordChange ? 'sí' : 'no'],
            ['Demo users', form.createDemoUsers ? `sí (${product.demoUsers.length})` : 'no'],
          ]} />
        <Summary label="Integraciones"
          rows={[
            ['Habilitadas', form.integrations.length || 0],
            ['Detalle',     form.integrations.join(', ') || '—'],
          ]} />
        <Summary label="Workflows"
          rows={[
            ['Cantidad', product.workflows.length],
            ['Estado inicial', form.workflowDefault],
          ]} />
      </div>
    </WizardSection>
  )
}

function Step10Instalacion({ result, error, onGoToClient }: {
  result: CreateClientResponse | null
  error:  string | null
  onGoToClient: () => void
}) {
  return (
    <WizardSection title="Instalación" subtitle={result ? 'Cliente creado. Seguí los pasos manuales para levantar el stack.' : 'Procesando…'}>
      {error && (
        <div className="p-3 rounded-lg border border-flux-danger/40 bg-flux-danger/10 text-xs text-flux-danger">
          <AlertTriangle size={14} className="inline mr-1" /> {error}
        </div>
      )}
      {!result && !error && (
        <div className="flex items-center justify-center py-12"><Spinner size={20} /></div>
      )}
      {result && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl border border-flux-success/40 bg-flux-success/10 text-flux-success text-sm flex items-center gap-2">
            <CheckCircle2 size={18} /> Cliente creado. Job <code className="text-xs">{result.jobId}</code>
          </div>

          <div className="p-4 rounded-xl border border-flux-warning/40 bg-flux-warning/10">
            <p className="text-sm font-medium text-flux-warning mb-2">Credenciales — se muestran UNA sola vez</p>
            <Reveal label="Email admin"          value={result.revealOnce.adminEmail} />
            <Reveal label="Password admin"       value={result.revealOnce.adminPassword} mono />
            <Reveal label="Password Postgres"    value={result.revealOnce.postgresPassword} mono />
            <Reveal label="Password n8n"         value={result.revealOnce.n8nBasicAuthPass} mono />
            <Reveal label="N8N_ENCRYPTION_KEY"   value={result.revealOnce.n8nEncryptionKey} mono />
          </div>

          <div className="p-4 rounded-xl border border-flux-border bg-flux-surface">
            <p className="text-sm font-medium text-flux-text1 mb-2">Pasos manuales para levantar el stack</p>
            <pre className="text-2xs leading-relaxed text-flux-text2 overflow-x-auto font-mono whitespace-pre-wrap">
              {result.manualSshCommands.join('\n')}
            </pre>
          </div>

          <div className="flex gap-2">
            <button onClick={onGoToClient}
              className="px-4 py-2 rounded-lg bg-flux-teal text-[#0a0d12] text-sm font-medium hover:bg-flux-tealDim">
              Ir al detalle del cliente
            </button>
            <a href={`/api/provisioning/clients/${result.clientId}/files`} target="_blank"
              className="px-4 py-2 rounded-lg border border-flux-border text-flux-text2 text-sm hover:bg-white/5">
              Ver archivos generados (.env + compose)
            </a>
          </div>
        </div>
      )}
    </WizardSection>
  )
}

// ── helpers ─────────────────────────────────────────────
function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn('flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
        checked ? 'border-flux-teal bg-flux-tealGlow' : 'border-flux-border bg-flux-surface hover:border-flux-subtle')}>
      <span className={cn('mt-0.5 w-4 h-4 rounded border flex items-center justify-center',
        checked ? 'bg-flux-teal border-flux-teal' : 'border-flux-subtle')}>
        {checked && <Check size={11} className="text-[#0a0d12]" />}
      </span>
      <span className="min-w-0">
        <span className="text-sm text-flux-white block">{label}</span>
        {description && <span className="text-2xs text-flux-text3 block mt-0.5">{description}</span>}
      </span>
    </button>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-10 h-9 rounded-lg border border-flux-border bg-flux-surface cursor-pointer"/>
      <input className={inputClass()} value={value}
        onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function Summary({ label, rows }: { label: string; rows: [string, React.ReactNode][] }) {
  return (
    <div className="p-3 rounded-xl border border-flux-border bg-flux-surface">
      <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-2">{label}</p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-flux-text3">{k}</dt>
            <dd className="text-flux-text1 truncate">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Reveal({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-2xs text-flux-text3">{label}</span>
      <div className="flex items-center gap-1">
        <code className={cn('text-xs text-flux-text1', mono && 'font-mono')}>{value}</code>
        <button onClick={() => navigator.clipboard.writeText(value)}
          className="text-flux-text3 hover:text-flux-text1 p-1 rounded" title="Copiar">
          <Copy size={12} />
        </button>
      </div>
    </div>
  )
}
