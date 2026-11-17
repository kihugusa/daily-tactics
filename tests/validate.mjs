// Validates a puzzle file: every move must be legal, mate puzzles must end in mate,
// and the daily schedule must be deterministic with no repeats for a year.
// Usage: node tests/validate.mjs [path/to/puzzles.json]
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { dailyIndex, pickDailyPool } from '../src/core.js';

const file = process.argv[2] || new URL('../src/puzzles.sample.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));
let bad = 0;
for (const [id, fen, moves, rating, themes] of data.rows) {
  const g = new Chess();
  if (!g.load(fen)) { bad++; console.log('bad FEN', id); continue; }
  const ms = moves.split(' ');
  for (const m of ms) {
    const r = g.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    if (!r) { bad++; console.log('illegal', id, m); break; }
  }
  if (themes.split(' ').includes('mate') && !g.in_checkmate()) { bad++; console.log('mate theme but no mate', id); }
  if (ms.length % 2 !== 0) { bad++; console.log('odd move count', id); }
  if (!(rating > 0)) { bad++; console.log('bad rating', id); }
}
const pool = pickDailyPool(data.rows);
const seen = new Set();
const days = Math.min(365, pool.length);
for (let d = 1; d <= days; d++) seen.add(dailyIndex(pool.length, d));
if (seen.size !== days) { bad++; console.log('daily repeats within', days, 'days'); }
if (dailyIndex(pool.length, 5) !== dailyIndex(pool.length, 5)) { bad++; console.log('daily not deterministic'); }
console.log(`${data.rows.length} puzzles checked, daily pool ${pool.length}, ${bad ? bad + ' problems' : 'all legal'}`);
process.exit(bad ? 1 : 0);
