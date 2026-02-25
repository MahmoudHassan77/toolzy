// ── Grid snapping utilities for Diagram Editor ──────────────────────────────

/** Default grid spacing (matches the background grid spacing in renderer.ts) */
export const GRID_SIZE = 24

/**
 * Snap a single value to the nearest grid line.
 * @param value   The coordinate value to snap
 * @param gridSize  Grid spacing (default: GRID_SIZE = 24)
 * @returns The nearest grid-aligned value
 */
export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize
}

/**
 * Snap an (x, y) point to the nearest grid intersection.
 * @param x  World-space X coordinate
 * @param y  World-space Y coordinate
 * @param gridSize  Grid spacing (default: GRID_SIZE = 24)
 * @returns An object with snapped { x, y } coordinates
 */
export function snapPoint(x: number, y: number, gridSize: number = GRID_SIZE): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  }
}

/**
 * Snap a bounding box's position while preserving its dimensions.
 * Useful for snapping shape origin during creation or movement.
 * @param x  Origin X
 * @param y  Origin Y
 * @param gridSize  Grid spacing (default: GRID_SIZE = 24)
 * @returns Snapped { x, y }
 */
export function snapOrigin(x: number, y: number, gridSize: number = GRID_SIZE): { x: number; y: number } {
  return snapPoint(x, y, gridSize)
}

/**
 * Snap both corners of a rectangle (used during shape creation drag).
 * Returns the snapped x, y, w, h so that both the origin and the
 * far corner align to the grid.
 */
export function snapRect(
  x: number, y: number, w: number, h: number,
  gridSize: number = GRID_SIZE,
): { x: number; y: number; w: number; h: number } {
  const sx = snapToGrid(x, gridSize)
  const sy = snapToGrid(y, gridSize)
  const sx2 = snapToGrid(x + w, gridSize)
  const sy2 = snapToGrid(y + h, gridSize)
  return { x: sx, y: sy, w: sx2 - sx, h: sy2 - sy }
}
