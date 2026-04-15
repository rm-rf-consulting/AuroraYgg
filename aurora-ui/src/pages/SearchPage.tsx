import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Search, Download, File, Folder, X, Filter, Loader2, Eye, Clock } from 'lucide-react'
import { getSocket } from '@/api/socket'
import { formatBytes } from '@/lib/utils'
import { toast } from '@/components/shared/Toast'
import { isPreviewable, MediaPreview } from '@/components/shared/MediaPreview'

interface SearchResult {
  id: number
  name: string
  relevance: number
  path: string
  type: { id: string; str: string; content_type?: string }
  users: { user: { cid: string; nick: string; hub_url: string }; count: number }
  size: number
  date: number
  slots: { free: number; total: number; str: string }
  dupe: { id: string; paths: string[] }
  tth: string
}

interface SearchInstance {
  id: number
  expires_in: number
  current_search_id: number
  query: { pattern: string }
  result_count: number
}

const FILE_TYPE_OPTIONS = [
  { id: 'any', label: 'Any' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'document', label: 'Documents' },
  { id: 'software', label: 'Software' },
  { id: 'picture', label: 'Images' },
  { id: 'directory', label: 'Folders' },
]

const HISTORY_KEY = 'aurora_search_history'
const MAX_HISTORY = 20

function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch { return [] }
}

function addToHistory(query: string) {
  const history = getSearchHistory().filter((h) => h !== query)
  history.unshift(query)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [fileType, setFileType] = useState('any')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchId, setSearchId] = useState<number | null>(null)
  const [resultCount, setResultCount] = useState(0)
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const listenerRef = useRef<(() => void) | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus search input on mount + auto-search from URL params
  useEffect(() => {
    inputRef.current?.focus()
    const q = searchParams.get('q')
    if (q && !searching && results.length === 0) {
      setQuery(q)
    }
  }, [searchParams])

  // Cleanup listener on unmount
  useEffect(() => {
    return () => { listenerRef.current?.() }
  }, [])

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setShowHistory(false)
    addToHistory(query.trim())

    const socket = getSocket()
    if (!socket) return

    // Cleanup previous search listener
    listenerRef.current?.()
    listenerRef.current = null

    setSearching(true)
    setResults([])
    setResultCount(0)

    try {
      const searchData: Record<string, unknown> = {
        query: {
          pattern: query,
          file_type: fileType === 'any' ? undefined : fileType,
        },
        priority: 0,
      }

      const instance = (await socket.post('search', searchData)) as SearchInstance
      setSearchId(instance.id)

      // Subscribe to real-time results via WebSocket
      try {
        const remove = await socket.addListener(
          'search',
          'search_result_added',
          (result: SearchResult) => {
            setResults((prev) => [...prev, result])
            setResultCount((c) => c + 1)
          },
          instance.id
        )
        listenerRef.current = remove
      } catch {
        // Fallback: poll for results if listener fails
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          try {
            const res = (await socket.get(`search/${instance.id}/results/0/200`)) as SearchResult[]
            setResults(res)
            setResultCount(res.length)
          } catch { break }
        }
      }

      // Mark search as no longer "actively searching" after a delay
      setTimeout(() => setSearching(false), 3000)
    } catch (err) {
      toast.error('Search failed')
      setSearching(false)
    }
  }

  const handleDownload = async (result: SearchResult) => {
    const socket = getSocket()
    if (!socket || !searchId) return

    try {
      // Correct endpoint: search/{token}/results/{tth}/download
      await socket.post(`search/${searchId}/results/${result.tth}/download`)
      toast.success(`Downloading: ${result.name}`)
    } catch {
      toast.error(`Download failed: ${result.name}`)
    }
  }

  const clearSearch = () => {
    listenerRef.current?.()
    listenerRef.current = null
    setResults([])
    setSearchId(null)
    setResultCount(0)
    setQuery('')
    setSearching(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-heading text-2xl text-(--color-text-primary)">Search</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-tertiary)" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files on the network..."
              className="w-full h-10 pl-9 pr-9 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-accent) focus:ring-1 focus:ring-(--color-accent)/50 transition-colors"
            />
            {query && (
              <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-disabled) hover:text-(--color-text-tertiary) cursor-pointer">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="h-10 px-5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            {searching && <Loader2 size={14} className="animate-spin" />}
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* File type filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-(--color-text-disabled)" />
          {FILE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFileType(opt.id)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                fileType === opt.id
                  ? 'bg-(--color-accent)/12 text-(--color-link)'
                  : 'text-(--color-text-tertiary) hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </form>

      {/* Results header */}
      {(results.length > 0 || searching) && (
        <div className="flex items-center gap-3">
          <span className="text-micro">
            {resultCount} result{resultCount !== 1 ? 's' : ''}
          </span>
          {searching && (
            <span className="flex items-center gap-1.5 text-micro text-(--color-link)">
              <Loader2 size={11} className="animate-spin" />
              Receiving results...
            </span>
          )}
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="rounded-xl bg-(--color-surface-2) overflow-hidden">
          <div className="divide-y divide-(--color-glass-border)">
            {results.map((result) => (
              <div
                key={`${result.id}-${result.tth}`}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/2 transition-colors"
              >
                {result.type.id === 'directory' ? (
                  <Folder size={16} className="text-(--color-warning) shrink-0" />
                ) : (
                  <File size={16} className="text-(--color-text-tertiary) shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-(--color-text-primary) truncate">{result.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-micro truncate">{result.path}</span>
                    {result.users && (
                      <span className="text-micro text-(--color-text-disabled)">
                        {result.users.user.nick}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-micro shrink-0">{formatBytes(result.size)}</span>
                <span className="text-micro shrink-0 text-(--color-text-tertiary)">{result.slots?.str}</span>
                <button
                  onClick={() => handleDownload(result)}
                  className="p-1.5 rounded-md hover:bg-(--color-accent)/10 text-(--color-link) transition-colors cursor-pointer"
                  title="Download"
                >
                  <Download size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!searching && results.length === 0 && searchId && (
        <p className="text-caption text-center py-12">No results found</p>
      )}
    </div>
  )
}
