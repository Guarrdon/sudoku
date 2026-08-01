// Training. Each lesson is a real puzzle plus the name of a technique. We replay
// the puzzle with the same technique solver that rates puzzles and gives hints,
// and stop at the move - so the position on screen is one a player would
// genuinely reach, not a mock-up, and it cannot drift away from the solver.
//
// Everything the deduction does not depend on is then dimmed. What is left is
// the argument, and nothing else.

import { BOXES, COLS, PEERS, ROWS, boxOf, colOf, fromString81, rowOf } from './grid.js'
import { STRATEGIES, TECHNIQUES, buildCandidates, digitsOf } from './solver.js'
import { houseName, squareName } from './hint.js'
import { LESSON_PUZZLES } from './lessons.js'

const houseCells = (h) =>
  h.type === 'row' ? ROWS[h.index] : h.type === 'column' ? COLS[h.index] : BOXES[h.index]

const list = (items, join = 'and') =>
  items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} ${join} ${items[items.length - 1]}`

const lineName = (type, index) => `${type} ${index + 1}`
const sentence = (s) => s[0].toUpperCase() + s.slice(1)

// Prose, not a readout: small counts belong in words, and plurals have to agree
// with whatever the position happens to hand us.
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const word = (n) => WORDS[n] ?? String(n)
const count = (n, noun, plural = `${noun}s`) => `${word(n)} ${n === 1 ? noun : plural}`

const STRATEGY_BY_NAME = Object.fromEntries(STRATEGIES)

/**
 * Replay `puzzle` and hand back the board as it stood the moment before `target`
 * was used, along with the move itself.
 *
 * We would always rather show the position where the technique is the cheapest
 * thing that works, because that is the position a player actually gets stuck in.
 * Some techniques hardly ever get to be that - a naked quad is nearly always
 * beaten to it by a smaller subset - so we fall back to the earliest point in the
 * solve where the pattern is simply there to be seen. Either way the deduction on
 * screen is a real one, on a real board.
 *
 * Returns null if the technique never appears at all; the tests check that no
 * lesson we ship can do that.
 */
export function findPosition(puzzle, target, limit = 400) {
  const grid = puzzle.slice()
  const cand = buildCandidates(grid)
  const probe = STRATEGY_BY_NAME[target]
  let earliest = null

  for (let guard = 0; guard < limit; guard++) {
    // Strategies apply themselves as a side effect, so the position we want to
    // teach only exists before the call. Snapshot first, then look.
    const gridBefore = grid.slice()
    const candBefore = cand.slice()

    if (!earliest) {
      const hit = probe(gridBefore.slice(), candBefore.slice())
      if (hit) earliest = { grid: gridBefore, cand: candBefore, step: { name: target, ...hit } }
    }

    let fired = null
    for (const [name, fn] of STRATEGIES) {
      const found = fn(grid, cand)
      if (found) {
        fired = { name, ...found }
        break
      }
    }
    if (!fired) break
    if (fired.name === target) return { grid: gridBefore, cand: candBefore, step: fired }
  }
  return earliest
}

/**
 * The squares the deduction actually rests on. Everything else gets dimmed.
 * For most techniques that is the house it happens in; the pattern techniques
 * carry their own geometry, so each says what it needs.
 */
function stageCells(step, grid) {
  const out = new Set(step.cells)
  const add = (cells) => cells.forEach((i) => out.add(i))

  if (step.house) add(houseCells(step.house))
  if (step.target) add(houseCells(step.target))
  for (const e of step.eliminations || []) out.add(e.index)

  switch (step.name) {
    // The house alone shows the conclusion but not the reason. Bring in the
    // digits elsewhere on the board that do the blocking, and the picture
    // becomes the cross-hatch a player would draw by eye.
    case 'hiddenSingle': {
      const d = step.digits[0]
      for (const j of houseCells(step.house)) {
        if (grid[j] || j === step.cells[0]) continue
        for (const p of PEERS[j]) if (grid[p] === d) out.add(p)
      }
      break
    }
    // The proof is "everything this square can see", so show all three houses.
    case 'nakedSingle': {
      const i = step.cells[0]
      add(ROWS[rowOf(i)])
      add(COLS[colOf(i)])
      add(BOXES[boxOf(i)])
      break
    }
    // Base lines carry the pattern, cover lines carry the payoff. Both are argument.
    case 'xWing':
    case 'swordfish': {
      const rows = new Set(step.cells.map(rowOf))
      const cols = new Set(step.cells.map(colOf))
      for (const r of rows) add(ROWS[r])
      for (const c of cols) add(COLS[c])
      break
    }
    // Only the links matter: how the pivot reaches each wing, and where the
    // wings overlap. The rest of the board is scenery.
    case 'xyWing': {
      for (const wing of step.cells) {
        if (wing === step.pivot) continue
        if (rowOf(wing) === rowOf(step.pivot)) add(ROWS[rowOf(wing)])
        else if (colOf(wing) === colOf(step.pivot)) add(COLS[colOf(wing)])
        else add(BOXES[boxOf(wing)])
      }
      break
    }
    default:
      break
  }
  return out
}

/** Which lines a fish is built from, derived from its cells. */
function fishLines(step) {
  const byRow = step.house.type === 'row'
  const base = [...new Set(step.cells.map(byRow ? rowOf : colOf))].sort((a, b) => a - b)
  const cover = [...new Set(step.cells.map(byRow ? colOf : rowOf))].sort((a, b) => a - b)
  return { byRow, base, cover, baseType: byRow ? 'row' : 'column', coverType: byRow ? 'column' : 'row' }
}

// --------------------------------------------------------------- the walkthrough

/**
 * Three beats per lesson: here is the position, here is the pattern, here is what
 * it buys you. Each beat says something the board cannot say on its own, and the
 * board reveals a little more as you step through.
 */
const WALKTHROUGH = {
  nakedSingle: (v) => {
    const i = v.pattern[0]
    const d = v.placement.digit
    return [
      `Only the row, column and box of one square are lit — twenty squares in all, plus the square itself at ${squareName(i)}. Those twenty are everything that square can see.`,
      `Read the digits standing in those twenty squares: every digit but ${d} is already among them. That is eight separate bans, leaving one candidate in the square and nothing beside it.`,
      `So ${d} goes in ${squareName(i)}. Not "probably" — there is no other digit the square is allowed to hold.`,
    ]
  },

  hiddenSingle: (v) => {
    const d = v.digits[0]
    const where = houseName(v.step.house)
    const i = v.placement.index
    const others = v.candCount[i] - 1
    return [
      `Lit here: ${where}, and every ${d} elsewhere on the board — because those are what do the work. Ask one question of the house: where in here can a ${d} still go?`,
      `Trace each of those ${d}s along its own row, column and box. Between them they reach every empty square in ${where} but one. That square is the only home the digit has left.`,
      `${sentence(where)} must contain a ${d} somewhere, and only ${squareName(i)} can take it.${
        others > 0
          ? ` Notice that this square still shows ${count(others, 'other candidate')} — that is why it is "hidden". From the square's own point of view nothing is settled; only the house gives it away.`
          : ''
      }`,
    ]
  },

  pointingPair: (v) => {
    const d = v.digits[0]
    const box = houseName(v.step.house)
    const line = lineName(v.step.target.type, v.step.target.index)
    return [
      `Lit here: ${box}, and the whole of ${line} running through it. The digit in question is ${d}.`,
      `Inside ${box}, ${d} has ${count(v.pattern.length, 'square')} left to it — and ${v.pattern.length === 2 ? 'both' : 'every one of them'} sit${v.pattern.length === 2 ? '' : 's'} on ${line}. Which of them takes it is still unknown, and does not matter.`,
      `The box has to place its ${d} somewhere, and every option is on ${line}. So the ${d} of ${line} is used up inside this box: it can be struck from the rest of ${line}, ${count(v.eliminations.length, 'square')} outside the box.`,
    ]
  },

  claiming: (v) => {
    const d = v.digits[0]
    const line = lineName(v.step.house.type, v.step.house.index)
    const box = houseName(v.step.target)
    return [
      `Lit here: the whole of ${line}, and ${box} which it passes through. The digit in question is ${d}.`,
      `Along the whole of ${line}, ${d} fits in only ${count(v.pattern.length, 'square')} — and all of them happen to lie inside ${box}.`,
      `${sentence(line)} must hold a ${d}, so that ${d} is somewhere in this box. The box only gets one, so it cannot also be on the box's other rows and columns: strike ${d} from ${count(v.eliminations.length, 'square')} in ${box}.`,
    ]
  },

  nakedPair: (v) => subsetWalk(v, 2, 'naked'),
  nakedTriple: (v) => subsetWalk(v, 3, 'naked'),
  nakedQuad: (v) => subsetWalk(v, 4, 'naked'),
  hiddenPair: (v) => subsetWalk(v, 2, 'hidden'),
  hiddenTriple: (v) => subsetWalk(v, 3, 'hidden'),

  xWing: (v) => fishWalk(v, 2),
  swordfish: (v) => fishWalk(v, 3),

  xyWing: (v) => {
    const z = v.digits[0]
    const pivot = v.step.pivot
    const wings = v.pattern.filter((i) => i !== pivot)
    const pivotDigits = digitsOf(v.cand[pivot])
    return [
      `Three squares, each holding exactly two candidates: the pivot at ${squareName(pivot)}, and two wings at ${list(wings.map(squareName))}. Only the houses that link them are lit.`,
      `The pivot is ${list(pivotDigits.map(String), 'or')} — nothing else. Each wing shares one of those digits with the pivot, and both wings carry ${z} as their second candidate.`,
      `Run it both ways. If the pivot is ${pivotDigits[0]}, the wing that shares ${pivotDigits[0]} is pushed off it and becomes ${z}. If the pivot is ${pivotDigits[1]}, the other wing becomes ${z} instead. Either way one of the wings is ${z} — so no square that both wings can see may be ${z}. That clears ${count(v.eliminations.length, 'square')}.`,
    ]
  },
}

