// Hints. Rather than handing over an answer, this finds the simplest technique
// that makes progress from where you actually are, and reveals it in stages:
// name the tactic -> show the squares -> spell out the move.
//
// It uses the same solver that rates the puzzle, so a hint is never a guess and
// never depends on your notes being right.

import { CELLS, colOf, rowOf } from './grid.js'
import { STRATEGIES, TECHNIQUES, buildCandidates } from './solver.js'

const BOX_NAMES = [
  'top-left box',
  'top-centre box',
  'top-right box',
  'middle-left box',
  'centre box',
  'middle-right box',
  'bottom-left box',
  'bottom-centre box',
  'bottom-right box',
]

/** "row 4" / "column 7" / "the centre box" */
export function houseName(house) {
  if (!house) return null
  if (house.type === 'box') return `the ${BOX_NAMES[house.index]}`
  return `${house.type} ${house.index + 1}`
}

export const squareName = (i) => `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`

/** What the technique is, in plain terms - the part that actually teaches. */
const EXPLAIN = {
  nakedSingle: 'Every other digit already appears in this square’s row, column or box, so only one can be left.',
  hiddenSingle:
    'Look at where this digit can still go in this house. Every square but one is blocked, so it must go in the square that remains.',
  pointingPair:
    'Inside this box, the digit only fits in squares that all share one line. Wherever it ends up, it is somewhere on that line — so it cannot be anywhere else along it, outside the box.',
  claiming:
    'Along this line, the digit only fits inside a single box. So it must be in that box on this line, and can be removed from the rest of the box.',
  nakedPair:
    'These two squares can only hold these two digits between them. They will take one each, so neither digit can appear anywhere else in the house.',
  nakedTriple:
    'These three squares only hold these three digits between them. They take one each, so those digits are unavailable elsewhere in the house.',
  nakedQuad:
    'These four squares only hold these four digits between them, so those digits cannot appear elsewhere in the house.',
  hiddenPair:
    'These two digits can only go in these two squares in this house. Between them they fill both, so nothing else can live in those squares — any other notes there can go.',
  hiddenTriple:
    'These three digits are confined to these three squares in this house, so no other digit can occupy them.',
  xWing:
    'The digit is confined to the same two cross-lines in two different lines, forming a rectangle. Whichever way the pair resolves, both cross-lines get one — so the digit can be removed from those cross-lines everywhere else.',
  swordfish:
    'Like an X-Wing but three lines wide: the digit is confined to the same three cross-lines across three lines, so it can be removed from those cross-lines elsewhere.',
  xyWing:
    'The pivot shares a digit with each wing, and both wings share a third digit. Whichever way the pivot resolves, one of the wings becomes that third digit — so it can be removed from any square both wings can see.',
}

/**
 * Work out the next thing to do.
 * Returns one of:
 *   { kind: 'mistake', cells }        - a placed number disagrees with the solution
 *   { kind: 'solved' }                - nothing left to do
 *   { kind: 'move', ... }             - the next technique, with squares and the move
 *   { kind: 'stuck' }                 - shouldn't happen; every puzzle is solvable
 */
