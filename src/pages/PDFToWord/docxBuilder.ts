import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LineRuleType, UnderlineType, LevelFormat, LevelSuffix,
  WidthType, BorderStyle, ImageRun,
} from 'docx'
import { saveAs } from 'file-saver'
import type { DetectedTable } from './tableDetector'

// ── shared rich types ─────────────────────────────────────────────────────────

export interface RichSpan {
  text: string
  bold: boolean
  italic: boolean
  /** Font size in points (e.g. 12, 14, 24) */
  fontSize: number
  /** Hex color like "#ff0000" */
  color?: string
  /** Mapped font family name */
  fontFamily?: string
  /** Underline text */
  underline?: boolean
  /** Strikethrough text */
  strikethrough?: boolean
}

export interface RichParagraph {
  spans: RichSpan[]
  /** True when this block is a heading */
  isHeading: boolean
  /** 1 = largest heading, 2 = medium, 3 = smallest */
  headingLevel: 1 | 2 | 3
  /** True when a notable vertical gap appears before this paragraph */
  spaceBefore: boolean
  /** Detected alignment */
  align: 'left' | 'center' | 'right'
  /** Insert a page break before this paragraph */
  pageBreakBefore?: boolean
  /** List type: bullet or numbered */
  listType?: 'bullet' | 'numbered'
  /** List nesting level (0-based) */
  listLevel?: number
}

export interface TableBlock {
  type: 'table'
  table: DetectedTable
}

export interface ImageBlock {
  type: 'image'
  data: Uint8Array
  width: number
  height: number
}

export interface ParagraphBlock {
  type: 'paragraph'
  paragraph: RichParagraph
}

/** A content block: paragraph, table, or image */
export type ContentBlock = ParagraphBlock | TableBlock | ImageBlock

// ── font-name mapper ──────────────────────────────────────────────────────────

export function mapFont(pdfFontName: string): string {
  const n = pdfFontName.toLowerCase().replace(/[^a-z]/g, '')
  // Helvetica family → Arial
  if (n.includes('helvetica') || n.includes('arial')) return 'Arial'
  // Times family
  if (n.includes('times') || n.includes('timesnewroman')) return 'Times New Roman'
  // Courier family
  if (n.includes('courier')) return 'Courier New'
  // Symbol fonts
  if (n.includes('symbol')) return 'Symbol'
  if (n.includes('zapfdingbats') || n.includes('dingbats')) return 'Wingdings'
  // Cambria
  if (n.includes('cambriamath')) return 'Cambria Math'
  if (n.includes('cambria')) return 'Cambria'
  // Calibri variants
  if (n.includes('calibrilight')) return 'Calibri Light'
  if (n.includes('calibri')) return 'Calibri'
  // Common embedded fonts
  if (n.includes('georgia')) return 'Georgia'
  if (n.includes('verdana')) return 'Verdana'
  if (n.includes('trebuchet')) return 'Trebuchet MS'
  if (n.includes('tahoma')) return 'Tahoma'
  if (n.includes('palatino') || n.includes('bookantiqua')) return 'Palatino Linotype'
  if (n.includes('garamond')) return 'Garamond'
  if (n.includes('century') || n.includes('centurygothic')) return 'Century Gothic'
  if (n.includes('bookman') || n.includes('bookmanoldstyle')) return 'Bookman Old Style'
  if (n.includes('impact')) return 'Impact'
  if (n.includes('comicsans')) return 'Comic Sans MS'
  if (n.includes('lucidaconsole')) return 'Lucida Console'
  if (n.includes('lucidasans')) return 'Lucida Sans Unicode'
  if (n.includes('consolas')) return 'Consolas'
  if (n.includes('segoeui')) return 'Segoe UI'
  if (n.includes('myriad')) return 'Arial'           // Myriad is Adobe's Helvetica-like
  if (n.includes('minion')) return 'Times New Roman'  // Minion is Adobe's serif
  if (n.includes('frutiger')) return 'Arial'
  if (n.includes('futura')) return 'Century Gothic'
  if (n.includes('avenir')) return 'Century Gothic'
  if (n.includes('optima')) return 'Verdana'
  return 'Calibri'
}

