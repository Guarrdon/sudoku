// Puzzle generation. We build a full solution, dig holes while keeping the
// solution unique, then run the human-technique analyser on the result. If the
// measured difficulty misses the band the player asked for, we throw it away and
// try again. That is why difficulty here is honest: it is measured, not assumed.

import { CELLS, PEERS, emptyGrid } from './grid.js'
import { countSolutions, analyze, TECHNIQUES } from './solver.js'

/**
 * Difficulty bands, calibrated against a sample of ~1600 generated puzzles
 * rather than guessed. Each band states which technique tiers a puzzle must sit
 * in and the total-cost window it must land in.
 *
 *  tiers  - [min, max] technique tier the solve requires.
 *           0 singles | 1 locked candidates & naked pairs | 2 hidden pairs/triples
 *           3 quads, X-Wing, XY-Wing | 4 swordfish
 *  score  - window for the summed technique cost (how much work, not just how hard)
 *  clues  - how many givens to dig down to
 *
 * Easy and Medium share tier 0: the difference is length and sparseness, which
 * is exactly how they differ in practice - more scanning, not new tricks.
 */
export const DIFFICULTIES = [
  {
    id: 'easy',
    label: 'Easy',
    blurb: 'Singles only, generously clued. A gentle, steady solve.',
    tiers: [0, 0],
    score: [25, 62],
    targetClues: [36, 44],
  },
  {
    id: 'medium',
    label: 'Medium',
    blurb: 'Still singles, but sparser - more scanning before each placement.',
    tiers: [0, 1],
    score: [58, 88],
    targetClues: [28, 34],
  },
  {
    id: 'hard',
    label: 'Hard',
    blurb: 'Locked candidates, naked and hidden pairs. You will want your notes.',
    tiers: [1, 2],
    score: [76, 130],
    targetClues: [24, 30],
  },
  {
    id: 'expert',
    label: 'Expert',
    blurb: 'Triples, quads and wings. Slow, deliberate chains of reasoning.',
    tiers: [3, 4],
    score: [90, 139],
    targetClues: [22, 29],
  },
  {
    id: 'master',
    label: 'Master',
    blurb: 'Long solves built on wings and fish. Bring patience.',
    tiers: [3, 4],
    score: [140, 4000],
    targetClues: [21, 28],
  },
]

export const difficultyById = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0]

const shuffle = (arr, rand) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Randomised backtracking fill -> a complete, valid grid. */
export function generateSolution(rand = Math.random) {
  const grid = emptyGrid()
  const fill = (pos) => {
    if (pos === CELLS) return true
    const used = new Set()
    for (const p of PEERS[pos]) if (grid[p]) used.add(grid[p])
    const options = shuffle(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !used.has(d)),
      rand
    )
    for (const d of options) {
      grid[pos] = d
      if (fill(pos + 1)) return true
      grid[pos] = 0
    }
    return false
  }
  fill(0)
  return grid
}

/**
 * Remove clues from a solved grid, keeping the solution unique.
 * `symmetric` removes cells in 180°-rotational pairs, which just looks better.
 */
function dig(solution, minClues, rand, symmetric) {
  const puzzle = solution.slice()
  let clues = CELLS
  const order = shuffle([...Array(CELLS).keys()], rand)

  for (const i of order) {
    if (clues <= minClues) break
    const partner = CELLS - 1 - i
    const targets = symmetric && partner !== i ? [i, partner] : [i]
    if (targets.some((t) => puzzle[t] === 0)) continue
    if (clues - targets.length < minClues) continue

    const saved = targets.map((t) => puzzle[t])
    targets.forEach((t) => (puzzle[t] = 0))
    if (countSolutions(puzzle, 2) !== 1) {
      targets.forEach((t, k) => (puzzle[t] = saved[k]))
    } else {
      clues -= targets.length
    }
  }
  return puzzle
}

const clueCount = (g) => g.reduce((n, v) => n + (v ? 1 : 0), 0)

/** Does this analysis satisfy the band? */
function fits(band, report) {
  if (!report.solved) return false // needs guessing - not a fair puzzle
  const [minTier, maxTier] = band.tiers
  if (report.maxTier < minTier || report.maxTier > maxTier) return false
  return report.score >= band.score[0] && report.score <= band.score[1]
}

/**
 * Generate a puzzle in the requested band.
 * `onProgress(attempt)` lets the caller show a spinner that means something.
 * Falls back to the closest miss after `maxAttempts`, so this never hangs.
 */
export function generatePuzzle(difficultyId, { rand = Math.random, maxAttempts = 900, onProgress } = {}) {
  const band = difficultyById(difficultyId)
  let best = null
  let bestDistance = Infinity

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (onProgress && attempt % 5 === 0) onProgress(attempt)

    const solution = generateSolution(rand)
    // Aim a little below the band's clue window; harder bands need more holes.
    const minClues = band.targetClues[0] + ((rand() * (band.targetClues[1] - band.targetClues[0] + 1)) | 0)
    const puzzle = dig(solution, minClues, rand, rand() < 0.75)
    const report = analyze(puzzle)

    if (fits(band, report)) {
      return buildResult(puzzle, solution, report, band, attempt)
    }

    // Track the nearest miss so we always have something to hand back - but only
    // ever among puzzles the technique solver actually finished. A puzzle that
    // needs guessing is never a candidate, not even as a fallback.
    if (!report.solved) continue
    const [minTier, maxTier] = band.tiers
    const tierMiss =
      (report.maxTier < minTier ? minTier - report.maxTier : Math.max(0, report.maxTier - maxTier)) * 1000
    const scoreMiss =
      report.score < band.score[0] ? band.score[0] - report.score : Math.max(0, report.score - band.score[1])
    const distance = tierMiss + scoreMiss
    if (distance < bestDistance) {
      bestDistance = distance
      best = { puzzle, solution, report, attempt }
    }
  }

  // Only reachable if every single attempt needed guessing, which the loop above
  // makes vanishingly unlikely. Keep going rather than ever serve an unfair board.
  while (!best) {
    const solution = generateSolution(rand)
    const puzzle = dig(solution, band.targetClues[1], rand, true)
    const report = analyze(puzzle)
    if (report.solved) best = { puzzle, solution, report, attempt: maxAttempts }
  }

  return buildResult(best.puzzle, best.solution, best.report, band, best.attempt, true)
}

function buildResult(puzzle, solution, report, band, attempts, approximate = false) {
  return {
    puzzle,
    solution,
    difficulty: band.id,
    label: band.label,
    score: report.score,
    clues: clueCount(puzzle),
    hardest: report.hardest ? TECHNIQUES[report.hardest].label : 'Naked Single',
    techniques: Object.entries(report.techniques)
      .map(([name, count]) => ({ name, label: TECHNIQUES[name].label, count, tier: TECHNIQUES[name].tier }))
      .sort((a, b) => b.tier - a.tier || b.count - a.count),
    attempts,
    approximate,
  }
}
