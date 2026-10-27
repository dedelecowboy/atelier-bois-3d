"""Paquetage unique « Atelier bois 3D » (dist/Atelier_bois_3D_SCORM12*.zip) :
- manifeste : atelier (asset, non noté) + 7 machines (SCO), lib partagée, verrous de la chaîne de débit (ou aucun) ;
- dans un faux lecteur Moodle (sommaire + cadre + API SCORM 1.2) : « ← Atelier » depuis une machine,
  « Ouvrir la machine » depuis l'atelier, bilan de la machine relu par l'atelier."""
import asyncio, os, sys, zipfile, re, tempfile, mimetypes
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import check, run, CHROMIUM, ROOT
from playwright.async_api import async_playwright

NS = {'c': 'http://www.imsproject.org/xsd/imscp_rootv1p1p2', 'a': 'http://www.adlnet.org/xsd/adlcp_rootv1p2'}
A = '{http://www.adlnet.org/xsd/adlcp_rootv1p2}'
ORDER = ['scie-radiale', 'deligneuse', 'degauchisseuse', 'raboteuse', 'toupie', 'tenonneuse', 'scie-format']

def manifest(zp, lock):
    z = zipfile.ZipFile(zp); names = set(z.namelist())
    m = ET.fromstring(z.read('imsmanifest.xml'))
    items = m.findall('.//c:organization/c:item', NS); res = {r.get('identifier'): r for r in m.findall('.//c:resource', NS)}
    check(len(items) == 8 and items[0].find('c:title', NS).text == 'Atelier', f'{os.path.basename(zp)} : 8 éléments, l\'atelier en premier')
    kinds = [res[i.get('identifierref')].get(A + 'scormtype') for i in items]
    check(kinds == ['asset'] + ['sco'] * 7, 'atelier « asset » (non noté), 7 machines « sco »')
    hrefs = [res[i.get('identifierref')].get('href') for i in items]
    check(hrefs == ['atelier/index.html'] + [f'{m}/index.html' for m in ORDER] and all(h in names for h in hrefs), 'une page par élément, dans l\'ordre de la chaîne de débit')
    files = [f.get('href') for r in res.values() for f in r.findall('c:file', NS)]
    check(all(f in names for f in files) and 'lib/three.module.js' in names, 'tous les fichiers déclarés sont dans le zip, three.js une seule fois')
    pre = [i.find('a:prerequisites', NS) for i in items]
    pre = [p.text if p is not None else None for p in pre]
    ids = [i.get('identifier') for i in items]
    if lock: check(pre[1] is None and pre[7] is None and all(pre[k] == ids[k - 1] for k in range(2, 7)), 'verrous : chaque machine de la chaîne demande la précédente, scie à format libre')
    else: check(all(p is None for p in pre), 'sans verrous')
    check(b'masteryscore' not in z.read('imsmanifest.xml'), 'pas de masteryscore (le module pose passed / failed)')
    for mid in ORDER:
        h = z.read(f'{mid}/index.html').decode('utf-8')
        check('window.PARCOURS=true' in h and 'window.ATELIER_PKG=' in h and '"three":"../lib/three.module.js"' in h, f'{mid} : parcours évalué, paquetage, three.js local') if mid == 'raboteuse' else None
    return z

# faux lecteur Moodle : sommaire (liens = titres des éléments), cadre du contenu, API SCORM 1.2 par élément
PLAYER = """<!doctype html><html><head><meta charset="utf-8"><script>
window.__log=[]; window.__cur=null; const S={};
window.API={LMSInitialize(){__log.push('init:'+__cur);return 'true'},LMSFinish(){__log.push('finish:'+__cur);return 'true'},LMSCommit(){return 'true'},
 LMSGetValue(k){return (S[__cur]||{})[k]??''},LMSSetValue(k,v){(S[__cur]=S[__cur]||{})[k]=v;return 'true'},LMSGetLastError(){return '0'},LMSGetErrorString(){return ''},LMSGetDiagnostic(){return ''}};
window.__S=S;
function go(href,t){ __cur=t; document.getElementById('scorm_object').src='pkg/'+href; }
</script></head><body style="margin:0;display:flex;height:100vh">
<div id="scorm_toc" style="width:180px;font:12px sans-serif">%TOC%</div>
<iframe id="scorm_object" style="flex:1;border:0" src="about:blank"></iframe></body></html>"""

