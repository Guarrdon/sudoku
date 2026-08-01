// Searches for teaching positions and writes src/lib/lessons.js.
//
// A lesson is only ever a puzzle string: the app replays it through the same
// technique solver to reach the position, so nothing can drift out of step. This
// script's job is to find puzzles where each technique actually comes up, and to
// pick the clearest examples of each.
//
//   node scripts/find-lessons.mjs [rounds]

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CELLS, PEERS, emptyGrid, toString81 } from '../src/lib/grid.js'
import { countSolutions, analyze, TECHNIQUES } from '../src/lib/solver.js'
import { generateSolution } from '../src/lib/generator.js'
import { findPosition } from '../src/lib/training.js'

const TARGETS = Object.keys(TECHNIQUES)
const WANT = 3 // examples kept per technique
const POOL = 12 // candidates considered before picking

// Deterministic RNG so a re-run reproduces the same lessons.
function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260731)

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function dig(solution, minClues, symmetric) {
  const puzzle = solution.slice()
  let clues = CELLS
  for (const i of shuffle([...Array(CELLS).keys()])) {
    if (clues <= minClues) break
    const partner = CELLS - 1 - i
    const targets = symmetric && partner !== i ? [i, partner] : [i]
    if (targets.some((t) => puzzle[t] === 0)) continue
    if (clues - targets.length < minClues) continue
    const saved = targets.map((t) => puzzle[t])
    targets.forEach((t) => (puzzle[t] = 0))
    if (countSolutions(puzzle, 2) !== 1) targets.forEach((t, k) => (puzzle[t] = saved[k]))
    else clues -= targets.length
  }
  return puzzle
}

/**
 * How good a teaching example this is. Lower is better.
 * A clear example is one where the board is well filled in (fewer candidates to
 * wade through) and the technique pays off visibly but not overwhelmingly.
 */
function score(view) {
  const empties = view.grid.filter((v) => !v).length
  const cuts = view.step.eliminations ? view.step.eliminations.length : 0
  const payoff = cuts === 0 ? 0 : Math.abs(cuts - 3) * 4 // two to four eliminations reads best
  return empties + payoff
}

const found = Object.fromEntries(TARGETS.map((t) => [t, []]))
const rounds = Number(process.argv[2] || 4000)

for (let round = 0; round < rounds; round++) {
  const missing = TARGETS.filter((t) => found[t].length < POOL)
  if (!missing.length) break

  const solution = generateSolution(rand)
  // Sweep the clue count: shallow digs give clean single-heavy boards, deep ones
  // are where the fish live.
  const minClues = 22 + ((rand() * 14) | 0)
  const puzzle = dig(solution, minClues, rand() < 0.5)
  const report = analyze(puzzle)
  if (!report.solved) continue

  for (const target of missing) {
    // Normally we only bother with boards the analyser says need this technique -
    // it is cheap, and it gets us the position where the technique is the move.
    // Once a technique is proving too rare for that (the naked quad), fall back
    // to replaying every board and taking the pattern wherever it turns up.
    if (!report.techniques[target] && found[target].length >= WANT) continue
    const position = findPosition(puzzle, target)
    if (!position) continue
    const view = { grid: position.grid, step: position.step }
    found[target].push({ puzzle: toString81(puzzle), cost: score(view) })
  }

  if (round % 250 === 0) {
    const short = TARGETS.filter((t) => found[t].length < WANT)
    process.stdout.write(
      `round ${round} · still short: ${short.length ? short.join(', ') : 'none'}\n`
    )
  }
}

// Hardest first when handing out puzzles: a swordfish position is much rarer
// than a naked pair, so it gets first refusal on the boards it appears in.
const order = [...TARGETS].reverse()
const claimed = new Set()
const picked = {}

for (const target of order) {
  const ranked = found[target].sort((a, b) => a.cost - b.cost)
  // A board already teaching another technique makes a duller second lesson, so
  // take a fresh one unless that would leave us short.
  const fresh = ranked.filter((r) => !claimed.has(r.puzzle))
  const best = [...fresh, ...ranked.filter((r) => claimed.has(r.puzzle))].slice(0, WANT)
  best.forEach((b) => claimed.add(b.puzzle))
  picked[target] = best.map((b) => b.puzzle)
  console.log(`${TECHNIQUES[target].label.padEnd(22)} ${best.length} example(s)`)
  if (!best.length) console.log(`  !! none found for ${target}`)
}

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'src', 'lib', 'lessons.js')

const body = TARGETS.map(
  (t) => `  ${t}: [\n${picked[t].map((p) => `    '${p}',`).join('\n')}\n  ],`
).join('\n')

writeFileSync(
  out,
  `// Teaching positions. Generated by scripts/find-lessons.mjs - do not hand-edit.
//
// Each entry is a puzzle in which that technique genuinely comes up. The app
// replays the puzzle with the technique solver and stops at the move, so the
// position taught is always the position a player would actually meet.

export const LESSON_PUZZLES = {
${body}
}
`
)
console.log(`\nwrote ${out}`)
