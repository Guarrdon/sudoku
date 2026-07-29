import { difficultyById } from '../lib/generator.js'
import { boxOf } from '../lib/grid.js'

/** Read-only thumbnail so you can see the board before committing to it. */
function Mini({ puzzle }) {
  return (
    <div className="mini" aria-hidden="true">
      {puzzle.map((v, i) => (
        <span key={i} className={boxOf(i) % 2 === 1 ? 'b' : ''}>
          {v || ''}
        </span>
      ))}
    </div>
  )
}

export default function Preview({ result, generating, attempt, difficultyId, onStart, onRegenerate, onBack }) {
  const band = difficultyById(difficultyId)

  if (generating || !result) {
    return (
      <div className="screen preview">
        <div className="hero">
          <h2>Building a {band.label} board</h2>
          <p>{band.blurb}</p>
        </div>
        <div className="generating">
          <div className="spinner" />
          <div className="what">Generating and rating candidates…</div>
          <div className="attempts">
            {attempt > 0 ? `${attempt} boards measured and rejected` : 'Starting…'}
          </div>
        </div>
        <div className="preview-actions">
          <button type="button" className="btn ghost" onClick={onBack}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen preview">
      <div className="hero">
        <h2>{result.label} board ready</h2>
        <p>
          {result.approximate
            ? 'The closest match found — this one sits just outside the usual band.'
            : 'Rated by solving it the way a person would. The timer starts when you do.'}
        </p>
      </div>

      <Mini puzzle={result.puzzle} />

      <div className="measured">
        <div className="stat">
          <div className="k">Difficulty score</div>
          <div className="v">{result.score}</div>
        </div>
        <div className="stat">
          <div className="k">Given clues</div>
          <div className="v">{result.clues}</div>
        </div>
        <div className="stat">
          <div className="k">Hardest step</div>
          <div className="v sm">{result.hardest}</div>
        </div>
      </div>

      <div className="stat" style={{ textAlign: 'left' }}>
        <div className="k" style={{ marginBottom: 7 }}>
          Techniques this board requires
        </div>
        <div className="tech-list" style={{ justifyContent: 'flex-start' }}>
          {result.techniques.map((t) => (
            <span key={t.name} className={`tech t${t.tier}`}>
              {t.label}
              {t.count > 1 ? ` ×${t.count}` : ''}
            </span>
          ))}
        </div>
      </div>

      <div className="preview-actions" style={{ marginTop: 22 }}>
        <button type="button" className="btn primary" onClick={onStart}>
          Play this board
        </button>
        <button type="button" className="btn" onClick={onRegenerate}>
          Try another
        </button>
        <button type="button" className="btn ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
