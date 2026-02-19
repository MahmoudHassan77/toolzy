import { useState } from 'react'

export default function JsonFormatter() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function format() {
    try {
      const parsed = JSON.parse(input)
      setOutput(JSON.stringify(parsed, null, 2))
      setError('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid JSON')
      setOutput('')
    }
  }

  function minify() {
    try {
      const parsed = JSON.parse(input)
      setOutput(JSON.stringify(parsed))
      setError('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid JSON')
      setOutput('')
    }
  }

  async function copy() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={format}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-acc text-accon hover:bg-acch transition-colors"
        >
          Format
        </button>
        <button
          onClick={minify}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-line bg-surface text-fg1 hover:bg-raised transition-colors"
        >
          Minify
        </button>
        <button
          onClick={copy}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-line bg-surface text-fg1 hover:bg-raised transition-colors ml-auto"
        >
          {copied ? 'Copied!' : 'Copy Output'}
        </button>
      </div>

      {error && (
        <div className="shrink-0 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row flex-1 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col gap-1.5 min-w-0 min-h-0">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3 shrink-0">Input</label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={'{"key": "value"}'}
            className="flex-1 resize-none rounded-lg border border-line bg-bg p-3 font-mono text-sm text-fg1 outline-none focus:border-acc min-h-[160px]"
            spellCheck={false}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5 min-w-0 min-h-0">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3 shrink-0">Output</label>
          <textarea
            value={output}
            readOnly
            className="flex-1 resize-none rounded-lg border border-line bg-raised p-3 font-mono text-sm text-fg1 outline-none min-h-[160px]"
          />
        </div>
      </div>
    </div>
  )
}
