import { useState } from 'react'

const MIME_TYPES = [
  { label: 'PNG', value: 'image/png' },
  { label: 'JPEG', value: 'image/jpeg' },
  { label: 'GIF', value: 'image/gif' },
  { label: 'WebP', value: 'image/webp' },
  { label: 'SVG', value: 'image/svg+xml' },
  { label: 'BMP', value: 'image/bmp' },
]

export default function Base64Image() {
  const [base64, setBase64] = useState('')
  const [mime, setMime] = useState('image/png')
  const [error, setError] = useState('')

  const raw = base64.trim()
  const dataUrl = raw
    ? raw.startsWith('data:')
      ? raw
      : `data:${mime};base64,${raw}`
    : ''

  function download() {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    const ext = mime.split('/')[1].replace('+xml', '')
    a.download = `image.${ext}`
    a.click()
  }

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl mx-auto">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">MIME Type</label>
        <select
          value={mime}
          onChange={e => setMime(e.target.value)}
          className="w-fit rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg1 outline-none focus:border-acc"
        >
          {MIME_TYPES.map(m => (
            <option key={m.value} value={m.value}>{m.label} ({m.value})</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">
          Base64 String
          <span className="ml-1 normal-case font-normal text-fg3">(with or without <code className="font-mono">data:</code> prefix)</span>
        </label>
        <textarea
          value={base64}
          onChange={e => { setBase64(e.target.value); setError('') }}
          rows={6}
          placeholder="Paste base64 encoded image string here..."
          className="resize-none rounded-lg border border-line bg-bg p-3 font-mono text-xs text-fg1 outline-none focus:border-acc"
          spellCheck={false}
        />
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {dataUrl && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Preview</label>
            <button
              onClick={download}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-acc text-accon hover:bg-acch transition-colors"
            >
              Download
            </button>
          </div>
          <div className="rounded-lg border border-line bg-raised p-4 flex items-center justify-center min-h-48">
            <img
              src={dataUrl}
              alt="Preview"
              className="max-w-full max-h-96 object-contain rounded"
              onError={() => setError('Failed to load image. Check MIME type or base64 data.')}
            />
          </div>
        </div>
      )}

      {!dataUrl && (
        <div className="rounded-lg border border-dashed border-line flex items-center justify-center min-h-48 text-fg3 text-sm">
          Image preview will appear here
        </div>
      )}
    </div>
  )
}
