import { config } from './config.js'
import { logLine } from './logger.js'
import { claimNextJob } from './queue.js'
import { executeJob } from './executor.js'

let stopping = false
function shutdown(signal: string) {
  if (stopping) return
  stopping = true
  logLine('info', `Señal ${signal} recibida — terminando tras el job actual`)
}
process.on('SIGINT',  () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

process.on('unhandledRejection', (reason) => {
  logLine('error', 'unhandledRejection', { reason: String(reason) })
})
process.on('uncaughtException', (err) => {
  logLine('error', 'uncaughtException', { error: String(err) })
})

async function main() {
  logLine('info', `Fluxtic Provisioner iniciado (workerId=${config.workerId})`)
  logLine('info', `Root: ${config.fluxticRoot} · Backup: ${config.backupRoot} · Network: ${config.proxyNetwork}`)

  while (!stopping) {
    try {
      const claim = await claimNextJob()
      if (!claim) {
        await sleep(config.pollIntervalMs)
        continue
      }
      logLine('info', `Tomado job ${claim.jobId} (cliente ${claim.job.clientTenantId})`)
      await executeJob(claim.jobId, claim.job)
    } catch (e) {
      logLine('error', 'loop error', { error: String(e) })
      await sleep(Math.min(config.pollIntervalMs * 2, 30_000))
    }
  }
  logLine('info', 'Fluxtic Provisioner detenido')
  process.exit(0)
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

main().catch(err => {
  console.error('[provisioner] fatal', err)
  process.exit(1)
})
