import { useMemo, useState } from 'react'

const FLAG_OPTIONS = ['g', 'i', 'm', 's'] as const

export default function RegexTester() {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [testStr, setTestStr] = useState('')

  function toggleFlag(f: string) {
    setFlags(prev => prev.includes(f) ? prev.replace(f, '') : prev + f)
  }

  const { matches, highlighted, error } = useMemo(() => {
    if (!pattern) return { matches: [] as RegExpMatchArray[], highlighted: null, error: '' }
    try {
      const safeFlags = flags.includes('g') ? flags : flags + 'g'
      const re = new RegExp(pattern, safeFlags)
      const allMatches = [...testStr.matchAll(re)]

      const parts: { text: string; match: boolean }[] = []
      let last = 0
      for (const m of allMatches) {
        const start = m.index!
        const end = start + m[0].length
        if (start > last) parts.push({ text: testStr.slice(last, start), match: false })
        parts.push({ text: m[0], match: true })
        last = end
      }
      if (last < testStr.length) parts.push({ text: testStr.slice(last), match: false })

      return { matches: allMatches, highlighted: parts, error: '' }
    } catch (e: unknown) {
      return { matches: [], highlighted: null, error: e instanceof Error ? e.message : 'Invalid regex' }
    }
  }, [pattern, flags, testStr])

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl mx-auto">
      {/* Pattern input */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Pattern</label>
        <div className="flex items-center rounded-lg border border-line bg-bg overflow-hidden focus-within:border-acc transition-colors">
          <span className="px-3 text-fg3 font-mono text-sm select-none">/</span>
          <input
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            placeholder="Enter regex..."
            className="flex-1 py-2.5 bg-transparent font-mono text-sm text-fg1 outline-none"
          />
          <span className="px-1 text-fg3 font-mono text-sm select-none">/</span>
          <input
            value={flags}
            onChange={e => setFlags(e.target.value)}
            className="w-12 py-2.5 pr-3 bg-transparent font-mono text-sm text-acc outline-none"
          />
        </div>
        <div className="flex gap-2">
          {FLAG_OPTIONS.map(f => (
            <button
              key={f}
              onClick={() => toggleFlag(f)}
              className={`px-2.5 py-0.5 text-xs rounded border font-mono transition-colors
                ${flags.includes(f)
                  ? 'border-acc bg-acc/10 text-acc'
                  : 'border-line text-fg3 hover:border-fg2'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Test string */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Test String</label>
        <textarea
          value={testStr}
          onChange={e => setTestStr(e.target.value)}
          rows={5}
          placeholder="Enter text to test against..."
          className="resize-none rounded-lg border border-line bg-bg p-3 font-mono text-sm text-fg1 outline-none focus:border-acc"
        />
      </div>

      {/* Highlighted result */}
      {highlighted && (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">
                Highlighted Matches
              </label>
              <span className="text-xs text-fg3">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
            </div>
            <div className="rounded-lg border border-line bg-bg p-3 font-mono text-sm text-fg1 min-h-12 whitespace-pre-wrap break-all leading-relaxed">
              {highlighted.length === 0 && testStr
                ? <span className="text-fg3">No matches</span>
                : highlighted.map((p, i) =>
                    p.match
                      ? <mark key={i} className="bg-acc/30 text-fg1 rounded-sm px-0.5">{p.text}</mark>
                      : <span key={i}>{p.text}</span>
                  )
              }
            </div>
          </div>

          {matches.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Matches</label>
              <div className="rounded-lg border border-line bg-surface divide-y divide-line max-h-48 overflow-y-auto">
                {matches.map((m, i) => (
                  <div key={i} className="px-4 py-2 flex items-center gap-4 text-sm">
                    <span className="text-fg3 text-xs w-5 shrink-0">#{i + 1}</span>
                    <code className="text-fg1 font-mono flex-1 truncate">{m[0]}</code>
                    <span className="text-fg3 text-xs shrink-0">index {m.index}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
