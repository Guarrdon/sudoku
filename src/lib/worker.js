// Generation runs off the main thread: a Master puzzle can take a few hundred
// milliseconds of solid backtracking, and the UI should never stutter for it.
import { generatePuzzle } from './generator.js'

self.onmessage = (e) => {
  const { id, difficulty } = e.data
  try {
    const result = generatePuzzle(difficulty, {
      onProgress: (attempt) => self.postMessage({ id, type: 'progress', attempt }),
    })
    self.postMessage({ id, type: 'done', result })
  } catch (err) {
    self.postMessage({ id, type: 'error', message: err?.message || String(err) })
  }
}
