import { composePs, type ComposePsRow } from './docker.js'
import { config } from './config.js'

export interface HealthSummary {
  ready:    boolean
  rows:     ComposePsRow[]
  unhealthy: string[]
}

// Espera a que todos los contenedores estén `running` y, si tienen healthcheck
// definido, `healthy`. Devuelve éxito antes del timeout o lanza.
export async function waitForHealth(opts: {
  composePath: string
  envPath:     string
  projectName: string
  onTick:      (summary: HealthSummary) => Promise<void>
}): Promise<HealthSummary> {
  const start = Date.now()
  const timeout = config.healthcheckTimeoutMs
  while (true) {
    const rows = await composePs(opts.composePath, opts.envPath, opts.projectName)
    const summary = analyze(rows)
    await opts.onTick(summary)
    if (summary.ready) return summary
    if (summary.unhealthy.length > 0) {
      throw new Error(`Contenedores en mal estado: ${summary.unhealthy.join(', ')}`)
    }
    if (Date.now() - start > timeout) {
      throw new Error(
        `Timeout esperando healthchecks (${timeout/1000}s). ` +
        `Estado actual: ${rows.map(r => `${r.Name}=${r.State}/${r.Health || 'no-hc'}`).join(', ')}`
      )
    }
    await sleep(3000)
  }
}

function analyze(rows: ComposePsRow[]): HealthSummary {
  if (rows.length === 0) return { ready: false, rows, unhealthy: [] }
  const unhealthy: string[] = []
  let allReady = true
  for (const r of rows) {
    if (r.State === 'exited' || r.State === 'dead') {
      unhealthy.push(`${r.Name} (${r.State})`)
      continue
    }
    if (r.State !== 'running') {
      allReady = false
      continue
    }
    // Si tiene healthcheck declarado, esperar a 'healthy'
    if (r.Health === 'unhealthy') {
      unhealthy.push(`${r.Name} (unhealthy)`)
      continue
    }
    if (r.Health && r.Health !== 'healthy') {
      allReady = false
    }
  }
  return { ready: allReady && unhealthy.length === 0, rows, unhealthy }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
