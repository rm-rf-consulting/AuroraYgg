import { Component, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle size={32} className="text-(--color-error)" />
          <p className="text-sm text-(--color-text-primary) font-medium">
            Something went wrong
          </p>
          <p className="text-micro max-w-md text-center">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-4 py-1.5 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-4) text-xs text-(--color-text-secondary) transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
