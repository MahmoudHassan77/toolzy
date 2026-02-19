import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Spinner from '../../components/ui/Spinner'
import { useTheme } from '../../contexts/ThemeContext'

interface MarkdownViewerProps {
  fileHandle: FileSystemFileHandle
}

export default function MarkdownViewer({ fileHandle }: MarkdownViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isDark } = useTheme()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fileHandle
      .getFile()
      .then((f) => f.text())
      .then((text) => {
        if (!cancelled) { setContent(text); setLoading(false) }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to read file')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [fileHandle])

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner /></div>
  }

  if (error) {
    return <div className="p-4 text-red-500 text-sm">Error: {error}</div>
  }

  if (!fileHandle.name.match(/\.(md|markdown|txt)$/i)) {
    return (
      <div className="p-6 text-fg3 text-sm flex flex-col items-center gap-2">
        <span className="text-2xl">📄</span>
        <span>Preview not available for this file type.</span>
      </div>
    )
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''} prose-a:text-acc prose-headings:font-bold prose-code:text-acc`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content ?? ''}</ReactMarkdown>
      </div>
    </div>
  )
}
