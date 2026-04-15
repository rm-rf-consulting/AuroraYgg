import { useState } from 'react'
import { Play, Pause, Volume2, Maximize, X, FileVideo, FileAudio, Image } from 'lucide-react'

interface Props {
  name: string
  url: string // URL to stream from (daemon serves via /api/v1/view_files/{id}/stream)
  onClose: () => void
}

type MediaType = 'video' | 'audio' | 'image' | 'unknown'

const VIDEO_EXT = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'ogv']
const AUDIO_EXT = ['mp3', 'flac', 'ogg', 'wav', 'aac', 'm4a', 'wma', 'opus']
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico']

function detectMediaType(filename: string): MediaType {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (VIDEO_EXT.includes(ext)) return 'video'
  if (AUDIO_EXT.includes(ext)) return 'audio'
  if (IMAGE_EXT.includes(ext)) return 'image'
  return 'unknown'
}

export function MediaPreview({ name, url, onClose }: Props) {
  const type = detectMediaType(name)
  const [error, setError] = useState(false)

  if (type === 'unknown' || error) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 z-(--z-modal-backdrop) backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 z-(--z-modal) flex items-center justify-center">
        <div className="relative w-full max-w-4xl max-h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 shrink-0">
            <div className="flex items-center gap-2">
              {type === 'video' && <FileVideo size={16} className="text-(--color-link)" />}
              {type === 'audio' && <FileAudio size={16} className="text-(--color-success)" />}
              {type === 'image' && <Image size={16} className="text-(--color-warning)" />}
              <span className="text-sm text-white font-medium truncate">{name}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center overflow-hidden rounded-xl">
            {type === 'video' && (
              <video
                src={url}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-xl"
                onError={() => setError(true)}
              >
                Your browser does not support video playback.
              </video>
            )}

            {type === 'audio' && (
              <div className="w-full max-w-md p-8 rounded-2xl bg-(--color-surface-2) flex flex-col items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-(--color-accent)/15 flex items-center justify-center">
                  <FileAudio size={40} className="text-(--color-accent)" />
                </div>
                <p className="text-sm text-(--color-text-primary) font-medium text-center truncate w-full">
                  {name}
                </p>
                <audio
                  src={url}
                  controls
                  autoPlay
                  className="w-full"
                  onError={() => setError(true)}
                />
              </div>
            )}

            {type === 'image' && (
              <img
                src={url}
                alt={name}
                className="max-w-full max-h-[80vh] rounded-xl object-contain"
                onError={() => setError(true)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/** Check if a filename is previewable */
export function isPreviewable(filename: string): boolean {
  return detectMediaType(filename) !== 'unknown'
}
