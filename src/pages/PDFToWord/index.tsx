import { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useDropzone } from 'react-dropzone'
import {
  RichParagraph, RichSpan, ContentBlock,
  buildAndDownloadDocx, mapFont,
} from './docxBuilder'
import { detectTables } from './tableDetector'
import { extractImages } from './imageExtractor'
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
  /** Hex color like "#ff0000" */
  color?: string
  /** Mapped font family name */
  fontFamily?: string
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

    const color = item.color
    const fontFamily = item.fontFamily

    // Merge with last span when style matches (avoids many 1-char runs)
    if (spans.length > 0) {
      const last = spans[spans.length - 1]
      const sameBold = last.bold === item.bold
      const sameItalic = last.italic === item.italic
      const sameSize = Math.abs(last.fontSize - fontSize) < 2
      const sameColor = (last.color ?? '') === (color ?? '')
      const sameFont = (last.fontFamily ?? '') === (fontFamily ?? '')
      if (sameBold && sameItalic && sameSize && sameColor && sameFont) {
        last.text += text
        continue
      }
    }

    spans.push({ text, bold: item.bold, italic: item.italic, fontSize, color, fontFamily })
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

// ── build paragraphs from text items (non-table items) ──────────────────────

interface ParagraphWithY {
  paragraph: RichParagraph
  y: number
}

function buildParagraphsFromItems(
  items: TextItemEx[],
  pageWidth: number,
  bodyFontSize: number,
  medianLeftX: number,
  isNewPage: boolean,
  isFirstPage: boolean,
): ParagraphWithY[] {
  if (items.length === 0) return []

  // Adaptive tolerance based on median height
  const heights = items.map((i) => i.height).filter((h) => h > 1).sort((a, b) => a - b)
  const medH = heights[Math.floor(heights.length / 2)] || 10
  const tolerance = medH * 0.45

  // Group into lines, sort top to bottom
  const lines = groupIntoLines(items, tolerance)
  lines.sort((a, b) => b.y - a.y)

  // Sort items left to right within each line
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
  }

  const results: ParagraphWithY[] = []
  let firstParaOnPage = isNewPage && !isFirstPage

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const spans = buildSpans(line.items)
    if (spans.length === 0 || spans.every((s) => !s.text.trim())) continue

    // Space-before: vertical gap significantly larger than normal line spacing
    let spaceBefore = false
    if (li > 0) {
      const prev = lines[li - 1]
      const gap = prev.y - line.y
      const normalSpacing = prev.maxHeight * 1.4
      spaceBefore = gap > normalSpacing * 1.7
    }

    // Heading detection
    const lineMaxH = line.maxHeight
    const relSize = lineMaxH / (bodyFontSize || 12)
    const allBold = line.items.every((i) => i.bold)
    const isHeading = relSize >= 1.25 || (allBold && relSize >= 1.1)

    let headingLevel: 1 | 2 | 3 = 2
    if (relSize >= 1.8) headingLevel = 1
    else if (relSize >= 1.35) headingLevel = 2
    else headingLevel = 3

    const align = detectAlign(line, pageWidth)

    let pageBreakBefore = false
    if (firstParaOnPage) {
      pageBreakBefore = true
      firstParaOnPage = false
    }

    // List detection
    let listType: 'bullet' | 'numbered' | undefined
    let listLevel = 0

    if (spans.length > 0) {
      const firstText = spans[0].text.trimStart()
      const bulletMatch = firstText.match(/^([•●○■▪\-*–—])\s+/)
      const numberedMatch = firstText.match(/^(?:(\d+|[a-z]+|[ivxlcdm]+)[.)]\s+|\((\d+|[a-z]+)\)\s+)/i)

      if (bulletMatch) {
        listType = 'bullet'
        spans[0].text = spans[0].text.trimStart().slice(bulletMatch[0].length)
        if (!spans[0].text && spans.length > 1) spans.shift()
      } else if (numberedMatch) {
        listType = 'numbered'
        spans[0].text = spans[0].text.trimStart().slice(numberedMatch[0].length)
        if (!spans[0].text && spans.length > 1) spans.shift()
      }

      if (listType && medianLeftX > 0) {
        const lineLeftX = Math.min(...line.items.map((it) => it.x))
        const indentRatio = (lineLeftX - medianLeftX) / medianLeftX
        if (indentRatio > 0.15) listLevel = 1
        if (indentRatio > 0.30) listLevel = 2
        if (indentRatio > 0.45) listLevel = 3
      }
    }

    results.push({
      y: line.y,
      paragraph: {
        spans, isHeading, headingLevel, spaceBefore, align,
        pageBreakBefore,
        listType,
        listLevel: listType ? listLevel : undefined,
      },
    })
  }

  return results
}

