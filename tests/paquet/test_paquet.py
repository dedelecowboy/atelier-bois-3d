"""Paquetage unique « Atelier bois 3D » (dist/Atelier_bois_3D_SCORM12*.zip) :
- manifeste : atelier (SCO toujours « incomplete ») + « 0. Risques généraux » + 7 machines (SCO), lib partagée,
  verrous : risques généraux avant la scie radiale et la scie à format, puis la chaîne de débit (ou aucun) ;
- dans un faux lecteur Moodle (sommaire + cadre + API SCORM 1.2) : « ← Atelier » depuis une machine,
  « Ouvrir la machine » et « Ouvrir le module » (risques généraux) depuis l'atelier, bilan de la machine relu par l'atelier,
  verrous lus dans le sommaire."""
import asyncio, os, sys, zipfile, re, tempfile, mimetypes
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import check, run, CHROMIUM, ROOT
from playwright.async_api import async_playwright

NS = {'c': 'http://www.imsproject.org/xsd/imscp_rootv1p1p2', 'a': 'http://www.adlnet.org/xsd/adlcp_rootv1p2'}
A = '{http://www.adlnet.org/xsd/adlcp_rootv1p2}'
ORDER = ['risques', 'scie-radiale', 'deligneuse', 'degauchisseuse', 'raboteuse', 'toupie', 'tenonneuse', 'scie-format']

def manifest(zp, lock):
    z = zipfile.ZipFile(zp); names = set(z.namelist())
    m = ET.fromstring(z.read('imsmanifest.xml'))
    items = m.findall('.//c:organization/c:item', NS); res = {r.get('identifier'): r for r in m.findall('.//c:resource', NS)}
    check(len(items) == 9 and items[0].find('c:title', NS).text == 'Atelier', f'{os.path.basename(zp)} : 9 éléments, l\'atelier en premier')
    titles = [i.find('c:title', NS).text for i in items]
    check(titles[1] == '0. Risques généraux' and titles[2] == '1. Scie radiale' and titles[8] == '7. Scie à format', 'titres : « 0. Risques généraux », machines numérotées de 1 à 7 comme avant')
    kinds = [res[i.get('identifierref')].get(A + 'scormtype') for i in items]
    check(kinds == ['sco'] * 9, 'atelier, risques généraux et 7 machines « sco » (Moodle ne lance pas un asset de lui-même)')
    hrefs = [res[i.get('identifierref')].get('href') for i in items]
    check(hrefs == ['atelier/index.html'] + [f'{m}/index.html' for m in ORDER] and all(h in names for h in hrefs), 'une page par élément : risques généraux, puis la chaîne de débit')
    files = [f.get('href') for r in res.values() for f in r.findall('c:file', NS)]
    check(all(f in names for f in files) and 'lib/three.module.js' in names, 'tous les fichiers déclarés sont dans le zip, three.js une seule fois')
    pre = [i.find('a:prerequisites', NS) for i in items]
    pre = [p.text if p is not None else None for p in pre]
    ids = [i.get('identifier') for i in items]
    if lock: check(pre[1] is None and pre[2] == ids[1] and pre[8] == ids[1] and all(pre[k] == ids[k - 1] for k in range(3, 8)), 'verrous : risques généraux avant la scie radiale et la scie à format, puis chaque machine de la chaîne demande la précédente')
    else: check(all(p is None for p in pre), 'sans verrous')
    check(b'masteryscore' not in z.read('imsmanifest.xml'), 'pas de masteryscore (le module pose passed / failed)')
    for mid in ORDER:
        h = z.read(f'{mid}/index.html').decode('utf-8')
        check('window.PARCOURS=true' in h and 'window.ATELIER_PKG=' in h and '"three":"../lib/three.module.js"' in h, f'{mid} : parcours évalué, paquetage, three.js local') if mid in ('raboteuse', 'risques') else None
    return z

