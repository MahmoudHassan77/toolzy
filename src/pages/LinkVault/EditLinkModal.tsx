import { useState, useRef, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import type { LinkItem } from './types'
import { DEFAULT_CATEGORY_SUGGESTIONS } from './types'

interface Props {
  link: LinkItem
  existingCategories: string[]
  onSave: (id: string, patch: Partial<Omit<LinkItem, 'id' | 'createdAt'>>) => void
  onClose: () => void
}

function normalizeUrl(raw: string): string {
  let url = raw.trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  try { return new URL(url).href } catch { return '' }
}

function getFavicon(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch { return '' }
}

export default function EditLinkModal({ link, existingCategories, onSave, onClose }: Props) {
  const [url, setUrl] = useState(link.url)
  const [title, setTitle] = useState(link.title)
  const [category, setCategory] = useState(link.category)
  const [description, setDescription] = useState(link.description)
  const [tags, setTags] = useState<string[]>(link.tags)
  const [tagInput, setTagInput] = useState('')
  const [showCatSuggestions, setShowCatSuggestions] = useState(false)
  const [urlError, setUrlError] = useState('')
  const catRef = useRef<HTMLDivElement>(null)

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
    onSave(link.id, {
      url: normalized,
      title: title.trim() || normalized,
      category: category.trim() || 'General',
      description: description.trim(),
      tags,
      favicon: getFavicon(normalized),
    })
    onClose()
  }

  const inputCls = 'w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-fg1 placeholder:text-fg3 focus:outline-none focus:border-acc transition-colors'

  return (
    <Modal open onClose={onClose} title="Edit Link">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* URL */}
        <div>
          <label className="block text-xs font-medium text-fg2 mb-1">URL</label>
          <input
            type="text"
            value={url}
            onChange={e => { setUrl(e.target.value); setUrlError('') }}
            className={`${inputCls} ${urlError ? 'border-red-500' : ''}`}
          />
          {urlError && <p className="text-red-500 text-xs mt-1">{urlError}</p>}
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-fg2 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Category */}
        <div className="relative" ref={catRef}>
          <label className="block text-xs font-medium text-fg2 mb-1">Category</label>
          <input
            type="text"
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
        <div>
          <label className="block text-xs font-medium text-fg2 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-fg2 mb-1">Tags</label>
          <div className={`${inputCls} flex flex-wrap gap-1.5 items-center !p-2 min-h-[38px]`}>
            {tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 bg-acc/15 text-acc text-xs px-2 py-0.5 rounded-full">
                {t}
                <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-red-400 transition-colors">&times;</button>
              </span>
            ))}
            <input
              type="text"
              placeholder={tags.length === 0 ? 'Comma or Enter to add' : ''}
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="flex-1 min-w-[80px] bg-transparent text-sm text-fg1 placeholder:text-fg3 outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm text-fg2 hover:text-fg1 transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-4 py-1.5 text-sm font-medium rounded-lg bg-acc text-white hover:bg-acc/90 transition-colors">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
