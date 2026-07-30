import { memo } from 'react'
import { MODES, hasAnyNotes, hasUserAnswers, remainingCounts } from '../lib/game.js'

const SWATCH = { yes: 'var(--yes)', no: 'var(--no)' }

export function ModeSwitch({ mode, onMode }) {
  const active = MODES.find((m) => m.id === mode)
  return (
    <div className="panel panel-mode">
      <h3>Mode</h3>
      <div className="modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mode m-${m.id}${mode === m.id ? ' active' : ''}`}
            onClick={() => onMode(m.id)}
            aria-pressed={mode === m.id}
          >
            <span className="m-label">
              {SWATCH[m.id] && <span className="swatch" style={{ background: SWATCH[m.id] }} />}
              {m.label}
            </span>
            <span className="m-key">{m.key}</span>
          </button>
        ))}
      </div>
      <p className="mode-hint">{active?.hint}</p>
    </div>
  )
}

export function Keypad({
  game,
  mode,
  disabled,
  armed,
  inputOrder,
  onDigit,
  onErase,
  onCheck,
  onUndo,
  onRedo,
  onReset,
  onHint,
  onToggleOrder,
}) {
  const left = remainingCounts(game)
  const numberFirst = inputOrder === 'digit'
  const nothingToClear = !hasUserAnswers(game) && !hasAnyNotes(game)

  return (
    <div className="panel panel-pad">
      <div className="pad-head">
        <h3>Numbers</h3>
        <button
          type="button"
          className="order-toggle"
          onClick={onToggleOrder}
          title={
            numberFirst
              ? 'Now: pick a number, then tap squares. Tap to switch.'
              : 'Now: pick a square, then a number. Tap to switch.'
          }
        >
          <span className="swap" aria-hidden="true">
            ⇄
          </span>
          {numberFirst ? 'Number first' : 'Square first'}
        </button>
      </div>

      <div className={`pad m-${mode}${numberFirst ? ' number-first' : ''}`}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            type="button"
            className={`key${mode === 'value' && left[d] <= 0 ? ' done' : ''}${armed === d ? ' armed' : ''}`}
            onClick={() => onDigit(d)}
            disabled={disabled}
            aria-pressed={numberFirst ? armed === d : undefined}
            aria-label={`${d}${mode === 'value' ? `, ${left[d]} remaining` : ''}`}
          >
            {d}
            {mode === 'value' && left[d] > 0 && <span className="left">{left[d]}</span>}
          </button>
        ))}
        <button
          type="button"
          className="key key-erase"
          onClick={onErase}
          disabled={disabled}
          aria-label="Erase this square"
        >
          ⌫
        </button>
      </div>

      {numberFirst && (
        <p className="pad-hint">
          {armed
            ? `Tap squares to work with ${armed} — tap ${armed} again to put it down.`
            : 'Pick a number, then tap squares.'}
        </p>
      )}

      <div className="actions">
        <button type="button" className="btn act" onClick={onUndo} disabled={disabled || !game.past.length}>
          <span className="ico" aria-hidden="true">↶</span>
          <span className="cap">Undo</span>
        </button>
        <button type="button" className="btn act" onClick={onRedo} disabled={disabled || !game.future.length}>
          <span className="ico" aria-hidden="true">↷</span>
          <span className="cap">Redo</span>
        </button>
        <button type="button" className="btn act" onClick={onCheck} disabled={disabled}>
          <span className="ico" aria-hidden="true">✓</span>
          <span className="cap">Check</span>
        </button>
        <button type="button" className="btn act hint-btn" onClick={onHint} disabled={disabled}>
          <span className="ico" aria-hidden="true">?</span>
          <span className="cap">Hint</span>
        </button>
        <button type="button" className="btn act" onClick={onReset} disabled={disabled || nothingToClear}>
          <span className="ico" aria-hidden="true">↺</span>
          <span className="cap">Start over</span>
        </button>
      </div>
    </div>
  )
}

export default memo(function SidePanel(props) {
  return (
    <div className="side">
      <ModeSwitch mode={props.mode} onMode={props.onMode} />
      <Keypad {...props} />
    </div>
  )
})
