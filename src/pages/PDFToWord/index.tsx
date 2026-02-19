import { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useDropzone } from 'react-dropzone'
import { RichParagraph, RichSpan, buildAndDownloadDocx } from './docxBuilder'
import PreviewPane from './PreviewPane'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

// ── internal types ────────────────────────────────────────────────────────────

interface TextItemEx {
  str: string
  x: number          // transform[4]  — left edge of glyph
  y: number          // transform[5]  — PDF baseline (bottom-up)
  width: number      // glyph advance width in user-space
  height: number     // approximate font size in points
  fontName: string
  bold: boolean
  italic: boolean
}

interface RawLine {
  items: TextItemEx[]
  y: number
  maxHeight: number
}

// ── font helpers ──────────────────────────────────────────────────────────────

function isBold(name: string) {
  const n = name.toLowerCase()
  return n.includes('bold') || n.includes('black') || n.includes('heavy') || n.includes('demi')
}
function isItalic(name: string) {
  const n = name.toLowerCase()
  return n.includes('italic') || n.includes('oblique')
}

// ── line grouping ─────────────────────────────────────────────────────────────

function groupIntoLines(items: TextItemEx[], tolerance: number): RawLine[] {
  const lines: RawLine[] = []
  for (const item of items) {
    const existing = lines.find((l) => Math.abs(l.y - item.y) <= tolerance)
    if (existing) {
      existing.items.push(item)
      existing.maxHeight = Math.max(existing.maxHeight, item.height)
    } else {
      lines.push({ y: item.y, items: [item], maxHeight: item.height })
    }
  }
  return lines
}

// ── span builder: smart space insertion ──────────────────────────────────────
// PDF items don't always carry their own spaces. We detect gaps between items
// and insert a space when the horizontal gap is wider than ~20% of font height.

function buildSpans(items: TextItemEx[]): RichSpan[] {
  const spans: RichSpan[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    let text = item.str
    const fontSize = item.height > 1 ? Math.round(item.height) : 12

    // Insert space if there is a notable gap before this item
    if (i > 0) {
      const prev = items[i - 1]
      const prevEnd = prev.x + prev.width
      const gap = item.x - prevEnd
      const spaceThreshold = (prev.height || 10) * 0.2
      const alreadySpaced = prev.str.endsWith(' ') || item.str.startsWith(' ')
      if (!alreadySpaced && gap > spaceThreshold) {
        text = ' ' + text
      }
    }

    if (!text) continue

    // Merge with last span when style matches (avoids many 1-char runs)
    if (spans.length > 0) {
      const last = spans[spans.length - 1]
      const sameBold = last.bold === item.bold
      const sameItalic = last.italic === item.italic
      const sameSize = Math.abs(last.fontSize - fontSize) < 2
      if (sameBold && sameItalic && sameSize) {
        last.text += text
        continue
      }
    }

    spans.push({ text, bold: item.bold, italic: item.italic, fontSize })
  }

  return spans
}

// ── alignment detector ────────────────────────────────────────────────────────

function detectAlign(
  line: RawLine,
  pageWidth: number
): 'left' | 'center' | 'right' {
  if (line.items.length === 0) return 'left'
  const minX = Math.min(...line.items.map((i) => i.x))
  const maxX = Math.max(...line.items.map((i) => i.x + i.width))
  const lineWidth = maxX - minX
  const centerX = minX + lineWidth / 2
  const pageCenterX = pageWidth / 2
  const rightMargin = pageWidth - maxX

  if (Math.abs(centerX - pageCenterX) < pageWidth * 0.08) return 'center'
  if (rightMargin < pageWidth * 0.12 && minX > pageWidth * 0.12) return 'right'
  return 'left'
}

// ── main extraction ───────────────────────────────────────────────────────────