# faux lecteur Moodle : sommaire (liens = titres des éléments), cadre du contenu, API SCORM 1.2 par élément
PLAYER = """<!doctype html><html><head><meta charset="utf-8"><script>
window.__log=[]; window.__cur=null; const S={};
window.API={LMSInitialize(){__log.push('init:'+__cur);return 'true'},LMSFinish(){__log.push('finish:'+__cur);return 'true'},LMSCommit(){return 'true'},
 LMSGetValue(k){return (S[__cur]||{})[k]??''},LMSSetValue(k,v){(S[__cur]=S[__cur]||{})[k]=v;return 'true'},LMSGetLastError(){return '0'},LMSGetErrorString(){return ''},LMSGetDiagnostic(){return ''}};
window.__S=S;
function go(href,t){ __cur=t; document.getElementById('scorm_object').src='pkg/'+href; }
/* comme Moodle 4 (arbre du sommaire) : icône Font Awesome, titre et note dans le même lien */
function setSt(title,fa,label,score){ const a=[...document.querySelectorAll('#scorm_toc a')].find(a=>a.textContent.includes(title));
  a.innerHTML='<i class="icon fa '+fa+' fa-fw" title="'+label+'" aria-label="'+label+'" role="img"></i>&nbsp;'+title+'&nbsp;'+(score!=null?'(Score&nbsp;: '+score+')':''); }
</script></head><body style="margin:0;display:flex;height:100vh">
<div id="scorm_toc" style="width:180px;font:12px sans-serif">%TOC%</div>
<iframe id="scorm_object" style="flex:1;border:0" src="about:blank"></iframe></body></html>"""

