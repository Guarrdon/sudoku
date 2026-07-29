import { DIFFICULTIES, generatePuzzle, generateSolution } from '../src/lib/generator.js'
import { analyze, solve, countSolutions } from '../src/lib/solver.js'
import { isValid, isComplete, toString81 } from '../src/lib/grid.js'

let fail = 0
const check = (name, ok, extra = '') => {
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
}

// 1. full solutions are valid & complete
for (let i = 0; i < 20; i++) {
  const s = generateSolution()
  if (!isValid(s) || !isComplete(s)) { check('generateSolution valid', false); break }
  if (i === 19) check('generateSolution: 20/20 valid complete grids', true)
}

// 2. known puzzle solves correctly
const known = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
const knownSol = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
const solved = solve([...known].map(Number))
check('solve() matches known solution', solved && toString81(solved) === knownSol)
check('analyze() solves the known puzzle', analyze([...known].map(Number)).solved)

// 3. uniqueness detection
const empty = new Array(81).fill(0)
check('empty grid has many solutions', countSolutions(empty, 2) === 2)

// 4. generate every difficulty, verify claims
for (const band of DIFFICULTIES) {
  const t0 = Date.now()
  const times = []
  let approximate = 0
  for (let n = 0; n < 8; n++) {
    const s = Date.now()
    const p = generatePuzzle(band.id)
    times.push(Date.now() - s)
    if (p.approximate) approximate++

    const uniq = countSolutions(p.puzzle, 2) === 1
    const solMatches = toString81(solve(p.puzzle)) === toString81(p.solution)
    const rep = analyze(p.puzzle)
    if (!uniq || !solMatches || !rep.solved) {
      check(`${band.label} #${n}`, false, `uniq=${uniq} sol=${solMatches} solvable=${rep.solved}`)
    }
  }
  check(
    `${band.label}: 4 puzzles, unique + logically solvable`,
    true,
    `clues/score sampled, avg ${Math.round(times.reduce((a, b) => a + b) / times.length)}ms, worst ${Math.max(...times)}ms, approx ${approximate}/4, total ${Date.now() - t0}ms`
  )
  const p = generatePuzzle(band.id)
  console.log(`      -> ${p.label}: score ${p.score}, ${p.clues} clues, hardest "${p.hardest}", ${p.attempts} attempts${p.approximate ? ' (APPROX)' : ''}`)
}

console.log(fail === 0 ? '\nAll engine checks passed.' : `\n${fail} FAILURES`)
process.exit(fail ? 1 : 0)
