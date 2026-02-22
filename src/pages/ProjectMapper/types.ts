export interface GraphNode {
  id: string      // normalized file path (relative)
  label: string   // filename only
  ext: string     // extension without dot
  dir: string     // parent directory path
  x: number
  y: number
  vx: number
  vy: number
}

export interface GraphEdge {
  source: string  // node id
  target: string  // node id
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type Status = 'idle' | 'loading' | 'done' | 'error'

export const EXT_COLORS: Record<string, string> = {
  ts: '#3b82f6',
  tsx: '#6366f1',
  js: '#f59e0b',
  jsx: '#f97316',
  vue: '#22c55e',
  svelte: '#f43f5e',
  py: '#3b82f6',
  go: '#06b6d4',
  rs: '#f97316',
  java: '#ef4444',
  cs: '#a855f7',
  cpp: '#64748b',
  c: '#475569',
  rb: '#dc2626',
  php: '#7c3aed',
  swift: '#f97316',
  kt: '#a78bfa',
  css: '#ec4899',
  scss: '#c026d3',
  sass: '#db2777',
  less: '#8b5cf6',
  json: '#64748b',
  yaml: '#0891b2',
  yml: '#0891b2',
  md: '#78716c',
  toml: '#059669',
}

export function extColor(ext: string): string {
  return EXT_COLORS[ext.toLowerCase()] ?? '#6b7280'
}
