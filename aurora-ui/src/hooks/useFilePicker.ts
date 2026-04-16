/**
 * Native file/folder picker using Tauri dialog API.
 * Falls back to manual text input in browser mode.
 */

interface PickerOptions {
  directory?: boolean
  multiple?: boolean
  title?: string
  filters?: { name: string; extensions: string[] }[]
}

export async function pickPath(options: PickerOptions = {}): Promise<string | null> {
  // Check if Tauri dialog API is available
  if (window.__TAURI_INTERNALS__) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const result = await open({
        directory: options.directory ?? false,
        multiple: options.multiple ?? false,
        title: options.title ?? (options.directory ? 'Select Folder' : 'Select File'),
        filters: options.filters,
      })

      if (Array.isArray(result)) return result[0] ?? null
      return result
    } catch {
      // Fallback if plugin not loaded
      return null
    }
  }

  // Browser mode — no native picker available
  return null
}

export async function pickFolder(title?: string): Promise<string | null> {
  return pickPath({ directory: true, title: title ?? 'Select Folder to Share' })
}

export async function pickFile(title?: string, filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  return pickPath({ directory: false, title: title ?? 'Select File', filters })
}

export function isTauriAvailable(): boolean {
  return !!window.__TAURI_INTERNALS__
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}
