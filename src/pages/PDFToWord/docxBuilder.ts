import {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType, LineRuleType,
} from 'docx'
import { saveAs } from 'file-saver'

// ── shared rich types ─────────────────────────────────────────────────────────

export interface RichSpan {
  text: string
  bold: boolean
  italic: boolean
  /** Font size in points (e.g. 12, 14, 24) */
  fontSize: number
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
}

// ── font-name mapper ──────────────────────────────────────────────────────────

function mapFont(pdfFontName: string): string {
  const n = pdfFontName.toLowerCase().replace(/[^a-z]/g, '')
  if (n.includes('arial') || n.includes('helvetica')) return 'Arial'
  if (n.includes('times') || n.includes('timesnewroman')) return 'Times New Roman'
  if (n.includes('courier')) return 'Courier New'
  if (n.includes('georgia')) return 'Georgia'
  if (n.includes('verdana')) return 'Verdana'
  if (n.includes('trebuchet')) return 'Trebuchet MS'
  return 'Calibri'
}

// ── docx builder ──────────────────────────────────────────────────────────────

export async function buildAndDownloadDocx(
  paragraphs: RichParagraph[],
  filename: string
): Promise<void> {
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

  const children = paragraphs.map((para) => {
    const runs = para.spans
      .filter((s) => s.text.length > 0)
      .map(
        (span) =>
          new TextRun({
            text: span.text,
            bold: span.bold,
            italics: span.italic,
            // size is in half-points: 12pt → 24
            size: Math.round(Math.max(span.fontSize, 8) * 2),
          })
      )

    if (para.isHeading) {
      return new Paragraph({
        heading: HEADING_MAP[para.headingLevel - 1],
        alignment: ALIGN_MAP[para.align] ?? AlignmentType.LEFT,
        spacing: {
          before: para.spaceBefore ? 320 : 160,
          after: 80,
        },
        children: runs,
      })
    }

    return new Paragraph({
      alignment: ALIGN_MAP[para.align] ?? AlignmentType.LEFT,
      spacing: {
        before: para.spaceBefore ? 200 : 0,
        after: 80,
        line: 276,
        lineRule: LineRuleType.AUTO,
      },
      children: runs,
    })
  })

  const doc = new Document({
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