async function extractParagraphs(file: File): Promise<RichParagraph[]> {
  const ab = await file.arrayBuffer()
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise

  const allParagraphs: RichParagraph[] = []

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const pageWidth = viewport.width
    const content = await page.getTextContent()

    // ── 1. collect items ──────────────────────────────────────────────────
    const items: TextItemEx[] = []
    for (const raw of content.items) {
      if (!('str' in raw)) continue       // skip TextMarkedContent
      if (!raw.str) continue              // skip truly empty strings
      // height from the item; fall back to the scale component of the matrix
      const h = Math.abs((raw as { height?: number }).height ?? 0)
        || Math.abs(raw.transform[3])
        || Math.abs(raw.transform[0])
      items.push({
        str: raw.str,
        x: raw.transform[4],
        y: raw.transform[5],
        width: (raw as { width?: number }).width ?? 0,
        height: h,
        fontName: (raw as { fontName?: string }).fontName ?? '',
        bold: isBold((raw as { fontName?: string }).fontName ?? ''),
        italic: isItalic((raw as { fontName?: string }).fontName ?? ''),
      })
    }

    if (items.length === 0) continue

    // ── 2. adaptive tolerance based on median height ───────────────────────
    const heights = items.map((i) => i.height).filter((h) => h > 1).sort((a, b) => a - b)
    const medH = heights[Math.floor(heights.length / 2)] || 10
    const tolerance = medH * 0.45

    // ── 3. group into lines, sort top→bottom ──────────────────────────────
    // PDF Y origin is bottom-left → sort descending = top of page first
    const lines = groupIntoLines(items, tolerance)
    lines.sort((a, b) => b.y - a.y)

    // ── 4. sort items left→right within each line ─────────────────────────
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x)
    }

    // ── 5. compute modal (most-common) font size = body text baseline ─────
    const sizeBuckets: Record<number, number> = {}
    for (const item of items) {
      const sz = Math.round(item.height)
      if (sz > 1) sizeBuckets[sz] = (sizeBuckets[sz] || 0) + 1
    }
    const bodyFontSize = Number(
      Object.entries(sizeBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12
    )

    // ── 6. build paragraphs ───────────────────────────────────────────────
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]
      const spans = buildSpans(line.items)
      if (spans.length === 0 || spans.every((s) => !s.text.trim())) continue

      // Space-before: vertical gap significantly larger than normal line spacing
      let spaceBefore = false
      if (li > 0) {
        const prev = lines[li - 1]
        const gap = prev.y - line.y                  // positive = downward
        const normalSpacing = prev.maxHeight * 1.4   // expected single-spacing
        spaceBefore = gap > normalSpacing * 1.7
      }

      // Heading detection: larger than body OR bold+larger-than-body
      const lineMaxH = line.maxHeight
      const relSize = lineMaxH / (bodyFontSize || 12)
      const allBold = line.items.every((i) => i.bold)
      const isHeading = relSize >= 1.25 || (allBold && relSize >= 1.1)

      let headingLevel: 1 | 2 | 3 = 2
      if (relSize >= 1.8) headingLevel = 1
      else if (relSize >= 1.35) headingLevel = 2
      else headingLevel = 3

      const align = detectAlign(line, pageWidth)

      allParagraphs.push({ spans, isHeading, headingLevel, spaceBefore, align })
    }
  }

  return allParagraphs
}

// ── component ─────────────────────────────────────────────────────────────────

export default function PDFToWord() {
  const [fileName, setFileName] = useState('')
  const [paragraphs, setParagraphs] = useState<RichParagraph[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    onDrop: async (files) => {
      if (!files[0]) return
      setLoading(true)
      setError(null)
      setParagraphs(null)
      setFileName(files[0].name)
      try {
        const result = await extractParagraphs(files[0])
        setParagraphs(result)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to extract text')
      } finally {
        setLoading(false)
      }
    },
  })

  const handleDownload = async () => {
    if (!paragraphs) return
    setDownloading(true)
    try {
      await buildAndDownloadDocx(paragraphs, fileName)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const handleReset = () => {
    setParagraphs(null)
    setFileName('')
    setError(null)
  }

  const nonEmpty = paragraphs?.filter((p) =>
    p.spans.some((s) => s.text.trim())
  ) ?? []

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg1 mb-1">PDF to Word</h2>
        <p className="text-sm text-fg2">
          Converts text PDFs to .docx preserving bold, italic, font sizes, heading levels,
          paragraph spacing, and reading order.
        </p>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/60 text-red-400 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {!paragraphs && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors
            ${isDragActive
              ? 'border-acc bg-acc/10'
              : 'border-line2 hover:border-acc bg-raised'
            }`}
        >
          <input {...getInputProps()} />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner />
              <p className="text-sm text-fg2">Extracting text and styles…</p>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3">📄</div>
              <p className="text-sm text-fg1 mb-1">
                {isDragActive ? 'Drop your PDF here' : 'Drag & drop a PDF, or click to browse'}
              </p>
              <p className="text-xs text-fg3">Text-based PDFs only · .pdf files accepted</p>
            </>
          )}
        </div>
      )}

      {paragraphs && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-fg1">{fileName}</p>
              <p className="text-sm text-fg2">
                {nonEmpty.length} paragraph{nonEmpty.length !== 1 ? 's' : ''} extracted
                {' · '}
                {paragraphs.filter((p) => p.isHeading).length} heading
                {paragraphs.filter((p) => p.isHeading).length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleReset}>
                Upload Another
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={downloading || nonEmpty.length === 0}
              >
                {downloading ? 'Generating…' : 'Download .docx'}
              </Button>
            </div>
          </div>

          {nonEmpty.length === 0 ? (
            <div className="border border-orange-700/60 bg-orange-950/30 rounded-xl p-6 text-center">
              <p className="text-orange-400 font-medium">No text found</p>
              <p className="text-orange-500 text-sm mt-1">
                This appears to be a scanned PDF. Text extraction requires selectable text.
              </p>
            </div>
          ) : (
            <PreviewPane paragraphs={nonEmpty} />
          )}
        </div>
      )}
    </div>
  )
}
