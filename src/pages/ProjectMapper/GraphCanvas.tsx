import { useState, useRef, useCallback, useEffect } from 'react'
import { GraphData, GraphNode, extColor } from './types'
import { LANE_W, CARD_H, LANE_GAP, CARD_GAP, HEADER_H, PAD } from './swimlaneLayout'

const STRIPE_W = 5
const CARD_RX = 7

interface Transform { x: number; y: number; scale: number }

interface Props {
  data: GraphData
  selectedId: string | null
  onSelectNode: (node: GraphNode | null) => void
}

export default function GraphCanvas({ data, selectedId, onSelectNode }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const dragRef = useRef<{ ox: number; oy: number; tx: number; ty: number; moved: boolean } | null>(null)

  // Fit all lanes into view on first load
  useEffect(() => {
    if (!data.nodes.length || !svgRef.current) return
    const svg = svgRef.current
    const W = svg.clientWidth || 800
    const H = svg.clientHeight || 600

    const xs = data.nodes.map(n => n.x)
    const ys = data.nodes.map(n => n.y)
    const minX = Math.min(...xs) - LANE_W / 2 - 20
    const maxX = Math.max(...xs) + LANE_W / 2 + 20
    const minY = PAD - 10
    const maxY = Math.max(...ys) + CARD_H / 2 + 24

    const gW = maxX - minX
    const gH = maxY - minY
    const scale = Math.min(1, W / gW, H / gH) * 0.92
    setTransform({
      scale,
      x: (W - gW * scale) / 2 - minX * scale,
      y: (H - gH * scale) / 2 - minY * scale,
    })
  }, [data])

  // ── Derive lane metadata from node positions ──────────────────
  const byDir = new Map<string, GraphNode[]>()
  for (const n of data.nodes) {
    if (!byDir.has(n.dir)) byDir.set(n.dir, [])
    byDir.get(n.dir)!.push(n)
  }

  const maxNodes = byDir.size > 0 ? Math.max(...[...byDir.values()].map(ns => ns.length)) : 0
  const laneTopY = PAD - 10
  // All lanes share the same height (uniform board/roadmap look)
  const laneTotalH = HEADER_H + maxNodes * (CARD_H + CARD_GAP) + CARD_GAP + 16

  const lanes = [...byDir.entries()].map(([dir, nodes]) => ({
    dir,
    label: dir === '' ? '(root)' : dir.split('/').pop()!,
    fullPath: dir || '/',
    laneX: nodes[0].x - LANE_W / 2,
    count: nodes.length,
  }))

  // ── Hover / selection state ────────────────────────────────────
  const connectedEdgeKeys = hoveredId
    ? new Set(data.edges
        .filter(e => e.source === hoveredId || e.target === hoveredId)
        .map(e => `${e.source}→${e.target}`))
    : null

  const connectedNodeIds = hoveredId
    ? new Set(data.edges.flatMap(e =>
        e.source === hoveredId ? [e.target] : e.target === hoveredId ? [e.source] : []))
    : null

  const nodeById = new Map(data.nodes.map(n => [n.id, n]))

  // ── Interaction handlers ───────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const f = e.deltaY > 0 ? 0.88 : 1.14
    setTransform(t => {
      const ns = Math.max(0.05, Math.min(5, t.scale * f))
      const rect = svgRef.current!.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      return { scale: ns, x: mx - (mx - t.x) * (ns / t.scale), y: my - (my - t.y) * (ns / t.scale) }
    })
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = { ox: e.clientX, oy: e.clientY, tx: transform.x, ty: transform.y, moved: false }
  }, [transform])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    const drag = dragRef.current
    const dx = e.clientX - drag.ox
    const dy = e.clientY - drag.oy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true
    setTransform(t => ({ ...t, x: drag.tx + dx, y: drag.ty + dy }))
  }, [])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  const handleNodeClick = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation()
    if (dragRef.current?.moved) return
    onSelectNode(selectedId === node.id ? null : node)
  }

  // ── Edge path builder ─────────────────────────────────────────
  function buildEdgePath(s: GraphNode, t: GraphNode): string {
    const sameCol = Math.abs(s.x - t.x) < 1
    if (sameCol) {
      // Loop to the right of the lane
      const x1 = s.x + LANE_W / 2, y1 = s.y
      const x2 = t.x + LANE_W / 2, y2 = t.y
      const loopX = x1 + LANE_GAP * 0.45
      return `M ${x1} ${y1} C ${loopX} ${y1} ${loopX} ${y2} ${x2} ${y2}`
    } else if (t.x > s.x) {
      // Forward (left → right): exit right, enter left
      const x1 = s.x + LANE_W / 2, y1 = s.y
      const x2 = t.x - LANE_W / 2, y2 = t.y
      const mx = (x1 + x2) / 2
      return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
    } else {
      // Backward (right → left): exit left, enter right
      const x1 = s.x - LANE_W / 2, y1 = s.y
      const x2 = t.x + LANE_W / 2, y2 = t.y
      const mx = (x1 + x2) / 2
      return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
    }
  }

  return (
    <svg
      ref={svgRef}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      onClick={() => onSelectNode(null)}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <defs>
        {/* Arrow markers */}
        <marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#94a3b8" />
        </marker>
        <marker id="arr-hi" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#3b82f6" />
        </marker>
        <marker id="arr-sel" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#6366f1" />
        </marker>
        {/*
          Shared card clip-path.
          Because clipPathUnits="userSpaceOnUse" (default), this rect is evaluated
          in each referencing element's local coordinate system — so it correctly
          clips all cards to their own (0,0)→(LANE_W,CARD_H) rounded shape.
        */}
        <clipPath id="card-clip">
          <rect width={LANE_W} height={CARD_H} rx={CARD_RX} />
        </clipPath>
      </defs>

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

        {/* ── Swimlane backgrounds ──────────────────────────────── */}
        {lanes.map(lane => (
          <g key={lane.dir}>
            {/* Lane body */}
            <rect
              x={lane.laneX - 8} y={laneTopY}
              width={LANE_W + 16} height={laneTotalH}
              rx={10}
              fill="var(--raised,#f1f5f9)" fillOpacity={0.55}
              stroke="var(--line,#e2e8f0)" strokeWidth={1}
            />
            {/* Header separator */}
            <line
              x1={lane.laneX - 8} y1={laneTopY + HEADER_H}
              x2={lane.laneX + LANE_W + 8} y2={laneTopY + HEADER_H}
              stroke="var(--line,#e2e8f0)" strokeWidth={1} strokeOpacity={0.8}
            />
            {/* Folder name */}
            <text
              x={lane.laneX + 8} y={laneTopY + 22}
              fontSize={12} fontWeight="700"
              fill="var(--fg1,#0f172a)"
            >
              {lane.label.length > 18 ? lane.label.slice(0, 16) + '…' : lane.label}
            </text>
            {/* Full path */}
            <text
              x={lane.laneX + 8} y={laneTopY + 38}
              fontSize={9} fontFamily="monospace"
              fill="var(--fg3,#94a3b8)"
            >
              {lane.fullPath.length > 28 ? '…' + lane.fullPath.slice(-26) : lane.fullPath}
            </text>
            {/* File count badge */}
            <rect
              x={lane.laneX + LANE_W - 24} y={laneTopY + 13}
              width={22} height={16} rx={8}
              fill="var(--acc,#6366f1)" fillOpacity={0.14}
            />
            <text
              x={lane.laneX + LANE_W - 13} y={laneTopY + 21}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={9} fontWeight="700"
              fill="var(--acc,#6366f1)"
            >
              {lane.count}
            </text>
          </g>
        ))}

        {/* ── Dependency edges ──────────────────────────────────── */}
        {data.edges.map(edge => {
          const s = nodeById.get(edge.source)
          const t = nodeById.get(edge.target)
          if (!s || !t) return null

          const edgeKey = `${edge.source}→${edge.target}`
          const isHovered = connectedEdgeKeys?.has(edgeKey) ?? false
          const isSelected = edge.source === selectedId || edge.target === selectedId
          const dimmed = !!hoveredId && !isHovered && !isSelected

          const d = buildEdgePath(s, t)
          const color = isSelected ? '#6366f1' : isHovered ? '#3b82f6' : '#94a3b8'
          const marker = isSelected ? 'url(#arr-sel)' : isHovered ? 'url(#arr-hi)' : 'url(#arr)'

          return (
            <path
              key={edgeKey}
              d={d}
              stroke={color}
              strokeWidth={isHovered || isSelected ? 2 : 1}
              strokeOpacity={dimmed ? 0.07 : isHovered || isSelected ? 0.9 : 0.32}
              fill="none"
              markerEnd={marker}
            />
          )
        })}

        {/* ── File cards (nodes) ────────────────────────────────── */}
        {data.nodes.map(node => {
          const isSelected = node.id === selectedId
          const isHovered = node.id === hoveredId
          const isConnected = connectedNodeIds?.has(node.id) ?? false
          const dimmed = hoveredId != null && !isHovered && !isConnected

          const color = extColor(node.ext)
          const lx = node.x - LANE_W / 2   // card top-left x
          const ty = node.y - CARD_H / 2   // card top-left y
          const name = node.label.length > 21 ? node.label.slice(0, 19) + '…' : node.label

          return (
            <g
              key={node.id}
              transform={`translate(${lx},${ty})`}
              onClick={e => handleNodeClick(e, node)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer', opacity: dimmed ? 0.2 : 1 }}
            >
              {/* Drop shadow */}
              <rect
                width={LANE_W} height={CARD_H} rx={CARD_RX}
                fill="rgba(0,0,0,0.09)"
                transform="translate(0,2)"
              />

              {/* Card interior clipped to rounded rect */}
              <g clipPath="url(#card-clip)">
                <rect width={LANE_W} height={CARD_H} fill="var(--surface,#fff)" />
                {/* Left color stripe */}
                <rect width={STRIPE_W} height={CARD_H} fill={color} />
                {/* Selected tint */}
                {isSelected && (
                  <rect width={LANE_W} height={CARD_H} fill="#6366f1" fillOpacity={0.07} />
                )}
                {/* Hover tint */}
                {isHovered && !isSelected && (
                  <rect width={LANE_W} height={CARD_H} fill="#3b82f6" fillOpacity={0.05} />
                )}
              </g>

              {/* Card border */}
              <rect
                width={LANE_W} height={CARD_H} rx={CARD_RX}
                fill="none"
                stroke={isSelected ? '#6366f1' : isHovered ? '#3b82f6' : 'var(--line2,#e2e8f0)'}
                strokeWidth={isSelected || isHovered ? 2 : 1}
              />

              {/* Filename */}
              <text
                x={STRIPE_W + 8} y={CARD_H / 2}
                dominantBaseline="middle"
                fontSize={11}
                fontWeight={isSelected ? '600' : '400'}
                fill={isSelected ? '#6366f1' : 'var(--fg1,#0f172a)'}
                style={{ pointerEvents: 'none' }}
              >
                {name}
              </text>

              {/* Extension badge */}
              <text
                x={LANE_W - 6} y={CARD_H / 2}
                textAnchor="end" dominantBaseline="middle"
                fontSize={9} fontWeight="600" fontFamily="monospace"
                fill={color} fillOpacity={0.85}
                style={{ pointerEvents: 'none' }}
              >
                .{node.ext}
              </text>
            </g>
          )
        })}
      </g>

      {/* ── Zoom controls overlay ─────────────────────────────── */}
      <g transform="translate(12,12)">
        {[
          { label: '+', delta: 1.2 },
          { label: '−', delta: 0.8 },
          { label: '⊡', delta: 0 },
        ].map(({ label, delta }, i) => (
          <g
            key={label}
            transform={`translate(0,${i * 30})`}
            onClick={e => {
              e.stopPropagation()
              delta === 0
                ? setTransform({ x: 0, y: 0, scale: 1 })
                : setTransform(t => ({ ...t, scale: Math.max(0.05, Math.min(5, t.scale * delta)) }))
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect width={26} height={26} rx={6} fill="var(--surface,#f8fafc)" stroke="var(--line,#e2e8f0)" strokeWidth={1} />
            <text x={13} y={13} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="var(--fg2,#64748b)">{label}</text>
          </g>
        ))}
      </g>

      {/* ── Legend ───────────────────────────────────────────── */}
      <g transform={`translate(${(svgRef.current?.clientWidth ?? 800) - 122},12)`}>
        <rect width={112} height={14} rx={4} fill="var(--surface,#f8fafc)" fillOpacity={0.85} />
        <text x={6} y={10} fontSize={8} fill="var(--fg3,#94a3b8)" fontWeight="500">
          Scroll to zoom · Drag to pan
        </text>
      </g>
    </svg>
  )
}
