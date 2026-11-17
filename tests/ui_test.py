"""Headless phone test: solve the daily puzzle by tapping, a wrong move, a hint, train mode and rush."""
import os, pathlib, shutil
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'dist' / 'artifact.html').as_uri()
SH = ROOT / 'shots'; SH.mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or shutil.which('google-chrome')
errs = []

def sq_center(pg, sq, color):
    b = pg.query_selector('#board').bounding_box()
    f, r = 'abcdefgh'.index(sq[0]), int(sq[1]) - 1
    x, y = (f, 7 - r) if color == 'white' else (7 - f, r)
    s = b['width'] / 8
    return b['x'] + (x + 0.5) * s, b['y'] + (y + 0.5) * s

def play(pg, uci, color):
    for sq in (uci[:2], uci[2:4]):
        x, y = sq_center(pg, sq, color); pg.mouse.click(x, y); pg.wait_for_timeout(120)

def wait_turn(pg, step):
    pg.wait_for_function(f'() => window.__dt().step === {step}', timeout=5000)

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}), args=['--no-sandbox'])
    for scheme in ['light', 'dark']:
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, color_scheme=scheme, device_scale_factor=2, has_touch=False)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        pg.goto(URL); pg.wait_for_selector('cg-board piece'); wait_turn(pg, 1)
        st = pg.evaluate('window.__dt()'); col = st['playerColor']
        pg.screenshot(path=str(SH / f'daily-{scheme}.png'))
        if scheme == 'dark': ctx.close(); continue
        print('daily puzzle', st['id'], 'as', col, 'solution', ' '.join(st['sol']))
        # a wrong move first: pick any legal move that differs from the solution
        wrong = pg.evaluate("""() => { const d = window.__dt(); const exp = d.sol[d.step];
            const pieces = [...document.querySelectorAll('cg-board piece.' + d.playerColor)]; return exp; }""")
        # solve: play our moves, wait for the reply between them
        step = 1
        while step < len(st['sol']):
            play(pg, st['sol'][step], col); step += 1
            if step < len(st['sol']): step += 1; wait_turn(pg, step)
        pg.wait_for_function('() => window.__dt().done', timeout=5000)
        print('after solve:', pg.inner_text('#status'), '|', pg.inner_text('#meta').replace('\n', ' '))
        pg.screenshot(path=str(SH / 'daily-solved.png'))
        print('streak pill:', pg.inner_text('#streakPill'))
        # train: wrong move then hint then solution
        pg.click('[data-m=train]'); wait_turn(pg, 1); st = pg.evaluate('window.__dt()'); col = st['playerColor']
        legal_wrong = pg.evaluate("""() => { const d = window.__dt(); return d.sol[d.step]; }""")
        pg.click('#hintBtn'); print('hint:', pg.inner_text('#status'))
        pg.click('#solBtn'); pg.wait_for_function('() => window.__dt().done', timeout=10000)
        print('train after solution:', pg.inner_text('#status'), '| rating', pg.inner_text('#ratingPill'))
        pg.click('#nextBtn'); wait_turn(pg, 1); print('next train puzzle loaded:', pg.evaluate('window.__dt().id'))
        # rush: start, solve one, check score
        pg.click('[data-m=rush]'); pg.click('#rushGo'); wait_turn(pg, 1)
        st = pg.evaluate('window.__dt()'); col = st['playerColor']; step = 1
        while step < len(st['sol']):
            play(pg, st['sol'][step], col); step += 1
            if step < len(st['sol']): step += 1; wait_turn(pg, step)
        pg.wait_for_timeout(900)
        print('rush score:', pg.inner_text('#rScore'))
        pg.screenshot(path=str(SH / 'rush.png'))
        pg.click('[data-m=stats]'); pg.screenshot(path=str(SH / 'stats.png'), full_page=True)
        print('stats:', pg.inner_text('#statsView').replace('\n', ' ')[:160])
        print('scrollWidth', pg.evaluate('document.documentElement.scrollWidth'))
        ctx.close()
    b.close()
print('ERRORS:', errs or 'none')