// ── main extraction ───────────────────────────────────────────────────────────

async function extractContent(file: File): Promise<ContentBlock[]> {
  const ab = await file.arrayBuffer()
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise

  const allBlocks: ContentBlock[] = []

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const pageWidth = viewport.width
    const content = await page.getTextContent()

    // ── 1. collect items ──────────────────────────────────────────────────
    const items: TextItemEx[] = []
    for (const raw of content.items) {
      if (!('str' in raw)) continue
      if (!raw.str) continue
      const h = Math.abs((raw as { height?: number }).height ?? 0)
        || Math.abs(raw.transform[3])
        || Math.abs(raw.transform[0])
      const fontName = (raw as { fontName?: string }).fontName ?? ''

      let color: string | undefined
      const rawColor = (raw as { color?: string | number[] }).color
      if (typeof rawColor === 'string' && rawColor.startsWith('#')) {
        color = rawColor
      } else if (Array.isArray(rawColor) && rawColor.length >= 3) {
        const [r, g, b] = rawColor.map(c => c <= 1 ? Math.round(c * 255) : Math.round(c))
        if (r !== 0 || g !== 0 || b !== 0) {
          color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        }
      }

      const fontFamily = fontName ? mapFont(fontName) : undefined

      items.push({
        str: raw.str,
        x: raw.transform[4],
        y: raw.transform[5],
        width: (raw as { width?: number }).width ?? 0,
        height: h,
        fontName,
        bold: isBold(fontName),
        italic: isItalic(fontName),
        color,
        fontFamily,
      })
    }

    // ── 2. extract images from this page ────────────────────────────────
    let pageImages: { data: Uint8Array; width: number; height: number; y: number }[] = []
    try {
      const extracted = await extractImages(page)
      pageImages = extracted.map(img => ({
        data: img.data,
        width: img.width,
        height: img.height,
        y: img.y,
      }))
    } catch {
      // Image extraction failed — continue without images
    }

    if (items.length === 0 && pageImages.length === 0) continue

    // ── 3. compute page-level stats ─────────────────────────────────────
    const sizeBuckets: Record<number, number> = {}
    for (const item of items) {
      const sz = Math.round(item.height)
      if (sz > 1) sizeBuckets[sz] = (sizeBuckets[sz] || 0) + 1
    }
    const bodyFontSize = Number(
      Object.entries(sizeBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12
    )

    const heights = items.map((i) => i.height).filter((h) => h > 1).sort((a, b) => a - b)
    const medH = heights[Math.floor(heights.length / 2)] || 10
    const tolerance = medH * 0.45

    const lines = groupIntoLines(items, tolerance)
    const leftPositions = lines.map((l) =>
      l.items.length > 0 ? Math.min(...l.items.map((it) => it.x)) : 0
    ).filter((x) => x > 0).sort((a, b) => a - b)
    const medianLeftX = leftPositions[Math.floor(leftPositions.length / 2)] || 0

    const isNewPage = pageNum > 1 && allBlocks.length > 0

    // ── 4. detect tables ────────────────────────────────────────────────
    const { tables, nonTableItems } = detectTables(items, pageWidth)

    // ── 5. build paragraphs from non-table items ────────────────────────
    const parasWithY = buildParagraphsFromItems(
      nonTableItems, pageWidth, bodyFontSize, medianLeftX, isNewPage, pageNum === 1,
    )

    // ── 6. merge all blocks by Y position ───────────────────────────────
    // Collect all positioned blocks
    interface PositionedBlock {
      y: number
      block: ContentBlock
    }

    const positioned: PositionedBlock[] = []

    // Add paragraphs
    for (const pw of parasWithY) {
      positioned.push({
        y: pw.y,
        block: { type: 'paragraph', paragraph: pw.paragraph },
      })
    }

    // Add tables
    for (const table of tables) {
      positioned.push({
        y: table.yTop,
        block: { type: 'table', table },
      })
    }

    // Add images
    for (const img of pageImages) {
      positioned.push({
        y: img.y,
        block: { type: 'image', data: img.data, width: img.width, height: img.height },
      })
    }

    // Sort by Y descending (PDF: top of page = larger Y)
    positioned.sort((a, b) => b.y - a.y)

    // Apply page break to the first block of each page after page 1
    if (isNewPage && positioned.length > 0) {
      const first = positioned[0].block
      if (first.type === 'paragraph') {
        first.paragraph.pageBreakBefore = true
      }
      // For tables/images as first block, prepend an empty paragraph with page break
      else {
        positioned.unshift({
          y: positioned[0].y + 1,
          block: {
            type: 'paragraph',
            paragraph: {
              spans: [{ text: '', bold: false, italic: false, fontSize: 2 }],
              isHeading: false,
              headingLevel: 2,
              spaceBefore: false,
              align: 'left',
              pageBreakBefore: true,
            },
          },
        })
      }
    }

    for (const p of positioned) {
      allBlocks.push(p.block)
    }
  }

  return allBlocks
}