function subsetWalk(v, size, kind) {
  const where = houseName(v.step.house)
  const digits = list(v.digits.map(String))
  // Reading order, not the order the solver happened to find them in.
  const squares = list([...v.pattern].sort((a, b) => a - b).map(squareName))
  const n = word(size)
  const cut = count(v.eliminations.length, 'note')

  if (kind === 'naked') {
    return [
      `Everything outside ${where} is dimmed — a naked subset is an argument about one house and nothing else.`,
      `These ${n} squares (${squares}) show only ${n} different candidates between them: ${digits}.${
        size > 2 ? ` Not ${n} apiece, necessarily — it is the union that counts.` : ''
      }`,
      `${sentence(n)} squares needing ${n} digits, with nowhere else to draw from: they take one each, in some order. Those digits are spoken for, so they leave every other square in ${where} — ${cut} struck.`,
    ]
  }
  return [
    `Everything outside ${where} is dimmed. Instead of reading the squares, count where each digit can still go in this house.`,
    `The digits ${digits} are confined to the same ${n} squares: ${squares}. Nowhere else in ${where} can take any of them.`,
    `${sentence(where)} needs ${size === 2 ? 'both' : `all ${n}`} digits and has only these ${n} squares to put them in, so they fill them completely. Anything else pencilled into those squares is impossible — ${cut} struck, which often leaves a plain naked subset you can read straight off.`,
  ]
}

