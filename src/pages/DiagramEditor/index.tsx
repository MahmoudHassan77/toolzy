import { useRef, useState } from 'react'
import { Style, Background } from './types'
import { useEditor } from './useEditor'
import Canvas, { CanvasHandle } from './Canvas'
import ToolBar from './ToolBar'

export default function DiagramEditor() {
  const canvasRef = useRef<CanvasHandle>(null)
  const [background, setBackground] = useState<Background>('dots')

  const {
    shapes, selectedId, tool, style,
    setSelectedId, setTool, patchStyle,
    addShape, updateShape, moveShape, deleteShape, deleteSelected,
    undo, redo, clearAll,
    canUndo, canRedo,
  } = useEditor()

  // When a shape is selected, the toolbar reflects and edits that shape's style.
  // Exceptions: pen strokes and active text-tool mode — style changes there only
  // affect upcoming shapes, never a previously selected one.
  const selectedShape = selectedId ? shapes.find(s => s.id === selectedId) ?? null : null
  const isPenSelected = selectedShape?.type === 'pen'
  const isTextToolActive = tool === 'text'
  const canEditSelected = Boolean(selectedShape && !isPenSelected && !isTextToolActive)
  const effectiveStyle = canEditSelected ? selectedShape!.style : style

  const handleStyleChange = (patch: Partial<Style>) => {
    patchStyle(patch)
    if (canEditSelected) {
      updateShape(selectedId!, { style: { ...selectedShape!.style, ...patch } } as never)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
        onReset={() => canvasRef.current?.resetView()}
      />

      <div className="flex-1 min-h-0">
        <Canvas
          ref={canvasRef}
          shapes={shapes}
          selectedId={selectedId}
          tool={tool}
          style={style}
          background={background}
          onAddShape={addShape}
          onMoveShape={moveShape}
          onSelect={setSelectedId}
          onDeleteShape={deleteShape}
          onUpdateShape={updateShape}
          onToolChange={setTool}
          onUndo={undo}
          onRedo={redo}
        />
      </div>
    </div>
  )
}
