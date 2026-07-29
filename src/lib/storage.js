// localStorage only. Nothing leaves this machine, nothing is tracked.

import { DIFFICULTIES } from './generator.js'

const STATS_KEY = 'sudoku.stats.v1'
const SAVE_KEY = 'sudoku.save.v1'
const PREFS_KEY = 'sudoku.prefs.v1'

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private browsing / quota - the game still plays, it just won't remember */
  }
}

// ------------------------------------------------------------------- stats

const blankBand = () => ({
  started: 0,
  completed: 0,
  bestTime: null,
  totalTime: 0,
  bestScore: null,
  checks: 0,
  mistakes: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayed: null,
})

export function emptyStats() {
  const bands = {}
  for (const d of DIFFICULTIES) bands[d.id] = blankBand()
  return { bands, totalStarted: 0, totalCompleted: 0, totalTime: 0 }
}

export function loadStats() {
  const stored = read(STATS_KEY, null)
  if (!stored) return emptyStats()
  const base = emptyStats()
  // Merge defensively so an older save (or a new difficulty) never crashes us.
  return {
    ...base,
    ...stored,
    bands: Object.fromEntries(
      DIFFICULTIES.map((d) => [d.id, { ...blankBand(), ...(stored.bands?.[d.id] || {}) }])
    ),
  }
}

export const saveStats = (stats) => write(STATS_KEY, stats)

export function recordStart(stats, difficulty) {
  const next = structuredClone(stats)
  next.bands[difficulty].started++
  next.totalStarted++
  return next
}

export function recordFinish(stats, { difficulty, seconds, score, checks, mistakes }) {
  const next = structuredClone(stats)
  const band = next.bands[difficulty]
  band.completed++
  band.totalTime += seconds
  band.checks += checks
  band.mistakes += mistakes
  band.lastPlayed = Date.now()
  if (band.bestTime === null || seconds < band.bestTime) band.bestTime = seconds
  if (band.bestScore === null || score > band.bestScore) band.bestScore = score
  // A "clean" win - no check button, no mistakes - keeps the streak alive.
  if (mistakes === 0) {
    band.currentStreak++
    if (band.currentStreak > band.bestStreak) band.bestStreak = band.currentStreak
  } else {
    band.currentStreak = 0
  }
  next.totalCompleted++
  next.totalTime += seconds
  return next
}

/** Abandoning a puzzle breaks the clean-win streak for that band. */
export function recordAbandon(stats, difficulty) {
  const next = structuredClone(stats)
  next.bands[difficulty].currentStreak = 0
  return next
}

export const resetStats = () => {
  const fresh = emptyStats()
  saveStats(fresh)
  return fresh
}

// -------------------------------------------------------- in-progress save

export const loadSave = () => read(SAVE_KEY, null)
export const writeSave = (state) => write(SAVE_KEY, state)
export const clearSave = () => {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------- prefs

export const defaultPrefs = {
  recordStats: true, // off = play freely without touching your record
  autoClearNotes: true, // placing a digit clears matching plain notes from peers
  highlightPeers: true, // dim-highlight the row, column and box of the selection
  highlightMatches: true, // glow every cell holding the selected digit
  flashConflicts: true, // brief red flash when a placement clashes
  showTimer: true,
}

export const loadPrefs = () => ({ ...defaultPrefs, ...read(PREFS_KEY, {}) })
export const savePrefs = (prefs) => write(PREFS_KEY, prefs)

// ------------------------------------------------------------------ format

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