function fishWalk(v, size) {
  const d = v.digits[0]
  const { base, cover, baseType, coverType } = fishLines(v.step)
  const baseList = list(base.map((i) => `${i + 1}`))
  const coverList = list(cover.map((i) => `${i + 1}`))
  const n = word(size)
  const cut = count(v.eliminations.length, 'note')
  // An X-Wing's rows hold exactly two; a swordfish's may hold two or three.
  const places = size === 2 ? 'exactly two places' : 'at most three places'

  return [
    `One digit only — ${d}. Only its marks are drawn; every other candidate on the board is hidden. Lit: ${baseType}s ${baseList}, where the pattern lives, and ${coverType}s ${coverList}, where it pays off.`,
    `In each of those ${n} ${baseType}s, ${d} has ${places} left, and every one of them falls in ${coverType}s ${coverList}. The corners make a ${size === 2 ? 'rectangle' : 'lattice'}.`,
    `Each of the ${n} ${baseType}s must place a ${d}, and all of them are drawing on the same ${n} ${coverType}s. ${sentence(n)} digits into ${n} ${coverType}s means one apiece — those ${coverType}s are now full. Any ${d} elsewhere in ${coverType}s ${coverList} is impossible: ${cut} struck.`,
  ]
}

const HEADINGS = ['The position', 'The pattern', 'The deduction']

