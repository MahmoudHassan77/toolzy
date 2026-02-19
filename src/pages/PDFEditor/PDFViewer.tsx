import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Annotation, ToolType, ToolOptions } from '../../types/pdf'
import AnnotationLayer from './AnnotationLayer'
import Spinner from '../../components/ui/Spinner'

interface PDFViewerProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy
  scale: number
  annotations: Annotation[]
  activeTool: ToolType
  toolOptions: ToolOptions
  onAddHighlight: (pi: number, x: number, y: number, w: number, h: number) => void
  onAddText: (pi: number, x: number, y: number, text: string) => void
  onAddSignature: (pi: number, x: number, y: number) => void
  onAddDraw: (pi: number, svgPath: string, bbox: { x: number; y: number; width: number; height: number }) => void
  onAddShape: (pi: number, shape: 'rect' | 'ellipse' | 'line' | 'arrow', x: number, y: number, w: number, h: number) => void
  onAddWhiteout: (pi: number, x: number, y: number, w: number, h: number) => void
  onAddStamp: (pi: number, x: number, y: number) => void
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void
  onRemoveAnnotation: (id: string) => void
  onRequestSignature: (cb: (dataUrl: string) => void) => void
  onPageDims: (pageIndex: number, dims: { width: number; height: number; scale: number }) => void
  onDragStart: () => void
}

interface PageCanvasProps extends Omit<PDFViewerProps, 'pdfDoc'> {
  pdfDoc: pdfjsLib.PDFDocumentProxy
  pageNumber: number
}

function PageCanvas({
  pdfDoc, pageNumber, scale,
  annotations, activeTool, toolOptions,
  onAddHighlight, onAddText, onAddSignature,
  onAddDraw, onAddShape, onAddWhiteout, onAddStamp,
  onUpdateAnnotation, onRemoveAnnotation,
  onRequestSignature, onPageDims, onDragStart,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [rendering, setRendering] = useState(true)
  const taskRef = useRef<pdfjsLib.RenderTask | null>(null)

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      setRendering(true)
      try {
        const page = await pdfDoc.getPage(pageNumber)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        if (taskRef.current) { try { taskRef.current.cancel() } catch { /* ignore */ } }
        taskRef.current = page.render({ canvasContext: ctx, viewport })
        await taskRef.current.promise
        if (!cancelled) {
          const d = { width: viewport.width, height: viewport.height }
          setDims(d)
          onPageDims(pageNumber - 1, { ...d, scale })
          setRendering(false)
        }
      } catch (e: unknown) {
        if (!cancelled && !(e instanceof Error && e.message.includes('cancel'))) {
          console.error(`Page ${pageNumber} render error:`, e)
          setRendering(false)
        }
      }
    }
    render()
    return () => { cancelled = true }
  }, [pdfDoc, pageNumber, scale, onPageDims])

  return (
    <div
      className="relative mx-auto shadow-lg mb-6 bg-white"
      style={{ width: dims.width || 'auto', height: dims.height || 200 }}
    >
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <Spinner />
        </div>
      )}
      <canvas ref={canvasRef} className="block" />
      {!rendering && dims.width > 0 && (
        <AnnotationLayer
          pageIndex={pageNumber - 1}
          width={dims.width}
          height={dims.height}
          scale={scale}
          annotations={annotations}
          activeTool={activeTool}
          toolOptions={toolOptions}
          onAddHighlight={onAddHighlight}
          onAddText={onAddText}
          onAddSignature={onAddSignature}
          onAddDraw={onAddDraw}
          onAddShape={onAddShape}
          onAddWhiteout={onAddWhiteout}
          onAddStamp={onAddStamp}
          onUpdateAnnotation={onUpdateAnnotation}
          onRemoveAnnotation={onRemoveAnnotation}
          onDragStart={onDragStart}
        />
      )}
    </div>
  )
}

export default function PDFViewer(props: PDFViewerProps) {
  const { pdfDoc } = props
  return (
    <div className="overflow-y-auto flex-1 bg-zinc-300 dark:bg-zinc-700 p-6">
      {Array.from({ length: pdfDoc.numPages }, (_, i) => (
        <PageCanvas key={i} pageNumber={i + 1} {...props} />
      ))}
    </div>
  )
}
