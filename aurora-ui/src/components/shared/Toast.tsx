import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
  add: (message: string, type?: ToastItem['type'], duration?: number) => void
  remove: (id: number) => void
}

let nextId = 0

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  add: (message, type = 'info', duration = 4000) => {
    const id = ++nextId
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }))
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Shorthand
export const toast = {
  success: (msg: string) => useToast.getState().add(msg, 'success'),
  error: (msg: string) => useToast.getState().add(msg, 'error', 6000),
  info: (msg: string) => useToast.getState().add(msg, 'info'),
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const COLORS = {
  success: 'bg-(--color-success)/15 border-(--color-success)/30 text-(--color-success)',
  error: 'bg-(--color-error)/15 border-(--color-error)/30 text-(--color-error)',
  info: 'bg-(--color-accent)/15 border-(--color-accent)/30 text-(--color-link)',
}

export function ToastContainer() {
  const toasts = useToast((s) => s.toasts)
  const remove = useToast((s) => s.remove)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-(--z-toast) flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.type]
        return (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border backdrop-blur-lg ${COLORS[t.type]} animate-[slideUp_200ms_ease-out]`}
          >
            <Icon size={16} className="shrink-0 mt-0.5" />
            <span className="text-xs flex-1 text-(--color-text-primary)">
              {t.message}
            </span>
            <button
              onClick={() => remove(t.id)}
              className="text-(--color-text-tertiary) hover:text-(--color-text-primary) shrink-0 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
