/**
 * Prepare all binaries for the Tauri all-in-one installer.
 *
 * Copies:
 *   - airdcppd.exe → src-tauri/binaries/ (as Tauri sidecar)
 *   - *.dll → src-tauri/resources/dlls/
 *   - Downloads nssm.exe from GitHub
 *   - Downloads Yggdrasil MSI from GitHub
 *   - Creates default config files
 *
 * Usage: node scripts/prepare-bundle.mjs
 */
import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const TAURI = resolve(ROOT, 'src-tauri')

const DAEMON_DIR = resolve(ROOT, '../airdcpp-webclient/build/airdcppd/RelWithDebInfo')
const BINARIES_DIR = resolve(TAURI, 'binaries')
const RESOURCES_DIR = resolve(TAURI, 'resources')
const DLLS_DIR = resolve(RESOURCES_DIR, 'dlls')
const CONFIG_DIR = resolve(RESOURCES_DIR, 'default-config')

// Tauri sidecar naming convention: {name}-{target_triple}{.exe}
const TARGET_TRIPLE = 'x86_64-pc-windows-msvc'
const NSSM_URL = 'https://nssm.cc/release/nssm-2.24.zip'
const YGG_VERSION = '0.5.12'
const YGG_MSI_URL = `https://github.com/yggdrasil-network/yggdrasil-go/releases/download/v${YGG_VERSION}/yggdrasil-${YGG_VERSION}-x64.msi`

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function step(msg) {
  console.log(`\n  → ${msg}`)
}

async function main() {
  console.log('🔧 Preparing Aurora bundle...\n')

  // 1. Copy daemon executable as sidecar
  step('Copying airdcppd.exe as Tauri sidecar')
  ensureDir(BINARIES_DIR)
  const daemonSrc = resolve(DAEMON_DIR, 'airdcppd.exe')
  const daemonDst = resolve(BINARIES_DIR, `airdcppd-${TARGET_TRIPLE}.exe`)
  if (!existsSync(daemonSrc)) {
    console.error(`  ❌ Daemon not found at ${daemonSrc}`)
    console.error('     Build it first: cmake --build ... --config RelWithDebInfo --target airdcppd')
    process.exit(1)
  }
  cpSync(daemonSrc, daemonDst)
  console.log(`  ✓ ${basename(daemonDst)}`)

  // 2. Copy DLLs
  step('Copying daemon DLLs')
  ensureDir(DLLS_DIR)
  const dlls = readdirSync(DAEMON_DIR).filter(f => f.endsWith('.dll'))
  for (const dll of dlls) {
    cpSync(resolve(DAEMON_DIR, dll), resolve(DLLS_DIR, dll))
  }
  console.log(`  ✓ ${dlls.length} DLLs copied`)

  // 3. Download NSSM
  step('Preparing NSSM (service manager)')
  const nssmExe = resolve(RESOURCES_DIR, 'nssm.exe')
  if (existsSync(nssmExe)) {
    console.log('  ✓ nssm.exe already exists')
  } else {
    console.log('  ℹ Downloading NSSM...')
    const zipPath = resolve(RESOURCES_DIR, 'nssm.zip')
    try {
      execSync(`curl -L -o "${zipPath}" "${NSSM_URL}"`, { stdio: 'pipe' })
      // Extract just the 64-bit exe
      execSync(`tar -xf "${zipPath}" --strip-components=2 -C "${RESOURCES_DIR}" nssm-2.24/win64/nssm.exe`, { stdio: 'pipe' })
      // Clean up zip
      try { execSync(`rm "${zipPath}"`, { stdio: 'pipe' }) } catch {}
      console.log('  ✓ nssm.exe downloaded')
    } catch (e) {
      console.error('  ⚠ Failed to download NSSM. Place nssm.exe manually in src-tauri/resources/')
    }
  }

  // 4. Download Yggdrasil MSI
  step('Preparing Yggdrasil MSI')
  const yggMsi = resolve(RESOURCES_DIR, `yggdrasil-${YGG_VERSION}-x64.msi`)
  if (existsSync(yggMsi)) {
    console.log('  ✓ Yggdrasil MSI already exists')
  } else {
    console.log(`  ℹ Downloading Yggdrasil v${YGG_VERSION}...`)
    try {
      execSync(`curl -L -o "${yggMsi}" "${YGG_MSI_URL}"`, { stdio: 'pipe', timeout: 60000 })
      console.log('  ✓ Yggdrasil MSI downloaded')
    } catch {
      console.error('  ⚠ Failed to download Yggdrasil MSI. Place it manually in src-tauri/resources/')
    }
  }

  // 5. Create default config
  step('Creating default config')
  ensureDir(CONFIG_DIR)

  writeFileSync(resolve(CONFIG_DIR, 'web-server.json'), JSON.stringify({
    settings: { web_tls_port: 0 },
    version: 1,
  }, null, 2))

  // Default admin user (password auto-hashed by daemon on first load)
  writeFileSync(resolve(CONFIG_DIR, 'web-users.json'), JSON.stringify({
    settings: {
      users: [{ username: 'admin', password: 'aurora', permissions: ['admin'], last_login: 0 }],
      refresh_tokens: [],
      invites: [],
    },
    version: 1,
  }, null, 2))
  console.log('  ✓ Default config created')

  // Summary
  console.log('\n✅ Bundle prepared!\n')
  console.log('  Run: cargo tauri build')
}

main().catch((e) => {
  console.error('Failed:', e)
  process.exit(1)
})
