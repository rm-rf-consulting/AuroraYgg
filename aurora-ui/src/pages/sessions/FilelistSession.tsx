import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getSocket } from '@/api/socket'
import { formatBytes } from '@/lib/utils'
import { File, Folder, ChevronRight, Download } from 'lucide-react'

interface FilelistItem {
  name: string
  type: {
    id: string
    str: string
    content_type?: string
  }
  size: number
  tth?: string
  date?: number
  path: string
  dupe?: {
    id: string
    paths: string[]
  }
}

interface Filelist {
  id: number
  user: {
    cid: string
    nick: string
    hub_url: string
  }
  state: {
    id: string
    str: string
  }
  location?: {
    path: string
  }
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
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    socket.get(`filelists/${listId}`).then((data) => {
      setFilelist(data as Filelist)
    }).catch(() => {})

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
      await socket.post(`filelists/${listId}/download`, {
        list_path: item.path + item.name,
      })
    } catch {}
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-heading text-2xl text-(--color-text-primary)">
          {filelist?.user.nick ?? 'Filelist'}
        </h1>
        {filelist && (
          <p className="text-caption mt-0.5">{filelist.state.str}</p>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-xs">
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
              onClick={() =>
                fetchDirectory('/' + breadcrumbs.slice(0, i + 1).join('/') + '/')
              }
              className="text-(--color-link) hover:underline cursor-pointer"
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {/* File list */}
      {loading ? (
        <p className="text-caption text-center py-8">Loading...</p>
      ) : (
        <div className="rounded-xl bg-(--color-surface-2) divide-y divide-(--color-glass-border) overflow-hidden">
          {items.map((item, i) => (
            <div
              key={i}
              className="px-4 py-2 flex items-center gap-3 hover:bg-white/2 transition-colors cursor-pointer"
              onClick={() => handleNavigate(item)}
            >
              {item.type.id === 'directory' ? (
                <Folder size={16} className="text-(--color-warning) shrink-0" />
              ) : (
                <File size={16} className="text-(--color-text-tertiary) shrink-0" />
              )}
              <span className="text-sm text-(--color-text-primary) truncate flex-1">
                {item.name}
              </span>
              <span className="text-micro shrink-0">{formatBytes(item.size)}</span>
              {item.type.id !== 'directory' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(item)
                  }}
                  className="p-1 rounded-md hover:bg-(--color-accent)/10 text-(--color-link) transition-colors"
                  title="Download"
                >
                  <Download size={14} />
                </button>
              )}
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
