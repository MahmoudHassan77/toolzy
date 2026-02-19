import { RichParagraph } from './docxBuilder'

interface PreviewPaneProps {
  paragraphs: RichParagraph[]
}

export default function PreviewPane({ paragraphs }: PreviewPaneProps) {
  return (
    <div className="border border-line rounded-xl bg-raised overflow-y-auto max-h-[500px] p-6 font-[Calibri,Arial,sans-serif]">
      {paragraphs.map((para, i) => {
        const textAlign =
          para.align === 'center'
            ? 'text-center'
            : para.align === 'right'
            ? 'text-right'
            : 'text-left'

        if (para.isHeading) {
          const sizeClass =
            para.headingLevel === 1
              ? 'text-2xl'
              : para.headingLevel === 2
              ? 'text-xl'
              : 'text-base'

          return (
            <p
              key={i}
              className={`font-bold text-fg1 ${sizeClass} ${textAlign} ${para.spaceBefore ? 'mt-5' : 'mt-3'} mb-1`}
            >
              {para.spans.map((s, j) => (
                <span
                  key={j}
                  style={{
                    fontWeight: s.bold ? 'bold' : undefined,
                    fontStyle: s.italic ? 'italic' : undefined,
                    fontSize: s.fontSize > 8 ? `${s.fontSize}px` : undefined,
                  }}
                >
                  {s.text}
                </span>
              ))}
            </p>
          )
        }

        return (
          <p
            key={i}
            className={`text-fg2 ${textAlign} ${para.spaceBefore ? 'mt-4' : 'mt-0.5'} leading-relaxed`}
            style={{ fontSize: 13 }}
          >
            {para.spans.map((s, j) => (
              <span
                key={j}
                style={{
                  fontWeight: s.bold ? 'bold' : undefined,
                  fontStyle: s.italic ? 'italic' : undefined,
                  fontSize: s.fontSize > 8 && s.fontSize < 30 ? `${s.fontSize}px` : undefined,
                }}
              >
                {s.text}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
