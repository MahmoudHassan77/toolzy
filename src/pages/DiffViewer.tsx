import { useMemo, useState } from 'react'
import { diffWords, diffLines } from 'diff'

type Mode = 'words' | 'lines'

// ── Word diff ──────────────────────────────────────────────────────────────
function WordDiff({ original, modified }: { original: string; modified: string }) {
  const parts = useMemo(() => diffWords(original, modified), [original, modified])
  return (
    <div className="rounded-lg border border-line bg-bg p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words overflow-x-auto">
      {parts.map((p, i) =>
        p.added ? (
          <mark key={i} className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded px-0.5 not-italic">
            {p.value}
          </mark>
        ) : p.removed ? (
          <del key={i} className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 rounded px-0.5 no-underline line-through">
            {p.value}
          </del>
        ) : (
          <span key={i} className="text-fg1">{p.value}</span>
        )
      )}
    </div>
  )
}

// ── Line diff (unified view) ───────────────────────────────────────────────
function LineDiff({ original, modified }: { original: string; modified: string }) {
  const lines = useMemo(() => {
    const parts = diffLines(original, modified)
    const rows: { prefix: string; text: string; cls: string }[] = []

    for (const p of parts) {
      // diffLines ends each chunk with '\n'; split and drop trailing empty
      const ls = p.value.split('\n')
      if (ls[ls.length - 1] === '') ls.pop()

      if (p.added) {
        ls.forEach(l => rows.push({ prefix: '+', text: l, cls: 'bg-green-50 dark:bg-green-900/25 text-green-800 dark:text-green-300' }))
      } else if (p.removed) {
        ls.forEach(l => rows.push({ prefix: '-', text: l, cls: 'bg-red-50 dark:bg-red-900/25 text-red-800 dark:text-red-300' }))
      } else {
        ls.forEach(l => rows.push({ prefix: ' ', text: l, cls: 'text-fg2' }))
      }
    }
    return rows
  }, [original, modified])

  return (
    <div className="rounded-lg border border-line overflow-hidden">
      <div className="font-mono text-sm bg-bg overflow-x-auto">
        {lines.map((row, i) => (
          <div key={i} className={`flex gap-3 px-4 py-0.5 ${row.cls}`}>
            <span className="select-none opacity-50 w-3 shrink-0">{row.prefix}</span>
            <span className="break-all">{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function DiffViewer() {
  const [original, setOriginal] = useState('')
  const [modified, setModified] = useState('')
  const [mode, setMode] = useState<Mode>('words')

  const hasContent = !!(original || modified)

  const wordParts = useMemo(() => diffWords(original, modified), [original, modified])
  const lineParts = useMemo(() => diffLines(original, modified), [original, modified])

  const identical = hasContent && wordParts.every(p => !p.added && !p.removed)

  const wordStats = useMemo(() => wordParts.reduce(
    (acc, p) => {
      const n = p.value.trim().split(/\s+/).filter(Boolean).length
      if (p.added)   acc.added   += n
      if (p.removed) acc.removed += n
      return acc
    },
    { added: 0, removed: 0 }
  ), [wordParts])

  const lineStats = useMemo(() => lineParts.reduce(
    (acc, p) => {
      const n = p.value.split('\n').filter(l => l !== '').length
      if (p.added)   acc.added   += n
      if (p.removed) acc.removed += n
      return acc
    },
    { added: 0, removed: 0 }
  ), [lineParts])

  const stats = mode === 'words' ? wordStats : lineStats
  const unit  = mode === 'words' ? 'word' : 'line'

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 h-full overflow-y-auto">
      {/* Input panels */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Original</label>
          <textarea
            value={original}
            onChange={e => setOriginal(e.target.value)}
            rows={8}
            placeholder="Paste original text..."
            className="resize-none rounded-lg border border-line bg-bg p-3 font-mono text-sm text-fg1 outline-none focus:border-acc"
            spellCheck={false}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-fg3">Modified</label>
          <textarea
            value={modified}
            onChange={e => setModified(e.target.value)}
            rows={8}
            placeholder="Paste modified text..."
            className="resize-none rounded-lg border border-line bg-bg p-3 font-mono text-sm text-fg1 outline-none focus:border-acc"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Mode switcher + stats */}
      {hasContent && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-0.5 bg-raised rounded-lg shrink-0">
            {(['words', 'lines'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors
                  ${mode === m ? 'bg-surface text-fg1 shadow-sm' : 'text-fg2 hover:text-fg1'}`}
              >
                {m === 'words' ? 'Word diff' : 'Line diff'}
              </button>
            ))}
          </div>

          {identical ? (
            <span className="text-sm text-fg3">Texts are identical</span>
          ) : (
            <span className="text-sm flex gap-3">
              <span className="text-green-600 dark:text-green-400 font-medium">
                +{stats.added} {unit}{stats.added !== 1 ? 's' : ''}
              </span>
              <span className="text-red-600 dark:text-red-400 font-medium">
                −{stats.removed} {unit}{stats.removed !== 1 ? 's' : ''}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Diff output */}
      {hasContent && !identical && (
        mode === 'words'
          ? <WordDiff original={original} modified={modified} />
          : <LineDiff original={original} modified={modified} />
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="flex-1 flex items-center justify-center text-fg3 text-sm">
          Paste text in both panels above — diff updates live
        </div>
      )}
    </div>
  )
}
