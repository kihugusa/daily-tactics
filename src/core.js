// Pure helpers shared by the app and the tests (no DOM).

export const LAUNCH = '2026-11-17';

export function dayNumber(dateStr) {
  const p = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((p(dateStr) - p(LAUNCH)) / 86400000) + 1;
}

// Daily puzzles come from mid-rated, well-liked positions, so most days are winnable.
export function pickDailyPool(rows) {
  const pool = rows.filter(r => r[3] >= 1000 && r[3] <= 2000);
  return (pool.length >= 7 ? pool : rows).slice().sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

// A fixed pseudo-random permutation of the pool: day d always maps to the same puzzle,
// and no puzzle repeats until the whole pool has been used.
export function dailyIndex(n, day) {
  if (n <= 1) return 0;
  // affine permutation i -> (a*i + b) mod n with gcd(a, n) = 1
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  let a = Math.floor(n * 0.6180339887) | 1;
  while (gcd(a, n) !== 1) a++;
  const b = 7919 % n;
  const i = ((day - 1) % n + n) % n;
  return (a * i + b) % n;
}

// Elo-style rating update for the solver.
export function updateRating(user, puzzle, won, games) {
  const k = games < 20 ? 40 : 20;
  const expected = 1 / (1 + Math.pow(10, (puzzle - user) / 400));
  return Math.round(user + k * ((won ? 1 : 0) - expected));
}

export const THEMES = [
  ['all', 'All'], ['mate', 'Checkmate'], ['fork', 'Fork'], ['pin', 'Pin'], ['skewer', 'Skewer'],
  ['discoveredAttack', 'Discovered attack'], ['sacrifice', 'Sacrifice'], ['hangingPiece', 'Hanging piece'],
  ['defensiveMove', 'Defence'], ['endgame', 'Endgame']
];
export const THEME_NAMES = {
  mate: 'Checkmate', mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3', mateIn4: 'Mate in 4', fork: 'Fork', pin: 'Pin',
  skewer: 'Skewer', discoveredAttack: 'Discovered attack', sacrifice: 'Sacrifice', hangingPiece: 'Hanging piece',
  defensiveMove: 'Defensive move', endgame: 'Endgame', middlegame: 'Middlegame', opening: 'Opening', attraction: 'Attraction',
  deflection: 'Deflection', kingsideAttack: 'Kingside attack', backRankMate: 'Back-rank mate', smotheredMate: 'Smothered mate',
  quietMove: 'Quiet move', zugzwang: 'Zugzwang', trappedPiece: 'Trapped piece', advancedPawn: 'Advanced pawn',
  promotion: 'Promotion', intermezzo: 'In-between move', xRayAttack: 'X-ray', doubleCheck: 'Double check',
  exposedKing: 'Exposed king', capturingDefender: 'Remove the defender', clearance: 'Clearance', interference: 'Interference',
  rookEndgame: 'Rook endgame', pawnEndgame: 'Pawn endgame', knightEndgame: 'Knight endgame', bishopEndgame: 'Bishop endgame',
  queenEndgame: 'Queen endgame', operaMate: 'Opera mate', anastasiaMate: "Anastasia's mate", arabianMate: 'Arabian mate',
  hookMate: 'Hook mate', dovetailMate: 'Dovetail mate', bodenMate: "Boden's mate", enPassant: 'En passant'
};
export const SHOWN_THEMES = new Set(Object.keys(THEME_NAMES));

// Pick a training puzzle near the player's rating, honouring a theme filter and skipping recent ones.
export function pickTraining(rows, rating, theme, recent, rand) {
  const fits = rows.filter(r => (theme === 'all' || r[4].split(' ').includes(theme)) && !recent.has(r[0]));
  const src = fits.length ? fits : rows;
  for (const w of [100, 200, 350, 600, 5000]) {
    const near = src.filter(r => Math.abs(r[3] - rating) <= w);
    if (near.length) return near[Math.floor(rand() * near.length)];
  }
  return src[Math.floor(rand() * src.length)];
}
