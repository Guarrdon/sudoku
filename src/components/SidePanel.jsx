import { memo } from 'react'
import { MODES, remainingCounts } from '../lib/game.js'

const SWATCH = { yes: 'var(--yes)', no: 'var(--no)' }

export function ModeSwitch({ mode, onMode }) {
  const active = MODES.find((m) => m.id === mode)
  return (
    <div className="panel">
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

export function Keypad({ game, mode, disabled, onDigit, onErase, onCheck, onUndo, onRedo }) {
  const left = remainingCounts(game)
  return (
    <div className="panel">
      <h3>Numbers</h3>
      <div className={`pad m-${mode}`}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            type="button"
            className={`key${mode === 'value' && left[d] <= 0 ? ' done' : ''}`}
            onClick={() => onDigit(d)}
            disabled={disabled}
            aria-label={`${d}${mode === 'value' ? `, ${left[d]} remaining` : ''}`}
          >
            {d}
            {mode === 'value' && left[d] > 0 && <span className="left">{left[d]}</span>}
          </button>
        ))}
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={onUndo} disabled={disabled || !game.past.length}>
          ↶ Undo
        </button>
        <button
          type="button"
          className="btn"
          onClick={onRedo}
          disabled={disabled || !game.future.length}
        >
          ↷ Redo
        </button>
        <button type="button" className="btn" onClick={onErase} disabled={disabled}>
          ⌫ Erase
        </button>
        <button type="button" className="btn" onClick={onCheck} disabled={disabled}>
          ✓ Check
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
