import { ToolType, ToolOptions } from '../../types/pdf'

const icons: Record<ToolType, JSX.Element> = {
  select: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l7 18 3-7 7-3L4 4z" strokeLinejoin="round" /></svg>),
  eraser: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16l10-10 7 7-3.5 3.5" strokeLinejoin="round" strokeLinecap="round" /><path d="M6.5 17.5l4-4" strokeLinecap="round" /></svg>),
  highlight: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><rect x="3" y="10" width="18" height="7" rx="1" opacity="0.9" /><rect x="3" y="18" width="18" height="2" rx="0.5" opacity="0.4" /></svg>),
  underline: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v7a6 6 0 0012 0V3" strokeLinecap="round" /><line x1="4" y1="21" x2="20" y2="21" strokeLinecap="round" strokeWidth="2.5" /></svg>),
  strikethrough: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" strokeWidth="2.5" /><path d="M16 7a4 4 0 00-4-4 4 4 0 00-4 4c0 2 1.5 3 4 4" strokeLinecap="round" /><path d="M8 17a4 4 0 004 4 4 4 0 004-4c0-2-1.5-3-4-4" strokeLinecap="round" /></svg>),
  whiteout: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="1" /><line x1="3" y1="19" x2="21" y2="19" strokeWidth="2.5" /></svg>),
  text: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V5h16v2" strokeLinecap="round" /><path d="M12 5v14" strokeLinecap="round" /><path d="M8 19h8" strokeLinecap="round" /></svg>),
  stamp: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19h14" strokeLinecap="round" /><path d="M9 19v-4H7a4 4 0 01-4-4 5 5 0 0110 0h0a5 5 0 0110 0 4 4 0 01-4 4h-2v4" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  stickynote: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-6-6z" strokeLinejoin="round" /><path d="M15 3v6h6" strokeLinejoin="round" /></svg>),
  draw: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17c3-3 4-6 6-6s3 4 6 4 4-4 6-4" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  rect: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="1" /></svg>),
  ellipse: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="9" ry="6" /></svg>),
  line: (<svg viewBox="0 0 24 24" className="w-4 h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="20" x2="20" y2="4" /></svg>),
  arrow: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5" /><polyline points="9 5 19 5 19 15" /></svg>),
  polygon: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12,3 21,9 18,19 6,19 3,9" /></svg>),
  callout: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H14l-4 4v-4H4a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>),
  signature: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17c2-4 4-8 6-8s2 4 4 4 3-6 5-6" strokeLinecap="round" strokeLinejoin="round" /><line x1="3" y1="21" x2="21" y2="21" strokeLinecap="round" /></svg>),
}

interface ToolDef { id: ToolType; label: string }
const TOOL_GROUPS: { label: string; tools: ToolDef[] }[] = [
  { label: 'Select', tools: [{ id: 'select', label: 'Select / Move' }, { id: 'eraser', label: 'Eraser' }] },
  { label: 'Markup', tools: [{ id: 'highlight', label: 'Highlight' }, { id: 'underline', label: 'Underline' }, { id: 'strikethrough', label: 'Strikethrough' }, { id: 'whiteout', label: 'Whiteout' }, { id: 'stickynote', label: 'Sticky Note' }] },
  { label: 'Text', tools: [{ id: 'text', label: 'Add Text' }, { id: 'stamp', label: 'Stamp' }] },
  { label: 'Draw', tools: [{ id: 'draw', label: 'Freehand Draw' }, { id: 'rect', label: 'Rectangle' }, { id: 'ellipse', label: 'Ellipse' }, { id: 'line', label: 'Line' }, { id: 'arrow', label: 'Arrow' }, { id: 'polygon', label: 'Polygon' }, { id: 'callout', label: 'Callout' }] },
  { label: 'Sign', tools: [{ id: 'signature', label: 'Signature' }] },
]

