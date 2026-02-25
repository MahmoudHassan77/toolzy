import { useRef, useCallback } from 'react'
import { Shape, Style } from './types'
import { useEditor, nextId } from './useEditor'
import { exportSVG } from './svgExporter'
import Canvas, { CanvasHandle } from './Canvas'
import ToolBar from './ToolBar'

export default function DiagramEditor() {
  const canvasRef = useRef<CanvasHandle>(null)

  const {
    shapes, selectedIds, tool, style, background,
    setSelectedIds, setTool, patchStyle, setBackground,
    addShape, updateShape, moveShape, moveShapes, deleteShape, deleteSelected,
    copySelected, pasteClipboard, duplicateSelected,
    undo, redo, clearAll, loadShapes,
    canUndo, canRedo,
    gridSnap, setGridSnap,
    bringToFront, sendToBack, moveUp, moveDown,
    // Diagram management
    diagrams, activeDiagramId,
    newDiagram, loadDiagram, deleteDiagram, renameDiagram,
  } = useEditor()

  // When a single shape is selected, the toolbar reflects and edits that shape's style.
  // Exceptions: pen strokes and active text-tool mode — style changes there only
  // affect upcoming shapes, never a previously selected one.
  const selectedShape = selectedIds.length === 1
    ? shapes.find(s => s.id === selectedIds[0]) ?? null
    : null
  const isPenSelected = selectedShape?.type === 'pen'
  const isTextToolActive = tool === 'text'
  const canEditSelected = Boolean(selectedShape && !isPenSelected && !isTextToolActive)
  const effectiveStyle = canEditSelected ? selectedShape!.style : style

  const handleStyleChange = (patch: Partial<Style>) => {
    patchStyle(patch)
    if (canEditSelected) {
      updateShape(selectedIds[0], { style: { ...selectedShape!.style, ...patch } } as never)
    }
  }

  // ── Download helper ──────────────────────────────────────────────────────
  const download = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  // ── Export SVG ───────────────────────────────────────────────────────────
  const handleExportSVG = useCallback(() => {
    const svg = exportSVG(shapes, background)
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    download(blob, 'diagram.svg')
  }, [shapes, background, download])

  // ── Export JSON ──────────────────────────────────────────────────────────
  const handleExportJSON = useCallback(() => {
    const json = JSON.stringify(shapes, null, 2)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    download(blob, 'diagram.json')
  }, [shapes, download])

  // ── Import JSON ──────────────────────────────────────────────────────────
  const handleImportJSON = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string)
          if (!Array.isArray(data)) {
            alert('Invalid file: expected an array of shapes.')
            return
          }
          // Validate each shape has at minimum id and type
          for (const item of data) {
            if (!item || typeof item !== 'object' || !item.type) {
              alert('Invalid file: each shape must have at least a "type" property.')
              return
            }
          }
          // Generate new IDs to avoid conflicts
          const imported: Shape[] = data.map((s: Shape) => ({
            ...s,
            id: nextId(),
          }))
          loadShapes(imported)
        } catch {
          alert('Failed to parse JSON file.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [loadShapes])

  return (
    <div className="flex flex-col h-full">
      <ToolBar
        tool={tool}
        style={effectiveStyle}
        background={background}
        canUndo={canUndo}
        canRedo={canRedo}
        selectedShapeType={selectedShape?.type ?? null}
        onToolChange={setTool}
        onStyleChange={handleStyleChange}
        onBackgroundChange={setBackground}
        onUndo={undo}
        onRedo={redo}
        onClear={clearAll}
        onExport={() => canvasRef.current?.exportPNG()}
        onExportSVG={handleExportSVG}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onReset={() => canvasRef.current?.resetView()}
        // Diagram management
        diagrams={diagrams}
        activeDiagramId={activeDiagramId}
        onNewDiagram={newDiagram}
        onLoadDiagram={loadDiagram}
        onDeleteDiagram={deleteDiagram}
        onRenameDiagram={renameDiagram}
        gridSnap={gridSnap}
        onGridSnapChange={setGridSnap}
        onBringToFront={() => selectedIds.length > 0 && bringToFront(selectedIds)}
        onSendToBack={() => selectedIds.length > 0 && sendToBack(selectedIds)}
        onMoveUp={() => selectedIds.length > 0 && moveUp(selectedIds)}
        onMoveDown={() => selectedIds.length > 0 && moveDown(selectedIds)}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        <Canvas
          ref={canvasRef}
          shapes={shapes}
          selectedIds={selectedIds}
          tool={tool}
          style={style}
          background={background}
          gridSnap={gridSnap}
          onAddShape={addShape}
          onMoveShape={moveShape}
          onMoveShapes={moveShapes}
          onSelect={setSelectedIds}
          onDeleteShape={deleteShape}
          onDeleteSelected={deleteSelected}
          onUpdateShape={updateShape}
          onToolChange={setTool}
          onUndo={undo}
          onRedo={redo}
          onCopySelected={copySelected}
          onPasteClipboard={pasteClipboard}
          onDuplicateSelected={duplicateSelected}
        />
      </div>
    </div>
  )
}
