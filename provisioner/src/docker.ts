import { execa, type Options as ExecaOptions, type ExecaError } from 'execa'
import { config } from './config.js'
import { logLine } from './logger.js'

const BASE_OPTIONS: ExecaOptions = {
  // El binario es 'docker' por defecto pero permitimos override.
  // Argumentos se pasan como array para que execa los escape.
  shell: false,
  // Timeout largo: docker pull puede ser pesado.
  timeout: 10 * 60 * 1000,
  // No heredamos shell del padre.
  env: { LANG: 'C.UTF-8' },
}

export interface DockerResult {
  stdout: string
  stderr: string
  exitCode: number
}

async function runDocker(args: string[], opts: ExecaOptions = {}): Promise<DockerResult> {
  logLine('debug', `docker ${args.join(' ')}`)
  try {
    const res = await execa(config.dockerBin, args, { ...BASE_OPTIONS, ...opts })
    return {
      stdout:   res.stdout?.toString() ?? '',
      stderr:   res.stderr?.toString() ?? '',
      exitCode: res.exitCode ?? 0,
    }
  } catch (e) {
    const err = e as ExecaError
    throw new DockerError(
      err.command ?? `docker ${args.join(' ')}`,
      err.exitCode ?? -1,
      err.stdout?.toString() ?? '',
      err.stderr?.toString() ?? err.message,
    )
  }
}

export class DockerError extends Error {
  constructor(
    public readonly command:  string,
    public readonly exitCode: number,
    public readonly stdout:   string,
    public readonly stderr:   string,
  ) {
    super(`docker falló (exit ${exitCode}): ${stderr.slice(0, 500)}`)
  }
}

// ── Wrappers de alto nivel ─────────────────────────────────

export async function ensureNetwork(name: string): Promise<{ created: boolean }> {
  const inspect = await execa(config.dockerBin, ['network', 'inspect', name], {
    ...BASE_OPTIONS, reject: false,
  })
  if (inspect.exitCode === 0) return { created: false }
  await runDocker(['network', 'create', name])
  return { created: true }
}

export async function composePull(composePath: string, envPath: string, projectName: string): Promise<DockerResult> {
  return runDocker([
    'compose',
    '--project-name', projectName,
    '-f', composePath,
    '--env-file', envPath,
    'pull',
  ])
}

export async function composeUp(composePath: string, envPath: string, projectName: string): Promise<DockerResult> {
  return runDocker([
    'compose',
    '--project-name', projectName,
    '-f', composePath,
    '--env-file', envPath,
    'up', '-d',
  ])
}

export async function composeDown(composePath: string, envPath: string, projectName: string, withVolumes: boolean): Promise<DockerResult> {
  const args = [
    'compose',
    '--project-name', projectName,
    '-f', composePath,
    '--env-file', envPath,
    'down',
  ]
  if (withVolumes) args.push('-v')
  return runDocker(args, { timeout: 5 * 60 * 1000 })
}

export interface ComposePsRow {
  Name:    string
  Service: string
  State:   string   // 'running' | 'exited' | etc
  Health:  string   // 'healthy' | 'starting' | 'unhealthy' | '' (none)
  Status:  string
}

export async function composePs(composePath: string, envPath: string, projectName: string): Promise<ComposePsRow[]> {
  const res = await runDocker([
    'compose',
    '--project-name', projectName,
    '-f', composePath,
    '--env-file', envPath,
    'ps',
    '--format', 'json',
  ], { timeout: 30 * 1000 })

  // `docker compose ps --format json` puede devolver una sola línea
  // con array, ó NDJSON (una línea por contenedor) según versión.
  const lines = res.stdout.trim().split('\n').filter(Boolean)
  if (lines.length === 0) return []
  if (lines.length === 1 && lines[0]!.startsWith('[')) {
    return JSON.parse(lines[0]!) as ComposePsRow[]
  }
  return lines.map(l => JSON.parse(l) as ComposePsRow)
}

export async function composeExec(
  composePath: string,
  envPath:     string,
  projectName: string,
  service:     string,
  argv:        string[],
): Promise<DockerResult> {
  return runDocker([
    'compose',
    '--project-name', projectName,
    '-f', composePath,
    '--env-file', envPath,
    'exec', '-T', service,
    ...argv,
  ], { timeout: 10 * 60 * 1000 })
}
