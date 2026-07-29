// Two solvers:
//   1. `solve` / `countSolutions` - fast bitmask backtracking, used by the generator
//      to guarantee a puzzle has exactly one solution.
//   2. `analyze` - a human-technique solver that logs which strategies were needed.
//      That log is what gives us a real difficulty score instead of "count the clues".

import { CELLS, ROWS, COLS, BOXES, HOUSES, PEERS, rowOf, colOf, boxOf, idx } from './grid.js'

const ALL = 0b1111111110 // bits 1..9 set

const bitCount = (m) => {
  let n = 0
  while (m) {
    m &= m - 1
    n++
  }
  return n
}
const lowestDigit = (m) => 31 - Math.clz32(m & -m)
const digitsOf = (m) => {
  const out = []
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) out.push(d)
  return out
}

// ---------------------------------------------------------------- fast solver

/**
 * Backtracking search. Returns the number of solutions found, capped at `limit`.
 * `out` (optional) receives the first solution.
 */
export function countSolutions(grid, limit = 2, out = null) {
  const rowMask = new Int32Array(9)
  const colMask = new Int32Array(9)
  const boxMask = new Int32Array(9)
  const work = grid.slice()

  for (let i = 0; i < CELLS; i++) {
    const v = work[i]
    if (!v) continue
    const bit = 1 << v
    const r = rowOf(i)
    const c = colOf(i)
    const b = boxOf(i)
    if (rowMask[r] & bit || colMask[c] & bit || boxMask[b] & bit) return 0 // contradictory
    rowMask[r] |= bit
    colMask[c] |= bit
    boxMask[b] |= bit
  }

  let count = 0

  const recurse = () => {
    // Pick the empty cell with the fewest candidates (most-constrained first).
    let best = -1
    let bestMask = 0
    let bestCount = 10
    for (let i = 0; i < CELLS; i++) {
      if (work[i]) continue
      const mask = ALL & ~(rowMask[rowOf(i)] | colMask[colOf(i)] | boxMask[boxOf(i)])
      const n = bitCount(mask)
      if (n === 0) return false // dead end
      if (n < bestCount) {
        best = i
        bestMask = mask
        bestCount = n
        if (n === 1) break
      }
    }

    if (best === -1) {
      count++
      if (out && count === 1) for (let i = 0; i < CELLS; i++) out[i] = work[i]
      return count >= limit
    }

    const r = rowOf(best)
    const c = colOf(best)
    const b = boxOf(best)
    for (const d of digitsOf(bestMask)) {
      const bit = 1 << d
      work[best] = d
      rowMask[r] |= bit
      colMask[c] |= bit
      boxMask[b] |= bit
      const stop = recurse()
      work[best] = 0
      rowMask[r] &= ~bit
      colMask[c] &= ~bit
      boxMask[b] &= ~bit
      if (stop) return true
    }
    return false
  }

  recurse()
  return count
}

/** Returns the unique solution grid, or null if there are zero or many. */
export function solve(grid) {
  const out = new Array(CELLS).fill(0)
  const n = countSolutions(grid, 2, out)
  return n === 1 ? out : null
}

export const hasUniqueSolution = (grid) => countSolutions(grid, 2) === 1

// ------------------------------------------------------- human-style analysis

/**
 * Each technique carries a cost. Costs are tuned so that the total score lands
 * in a range players recognise: a puzzle of nothing but singles scores low,
 * one that needs a swordfish scores high.
 */
export const TECHNIQUES = {
  nakedSingle: { label: 'Naked Single', cost: 1, tier: 0 },
  hiddenSingle: { label: 'Hidden Single', cost: 2, tier: 0 },
  pointingPair: { label: 'Pointing Pair/Triple', cost: 5, tier: 1 },
  claiming: { label: 'Box/Line Reduction', cost: 6, tier: 1 },
  nakedPair: { label: 'Naked Pair', cost: 7, tier: 1 },
  hiddenPair: { label: 'Hidden Pair', cost: 10, tier: 2 },
  nakedTriple: { label: 'Naked Triple', cost: 13, tier: 2 },
  hiddenTriple: { label: 'Hidden Triple', cost: 17, tier: 2 },
  nakedQuad: { label: 'Naked Quad', cost: 20, tier: 3 },
  xWing: { label: 'X-Wing', cost: 24, tier: 3 },
  xyWing: { label: 'XY-Wing', cost: 30, tier: 3 },
  swordfish: { label: 'Swordfish', cost: 38, tier: 4 },
}

function buildCandidates(grid) {
  const cand = new Int32Array(CELLS)
  for (let i = 0; i < CELLS; i++) {
    if (grid[i]) {
      cand[i] = 0
      continue
    }
    let mask = ALL
    for (const p of PEERS[i]) if (grid[p]) mask &= ~(1 << grid[p])
    cand[i] = mask
  }
  return cand
}

