/**
 * Vite middleware plugin: Yggdrasil peer management API.
 * Reads/writes yggdrasil.conf and can restart the service.
 *
 * Endpoints:
 *   GET  /api/ygg/active-peers  → current peers from yggdrasil.conf
 *   POST /api/ygg/apply-peers   → write selected peers and restart service
 *   GET  /api/ygg/status        → yggdrasil interface info
 */

import type { Plugin } from 'vite'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'

// Common Yggdrasil config paths
const CONFIG_PATHS = [
  'C:\\ProgramData\\Yggdrasil\\yggdrasil.conf',
  '/etc/yggdrasil/yggdrasil.conf',
  '/etc/yggdrasil.conf',
]

function findConfigPath(): string | null {
  for (const p of CONFIG_PATHS) {
    if (existsSync(p)) return p
  }
  return null
}

function parseActivePeers(configContent: string): string[] {
  // HJSON format: Peers: [ ... ]
  const peersMatch = configContent.match(/Peers:\s*\[([\s\S]*?)\]/)
  if (!peersMatch) return []

  const block = peersMatch[1]
  const peers: string[] = []

  // Match quoted or unquoted URIs
  const uriRegex = /(?:"|')?((tls|tcp|quic|ws|socks):\/\/[^\s"',#]+)(?:"|')?/g
  let match
  while ((match = uriRegex.exec(block)) !== null) {
    peers.push(match[1])
  }

  return peers
}

function buildPeersBlock(peers: string[]): string {
  if (peers.length === 0) return '  Peers: []'
  const lines = peers.map((p) => `    ${p}`)
  return `  Peers: [\n${lines.join('\n')}\n  ]`
}

function getYggdrasilStatus(): {
  running: boolean
  address?: string
  subnet?: string
} {
  try {
    // Check if service is running
    if (process.platform === 'win32') {
      const result = execSync('sc query yggdrasil', { encoding: 'utf-8' })
      const running = result.includes('RUNNING')

      // Get IPv6 address from ipconfig
      let address: string | undefined
      if (running) {
        try {
          const ipconfig = execSync('ipconfig', { encoding: 'utf-8' })
          const yggSection = ipconfig.split(/Yggdrasil/i)[1]
          if (yggSection) {
            const addrMatch = yggSection.match(
              /IPv6 Address[.\s]*:\s*(2[0-9a-f:]+)/i
            )
            if (addrMatch) address = addrMatch[1]
          }
        } catch {}
      }

      return { running, address }
    } else {
      // Linux/macOS
      const result = execSync('systemctl is-active yggdrasil', {
        encoding: 'utf-8',
      }).trim()
      return { running: result === 'active' }
    }
  } catch {
    return { running: false }
  }
}

function restartYggdrasil(): boolean {
  try {
    if (process.platform === 'win32') {
      execSync('net stop yggdrasil && net start yggdrasil', {
        encoding: 'utf-8',
        timeout: 15000,
      })
    } else {
      execSync('sudo systemctl restart yggdrasil', {
        encoding: 'utf-8',
        timeout: 15000,
      })
    }
    return true
  } catch {
    return false
  }
}

export function yggPeersPlugin(): Plugin {
  return {
    name: 'ygg-peers-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/ygg/')) return next()

        res.setHeader('Content-Type', 'application/json')

        try {
          // GET /api/ygg/status
          if (req.url === '/api/ygg/status' && req.method === 'GET') {
            const status = getYggdrasilStatus()
            res.end(JSON.stringify(status))
            return
          }

          // GET /api/ygg/active-peers
          if (req.url === '/api/ygg/active-peers' && req.method === 'GET') {
            const configPath = findConfigPath()
            if (!configPath) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Yggdrasil config not found' }))
              return
            }
            const content = readFileSync(configPath, 'utf-8')
            const peers = parseActivePeers(content)
            res.end(JSON.stringify({ peers, configPath }))
            return
          }

          // POST /api/ygg/apply-peers
          if (req.url === '/api/ygg/apply-peers' && req.method === 'POST') {
            let body = ''
            req.on('data', (chunk: Buffer) => (body += chunk.toString()))
            req.on('end', () => {
              try {
                const { peers } = JSON.parse(body) as { peers: string[] }
                const configPath = findConfigPath()
                if (!configPath) {
                  res.statusCode = 404
                  res.end(
                    JSON.stringify({ error: 'Yggdrasil config not found' })
                  )
                  return
                }

                // Read current config
                let config = readFileSync(configPath, 'utf-8')

                // Replace peers block
                const newBlock = buildPeersBlock(peers)
                config = config.replace(/\s*Peers:\s*\[[\s\S]*?\]/, '\n' + newBlock)

                // Write back
                writeFileSync(configPath, config, 'utf-8')

                // Restart service
                const restarted = restartYggdrasil()

                res.end(
                  JSON.stringify({
                    success: true,
                    peersCount: peers.length,
                    restarted,
                    configPath,
                  })
                )
              } catch (err) {
                res.statusCode = 500
                res.end(
                  JSON.stringify({
                    error:
                      err instanceof Error ? err.message : 'Unknown error',
                  })
                )
              }
            })
            return
          }

          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Not found' }))
        } catch (err) {
          res.statusCode = 500
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : 'Server error',
            })
          )
        }
      })
    },
  }
}
