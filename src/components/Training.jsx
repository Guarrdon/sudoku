import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TrainingBoard from './TrainingBoard.jsx'
import { LESSONS, LESSON_GROUPS, buildExample, lessonById } from '../lib/training.js'

// Which puzzles you first need each technique on. Taken from the difficulty
// bands the generator actually rates against, so the label is a promise.
const TIER_BAND = ['Easy', 'Medium', 'Hard', 'Expert', 'Master']

/**
 * Training. Pick a strategy, and the board is set to a real position where that
 * strategy is the move - with everything the deduction does not need dimmed out.
 * Three steps walk you from the position, to the pattern, to what it proves.
 */
export default function Training({ onExit }) {
  const [lessonId, setLessonId] = useState(LESSONS[0].id)
  const [example, setExample] = useState(0)
  const [step, setStep] = useState(0)

  const lesson = lessonById(lessonId)
  const view = useMemo(() => buildExample(lesson, example), [lesson, example])
  const steps = view?.steps || []
  const last = step >= steps.length - 1

  const boardRef = useRef(null)

  const pick = useCallback((id) => {
    setLessonId(id)
    setExample(0)
    setStep(0)
    // In one column the list sits above the board, so choosing a lesson would
    // otherwise leave you looking at the list you just finished with.
    if (window.innerWidth <= 900) {
      boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const index = LESSONS.findIndex((l) => l.id === lessonId)
  const next = LESSONS[index + 1]
  const previous = LESSONS[index - 1]

  // Arrows walk the explanation; the board follows along.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setStep((s) => Math.min(s + 1, steps.length - 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setStep((s) => Math.max(0, s - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steps.length])

  return (
    <div className="training">
      <div className="hero training-hero">
        <h2>Training</h2>
        <p>
          Pick a strategy and the board is set to a position where it is the move. Everything the
          deduction does not rest on is dimmed — what is left on screen is the whole argument.
        </p>
      </div>

      <div className="play-area training-area">
        <div className="board-column" ref={boardRef}>
          {view ? (
            <>
              <TrainingBoard view={view} step={step} />

              <div className="walk">
                <div className="walk-head">
                  <span className="walk-step">
                    Step {step + 1} of {steps.length}
                  </span>
                  <span className="walk-title">{steps[step].heading}</span>
                </div>
                <p className="walk-body">{steps[step].body}</p>

                <div className="walk-foot">
                  <div className="walk-dots" aria-hidden="true">
                    {steps.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`wdot${i <= step ? ' on' : ''}`}
                        onClick={() => setStep(i)}
                        tabIndex={-1}
                      />
                    ))}
                  </div>
                  <div className="walk-actions">
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      disabled={step === 0}
                    >
                      Back
                    </button>
                    {last ? (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          setExample((e) => e + 1)
                          setStep(0)
                        }}
                        disabled={view.examples < 2}
                        title={
                          view.examples < 2
                            ? 'Only one example of this one'
                            : 'A different board, same strategy'
                        }
                      >
                        Another example
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn small primary"
                        onClick={() => setStep((s) => s + 1)}
                      >
                        {step === 0 ? 'Show the pattern' : 'What it proves'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="essay">
                <h3>{lesson.label}</h3>
                <p className="essay-lead">{lesson.tagline}</p>

                <h4>What it is</h4>
                <p>{lesson.idea}</p>

                <h4>Why it holds</h4>
                <p>{lesson.why}</p>

                <h4>Finding it yourself</h4>
                <p>{lesson.spot}</p>

                <div className="essay-nav">
                  {previous ? (
                    <button type="button" className="btn small ghost" onClick={() => pick(previous.id)}>
                      ← {previous.label}
                    </button>
                  ) : (
                    <span />
                  )}
                  {next && (
                    <button type="button" className="btn small" onClick={() => pick(next.id)}>
                      Next: {next.label} →
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="panel">
              <p className="sub" style={{ margin: 0 }}>
                No example is available for this strategy. That should not happen — please report it.
              </p>
            </div>
          )}
        </div>

        <div className="side">
          <div className="panel panel-strategies">
            <h3>Strategies</h3>
            {LESSON_GROUPS.map((group) => (
              <div key={group.name} className="lesson-group">
                <div className="lesson-group-name">{group.name}</div>
                {group.lessons.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`lesson${l.id === lessonId ? ' active' : ''}`}
                    onClick={() => pick(l.id)}
                    aria-current={l.id === lessonId}
                  >
                    <span className="l-body">
                      <span className="l-name">{l.label}</span>
                      <span className="l-blurb">{l.tagline}</span>
                    </span>
                    <span
                      className={`l-tier t-${l.tier}`}
                      title={`First needed on ${TIER_BAND[l.tier]} puzzles`}
                    >
                      {TIER_BAND[l.tier]}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            <p className="mode-hint" style={{ marginTop: 12 }}>
              They are in the order worth learning them in — each one leans on the ones above it.
            </p>
          </div>

          {/* Narrow screens leave by the ⋯ menu, as they do everywhere else. */}
          <button type="button" className="btn only-wide" onClick={onExit}>
            Back to the game
          </button>
        </div>
      </div>
    </div>
  )
}
