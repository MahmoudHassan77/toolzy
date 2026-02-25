// ── Table Detection for PDF-to-Word ──────────────────────────────────────────
// Detects tables in PDF text items by clustering into aligned rows and columns.

export interface TextItemForTable {
  str: string
  x: number
  y: number
  width: number
  height: number
  bold: boolean
  italic: boolean
  color?: string
  fontFamily?: string
}

export interface TableCell {
  row: number
  col: number
  text: string
  bold: boolean
  italic: boolean
  color?: string
  fontFamily?: string
}

export interface DetectedTable {
  cells: TableCell[][]  // rows × cols
  numRows: number
  numCols: number
  /** Y position of the first row (PDF coords, top of table) */
  yTop: number
  /** Y position of the last row (PDF coords, bottom of table) */
  yBottom: number
}

interface Row {
  y: number
  items: TextItemForTable[]
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Group items that share approximately the same Y coordinate into rows */
function groupIntoRows(items: TextItemForTable[], tolerance: number): Row[] {
  const rows: Row[] = []
  for (const item of items) {
    const existing = rows.find(r => Math.abs(r.y - item.y) <= tolerance)
    if (existing) {
      existing.items.push(item)
    } else {
      rows.push({ y: item.y, items: [item] })
    }
  }
  return rows
}

/** Find column boundaries from X positions across all rows */
function findColumnBoundaries(rows: Row[], tolerance: number): number[] {
  // Collect all unique X start positions
  const allX: number[] = []
  for (const row of rows) {
    for (const item of row.items) {
      allX.push(item.x)
    }
  }
  allX.sort((a, b) => a - b)

  // Cluster X positions
  const clusters: number[][] = []
  for (const x of allX) {
    const existing = clusters.find(c => Math.abs(c[c.length - 1] - x) <= tolerance)
    if (existing) {
      existing.push(x)
    } else {
      clusters.push([x])
    }
  }

  // A valid column needs items from multiple rows — at least 40% of rows
  const minRowsForColumn = Math.max(2, Math.floor(rows.length * 0.4))
  const validClusters = clusters.filter(c => {
    // Count how many distinct rows contribute to this cluster
    const distinctRows = new Set<number>()
    for (const row of rows) {
      for (const item of row.items) {
        if (c.some(cx => Math.abs(cx - item.x) <= tolerance)) {
          distinctRows.add(row.y)
        }
      }
    }
    return distinctRows.size >= minRowsForColumn
  })

  // Return the median X of each cluster as the column boundary
  return validClusters
    .map(c => c[Math.floor(c.length / 2)])
    .sort((a, b) => a - b)
}

/** Assign an item to the nearest column index */
function assignToColumn(itemX: number, colBoundaries: number[], tolerance: number): number {
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < colBoundaries.length; i++) {
    const dist = Math.abs(itemX - colBoundaries[i])
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  return bestDist <= tolerance * 2 ? bestIdx : -1
}

/** Build a table grid from rows and column boundaries */
function buildGrid(
  rows: Row[],
  colBoundaries: number[],
  tolerance: number,
): TableCell[][] {
  const grid: TableCell[][] = []

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const cells: TableCell[] = Array.from({ length: colBoundaries.length }, (_, c) => ({
      row: r,
      col: c,
      text: '',
      bold: false,
      italic: false,
    }))

    // Sort items left to right
    const sorted = [...row.items].sort((a, b) => a.x - b.x)

    for (const item of sorted) {
      const colIdx = assignToColumn(item.x, colBoundaries, tolerance)
      if (colIdx >= 0 && colIdx < cells.length) {
        const cell = cells[colIdx]
        if (cell.text) cell.text += ' '
        cell.text += item.str
        cell.bold = cell.bold || item.bold
        cell.italic = cell.italic || item.italic
        if (item.color) cell.color = item.color
        if (item.fontFamily) cell.fontFamily = item.fontFamily
      }
    }

    grid.push(cells)
  }

  return grid
}

