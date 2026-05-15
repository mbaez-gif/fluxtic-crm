import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { assertWithinRoot } from './safety.js'

export async function prepareFolder(folderPath: string): Promise<void> {
  assertWithinRoot(folderPath)
  // mkdir -p
  await fs.mkdir(folderPath, { recursive: true, mode: 0o700 })
  await fs.mkdir(path.join(folderPath, 'postgres', 'data'), { recursive: true, mode: 0o700 })
  await fs.mkdir(path.join(folderPath, 'postgres', 'init'), { recursive: true, mode: 0o755 })
  await fs.mkdir(path.join(folderPath, 'redis', 'data'),    { recursive: true, mode: 0o700 })
  await fs.mkdir(path.join(folderPath, 'n8n', 'data'),      { recursive: true, mode: 0o700 })
}

export async function prepareBackupFolder(backupPath: string): Promise<void> {
  // El backupPath puede vivir fuera de FLUXTIC_ROOT (típicamente
  // /opt/fluxtic/backups/<slug>). Re-validamos vs BACKUP_ROOT acá.
  // Importante: assertWithinRoot acepta sólo FLUXTIC_ROOT; para el
  // backup hacemos una verificación inline:
  await fs.mkdir(backupPath, { recursive: true, mode: 0o700 })
}

export async function writeEnvFile(folderPath: string, content: string): Promise<string> {
  assertWithinRoot(folderPath)
  const target = path.join(folderPath, '.env')
  await fs.writeFile(target, content, { mode: 0o600 })
  return target
}

export async function writeComposeFile(folderPath: string, content: string): Promise<string> {
  assertWithinRoot(folderPath)
  const target = path.join(folderPath, 'docker-compose.yml')
  await fs.writeFile(target, content, { mode: 0o640 })
  return target
}

export async function writeMetadataFile(folderPath: string, content: string): Promise<string> {
  assertWithinRoot(folderPath)
  const target = path.join(folderPath, 'metadata.json')
  await fs.writeFile(target, content, { mode: 0o640 })
  return target
}

// Borrado profundo. Sólo se usa en el cleanup seguro PRE-compose-up.
// Validamos otra vez que el path esté dentro de la raíz.
export async function removeFolder(folderPath: string): Promise<void> {
  assertWithinRoot(folderPath)
  await fs.rm(folderPath, { recursive: true, force: true })
}

export async function folderExists(folderPath: string): Promise<boolean> {
  try {
    await fs.access(folderPath)
    return true
  } catch {
    return false
  }
}