function place(grid, cand, i, d) {
  grid[i] = d
  cand[i] = 0
  for (const p of PEERS[i]) cand[p] &= ~(1 << d)
}

// --- individual techniques. Each returns true if it changed something. -------

function nakedSingle(grid, cand) {
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] || cand[i] === 0) continue
    if (bitCount(cand[i]) === 1) {
      place(grid, cand, i, lowestDigit(cand[i]))
      return true
    }
  }
  return false
}

function hiddenSingle(grid, cand) {
  for (const house of HOUSES) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d
      let spot = -1
      let n = 0
      for (const i of house) {
        if (grid[i] === d) {
          n = 0
          break
        }
        if (cand[i] & bit) {
          spot = i
          n++
          if (n > 1) break
        }
      }
      if (n === 1) {
        place(grid, cand, spot, d)
        return true
      }
    }
  }
  return false
}

/** Candidates for d inside a box all sit in one row/column -> clear the rest of that line. */
function pointingPair(grid, cand) {
  for (let b = 0; b < 9; b++) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d
      const spots = BOXES[b].filter((i) => cand[i] & bit)
      if (spots.length < 2) continue
      const rows = new Set(spots.map(rowOf))
      const cols = new Set(spots.map(colOf))
      let changed = false
      if (rows.size === 1) {
        for (const i of ROWS[[...rows][0]]) {
          if (boxOf(i) !== b && cand[i] & bit) {
            cand[i] &= ~bit
            changed = true
          }
        }
      } else if (cols.size === 1) {
        for (const i of COLS[[...cols][0]]) {
          if (boxOf(i) !== b && cand[i] & bit) {
            cand[i] &= ~bit
            changed = true
          }
        }
      }
      if (changed) return true
    }
  }
  return false
}

/** Candidates for d inside a line all sit in one box -> clear the rest of that box. */
function claiming(grid, cand) {
  for (const line of [...ROWS, ...COLS]) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d
      const spots = line.filter((i) => cand[i] & bit)
      if (spots.length < 2) continue
      const boxes = new Set(spots.map(boxOf))
      if (boxes.size !== 1) continue
      const b = [...boxes][0]
      let changed = false
      for (const i of BOXES[b]) {
        if (!line.includes(i) && cand[i] & bit) {
          cand[i] &= ~bit
          changed = true
        }
      }
      if (changed) return true
    }
  }
  return false
}

/** n cells in a house share exactly n candidates -> those digits leave the rest of the house. */
function nakedSubset(grid, cand, size) {
  for (const house of HOUSES) {
    const cells = house.filter((i) => !grid[i] && bitCount(cand[i]) >= 2 && bitCount(cand[i]) <= size)
    if (cells.length <= size) continue
    const combo = []
    const walk = (start, mask) => {
      if (combo.length === size) {
        if (bitCount(mask) !== size) return false
        let changed = false
        for (const i of house) {
          if (combo.includes(i) || grid[i]) continue
          if (cand[i] & mask) {
            cand[i] &= ~mask
            changed = true
          }
        }
        return changed
      }
      for (let k = start; k < cells.length; k++) {
        const next = mask | cand[cells[k]]
        if (bitCount(next) > size) continue
        combo.push(cells[k])
        if (walk(k + 1, next)) return true
        combo.pop()
      }
      return false
    }
    if (walk(0, 0)) return true
  }
  return false
}

/** n digits appear in only the same n cells of a house -> those cells hold nothing else. */
function hiddenSubset(grid, cand, size) {
  for (const house of HOUSES) {
    const spots = {}
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d
      const cells = house.filter((i) => cand[i] & bit)
      if (cells.length >= 2 && cells.length <= size) spots[d] = cells
    }
    const digits = Object.keys(spots).map(Number)
    if (digits.length < size) continue
    const combo = []
    const walk = (start, union) => {
      if (combo.length === size) {
        if (union.size !== size) return false
        const mask = combo.reduce((m, d) => m | (1 << d), 0)
        let changed = false
        for (const i of union) {
          if (cand[i] & ~mask) {
            cand[i] &= mask
            changed = true
          }
        }
        return changed
      }
      for (let k = start; k < digits.length; k++) {
        const next = new Set([...union, ...spots[digits[k]]])
        if (next.size > size) continue
        combo.push(digits[k])
        if (walk(k + 1, next)) return true
        combo.pop()
      }
      return false
    }
    if (walk(0, new Set())) return true
  }
  return false
}

