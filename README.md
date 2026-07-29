# Sudoku

A calm, ad-free Sudoku for the browser. No accounts, no tracking, no network calls,
no "watch a video to continue". You open it and you play.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
npm test         # engine + game-logic checks
```

## Honest difficulty

Most Sudoku apps set difficulty by counting how many clues they removed. That's a poor
proxy — a 24-clue board can be trivial and a 30-clue board can be brutal.

Here, every generated board is **solved by a model of how a person actually solves**,
one technique at a time, cheapest first:

| Tier | Techniques |
| --- | --- |
| 0 | Naked Single, Hidden Single |
| 1 | Pointing Pair/Triple, Box/Line Reduction, Naked Pair |
| 2 | Hidden Pair, Naked Triple, Hidden Triple |
| 3 | Naked Quad, X-Wing, XY-Wing |
| 4 | Swordfish |

Each technique has a cost; the total is the board's **difficulty score**, and the
highest tier reached is its **hardest step**. A board is only offered as, say, Expert
if it genuinely requires a tier-3 technique and scores in the Expert window. If the
generator can't hit the band, it discards the board and tries again — typically a few
dozen candidates, all within a few hundred milliseconds, on a worker thread.

Boards that can't be finished by logic alone (that would need guessing) are always
rejected. Every puzzle has exactly one solution, verified by an independent solver.

The bands were calibrated by sampling ~1600 generated boards rather than guessed:
see `DIFFICULTIES` in `src/lib/generator.js`.

**You see all of this before you commit.** Pick a difficulty and the board is generated
and rated while you wait, then shown to you — score, clue count, hardest step, and the
full list of techniques it needs. The clock does not start until you press *Play this
board*. Don't like it? *Try another*, at no cost.

## Notes, in three colours

Notes are small digits in a 3×3 arrangement inside the square; all nine fit.

- **Grey** — still on the table
- **Green** — this could be it
- **Red** — ruled out (drawn struck through, so it reads without relying on colour)

Two ways to set them, and they work together:

- **Note mode** (`N`) — pressing a digit cycles it: off → grey → green → red → off
- **Green mode** (`G`) / **Red mode** (`R`) — pressing a digit toggles that colour directly

Placing a real number in a square clears that square's notes. It also tidies the matching
*grey* note out of the row, column and box — but never touches a green or red note, since
you set those deliberately. (Toggleable in Settings.)

## Keys

| | |
| --- | --- |
| `1`–`9` | Place a number, or set a note in a note mode |
| `Shift`+`1`–`9` | Cycle a note without leaving Number mode |
| `V` `N` `G` `R` | Number / Note / Green / Red mode |
| `Space` | Cycle through the modes |
| Arrows or `WASD` | Move around the board |
| `Backspace` | Clear the square |
| `C` | Check for wrong squares |
| `Ctrl`+`Z` / `Ctrl`+`Y` | Undo / redo |
| `P` | Pause |
| `?` | Help |

Mouse works throughout: click a square, then click a number.

## The rest

- **Check** marks any placed square that disagrees with the solution. Givens are never
  editable, and a square stops being flagged the moment you change it.
- **Conflicts** flash red briefly on both the square you placed and the ones it clashes
  with — only against numbers already on the board, so it never leaks the solution.
- **Timer** pauses when you pause and when you switch tabs, so your time is real.
- **Statistics** per difficulty: solved, best, average, and a clean-solve streak that
  counts consecutive wins with no wrong square ever placed. Checking is free; being
  wrong is what breaks it.
- **Progress is saved** as you play. Close the tab and resume from the menu.
- Everything lives in `localStorage`. There is no server.

## Layout

```
src/
  lib/
    grid.js        geometry: houses, peers, conflicts
    solver.js      fast bitmask solver + human-technique analyser
    generator.js   build, dig, rate, retry -> difficulty bands
    worker.js      generation off the main thread
    game.js        game state and reducer (no React)
    storage.js     localStorage: stats, save, preferences
  components/      Board, SidePanel, StartScreen, Preview, Dialogs
test/              engine + game-logic checks, no dependencies
```

The rules engine has no React in it and is tested directly.
