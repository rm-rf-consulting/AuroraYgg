import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <Loader2
      size={size}
      className={cn('animate-spin text-(--color-text-tertiary)', className)}
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size={24} />
    </div>
  )
}
