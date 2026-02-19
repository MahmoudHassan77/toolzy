import { useState } from 'react'
import { diffLines, Change } from 'diff'

function splitLines(part: Change): string[] {
  const lines = part.value.split('\n')
  // diffLines includes a trailing newline in each chunk; remove the last empty entry
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

export default function DiffViewer() {
  const [original, setOriginal] = useState('')
  const [modified, setModified] = useState('')
  const [diff, setDiff] = useState<Change[]>([])
  const [compared, setCompared] = useState(false)

  function compare() {
    setDiff(diffLines(original, modified))
    setCompared(true)
  }

  const added = diff.reduce((n, p) => n + (p.added ? splitLines(p).length : 0), 0)
  const removed = diff.reduce((n, p) => n + (p.removed ? splitLines(p).length : 0), 0)

  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-y-auto">
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

      <button
        onClick={compare}
        className="self-start px-4 py-2 text-sm font-medium rounded-lg bg-acc text-accon hover:bg-acch transition-colors"
      >
        Compare
      </button>

      {compared && (
        <div className="rounded-lg border border-line overflow-hidden">
          <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-fg3 bg-raised border-b border-line flex items-center gap-4">
            <span>Diff Result</span>
            {(added > 0 || removed > 0) && (
              <span className="normal-case">
                <span className="text-green-600 dark:text-green-400">+{added}</span>
                {' '}
                <span className="text-red-600 dark:text-red-400">-{removed}</span>
              </span>
            )}
          </div>
          <div className="font-mono text-sm bg-bg overflow-x-auto">
            {diff.length === 0 ? (
              <div className="px-4 py-3 text-fg3">Files are identical</div>
            ) : (
              diff.map((part, partIdx) =>
                splitLines(part).map((line, lineIdx) => (
                  <div
                    key={`${partIdx}-${lineIdx}`}
                    className={
                      part.added
                        ? 'bg-green-50 dark:bg-green-900/25 text-green-800 dark:text-green-300 px-4 py-0.5'
                        : part.removed
                        ? 'bg-red-50 dark:bg-red-900/25 text-red-800 dark:text-red-300 px-4 py-0.5'
                        : 'text-fg2 px-4 py-0.5'
                    }
                  >
                    <span className="select-none mr-3 opacity-50 w-3 inline-block">
                      {part.added ? '+' : part.removed ? '-' : ' '}
                    </span>
                    {line}
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
