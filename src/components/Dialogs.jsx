import { Fragment, useEffect, useState } from 'react'
import { DIFFICULTIES } from '../lib/generator.js'
import { formatTime } from '../lib/storage.js'

function Overlay({ children, onClose, labelledBy }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- stats

export function StatsDialog({ stats, prefs, onChange, onClose, onReset }) {
  const [confirming, setConfirming] = useState(false)
  const winRate = stats.totalStarted ? Math.round((stats.totalCompleted / stats.totalStarted) * 100) : 0

  if (confirming) {
    return (
      <ConfirmDialog
        title="Erase all statistics?"
        body="Every solve, best time and streak on this browser will be cleared. This cannot be undone."
        confirmLabel="Erase everything"
        onConfirm={() => {
          onReset()
          setConfirming(false)
        }}
        onClose={() => setConfirming(false)}
      />
    )
  }

  return (
    <Overlay onClose={onClose} labelledBy="stats-title">
      <h2 id="stats-title">Statistics</h2>
      <p className="sub">Kept in this browser only.</p>

      <div className="summary">
        <div className="stat">
          <div className="k">Solved</div>
          <div className="v">{stats.totalCompleted}</div>
        </div>
        <div className="stat">
          <div className="k">Finish rate</div>
          <div className="v">{winRate}%</div>
        </div>
        <div className="stat">
          <div className="k">Time played</div>
          <div className="v sm">{formatTime(stats.totalTime)}</div>
        </div>
      </div>

      <table className="stats-grid">
        <thead>
          <tr>
            <th>Difficulty</th>
            <th>Solved</th>
            <th>Best</th>
            <th>Average</th>
            <th>Streak</th>
          </tr>
        </thead>
        <tbody>
          {DIFFICULTIES.map((d) => {
            const b = stats.bands[d.id]
            const avg = b.completed ? b.totalTime / b.completed : null
            return (
              <tr key={d.id} className={b.completed ? '' : 'empty'}>
                <td>{d.label}</td>
                <td>
                  {b.completed}
                  {b.started > b.completed ? ` / ${b.started}` : ''}
                </td>
                <td>{b.bestTime != null ? formatTime(b.bestTime) : '—'}</td>
                <td>{avg != null ? formatTime(avg) : '—'}</td>
                <td>
                  {b.bestStreak ? `${b.currentStreak} (best ${b.bestStreak})` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="footer-note" style={{ textAlign: 'left', marginTop: 14 }}>
        A streak counts consecutive puzzles finished with no wrong square ever placed. Checking the
        board is free; being wrong is what breaks it.
      </p>

      <div className="toggle-row" style={{ marginTop: 12, borderTop: '1px solid var(--rule)' }}>
        <div>
          <div className="t-label">Record statistics</div>
          <div className="t-desc">
            Off means nothing you play is counted — handy while poking around. Your existing
            statistics stay put.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.recordStats}
          aria-label="Record statistics"
          className={`switch${prefs.recordStats ? ' on' : ''}`}
          onClick={() => onChange({ ...prefs, recordStats: !prefs.recordStats })}
        />
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn ghost" onClick={() => setConfirming(true)}>
          Reset statistics
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Overlay>
  )
}

// -------------------------------------------------------------------- help

const KEYS = [
  [['1', '–', '9'], 'Place a number as the answer'],
  [['1', '–', '9'], 'Same digit again: answer → green note → red note → empty'],
  [['Shift', '+', '1–9'], 'Go straight to a note without leaving Number mode'],
  [['V'], 'Number mode'],
  [['N'], 'Note mode — grey → green → red → off'],
  [['G'], 'Green mode — toggle a "could be" note'],
  [['R'], 'Red mode — toggle a "ruled out" note'],
  [['Space'], 'Cycle through the four modes'],
  [['←', '↑', '↓', '→'], 'Move around the board'],
  [['Backspace'], 'Lift the number; press again to clear the notes under it'],
  [['C'], 'Check for wrong squares'],
  [['Ctrl', '+', 'Z'], 'Undo'],
  [['Ctrl', '+', 'Y'], 'Redo'],
  [['P'], 'Pause'],
  [['?'], 'This help'],
]

export function HelpDialog({ onClose }) {
  return (
    <Overlay onClose={onClose} labelledBy="help-title">
      <h2 id="help-title">How to play</h2>
      <p className="sub">
        Click a square, then a number — or just type. Notes come in three colours: grey for
        undecided, green for “this could be it”, red for “ruled out”. A number only ever hides
        the notes beneath it — they come straight back when you lift it.
      </p>

      <div className="keymap">
        {KEYS.map(([keys, what], i) => (
          <Fragment key={i}>
            <div className="keys">
              {keys.map((k, j) =>
                k === '+' || k === '–' ? <span key={j}>{k}</span> : <kbd key={j}>{k}</kbd>
              )}
            </div>
            <div className="what">{what}</div>
          </Fragment>
        ))}
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Overlay>
  )
}

// ---------------------------------------------------------------- settings

const TOGGLES = [
  ['recordStats', 'Record statistics', 'Turn this off to play without adding anything to your record — no games counted, no times, no streaks. Existing statistics are kept.'],
  ['autoClearNotes', 'Tidy notes automatically', 'Placing a number removes that grey note from the row, column and box. Green and red notes are left alone.'],
  ['highlightPeers', 'Highlight row, column and box', 'Shades everything the selected square can see.'],
  ['highlightMatches', 'Highlight matching numbers', 'Every square holding the same number as the selection.'],
  ['flashConflicts', 'Flash conflicts', 'A brief red pulse when a placement clashes with a number already on the board.'],
  ['showTimer', 'Show the timer', 'The clock keeps running either way — it is just hidden.'],
]

export function SettingsDialog({ prefs, onChange, onClose }) {
  return (
    <Overlay onClose={onClose} labelledBy="settings-title">
      <h2 id="settings-title">Settings</h2>
      <p className="sub">Saved for next time.</p>

      {TOGGLES.map(([key, label, desc]) => (
        <div className="toggle-row" key={key}>
          <div>
            <div className="t-label">{label}</div>
            <div className="t-desc">{desc}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[key]}
            aria-label={label}
            className={`switch${prefs[key] ? ' on' : ''}`}
            onClick={() => onChange({ ...prefs, [key]: !prefs[key] })}
          />
        </div>
      ))}

      <div className="dialog-actions">
        <button type="button" className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Overlay>
  )
}

// --------------------------------------------------------------------- win

export function WinDialog({ game, seconds, stats, onNewGame, onClose }) {
  const band = stats.bands[game.meta.difficulty]
  const clean = game.mistakesFound === 0
  const isBest = band.bestTime != null && seconds <= band.bestTime

  return (
    <Overlay onClose={onClose} labelledBy="win-title">
      <div className="win">
        <h2 id="win-title" style={{ textAlign: 'center' }}>
          Solved
        </h2>
        <div className="big-time">{formatTime(seconds)}</div>
        <span className="badge">
          {isBest && band.completed > 1
            ? '★ New best time'
            : clean
              ? '✓ Clean solve — no mistakes'
              : `${game.meta.label} complete`}
        </span>

        <div className="summary">
          <div className="stat">
            <div className="k">Difficulty</div>
            <div className="v sm">{game.meta.label}</div>
          </div>
          <div className="stat">
            <div className="k">Score</div>
            <div className="v">{game.meta.score}</div>
          </div>
          <div className="stat">
            <div className="k">Checks used</div>
            <div className="v">{game.checksUsed}</div>
          </div>
        </div>

        <p className="footer-note" style={{ textAlign: 'center' }}>
          {clean
            ? `Clean streak on ${game.meta.label}: ${band.currentStreak}.`
            : `${game.mistakesFound} wrong ${game.mistakesFound === 1 ? 'square' : 'squares'} found along the way.`}{' '}
          Best {game.meta.label}: {formatTime(band.bestTime)}.
        </p>

        <div className="dialog-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            Admire the board
          </button>
          <button type="button" className="btn primary" onClick={onNewGame}>
            New puzzle
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ------------------------------------------------------------------ confirm

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose }) {
  return (
    <Overlay onClose={onClose} labelledBy="confirm-title">
      <h2 id="confirm-title">{title}</h2>
      <p className="sub">{body}</p>
      <div className="dialog-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  )
}
