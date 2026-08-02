import { memo } from 'react'
import { CELLS, colOf, rowOf } from '../lib/grid.js'
import { digitsOf } from '../lib/solver.js'

/**
 * The teaching board. Read-only, and deliberately most of it is turned down:
 * squares the deduction does not depend on are dimmed to near-paper, so what is
 * left on screen is exactly the argument being made.
 *
 * It reveals in three beats alongside the words - position, pattern, deduction.
 */
function TrainingBoard({ view, step }) {
  const { grid, cand, givens, stage, pattern, digits, eliminations, placement, oneDigit } = view
  const showPattern = step >= 1
  const showResult = step >= 2
  const showMarks = showPattern || !view.holdMarks

  const patternSet = new Set(pattern)
  const hot = new Set(digits)
  const cutAt = new Map() // cell -> digits this move rules out
  for (const e of eliminations) {
    if (!cutAt.has(e.index)) cutAt.set(e.index, new Set())
    cutAt.get(e.index).add(e.digit)
  }

  return (
    <div className="board-wrap">
      <div className="board">
        <div className="grid tgrid" role="img" aria-label={boardSummary(view, step)}>
          {Array.from({ length: CELLS }, (_, i) => {
            const r = rowOf(i)
            const c = colOf(i)
            const lit = stage.has(i)
            const cuts = showResult ? cutAt.get(i) : null
            const solves = showResult && placement && placement.index === i

            const cls = ['cell', 'tcell']
            if (c % 3 === 2 && c !== 8) cls.push('bx-r')
            if (r % 3 === 2 && r !== 8) cls.push('bx-b')
            if (!lit) cls.push('dim')
            if (givens[i]) cls.push('given')
            if (lit && showPattern && patternSet.has(i)) cls.push('pat')
            // An XY-Wing turns on knowing which square is the pivot, so say so.
            if (showPattern && view.step.pivot === i) cls.push('pivot')
            if (cuts) cls.push('cut')
            if (solves) cls.push('place')

            const value = grid[i]
            const marks = value || !lit || !showMarks ? [] : digitsOf(cand[i])

            return (
              <div key={i} className={cls.join(' ')}>
                {value ? (
                  <span className="val">{value}</span>
                ) : solves ? (
                  <span className="val solved-in">{placement.digit}</span>
                ) : oneDigit ? (
                  // One digit under discussion: show only its marks, centred, so
                  // the shape they make on the board is the thing you see.
                  marks.includes(digits[0]) && (
                    <span
                      className={`solo${showPattern && patternSet.has(i) ? ' hot' : ''}${
                        cuts ? ' gone' : ''
                      }`}
                    >
                      {digits[0]}
                    </span>
                  )
                ) : (
                  <span className="notes">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                      // A mark that isn't there cannot be highlighted or struck:
                      // an empty slot wearing the pattern colour is a phantom.
                      const on = marks.includes(d)
                      const isHot = on && showPattern && patternSet.has(i) && hot.has(d)
                      const isGone = on && cuts?.has(d)
                      return (
                        <span
                          key={d}
                          className={`tnote${isHot ? ' hot' : ''}${isGone ? ' gone' : ''}`}
                        >
                          {on ? d : ''}
                        </span>
                      )
                    })}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** The board is a picture; this is what it would say out loud. */
function boardSummary(view, step) {
  const where = view.pattern.map((i) => `row ${rowOf(i) + 1} column ${colOf(i) + 1}`).join(', ')
  const stage = `${view.stage.size} squares of the board are in play; the rest are dimmed.`
  if (step === 0) return `${view.lesson.label} example. ${stage}`
  return `${view.lesson.label} example. ${stage} The pattern is at ${where}.`
}

export default memo(TrainingBoard)
