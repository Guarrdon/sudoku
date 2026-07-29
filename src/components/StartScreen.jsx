import { DIFFICULTIES } from '../lib/generator.js'
import { formatTime } from '../lib/storage.js'

export default function StartScreen({ stats, save, onPick, onResume, onDiscard }) {
  return (
    <div className="screen">
      <div className="hero">
        <h2>Choose your puzzle</h2>
        <p>
          Every board is generated fresh and rated by solving it, so you can see what you are
          taking on before the clock starts.
        </p>
      </div>

      {save && (
        <div className="diff-list" style={{ marginBottom: 18 }}>
          <button type="button" className="diff resume" onClick={onResume}>
            <div className="rank" style={{ width: 28, fontSize: 22, justifyContent: 'center' }}>
              ⏵
            </div>
            <div className="body">
              <div className="name">Resume {save.meta.label}</div>
              <div className="blurb">
                {formatTime(save.elapsed)} elapsed · {save.filled} of {81 - save.meta.clues} squares
                filled
              </div>
            </div>
            <div className="go">→</div>
          </button>
          <button type="button" className="btn ghost small" onClick={onDiscard} style={{ justifySelf: 'center' }}>
            Discard saved game
          </button>
        </div>
      )}

      <div className="diff-list">
        {DIFFICULTIES.map((d, i) => {
          const band = stats.bands[d.id]
          return (
            <button key={d.id} type="button" className="diff" onClick={() => onPick(d.id)}>
              <div className="rank" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((p) => (
                  <span key={p} className={`pip${p <= i ? ' on' : ''}`} />
                ))}
              </div>
              <div className="body">
                <div className="name">{d.label}</div>
                <div className="blurb">{d.blurb}</div>
                {band.completed > 0 && (
                  <div className="best">
                    Best {formatTime(band.bestTime)} · {band.completed} solved
                    {band.currentStreak > 1 ? ` · ${band.currentStreak} clean in a row` : ''}
                  </div>
                )}
              </div>
              <div className="go" aria-hidden="true">
                →
              </div>
            </button>
          )
        })}
      </div>

      <p className="footer-note">
        Everything is stored in this browser. The game makes no network requests.
      </p>
    </div>
  )
}