/** Basic fish: `size` lines where digit d sits in the same `size` cross-lines. */
function fish(grid, cand, size) {
  for (let d = 1; d <= 9; d++) {
    const bit = 1 << d
    for (const [lines, crossOf, crossLines, lineOf] of [
      [ROWS, colOf, COLS, rowOf],
      [COLS, rowOf, ROWS, colOf],
    ]) {
      const usable = []
      for (let l = 0; l < 9; l++) {
        const spots = lines[l].filter((i) => cand[i] & bit)
        if (spots.length >= 2 && spots.length <= size) usable.push({ l, crosses: spots.map(crossOf) })
      }
      if (usable.length < size) continue
      const combo = []
      const walk = (start, union) => {
        if (combo.length === size) {
          if (union.size !== size) return false
          let changed = false
          for (const c of union) {
            for (const i of crossLines[c]) {
              if (combo.some((u) => u.l === lineOf(i))) continue // keep the fish's own lines
              if (cand[i] & bit) {
                cand[i] &= ~bit
                changed = true
              }
            }
          }
          return changed
        }
        for (let k = start; k < usable.length; k++) {
          const next = new Set([...union, ...usable[k].crosses])
          if (next.size > size) continue
          combo.push(usable[k])
          if (walk(k + 1, next)) return true
          combo.pop()
        }
        return false
      }
      if (walk(0, new Set())) return true
    }
  }
  return false
}

/** Pivot XY sees XZ and YZ -> Z is impossible everywhere both wings can see. */
function xyWing(grid, cand) {
  const bivalue = []
  for (let i = 0; i < CELLS; i++) if (!grid[i] && bitCount(cand[i]) === 2) bivalue.push(i)

  for (const pivot of bivalue) {
    const wings = bivalue.filter((i) => i !== pivot && PEERS[pivot].includes(i))
    // Try both orientations of the pivot's pair: {x,y} then {y,x}.
    const pair = digitsOf(cand[pivot])
    for (const [x, y] of [pair, [pair[1], pair[0]]]) {
      for (const a of wings) {
        // wing A must be {x, z} with z outside the pivot's pair
        if (!(cand[a] & (1 << x)) || cand[a] & (1 << y)) continue
        const z = digitsOf(cand[a]).find((d) => d !== x)
        if (z === undefined) continue
        const wantB = (1 << y) | (1 << z)
        for (const b of wings) {
          if (b === a || cand[b] !== wantB) continue
          const zbit = 1 << z
          let changed = false
          for (const i of PEERS[a]) {
            if (i === pivot || i === b) continue
            if (!PEERS[b].includes(i)) continue
            if (cand[i] & zbit) {
              cand[i] &= ~zbit
              changed = true
            }
          }
          if (changed) return true
        }
      }
    }
  }
  return false
}

// Ordered cheapest-first: the analyser always reaches for the simplest tool that
// works, which is what a human does and what makes the score meaningful.
const STRATEGIES = [
  ['nakedSingle', nakedSingle],
  ['hiddenSingle', hiddenSingle],
  ['pointingPair', pointingPair],
  ['claiming', claiming],
  ['nakedPair', (g, c) => nakedSubset(g, c, 2)],
  ['hiddenPair', (g, c) => hiddenSubset(g, c, 2)],
  ['nakedTriple', (g, c) => nakedSubset(g, c, 3)],
  ['hiddenTriple', (g, c) => hiddenSubset(g, c, 3)],
  ['nakedQuad', (g, c) => nakedSubset(g, c, 4)],
  ['xWing', (g, c) => fish(g, c, 2)],
  ['xyWing', xyWing],
  ['swordfish', (g, c) => fish(g, c, 3)],
]

/**
 * Solve as a human would and report what it took.
 * -> { solved, score, techniques: {name: count}, hardest, maxTier }
 */
export function analyze(puzzle) {
  const grid = puzzle.slice()
  const cand = buildCandidates(grid)
  const techniques = {}
  let score = 0
  let maxTier = 0
  let hardest = null
  let hardestCost = -1
  let guard = 0

  for (;;) {
    if (++guard > 2000) break
    let empty = 0
    for (let i = 0; i < CELLS; i++) if (!grid[i]) empty++
    if (empty === 0) break

    let progressed = false
    for (const [name, fn] of STRATEGIES) {
      if (!fn(grid, cand)) continue
      const t = TECHNIQUES[name]
      techniques[name] = (techniques[name] || 0) + 1
      score += t.cost
      if (t.tier > maxTier) maxTier = t.tier
      // "Hardest" is the most expensive technique used, not merely the last one
      // at the top tier - otherwise the ever-present naked singles win.
      if (t.cost > hardestCost) {
        hardestCost = t.cost
        hardest = name
      }
      progressed = true
      break
    }
    if (!progressed) break
  }

  let solved = true
  for (let i = 0; i < CELLS; i++) if (!grid[i]) solved = false

  return { solved, score, techniques, hardest, maxTier }
}

export { bitCount, digitsOf }
