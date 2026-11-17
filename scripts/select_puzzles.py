"""Pick a high-quality, rating-balanced set of puzzles from the Lichess puzzle CSV on stdin.

Keeps well-tested, well-liked puzzles (popularity >= 85, >= 300 plays, rating deviation <= 90,
2-10 half-moves), then samples evenly across 100-point rating bands from 400 to 2900.
Output: JSON {v, source, cols, rows} on stdout. Deterministic for a given input.
"""
import csv, json, random, sys

PER_BAND = int(sys.argv[1]) if len(sys.argv) > 1 else 450
rng = random.Random(20261117)
bands = {}
seen = {}
reader = csv.reader(sys.stdin)
header = next(reader)
col = {name: i for i, name in enumerate(header)}
for row in reader:
    try:
        rating, rd, pop, plays = int(row[col['Rating']]), int(row[col['RatingDeviation']]), int(row[col['Popularity']]), int(row[col['NbPlays']])
    except (ValueError, IndexError):
        continue
    moves = row[col['Moves']].split()
    if pop < 85 or plays < 300 or rd > 90 or not (2 <= len(moves) <= 10) or len(moves) % 2:
        continue
    band = min(28, max(4, rating // 100))
    item = [row[col['PuzzleId']], row[col['FEN']], ' '.join(moves), rating, row[col['Themes']]]
    n = seen.get(band, 0) + 1
    seen[band] = n
    res = bands.setdefault(band, [])
    if len(res) < PER_BAND:
        res.append(item)
    else:  # reservoir sampling keeps a uniform sample per band
        j = rng.randrange(n)
        if j < PER_BAND:
            res[j] = item
rows = [r for b in sorted(bands) for r in sorted(bands[b])]
json.dump({"v": 1, "source": "Lichess puzzle database (CC0), https://database.lichess.org/",
           "cols": ["id", "fen", "moves", "rating", "themes"], "rows": rows}, sys.stdout, separators=(',', ':'))
print(f"selected {len(rows)} puzzles from {sum(seen.values())} candidates", file=sys.stderr)