async def main():
    z = manifest(os.path.join(ROOT, 'dist', 'Atelier_bois_3D_SCORM12.zip'), True)
    manifest(os.path.join(ROOT, 'dist', 'Atelier_bois_3D_SCORM12_sans_verrous.zip'), False)
    m = ET.fromstring(z.read('imsmanifest.xml')); res = {r.get('identifier'): r.get('href') for r in m.findall('.//c:resource', NS)}
    toc = ''.join(f'<p><a href="#" onclick="go(\'{res[i.get("identifierref")]}\',\'{i.get("identifier")}\');return false">{i.find("c:title", NS).text}</a></p>'
                  for i in m.findall('.//c:organization/c:item', NS))
    page = PLAYER.replace('%TOC%', toc)
    print('Faux lecteur Moodle')
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await br.new_page(viewport={'width': 1400, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        async def route(r):
            u = r.request.url
            if u == 'http://local/': return await r.fulfill(body=page, content_type='text/html')
            if u.startswith('http://local/pkg/'):
                n = u.split('http://local/pkg/')[1].split('?')[0]
                if n in z.namelist(): return await r.fulfill(body=z.read(n), content_type=mimetypes.guess_type(n)[0] or 'application/octet-stream')
                return await r.fulfill(status=404, body='')
            await r.abort()
        await pg.route('**/*', route)
        await pg.goto('http://local/')
        fr = lambda: pg.frame_locator('#scorm_object')
        async def frame_ready():
            for _ in range(80):
                f = pg.frames[1] if len(pg.frames) > 1 else None
                try:
                    if f and await f.evaluate('!!window.__ready'): return f
                except Exception: pass
                await pg.wait_for_timeout(500)
            raise AssertionError('le contenu ne démarre pas : ' + '; '.join(errs))
        # 1. la raboteuse depuis le sommaire
        await pg.click('text=4. Raboteuse'); f = await frame_ready()
        b = await f.evaluate("()=>{ const b=document.getElementById('toAtelier'); return b && !b.hidden && b.textContent; }")
        check(b == '← Atelier', 'raboteuse : bouton « ← Atelier » visible')
        check('init:ITEM_RABOTEUSE' in await pg.evaluate('__log'), 'la raboteuse s\'est connectée à l\'API SCORM')
        # choix à l'entrée : s'entraîner (rien d'enregistré) ou passer l'évaluation
        ch = await f.evaluate("()=>({ choice:!document.getElementById('choice').hidden, ui:document.getElementById('app').dataset.ui })")
        check(ch['choice'], 'choix « S\'entraîner » / « Passer l\'évaluation » à l\'entrée')
        n0 = await pg.evaluate("Object.keys(__S['ITEM_RABOTEUSE']||{}).length")
        await f.evaluate("()=>document.getElementById('chTrain').click()"); await pg.wait_for_timeout(500)
        tr = await f.evaluate("()=>({ ui:document.getElementById('app').dataset.ui, sw:document.getElementById('modeSwitch').textContent, modes:getComputedStyle(document.querySelector('.seg2')).display })")
        check(tr['ui'] == 'pres' and tr['sw'] == "Passer l'évaluation" and tr['modes'] != 'none', 'entraînement : présentation et exercices guidés, bouton « Passer l\'évaluation »')
        await f.evaluate("()=>{ document.getElementById('ui-ex').click(); document.querySelector('[data-mode]:not([data-mode=libre])')?.click(); }"); await pg.wait_for_timeout(400)
        n1 = await pg.evaluate("Object.keys(__S['ITEM_RABOTEUSE']||{}).length")
        check(n1 == n0, f'entraînement : rien d\'enregistré dans Moodle ({n0} valeurs avant et après)')
        await f.evaluate("()=>document.getElementById('modeSwitch').click()"); await pg.wait_for_timeout(500)
        ev = await f.evaluate("()=>({ ui:document.getElementById('app').dataset.ui, rep:!document.getElementById('repBar').hidden, sw:document.getElementById('modeSwitch').textContent })")
        check(ev['ui'] == 'parcours' and ev['rep'] and ev['sw'] == "S'entraîner", 'évaluation : parcours au repérage, bouton « S\'entraîner »')
        await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'paquet_raboteuse_eval.png'))
        # plein écran : le lecteur entier, qui le reste en changeant d'élément
        await pg.frame_locator('#scorm_object').locator('#fs').click(); await pg.wait_for_timeout(500)
        check(await pg.evaluate('!!document.fullscreenElement'), 'plein écran : le lecteur Moodle entier (sommaire + contenu)')
        # bilan local comme à la fin d'un parcours réussi
        await f.evaluate("()=>localStorage.setItem('atelier.bilan.raboteuse', JSON.stringify({total:94, passed:true, date:'27/10/2026 18:40'}))")
        # 2. retour à l'atelier
        await f.evaluate("()=>document.getElementById('toAtelier').click()"); await pg.wait_for_timeout(500); f = await frame_ready()
        check((await f.evaluate('location.pathname')).endswith('/atelier/index.html'), '« ← Atelier » ouvre l\'élément Atelier du sommaire')
        log = await pg.evaluate('__log'); check('finish:ITEM_RABOTEUSE' in log, 'la raboteuse a fermé sa session SCORM en partant')
        check(await pg.evaluate('!!document.fullscreenElement'), 'toujours en plein écran après le retour à l\'atelier')
        await pg.evaluate('document.exitFullscreen()'); await pg.wait_for_timeout(300)
        st = await f.evaluate("()=>({ edit:document.getElementById('editBtn').hidden, rab:document.querySelector('#postes [data-id=raboteuse]').textContent, done:document.querySelector('#postes [data-id=raboteuse]').dataset.done })")
        check(st['edit'] and 'validée · 94' in st['rab'] and st['done'] == 'true', f'atelier : modification cachée, raboteuse « validée · 94 »')
        await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'paquet_atelier.png'))
        # 3. ouvrir une machine depuis l'atelier
        await f.evaluate("()=>document.querySelector('#postes [data-id=toupie]').click()"); await pg.wait_for_timeout(1300)
        await f.evaluate("()=>document.getElementById('cardGo').click()"); await pg.wait_for_timeout(500); f = await frame_ready()
        check((await f.evaluate('location.pathname')).endswith('/toupie/index.html'), '« Ouvrir la machine » ouvre l\'élément Toupie du sommaire')
        await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'paquet_toupie.png'))
        real = [e for e in errs if 'context' not in e.lower()]
        check(not real, 'aucune erreur JavaScript' + (' : ' + '; '.join(real) if real else ''))
        await br.close()

if __name__ == '__main__': run(main)
