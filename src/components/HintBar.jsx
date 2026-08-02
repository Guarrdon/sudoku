/**
 * Hints reveal themselves in stages, so asking for help doesn't have to mean
 * being handed the answer. Stop at the first line and you've only been told
 * which tactic to hunt for.
 *
 * The same bar carries anything else the board wants to say back — an offer, or
 * a note about what just happened — by passing its own buttons in.
 */
export default function HintBar({ levels, level, onMore, onClose, actionLabel, onAction, closeLabel }) {
  if (!levels?.length) return null
  const step = levels[Math.min(level, levels.length - 1)]
  const last = level >= levels.length - 1
  const nextLabel = level === 0 ? 'Show me where' : 'Tell me the move'

  return (
    <div className={`hint-bar${step.focus ? ' final' : ''}`} role="status" aria-live="polite">
      <div className="hint-body">
        <div className="hint-heading">{step.heading}</div>
        <p>{step.body}</p>
        {levels.length > 1 && (
          <div className="hint-dots" aria-hidden="true">
            {levels.map((_, i) => (
              <span key={i} className={i <= level ? 'on' : ''} />
            ))}
          </div>
        )}
      </div>
      <div className="hint-actions">
        {onAction ? (
          <button type="button" className="btn small primary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : (
          !last && (
            <button type="button" className="btn small primary" onClick={onMore}>
              {nextLabel}
            </button>
          )
        )}
        <button type="button" className="btn small ghost" onClick={onClose}>
          {closeLabel ?? (last ? 'Done' : 'I’ll try')}
        </button>
      </div>
    </div>
  )
}