// ------------------------------------------------------------------- lessons

/**
 * The ladder. Order is the order to learn them in, which is also cheapest-first -
 * the same order the solver reaches for them.
 */
export const LESSONS = [
  {
    id: 'nakedSingle',
    group: 'Singles',
    tagline: 'One square with nothing left to be.',
    idea: 'A naked single is a square that has run out of options. Every square sees twenty others — the eight beside it in its row, the eight in its column, and the four remaining in its box. If those twenty show eight different digits between them, the ninth is the only thing this square can hold.',
    why: 'There is no guesswork in it. The single rule of Sudoku is that a digit cannot repeat within a row, column or box, so every digit standing in one of those twenty squares is banned here. Eight bans leave one survivor, and the survivor has to be the answer: a square cannot be left empty at the end.',
    spot: 'These hide unless you keep candidates. Pencil them in and a naked single is simply a square down to one mark. The cheapest habit in Sudoku is to glance at the twenty squares you have just constrained every time you write a number in — a naked single is very often created by the move you just made.',
  },
  {
    id: 'hiddenSingle',
    group: 'Singles',
    tagline: 'One digit with one place left to go.',
    idea: 'A hidden single asks the opposite question to a naked single. Rather than "what can go in this square?", ask "where can this digit go in this house?". Every row, column and box holds each digit exactly once. If eight of a house\'s nine squares are unavailable to a digit, the ninth must take it — no matter how many other candidates that square is showing.',
    why: 'The house is obliged to contain the digit somewhere and there is exactly one place left, so that is where it goes. It is called hidden because the square itself gives nothing away: it may still be showing four candidates, and looks entirely undecided. The deduction only exists when you look at the whole house at once.',
    spot: 'Cross-hatching is the classic method: take one digit, and for each box strike through every row and column already carrying it, then look at what is left of the box. The "last empty square in a house" that beginners fill by counting is just the easiest possible case of this.',
  },
  {
    id: 'pointingPair',
    group: 'Locked candidates',
    tagline: 'A digit trapped on one line inside a box.',
    idea: "Inside a single box, all the remaining places for a digit happen to fall on one row (or one column). You still don't know which of them takes it — and you don't need to. You know it lands on that line, inside that box.",
    why: 'The box must place the digit somewhere, and every square available to it lies on that line. So the digit is on that line. A line holds each digit only once, and this box has already claimed it — therefore the digit cannot appear anywhere else along the line, outside the box.',
    spot: 'Work box by box, digit by digit. Two or three candidates for a digit standing in a straight line within a box is the signal. Then follow the line out of the box in both directions and rub the digit out. This and box/line reduction are the two techniques that make hard puzzles tractable — learn them before any of the subsets.',
  },
  {
    id: 'claiming',
    group: 'Locked candidates',
    tagline: 'A digit trapped in one box along a line.',
    idea: 'The mirror image of the pointing pair. Look along a whole row or column: if every remaining place for a digit falls inside a single box, the line has claimed that digit for the box.',
    why: 'The line must place the digit, and all of its options are in this box, so the digit is in this box — on this line. The box gets one of each digit, and its allocation is now used up on this line, so the digit can go from the box\'s other two rows or columns.',
    spot: 'Scan lines rather than boxes: for each digit, if its marks on a line all fall in the same block of three, you have one. It pairs with the pointing pair — after any placement, check both directions around the squares you changed.',
  },
  {
    id: 'nakedPair',
    group: 'Subsets',
    tagline: 'Two squares, two digits, shared between them.',
    idea: 'Two squares in the same house show exactly the same two candidates and nothing else. Between them they will use up both digits, one each, in an order you do not yet know.',
    why: 'Suppose one of the two digits were placed elsewhere in the house. Both of these squares would then be forced onto the one remaining digit — and two squares in a house cannot hold the same digit. The assumption breaks. So both digits are locked inside the pair, and neither is available to any other square in that house.',
    spot: 'Look for two squares in the same row, column or box marked with an identical pair. If the pair happens to lie in a box and a line at once, the eliminations run in both houses — always check for the second one.',
  },
  {
    id: 'hiddenPair',
    group: 'Subsets',
    tagline: 'Two digits with only two homes.',
    idea: 'Two digits between them can only go in the same two squares of a house — though those squares may be showing plenty of other candidates.',
    why: 'The house needs both digits, and only two squares can take either of them. Two digits into two squares means one each, so nothing else fits in those squares. Every other candidate in the pair can be erased — which usually reveals it as a plain naked pair you can then use again.',
    spot: 'Instead of reading squares, count homes: for each digit, list which squares in the house could take it. Two digits with the same two-square list is a hidden pair. It is the harder of the two to see, because you are looking for something that is not written down.',
  },
  {
    id: 'nakedTriple',
    group: 'Subsets',
    tagline: 'Three squares sharing three digits.',
    idea: 'Three squares in a house that, between them, use only three different candidates. Each square needs only two of the three — what matters is the union, not the length of any one list.',
    why: 'Three squares needing three digits and drawing from nowhere else must take one each. Any other square in the house that hoped to use one of those digits is out of luck: all three are committed.',
    spot: 'This is the one people miss, because a triple rarely looks like {3,7,9} written out three times. Far more often it is {3,7}, {7,9}, {3,9} — three squares, six marks, three distinct digits. Take any three candidate squares in a house and union their marks; if the total is three digits, you have it.',
  },
  {
    id: 'hiddenTriple',
    group: 'Subsets',
    tagline: 'Three digits with only three homes.',
    idea: 'Three digits confined between them to the same three squares of a house. The squares may be cluttered with other candidates — that clutter is exactly what the technique removes.',
    why: 'The house must fit all three digits into those three squares, which takes every space they have. No other digit can share them. Note that each digit need only appear in two of the three squares for this to hold; what matters is that none of them appears anywhere else in the house.',
    spot: 'List the homes for each digit in the house, then look for three digits whose combined homes number just three squares. Worth hunting for in a house that looks hopelessly cluttered — a hidden triple can clear half a dozen marks at once.',
  },
  {
    id: 'nakedQuad',
    group: 'Subsets',
    tagline: 'Four squares sharing four digits.',
    idea: 'The same argument as the pair and the triple, one size larger: four squares in a house whose candidates come to only four distinct digits.',
    why: 'Four squares, four digits, nowhere else to draw from — one each. Every one of those digits is unavailable to the rest of the house.',
    spot: 'Rare, and rarely necessary — in a house with five empty squares, a naked quad is the same thing as a naked single in the fifth, which is far easier to see. The useful sighting is in a house with six or seven empties. If you are counting to four, first check whether the complement is a smaller hidden subset.',
  },
  {
    id: 'xWing',
    group: 'Fish and wings',
    tagline: 'A digit boxed into a rectangle.',
    idea: 'Take one digit and one digit only. Find two rows in which it has exactly two possible squares, and where those squares stand in the same two columns. The four corners make a rectangle.',
    why: 'Each of the two rows has to place the digit, and each has only its two corners to choose from. Suppose the first row takes its left corner; the column it sits in is then finished with that digit, so the second row is forced to its right corner — and vice versa. Both arrangements put one digit in each column. Whichever way it falls, both columns have their digit inside the rectangle, so the digit can be erased from every other square in those two columns.',
    spot: 'Work one digit at a time. Write down which columns it can occupy in each row, ignoring any row with more than two options, then look for two rows with the same pair. Then run the whole search again with rows and columns swapped — an X-Wing found on columns eliminates along rows.',
  },
  {
    id: 'xyWing',
    group: 'Fish and wings',
    tagline: 'A pivot that forces one of two wings.',
    idea: 'Three squares, each with exactly two candidates: a pivot marked XY, and two wings marked XZ and YZ that the pivot can see. The wings do not need to see each other — only the pivot.',
    why: 'The pivot is X or Y; there is no third possibility. If it is X, the XZ wing cannot also be X, so it must be Z. If it is Y, the YZ wing is pushed onto Z instead. Either branch ends with one of the wings holding Z. So any square that both wings can see is barred from Z — whichever wing turns out to be Z would be sharing a house with it.',
    spot: 'Hunt among two-candidate squares, which are worth marking as you go. From each one, look at its bivalue peers for two that each share a different digit with it and both carry the same third digit. Then look for the overlap: the squares both wings can see, which is where the eliminations happen.',
  },
  {
    id: 'swordfish',
    group: 'Fish and wings',
    tagline: 'An X-Wing one size larger.',
    idea: 'One digit, three rows, and between them the digit appears only in the same three columns. A row need not use all three columns — two is plenty — as long as no row strays outside the set.',
    why: 'Each of the three rows must place the digit, and all three are drawing from the same three columns. Three digits into three columns is one per column, so those columns are full. The digit can therefore be struck from every square in those three columns that is not part of the pattern. The gaps in the rows do not weaken it: fewer options only make the rows more constrained, not less.',
    spot: 'This one demands accurate notes; a single missing candidate turns a swordfish into a wrong answer. Take a digit, write out its candidate columns row by row, discard any row with four or more, and look for three rows whose columns fit inside a set of three. Then repeat with rows and columns swapped.',
  },
].map((lesson) => ({
  ...lesson,
  label: TECHNIQUES[lesson.id].label,
  tier: TECHNIQUES[lesson.id].tier,
  puzzles: LESSON_PUZZLES[lesson.id] || [],
}))

