import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MdEditor() {
  const [md, setMd] = useState(
    '# Hello\n\nStart writing **markdown** here...\n\n- Item 1\n- Item 2\n\n> Blockquote example\n'
  )
  const previewRef = useRef<HTMLDivElement>(null)

  function exportHtml() {
    if (!previewRef.current) return
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Export</title></head>
<body style="font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem">
${previewRef.current.innerHTML}
</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-line bg-surface shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-fg3">Markdown Editor</span>
        <button
          onClick={exportHtml}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-acc text-accon hover:bg-acch transition-colors"
        >
          Export HTML
        </button>
      </div>
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Editor pane */}
        <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-line min-w-0 min-h-0">
          <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg3 border-b border-line bg-raised shrink-0">
            Editor
          </div>
          <textarea
            value={md}
            onChange={e => setMd(e.target.value)}
            className="flex-1 resize-none p-4 font-mono text-sm bg-bg text-fg1 outline-none leading-relaxed min-h-[200px]"
            spellCheck={false}
          />
        </div>
        {/* Preview pane */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg3 border-b border-line bg-raised shrink-0">
            Preview
          </div>
          <div
            ref={previewRef}
            className="flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
