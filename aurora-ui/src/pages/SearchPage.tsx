import { useState, type FormEvent } from 'react'
import { Search, Download, File, Folder } from 'lucide-react'
import { getSocket } from '@/api/socket'
import { formatBytes } from '@/lib/utils'

interface SearchResult {
  id: number
  name: string
  relevance: number
  path: string
  type: {
    id: string
    str: string
    content_type?: string
  }
  users: {
    user: {
      cid: string
      nick: string
      hub_url: string
    }
    count: number
  }
  size: number
  date: number
  slots: {
    free: number
    total: number
    str: string
  }
  dupe: {
    id: string
    paths: string[]
  }
  tth: string
}

interface SearchInstance {
  id: number
  expires_in: number
  current_search_id: number
  query: {
    pattern: string
  }
  result_count: number
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchId, setSearchId] = useState<number | null>(null)

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    const socket = getSocket()
    if (!socket) return

    setSearching(true)
    setResults([])

    try {
      // Create a search instance
      const instance = (await socket.post('search', {
        query: {
          pattern: query,
          extensions: [],
        },
        priority: 0,
      })) as SearchInstance

      setSearchId(instance.id)

      // Poll for results
      const pollResults = async () => {
        const res = (await socket.get(
          `search/${instance.id}/results/0/100`
        )) as SearchResult[]
        setResults(res)
      }

      // Poll a few times with delay
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        await pollResults()
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleDownload = async (result: SearchResult) => {
    const socket = getSocket()
    if (!socket || !searchId) return

    try {
      await socket.post(`search/${searchId}/results/${result.id}/download`)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-heading text-2xl text-(--color-text-primary)">Search</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-tertiary)"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files on the network..."
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-accent) focus:ring-1 focus:ring-(--color-accent)/50 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="h-10 px-5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-xl bg-(--color-surface-2) overflow-hidden">
          <div className="px-4 py-2.5 border-b border-(--color-glass-border)">
            <span className="text-micro">{results.length} results</span>
          </div>
          <div className="divide-y divide-(--color-glass-border)">
            {results.map((result) => (
              <div
                key={result.id}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/2 transition-colors"
              >
                {result.type.id === 'directory' ? (
                  <Folder size={16} className="text-(--color-warning) shrink-0" />
                ) : (
                  <File size={16} className="text-(--color-text-tertiary) shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-(--color-text-primary) truncate">
                    {result.name}
                  </p>
                  <p className="text-micro truncate">{result.path}</p>
                </div>
                <span className="text-micro shrink-0">{formatBytes(result.size)}</span>
                <span className="text-micro shrink-0 text-(--color-text-tertiary)">
                  {result.slots.str}
                </span>
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

      {!searching && results.length === 0 && query && (
        <p className="text-caption text-center py-12">No results found</p>
      )}
    </div>
  )
}
