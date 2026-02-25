import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { usePDFEditor } from './usePDFEditor'
import PDFViewer from './PDFViewer'
import ToolBar from './ToolBar'
import SignaturePad from './SignaturePad'
import Spinner from '../../components/ui/Spinner'
import { embedAnnotations } from './annotationUtils'

export default function PDFEditor() {
  const {
    pdfDoc, fileName, numPages, scale, setScale, annotations,
    activeTool, setActiveTool, toolOptions, setToolOptions,
    loading, error, loadPDF,
    addHighlight, addText, addSignature, addDraw, addShape, addWhiteout, addStamp, addStickyNote, addUnderline, addStrikethrough, addPolygon, addCallout,
    updateAnnotation, removeAnnotation, startDragHistory,
    canUndo, canRedo, undo, redo,
    setPageDims, originalBytesRef, pageDimsRef, reset,
    currentPage, setCurrentPage,
    pageOperations, rotatePage, deletePage, movePage,
  } = usePDFEditor()

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!pdfDoc) return
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo() }
      if (ctrl && e.shiftKey  && e.key === 'z') { e.preventDefault(); redo() }
      if (ctrl && e.key === 'y')                 { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pdfDoc, undo, redo])

  const [sigPadOpen, setSigPadOpen] = useState(false)
  const [sigCallback, setSigCallback] = useState<((dataUrl: string) => void) | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState<string | null>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    onDrop: (files) => { if (files[0]) loadPDF(files[0]) },
  })

  // Signature pad plumbing
  const handleRequestSignature = useCallback((cb: (dataUrl: string) => void) => {
    setSigCallback(() => cb)
    setSigPadOpen(true)
  }, [])

  const handleSignatureConfirm = (dataUrl: string) => {
    if (sigCallback) sigCallback(dataUrl)
    setSigCallback(null)
  }

  const handleAddSignature = useCallback(
    (pageIndex: number, x: number, y: number) => {
      handleRequestSignature((dataUrl) => {
        addSignature(pageIndex, x, y, 200, 80, dataUrl)
      })
    },
    [handleRequestSignature, addSignature]
  )

  // Download with embedded annotations
  const handleDownload = async () => {
    if (!originalBytesRef.current) return
    setDownloading(true)
    setDlError(null)
    try {
      const scales = pageDimsRef.current.map((d) => d?.scale ?? 1.2)
      const bytes = await embedAnnotations(originalBytesRef.current, annotations, scales, pageOperations)
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName.replace(/\.pdf$/i, '') + '_annotated.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setDlError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  // ── Upload screen ──────────────────────────────────────────────────────────
  if (!pdfDoc) {
    return (
      <div className="p-8 flex flex-col items-center gap-6">
        <div className="text-center">
          <div className="text-4xl mb-2">📄</div>
          <h2 className="text-xl font-semibold text-fg1 mb-1">PDF Editor</h2>
          <p className="text-fg2 text-sm max-w-sm">
            Annotate PDFs with text, highlights, drawings, shapes, stamps, whiteout, and signatures.
          </p>
        </div>
        {(error || dlError) && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/60 px-4 py-2 rounded-lg">
            {error ?? dlError}
          </p>
        )}
        <div
          {...getRootProps()}
          className={`w-full max-w-md border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-acc bg-acc/10' : 'border-line2 hover:border-acc bg-raised'}`}
        >
          <input {...getInputProps()} />
          {loading ? (
            <Spinner className="mx-auto" />
          ) : (
            <>
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm text-fg2">
                {isDragActive ? 'Drop your PDF here' : 'Drag & drop a PDF, or click to browse'}
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Editor screen ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ToolBar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        toolOptions={toolOptions}
        onOptionsChange={setToolOptions}
        scale={scale}
        onScaleChange={setScale}
        currentPage={currentPage}
        numPages={numPages}
        onPageChange={setCurrentPage}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onDownload={handleDownload}
        onReset={reset}
        downloading={downloading}
        onRotatePage={rotatePage}
        onDeletePage={deletePage}
        onMovePage={movePage}
      />
      {dlError && (
        <div className="bg-red-950/40 border-b border-red-800/60 text-red-400 text-xs px-4 py-1">
          Download error: {dlError}
        </div>
      )}
      <PDFViewer
        pdfDoc={pdfDoc}
        scale={scale}
        annotations={annotations}
        activeTool={activeTool}
        toolOptions={toolOptions}
        onAddHighlight={addHighlight}
        onAddText={addText}
        onAddSignature={handleAddSignature}
        onAddDraw={addDraw}
        onAddShape={addShape}
        onAddWhiteout={addWhiteout}
        onAddStamp={addStamp}
        onAddStickyNote={addStickyNote}
        onAddUnderline={addUnderline}
        onAddStrikethrough={addStrikethrough}
        onAddPolygon={addPolygon}
        onAddCallout={addCallout}
        onUpdateAnnotation={updateAnnotation}
        onRemoveAnnotation={removeAnnotation}
        onRequestSignature={handleRequestSignature}
        onPageDims={setPageDims}
        onDragStart={startDragHistory}
      />
      <SignaturePad
        open={sigPadOpen}
        onClose={() => setSigPadOpen(false)}
        onConfirm={handleSignatureConfirm}
      />
    </div>
  )
}
