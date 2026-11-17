// Build Daily Tactics.
//   dist/artifact.html  single self-contained page with inline puzzle data
//   dist/web/           installable web app (PWA); puzzles.json fetched at runtime
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const r = p => readFileSync(p, 'utf8');
const cgDir = 'node_modules/@lichess-org/chessground/assets/';
const cgCss = ['chessground.base.css', 'chessground.brown.css', 'chessground.cburnett.css'].map(f => r(cgDir + f)).join('\n');
const out = await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'iife', write: false, target: ['es2020'], legalComments: 'inline' });
const bundle = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = r('src/app.html').replace('/*CG_CSS*/', () => cgCss);

// Full data if the monthly job has produced it, otherwise the development sample.
const dataPath = existsSync('docs/puzzles.json') ? 'docs/puzzles.json' : 'src/puzzles.sample.json';
const data = JSON.parse(r(dataPath));

rmSync('dist', { recursive: true, force: true }); mkdirSync('dist/web/icons', { recursive: true });
// The artifact keeps a lighter subset so the page stays small.
const sub = { ...data, rows: data.rows.filter((_, i) => i % Math.max(1, Math.ceil(data.rows.length / 3000)) === 0) };
writeFileSync('dist/artifact.html', tpl.replace('<!--PWA_LINKS-->', '')
  .replace('<!--DATA-->', () => `<script>window.PUZZLE_DATA=${JSON.stringify(sub)}</script>`)
  .replace('<!--BUNDLE-->', () => `<script>${bundle}</script>`));

const links = '<link rel="manifest" href="manifest.json">\n<link rel="apple-touch-icon" href="icons/icon-180.png">\n<link rel="icon" href="icons/icon-192.png">';
const sw = `<script>if('serviceWorker' in navigator){try{navigator.serviceWorker.register('sw.js').catch(function(){})}catch(e){}}</script>`;
writeFileSync('dist/web/index.html', tpl.replace('<!--PWA_LINKS-->', links).replace('<!--DATA-->', '').replace('<!--BUNDLE-->', () => `<script>${bundle}</script>\n${sw}`));
writeFileSync('dist/web/puzzles.json', JSON.stringify(data));
writeFileSync('dist/web/manifest.json', JSON.stringify({
  name: 'Daily Tactics', short_name: 'Tactics', description: 'A daily chess puzzle, rated training and puzzle rush.',
  start_url: './', scope: './', display: 'standalone', background_color: '#fbf7f1', theme_color: '#2b2118',
  icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
}, null, 2));
writeFileSync('dist/web/sw.js', `// Offline cache for Daily Tactics. Bump VERSION when you ship changes.
const VERSION = 'dt-v1';
const FILES = ['./', './index.html', './puzzles.json', './manifest.json', './icons/icon-192.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
`);
execSync('python3 scripts/icons.py dist/web/icons', { stdio: 'inherit' });
console.log(`built from ${dataPath}: ${data.rows.length} puzzles (artifact ${sub.rows.length}), bundle ${(bundle.length / 1024).toFixed(0)} KB`);
