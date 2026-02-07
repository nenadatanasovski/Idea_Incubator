import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { type PluginOption } from 'vite'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'

/**
 * Vite plugin that provides process-level control of the orchestrator server.
 * Exposes /__server/status, /__server/start, /__server/stop endpoints
 * so the dashboard can start/stop the backend from the UI.
 */
function serverControlPlugin(): PluginOption {
  let proc: ChildProcess | null = null
  const orchestratorDir = path.resolve(__dirname, '../orchestrator')

  function isAlive(): boolean {
    return proc !== null && proc.exitCode === null && !proc.killed
  }

  function startServer(): { ok: boolean; error?: string } {
    if (isAlive()) return { ok: true }

    try {
      proc = spawn('npx', ['tsx', 'src/server.ts'], {
        cwd: orchestratorDir,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env },
      })

      proc.on('exit', (code) => {
        console.log(`[server-control] orchestrator exited (code ${code})`)
        proc = null
      })

      proc.on('error', (err) => {
        console.error(`[server-control] spawn error:`, err.message)
        proc = null
      })

      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  function stopServer(): { ok: boolean } {
    if (!isAlive() || !proc) {
      proc = null
      return { ok: true }
    }
    proc.kill('SIGTERM')
    proc = null
    return { ok: true }
  }

  return {
    name: 'server-control',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/__server/')) return next()

        res.setHeader('Content-Type', 'application/json')

        if (req.url === '/__server/status') {
          // Check both our managed process AND if something is already on port 3333
          if (isAlive()) {
            res.end(JSON.stringify({ online: true, managed: true }))
          } else {
            // Check if orchestrator is running externally (e.g. started from terminal)
            fetch('http://localhost:3333/health')
              .then((r) => r.ok)
              .then((ok) => res.end(JSON.stringify({ online: ok, managed: false })))
              .catch(() => res.end(JSON.stringify({ online: false, managed: false })))
          }
          return
        }

        if (req.method === 'POST' && req.url === '/__server/start') {
          const result = startServer()
          // Give the server a moment to bind the port
          setTimeout(() => {
            res.end(JSON.stringify(result))
          }, 1500)
          return
        }

        if (req.method === 'POST' && req.url === '/__server/stop') {
          // If we manage the process, kill it
          if (isAlive()) {
            const result = stopServer()
            res.end(JSON.stringify(result))
            return
          }
          // If it's running externally, call its shutdown
          fetch('http://localhost:3333/api/orchestrator/shutdown', { method: 'POST' })
            .then(() => res.end(JSON.stringify({ ok: true })))
            .catch(() => res.end(JSON.stringify({ ok: true })))
          return
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serverControlPlugin()],
})
