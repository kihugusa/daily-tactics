# Daily Tactics

Play: https://kihugusa.github.io/daily-tactics/

A daily chess puzzle, rated training by theme, and a three-minute puzzle rush. It installs on a phone as an app.

## Features

- **Today:** everyone gets the same puzzle each day. It's drawn from mid-rated puzzles (1000–2000) in a fixed shuffled order, so no puzzle repeats until the pool runs out. Solving it keeps your streak.
- **Train:**
  - Puzzles are picked near your rating, which starts at 1200 and moves Elo-style.
  - You can filter by theme: checkmate, fork, pin, skewer, discovered attack, sacrifice, hanging piece, defence or endgame.
  - Using a hint or the solution counts as a loss.
- **Rush:** three minutes and rising difficulty. Three misses and the run ends.
- **Stats:** a rating chart and your weakest themes. Progress stays in the browser.

## Data

- Puzzles come from the [Lichess puzzle database](https://database.lichess.org/), released under CC0.
- `.github/workflows/puzzles.yml` runs monthly, and on demand from the Actions tab:
  1. Downloads the full export.
  2. Keeps well-tested, well-liked puzzles: popularity ≥ 85, ≥ 300 plays, rating deviation ≤ 90, at most 5 solver moves.
  3. Samples up to 450 per 100-point rating band from 400 to 2900 (`scripts/select_puzzles.py`).
  4. Checks every move with chess.js (`tests/validate.mjs`), rebuilds the site into `docs/` and commits it.

## Build

```bash
npm ci
node tests/validate.mjs [docs/puzzles.json]   # every move legal, mates end in mate, daily order has no repeats
node build.mjs                                # dist/artifact.html + dist/web/ (installable app)
cp -r dist/web/. docs/                        # docs/ is what GitHub Pages serves
python3 tests/ui_test.py                      # headless phone test (Playwright)
```

## License

GPL-3.0-or-later, because the board is [Chessground](https://github.com/lichess-org/chessground) (GPL-3.0) with the cburnett piece set. Move logic is [chess.js](https://github.com/jhlywa/chess.js) (BSD-2).
