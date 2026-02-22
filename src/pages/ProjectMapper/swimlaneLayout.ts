import { GraphNode, GraphEdge } from './types'

export const LANE_W = 190   // width of each card / lane column
export const CARD_H = 44    // height of each file card
export const LANE_GAP = 68  // horizontal gap between lanes
export const CARD_GAP = 14  // vertical gap between cards
export const HEADER_H = 54  // lane header height
export const PAD = 32       // outer padding

function dirDepth(d: string): number {
  return d === '' ? 0 : d.split('/').length
}

/**
 * Position nodes in a swimlane (column) layout.
 * Each unique directory becomes a column sorted by depth then alphabetically.
 * Files within each column are sorted alphabetically top-to-bottom.
 */
export function runSwimlaneLayout(nodes: GraphNode[], _edges: GraphEdge[]): GraphNode[] {
  if (nodes.length === 0) return nodes

  const dirs = [...new Set(nodes.map(n => n.dir))].sort((a, b) => {
    const da = dirDepth(a), db = dirDepth(b)
    return da !== db ? da - db : a.localeCompare(b)
  })

  const colOf = new Map(dirs.map((d, i) => [d, i]))

  const groups = new Map<string, GraphNode[]>()
  for (const d of dirs) groups.set(d, [])
  for (const n of nodes) groups.get(n.dir)!.push(n)
  for (const [, g] of groups) g.sort((a, b) => a.label.localeCompare(b.label))

  return dirs.flatMap(dir => {
    const g = groups.get(dir)!
    const cx = PAD + colOf.get(dir)! * (LANE_W + LANE_GAP) + LANE_W / 2
    return g.map((n, i) => ({
      ...n,
      x: cx,
      y: PAD + HEADER_H + i * (CARD_H + CARD_GAP) + CARD_H / 2,
      vx: 0, vy: 0,
    }))
  })
}
