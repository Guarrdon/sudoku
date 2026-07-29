// Game state + reducer. Kept free of React so it can be reasoned about (and
// tested) on its own.

import { CELLS, PEERS, rowOf, colOf, idx, conflictsAt } from './grid.js'

/** Note states. A note cycles off -> maybe -> yes -> no -> off in Note mode. */
export const NOTE_OFF = 0
export const NOTE_PLAIN = 1 // grey: still on the table
export const NOTE_YES = 2 // green: this could be it
export const NOTE_NO = 3 // red: ruled out
export const NOTE_CYCLE = [NOTE_PLAIN, NOTE_YES, NOTE_NO, NOTE_OFF]

export const MODES = [
  {
    id: 'value',
    label: 'Number',
    key: 'V',
    hint: 'Same digit again cycles: answer → green → red → off',
  },
  { id: 'note', label: 'Note', key: 'N', hint: 'Digit cycles grey → green → red → off' },
  { id: 'yes', label: 'Green', key: 'G', hint: 'Digit toggles a green "could be" note' },
  { id: 'no', label: 'Red', key: 'R', hint: 'Digit toggles a red "ruled out" note' },
]

const emptyNotes = () => Array.from({ length: CELLS }, () => new Array(10).fill(NOTE_OFF))

export function createGame(puzzleData) {
  return {
    givens: puzzleData.puzzle.slice(),
    solution: puzzleData.solution.slice(),
    meta: {
      difficulty: puzzleData.difficulty,
      label: puzzleData.label,
      score: puzzleData.score,
      clues: puzzleData.clues,
      hardest: puzzleData.hardest,
      techniques: puzzleData.techniques,
      approximate: puzzleData.approximate,
    },
    values: puzzleData.puzzle.slice(),
    notes: emptyNotes(),
    selected: puzzleData.puzzle.findIndex((v) => !v),
    mode: 'value',
    errors: [], // indices flagged wrong by the last Check
    flash: null, // { cells: [...], token } - brief red conflict pulse
    past: [],
    future: [],
    checksUsed: 0,
    mistakesFound: 0,
    solvedAt: null,
  }
}

const isGiven = (state, i) => state.givens[i] !== 0

/** Snapshot only the mutable board bits; selection and mode are not undoable. */
const snapshot = (state) => ({ values: state.values, notes: state.notes, errors: state.errors })

function pushHistory(state) {
  const past = [...state.past, snapshot(state)]
  if (past.length > 250) past.shift()
  return { past, future: [] }
}

const withNoteAt = (notes, i, digit, value) => {
  const next = notes.slice()
  const cell = next[i].slice()
  cell[digit] = value
  next[i] = cell
  return next
}

/** Placing a digit clears the same plain note from peers - but never a
 *  deliberate green/red mark, which the player set on purpose. */
function clearPeerNotes(notes, index, digit) {
  let next = null
  for (const p of PEERS[index]) {
    if (notes[p][digit] === NOTE_PLAIN) {
      next = next || notes.slice()
      const cell = next[p].slice()
      cell[digit] = NOTE_OFF
      next[p] = cell
    }
  }
  return next || notes
}

/** Step of the answer->note cycle: drop the big number, leave one coloured note. */
function setSoleNote(state, index, digit, noteState) {
  const history = pushHistory(state)
  const values = state.values.slice()
  values[index] = 0
  return {
    ...state,
    ...history,
    values,
    notes: withNoteAt(state.notes, index, digit, noteState),
    errors: state.errors.filter((e) => e !== index),
  }
}

/**
 * The main input action. Pressing a digit places it as the answer; pressing the
 * SAME digit again walks it down through the note states, so one key covers the
 * whole thought: "it's a 5" -> "might be a 5" -> "not a 5" -> "never mind".
 *
 *   press 5 -> big 5      press 5 -> green note 5
 *   press 5 -> red note 5 press 5 -> empty
 *
 * A different digit always replaces outright, and Erase still clears in one go.
 */
function placeValue(state, index, digit, prefs) {
  if (isGiven(state, index)) return state

  const current = state.values[index]
  const note = state.notes[index][digit]

  // Continue the cycle rather than placing, when this digit is already showing.
  if (current === digit) return setSoleNote(state, index, digit, NOTE_YES)
  if (current === 0 && note === NOTE_YES) return setSoleNote(state, index, digit, NOTE_NO)
  if (current === 0 && note === NOTE_NO) return toggleNote(state, index, digit, NOTE_NO)

  const history = pushHistory(state)
  const values = state.values.slice()
  const next = digit
  values[index] = next

  // The cell's own notes give way to the big number.
  let notes = state.notes
  if (next && notes[index].some((n) => n !== NOTE_OFF)) {
    notes = notes.slice()
    notes[index] = new Array(10).fill(NOTE_OFF)
  }
  if (next && prefs.autoClearNotes) notes = clearPeerNotes(notes, index, next)

  // A cell that changed is no longer known-wrong.
  const errors = state.errors.filter((e) => e !== index)

  let flash = state.flash
  if (next && prefs.flashConflicts) {
    const clashes = conflictsAt(values, index)
    if (clashes.length) flash = { cells: [index, ...clashes], token: (state.flash?.token || 0) + 1 }
  }

  return { ...state, ...history, values, notes, errors, flash }
}

