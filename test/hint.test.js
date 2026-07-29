// A hint must (a) always exist while a puzzle is unfinished, and (b) always be
// correct. Verify by solving whole puzzles using nothing but hints.
import { findHint, hintText } from '../src/lib/hint.js'
import { generatePuzzle, DIFFICULTIES } from '../src/lib/generator.js'
import { createGame, reducer } from '../src/lib/game.js'

let fail = 0
const check = (n, ok, x='') => { if (!ok) fail++; console.log(`${ok?'PASS':'FAIL'}  ${n}${x?'  '+x:''}`) }
const prefs = { autoClearNotes: true, flashConflicts: true }

for (const band of DIFFICULTIES) {
  const data = generatePuzzle(band.id)
  const g0 = createGame(data)
  let values = g0.values.slice()
  let steps = 0, placements = 0, techniques = {}, bad = null

  while (values.some((v) => !v) && steps < 400) {
    const h = findHint({ givens: g0.givens, values, solution: g0.solution })
    if (h.kind !== 'move') { bad = `hint kind=${h.kind} with ${values.filter(v=>!v).length} squares empty`; break }
    techniques[h.label] = (techniques[h.label] || 0) + 1
    // every hint must render three levels of text
    const t = hintText(h)
    if (t.length !== 3 || !t[0].body || !t[1].body || !t[2].body) { bad = 'hint text incomplete'; break }
    // every hint must end in a placement, or repeated hints would never advance
    if (!h.placement) { bad = 'hint did not lead to a placement'; break }
    if (g0.solution[h.placement.index] !== h.placement.digit) { bad = `hint suggested a WRONG placement at ${h.placement.index}`; break }
    for (const e of (h.eliminations || [])) {
      if (g0.solution[e.index] === e.digit) { bad = `hint tried to eliminate the TRUE digit ${e.digit} at ${e.index}`; break }
    }
    if (bad) break
    values[h.placement.index] = h.placement.digit
    placements++
    steps++
  }

  const done = values.every((v, i) => v === g0.solution[i])
  check(`${band.label}: solvable by hints alone`, done && !bad, bad || `${placements} placements, ${steps} hints, hardest used: ${Object.keys(techniques).slice(-1)[0]}`)
}

// hint spots a wrong number before anything else
const data = generatePuzzle('easy')
let g = createGame(data)
const blank = data.puzzle.findIndex((v) => !v)
const wrongDigit = data.solution[blank] === 9 ? 1 : data.solution[blank] + 1
g = reducer(g, { type: 'select', index: blank })
g = reducer(g, { type: 'digit', digit: wrongDigit, prefs })
const h = findHint(g)
check('a wrong number is reported before any technique', h.kind === 'mistake' && h.cells.includes(blank), h.kind)
check('mistake hint renders one message', hintText(h).length === 1)

// a finished grid reports solved
const solvedGame = { ...g, values: g.solution.slice() }
check('a finished grid reports solved', findHint(solvedGame).kind === 'solved')

// hints never depend on the player's notes being sane
let gn = createGame(data)
gn = reducer(gn, { type: 'select', index: blank })
gn = reducer(gn, { type: 'mode', mode: 'note' })
for (const d of [1,2,3,4,5,6,7,8,9]) gn = reducer(gn, { type: 'digit', digit: d, prefs })
const withNotes = findHint(gn)
const withoutNotes = findHint(createGame(data))
check('nonsense notes do not change the hint', JSON.stringify(withNotes.cells) === JSON.stringify(withoutNotes.cells))

console.log(fail === 0 ? '\nAll hint checks passed.' : `\n${fail} FAILURES`)
process.exit(fail ? 1 : 0)
