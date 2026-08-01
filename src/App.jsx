import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Board from './components/Board.jsx'
import SidePanel from './components/SidePanel.jsx'
import HintBar from './components/HintBar.jsx'
import StartScreen from './components/StartScreen.jsx'
import Preview from './components/Preview.jsx'
import Training from './components/Training.jsx'
import {
  ConfirmDialog,
  HelpDialog,
  MenuDialog,
  ResetDialog,
  SettingsDialog,
  StatsDialog,
  WinDialog,
} from './components/Dialogs.jsx'
import { AUTO_NOTES_PENALTY, createGame, isPristine, isSolved, reducer, MODES } from './lib/game.js'
import { findHint, hintText } from './lib/hint.js'
import { difficultyById } from './lib/generator.js'
import {
  clearSave,
  formatTime,
  loadPrefs,
  loadSave,
  loadStats,
  recordAbandon,
  recordFinish,
  recordStart,
  resetStats,
  resolveInputOrder,
  savePrefs,
  saveStats,
  writeSave,
} from './lib/storage.js'

const MODE_KEYS = { v: 'value', n: 'note', g: 'yes', r: 'no' }

const AUTO_NOTES_NOTICE = {
  heading: 'Notes filled in',
  body: `Every empty square now shows the digits its row, column and box still allow — read off the printed numbers, nothing cleverer. Any square that came out with a single option has been written in. Squares that only became obvious because of those are left standing: they are the easiest points on the board and they are yours. ${AUTO_NOTES_PENALTY} seconds have been added to the clock.`,
}

const AUTO_NOTES_OFFER = {
  heading: 'Before a hint — want the bookkeeping done?',
  body: 'Nothing has been played on this board yet. Rather than one move, I can pencil every square in with the digits its row, column and box still allow, and write in any square that comes out with only one. No scanning and no tactics — just what the printed numbers already say.',
}

