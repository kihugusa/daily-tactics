// Daily Tactics — app. Bundled with chess.js (BSD-2) and Chessground (GPL-3.0) by build.mjs.
import { Chessground } from '@lichess-org/chessground';
import { Chess } from 'chess.js';
import { LAUNCH, dayNumber, pickDailyPool, dailyIndex, updateRating, THEMES, THEME_NAMES, SHOWN_THEMES, pickTraining } from './core.js';

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, k) => today(new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) + k));
const prettyDate = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmt = s => `${Math.floor(s / 60)}:${pad(s % 60)}`;

const KEY = 'dt:v1';
const blank = () => ({ rating: 1200, games: 0, hist: [], daily: {}, recent: [], themes: {}, rushBest: 0, rushHist: [] });
function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return blank(); } }
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

let ROWS = [], POOL = [];
let mode = 'daily', date = today(), theme = 'all';
let cg = null, game = null, P = null, sol = [], step = 0, playerColor = 'white';
let failed = false, hinted = false, done = false, busy = false;
let rush = null, rushTimer = null;
let rand = Math.random;

// ---------- board ----------
function legalDests(g) {
  const dests = new Map();
  for (const m of g.moves({ verbose: true })) {
    if (!dests.has(m.from)) dests.set(m.from, []);
    dests.get(m.from).push(m.to);
  }
  return dests;
}
function syncBoard(lastMove) {
  const turn = game.turn() === 'w' ? 'white' : 'black';
  const canMove = !done && !busy && turn === playerColor;
  cg.set({
    fen: game.fen(), turnColor: turn, lastMove, check: game.in_check() ? turn : false,
    movable: { color: canMove ? playerColor : undefined, dests: canMove ? legalDests(game) : new Map() }
  });
}
function uciMove(u) { return game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' }); }

function startPuzzle(row) {
  P = { id: row[0], fen: row[1], moves: row[2].split(' '), rating: row[3], themes: row[4].split(' ') };
  game = new Chess(P.fen);
  sol = P.moves; step = 0; failed = false; hinted = false; done = false; busy = true;
  // The first move is the opponent's; the solver plays the side to move after it.
  playerColor = game.turn() === 'w' ? 'black' : 'white';
  cg.set({ orientation: playerColor, drawable: { shapes: [] } });
  cg.setShapes([]);
  syncBoard();
  setStatus(`${cap(playerColor)} to play. Find the best move.`, '');
  renderMeta();
  setTimeout(() => {
    const m = uciMove(sol[0]); step = 1; busy = false;
    syncBoard([m.from, m.to]);
  }, 600);
}
const cap = s => s[0].toUpperCase() + s.slice(1);

function onUserMove(orig, dest) {
  if (done || busy) return;
  const expected = sol[step];
  const piece = game.get(orig);
  const promo = piece && piece.type === 'p' && (dest[1] === '8' || dest[1] === '1')
    ? (expected && expected.slice(0, 4) === orig + dest ? expected[4] || 'q' : 'q') : undefined;
  const mv = game.move({ from: orig, to: dest, promotion: promo });
  if (!mv) { syncBoard(); return; }
  const uci = orig + dest + (promo || '');
  const isLast = step === sol.length - 1;
  const right = uci === expected || (expected && uci.slice(0, 4) === expected.slice(0, 4) && !expected[4]) || (isLast && game.in_checkmate());
  cg.setShapes([]);
  if (!right) {
    failed = true;
    if (mode === 'rush') { busy = true; syncBoard([orig, dest]); setStatus('Missed.', 'bad'); busy = false; rushMiss(); return; }
    setStatus('Not the move. Try again.', 'bad');
    busy = true; syncBoard([orig, dest]);
    setTimeout(() => { game.undo(); busy = false; syncBoard(); }, 700);
    return;
  }
  step++;
  if (step >= sol.length) { syncBoard([orig, dest]); return finish(true); }
  setStatus('Good move. Keep going.', 'good');
  busy = true; syncBoard([orig, dest]);
  setTimeout(() => {
    const m = uciMove(sol[step]); step++; busy = false;
    syncBoard([m.from, m.to]);
    setStatus(`Your move.`, '');
  }, 450);
}

function finish(solved) {
  done = true; syncBoard();
  const clean = solved && !failed && !hinted;
  if (mode === 'rush') return rushSolved();
  if (mode === 'train' && !P.counted) {
    P.counted = true;
    const before = S.rating;
    S.rating = updateRating(S.rating, P.rating, clean, S.games); S.games++;
    S.hist.push(S.rating); S.hist = S.hist.slice(-300);
    S.recent.push(P.id); S.recent = S.recent.slice(-400);
    for (const t of P.themes) if (SHOWN_THEMES.has(t)) { const x = S.themes[t] || [0, 0]; x[0] += clean ? 1 : 0; x[1]++; S.themes[t] = x; }
    save();
    const d = S.rating - before;
    setStatus(clean ? `Solved. Rating ${S.rating} (${d >= 0 ? '+' : ''}${d}).` : `Solved with help. Rating ${S.rating} (${d >= 0 ? '+' : ''}${d}).`, clean ? 'good' : 'warn');
  } else if (mode === 'daily') {
    if (!S.daily[date]) { S.daily[date] = { clean: clean ? 1 : 0, solved: solved ? 1 : 0 }; save(); }
    setStatus(clean ? 'Solved. See you tomorrow.' : solved ? 'Solved with help.' : 'Solution shown.', clean ? 'good' : 'warn');
  }
  renderMeta(true);
  renderHeader();
}

// ---------- controls ----------
function hint() {
  if (done || busy || !sol[step]) return;
  hinted = true;
  cg.setShapes([{ orig: sol[step].slice(0, 2), brush: 'green' }]);
  setStatus('Hint: move the highlighted piece.', 'warn');
}
function showSolution() {
  if (done || busy) return;
  failed = true; busy = true; cg.setShapes([]);
  const playNext = () => {
    if (step >= sol.length) { busy = false; return finish(false); }
    const m = uciMove(sol[step]); step++; syncBoard([m.from, m.to]);
    setTimeout(playNext, 650);
  };
  playNext();
}

function setStatus(t, kind) { const s = $('status'); s.textContent = t; s.className = 'status ' + (kind || ''); }
function renderMeta(reveal) {
  const shown = P.themes.filter(t => SHOWN_THEMES.has(t)).map(t => THEME_NAMES[t]);
  $('meta').innerHTML = `<span>Puzzle rating <b>${P.rating}</b></span>` +
    (reveal ? `<span>${shown.join(' · ') || 'Tactic'}</span><a href="https://lichess.org/training/${P.id}" target="_blank" rel="noopener">View on Lichess</a>` : `<span class="mute">Themes revealed when solved</span>`);
  const inPlay = !done;
  $('hintBtn').hidden = !inPlay || mode === 'rush';
  $('solBtn').hidden = !inPlay || mode === 'rush';
  $('nextBtn').hidden = inPlay || mode === 'daily' || mode === 'rush';
  $('nextBtn').textContent = 'Next puzzle';
}

// ---------- modes ----------
function setMode(m) {
  mode = m; stopRush();
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
  $('dailyBar').hidden = m !== 'daily';
  $('trainBar').hidden = m !== 'train';
  $('rushBar').hidden = m !== 'rush';
  $('statsView').hidden = m !== 'stats';
  $('play').hidden = m === 'stats';
  if (m === 'daily') openDaily();
  if (m === 'train') nextTraining();
  if (m === 'rush') rushIntro();
  if (m === 'stats') renderStats();
  renderHeader();
}
function openDaily() {
  const n = dayNumber(date);
  const row = POOL[dailyIndex(POOL.length, n)];
  $('dayLabel').textContent = `#${n} · ${prettyDate(date)}`;
  $('prevDay').disabled = date <= LAUNCH; $('nextDay').disabled = date >= today();
  startPuzzle(row);
  if (S.daily[date]) setStatus(S.daily[date].clean ? 'Already solved. Play it again for fun.' : 'Already attempted. Try it again.', '');
}
function nextTraining() { startPuzzle(pickTraining(ROWS, S.rating, theme, new Set(S.recent), rand)); }

function streak() {
  let d = today(), n = 0; if (!S.daily[d]) d = addDays(d, -1);
  while (S.daily[d] && S.daily[d].solved) { n++; d = addDays(d, -1); }
  return n;
}
function renderHeader() {
  $('ratingPill').textContent = `${S.rating}`;
  $('streakPill').textContent = `${streak()} day${streak() === 1 ? '' : 's'}`;
}

// ---------- rush ----------
function rushIntro() {
  $('play').hidden = true; $('rushBar').hidden = false;
  $('rushBar').innerHTML = `<div class="card"><h2>Puzzle rush</h2><p>Three minutes. Puzzles start easy and get harder. Three wrong moves and you're out.</p>
    <p class="mute">Best: <b>${S.rushBest}</b></p><button class="primary" id="rushGo">Start</button></div>`;
  $('rushGo').onclick = rushStart;
}
function rushStart() {
  rush = { left: 180, score: 0, misses: 0, level: 600 };
  $('play').hidden = false;
  $('rushBar').innerHTML = `<div class="rushline"><span id="rTime" class="big">3:00</span><span id="rScore" class="big">0</span><span id="rMiss" aria-label="misses"></span></div>`;
  rushNext();
  rushTimer = setInterval(() => { rush.left--; $('rTime').textContent = fmt(Math.max(0, rush.left)); if (rush.left <= 0) rushEnd(); }, 1000);
  rushDraw();
}
function rushNext() { rush.level += 70; startPuzzle(pickTraining(ROWS, rush.level, 'all', new Set(), rand)); }
function rushDraw() { $('rScore').textContent = rush.score; $('rMiss').innerHTML = [0, 1, 2].map(i => `<i class="${i < rush.misses ? 'x' : ''}"></i>`).join(''); }
function rushSolved() { if (!rush) return; if (!failed) rush.score++; rushDraw(); setTimeout(() => rush && rushNext(), 350); }
function rushMiss() {
  if (!rush) return; rush.misses++; rushDraw();
  if (rush.misses >= 3) return rushEnd();
  done = true; setTimeout(() => rush && rushNext(), 700);
}
function rushEnd() {
  if (!rush) return;
  const sc = rush.score; stopRush();
  const best = sc > S.rushBest; S.rushBest = Math.max(S.rushBest, sc); S.rushHist.push(sc); S.rushHist = S.rushHist.slice(-100); save();
  $('play').hidden = true;
  $('rushBar').innerHTML = `<div class="card"><h2>${sc} solved</h2><p>${best ? 'New best.' : `Best is ${S.rushBest}.`}</p><button class="primary" id="rushGo">Go again</button></div>`;
  $('rushGo').onclick = rushStart;
}
function stopRush() { clearInterval(rushTimer); rushTimer = null; rush = null; }

// ---------- stats ----------
function renderStats() {
  const solvedDays = Object.values(S.daily).filter(x => x.solved).length;
  const h = S.hist.slice(-60);
  const lo = Math.min(...h, S.rating) - 20, hi = Math.max(...h, S.rating) + 20;
  const pts = h.map((v, i) => `${(i / Math.max(1, h.length - 1)) * 100},${100 - ((v - lo) / (hi - lo)) * 100}`).join(' ');
  const themes = Object.entries(S.themes).filter(([, v]) => v[1] >= 3).map(([k, v]) => [k, v[0] / v[1], v[1]]).sort((a, b) => a[1] - b[1]);
  $('statsView').innerHTML = `<div class="nums"><div><b>${S.rating}</b><span>Rating</span></div><div><b>${S.games}</b><span>Rated puzzles</span></div><div><b>${streak()}</b><span>Daily streak</span></div><div><b>${S.rushBest}</b><span>Rush best</span></div></div>
    ${h.length > 1 ? `<h3>Rating, last ${h.length}</h3><svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><p class="mute">${lo + 20} to ${hi - 20}</p>` : '<p class="mute">Play rated puzzles in Train to build your rating chart.</p>'}
    ${themes.length ? `<h3>Weakest themes first</h3>${themes.slice(0, 8).map(([k, r, n]) => `<div class="trow"><span>${THEME_NAMES[k]}</span><span class="bar"><i style="width:${Math.round(r * 100)}%"></i></span><span>${Math.round(r * 100)}% of ${n}</span></div>`).join('')}` : ''}
    <p class="mute">${solvedDays} daily puzzle${solvedDays === 1 ? '' : 's'} solved. Progress stays on this device.</p>`;
}

// ---------- boot ----------
function wire() {
  cg = Chessground($('board'), {
    coordinates: true, animation: { enabled: true, duration: 220 }, premovable: { enabled: false },
    highlight: { lastMove: true, check: true }, draggable: { enabled: true, showGhost: true },
    movable: { free: false, showDests: true, events: { after: onUserMove } },
    drawable: { enabled: false, visible: true }
  });
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  $('prevDay').onclick = () => { if (date > LAUNCH) { date = addDays(date, -1); openDaily(); } };
  $('nextDay').onclick = () => { if (date < today()) { date = addDays(date, 1); openDaily(); } };
  $('hintBtn').onclick = hint; $('solBtn').onclick = showSolution; $('nextBtn').onclick = nextTraining;
  $('themes').innerHTML = THEMES.map(([k, n]) => `<button data-t="${k}" aria-pressed="${k === theme}">${n}</button>`).join('');
  $('themes').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; theme = b.dataset.t; document.querySelectorAll('#themes button').forEach(x => x.setAttribute('aria-pressed', x === b)); nextTraining(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
}

async function boot() {
  wire();
  let data = window.PUZZLE_DATA;
  if (!data) {
    try { data = await (await fetch('puzzles.json')).json(); }
    catch (e) { setStatus('Could not load puzzles. Check your connection and reload.', 'bad'); return; }
  }
  ROWS = data.rows; POOL = pickDailyPool(ROWS);
  const hot = window.claude && window.claude.hot;
  const start = d => setMode(d && ['daily', 'train', 'rush', 'stats'].includes(d.mode) ? d.mode : 'daily');
  if (hot && hot.snapshot) hot.snapshot(() => ({ mode }));
  if (hot && hot.ready) hot.ready(start); else start(hot && hot.data);
}
window.__dt = () => ({ id: P && P.id, sol, step, playerColor, done, mode });
boot();