export function findHint({ givens, values, solution }) {
  // A wrong number poisons every deduction after it, so deal with that first.
  const wrong = []
  for (let i = 0; i < CELLS; i++) {
    if (!givens[i] && values[i] && values[i] !== solution[i]) wrong.push(i)
  }
  if (wrong.length) return { kind: 'mistake', cells: wrong }

  let empty = 0
  for (let i = 0; i < CELLS; i++) if (!values[i]) empty++
  if (empty === 0) return { kind: 'solved' }

  // Run the solver on a copy of the current position. Candidates come from the
  // numbers on the board, so your own notes can be wrong without misleading it.
  const grid = values.slice()
  const cand = buildCandidates(grid)

  // Keep deducing until a number can actually go in. Eliminations alone don't
  // change the grid, so a hint that stopped at one would repeat itself forever
  // and never move you on. The chain we walk is the reasoning; the placement at
  // the end is the thing you can actually do.
  const chain = []
  for (let guard = 0; guard < 60; guard++) {
    let step = null
    for (const [name, fn] of STRATEGIES) {
      const found = fn(grid, cand)
      if (found) {
        step = { name, ...found }
        break
      }
    }
    if (!step) break
    chain.push(step)
    if (step.placement) {
      // Teach the most demanding step it took to get here - that's the one
      // actually standing between you and the next number.
      const key = chain.reduce((a, b) => (TECHNIQUES[b.name].cost > TECHNIQUES[a.name].cost ? b : a))
      return {
        kind: 'move',
        name: key.name,
        label: TECHNIQUES[key.name].label,
        explain: EXPLAIN[key.name] || '',
        tier: TECHNIQUES[key.name].tier,
        cells: key.cells,
        house: key.house,
        digits: key.digits,
        eliminations: key.eliminations,
        placement: step.placement,
        steps: chain.length,
      }
    }
  }

  return { kind: 'stuck' }
}

/** The three levels of a hint, as sentences. */
export function hintText(hint) {
  if (!hint) return []

  if (hint.kind === 'mistake') {
    const n = hint.cells.length
    return [
      {
        heading: 'Something is wrong already',
        body: `${n === 1 ? 'One of the numbers you have placed is' : `${n} of the numbers you have placed are`} not correct. Nothing will work out until ${n === 1 ? 'it is' : 'they are'} fixed — use Check to find ${n === 1 ? 'it' : 'them'}.`,
      },
    ]
  }

  if (hint.kind === 'solved') {
    return [{ heading: 'All done', body: 'The grid is complete.' }]
  }

  if (hint.kind === 'stuck') {
    return [
      {
        heading: 'No hint available',
        body: 'The solver cannot find a next step from this position, which should not happen — please report it.',
      },
    ]
  }

  const where = houseName(hint.house)
  const digits = hint.digits.join(' and ')

  // Level 1 - what to look for, and roughly where. No squares given away, and
  // for a naked single not even the digit, or there'd be nothing left to find.
  let firstBody
  if (hint.name === 'nakedSingle') {
    firstBody = 'Somewhere on the board there is a square where eight digits are already blocked, leaving only one.'
  } else if (where) {
    firstBody = `There is one in ${where}${hint.digits.length ? `, involving ${hint.digits.length > 1 ? 'the digits' : 'the digit'} ${digits}` : ''}.`
  } else {
    firstBody = `There is one on this board involving the digit ${digits}.`
  }
  const first = {
    heading: `Look for ${/^[aeiou]/i.test(hint.label) ? 'an' : 'a'} ${hint.label}`,
    body: firstBody,
  }

  // Level 2 - the squares, and why the technique works.
  const second = {
    heading: 'How it works',
    body: hint.explain,
    highlight: hint.cells,
  }

  // Level 2b - what that technique rules out, when it isn't itself a placement.
  const els = hint.eliminations || []
  if (els.length) {
    const digit = els[0].digit
    const sameDigit = els.every((e) => e.digit === digit)
    const list = els.slice(0, 3).map((e) => squareName(e.index)).join('; ')
    const more = els.length > 3 ? `, and ${els.length - 3} more` : ''
    second.body += sameDigit
      ? ` That rules ${digit} out of ${list}${more}.`
      : ` That rules out ${els.length} notes, starting with ${els[0].digit} in ${squareName(els[0].index)}.`
  }

  // Level 3 - the number you can actually write in.
  const third = {
    heading: 'The move',
    body:
      `Place ${hint.placement.digit} in ${squareName(hint.placement.index)}.` +
      (hint.steps > 1 ? ` (${hint.steps} deductions from here.)` : ''),
    highlight: hint.cells,
    focus: [hint.placement.index],
  }

  return [first, second, third]
}