const SWATCHES = ['#000000', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff']
const COLOR_TOOLS = new Set<ToolType>(['highlight', 'underline', 'strikethrough', 'stickynote', 'text', 'stamp', 'draw', 'rect', 'ellipse', 'line', 'arrow', 'polygon', 'callout'])
const STROKE_TOOLS = new Set<ToolType>(['draw', 'rect', 'ellipse', 'line', 'arrow', 'polygon'])
const FONTSIZE_TOOLS = new Set<ToolType>(['text', 'stamp', 'callout'])
const STAMP_TOOLS = new Set<ToolType>(['stamp'])
const FONT_SIZES = [10, 12, 14, 16, 20, 24, 32, 48]
const STROKE_WIDTHS = [1, 2, 3, 5, 8]
const STAMP_OPTIONS = [{ value: '✓', label: '✓ Check' }, { value: '✗', label: '✗ Cross' }, { value: '●', label: '● Dot' }, { value: 'date', label: '📅 Date' }]

const OPACITY_TOOLS = new Set<ToolType>(['highlight', 'underline', 'strikethrough', 'stickynote', 'draw', 'rect', 'ellipse', 'line', 'arrow', 'polygon', 'callout'])

const HINTS: Partial<Record<ToolType, string>> = {
  select: 'Drag to move · Double-click text to edit',
  eraser: 'Click any annotation to remove it',
  highlight: 'Drag to highlight an area',
  underline: 'Drag to underline an area',
  strikethrough: 'Drag to strikethrough an area',
  whiteout: 'Drag to cover content with white',
  text: 'Click to place · type · Enter to confirm · Esc to cancel',
  stamp: 'Click to place stamp',
  stickynote: 'Click to place a sticky note',
  draw: 'Click and drag to draw freely',
  rect: 'Drag to draw a rectangle',
  ellipse: 'Drag to draw an ellipse',
  line: 'Drag to draw a line',
  arrow: 'Drag to draw an arrow',
  polygon: 'Click to add vertices · Double-click to close',
  callout: 'Drag to draw callout box · tail auto-placed',
  signature: 'Click to place signature',
}

interface ToolBarProps {
  activeTool: ToolType
  onToolChange: (t: ToolType) => void
  toolOptions: ToolOptions
  onOptionsChange: (patch: Partial<ToolOptions>) => void
  scale: number
  onScaleChange: (s: number) => void
  currentPage: number
  numPages: number
  onPageChange: (p: number) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onDownload: () => void
  onReset: () => void
  downloading: boolean
  onRotatePage: (pageIndex: number, degrees: number) => void
  onDeletePage: (pageIndex: number) => void
  onMovePage: (from: number, to: number) => void
}

export default function ToolBar({
  activeTool, onToolChange,
  toolOptions, onOptionsChange,
  scale, onScaleChange,
  currentPage, numPages, onPageChange,
  canUndo, canRedo, onUndo, onRedo,
  onDownload, onReset, downloading,
  onRotatePage, onDeletePage, onMovePage,
}: ToolBarProps) {
  const showColor    = COLOR_TOOLS.has(activeTool)
  const showStroke   = STROKE_TOOLS.has(activeTool)
  const showFontSize = FONTSIZE_TOOLS.has(activeTool)
  const showStamp    = STAMP_TOOLS.has(activeTool)
  const showOpacity  = OPACITY_TOOLS.has(activeTool)
  const showRow2     = showColor || showStroke || showFontSize || showStamp || showOpacity

  const activeBtn = 'bg-acc text-accon shadow-sm'
  const inactiveBtn = 'text-fg2 hover:bg-raised hover:text-fg1'
  const optBtn = (active: boolean) => active
    ? 'bg-acc text-accon border-acc'
    : 'border-line2 text-fg2 hover:border-acc bg-raised'

  return (
    <div className="bg-surface border-b border-line shrink-0">
      {/* Row 1 */}
      <div className="px-3 py-1.5 flex items-center gap-1 flex-wrap min-h-[44px]">
        {TOOL_GROUPS.map((group, gi) => (
          <div key={group.label} className="flex items-center gap-0.5">
            {gi > 0 && <div className="w-px h-6 bg-line mx-1" />}
            {group.tools.map((t) => (
              <button key={t.id} onClick={() => onToolChange(t.id)} title={t.label}
                className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${activeTool === t.id ? activeBtn : inactiveBtn}`}>
                {icons[t.id]}
              </button>
            ))}
          </div>
        ))}

        <div className="w-px h-6 bg-line mx-1" />

        {/* Undo / Redo */}
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"
          className={`flex items-center justify-center w-8 h-8 rounded ${inactiveBtn} disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
          </svg>
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)"
          className={`flex items-center justify-center w-8 h-8 rounded ${inactiveBtn} disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" />
          </svg>
        </button>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => onScaleChange(Math.max(0.5, parseFloat((scale - 0.15).toFixed(2))))}
            className={`w-6 h-6 flex items-center justify-center rounded ${inactiveBtn} font-bold text-lg leading-none`}>−</button>
          <span className="text-xs text-fg2 w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button onClick={() => onScaleChange(Math.min(3, parseFloat((scale + 0.15).toFixed(2))))}
            className={`w-6 h-6 flex items-center justify-center rounded ${inactiveBtn} font-bold text-lg leading-none`}>+</button>
        </div>

        <div className="w-px h-6 bg-line mx-1" />

        {/* Page nav */}
        <div className="flex items-center gap-1">
          <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}
            className={`w-6 h-6 flex items-center justify-center rounded ${inactiveBtn} disabled:opacity-30 font-bold text-lg`}>‹</button>
          <span className="text-xs text-fg2 whitespace-nowrap px-1">{currentPage} / {numPages}</span>
          <button onClick={() => onPageChange(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages}
            className={`w-6 h-6 flex items-center justify-center rounded ${inactiveBtn} disabled:opacity-30 font-bold text-lg`}>›</button>
        </div>

        {/* Page management */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => onRotatePage(currentPage - 1, 90)} title="Rotate CW (90°)"
            className={`w-7 h-7 flex items-center justify-center rounded ${inactiveBtn} transition-colors`}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" /><path d="M21 8A9 9 0 1 0 6.3 6.3L3 3" />
            </svg>
          </button>
          <button onClick={() => onRotatePage(currentPage - 1, -90)} title="Rotate CCW (-90°)"
            className={`w-7 h-7 flex items-center justify-center rounded ${inactiveBtn} transition-colors`}>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v6h6" /><path d="M3 8a9 9 0 1 1 2.7-1.7L3 3" />
            </svg>
          </button>
          {numPages > 1 && (
            <>
              <button onClick={() => onMovePage(currentPage - 1, currentPage - 2)} disabled={currentPage <= 1} title="Move Page Up"
                className={`w-7 h-7 flex items-center justify-center rounded ${inactiveBtn} disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
                </svg>
              </button>
              <button onClick={() => onMovePage(currentPage - 1, currentPage)} disabled={currentPage >= numPages} title="Move Page Down"
                className={`w-7 h-7 flex items-center justify-center rounded ${inactiveBtn} disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" /><path d="M19 12l-7 7-7-7" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (numPages <= 1) return
              if (window.confirm(`Delete page ${currentPage}? This cannot be undone.`)) {
                onDeletePage(currentPage - 1)
                // Navigate to previous page if we're on the last page
              }
            }}
            disabled={numPages <= 1}
            title="Delete Page"
            className={`w-7 h-7 flex items-center justify-center rounded text-red-400 hover:bg-red-950/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            </svg>
          </button>
        </div>

        <div className="w-px h-6 bg-line mx-1" />

        <button onClick={onReset} className="px-3 py-1 text-xs rounded border border-line2 text-fg2 hover:bg-raised transition-colors">
          Close
        </button>
        <button onClick={onDownload} disabled={downloading}
          className="px-3 py-1 text-xs rounded bg-acc text-accon font-semibold hover:bg-acch disabled:opacity-50 flex items-center gap-1 transition-colors">
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
            <path d="M8 12l-4-4h2.5V3h3v5H12L8 12zM2 14h12v-1.5H2V14z" />
          </svg>
          {downloading ? 'Saving…' : 'Download'}
        </button>
      </div>

      {/* Row 2: contextual options */}
      {showRow2 && (
        <div className="px-3 py-1.5 border-t border-line bg-raised flex items-center gap-4 flex-wrap min-h-[38px]">
          {showColor && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-fg3 mr-0.5">Color</span>
              {SWATCHES.map((c) => (
                <button key={c} onClick={() => onOptionsChange({ color: c })} title={c}
                  style={{ backgroundColor: c, outline: toolOptions.color === c ? '2px solid var(--acc)' : '2px solid transparent', outlineOffset: '1px' }}
                  className="w-5 h-5 rounded-full border border-line2 transition-transform hover:scale-110 flex-shrink-0" />
              ))}
              <label title="Custom color" className="w-5 h-5 rounded-full border border-dashed border-line2 cursor-pointer flex items-center justify-center hover:scale-110 transition-transform overflow-hidden relative">
                <input type="color" value={toolOptions.color} onChange={(e) => onOptionsChange({ color: e.target.value })} className="absolute opacity-0 w-full h-full cursor-pointer" />
                <svg viewBox="0 0 16 16" className="w-3 h-3 text-fg3 pointer-events-none" fill="currentColor">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3z" opacity="0.3"/>
                  <circle cx="4.5" cy="8" r="1.5" fill="#ef4444"/><circle cx="8" cy="4.5" r="1.5" fill="#f59e0b"/>
                  <circle cx="11.5" cy="8" r="1.5" fill="#3b82f6"/><circle cx="8" cy="11.5" r="1.5" fill="#22c55e"/>
                </svg>
              </label>
              <div className="w-5 h-5 rounded border border-line2 flex-shrink-0" style={{ backgroundColor: toolOptions.color }} title={`Active: ${toolOptions.color}`} />
            </div>
          )}

          {showColor && (showStroke || showFontSize || showStamp) && <div className="w-px h-5 bg-line2" />}

          {showStroke && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-fg3 mr-0.5">Width</span>
              {STROKE_WIDTHS.map((w) => (
                <button key={w} onClick={() => onOptionsChange({ strokeWidth: w })}
                  className={`w-7 h-6 text-xs rounded border transition-colors font-medium ${optBtn(toolOptions.strokeWidth === w)}`}>{w}</button>
              ))}
            </div>
          )}

          {showFontSize && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-fg3 mr-0.5">Size</span>
              {FONT_SIZES.map((s) => (
                <button key={s} onClick={() => onOptionsChange({ fontSize: s })}
                  className={`w-8 h-6 text-xs rounded border transition-colors font-medium ${optBtn(toolOptions.fontSize === s)}`}>{s}</button>
              ))}
            </div>
          )}

          {showStamp && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-fg3 mr-0.5">Symbol</span>
              {STAMP_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => onOptionsChange({ stampSymbol: opt.value })}
                  className={`px-2.5 h-6 text-xs rounded border transition-colors ${optBtn(toolOptions.stampSymbol === opt.value)}`}>{opt.label}</button>
              ))}
            </div>
          )}

          {showOpacity && (
            <>
              {(showColor || showStroke || showFontSize || showStamp) && <div className="w-px h-5 bg-line2" />}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-fg3 mr-0.5">Opacity</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={toolOptions.opacity}
                  onChange={(e) => onOptionsChange({ opacity: parseFloat(e.target.value) })}
                  className="w-20 h-1 accent-[var(--acc)] cursor-pointer"
                />
                <span className="text-xs text-fg2 w-8 tabular-nums">{Math.round(toolOptions.opacity * 100)}%</span>
              </div>
            </>
          )}

          {HINTS[activeTool] && (
            <span className="text-xs text-fg3 ml-auto italic hidden sm:block">{HINTS[activeTool]}</span>
          )}
        </div>
      )}
    </div>
  )
}