// ── component ─────────────────────────────────────────────────────────────────

export default function PDFToWord() {
  const [fileName, setFileName] = useState('')
  const [blocks, setBlocks] = useState<ContentBlock[] | null>(null)
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
      setBlocks(null)
      setFileName(files[0].name)
      try {
        const result = await extractContent(files[0])
        setBlocks(result)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to extract text')
      } finally {
        setLoading(false)
      }
    },
  })

  const handleDownload = async () => {
    if (!blocks) return
    setDownloading(true)
    try {
      await buildAndDownloadDocx(blocks, fileName)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const handleReset = () => {
    setBlocks(null)
    setFileName('')
    setError(null)
  }

  // Count stats
  const paragraphBlocks = blocks?.filter(b => b.type === 'paragraph') ?? []
  const nonEmptyParas = paragraphBlocks.filter(b =>
    b.type === 'paragraph' && b.paragraph.spans.some(s => s.text.trim())
  )
  const headingCount = paragraphBlocks.filter(
    b => b.type === 'paragraph' && b.paragraph.isHeading
  ).length
  const tableCount = blocks?.filter(b => b.type === 'table').length ?? 0
  const imageCount = blocks?.filter(b => b.type === 'image').length ?? 0
  const hasContent = blocks !== null && blocks.length > 0

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg1 mb-1">PDF to Word</h2>
        <p className="text-sm text-fg2">
          Converts text PDFs to .docx preserving bold, italic, font sizes, heading levels,
          paragraph spacing, tables, images, and reading order.
        </p>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800/60 text-red-400 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {!blocks && (
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
              <p className="text-sm text-fg2">Extracting text, tables, and images...</p>
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

      {blocks && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-fg1">{fileName}</p>
              <p className="text-sm text-fg2">
                {nonEmptyParas.length} paragraph{nonEmptyParas.length !== 1 ? 's' : ''}
                {' · '}
                {headingCount} heading{headingCount !== 1 ? 's' : ''}
                {tableCount > 0 && (
                  <> · {tableCount} table{tableCount !== 1 ? 's' : ''}</>
                )}
                {imageCount > 0 && (
                  <> · {imageCount} image{imageCount !== 1 ? 's' : ''}</>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleReset}>
                Upload Another
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={downloading || !hasContent}
              >
                {downloading ? 'Generating...' : 'Download .docx'}
              </Button>
            </div>
          </div>

          {!hasContent ? (
            <div className="border border-orange-700/60 bg-orange-950/30 rounded-xl p-6 text-center">
              <p className="text-orange-400 font-medium">No text found</p>
              <p className="text-orange-500 text-sm mt-1">
                This appears to be a scanned PDF. Text extraction requires selectable text.
              </p>
            </div>
          ) : (
            <PreviewPane blocks={blocks} />
          )}
        </div>
      )}
    </div>
  )
}
