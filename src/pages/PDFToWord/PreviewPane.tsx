import { useMemo } from 'react'
import { RichParagraph, RichSpan, ContentBlock } from './docxBuilder'

interface PreviewPaneProps {
  /** New: array of content blocks (paragraphs, tables, images) */
  blocks?: ContentBlock[]
  /** Legacy: array of paragraphs (backwards compat) */
  paragraphs?: RichParagraph[]
}

/** Render a single span with all style properties */
function SpanView({ span }: { span: RichSpan }) {
  return (
    <span
      style={{
        fontWeight: span.bold ? 'bold' : undefined,
        fontStyle: span.italic ? 'italic' : undefined,
        fontSize: span.fontSize > 8 && span.fontSize < 60 ? `${span.fontSize}px` : undefined,
        color: span.color ?? undefined,
        fontFamily: span.fontFamily ?? undefined,
        textDecoration: [
          span.underline ? 'underline' : '',
          span.strikethrough ? 'line-through' : '',
        ].filter(Boolean).join(' ') || undefined,
      }}
    >
      {span.text}
    </span>
  )
}

/** Page break visual indicator */
function PageBreakIndicator() {
  return (
    <div className="flex items-center gap-3 my-4 select-none">
      <div className="flex-1 border-t-2 border-dashed border-line2" />
      <span className="text-[11px] text-fg3 font-medium tracking-wide uppercase">Page Break</span>
      <div className="flex-1 border-t-2 border-dashed border-line2" />
    </div>
  )
}

/** Indent class based on list level */
function listIndentStyle(level: number): React.CSSProperties {
  return { marginLeft: `${(level + 1) * 1.5}rem` }
}

/** Render a paragraph block */
function ParagraphView({
  para,
  index,
  showPageBreak,
}: {
  para: RichParagraph
  index: number
  showPageBreak: boolean
}) {
  const textAlign =
    para.align === 'center'
      ? 'text-center'
      : para.align === 'right'
      ? 'text-right'
      : 'text-left'

  return (
    <>
      {showPageBreak && <PageBreakIndicator />}
      {para.isHeading ? (
        <p
          key={index}
          className={`font-bold text-fg1 ${
            para.headingLevel === 1
              ? 'text-2xl'
              : para.headingLevel === 2
              ? 'text-xl'
              : 'text-base'
          } ${textAlign} ${para.spaceBefore ? 'mt-5' : 'mt-3'} mb-1`}
        >
          {para.spans.map((s, j) => (
            <SpanView key={j} span={s} />
          ))}
        </p>
      ) : (
        <p
          key={index}
          className={`text-fg2 ${textAlign} ${para.spaceBefore ? 'mt-4' : 'mt-0.5'} leading-relaxed`}
          style={{ fontSize: 13 }}
        >
          {para.spans.map((s, j) => (
            <SpanView key={j} span={s} />
          ))}
        </p>
      )}
    </>
  )
}

/** Render a table block */
function TableView({ block }: { block: ContentBlock & { type: 'table' } }) {
  const { table } = block
  return (
    <div className="my-3 overflow-x-auto">
      <table className="border-collapse border border-line2 text-sm text-fg2 w-full">
        <tbody>
          {table.cells.map((row, ri) => (
            <tr key={ri} className={ri === 0 ? 'bg-raised' : ''}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-line2 px-2 py-1"
                  style={{
                    fontWeight: cell.bold ? 'bold' : undefined,
                    fontStyle: cell.italic ? 'italic' : undefined,
                    color: cell.color ?? undefined,
                    fontFamily: cell.fontFamily ?? undefined,
                  }}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Render an image block */
function ImageView({ block }: { block: ContentBlock & { type: 'image' } }) {
  const src = useMemo(() => {
    const blob = new Blob([block.data.buffer as ArrayBuffer], { type: 'image/png' })
    return URL.createObjectURL(blob)
  }, [block.data])

  // Scale to fit preview
  const maxWidth = 500
  let w = block.width
  let h = block.height
  if (w > maxWidth) {
    const ratio = maxWidth / w
    w = maxWidth
    h = Math.round(h * ratio)
  }

  return (
    <div className="my-3 flex justify-center">
      <img
        src={src}
        alt="Extracted from PDF"
        width={w}
        height={h}
        className="rounded border border-line2"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  )
}

export default function PreviewPane({ blocks, paragraphs }: PreviewPaneProps) {
  // Normalize to content blocks (backwards compat)
  const contentBlocks: ContentBlock[] = useMemo(() => {
    if (blocks) return blocks
    if (paragraphs) {
      return paragraphs.map(p => ({ type: 'paragraph' as const, paragraph: p }))
    }
    return []
  }, [blocks, paragraphs])

  const elements: React.ReactNode[] = []
  let i = 0

  while (i < contentBlocks.length) {
    const block = contentBlocks[i]

    if (block.type === 'table') {
      elements.push(
        <TableView key={`table-${i}`} block={block as ContentBlock & { type: 'table' }} />
      )
      i++
      continue
    }

    if (block.type === 'image') {
      elements.push(
        <ImageView key={`img-${i}`} block={block as ContentBlock & { type: 'image' }} />
      )
      i++
      continue
    }

    // Paragraph block
    const para = block.paragraph

    // ── page break indicator ─────────────────────────────────────────────
    const showPageBreak = !!para.pageBreakBefore

    // ── list grouping ────────────────────────────────────────────────────
    if (para.listType) {
      const listStart = i
      const currentListType = para.listType
      const listItems: React.ReactNode[] = []

      while (
        i < contentBlocks.length &&
        contentBlocks[i].type === 'paragraph' &&
        (contentBlocks[i] as ContentBlock & { type: 'paragraph' }).paragraph.listType === currentListType
      ) {
        const lp = (contentBlocks[i] as ContentBlock & { type: 'paragraph' }).paragraph
        // Show page break if a list item starts a new page
        if (i > listStart && lp.pageBreakBefore) {
          listItems.push(<PageBreakIndicator key={`pb-li-${i}`} />)
        }
        listItems.push(
          <li
            key={`li-${i}`}
            className="text-fg2 leading-relaxed"
            style={{
              ...listIndentStyle(lp.listLevel ?? 0),
              fontSize: 13,
            }}
          >
            {lp.spans.map((s, j) => (
              <SpanView key={j} span={s} />
            ))}
          </li>
        )
        i++
      }

      if (showPageBreak) {
        elements.push(<PageBreakIndicator key={`pb-${listStart}`} />)
      }

      if (currentListType === 'bullet') {
        elements.push(
          <ul
            key={`ul-${listStart}`}
            className="list-disc pl-5 my-1 space-y-0.5"
          >
            {listItems}
          </ul>
        )
      } else {
        elements.push(
          <ol
            key={`ol-${listStart}`}
            className="list-decimal pl-5 my-1 space-y-0.5"
          >
            {listItems}
          </ol>
        )
      }
      continue
    }

    // ── headings and normal paragraphs ────────────────────────────────────
    elements.push(
      <ParagraphView
        key={`para-${i}`}
        para={para}
        index={i}
        showPageBreak={showPageBreak}
      />
    )
    i++
  }

  return (
    <div className="border border-line rounded-xl bg-raised overflow-y-auto max-h-[500px] p-6 font-[Calibri,Arial,sans-serif]">
      {elements}
    </div>
  )
}
