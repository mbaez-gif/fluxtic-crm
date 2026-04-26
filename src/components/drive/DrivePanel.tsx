'use client'

import { useState, useEffect } from 'react'
import { db }  from '@/lib/firebase/config'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import type { DriveFile } from '@/types/whatsapp'
import { cn }  from '@/lib/utils'
import {
  HardDrive, FolderPlus, ExternalLink, File,
  FileText, Image, Loader2, RefreshCw,
} from 'lucide-react'

interface Props {
  clienteId:    string
  clienteNombre: string
  userId:       string
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/'))         return <Image size={14} className="text-blue-400" />
  if (mimeType.includes('pdf'))              return <FileText size={14} className="text-red-400" />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileText size={14} className="text-green-400" />
  if (mimeType.includes('document') || mimeType.includes('word'))     return <FileText size={14} className="text-blue-400" />
  if (mimeType.includes('folder'))           return <HardDrive size={14} className="text-amber-400" />
  return <File size={14} className="text-flux-text3" />
}

function formatSize(bytes?: string): string {
  if (!bytes) return ''
  const n = parseInt(bytes)
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function DrivePanel({ clienteId, clienteNombre, userId }: Props) {
  const [folderId,   setFolderId]   = useState<string | null>(null)
  const [folderLink, setFolderLink] = useState<string | null>(null)
  const [files,      setFiles]      = useState<DriveFile[]>([])
  const [loading,    setLoading]    = useState(true)
  const [creating,   setCreating]   = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Load existing folder from cliente doc
  useEffect(() => {
    getDoc(doc(db, 'clientes', clienteId)).then(snap => {
      const data = snap.data()
      if (data?.driveFolderId) {
        setFolderId(data.driveFolderId)
        setFolderLink(data.driveFolderLink ?? null)
      }
      setLoading(false)
    })
  }, [clienteId])

  async function getTokens() {
    const snap = await getDoc(doc(db, 'googleTokens', userId))
    if (!snap.exists()) return null
    return snap.data()
  }

  async function loadFiles(id: string) {
    const tokens = await getTokens()
    if (!tokens) return
    const res = await fetch('/api/drive/list', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date:   tokens.expiry_date,
        folderId:      id,
      }),
    })
    const data = await res.json()
    if (data.success) setFiles(data.files ?? [])
  }

  useEffect(() => {
    if (folderId) loadFiles(folderId)
  }, [folderId])

  async function handleCreateFolder() {
    setCreating(true)
    try {
      const tokens = await getTokens()
      if (!tokens) { alert('Conectá Google primero en Integraciones'); return }

      const res = await fetch('/api/drive/create-folder', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date:   tokens.expiry_date,
          clienteNombre,
          clienteId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setFolderId(data.folderId)
        setFolderLink(data.webViewLink)
        // Save to cliente doc
        await updateDoc(doc(db, 'clientes', clienteId), {
          driveFolderId:  data.folderId,
          driveFolderLink: data.webViewLink,
          actualizadoEn:  serverTimestamp(),
        })
        loadFiles(data.folderId)
      } else {
        alert(data.error ?? 'Error creando carpeta')
      }
    } finally { setCreating(false) }
  }

  async function handleRefresh() {
    if (!folderId) return
    setRefreshing(true)
    await loadFiles(folderId)
    setRefreshing(false)
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-flux-text3 text-sm py-4">
      <Loader2 size={14} className="animate-spin" /> Cargando Drive…
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-flux-text1 flex items-center gap-2">
          <HardDrive size={14} className="text-flux-text3" /> Google Drive
        </h3>
        <div className="flex gap-2">
          {folderId && (
            <>
              <button onClick={handleRefresh} disabled={refreshing}
                className="btn-ghost p-1.5 text-flux-text3">
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <a href={folderLink ?? '#'} target="_blank" rel="noopener noreferrer"
                className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                <ExternalLink size={12} /> Abrir en Drive
              </a>
            </>
          )}
        </div>
      </div>

      {!folderId ? (
        <div className="flex flex-col items-center gap-3 py-6 border border-dashed border-flux-border rounded-xl">
          <HardDrive size={28} className="text-flux-text3 opacity-40" />
          <div className="text-center">
            <p className="text-sm text-flux-text2">Sin carpeta en Drive</p>
            <p className="text-2xs text-flux-text3 mt-1">Se creará con subcarpetas: Propuestas, Contratos, Facturas, Recursos</p>
          </div>
          <button onClick={handleCreateFolder} disabled={creating}
            className="btn-primary flex items-center gap-2 text-sm">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
            Crear carpeta en Drive
          </button>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-4 text-flux-text3 text-xs">
          Carpeta vacía — subí archivos directamente desde Google Drive
        </div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {files.map(f => (
            <a key={f.id} href={f.webViewLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-flux-muted transition-colors group">
              <FileIcon mimeType={f.mimeType} />
              <p className="flex-1 text-xs text-flux-text2 truncate group-hover:text-flux-text1">{f.name}</p>
              {f.size && <p className="text-2xs text-flux-text3 shrink-0">{formatSize(f.size)}</p>}
              <ExternalLink size={10} className="text-flux-text3 shrink-0 opacity-0 group-hover:opacity-100" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