// ── helpers for table / image docx elements ──────────────────────────────────

const TABLE_BORDER = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: '999999',
}

function buildTableElement(dt: DetectedTable): Table {
  const rows = dt.cells.map((rowCells) => {
    const cells = rowCells.map((cell) => {
      return new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: cell.text || '',
                bold: cell.bold,
                italics: cell.italic,
                size: 20, // 10pt in half-points
                ...(cell.color ? { color: cell.color.replace(/^#/, '') } : {}),
                ...(cell.fontFamily ? { font: cell.fontFamily } : {}),
              }),
            ],
            spacing: { before: 40, after: 40 },
          }),
        ],
        borders: {
          top: TABLE_BORDER,
          bottom: TABLE_BORDER,
          left: TABLE_BORDER,
          right: TABLE_BORDER,
        },
        width: { size: Math.floor(9000 / dt.numCols), type: WidthType.DXA },
      })
    })
    return new TableRow({ children: cells })
  })

  return new Table({
    rows,
    width: { size: 9000, type: WidthType.DXA },
  })
}

function buildImageElement(block: ImageBlock): Paragraph {
  // Scale image to fit within page width (about 6 inches = ~572pt)
  const maxWidthPx = 572
  const maxHeightPx = 700
  let w = block.width
  let h = block.height

  if (w > maxWidthPx) {
    const ratio = maxWidthPx / w
    w = maxWidthPx
    h = Math.round(h * ratio)
  }
  if (h > maxHeightPx) {
    const ratio = maxHeightPx / h
    h = Math.round(h * ratio)
    w = Math.round(w * ratio)
  }

  return new Paragraph({
    children: [
      new ImageRun({
        data: block.data,
        transformation: { width: w, height: h },
      }),
    ],
    spacing: { before: 120, after: 120 },
  })
}

// ── docx builder ──────────────────────────────────────────────────────────────