/** Check if a grid qualifies as a valid table */
function isValidTable(grid: TableCell[][], numCols: number): boolean {
  if (grid.length < 2 || numCols < 2) return false

  // Check that most rows have at least 2 non-empty cells
  let rowsWithMultipleCells = 0
  for (const row of grid) {
    const filledCells = row.filter(c => c.text.trim().length > 0).length
    if (filledCells >= 2) rowsWithMultipleCells++
  }

  // At least 60% of rows should have multiple filled cells
  return rowsWithMultipleCells >= grid.length * 0.6
}

// ── main export ──────────────────────────────────────────────────────────────

/**
 * Detect tables in a set of text items from a single PDF page.
 * Returns detected tables and the items not part of any table.
 *
 * The algorithm is conservative: it prefers false negatives over false positives.
 */
export function detectTables<T extends TextItemForTable>(
  items: T[],
  pageWidth: number,
): { tables: DetectedTable[]; nonTableItems: T[] } {
  if (items.length < 4) {
    return { tables: [], nonTableItems: items }
  }

  const tolerance = pageWidth * 0.05
  const yTolerance = Math.max(
    3,
    (() => {
      const heights = items.map(i => i.height).filter(h => h > 1).sort((a, b) => a - b)
      const med = heights[Math.floor(heights.length / 2)] || 10
      return med * 0.45
    })(),
  )

  // Group all items into rows
  const allRows = groupIntoRows(items, yTolerance)

  // Need at least 2 rows to form a table
  if (allRows.length < 2) {
    return { tables: [], nonTableItems: items }
  }

  // Sort rows by Y descending (PDF coords: top of page = larger Y)
  allRows.sort((a, b) => b.y - a.y)

  // Find column boundaries across all rows
  const colBoundaries = findColumnBoundaries(allRows, tolerance)

  // Need at least 2 columns
  if (colBoundaries.length < 2) {
    return { tables: [], nonTableItems: items }
  }

  // Try to find contiguous groups of rows that form a table.
  // Strategy: scan rows top to bottom, collecting rows that fit the column
  // structure. When a row doesn't fit, end the current candidate table.
  const tables: DetectedTable[] = []
  const tableItemSets: Set<TextItemForTable>[] = []

  let candidateRows: Row[] = []

  function tryFlushCandidate() {
    if (candidateRows.length < 2) {
      candidateRows = []
      return
    }

    // Re-derive columns just for this group of rows (more precise)
    const localColBounds = findColumnBoundaries(candidateRows, tolerance)
    if (localColBounds.length < 2) {
      candidateRows = []
      return
    }

    const grid = buildGrid(candidateRows, localColBounds, tolerance)
    if (isValidTable(grid, localColBounds.length)) {
      const yValues = candidateRows.map(r => r.y)
      const table: DetectedTable = {
        cells: grid,
        numRows: grid.length,
        numCols: localColBounds.length,
        yTop: Math.max(...yValues),
        yBottom: Math.min(...yValues),
      }
      tables.push(table)

      // Track which items belong to this table
      const itemSet = new Set<TextItemForTable>()
      for (const row of candidateRows) {
        for (const item of row.items) {
          itemSet.add(item)
        }
      }
      tableItemSets.push(itemSet)
    }
    candidateRows = []
  }

  for (const row of allRows) {
    // Check if this row has items in at least 2 column positions
    let colHits = 0
    for (const bound of colBoundaries) {
      if (row.items.some(item => Math.abs(item.x - bound) <= tolerance * 2)) {
        colHits++
      }
    }

    if (colHits >= 2) {
      candidateRows.push(row)
    } else {
      tryFlushCandidate()
    }
  }
  tryFlushCandidate()

  // Determine which items are NOT part of any table
  const allTableItems = new Set<TextItemForTable>()
  for (const s of tableItemSets) {
    for (const item of s) {
      allTableItems.add(item)
    }
  }
  const nonTableItems = items.filter(item => !allTableItems.has(item))

  return { tables, nonTableItems }
}
