import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getSocket } from '@/api/socket'
import { formatBytes } from '@/lib/utils'
import { toast } from '@/components/shared/Toast'
import { File, Folder, ChevronRight, Download, Loader2 } from 'lucide-react'

interface FilelistItem {
  name: string
  type: { id: string; str: string; content_type?: string }
  size: number
  tth?: string
  date?: number
  path: string
  dupe?: { id: string; paths: string[] }
}

interface Filelist {
  id: number
  user: { cid: string; nick: string; hub_url: string }
  state: { id: string; str: string }
  location?: { path: string }
  partial_list: boolean
}

export function FilelistSession() {
  const { id } = useParams<{ id: string }>()
  const listId = Number(id)
  const [filelist, setFilelist] = useState<Filelist | null>(null)
  const [items, setItems] = useState<FilelistItem[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [loading, setLoading] = useState(true)

  const fetchDirectory = async (path: string) => {
    const socket = getSocket()
    if (!socket) return
    setLoading(true)
    try {
      const data = (await socket.post(`filelists/${listId}/directory`, {
        list_path: path,
      })) as FilelistItem[]
      setItems(data)
      setCurrentPath(path)
    } catch {
      toast.error('Failed to load directory')
    }
    setLoading(false)
  }

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    socket.get(`filelists/${listId}`).then((data) => {
      setFilelist(data as Filelist)
    }).catch(() => {
      toast.error('Failed to load filelist info')
    })

    fetchDirectory('/')
  }, [listId])

  const handleNavigate = (item: FilelistItem) => {
    if (item.type.id === 'directory') {
      fetchDirectory(item.path + item.name + '/')
    }
  }

  const handleDownload = async (item: FilelistItem) => {
    const socket = getSocket()
    if (!socket) return
    try {
      // For directories: use directory_downloads endpoint
      // For files: use file download
      if (item.type.id === 'directory') {
        await socket.post(`filelists/${listId}/directory_downloads`, {
          list_path: item.path + item.name + '/',
        })
      } else {
        await socket.post(`filelists/${listId}/directory_downloads`, {
          list_path: item.path + item.name,
        })
      }
      toast.success(`Downloading: ${item.name}`)
    } catch {
      toast.error(`Download failed: ${item.name}`)
    }
  }

  const handleDownloadAll = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`filelists/${listId}/directory_downloads`, {
        list_path: currentPath,
      })
      toast.success(`Downloading directory: ${currentPath}`)
    } catch {
      toast.error('Download failed')
    }
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-2xl text-(--color-text-primary)">
            {filelist?.user.nick ?? 'Filelist'}
          </h1>
          {filelist && (
            <p className="text-caption mt-0.5">{filelist.state.str}</p>
          )}
        </div>
        {currentPath !== '/' && (
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Download size={13} />
            Download folder
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-xs flex-wrap">
        <button
          onClick={() => fetchDirectory('/')}
          className="text-(--color-link) hover:underline cursor-pointer"
        >
          Root
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={12} className="text-(--color-text-disabled)" />
            <button
              onClick={() => fetchDirectory('/' + breadcrumbs.slice(0, i + 1).join('/') + '/')}
              className="text-(--color-link) hover:underline cursor-pointer"
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 size={16} className="animate-spin text-(--color-text-tertiary)" />
          <span className="text-caption">Loading...</span>
        </div>
      ) : (
        <div className="rounded-xl bg-(--color-surface-2) divide-y divide-(--color-glass-border) overflow-hidden">
          {/* Go up */}
          {currentPath !== '/' && (
            <div
              className="px-4 py-2 flex items-center gap-3 hover:bg-white/2 transition-colors cursor-pointer"
              onClick={() => {
                const parent = currentPath.split('/').slice(0, -2).join('/') + '/'
                fetchDirectory(parent || '/')
              }}
            >
              <Folder size={16} className="text-(--color-text-disabled) shrink-0" />
              <span className="text-sm text-(--color-text-tertiary)">..</span>
            </div>
          )}
          {items.map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              className="px-4 py-2 flex items-center gap-3 hover:bg-white/2 transition-colors cursor-pointer group"
              onClick={() => handleNavigate(item)}
            >
              {item.type.id === 'directory' ? (
                <Folder size={16} className="text-(--color-warning) shrink-0" />
              ) : (
                <File size={16} className="text-(--color-text-tertiary) shrink-0" />
              )}
              <span className="text-sm text-(--color-text-primary) truncate flex-1">{item.name}</span>
              <span className="text-micro shrink-0">{formatBytes(item.size)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload(item)
                }}
                className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-(--color-accent)/10 text-(--color-link) transition-all cursor-pointer"
                title="Download"
              >
                <Download size={14} />
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-caption text-center py-8">Empty directory</p>
          )}
        </div>
      )}
    </div>
  )
}
