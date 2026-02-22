import { GraphNode, GraphEdge } from './types'

const REPULSION = 4000
const SPRING_K = 0.06
const REST_LEN = 130
const GRAVITY = 0.025
const DAMPING = 0.82
const ITERATIONS = 500

export function runForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): GraphNode[] {
  if (nodes.length === 0) return nodes

  const cx = width / 2
  const cy = height / 2
  const n = nodes.length
  const r = Math.min(width, height) * 0.35

  // Initialise on a circle
  const out: GraphNode[] = nodes.map((node, i) => ({
    ...node,
    x: cx + Math.cos((2 * Math.PI * i) / n) * r + (Math.random() - 0.5) * 20,
    y: cy + Math.sin((2 * Math.PI * i) / n) * r + (Math.random() - 0.5) * 20,
    vx: 0,
    vy: 0,
  }))

  const idxById = new Map(out.map((nd, i) => [nd.id, i]))
  const fx = new Float64Array(n)
  const fy = new Float64Array(n)

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const alpha = Math.pow(1 - iter / ITERATIONS, 1.5) // non-linear cooling

    fx.fill(0)
    fy.fill(0)

    // Repulsion between all pairs (O(n²) — fine for ≤ 100 nodes)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = out[j].x - out[i].x || 0.01
        const dy = out[j].y - out[i].y || 0.01
        const dist2 = dx * dx + dy * dy
        const dist = Math.sqrt(dist2)
        const f = REPULSION / dist2
        const nx = (dx / dist) * f
        const ny = (dy / dist) * f
        fx[i] -= nx; fy[i] -= ny
        fx[j] += nx; fy[j] += ny
      }
    }

    // Spring attraction along edges
    for (const edge of edges) {
      const si = idxById.get(edge.source)
      const ti = idxById.get(edge.target)
      if (si == null || ti == null) continue
      const dx = out[ti].x - out[si].x
      const dy = out[ti].y - out[si].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const f = SPRING_K * (dist - REST_LEN)
      const nx = (dx / dist) * f
      const ny = (dy / dist) * f
      fx[si] += nx; fy[si] += ny
      fx[ti] -= nx; fy[ti] -= ny
    }

    // Gravity toward center
    for (let i = 0; i < n; i++) {
      fx[i] += (cx - out[i].x) * GRAVITY
      fy[i] += (cy - out[i].y) * GRAVITY
    }

    // Integrate with cooling
    for (let i = 0; i < n; i++) {
      out[i].vx = (out[i].vx + fx[i] * alpha) * DAMPING
      out[i].vy = (out[i].vy + fy[i] * alpha) * DAMPING
      out[i].x += out[i].vx
      out[i].y += out[i].vy
    }
  }

  return out
}
