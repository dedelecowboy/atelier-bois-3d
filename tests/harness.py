"""Banc d'essai commun à toutes les machines.

Ouvre une page fabriquée (dist/<machine>.html) dans chromium headless (swiftshader), sert three.js
depuis node_modules au lieu du CDN, et peut simuler Moodle (fausse API SCORM 1.2).
En headless, les pertes de contexte WebGL et les captures lentes ne sont pas des bugs utilisateur.
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
THREE = os.path.join(ROOT, 'node_modules', 'three')
OUT = os.path.join(ROOT, 'tests', 'out')
CHROMIUM = '/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None

def dist(machine):
    p = os.path.join(ROOT, 'dist', machine + '.html')
    if not os.path.exists(p): sys.exit(f'{p} absent : lancez « npm run build » avant les tests.')
    return p

# Fausse API SCORM : garde les valeurs dans window.__store, journal des appels dans window.__log.
def scorm_mock(suspend=''):
    return """<script>window.PARCOURS=true; window.__log=[]; window.__store={'cmi.core.lesson_status':'not attempted','cmi.suspend_data':%s,'cmi.interactions._count':'0'};
window.API={LMSInitialize(){__log.push('init');return 'true'},LMSFinish(){__log.push('finish');return 'true'},LMSCommit(){__log.push('commit');return 'true'},
LMSGetValue(k){return __store[k]??''},LMSSetValue(k,v){__store[k]=v; const m=k.match(/^cmi\\.interactions\\.(\\d+)\\.id$/); if(m) __store['cmi.interactions._count']=String(+m[1]+1); if(!k.startsWith('cmi.interactions')&&k!=='cmi.suspend_data') __log.push(k+'='+v); return 'true'},
LMSGetLastError(){return '0'},LMSGetErrorString(){return ''},LMSGetDiagnostic(){return ''}};</script>""" % json.dumps(suspend)

# Outils JS disponibles dans chaque script de test (voir js()).
HELPERS = r"""
 const $=id=>document.getElementById(id), sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const setR=(id,v)=>{ const e=$(id); e.value=v; e.dispatchEvent(new Event('input')); };
 const setN=(id,v)=>{ const e=$(id); e.value=v; e.dispatchEvent(new Event('change')); };
 const op=o=>document.querySelector(`[data-op=${o}]`).click();
 const checks=()=>[...document.querySelectorAll('#stepChecks li')].map(l=>(l.dataset.ok==='true'?'✓ ':'✗ ')+l.textContent);
 const ok=i=>checks()[i]?.startsWith('✓');
 const alerts=()=>[...document.querySelectorAll('#alerts li')].map(l=>l.dataset.l+': '+l.textContent);
 const state=(tag)=>({tag, step:$('stepN').textContent+' '+$('stepT').textContent, checks:checks(), ok:!$('stepOk').hidden, alerts:alerts()});
 const results=()=>[...document.querySelectorAll('#stepRes tr')].map(r=>[...r.cells].map(c=>c.textContent));
"""
def js(body):
    return 'async () => {' + HELPERS + body + '}'

class Page:
    """async with Page('scie-format', scorm=True) as pg: await pg.eval(js('…'))"""
    def __init__(self, machine, scorm=False, suspend='', viewport=(1400, 820), touch=False):
        self.machine, self.scorm, self.suspend, self.viewport, self.touch = machine, scorm, suspend, viewport, touch
        self.errors, self.logs = [], []
    async def __aenter__(self):
        html = open(dist(self.machine), encoding='utf-8').read()
        head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' + (scorm_mock(self.suspend) if self.scorm else '')
        page_html = '<!doctype html><html lang="fr"><head>' + head + '</head><body>' + html + '</body></html>'
        self.pw = await async_playwright().start()
        self.browser = await self.pw.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        w, h = self.viewport
        self.page = await self.browser.new_page(viewport={'width': w, 'height': h}, has_touch=self.touch, is_mobile=self.touch)
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('console', lambda m: self.logs.append(m.text) if m.type == 'error' else None)
        async def route(r):
            u = r.request.url
            if 'cdn.jsdelivr.net/npm/three@0.160.0/' in u:
                await r.fulfill(path=os.path.join(THREE, u.split('three@0.160.0/')[1]), content_type='application/javascript')
            elif u.startswith('http://local/'): await r.fulfill(body=page_html, content_type='text/html')
            else: await r.abort()   # polices Google, etc. : sans objet hors ligne
        await self.page.route('**/*', route)
        await self.page.goto('http://local/')
        try: await self.page.wait_for_function('window.__ready', timeout=30000)
        except Exception: raise AssertionError('la page ne démarre pas : ' + '; '.join(self.errors + self.logs))
        await self.page.wait_for_timeout(800)
        return self
    async def eval(self, expr, *a): return await self.page.evaluate(expr, *a)
    async def shot(self, name):
        os.makedirs(OUT, exist_ok=True); p = os.path.join(OUT, name)
        await self.page.screenshot(path=p); return p
    async def __aexit__(self, *exc):
        try: await asyncio.wait_for(self.browser.close(), 20)
        except Exception: pass
        try: await asyncio.wait_for(self.pw.stop(), 20)
        except Exception: pass
        real = [e for e in self.errors if 'context' not in e.lower()]
        if real and exc[0] is None: raise AssertionError('erreurs JavaScript : ' + '; '.join(real))

def check(cond, msg):
    if not cond: raise AssertionError(msg)
    print('  ✓', msg)

def run(main):
    try: asyncio.run(main())
    except AssertionError as e: print('  ✗', e); sys.exit(1)
