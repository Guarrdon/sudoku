import { createGame, reducer, isSolved, remainingCounts, NOTE_OFF, NOTE_PLAIN, NOTE_YES, NOTE_NO } from '../src/lib/game.js'
import { generatePuzzle } from '../src/lib/generator.js'
import { PEERS } from '../src/lib/grid.js'

let fail = 0
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`) }
const prefs = { autoClearNotes: true, flashConflicts: true }

const data = generatePuzzle('medium')
let g = createGame(data)
const blank = data.puzzle.findIndex((v) => !v)
const givenIdx = data.puzzle.findIndex((v) => v)

// selection + placement
g = reducer(g, { type: 'select', index: blank })
check('starts in value mode', g.mode === 'value')
const correct = data.solution[blank]
const wrong = correct === 9 ? 1 : correct + 1
g = reducer(g, { type: 'digit', digit: wrong, prefs })
check('places a digit', g.values[blank] === wrong)
check('placement is undoable', g.past.length === 1)

// check finds the wrong digit
g = reducer(g, { type: 'check' })
check('check flags the wrong square', g.errors.includes(blank) && g.mistakesFound === 1 && g.checksUsed === 1)

// the answer -> green -> red -> clear cycle, all on one key
g = reducer(g, { type: 'digit', digit: wrong, prefs })
check('same digit again turns the answer into a green note', g.values[blank] === 0 && g.notes[blank][wrong] === NOTE_YES)
check('leaving the answer clears that square\'s error flag', !g.errors.includes(blank))
g = reducer(g, { type: 'digit', digit: wrong, prefs })
check('third press turns the green note red', g.notes[blank][wrong] === NOTE_NO)
g = reducer(g, { type: 'digit', digit: wrong, prefs })
check('fourth press clears the square', g.values[blank] === 0 && g.notes[blank][wrong] === NOTE_OFF)

// a different digit always replaces outright rather than continuing the cycle
g = reducer(g, { type: 'digit', digit: wrong, prefs })
const other = wrong === 1 ? 2 : 1
g = reducer(g, { type: 'digit', digit: other, prefs })
check('a different digit replaces the answer outright', g.values[blank] === other)

// undo unwinds the cycle one step at a time
g = reducer(g, { type: 'undo' })
check('undo steps back through the cycle', g.values[blank] === wrong)
g = reducer(g, { type: 'digit', digit: wrong, prefs })
g = reducer(g, { type: 'erase' })
check('erase still clears in one go from mid-cycle', g.values[blank] === 0 && g.notes[blank].every((n) => n === NOTE_OFF))

// givens are immutable
let g2 = reducer(g, { type: 'select', index: givenIdx })
const beforeGiven = g2.values[givenIdx]
g2 = reducer(g2, { type: 'digit', digit: 5, prefs })
check('givens cannot be overwritten', g2.values[givenIdx] === beforeGiven)
g2 = reducer(g2, { type: 'erase' })
check('givens cannot be erased', g2.values[givenIdx] === beforeGiven)

// note cycling: off -> plain -> yes -> no -> off
g = reducer(g, { type: 'select', index: blank })
g = reducer(g, { type: 'mode', mode: 'note' })
const seen = []
for (let i = 0; i < 4; i++) { g = reducer(g, { type: 'digit', digit: 4, prefs }); seen.push(g.notes[blank][4]) }
check('note cycles grey -> green -> red -> off', JSON.stringify(seen) === JSON.stringify([NOTE_PLAIN, NOTE_YES, NOTE_NO, NOTE_OFF]), JSON.stringify(seen))

// direct green / red modes toggle
g = reducer(g, { type: 'mode', mode: 'yes' })
g = reducer(g, { type: 'digit', digit: 7, prefs })
check('green mode sets a green note', g.notes[blank][7] === NOTE_YES)
g = reducer(g, { type: 'digit', digit: 7, prefs })
check('green mode toggles off', g.notes[blank][7] === NOTE_OFF)
g = reducer(g, { type: 'mode', mode: 'no' })
g = reducer(g, { type: 'digit', digit: 7, prefs })
check('red mode sets a red note', g.notes[blank][7] === NOTE_NO)
g = reducer(g, { type: 'mode', mode: 'yes' })
g = reducer(g, { type: 'digit', digit: 7, prefs })
check('green overwrites red on the same digit', g.notes[blank][7] === NOTE_YES)

// placing a value wipes that cell's notes
g = reducer(g, { type: 'mode', mode: 'value' })
g = reducer(g, { type: 'digit', digit: correct, prefs })
check('placing a number clears that square\'s notes', g.notes[blank].every((n) => n === NOTE_OFF))

// auto-clear only touches plain notes on peers, never green/red
const peer = PEERS[blank].find((p) => !data.puzzle[p] && p !== blank)
let g3 = createGame(data)
g3 = reducer(g3, { type: 'select', index: peer })
g3 = reducer(g3, { type: 'mode', mode: 'note' })
g3 = reducer(g3, { type: 'digit', digit: correct, prefs })            // plain note
const peer2 = PEERS[blank].find((p) => !data.puzzle[p] && p !== blank && p !== peer)
g3 = reducer(g3, { type: 'select', index: peer2 })
g3 = reducer(g3, { type: 'mode', mode: 'yes' })
g3 = reducer(g3, { type: 'digit', digit: correct, prefs })            // green note
g3 = reducer(g3, { type: 'select', index: blank })
g3 = reducer(g3, { type: 'mode', mode: 'value' })
g3 = reducer(g3, { type: 'digit', digit: correct, prefs })
check('auto-clear removes the matching grey note from peers', g3.notes[peer][correct] === NOTE_OFF)
check('auto-clear leaves deliberate green notes alone', g3.notes[peer2][correct] === NOTE_YES)

// conflict flash
const conflictPeer = PEERS[blank].find((p) => data.puzzle[p])
let g4 = createGame(data)
g4 = reducer(g4, { type: 'select', index: blank })
g4 = reducer(g4, { type: 'digit', digit: data.puzzle[conflictPeer], prefs })
check('clashing placement flashes both squares', g4.flash && g4.flash.cells.includes(blank) && g4.flash.cells.includes(conflictPeer))

// undo / redo
let g5 = createGame(data)
g5 = reducer(g5, { type: 'select', index: blank })
g5 = reducer(g5, { type: 'digit', digit: 3, prefs })
g5 = reducer(g5, { type: 'undo' })
check('undo restores the square', g5.values[blank] === 0)
g5 = reducer(g5, { type: 'redo' })
check('redo re-applies it', g5.values[blank] === 3)

// remaining counts
let g6 = createGame(data)
const before = remainingCounts(g6)
g6 = reducer(g6, { type: 'select', index: blank })
g6 = reducer(g6, { type: 'digit', digit: 3, prefs })
check('remaining count drops as you place', remainingCounts(g6)[3] === before[3] - 1)

// full solve detection
let g7 = createGame(data)
for (let i = 0; i < 81; i++) {
  if (g7.givens[i]) continue
  g7 = reducer(g7, { type: 'select', index: i })
  g7 = reducer(g7, { type: 'digit', digit: data.solution[i], prefs })
}
check('filling every square registers as solved', isSolved(g7))
g7 = reducer(g7, { type: 'check' })
check('a correct board reports no errors', g7.errors.length === 0)

// movement clamps at edges
let g8 = reducer(createGame(data), { type: 'select', index: 0 })
g8 = reducer(g8, { type: 'move', dr: -1, dc: -1 })
check('arrow movement clamps at the corner', g8.selected === 0)

console.log(fail === 0 ? '\nAll game-logic checks passed.' : `\n${fail} FAILURES`)
process.exit(fail ? 1 : 0)
