import Markdown from 'react-markdown'

interface Props {
  nick: string
  text: string
  time: number
  isOwn?: boolean
  isSystem?: boolean
  thirdPerson?: boolean
}

// Auto-linkify URLs in text
function linkify(text: string): string {
  return text.replace(
    /(https?:\/\/[^\s<]+)/g,
    '[$1]($1)'
  )
}

export function ChatBubble({ nick, text, time, isOwn, isSystem, thirdPerson }: Props) {
  const timestamp = new Date(time * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[11px] text-(--color-text-disabled) italic">{text}</span>
      </div>
    )
  }

  return (
    <div className={`flex gap-2 py-0.5 ${thirdPerson ? 'italic' : ''}`}>
      <span className="text-[11px] shrink-0 opacity-40 pt-0.5 tabular-nums font-mono">
        {timestamp}
      </span>
      <span
        className={`text-xs font-semibold shrink-0 cursor-pointer hover:underline ${
          isOwn ? 'text-(--color-success)' : 'text-(--color-link)'
        }`}
      >
        {nick}
      </span>
      <span className="text-xs text-(--color-text-secondary) break-words min-w-0 [&_a]:text-(--color-link) [&_a]:hover:underline [&_code]:bg-white/5 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_strong]:text-(--color-text-primary) [&_em]:text-(--color-text-secondary)">
        <Markdown
          allowedElements={['p', 'a', 'strong', 'em', 'code', 'br']}
          unwrapDisallowed
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {linkify(text)}
        </Markdown>
      </span>
    </div>
  )
}