export default function App() {
  const [screen, setScreen] = useState('menu') // menu | preview | play | training
  const [cameFrom, setCameFrom] = useState('menu') // where training should hand back to
  const [stats, setStats] = useState(loadStats)
  const [prefs, setPrefs] = useState(loadPrefs)
  const [dialog, setDialog] = useState(null) // stats | help | settings | win | quit
  const [game, dispatch] = useReducer(reducer, null)

  const [gen, setGen] = useState({ status: 'idle', difficulty: null, attempt: 0, result: null })
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [justPlaced, setJustPlaced] = useState(null)
  const [savedGame, setSavedGame] = useState(() => loadSave())
  const [hint, setHint] = useState(null) // { levels, level } | { offer: true }
  const [notice, setNotice] = useState(null) // { heading, body } - said once, then dismissed
  const [armed, setArmed] = useState(null) // number-first: the digit on the brush

  const inputOrder = resolveInputOrder(prefs)

  const workerRef = useRef(null)
  const reqRef = useRef(0)

  // ------------------------------------------------------------- generation
  useEffect(() => {
    const worker = new Worker(new URL('./lib/worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, type, attempt, result } = e.data
      if (id !== reqRef.current) return // a stale request we no longer care about
      if (type === 'progress') setGen((g) => ({ ...g, attempt }))
      else if (type === 'done') setGen((g) => ({ ...g, status: 'ready', result }))
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const requestPuzzle = useCallback((difficulty) => {
    const id = ++reqRef.current
    setGen({ status: 'working', difficulty, attempt: 0, result: null })
    setScreen('preview')
    workerRef.current?.postMessage({ id, difficulty })
  }, [])

  // ---------------------------------------------------------------- timer
  const running = screen === 'play' && !paused && game && !game.solvedAt && !dialog
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [running])

  // Stepping away pauses the clock rather than quietly inflating your time.
  useEffect(() => {
    const onHide = () => document.hidden && screen === 'play' && setPaused(true)
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [screen])

  // ------------------------------------------------------------ start / win
  const startGame = useCallback(() => {
    if (!gen.result) return
    dispatch({ type: 'restore', state: createGame(gen.result) })
    if (prefs.autoNotes) {
      dispatch({ type: 'annotate' })
      setNotice(AUTO_NOTES_NOTICE)
    }
    // The leg-up is paid for up front rather than deducted at the end, so the
    // clock you are watching is always the true cost of the solve.
    setElapsed(prefs.autoNotes ? AUTO_NOTES_PENALTY : 0)
    setPaused(false)
    setArmed(null)
    setScreen('play')
    if (!prefs.recordStats) return
    setStats((s) => {
      const next = recordStart(s, gen.result.difficulty)
      saveStats(next)
      return next
    })
  }, [gen.result, prefs.recordStats, prefs.autoNotes])

  useEffect(() => {
    if (screen !== 'play' || !game || game.solvedAt) return
    if (!isSolved(game)) return
    dispatch({ type: 'solved', at: Date.now() })
    if (prefs.recordStats) {
      setStats((s) => {
        const next = recordFinish(s, {
          difficulty: game.meta.difficulty,
          seconds: elapsed,
          score: game.meta.score,
          checks: game.checksUsed,
          mistakes: game.mistakesFound,
          hints: game.hintsUsed,
        })
        saveStats(next)
        return next
      })
    }
    clearSave()
    setSavedGame(null)
    setTimeout(() => setDialog('win'), 900) // let the board finish its flourish
  }, [screen, game, elapsed, prefs.recordStats])

  // --------------------------------------------------------------- persist
  useEffect(() => {
    if (screen !== 'play' || !game || game.solvedAt) return
    const snapshot = {
      meta: game.meta,
      givens: game.givens,
      solution: game.solution,
      values: game.values,
      notes: game.notes,
      mode: game.mode,
      selected: game.selected,
      checksUsed: game.checksUsed,
      mistakesFound: game.mistakesFound,
      hintsUsed: game.hintsUsed,
      elapsed,
      filled: game.values.filter((v, i) => v && !game.givens[i]).length,
    }
    const t = setTimeout(() => writeSave(snapshot), 400)
    return () => clearTimeout(t)
  }, [screen, game, elapsed])

  const resumeSaved = useCallback(() => {
    const s = savedGame
    if (!s) return
    const restored = {
      ...createGame({ puzzle: s.givens, solution: s.solution, ...s.meta }),
      values: s.values,
      notes: s.notes,
      mode: s.mode ?? 'value',
      selected: s.selected ?? 0,
      checksUsed: s.checksUsed ?? 0,
      mistakesFound: s.mistakesFound ?? 0,
      hintsUsed: s.hintsUsed ?? 0,
      meta: s.meta,
    }
    dispatch({ type: 'restore', state: restored })
    setElapsed(s.elapsed || 0)
    setPaused(false)
    setNotice(null)
    setScreen('play')
  }, [savedGame])

  const abandonToMenu = useCallback(() => {
    if (game && !game.solvedAt && prefs.recordStats) {
      setStats((s) => {
        const next = recordAbandon(s, game.meta.difficulty)
        saveStats(next)
        return next
      })
    }
    setDialog(null)
    setNotice(null)
    setScreen('menu')
    setSavedGame(loadSave())
  }, [game, prefs.recordStats])

  // -------------------------------------------------------------- gameplay
  const act = useCallback(
    (action) => {
      if (paused || !game) return
      dispatch(action)
    },
    [paused, game]
  )

  const onDigit = useCallback(
    (digit, modeOverride, index) => {
      if (!game || paused || game.solvedAt) return
      const target = index ?? game.selected
      const mode = modeOverride || game.mode
      setNotice(null) // you have started; the opening note has served its purpose
      if (mode === 'value' && target != null && !game.givens[target]) {
        setJustPlaced(target)
        setTimeout(() => setJustPlaced(null), 220)
      }
      dispatch({ type: 'digit', digit, mode: modeOverride, prefs, index })
    },
    [game, paused, prefs]
  )

  /**
   * A keypad press means different things depending on the order you play in.
   * Number-first: it arms the digit (or disarms it if already armed) and nothing
   * lands until you tap a square. Square-first: it applies straight away.
   */
  const onPadPress = useCallback(
    (digit) => {
      if (!game || paused || game.solvedAt) return
      if (inputOrder === 'digit') setArmed((a) => (a === digit ? null : digit))
      else onDigit(digit)
    },
    [game, paused, inputOrder, onDigit]
  )

  const showHint = useCallback(() => {
    const found = findHint(game)
    setHint({ levels: hintText(found), level: 0 })
    dispatch({ type: 'hintUsed' })
  }, [game])

  /**
   * On a board nothing has been played on, "help me" is more usefully answered
   * with the notes than with a single move - so offer that first. One move on an
   * empty board only postpones the same question.
   */
  const requestHint = useCallback(() => {
    if (!game || paused || game.solvedAt) return
    if (!prefs.autoNotes && isPristine(game)) setHint({ offer: true })
    else showHint()
  }, [game, paused, prefs.autoNotes, showHint])

  const fillNotes = useCallback(() => {
    dispatch({ type: 'annotate' })
    setElapsed((e) => e + AUTO_NOTES_PENALTY)
    setHint(null)
    setNotice(AUTO_NOTES_NOTICE)
  }, [])

  // The brush is meaningless outside number-first play, or once the grid is done.
  useEffect(() => {
    if (inputOrder !== 'digit' || game?.solvedAt) setArmed(null)
  }, [inputOrder, game?.solvedAt])

  // A hint describes one moment; any change to the board makes it stale.
  useEffect(() => {
    setHint(null)
  }, [game?.values, game?.solvedAt])

  // Clear the conflict flash once its animation has run.
  useEffect(() => {
    if (!game?.flash) return
    const token = game.flash.token
    const t = setTimeout(() => dispatch({ type: 'clearFlash', token }), 640)
    return () => clearTimeout(t)
  }, [game?.flash])

  // ------------------------------------------------------------- keyboard
  useEffect(() => {
    if (screen !== 'play') return
    const onKey = (e) => {
      if (dialog) return
      if (e.metaKey || e.altKey) return
      const k = e.key

      if (k >= '1' && k <= '9') {
        e.preventDefault()
        // Shift lets you drop a note without leaving Number mode.
        onDigit(+k, e.shiftKey && game?.mode === 'value' ? 'note' : undefined)
        return
      }

      const lower = k.toLowerCase()

      if ((e.ctrlKey || e.metaKey) && lower === 'z') {
        e.preventDefault()
        act({ type: e.shiftKey ? 'redo' : 'undo' })
        return
      }
      if ((e.ctrlKey || e.metaKey) && lower === 'y') {
        e.preventDefault()
        act({ type: 'redo' })
        return
      }
      if (e.ctrlKey) return

      const arrows = {
        arrowup: [-1, 0],
        arrowdown: [1, 0],
        arrowleft: [0, -1],
        arrowright: [0, 1],
        w: [-1, 0],
        s: [1, 0],
        a: [0, -1],
        d: [0, 1],
      }
      if (arrows[lower]) {
        e.preventDefault()
        const [dr, dc] = arrows[lower]
        act({ type: 'move', dr, dc })
        return
      }

      if (MODE_KEYS[lower]) {
        e.preventDefault()
        act({ type: 'mode', mode: MODE_KEYS[lower] })
        return
      }

      switch (lower) {
        case ' ':
          e.preventDefault()
          act({ type: 'cycleMode' })
          break
        case 'backspace':
        case 'delete':
        case '0':
          e.preventDefault()
          act({ type: 'erase' })
          break
        case 'c':
          e.preventDefault()
          act({ type: 'check' })
          break
        case 'p':
          e.preventDefault()
          if (!game?.solvedAt) setPaused((p) => !p)
          break
        case 'h':
          e.preventDefault()
          requestHint()
          break
        case '?':
          e.preventDefault()
          setDialog('help')
          break
        case 'escape':
          act({ type: 'clearErrors' })
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, dialog, game, act, onDigit, requestHint])

  const updatePrefs = useCallback((next) => {
    setPrefs(next)
    savePrefs(next)
  }, [])

  /**
   * Training is a detour, not a departure. The game state is left exactly where
   * it was - the clock stops, because `running` wants the play screen - so you
   * can go and look up a technique in the middle of a puzzle and come straight
   * back to it.
   */
  const openTraining = useCallback(() => {
    setDialog(null)
    if (screen !== 'training') setCameFrom(screen)
    setScreen('training')
  }, [screen])

  const leaveTraining = useCallback(() => {
    setScreen(cameFrom === 'preview' && !gen.result ? 'menu' : cameFrom)
  }, [cameFrom, gen.result])

  // The offer carries no levels and highlights nothing on the board.
  const hintLevel = hint?.levels ? hint.levels[Math.min(hint.level, hint.levels.length - 1)] : null
  const band = game ? difficultyById(game.meta.difficulty) : null
  const modeLabel = useMemo(() => MODES.find((m) => m.id === game?.mode)?.label, [game?.mode])

  // ------------------------------------------------------------------ views
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Sudoku</h1>
        </div>

        <div className="topbar-actions">
          {screen === 'play' && game && (
            <>
              <span className="chip">
                <span className="dot" />
                {band.label}
              </span>
              {prefs.showTimer && (
                <span className={`timer${paused ? ' paused' : ''}`}>{formatTime(elapsed)}</span>
              )}
              {!game.solvedAt && (
                <button type="button" className="btn small" onClick={() => setPaused((p) => !p)}>
                  {paused ? 'Resume' : 'Pause'}
                </button>
              )}
            </>
          )}
          {!prefs.recordStats && (
            <span className="chip muted" title="Nothing you play is being added to your statistics">
              <span className="dot" />
              Not recording
            </span>
          )}
          <button
            type="button"
            className={`btn small only-wide${screen === 'training' ? ' primary' : ' ghost'}`}
            onClick={screen === 'training' ? leaveTraining : openTraining}
          >
            {screen === 'training' ? 'Leave training' : 'Training'}
          </button>
          <button type="button" className="btn ghost small only-wide" onClick={() => setDialog('stats')}>
            Stats
          </button>
          <button type="button" className="btn ghost small only-wide" onClick={() => setDialog('settings')}>
            Settings
          </button>
          <button type="button" className="btn ghost small only-wide" onClick={() => setDialog('help')}>
            Help
          </button>
          <button
            type="button"
            className="btn small only-narrow"
            onClick={() => setDialog('menu')}
            aria-label="More"
          >
            ⋯
          </button>
          {screen === 'play' && (
            <button
              type="button"
              className="btn small only-wide"
              onClick={() => (game?.solvedAt ? abandonToMenu() : setDialog('quit'))}
            >
              New puzzle
            </button>
          )}
        </div>
      </header>

      {screen === 'menu' && (
        <StartScreen
          stats={stats}
          save={savedGame}
          onPick={requestPuzzle}
          onResume={resumeSaved}
          onDiscard={() => {
            clearSave()
            setSavedGame(null)
          }}
          onTrain={openTraining}
        />
      )}

      {screen === 'training' && <Training onExit={leaveTraining} />}

      {screen === 'preview' && (
        <Preview
          result={gen.result}
          generating={gen.status !== 'ready'}
          attempt={gen.attempt}
          difficultyId={gen.difficulty}
          onStart={startGame}
          onRegenerate={() => requestPuzzle(gen.difficulty)}
          onBack={() => {
            reqRef.current++ // abandon any in-flight result
            setScreen('menu')
          }}
        />
      )}

      {screen === 'play' && game && (
        <div className="play-area">
          <div className="board-column">
            <Board
              game={game}
              prefs={prefs}
              paused={paused}
              justPlaced={justPlaced}
              hintCells={hintLevel?.highlight}
              hintFocus={hintLevel?.focus}
              armed={armed}
              onSelect={(i) => {
                if (armed && !game.solvedAt) onDigit(armed, undefined, i)
                else act({ type: 'select', index: i })
              }}
              onResume={() => setPaused(false)}
            />
            {hint?.offer && !paused && (
              <HintBar
                levels={[AUTO_NOTES_OFFER]}
                level={0}
                actionLabel={`Fill them in (+${formatTime(AUTO_NOTES_PENALTY)})`}
                onAction={fillNotes}
                closeLabel="Just hint me"
                onClose={showHint}
              />
            )}
            {hint?.levels && !paused && (
              <HintBar
                levels={hint.levels}
                level={hint.level}
                onMore={() => setHint((h) => ({ ...h, level: h.level + 1 }))}
                onClose={() => setHint(null)}
              />
            )}
            {notice && !hint && !paused && (
              <HintBar levels={[notice]} level={0} onClose={() => setNotice(null)} />
            )}
          </div>
          <SidePanel
            game={game}
            mode={game.mode}
            disabled={paused || !!game.solvedAt}
            onMode={(mode) => act({ type: 'mode', mode })}
            armed={armed}
            inputOrder={inputOrder}
            onDigit={onPadPress}
            onErase={() => act({ type: 'erase' })}
            onCheck={() => act({ type: 'check' })}
            onUndo={() => act({ type: 'undo' })}
            onRedo={() => act({ type: 'redo' })}
            onReset={() => setDialog('reset')}
            onHint={requestHint}
            onToggleOrder={() =>
              updatePrefs({ ...prefs, inputOrder: inputOrder === 'digit' ? 'cell' : 'digit' })
            }
          />
        </div>
      )}

      {screen === 'play' && game && (
        <p className="footer-note">
          {modeLabel} mode · click a square then a number, or just type · press{' '}
          <kbd style={{ padding: '1px 5px' }}>?</kbd> for keys
        </p>
      )}

      {dialog === 'stats' && (
        <StatsDialog
          stats={stats}
          prefs={prefs}
          onChange={updatePrefs}
          onClose={() => setDialog(null)}
          onReset={() => setStats(resetStats())}
        />
      )}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === 'settings' && (
        <SettingsDialog prefs={prefs} onChange={updatePrefs} onClose={() => setDialog(null)} />
      )}
      {dialog === 'win' && game && (
        <WinDialog
          game={game}
          seconds={elapsed}
          stats={stats}
          onNewGame={abandonToMenu}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'menu' && (
        <MenuDialog
          inGame={screen === 'play'}
          inTraining={screen === 'training'}
          onPick={(what) => {
            if (what === 'training') {
              openTraining()
            } else if (what === 'leave-training') {
              setDialog(null)
              leaveTraining()
            } else if (what === 'new') {
              setDialog(null)
              if (game?.solvedAt || screen !== 'play') abandonToMenu()
              else setDialog('quit')
            } else setDialog(what)
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'reset' && game && (
        <ResetDialog
          game={game}
          onClearAnswers={() => {
            act({ type: 'clearAnswers' })
            setDialog(null)
          }}
          onClearAll={() => {
            act({ type: 'clearAll' })
            setDialog(null)
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'quit' && (
        <ConfirmDialog
          title="Leave this puzzle?"
          body="Your progress is saved — you can pick it up from the menu. It will end your clean-solve streak for this difficulty."
          confirmLabel="Leave puzzle"
          onConfirm={abandonToMenu}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
