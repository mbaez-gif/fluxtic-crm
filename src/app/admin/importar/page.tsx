'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner }    from '@/components/ui'
import Link           from 'next/link'
import {
  Upload, ArrowLeft, CheckCircle, AlertTriangle,
  Play, FileJson, Users,
} from 'lucide-react'

// The leads data embedded directly — no file upload needed
// This gets replaced by the actual import data
const BATCH_SIZE = 400

interface ImportResult {
  batch:    number
  imported: number
  errors:   number
}

export default function ImportarPage() {
  const [file,      setFile]      = useState<File | null>(null)
  const [leads,     setLeads]     = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [results,   setResults]   = useState<ImportResult[]>([])
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState('')

  async function handleFileLoad(f: File) {
    setFile(f)
    setError('')
    try {
      const text = await f.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data)) throw new Error('El archivo debe ser un JSON array')
      setLeads(data)
    } catch (e) {
      setError('Archivo inválido. Debe ser el JSON generado por el script de importación.')
      setLeads([])
    }
  }

  async function handleImport() {
    if (leads.length === 0) return
    setImporting(true)
    setProgress(0)
    setResults([])
    setDone(false)
    setError('')

    const batches: any[][] = []
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      batches.push(leads.slice(i, i + BATCH_SIZE))
    }

    const allResults: ImportResult[] = []

    for (let i = 0; i < batches.length; i++) {
      try {
        const res  = await fetch('/api/admin/import-leads', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ leads: batches[i] }),
        })
        const data = await res.json()
        allResults.push({
          batch:    i + 1,
          imported: data.imported ?? 0,
          errors:   data.errors ?? 0,
        })
      } catch {
        allResults.push({ batch: i + 1, imported: 0, errors: batches[i].length })
      }
      setProgress(Math.round(((i + 1) / batches.length) * 100))
      setResults([...allResults])
    }

    setDone(true)
    setImporting(false)
  }

  const totalImported = results.reduce((a, r) => a + r.imported, 0)
  const totalErrors   = results.reduce((a, r) => a + r.errors, 0)
  const batches       = Math.ceil(leads.length / BATCH_SIZE)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Importación masiva de leads"
        subtitle="Importar comercios de Entre Ríos activos con email"
        actions={
          <Link href="/leads" className="btn-ghost flex items-center gap-2 text-sm">
            <ArrowLeft size={14} /> Volver a Leads
          </Link>
        }
      />

      <div className="px-8 pb-10 max-w-2xl space-y-6">

        {/* Info */}
        <div className="flux-card border-flux-teal/30 bg-flux-tealGlow/5 space-y-2">
          <p className="text-sm font-medium text-flux-teal flex items-center gap-2">
            <FileJson size={14} /> Instrucciones
          </p>
          <ol className="text-xs text-flux-text2 space-y-1 list-decimal list-inside leading-relaxed">
            <li>Descargá el archivo <code className="text-flux-teal">leads_import.json</code> que está en este mismo ZIP</li>
            <li>Subilo acá usando el área de carga</li>
            <li>Revisá el resumen y hacé clic en <strong>Iniciar importación</strong></li>
            <li>La importación corre en batches de {BATCH_SIZE} leads — no cierres la pestaña</li>
          </ol>
        </div>

        {/* File upload */}
        {!importing && !done && (
          <div
            className="border-2 border-dashed border-flux-border hover:border-flux-teal/50 rounded-2xl p-10 text-center cursor-pointer transition-all"
            onClick={() => document.getElementById('file-input')?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileLoad(f) }}
          >
            <input id="file-input" type="file" accept=".json" className="hidden"
              onChange={e => e.target.files?.[0] && handleFileLoad(e.target.files[0])} />

            {file ? (
              <div className="space-y-2">
                <FileJson size={32} className="text-flux-teal mx-auto" />
                <p className="font-medium text-flux-text1">{file.name}</p>
                <p className="text-sm text-flux-teal font-bold">{leads.length.toLocaleString()} leads cargados</p>
                <p className="text-2xs text-flux-text3">
                  Se importarán en {batches} batches de {BATCH_SIZE}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload size={32} className="text-flux-text3 mx-auto" />
                <p className="font-medium text-flux-text1">Arrastrá o hacé clic para cargar</p>
                <p className="text-sm text-flux-text3">Archivo leads_import.json</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-950/40 border border-red-800/40 rounded-xl text-sm text-red-300">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Summary before import */}
        {leads.length > 0 && !importing && !done && (
          <div className="flux-card space-y-4">
            <h2 className="text-sm font-medium text-flux-text1">Resumen de importación</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-flux-surface rounded-xl p-3">
                <p className="font-display text-2xl font-bold text-flux-teal">{leads.length.toLocaleString()}</p>
                <p className="text-2xs text-flux-text3">Leads a importar</p>
              </div>
              <div className="bg-flux-surface rounded-xl p-3">
                <p className="font-display text-2xl font-bold text-flux-white">{batches}</p>
                <p className="text-2xs text-flux-text3">Batches</p>
              </div>
              <div className="bg-flux-surface rounded-xl p-3">
                <p className="font-display text-2xl font-bold text-flux-white">~{Math.ceil(batches * 15)}s</p>
                <p className="text-2xs text-flux-text3">Tiempo estimado</p>
              </div>
            </div>
            <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl px-4 py-3 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              No cierres esta pestaña durante la importación. Si falla algún batch, podés reintentar desde el batch fallido.
            </div>
            <button onClick={handleImport}
              className="btn-primary w-full flex items-center justify-center gap-2">
              <Play size={14} /> Iniciar importación
            </button>
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div className="flux-card space-y-4">
            <div className="flex items-center gap-3">
              <Spinner size={18} />
              <p className="font-medium text-flux-text1">Importando… {progress}%</p>
            </div>
            <div className="w-full h-3 bg-flux-muted rounded-full overflow-hidden">
              <div className="h-full bg-flux-teal rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-flux-text3">
              <span>{totalImported.toLocaleString()} importados</span>
              {totalErrors > 0 && <span className="text-red-400">{totalErrors} errores</span>}
              <span>Batch {results.length} / {batches}</span>
            </div>
          </div>
        )}

        {/* Results */}
        {done && (
          <div className="flux-card space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={24} className="text-flux-teal" />
              <div>
                <p className="font-display font-bold text-lg text-flux-white">¡Importación completada!</p>
                <p className="text-sm text-flux-text3">
                  {totalImported.toLocaleString()} leads importados
                  {totalErrors > 0 && ` · ${totalErrors} errores`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-flux-tealGlow/20 border border-flux-teal/30 rounded-xl p-4 text-center">
                <p className="font-display text-3xl font-bold text-flux-teal">{totalImported.toLocaleString()}</p>
                <p className="text-xs text-flux-text3 mt-1">Leads importados</p>
              </div>
              {totalErrors > 0 && (
                <div className="bg-red-950/30 border border-red-800/30 rounded-xl p-4 text-center">
                  <p className="font-display text-3xl font-bold text-red-400">{totalErrors.toLocaleString()}</p>
                  <p className="text-xs text-flux-text3 mt-1">Errores</p>
                </div>
              )}
            </div>

            <Link href="/leads" className="btn-primary w-full flex items-center justify-center gap-2">
              <Users size={14} /> Ver leads importados
            </Link>
          </div>
        )}

        {/* Batch progress table */}
        {results.length > 0 && (
          <div className="flux-card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-flux-border">
                  {['Batch', 'Importados', 'Errores', 'Estado'].map(h => (
                    <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.batch} className="border-b border-flux-border/50">
                    <td className="px-4 py-2.5 text-flux-text2 text-xs">Batch {r.batch}</td>
                    <td className="px-4 py-2.5 font-medium text-flux-teal">{r.imported}</td>
                    <td className="px-4 py-2.5 text-xs text-red-400">{r.errors || '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.errors === 0
                        ? <CheckCircle size={14} className="text-flux-teal" />
                        : <AlertTriangle size={14} className="text-amber-400" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
