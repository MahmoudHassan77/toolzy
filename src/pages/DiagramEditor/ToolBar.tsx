import { Tool, Style, Background } from './types'

// ── Icons ─────────────────────────────────────────────────────────────────

const Icons: Record<string, JSX.Element> = {
  select: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l7 18 3-7 7-3L4 4z" strokeLinejoin="round" /></svg>),
  pan:    (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11V6a2 2 0 014 0v5m-4 0H6a2 2 0 000 4h12a2 2 0 000-4h-3m-4 0v4" /><path d="M12 18v2" /></svg>),
  pen:    (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 17c2-4 4-8 6-8s2 4 4 4 3-6 5-6" /><line x1="3" y1="21" x2="21" y2="21" /></svg>),
  eraser: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16l10-10 7 7-3.5 3.5" /><path d="M6.5 17.5l4-4" /></svg>),
  rect:   (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="1" /></svg>),
  roundrect: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="5" /></svg>),
  diamond:(<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l9 9-9 9-9-9 9-9z" /></svg>),
  ellipse:(<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="9" ry="6" /></svg>),
  parallelogram: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 19h12l3-14H9L6 19z" /></svg>),
  arrow:  (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5" /><polyline points="9 5 19 5 19 15" /></svg>),
  'dashed-arrow': (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2" strokeLinejoin="round"><line x1="5" y1="19" x2="19" y2="5" /><polyline points="9 5 19 5 19 15" strokeDasharray="none" /></svg>),
  line:   (<svg viewBox="0 0 24 24" className="w-4 h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="20" x2="20" y2="4" /></svg>),
  text:   (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V5h16v2" strokeLinecap="round" /><path d="M12 5v14" strokeLinecap="round" /><path d="M8 19h8" strokeLinecap="round" /></svg>),
  undo:   (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></svg>),
  redo:   (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" /></svg>),
  trash:  (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>),
  export: (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>),
  reset:  (<svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 100 0v-3m0 3l3-3m-3 3l-3-3" /></svg>),
}

// ── Tool groups ───────────────────────────────────────────────────────────

type ToolDef = { id: Tool; label: string; hint: string }
const GROUPS: { heading: string; tools: ToolDef[] }[] = [
  {
    heading: 'Navigate',
    tools: [
      { id: 'select', label: 'Select',   hint: 'Select / move shapes · Double-click to edit label · Del to delete' },
      { id: 'pan',    label: 'Pan',      hint: 'Drag to pan canvas · Also: Space + drag on any tool · Scroll to zoom' },
    ],
  },
  {
    heading: 'Draw',
    tools: [
      { id: 'pen',    label: 'Pen',    hint: 'Freehand — pressure-sensitive on stylus/pen input' },
      { id: 'eraser', label: 'Eraser', hint: 'Erase freehand pen strokes — drag over strokes to remove them' },
    ],
  },
  {
    heading: 'UML / Flowchart Shapes',
    tools: [
      { id: 'rect',          label: 'Rectangle',     hint: 'Process box · Class box · Component' },
      { id: 'roundrect',     label: 'Round Rect',    hint: 'Terminal / Start-End node' },
      { id: 'diamond',       label: 'Diamond',       hint: 'Decision node' },
      { id: 'ellipse',       label: 'Ellipse',       hint: 'Use-case bubble · State circle' },
      { id: 'parallelogram', label: 'Parallelogram', hint: 'Input / Output node' },
    ],
  },
  {
    heading: 'Connectors',
    tools: [
      { id: 'arrow',        label: 'Arrow',        hint: 'Association / Directed edge (filled head)' },
      { id: 'dashed-arrow', label: 'Dashed Arrow', hint: 'Dependency / Realization / Interface usage' },
      { id: 'line',         label: 'Line',         hint: 'Undirected link' },
    ],
  },
  {
    heading: 'Label',
    tools: [
      { id: 'text', label: 'Text', hint: 'Click to place a standalone text label · Shift+Enter for multiline' },
    ],
  },
]

const SWATCHES = ['#000000', '#1e293b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']
const FILLS    = ['transparent', 'rgba(255,255,255,0.9)', '#fef9c3', '#dcfce7', '#dbeafe', '#ede9fe', '#ffe4e6']
const WIDTHS   = [1, 2, 3, 5, 8]
const SIZES    = [10, 12, 13, 14, 16, 20, 24]

const BG_OPTIONS: { id: Background; label: string; title: string }[] = [
  { id: 'dots',  label: '⠿', title: 'Dot grid' },
  { id: 'grid',  label: '⊞', title: 'Grid lines' },
  { id: 'lines', label: '☰', title: 'Horizontal lines' },
  { id: 'none',  label: '□', title: 'No background' },
]

interface Props {
  tool: Tool
  style: Style
  background: Background
  canUndo: boolean
  canRedo: boolean
  selectedShapeType?: string | null
  onToolChange:     (t: Tool) => void
  onStyleChange:    (patch: Partial<Style>) => void
  onBackgroundChange: (bg: Background) => void
  onUndo:    () => void
  onRedo:    () => void
  onClear:   () => void
  onExport:  () => void
  onReset:   () => void
}

export default function ToolBar({
  tool, style, background, canUndo, canRedo,
  selectedShapeType,
  onToolChange, onStyleChange, onBackgroundChange,
  onUndo, onRedo, onClear, onExport, onReset,
}: Props) {
  const AB = 'bg-acc text-accon shadow-sm'
  const IB = 'text-fg2 hover:bg-raised hover:text-fg1'
  const btn = (active: boolean) =>
    `flex items-center justify-center w-8 h-8 rounded transition-colors ${active ? AB : IB}`
  const optBtn = (active: boolean) =>
    active
      ? 'border-acc bg-acc/10 text-acc'
      : 'border-line text-fg2 hover:border-acc hover:text-fg1'

  // When in select mode with a shape selected, derive style context from that shape's type
  const activeType = (tool === 'select' || tool === 'pan') && selectedShapeType
    ? selectedShapeType
    : tool
  const showStyle = tool !== 'select' && tool !== 'pan' || Boolean(selectedShapeType)
  const isConn = activeType === 'arrow' || activeType === 'dashed-arrow' || activeType === 'line'
  const isText = activeType === 'text'
  const hint = GROUPS.flatMap(g => g.tools).find(t => t.id === tool)?.hint

  return (
    <div className="bg-surface border-b border-line shrink-0 select-none">
      {/* ── Row 1: tools + actions ───────────────────────────────── */}
      <div className="px-3 py-1.5 flex items-center gap-1 flex-wrap min-h-[46px] overflow-x-auto">
        {GROUPS.map((group, gi) => (
          <div key={group.heading} className="flex items-center gap-0.5">
            {gi > 0 && <div className="w-px h-6 bg-line mx-1 shrink-0" />}
            {group.tools.map(t => (
              <button
                key={t.id}
                title={`${t.label} — ${t.hint}`}
                onClick={() => onToolChange(t.id)}
                className={btn(tool === t.id)}
              >
                {Icons[t.id]}
              </button>
            ))}
          </div>
        ))}

        <div className="w-px h-6 bg-line mx-1 shrink-0" />

        {/* Undo / Redo */}
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"
          className={`${btn(false)} disabled:opacity-30 disabled:cursor-not-allowed`}>
          {Icons.undo}
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)"
          className={`${btn(false)} disabled:opacity-30 disabled:cursor-not-allowed`}>
          {Icons.redo}
        </button>

        <div className="w-px h-6 bg-line mx-1 shrink-0" />

        {/* View reset */}
        <button onClick={onReset} title="Reset view (fit to 100%)" className={btn(false)}>
          {Icons.reset}
        </button>

        <div className="w-px h-6 bg-line mx-1 shrink-0" />

        {/* Background picker */}
        {BG_OPTIONS.map(bg => (
          <button
            key={bg.id}
            title={bg.title}
            onClick={() => onBackgroundChange(bg.id)}
            className={`flex items-center justify-center w-8 h-8 rounded text-sm transition-colors ${
              background === bg.id ? AB : IB
            }`}
          >
            {bg.label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Clear */}
        <button onClick={() => { if (confirm('Clear all shapes?')) onClear() }}
          title="Clear canvas" className={`${btn(false)} hover:text-red-500`}>
          {Icons.trash}
        </button>

        {/* Export PNG */}
        <button onClick={onExport} title="Export as PNG"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-acc text-accon hover:opacity-90 transition-opacity shrink-0">
          {Icons.export}
          <span className="hidden sm:inline">PNG</span>
        </button>
      </div>

      {/* ── Row 2: style options (contextual) ────────────────────── */}
      {showStyle && (
        <div
          className="px-3 py-1.5 border-t border-line bg-raised flex flex-wrap items-center gap-x-5 gap-y-1.5 min-h-[42px]"
          onMouseDown={e => e.preventDefault()}  // keep focus in textarea while changing style
        >

          {/* Stroke color */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-fg3 font-semibold shrink-0">
              {isText ? 'Color' : 'Stroke'}
            </span>
            {SWATCHES.map(c => (
              <button
                key={c}
                onClick={() => onStyleChange({ stroke: c })}
                title={c}
                style={{
                  backgroundColor: c,
                  outline: style.stroke === c ? '2px solid var(--acc)' : '2px solid transparent',
                  outlineOffset: 2,
                  boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #cbd5e1' : undefined,
                }}
                className="w-5 h-5 rounded-full shrink-0 hover:scale-110 transition-transform"
              />
            ))}
            {/* Custom */}
            <label className="relative w-5 h-5 rounded-full border border-dashed border-line cursor-pointer overflow-hidden flex items-center justify-center hover:scale-110 transition-transform" title="Custom color">
              <input type="color" value={style.stroke} className="absolute opacity-0 w-full h-full cursor-pointer"
                onChange={e => onStyleChange({ stroke: e.target.value })} />
              <svg viewBox="0 0 16 16" className="w-3 h-3 text-fg3 pointer-events-none" fill="currentColor">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <circle cx="5" cy="8" r="1.5" fill="#ef4444" /><circle cx="8" cy="5" r="1.5" fill="#f59e0b" />
                <circle cx="11" cy="8" r="1.5" fill="#3b82f6" /><circle cx="8" cy="11" r="1.5" fill="#22c55e" />
              </svg>
            </label>
          </div>

          {/* Fill color (shapes only) */}
          {!isText && !isConn && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-fg3 font-semibold shrink-0">Fill</span>
              {FILLS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => onStyleChange({ fill: c })}
                  title={c === 'transparent' ? 'No fill' : c}
                  style={{
                    backgroundColor: c === 'transparent' ? undefined : c,
                    outline: style.fill === c ? '2px solid var(--acc)' : '2px solid transparent',
                    outlineOffset: 2,
                  }}
                  className="w-5 h-5 rounded border border-line shrink-0 hover:scale-110 transition-transform"
                >
                  {c === 'transparent' && (
                    <svg viewBox="0 0 20 20" className="w-full h-full text-fg3" stroke="currentColor" strokeWidth="1.5">
                      <line x1="2" y1="2" x2="18" y2="18" />
                    </svg>
                  )}
                </button>
              ))}
              <label className="relative w-5 h-5 rounded border border-dashed border-line cursor-pointer overflow-hidden hover:scale-110 transition-transform" title="Custom fill">
                <input type="color" value={style.fill === 'transparent' || style.fill.startsWith('rgba') ? '#ffffff' : style.fill}
                  className="absolute opacity-0 w-full h-full cursor-pointer"
                  onChange={e => onStyleChange({ fill: e.target.value })} />
                <div className="w-full h-full" style={{ background: 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }} />
              </label>
            </div>
          )}

          {/* Line width */}
          {!isText && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-fg3 font-semibold mr-0.5 shrink-0">Width</span>
              {WIDTHS.map(w => (
                <button key={w} onClick={() => onStyleChange({ lineWidth: w })}
                  className={`w-7 h-6 text-xs rounded border font-medium transition-colors ${optBtn(style.lineWidth === w)}`}>
                  {w}
                </button>
              ))}
            </div>
          )}

          {/* Font size (text tool) */}
          {isText && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-fg3 font-semibold mr-0.5 shrink-0">Size</span>
              {SIZES.map(s => (
                <button key={s} onClick={() => onStyleChange({ fontSize: s })}
                  className={`w-8 h-6 text-xs rounded border font-medium transition-colors ${optBtn(style.fontSize === s)}`}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Curved connector */}
          {isConn && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-fg3 font-semibold shrink-0">Curved</span>
              <button
                onClick={() => onStyleChange({ curved: !style.curved })}
                title="Toggle curved connector"
                className={`w-8 h-6 text-xs rounded border font-medium transition-colors ${optBtn(style.curved)}`}>
                ⌒
              </button>
            </div>
          )}

          {/* Bidirectional arrow */}
          {isConn && activeType !== 'line' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-fg3 font-semibold shrink-0">Both ends</span>
              <button
                onClick={() => onStyleChange({ arrowBoth: !style.arrowBoth })}
                className={`w-8 h-6 text-xs rounded border font-medium transition-colors ${optBtn(style.arrowBoth)}`}>
                ⟷
              </button>
            </div>
          )}

          {/* Hint */}
          {hint && (
            <span className="ml-auto text-xs text-fg3 italic hidden lg:block truncate max-w-xs">
              {hint}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
