// Every training lesson is derived by replaying a real puzzle, so a lesson can
// go wrong in ways plain text never could: the position may fail to reproduce,
// or - far worse - the deduction being taught may be false. These checks solve
// each example puzzle outright and hold the lesson up against the answer.
import { LESSONS, buildExample, findPosition } from '../src/lib/training.js'
import { fromString81, isValid, PEERS } from '../src/lib/grid.js'
import { solve, digitsOf } from '../src/lib/solver.js'

let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok?'PASS':'FAIL'}  ${n}${x?'  '+x:''}`) }

check('every technique has a lesson', LESSONS.length === 12, `${LESSONS.length} lessons`)

for (const lesson of LESSONS) {
  const label = lesson.label
  check(`${label}: has examples`, lesson.puzzles.length > 0, `${lesson.puzzles.length}`)
  check(`${label}: has a full explanation`,
    !!(lesson.tagline && lesson.idea && lesson.why && lesson.spot) && lesson.why.length > 120)

  for (let e = 0; e < lesson.puzzles.length; e++) {
    const source = lesson.puzzles[e]
    const puzzle = fromString81(source)
    const solution = solve(puzzle)
    const view = buildExample(lesson, e)
    const where = `${label} example ${e + 1}`

    if (!solution) { check(`${where}: puzzle has one solution`, false); continue }
    if (!view) { check(`${where}: position reproduces`, false, 'technique never appears'); continue }

    check(`${where}: teaches the right technique`, view.step.name === lesson.id, view.step.name)

    // The replayed position must be a legal board on the way to the answer -
    // never a square that disagrees with the solution.
    const agrees = view.grid.every((v, i) => !v || v === solution[i])
    check(`${where}: position agrees with the solution`, agrees && isValid(view.grid))

    // Candidates must be the honest ones: exactly "not seen in a peer".
    const honest = view.grid.every((v, i) => {
      if (v) return view.cand[i] === 0
      const marks = digitsOf(view.cand[i])
      const blocked = new Set(PEERS[i].map((p) => view.grid[p]).filter(Boolean))
      return marks.includes(solution[i]) && marks.every((d) => !blocked.has(d))
    })
    check(`${where}: candidates are complete and correct`, honest)

    // The point of the whole exercise: what the lesson claims must be TRUE.
    const doomed = view.eliminations.find((el) => solution[el.index] === el.digit)
    check(`${where}: rules out nothing that is actually right`, !doomed,
      doomed ? `would erase the true ${doomed.digit} at ${doomed.index}` : `${view.eliminations.length} eliminations`)
    if (view.placement) {
      check(`${where}: the placement is the right digit`,
        solution[view.placement.index] === view.placement.digit)
    }
    check(`${where}: the move does something`,
      view.eliminations.length > 0 || !!view.placement)

    // The dimming has to be honest too: nothing the argument uses may be hidden.
    const covered = view.pattern.every((i) => view.stage.has(i)) &&
      view.eliminations.every((el) => view.stage.has(el.index)) &&
      (!view.placement || view.stage.has(view.placement.index))
    check(`${where}: nothing the deduction needs is dimmed`, covered)
    check(`${where}: dimming actually hides something`, view.stage.size < 81, `${view.stage.size} lit`)

    // Three beats, each with something to say, and each naming real squares.
    const steps = view.steps
    const worded = steps.length === 3 && steps.every((s) => s.heading && s.body && s.body.length > 40)
    check(`${where}: walkthrough is complete`, worded,
      worded ? '' : steps.map((s) => (s.body || '').length).join('/'))
    check(`${where}: walkthrough has no gaps`,
      steps.every((s) => !/undefined|NaN|\[object/.test(s.body)))
  }
}

// The finder must be deterministic - the same lesson twice is the same board.
const twice = [buildExample(LESSONS[0], 0), buildExample(LESSONS[0], 0)]
check('the same lesson always builds the same position',
  twice[0].grid.join('') === twice[1].grid.join(''))

// A technique that cannot occur must report that rather than improvise: on an
// empty board every digit fits everywhere, so no pattern is confined to anything.
check('a board with no pattern in it returns nothing',
  findPosition(fromString81('.'.repeat(81)), 'swordfish') === null)

console.log(fail === 0 ? '\nAll training checks passed.' : `\n${fail} FAILURES`)
process.exit(fail ? 1 : 0)