async def main():
    zl = manifest(os.path.join(ROOT, 'dist', 'Atelier_bois_3D_SCORM12.zip'), True)
    z = manifest(os.path.join(ROOT, 'dist', 'Atelier_bois_3D_SCORM12_sans_verrous.zip'), False)
    def player(zz, enforce=True):
        # comme Moodle : un élément dont le prérequis n'est pas rempli est affiché sans lien dans le sommaire (enforce),
        # sinon tout est cliquable et chaque élément a son icône de statut (Non tenté)
        m = ET.fromstring(zz.read('imsmanifest.xml')); res = {r.get('identifier'): r.get('href') for r in m.findall('.//c:resource', NS)}
        if enforce:
            toc = ''.join((f'<p><span>{i.find("c:title", NS).text}</span></p>' if i.find('a:prerequisites', NS) is not None else
                           f'<p><a href="#" onclick="go(\'{res[i.get("identifierref")]}\',\'{i.get("identifier")}\');return false">{i.find("c:title", NS).text}</a></p>')
                          for i in m.findall('.//c:organization/c:item', NS))
        else:   # balisage réel de Moodle 4 (arbre) : <a data-scoid title=url><i class="icon fa …" title="Non tenté"></i>&nbsp;Titre&nbsp;(Score : 96)</a>, sans href
            toc = '<ul>' + ''.join(f'<li><a data-scoid="{k}" title="&scoid={k}" onclick="go(\'{res[i.get("identifierref")]}\',\'{i.get("identifier")}\')"><i class="icon fa fa-regular fa-square fa-fw" title="Non tenté" aria-label="Non tenté" role="img"></i>&nbsp;{i.find("c:title", NS).text}&nbsp;</a></li>'
                                   for k, i in enumerate(m.findall('.//c:organization/c:item', NS))) + '</ul>'
        return PLAYER.replace('%TOC%', toc)
    pages = { 'http://local/': player(z), 'http://local/verrous': player(zl), 'http://local/verrous-libres': player(zl, False) }
    print('Faux lecteur Moodle')
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await br.new_page(viewport={'width': 1400, 'height': 820}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        async def route(r):
            u = r.request.url
            if u in pages: return await r.fulfill(body=pages[u], content_type='text/html')
            if u.startswith('http://local/pkg/'):
                n = u.split('http://local/pkg/')[1].split('?')[0]; zz = zl if 'verrous' in (r.request.frame.parent_frame.url if r.request.frame.parent_frame else '') else z
                if n in zz.namelist(): return await r.fulfill(body=zz.read(n), content_type=mimetypes.guess_type(n)[0] or 'application/octet-stream')
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
        check(await pg.evaluate("(__S['ITEM_ATELIER']||{})['cmi.core.lesson_status']") == 'incomplete', 'atelier : élément suivi, toujours « incomplete » (ouvert en premier, non compté)')
        await pg.evaluate('document.exitFullscreen()'); await pg.wait_for_timeout(300)
        st = await f.evaluate("()=>({ edit:document.getElementById('editBtn').hidden, rab:document.querySelector('#postes [data-id=raboteuse]').textContent, done:document.querySelector('#postes [data-id=raboteuse]').dataset.done })")
        check(st['edit'] and 'validée · 94' in st['rab'] and st['done'] == 'true', f'atelier : modification cachée, raboteuse « validée · 94 »')
        await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'paquet_atelier.png'))
        # 3. ouvrir une machine depuis l'atelier
        await f.evaluate("()=>document.querySelector('#postes [data-id=toupie]').click()"); await pg.wait_for_timeout(1300)
        await f.evaluate("()=>document.getElementById('cardGo').click()"); await pg.wait_for_timeout(500); f = await frame_ready()
        check((await f.evaluate('location.pathname')).endswith('/toupie/index.html'), '« Ouvrir la machine » ouvre l\'élément Toupie du sommaire')
        check('finish:ITEM_ATELIER' in await pg.evaluate('__log'), 'l\'atelier a fermé sa session en partant')
        await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'paquet_toupie.png'))
        # 3 bis. le module « Risques généraux » depuis l'atelier (tête de liste, sans poste dans la salle)
        await pg.click('text=Atelier'); await pg.wait_for_function("document.getElementById('scorm_object').contentWindow.location.pathname.includes('atelier')"); await pg.wait_for_timeout(300); f = await frame_ready()
        await f.evaluate("()=>document.querySelector('#postes [data-id=risques]').click()"); await pg.wait_for_timeout(400)
        rk = await f.evaluate("()=>({ first:document.querySelector('#postes button').dataset.id, card:document.getElementById('card').textContent, go:!!document.getElementById('cardGo') })")
        check(rk['first'] == 'risques' and 'Risques généraux' in rk['card'] and rk['go'], 'atelier : « 0 Risques généraux » en tête de liste, fiche avec « Ouvrir le module »')
        await f.evaluate("()=>document.getElementById('cardGo').click()"); await pg.wait_for_timeout(500); f = await frame_ready()
        check((await f.evaluate('location.pathname')).endswith('/risques/index.html'), '« Ouvrir le module » ouvre l\'élément « 0. Risques généraux »')
        ch = await f.evaluate("()=>({ choice:!document.getElementById('choice').hidden, back:!document.getElementById('toAtelier').hidden })")
        check(ch['choice'] and ch['back'], 'risques généraux : choix entraînement / évaluation et « ← Atelier »')
        await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'paquet_risques.png'))
        # verrous : version avec verrous, l'atelier lit le sommaire (élément sans lien = verrouillé)
        await pg.goto('http://local/verrous'); await pg.click('text=Atelier'); f = await frame_ready(); await pg.wait_for_timeout(500)
        lk = await f.evaluate("()=>Object.fromEntries([...document.querySelectorAll('#postes button')].map(b=>[b.dataset.id,b.dataset.locked]))")
        check(all(lk[m] == 'true' for m in ORDER[1:]) and lk['risques'] in (None, 'false'),
              'verrous : les 7 machines verrouillées tant que « Risques généraux » n\'est pas réussi, le module risques ouvert')
        await f.evaluate("()=>document.querySelector('#postes [data-id=\"scie-radiale\"]').click()"); await pg.wait_for_timeout(1300)
        msg = await f.evaluate("()=>({ m:document.querySelector('#card .lockmsg')?.textContent||'', go:!!document.getElementById('cardGo') })")
        check('Risques généraux' in msg['m'] and not msg['go'], f'scie radiale verrouillée : {msg["m"].strip()}')
        await f.evaluate("()=>document.querySelector('#postes [data-id=deligneuse]').click()"); await pg.wait_for_timeout(1300)
        msg = await f.evaluate("()=>({ m:document.querySelector('#card .lockmsg')?.textContent||'', go:!!document.getElementById('cardGo') })")
        check('Scie radiale' in msg['m'] and not msg['go'], f'fiche verrouillée : {msg["m"].strip()}')
        await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'paquet_verrous.png'))
        # Moodle qui n'applique pas les prérequis : le paquetage verrouille lui-même d'après les statuts du sommaire
        await pg.goto('http://local/verrous-libres'); await pg.click('text=Atelier'); f = await frame_ready(); await pg.wait_for_timeout(500)
        lk = await f.evaluate("()=>Object.fromEntries([...document.querySelectorAll('#postes button')].map(b=>[b.dataset.id,b.dataset.locked]))")
        check(lk['scie-radiale'] == 'true' and lk['deligneuse'] == 'true' and lk['scie-format'] == 'true', 'prérequis non appliqués par Moodle : l\'atelier verrouille d\'après le statut « Non tenté » des risques généraux et de la scie radiale')
        await pg.click('text=1. Scie radiale'); await pg.wait_for_function("document.getElementById('scorm_object').contentWindow.location.pathname.includes('scie-radiale')"); await pg.wait_for_timeout(300); f = await frame_ready()
        ev = await f.evaluate("()=>({ dis:document.getElementById('chEval').disabled, t:document.getElementById('chEvalS').textContent })")
        check(ev['dis'] and 'Risques généraux' in ev['t'], 'scie radiale ouverte par le sommaire : évaluation verrouillée tant que « Risques généraux » n\'est pas réussi')
        await pg.evaluate("const im=[...document.querySelectorAll('#scorm_toc p')].find(p=>p.textContent.includes('0. Risques généraux')).querySelector('img'); im.alt='Réussi'; im.setAttribute('src','pix/passed.png')")
        await pg.click('text=Atelier'); await pg.wait_for_function("document.getElementById('scorm_object').contentWindow.location.pathname.includes('atelier')")
        await pg.click('text=1. Scie radiale'); await pg.wait_for_function("document.getElementById('scorm_object').contentWindow.location.pathname.includes('scie-radiale')"); await pg.wait_for_timeout(300); f = await frame_ready()
        check(not await f.evaluate("document.getElementById('chEval').disabled"), 'risques généraux réussis : évaluation de la scie radiale ouverte')
        await pg.click('text=2. Déligneuse multilames'); await pg.wait_for_function("document.getElementById('scorm_object').contentWindow.location.pathname.includes('deligneuse')"); await pg.wait_for_timeout(300); f = await frame_ready()
        ev = await f.evaluate("()=>({ dis:document.getElementById('chEval').disabled, t:document.getElementById('chEvalS').textContent, tr:!document.getElementById('chTrain').disabled })")
        check(ev['dis'] and 'Scie radiale' in ev['t'] and ev['tr'], 'déligneuse ouverte par le sommaire : évaluation verrouillée, entraînement possible')
        await pg.evaluate("setSt('1. Scie radiale','fa-check','Réussi',null)")
        await pg.click('text=Atelier'); await pg.wait_for_function("document.getElementById('scorm_object').contentWindow.location.pathname.includes('atelier')")
        await pg.click('text=2. Déligneuse multilames'); await pg.wait_for_function("document.getElementById('scorm_object').contentWindow.location.pathname.includes('deligneuse')"); await pg.wait_for_timeout(300); f = await frame_ready()
        check(not await f.evaluate("document.getElementById('chEval').disabled"), 'scie radiale réussie (icône Moodle 4) : évaluation de la déligneuse ouverte')
        # paquetage mis à jour, autre navigateur : rien dans localStorage, l'atelier lit le statut et la note du sommaire
        await pg.evaluate("setSt('1. Scie radiale','fa-check','Réussi',100)")
        await pg.click('text=Atelier'); await pg.wait_for_function("document.getElementById('scorm_object').contentWindow.location.pathname.includes('atelier')")
        f = await frame_ready(); await f.evaluate("()=>localStorage.clear()"); await f.evaluate("()=>location.reload()"); await pg.wait_for_timeout(500); f = await frame_ready(); await pg.wait_for_timeout(1800)
        st = await f.evaluate("()=>Object.fromEntries([...document.querySelectorAll('#postes button')].map(b=>[b.dataset.id, b.querySelector('.st')?.textContent+'|'+b.dataset.done+'|'+b.dataset.locked]))")
        check(st['scie-radiale'] == 'validée · 100|true|false' and st['deligneuse'].startswith('à faire|false|false'), f'sans bilan dans le navigateur : état lu dans le sommaire (radiale {st["scie-radiale"]}, déligneuse {st["deligneuse"]})')
        await pg.evaluate("setSt('2. Déligneuse multilames','fa-check','',88)")
        await pg.wait_for_timeout(1200)
        st = await f.evaluate("()=>[...document.querySelectorAll('#postes button')].map(b=>b.dataset.id+':'+(b.querySelector('.st')?.textContent||'')+':'+b.dataset.locked).join(' ')")
        check('deligneuse:validée · 88:false' in st and 'degauchisseuse:à faire:false' in st, 'sommaire mis à jour par Moodle pendant que l\'atelier est ouvert : états relus')
        real = [e for e in errs if 'context' not in e.lower()]
        check(not real, 'aucune erreur JavaScript' + (' : ' + '; '.join(real) if real else ''))
        await br.close()

if __name__ == '__main__': run(main)