export const lessonById = (id) => LESSONS.find((l) => l.id === id) || LESSONS[0]

/** Lessons grouped for the sidebar, in ladder order. */
export const LESSON_GROUPS = LESSONS.reduce((groups, lesson) => {
  const last = groups[groups.length - 1]
  if (last && last.name === lesson.group) last.lessons.push(lesson)
  else groups.push({ name: lesson.group, lessons: [lesson] })
  return groups
}, [])

// Techniques about a single digit are taught with only that digit's marks on the
// board. Nine candidates per square would bury the pattern they depend on.
const ONE_DIGIT = new Set(['hiddenSingle', 'pointingPair', 'claiming', 'xWing', 'swordfish'])

/**
 * Turn a lesson (plus which of its examples) into everything the board and the
 * walkthrough need. Returns null only if the example fails to reproduce, which
 * the tests make sure never happens.
 */
export function buildExample(lesson, exampleIndex = 0) {
  if (!lesson.puzzles.length) return null
  const source = lesson.puzzles[exampleIndex % lesson.puzzles.length]
  const givens = fromString81(source)
  const found = findPosition(givens, lesson.id)
  if (!found) return null

  const { grid, cand, step } = found
  const eliminations = step.eliminations || []
  const candCount = grid.map((v, i) => (v ? 0 : digitsOf(cand[i]).length))

  const view = {
    lesson,
    step,
    givens,
    grid,
    cand,
    candCount,
    pattern: step.cells,
    digits: step.digits || [],
    stage: stageCells(step, grid),
    eliminations,
    placement: step.placement || null,
    oneDigit: ONE_DIGIT.has(lesson.id),
    // With one mark left in the house, drawing it at step one would answer the
    // question the step is asking. Hold it back until the reasoning is given.
    holdMarks: lesson.id === 'hiddenSingle',
    example: exampleIndex % lesson.puzzles.length,
    examples: lesson.puzzles.length,
  }

  view.steps = WALKTHROUGH[lesson.id](view).map((body, i) => ({
    heading: HEADINGS[i],
    body,
    // The board catches up with the words: pattern at step two, payoff at three.
    showPattern: i >= 1,
    showResult: i >= 2,
  }))

  return view
}
