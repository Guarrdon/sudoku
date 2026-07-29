// Core grid geometry and helpers. A grid is a plain Array(81) of 0-9 (0 = empty).

export const SIZE = 9
export const CELLS = 81

export const rowOf = (i) => (i / 9) | 0
export const colOf = (i) => i % 9
export const boxOf = (i) => ((i / 27) | 0) * 3 + (((i % 9) / 3) | 0)
export const idx = (r, c) => r * 9 + c

/** The 27 houses (9 rows, 9 columns, 9 boxes), each an array of 9 cell indices. */
export const ROWS = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => idx(r, c)))
export const COLS = Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => idx(r, c)))
export const BOXES = Array.from({ length: 9 }, (_, b) => {
  const r0 = ((b / 3) | 0) * 3
  const c0 = (b % 3) * 3
  return Array.from({ length: 9 }, (_, k) => idx(r0 + ((k / 3) | 0), c0 + (k % 3)))
})
export const HOUSES = [...ROWS, ...COLS, ...BOXES]

/** PEERS[i] = the 20 cells sharing a row, column or box with i. */
export const PEERS = Array.from({ length: CELLS }, (_, i) => {
  const set = new Set()
  for (const h of [ROWS[rowOf(i)], COLS[colOf(i)], BOXES[boxOf(i)]]) {
    for (const j of h) if (j !== i) set.add(j)
  }
  return [...set]
})

export const emptyGrid = () => new Array(CELLS).fill(0)
export const cloneGrid = (g) => g.slice()

/** Cells (given or filled) that clash with the value at `i`. Only compares placed digits. */
export function conflictsAt(grid, i) {
  const v = grid[i]
  if (!v) return []
  return PEERS[i].filter((p) => grid[p] === v)
}

export function isComplete(grid) {
  for (let i = 0; i < CELLS; i++) if (!grid[i]) return false
  return true
}

/** True if no house contains a repeated digit. */
export function isValid(grid) {
  for (const house of HOUSES) {
    let seen = 0
    for (const i of house) {
      const v = grid[i]
      if (!v) continue
      const bit = 1 << v
      if (seen & bit) return false
      seen |= bit
    }
  }
  return true
}

/** Serialise to an 81-char string, '.' for blanks. */
export const toString81 = (grid) => grid.map((v) => (v ? String(v) : '.')).join('')
export const fromString81 = (s) => [...s.trim()].map((ch) => (ch >= '1' && ch <= '9' ? +ch : 0))
