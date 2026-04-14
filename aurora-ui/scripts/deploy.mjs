/**
 * Deploy aurora-ui build output to airdcpp-webclient web-resources directory.
 * The daemon serves static files from web-resources/ — this replaces the legacy UI.
 *
 * Usage: npm run deploy
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dist = resolve(__dirname, '../dist')
const webResources = resolve(
  __dirname,
  '../../airdcpp-webclient/build/airdcppd/RelWithDebInfo/web-resources'
)

if (!existsSync(dist)) {
  console.error('Error: dist/ not found. Run "npm run build" first.')
  process.exit(1)
}

// Ensure target directory exists
mkdirSync(webResources, { recursive: true })

// Clean previous deployment
const files = ['index.html', 'assets', 'favicon.svg']
for (const f of files) {
  const target = resolve(webResources, f)
  if (existsSync(target)) {
    rmSync(target, { recursive: true })
  }
}

// Copy build output
cpSync(dist, webResources, { recursive: true })

console.log(`Deployed aurora-ui to ${webResources}`)
