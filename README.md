# Sudoku

Sudoku that runs entirely in your browser. Five difficulty levels, coloured pencil-mark
notes, and a timer and statistics kept on your own device.

![An Expert puzzle part-solved: coloured notes, and a hint explaining the XY-Wing that unlocks the next number](docs/board.png)

## Play it

```bash
npm install
npm run dev
```

That starts it at `http://localhost:5173`. To make a copy you can host anywhere (or keep
in a folder and open offline):

```bash
npm run build     # writes a self-contained site to dist/
```

## How to play

Classic Sudoku: fill the grid so every row, every column and every 3×3 box contains the
digits 1 to 9 exactly once. The dark numbers are the puzzle; the blue ones are yours.

Click a square and then a number, or click a square and type. Both work everywhere.

### Choosing a puzzle

Pick a difficulty and you're shown the board *before* you start — its measured difficulty
score, how many numbers you're given, and the hardest tactic it needs. Nothing is timed
until you press
**Play this board**, so you can look at a puzzle and ask for a different one at no cost.

### Notes

Notes are the small digits you pencil into a square while you're working it out. All nine
fit, and they come in three colours:

- **grey** — still possible
- **green** — this could be the answer
- **red** — ruled out (drawn with a line through it, so it reads even if colour is hard
  to distinguish)

The quickest way is to press a digit more than once:

| press `5` | you get |
| --- | --- |
| once | a large **5**, as your answer |
| twice | a green note 5 |
| three times | a red note 5 |
| four times | no 5 note at all |

Each press only ever affects the digit you pressed, so notes build up: `2 2` then `5 5`
leaves you with a green 2 *and* a green 5.

If you'd rather not count presses, there are dedicated modes — **Note**, **Green** and
**Red** — on the panel beside the board, or on the keys `N`, `G` and `R`.

**Your notes are never thrown away.** Putting a number in a square only hides the notes
underneath it, and a small corner mark shows when that's happened. Take the number away
and every note is exactly where you left it. Erase works the same way: the first press
lifts the number, a second clears the notes.

### Checking your work

**Check** marks any square you've filled in that doesn't match the solution. It's free and
you can use it as often as you like — it only counts against the "clean solve" streak in
your statistics if it actually finds a mistake.

Separately, if you place a number that clashes with one already on the board, both squares
flash red for a moment. That only ever compares against numbers already visible, so it
never gives away an answer you haven't found.

## Difficulty

Most Sudoku apps decide difficulty by counting how many numbers they removed. That doesn't
tell you much — a puzzle with few clues can be straightforward, and one with plenty can be
hard.

Here, every generated puzzle is solved by a program that works the way a person does,
trying the simplest tactic that gets anywhere and moving up only when it has to:

| | |
| --- | --- |
| **Easy** | Squares you can fill by simple elimination. Plenty of clues. |
| **Medium** | The same tactics, fewer clues — more hunting before each answer. |
| **Hard** | Needs pairs and locked candidates. You'll want your notes. |
| **Expert** | Triples, quads and wings. Long chains of reasoning. |
| **Master** | The hardest patterns the solver knows. Bring patience. |

How much work that took becomes the puzzle's **score**, and the trickiest tactic it needed
is its **hardest step** — both shown before you start, along with a full list of what the
puzzle requires. If a generated board doesn't match the difficulty you asked for, it's
thrown away and another is made.

**You never have to guess.** Puzzles that can't be finished by reasoning alone are never
offered — not as a first choice, and not as a fallback. Every puzzle has exactly one
solution, and the test suite proves the point by solving one of every difficulty using
nothing but the hint button.

### Hints

If you're stuck, **Give me a hint** (or `H`) tells you what to do next — in three
stages, so asking for help doesn't have to mean being handed the answer:

1. **What to look for** — names the tactic and roughly where, e.g. *"Look for a Pointing
   Pair in the top-left box, involving the digit 5."* Often that's all you need.
2. **How it works** — highlights the squares involved and explains why the tactic is
   valid, so the next one is easier to spot yourself.
3. **The move** — the exact number you can write in, and where.

A hint always ends in a number you can actually place, working forward through however
many deductions that takes. If something you've already written is wrong, the hint says
so first, because nothing else will work out until it's fixed.

Hints never guess. They come from the same solver that rates the puzzles, and they don't
read your notes — so wrong or missing notes can't send them astray.

### Starting over

**Start over**, beside the board, offers two choices:

- **Clear my answers** — removes the numbers you've written in and keeps every note,
  including notes hidden under a number
- **Clear my answers and notes** — back to the puzzle exactly as you were given it

Neither touches the puzzle's own numbers, the timer keeps running, and either can be
undone with `Ctrl`+`Z`.

## Statistics

Per difficulty: how many you've solved, your best and average time, and a streak counting
puzzles finished without ever placing a wrong number.

You can switch recording off from the Stats window if you want to play without it counting
— a marker stays in the header while it's off — and you can clear your statistics at any
time.

## Your data

Everything stays in your browser. There is no server, no account, and the game makes no
network requests at all — you can disconnect and it works exactly the same. Your times and
statistics are stored locally, and clearing your browser data removes them.

Games in progress are saved automatically, so you can close the tab and pick up where you
left off.

## Keys

Everything is reachable with the mouse; these just make it faster.

| | |
| --- | --- |
| `1`–`9` | Place a number |
| `1`–`9` again | Same digit: answer → green note → red note → nothing |
| `Shift`+`1`–`9` | Straight to a note, without changing mode |
| `V` `N` `G` `R` | Number / Note / Green / Red mode |
| `Space` | Step through the modes |
| Arrow keys or `WASD` | Move around the board |
| `Backspace` | Lift the number; again to clear the notes under it |
| `C` | Check for mistakes |
| `H` | Ask for a hint |
| `Ctrl`+`Z` / `Ctrl`+`Y` | Undo / redo |
| `P` | Pause |
| `?` | Help |

## Building on it

Plain JavaScript and React, built with Vite. No runtime dependencies beyond React itself.

```
src/
  lib/
    grid.js        rows, columns, boxes and which squares can see which
    solver.js      a fast solver, plus the one that rates difficulty
    generator.js   builds puzzles, measures them, retries until they fit
    worker.js      generation, kept off the main thread
    game.js        the rules of play, with no React in them
    hint.js        finds the next move and explains it in stages
    storage.js     saved games, statistics and settings
  components/      Board, SidePanel, HintBar, StartScreen, Preview, Dialogs
test/              checks for the solver, generator, rules and hints
```

```bash
npm test
```

Because the rules live apart from the interface, they can be tested directly. The tests
cover puzzle generation and rating, every input rule (including that notes survive a
number being placed on top of them), and the hint engine — which they check by solving a
puzzle of each difficulty using nothing but hints, verifying every suggested move against
the real solution.

## Licence

MIT — see [LICENSE](LICENSE).
