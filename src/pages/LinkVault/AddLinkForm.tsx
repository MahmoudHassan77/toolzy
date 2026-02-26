import { useState, useRef, useEffect } from 'react'
import { DEFAULT_CATEGORY_SUGGESTIONS } from './types'

interface Props {
  existingCategories: string[]
  onAdd: (data: { url: string; title: string; category: string; description: string; tags: string[]; favicon: string }) => void
  onCancel: () => void
}

function getFavicon(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

function normalizeUrl(raw: string): string {
  let url = raw.trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  try {
    return new URL(url).href
  } catch {
    return ''
  }
}

export default function AddLinkForm({ existingCategories, onAdd, onCancel }: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showCatSuggestions, setShowCatSuggestions] = useState(false)
  const [urlError, setUrlError] = useState('')
  const urlRef = useRef<HTMLInputElement>(null)
  const catRef = useRef<HTMLDivElement>(null)

  useEffect(() => { urlRef.current?.focus() }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setShowCatSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allCategories = Array.from(new Set([...existingCategories, ...DEFAULT_CATEGORY_SUGGESTIONS]))
  const filteredCats = category
    ? allCategories.filter(c => c.toLowerCase().includes(category.toLowerCase()))
    : allCategories

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const val = tagInput.trim().replace(/,$/g, '')
      if (val && !tags.includes(val)) setTags([...tags, val])
      setTagInput('')
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalized = normalizeUrl(url)
    if (!normalized) {
      setUrlError('Please enter a valid URL')
      return
    }
    onAdd({
      url: normalized,
      title: title.trim() || normalized,
      category: category.trim() || 'General',
      description: description.trim(),
      tags,
      favicon: getFavicon(normalized),
    })
  }

  const inputCls = 'w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-fg1 placeholder:text-fg3 focus:outline-none focus:border-acc transition-colors'

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-fg1 mb-4">Add New Link</h3>
      <div className="flex flex-col gap-3">
        {/* URL */}
        <div>
          <input
            ref={urlRef}
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={e => { setUrl(e.target.value); setUrlError('') }}
            className={`${inputCls} ${urlError ? 'border-red-500' : ''}`}
          />
          {urlError && <p className="text-red-500 text-xs mt-1">{urlError}</p>}
        </div>

        {/* Title */}
        <input
          type="text"
          placeholder="Title (optional, auto-filled from URL)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className={inputCls}
        />

        {/* Category combo-box */}
        <div className="relative" ref={catRef}>
          <input
            type="text"
            placeholder="Category (e.g. Work, Learning)"
            value={category}
            onChange={e => { setCategory(e.target.value); setShowCatSuggestions(true) }}
            onFocus={() => setShowCatSuggestions(true)}
            className={inputCls}
          />
          {showCatSuggestions && filteredCats.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {filteredCats.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCategory(c); setShowCatSuggestions(false) }}
                  className="block w-full text-left px-3 py-1.5 text-sm text-fg1 hover:bg-raised transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className={`${inputCls} resize-none`}
        />

        {/* Tags */}
        <div className={`${inputCls} flex flex-wrap gap-1.5 items-center !p-2 min-h-[38px]`}>
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 bg-acc/15 text-acc text-xs px-2 py-0.5 rounded-full">
              {t}
              <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-red-400 transition-colors">&times;</button>
            </span>
          ))}
          <input
            type="text"
            placeholder={tags.length === 0 ? 'Tags (comma or Enter to add)' : ''}
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            className="flex-1 min-w-[100px] bg-transparent text-sm text-fg1 placeholder:text-fg3 outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm text-fg2 hover:text-fg1 transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-4 py-1.5 text-sm font-medium rounded-lg bg-acc text-white hover:bg-acc/90 transition-colors">
            Add Link
          </button>
        </div>
      </div>
    </form>
  )
}
