import { useState, useRef, useCallback, useEffect } from 'react'
import { GraphData, GraphNode, extColor } from './types'

interface Transform { x: number; y: number; scale: number }

interface Props {
  data: GraphData
  selectedId: string | null
  onSelectNode: (node: GraphNode | null) => void
}

function nodeRadius(node: GraphNode, data: GraphData): number {
  const degree = data.edges.filter(e => e.source === node.id || e.target === node.id).length
  return Math.max(14, Math.min(30, 14 + degree * 1.8))
}

export default function GraphCanvas({ data, selectedId, onSelectNode }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const dragRef = useRef<{ ox: number; oy: number; tx: number; ty: number; moved: boolean } | null>(null)

  // Fit graph into view on first load
  useEffect(() => {
    if (!data.nodes.length || !svgRef.current) return
    const svg = svgRef.current
    const W = svg.clientWidth || 800
    const H = svg.clientHeight || 600

    const xs = data.nodes.map(n => n.x)
    const ys = data.nodes.map(n => n.y)
    const minX = Math.min(...xs) - 50
    const maxX = Math.max(...xs) + 50
    const minY = Math.min(...ys) - 50
    const maxY = Math.max(...ys) + 50

    const gW = maxX - minX
    const gH = maxY - minY
    const scale = Math.min(1, W / gW, H / gH) * 0.9
    setTransform({
      scale,
      x: (W - gW * scale) / 2 - minX * scale,
      y: (H - gH * scale) / 2 - minY * scale,
    })
  }, [data])

  const connectedEdgeKeys = hoveredId
    ? new Set(data.edges.filter(e => e.source === hoveredId || e.target === hoveredId)
        .map(e => `${e.source}→${e.target}`))
    : null

  const connectedNodeIds = hoveredId
    ? new Set(data.edges.flatMap(e =>
        e.source === hoveredId ? [e.target] : e.target === hoveredId ? [e.source] : []
      ))
    : null

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.88 : 1.14
    setTransform(t => {
      const newScale = Math.max(0.08, Math.min(5, t.scale * factor))
      const rect = svgRef.current!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      return {
        scale: newScale,
        x: mx - (mx - t.x) * (newScale / t.scale),
        y: my - (my - t.y) * (newScale / t.scale),
      }
    })
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = { ox: e.clientX, oy: e.clientY, tx: transform.x, ty: transform.y, moved: false }
  }, [transform])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.ox
    const dy = e.clientY - dragRef.current.oy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true
    setTransform(t => ({ ...t, x: dragRef.current!.tx + dx, y: dragRef.current!.ty + dy }))
  }, [])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  const handleNodeClick = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation()
    if (dragRef.current?.moved) return
    onSelectNode(selectedId === node.id ? null : node)
  }

  const nodeById = new Map(data.nodes.map(n => [n.id, n]))

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
        <marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#94a3b8" />
        </marker>
        <marker id="arr-hi" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#3b82f6" />
        </marker>
        <marker id="arr-sel" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#6366f1" />
        </marker>
      </defs>

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
        {/* Edges — draw before nodes so nodes sit on top */}
        {data.edges.map(edge => {
          const s = nodeById.get(edge.source)
          const t = nodeById.get(edge.target)
          if (!s || !t) return null

          const edgeKey = `${edge.source}→${edge.target}`
          const isHovered = connectedEdgeKeys?.has(edgeKey) ?? false
          const isSelected = edge.source === selectedId || edge.target === selectedId
          const dimmed = (hoveredId && !isHovered) && !isSelected

          const dx = t.x - s.x
          const dy = t.y - s.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const sr = nodeRadius(s, data)
          const tr = nodeRadius(t, data)
          const x1 = s.x + (dx / dist) * sr
          const y1 = s.y + (dy / dist) * sr
          const x2 = t.x - (dx / dist) * (tr + 9)
          const y2 = t.y - (dy / dist) * (tr + 9)

          const color = isSelected ? '#6366f1' : isHovered ? '#3b82f6' : '#cbd5e1'
          const marker = isSelected ? 'url(#arr-sel)' : isHovered ? 'url(#arr-hi)' : 'url(#arr)'

          return (
            <line
              key={edgeKey}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={isHovered || isSelected ? 1.8 : 0.9}
              strokeOpacity={dimmed ? 0.12 : isHovered || isSelected ? 1 : 0.5}
              markerEnd={marker}
            />
          )
        })}

        {/* Nodes */}
        {data.nodes.map(node => {
          const r = nodeRadius(node, data)
          const color = extColor(node.ext)
          const isSelected = node.id === selectedId
          const isHovered = node.id === hoveredId
          const isConnected = connectedNodeIds?.has(node.id) ?? false
          const dimmed = hoveredId != null && !isHovered && !isConnected

          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onClick={e => handleNodeClick(e, node)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: 'pointer', opacity: dimmed ? 0.2 : 1 }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle r={r + 5} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="4 2" />
              )}
              {/* Hover glow */}
              {isHovered && (
                <circle r={r + 3} fill={color} fillOpacity={0.25} />
              )}

              {/* Main circle */}
              <circle
                r={r}
                fill={color}
                fillOpacity={0.88}
                stroke="white"
                strokeWidth={isHovered || isSelected ? 2 : 0.5}
                strokeOpacity={isHovered || isSelected ? 0.9 : 0.4}
              />

              {/* Extension badge inside node */}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(7, r * 0.45)}
                fontWeight="700"
                fill="white"
                style={{ pointerEvents: 'none' }}
              >
                .{node.ext}
              </text>

              {/* Filename label below */}
              <text
                y={r + 12}
                textAnchor="middle"
                fontSize={10}
                fontWeight={isSelected ? '600' : '400'}
                fill={isSelected ? '#6366f1' : 'var(--fg2, #64748b)'}
                style={{ pointerEvents: 'none' }}
              >
                {node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label}
              </text>
            </g>
          )
        })}
      </g>

      {/* Zoom controls overlay */}
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
              if (delta === 0) {
                // Reset
                setTransform({ x: 0, y: 0, scale: 1 })
              } else {
                setTransform(t => ({
                  ...t,
                  scale: Math.max(0.08, Math.min(5, t.scale * delta)),
                }))
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect width={26} height={26} rx={6} fill="var(--surface,#f8fafc)" stroke="var(--line,#e2e8f0)" strokeWidth={1} />
            <text x={13} y={13} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="var(--fg2,#64748b)">{label}</text>
          </g>
        ))}
      </g>

      {/* Legend overlay */}
      <g transform={`translate(${(svgRef.current?.clientWidth ?? 800) - 110},12)`}>
        <rect width={100} height={14} rx={4} fill="var(--surface,#f8fafc)" fillOpacity={0.85} />
        <text x={6} y={10} fontSize={8} fill="var(--fg3,#94a3b8)" fontWeight="500">
          Scroll to zoom · Drag to pan
        </text>
      </g>
    </svg>
  )
}
