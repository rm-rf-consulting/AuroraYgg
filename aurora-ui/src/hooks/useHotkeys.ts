import { useEffect } from 'react'
import { useNavigate } from 'react-router'

/**
 * Global keyboard shortcuts for Aurora UI.
 * - / : Focus search
 * - Escape : Clear focus
 */
export function useGlobalHotkeys() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // "/" to go to search (only when not typing)
      if (e.key === '/' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        navigate('/search')
      }

      // Escape to blur current element
      if (e.key === 'Escape' && isInput) {
        ;(target as HTMLInputElement).blur()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
