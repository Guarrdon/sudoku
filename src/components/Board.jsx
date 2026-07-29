import { memo } from 'react'
import { CELLS, rowOf, colOf, boxOf } from '../lib/grid.js'
import { NOTE_OFF } from '../lib/game.js'

const Cell = memo(function Cell({
  index,
  value,
  given,
  notes,
  selected,
  peer,
  match,
  error,
  flash,
  justPlaced,
  solved,
  onSelect,
}) {
  const r = rowOf(index)
  const c = colOf(index)
  const cls = ['cell']
  if (given) cls.push('given')
  if (c % 3 === 2 && c !== 8) cls.push('bx-r')
  if (r % 3 === 2 && r !== 8) cls.push('bx-b')
  if (selected) cls.push('selected')
  else if (match) cls.push('match')
  else if (peer) cls.push('peer')
  if (error) cls.push('error')
  if (flash) cls.push('flash')
  if (justPlaced) cls.push('just-placed')
  if (solved) cls.push('solved-cell')

  const hasNotes = !value && notes.some((n) => n !== NOTE_OFF)

  return (
    <button
      type="button"
      className={cls.join(' ')}
      onClick={() => onSelect(index)}
      tabIndex={-1}
      aria-label={`Row ${r + 1} column ${c + 1}${value ? `, ${value}${given ? ' given' : ''}` : ', empty'}`}
      style={solved ? { animationDelay: `${(r + c) * 26}ms` } : undefined}
    >
      {value ? (
        <span className="val">{value}</span>
      ) : hasNotes ? (
        <span className="notes">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <span key={d} className={`note n-${notes[d]}`}>
              {notes[d] === NOTE_OFF ? '' : d}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  )
})

function Board({ game, prefs, paused, justPlaced, onSelect, onResume }) {
  const { values, givens, notes, selected, errors, flash } = game
  const selValue = selected != null ? values[selected] : 0
  const selRow = selected != null ? rowOf(selected) : -1
  const selCol = selected != null ? colOf(selected) : -1
  const selBox = selected != null ? boxOf(selected) : -1
  const errorSet = errors
  const flashCells = flash?.cells || []

  return (
    <div className="board-wrap">
      <div className="board">
        <div className="grid" role="grid" aria-label="Sudoku board">
          {Array.from({ length: CELLS }, (_, i) => (
            <Cell
              // Remounting a flashing cell restarts the pulse, so two clashes in
              // a row on the same cell both register.
              key={flashCells.includes(i) ? `${i}-f${flash.token}` : i}
              index={i}
              value={values[i]}
              given={givens[i] !== 0}
              notes={notes[i]}
              selected={selected === i}
              peer={
                prefs.highlightPeers &&
                selected !== i &&
                (rowOf(i) === selRow || colOf(i) === selCol || boxOf(i) === selBox)
              }
              match={
                prefs.highlightMatches && selValue !== 0 && values[i] === selValue && selected !== i
              }
              error={errorSet.includes(i)}
              flash={flashCells.includes(i)}
              justPlaced={justPlaced === i}
              solved={!!game.solvedAt}
              onSelect={onSelect}
            />
          ))}
        </div>

        {paused && (
          <div className="paused-veil">
            <span className="word">Paused</span>
            <button type="button" className="btn primary" onClick={onResume}>
              Resume
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(Board)