function toggleNote(state, index, digit, target) {
  if (isGiven(state, index) || state.values[index]) return state
  const history = pushHistory(state)
  const current = state.notes[index][digit]
  const next = current === target ? NOTE_OFF : target
  return { ...state, ...history, notes: withNoteAt(state.notes, index, digit, next) }
}

function cycleNote(state, index, digit) {
  if (isGiven(state, index) || state.values[index]) return state
  const history = pushHistory(state)
  const current = state.notes[index][digit]
  const pos = NOTE_CYCLE.indexOf(current)
  const next = NOTE_CYCLE[(pos + 1) % NOTE_CYCLE.length]
  return { ...state, ...history, notes: withNoteAt(state.notes, index, digit, next) }
}

function erase(state, index) {
  if (isGiven(state, index)) return state
  const hasValue = state.values[index] !== 0
  const hasNotes = state.notes[index].some((n) => n !== NOTE_OFF)
  if (!hasValue && !hasNotes) return state
  const history = pushHistory(state)
  const values = state.values.slice()
  values[index] = 0
  const notes = state.notes.slice()
  notes[index] = new Array(10).fill(NOTE_OFF)
  return { ...state, ...history, values, notes, errors: state.errors.filter((e) => e !== index) }
}

export function isSolved(state) {
  for (let i = 0; i < CELLS; i++) if (state.values[i] !== state.solution[i]) return false
  return true
}

export function remainingCounts(state) {
  const counts = new Array(10).fill(9)
  for (let i = 0; i < CELLS; i++) if (state.values[i]) counts[state.values[i]]--
  return counts
}

export function reducer(state, action) {
  switch (action.type) {
    case 'select':
      return { ...state, selected: action.index }

    case 'move': {
      const cur = state.selected ?? 0
      const r = Math.min(8, Math.max(0, rowOf(cur) + action.dr))
      const c = Math.min(8, Math.max(0, colOf(cur) + action.dc))
      return { ...state, selected: idx(r, c) }
    }

    case 'mode':
      return { ...state, mode: action.mode }

    case 'cycleMode': {
      const i = MODES.findIndex((m) => m.id === state.mode)
      return { ...state, mode: MODES[(i + 1) % MODES.length].id }
    }

    case 'digit': {
      const index = state.selected
      if (index == null || state.solvedAt) return state
      const mode = action.mode || state.mode
      if (mode === 'value') return placeValue(state, index, action.digit, action.prefs)
      if (mode === 'note') return cycleNote(state, index, action.digit)
      if (mode === 'yes') return toggleNote(state, index, action.digit, NOTE_YES)
      if (mode === 'no') return toggleNote(state, index, action.digit, NOTE_NO)
      return state
    }

    case 'erase':
      return state.selected == null || state.solvedAt ? state : erase(state, state.selected)

    case 'check': {
      const errors = []
      for (let i = 0; i < CELLS; i++) {
        if (!state.givens[i] && state.values[i] && state.values[i] !== state.solution[i]) errors.push(i)
      }
      return {
        ...state,
        errors,
        checksUsed: state.checksUsed + 1,
        mistakesFound: state.mistakesFound + errors.length,
      }
    }

    case 'clearErrors':
      return { ...state, errors: [] }

    case 'clearFlash':
      return state.flash?.token === action.token ? { ...state, flash: null } : state

    case 'undo': {
      if (!state.past.length) return state
      const previous = state.past[state.past.length - 1]
      return {
        ...state,
        ...previous,
        past: state.past.slice(0, -1),
        future: [...state.future, snapshot(state)],
      }
    }

    case 'redo': {
      if (!state.future.length) return state
      const next = state.future[state.future.length - 1]
      return {
        ...state,
        ...next,
        past: [...state.past, snapshot(state)],
        future: state.future.slice(0, -1),
      }
    }

    case 'solved':
      return { ...state, solvedAt: action.at, errors: [], flash: null }

    case 'restore':
      return action.state

    default:
      return state
  }
}
