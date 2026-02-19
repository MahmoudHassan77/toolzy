import { useState } from 'react'

type Tab = 'base64-encode' | 'base64-decode' | 'url-encode' | 'url-decode'

function toBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)))
  } catch {
    return 'Error: invalid input'
  }
}

function fromBase64(str: string): string {
  try {
    return decodeURIComponent(escape(atob(str.trim())))
  } catch {
    return 'Error: invalid base64 string'
  }
}

function toUrl(str: string): string {
  try { return encodeURIComponent(str) } catch { return 'Error' }
}

function fromUrl(str: string): string {
  try { return decodeURIComponent(str) } catch { return 'Error: malformed URI component' }
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'base64-encode', label: 'Base64 Encode' },
  { id: 'base64-decode', label: 'Base64 Decode' },
  { id: 'url-encode', label: 'URL Encode' },
  { id: 'url-decode', label: 'URL Decode' },
]

export default function Encoder() {
  const [tab, setTab] = useState<Tab>('base64-encode')
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)

  const output = (() => {
    switch (tab) {
      case 'base64-encode': return toBase64(input)
      case 'base64-decode': return fromBase64(input)
      case 'url-encode':    return toUrl(input)
      case 'url-decode':    return fromUrl(input)
    }
  })()

  async function copy() {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl mx-auto">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-raised rounded-lg w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setInput('') }}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors
              ${tab === t.id ? 'bg-surface text-fg1 shadow-sm' : 'text-fg2 hover:text-fg1'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Input</label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={6}
          placeholder="Enter text to convert..."
          className="resize-none rounded-lg border border-line bg-bg p-3 font-mono text-sm text-fg1 outline-none focus:border-acc"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Output</label>
          <button onClick={copy} className="text-xs text-fg3 hover:text-fg1 transition-colors">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <textarea
          value={output}
          readOnly
          rows={6}
          className="resize-none rounded-lg border border-line bg-raised p-3 font-mono text-sm text-fg1 outline-none"
        />
      </div>
    </div>
  )
}
