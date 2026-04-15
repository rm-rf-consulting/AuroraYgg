import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { getSocket } from '@/api/socket'
import { toast } from '@/components/shared/Toast'

/**
 * Handle aurora:// and magnet: URI deep links.
 *
 * aurora://LINK_ID          → navigate to download page
 * aurora://LINK_ID?pwd=xxx  → download with password
 * magnet:?xt=urn:tree:tiger:HASH&dn=name → search by TTH
 */
export function useUriHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    // Listen for Tauri deep link events
    const handleUri = (uri: string) => {
      if (!uri) return

      if (uri.startsWith('aurora://')) {
        const linkId = uri.replace('aurora://', '').split('?')[0].split('/')[0]
        if (linkId) {
          toast.info(`Opening share link: ${linkId}`)
          // Navigate to a download page or trigger download via API
          navigate(`/download/${linkId}`)
        }
      } else if (uri.startsWith('magnet:')) {
        // Parse magnet link
        const params = new URLSearchParams(uri.split('?')[1] || '')
        const xt = params.get('xt') || ''
        const dn = params.get('dn') || ''

        // Extract TTH from urn:tree:tiger:HASH
        const tthMatch = xt.match(/urn:tree:tiger:([A-Z0-9]+)/i)

        if (tthMatch) {
          toast.info(`Magnet link: ${dn || tthMatch[1]}`)
          // Add to queue via daemon API
          const socket = getSocket()
          if (socket) {
            socket.post('queue/bundles/magnet', {
              magnet: uri,
            }).then(() => {
              toast.success(`Added to queue: ${dn || 'magnet download'}`)
              navigate('/queue')
            }).catch(() => {
              toast.error('Failed to add magnet link')
            })
          }
        } else {
          // Fallback: search by name
          if (dn) {
            navigate(`/search?q=${encodeURIComponent(dn)}`)
          }
        }
      }
    }

    // Check if running in Tauri
    if (window.__TAURI__) {
      const { listen } = window.__TAURI__.event
      const unlisten = listen('uri-open', (event: { payload: string }) => {
        handleUri(event.payload)
      })

      return () => {
        unlisten.then((fn: () => void) => fn())
      }
    }

    // Browser fallback: check URL hash for aurora:// links
    const hash = window.location.hash
    if (hash.includes('aurora://') || hash.includes('magnet:')) {
      const uri = decodeURIComponent(hash.replace('#/', ''))
      handleUri(uri)
    }
  }, [navigate])
}

// Extend Window for Tauri
declare global {
  interface Window {
    __TAURI__?: {
      event: {
        listen: (event: string, handler: (event: { payload: string }) => void) => Promise<() => void>
      }
    }
  }
}
