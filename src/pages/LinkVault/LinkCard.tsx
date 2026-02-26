import { useState } from 'react'
import type { LinkItem } from './types'

interface Props {
  link: LinkItem
  onEdit: (link: LinkItem) => void
  onDelete: (id: string) => void
}

export default function LinkCard({ link, onEdit, onDelete }: Props) {
  const [imgError, setImgError] = useState(false)

  const domain = (() => {
    try { return new URL(link.url).hostname.replace(/^www\./, '') } catch { return link.url }
  })()

  return (
    <div className="group relative bg-surface border border-line rounded-xl p-4 shadow-sm hover:shadow-md hover:border-acc/40 transition-all">
      {/* Top: favicon + title */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {link.favicon && !imgError ? (
            <img src={link.favicon} alt="" className="w-5 h-5 rounded" onError={() => setImgError(true)} />
          ) : (
            <svg className="w-5 h-5 text-fg3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-fg1 hover:text-acc transition-colors line-clamp-1"
          >
            {link.title}
          </a>
          <p className="text-xs text-fg3 mt-0.5 truncate">{domain}</p>
        </div>
      </div>

      {/* Description */}
      {link.description && (
        <p className="mt-2 text-xs text-fg2 line-clamp-2">{link.description}</p>
      )}

      {/* Category + Tags */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-acc/15 text-acc">
          {link.category}
        </span>
        {link.tags.map(t => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-raised text-fg2">
            {t}
          </span>
        ))}
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(link)}
          className="p-1.5 rounded-md bg-raised hover:bg-line text-fg2 hover:text-fg1 transition-colors"
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(link.id)}
          className="p-1.5 rounded-md bg-raised hover:bg-red-500/20 text-fg2 hover:text-red-400 transition-colors"
          title="Delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