export async function buildAndDownloadDocx(
  blocks: ContentBlock[] | RichParagraph[],
  filename: string
): Promise<void> {
  // Backwards compatibility: if given plain RichParagraph[], wrap them
  const contentBlocks: ContentBlock[] = blocks.map((b) => {
    if ('type' in b) return b as ContentBlock
    return { type: 'paragraph' as const, paragraph: b as RichParagraph }
  })
  const HEADING_MAP = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
  ] as const

  const ALIGN_MAP: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
  }

  // ── numbering config for bullet and numbered lists ──────────────────────
  const BULLET_REF = 'pdf-bullet-list'
  const NUMBERED_REF = 'pdf-numbered-list'

  const bulletLevels: {
    level: number; format: typeof LevelFormat[keyof typeof LevelFormat]
    text: string; alignment: typeof AlignmentType[keyof typeof AlignmentType]
    suffix: typeof LevelSuffix[keyof typeof LevelSuffix]
    style: { paragraph: { indent: { left: number; hanging: number } }; run: { font: string } }
  }[] = Array.from({ length: 4 }, (_, i) => ({
    level: i,
    format: LevelFormat.BULLET,
    text: i === 0 ? '\u2022' : i === 1 ? '\u25E6' : i === 2 ? '\u25AA' : '\u2022',
    alignment: AlignmentType.LEFT,
    suffix: LevelSuffix.TAB,
    style: {
      paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } },
      run: { font: 'Symbol' },
    },
  }))

  const NUM_FORMATS = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN] as const
  const numberedLevels: {
    level: number; format: typeof LevelFormat[keyof typeof LevelFormat]
    text: string; alignment: typeof AlignmentType[keyof typeof AlignmentType]
    start: number; suffix: typeof LevelSuffix[keyof typeof LevelSuffix]
    style: { paragraph: { indent: { left: number; hanging: number } } }
  }[] = Array.from({ length: 4 }, (_, i) => ({
    level: i,
    format: NUM_FORMATS[i % 3],
    text: `%${i + 1}.`,
    alignment: AlignmentType.LEFT,
    start: 1,
    suffix: LevelSuffix.TAB,
    style: {
      paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } },
    },
  }))

  // ── helper: build a paragraph element from a RichParagraph ──────────────
  function buildParagraphElement(para: RichParagraph): Paragraph {
    const runs = para.spans
      .filter((s) => s.text.length > 0)
      .map((span) => {
        const runOpts: Record<string, unknown> = {
          text: span.text,
          bold: span.bold,
          italics: span.italic,
          // size is in half-points: 12pt → 24
          size: Math.round(Math.max(span.fontSize, 8) * 2),
        }

        // Color: docx expects hex without '#' prefix (e.g. "FF0000")
        if (span.color) {
          runOpts.color = span.color.replace(/^#/, '')
        }

        // Font family
        if (span.fontFamily) {
          runOpts.font = span.fontFamily
        }

        // Underline
        if (span.underline) {
          runOpts.underline = { type: UnderlineType.SINGLE }
        }

        // Strikethrough
        if (span.strikethrough) {
          runOpts.strike = true
        }

        return new TextRun(runOpts as ConstructorParameters<typeof TextRun>[0])
      })

    // ── heading paragraphs ──────────────────────────────────────────────
    if (para.isHeading) {
      return new Paragraph({
        heading: HEADING_MAP[para.headingLevel - 1],
        alignment: ALIGN_MAP[para.align] ?? AlignmentType.LEFT,
        spacing: {
          before: para.spaceBefore ? 320 : 160,
          after: 80,
        },
        pageBreakBefore: para.pageBreakBefore ?? false,
        children: runs,
      })
    }

    // ── list paragraphs ─────────────────────────────────────────────────
    if (para.listType) {
      const level = Math.min(para.listLevel ?? 0, 3)
      return new Paragraph({
        alignment: ALIGN_MAP[para.align] ?? AlignmentType.LEFT,
        numbering: {
          reference: para.listType === 'bullet' ? BULLET_REF : NUMBERED_REF,
          level,
        },
        spacing: {
          before: para.spaceBefore ? 120 : 0,
          after: 40,
          line: 276,
          lineRule: LineRuleType.AUTO,
        },
        pageBreakBefore: para.pageBreakBefore ?? false,
        children: runs,
      })
    }

    // ── normal body paragraphs ──────────────────────────────────────────
    // Calculate line spacing from the dominant font size in this paragraph
    const avgFontSize = para.spans.length > 0
      ? para.spans.reduce((sum, s) => sum + s.fontSize, 0) / para.spans.length
      : 12
    // Base line spacing: ~1.15 for normal text, slightly tighter for larger text
    const lineSpacing = avgFontSize > 18 ? 260 : 276

    return new Paragraph({
      alignment: ALIGN_MAP[para.align] ?? AlignmentType.LEFT,
      spacing: {
        before: para.spaceBefore ? 200 : 0,
        after: 80,
        line: lineSpacing,
        lineRule: LineRuleType.AUTO,
      },
      pageBreakBefore: para.pageBreakBefore ?? false,
      children: runs,
    })
  }

  // ── build all children from content blocks ─────────────────────────────
  const children: (Paragraph | Table)[] = []
  for (const block of contentBlocks) {
    if (block.type === 'table') {
      children.push(buildTableElement(block.table))
    } else if (block.type === 'image') {
      children.push(buildImageElement(block))
    } else {
      children.push(buildParagraphElement(block.paragraph))
    }
  }

  const doc = new Document({
    numbering: {
      config: [
        { reference: BULLET_REF, levels: bulletLevels },
        { reference: NUMBERED_REF, levels: numberedLevels },
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 24, // 12 pt default
          },
          paragraph: {
            spacing: { after: 80, line: 276 },
          },
        },
      },
    },
    sections: [{ children }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, filename.replace(/\.pdf$/i, '') + '.docx')
}
