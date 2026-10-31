# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Permis machine (demandé par l'enseignant le 31/10/2026, engine/permis.js) :
1. paquetage unique dans un faux lecteur Moodle : machines validées (statut du sommaire) → badge posé sur le poste et dans
   « Mon permis machine » ; machine échouée (faute grave : note 69) ou bilan local non validé → pas de badge ;
   animation de pose une seule fois par badge ; prochaine machine conseillée ; fiche de la machine ; captures ordinateur
   et téléphone (412 px, sommaire caché comme chez l'enseignant) ;
2. dans la machine : à la fin d'une évaluation validée, badge fêté (« Badge … obtenu ! »), rien de plus envoyé à Moodle ;
   évaluation échouée : rien ; prefers-reduced-motion : sans animation ;
3. dossier d'entraînement (file://) : badge « Entraîné » (argent) d'après les exercices guidés réussis, gardé dans le
   navigateur ; un vrai exercice guidé réussi (scie radiale, débit en série) est compté ;
4. noms, KANAK et couleurs de engine/permis.js identiques à ceux de atelier/stations.js."""
import json, os, re, sys, tempfile, zipfile, mimetypes
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scie-radiale'))
from harness import Page, check, run, CHROMIUM, ROOT, HELPERS
from playwright.async_api import async_playwright
import test_paquet as TP

OUT = os.path.join(ROOT, 'tests', 'out')

def meta():
    """noms et KANAK des deux fichiers (lus dans le source) : permis.js doit suivre stations.js"""
    st = open(os.path.join(ROOT, 'atelier', 'stations.js'), encoding='utf-8').read()
    pm = open(os.path.join(ROOT, 'engine', 'permis.js'), encoding='utf-8').read()
    a = {m[0]: (m[1], m[2], m[3]) for m in re.findall(r"id:'([\w-]+)', n:\d+, nom:'((?:[^'\\]|\\.)*)', ref:'((?:[^'\\]|\\.)*)', etat:'\w+', famille:'(\w+)'", st)}
    a = {k: (v[0], v[1]) for k, v in a.items()}
    b = {m[0]: (m[1], m[2]) for m in re.findall(r"id:'([\w-]+)', n:\d+, nom:'((?:[^'\\]|\\.)*)', court:'(?:[^'\\]|\\.)*', ref:'((?:[^'\\]|\\.)*)'", pm)}
    check(len(b) == 10 and a == b, f'permis.js : mêmes 10 modules, noms et KANAK que stations.js ({len(b)} modules)')

async def paquet(br):
    z = zipfile.ZipFile(os.path.join(ROOT, 'dist', 'Atelier_bois_3D_SCORM12_sans_verrous.zip'))
    html = TP.PLAYER.replace('%TOC%', '')
    import xml.etree.ElementTree as ET
    m = ET.fromstring(z.read('imsmanifest.xml')); res = {r.get('identifier'): r.get('href') for r in m.findall('.//c:resource', TP.NS)}
    toc = '<ul>' + ''.join(f'<li><a data-scoid="{k}" title="&scoid={k}" onclick="go(\'{res[i.get("identifierref")]}\',\'{i.get("identifier")}\')"><i class="icon fa fa-regular fa-square fa-fw" title="Non tenté" aria-label="Non tenté" role="img"></i>&nbsp;{i.find("c:title", TP.NS).text}&nbsp;</a></li>'
                           for k, i in enumerate(m.findall('.//c:organization/c:item', TP.NS))) + '</ul>'
    pages = {'http://local/': TP.PLAYER.replace('%TOC%', toc),
             # sommaire « Invisible » (réglage de l'enseignant) : construit mais caché
             'http://local/invisible': TP.PLAYER.replace('%TOC%', toc).replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">').replace('<div id="scorm_toc" style="width:180px;', '<div id="scorm_toc" style="display:none;width:180px;')}
    errs = []
    async def route(r):
        u = r.request.url
        if u in pages: return await r.fulfill(body=pages[u], content_type='text/html')
        if u.startswith('http://local/pkg/'):
            n = u.split('http://local/pkg/')[1].split('?')[0]
            if n in z.namelist(): return await r.fulfill(body=z.read(n), content_type=mimetypes.guess_type(n)[0] or 'application/octet-stream')
            return await r.fulfill(status=404, body='')
        await r.abort()
    ctx = await br.new_context(viewport={'width': 1400, 'height': 820})
    pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); await pg.route('**/*', route)
    await pg.goto('http://local/')
    async def frame_ready():
        for _ in range(80):
            f = pg.frames[1] if len(pg.frames) > 1 else None
            try:
                if f and await f.evaluate('!!(window.__ready && window.__atelier && window.__atelier.permis)'): return f
            except Exception: pass
            await pg.wait_for_timeout(500)
        raise AssertionError('l\'atelier ne démarre pas : ' + '; '.join(errs))
    # statuts dans le sommaire, comme Moodle 4 : risques et scie radiale réussis, déligneuse échouée (faute grave : 69)
    await pg.evaluate("setSt('0. Risques généraux','fa-check','Réussi',95); setSt('1. Scie radiale','fa-check','Réussi',88); setSt('2. Déligneuse multilames','fa-xmark','Échoué',69)")
    await pg.click('text=Atelier'); f = await frame_ready()
    # raboteuse : bilan du navigateur NON validé (faute grave), dégauchisseuse : bilan validé mais sommaire « Non tenté »
    await f.evaluate("()=>{ localStorage.setItem('atelier.bilan.raboteuse', JSON.stringify({total:84, passed:false, date:'30/10/2026 10:00'})); localStorage.setItem('atelier.bilan.scie-radiale', JSON.stringify({total:88, passed:true, date:'29/10/2026 14:12'})); localStorage.setItem('atelier.fiches.deligneuse', JSON.stringify({n:8,total:8})); localStorage.removeItem('atelier.permis.poses'); location.reload(); }")
    await pg.wait_for_timeout(600); f = await frame_ready(); await pg.wait_for_timeout(2200)
    st = await f.evaluate("""()=>({ lbl:Object.fromEntries(__atelier.STATIONS.map(s=>[s.id, s.lbl.dataset.badge||''])),
        risk:!!document.querySelector('#postes [data-id=risques] .pbm'), n:document.getElementById('permisN').textContent,
        anim:__atelier.permis.animes.slice(), poses:JSON.parse(localStorage.getItem('atelier.permis.poses')||'[]') })""")
    check(st['lbl']['scie-radiale'] == 'obtenu' and st['risk'], 'machines validées dans Moodle : badge posé sur le poste de la scie radiale, badge des risques généraux dans la liste')
    check(st['lbl']['deligneuse'] == '' and st['lbl']['raboteuse'] == '', 'déligneuse échouée (faute grave, note 69) et raboteuse non validée (bilan du navigateur) : pas de badge')
    check(all(v == '' for k, v in st['lbl'].items() if k != 'scie-radiale'), 'aucun autre badge posé')
    check(st['n'] == '2/10', f'en-tête : « Mon permis {st["n"]} »')
    check(sorted(st['anim']) == ['obtenu:risques', 'obtenu:scie-radiale'] and sorted(st['poses']) == sorted(st['anim']), f'animation de pose des 2 badges ({st["anim"]})')
    await pg.screenshot(path=os.path.join(OUT, 'permis_atelier.png'))
    # rechargement : plus d'animation (une seule fois par badge)
    await f.evaluate("()=>location.reload()"); await pg.wait_for_timeout(600); f = await frame_ready(); await pg.wait_for_timeout(1800)
    check(await f.evaluate("()=>__atelier.permis.animes.length") == 0 and await f.evaluate("()=>__atelier.STATIONS.find(s=>s.id==='scie-radiale').lbl.dataset.badge") == 'obtenu',
          'retour à l\'atelier : badge toujours posé, animation pas rejouée')
    # nouvelle machine validée pendant que l'atelier est ouvert : le badge se pose (une fois)
    await pg.evaluate("setSt('3. Dégauchisseuse','fa-check','Réussi',92)"); await pg.wait_for_timeout(1200)
    st = await f.evaluate("()=>({ b:__atelier.STATIONS.find(s=>s.id==='degauchisseuse').lbl.dataset.badge, a:__atelier.permis.animes.slice() })")
    check(st['b'] == 'obtenu' and st['a'] == ['obtenu:degauchisseuse'], 'sommaire mis à jour : badge de la dégauchisseuse posé avec son animation')
    # panneau « Mon permis machine »
    await f.evaluate("()=>document.getElementById('permisBtn').click()"); await pg.wait_for_timeout(1000)
    pm = await f.evaluate("""()=>{ const c=document.getElementById('permis'); return { vis:!c.hidden, txt:c.innerText,
        n:document.getElementById('pmN').textContent, next:c.querySelector('.pm-next [data-pmgo]')?.dataset.pmgo,
        grid:[...c.querySelectorAll('.pm-grid [data-pmgo]')].map(b=>b.dataset.pmgo+':'+b.dataset.etat),
        bar:c.querySelector('.pm-prog .bar i').style.width, complet:c.querySelector('.pm-complet').dataset.ok,
        fl:!!c.querySelector('.pm-grid [data-pmgo=deligneuse] svg title') }; }""")
    check(pm['vis'] and pm['n'] == '3 / 10' and pm['bar'] == '30%', f'« Mon permis machine » : {pm["n"]} obtenus, barre à {pm["bar"]}')
    check(len(pm['grid']) == 10 and pm['grid'][0] == 'risques:obtenu' and 'scie-radiale:obtenu' in pm['grid'] and 'deligneuse:aobtenir' in pm['grid'], 'les 10 badges : obtenus en couleur, les autres « à obtenir »')
    check(pm['next'] == 'deligneuse', f'prochaine machine conseillée : déligneuse (chaîne de débit) — {pm["next"]}')
    check(pm['complet'] == 'false' and 'Permis atelier bois' in pm['txt'] and '3 / 5' in pm['txt'], 'permis complet « Permis atelier bois » : 3 / 5 (affichage seul)')
    check('Obtenu le 29/10/2026 · 88 / 100' in pm['txt'], 'badge de la scie radiale : date et note')
    check(pm['fl'], 'déligneuse : repère « fiches lues » sur le badge à obtenir')
    await pg.screenshot(path=os.path.join(OUT, 'permis_panneau.png'))
    # « Prochaine machine conseillée » → fiche de la déligneuse
    await f.evaluate("()=>document.querySelector('.pm-next [data-pmgo]').click()"); await pg.wait_for_timeout(1300)
    cd = await f.evaluate("()=>({ p:document.getElementById('permis').hidden, row:document.querySelector('#card .pm-row')?.dataset.etat, t:document.querySelector('#card .pm-row')?.innerText })")
    check(cd['p'] and cd['row'] == 'aobtenir' and '70 / 100, aucune faute grave' in cd['t'] and 'Fiches lues' in cd['t'], f'fiche de la déligneuse : « {cd["t"].replace(chr(10), " ")} »')
    await f.evaluate("()=>__atelier.select(__atelier.STATIONS.find(s=>s.id==='scie-radiale'))"); await pg.wait_for_timeout(1300)
    t = await f.evaluate("()=>document.querySelector('#card .pm-row').innerText")
    check('Badge obtenu' in t and '88 / 100' in t, f'fiche de la scie radiale : « {t.replace(chr(10), " ")} »')
    await pg.screenshot(path=os.path.join(OUT, 'permis_fiche.png'))
    # téléphone, sommaire « Invisible »
    ph = await br.new_context(viewport={'width': 412, 'height': 860}, has_touch=True, is_mobile=True)
    p2 = await ph.new_page(); p2.on('pageerror', lambda e: errs.append(str(e))); await p2.route('**/*', route)
    await p2.goto('http://local/invisible')
    await p2.evaluate("setSt('0. Risques généraux','fa-check','Réussi',95); setSt('1. Scie radiale','fa-check','Réussi',88); setSt('3. Dégauchisseuse','fa-check','Réussi',92); go('atelier/index.html','ITEM_ATELIER')")
    for _ in range(80):
        f2 = p2.frames[1] if len(p2.frames) > 1 else None
        try:
            if f2 and await f2.evaluate('!!window.__ready'): break
        except Exception: pass
        await p2.wait_for_timeout(500)
    await p2.wait_for_timeout(2500)
    await p2.screenshot(path=os.path.join(OUT, 'permis_atelier_tel.png'))
    await f2.evaluate("()=>document.getElementById('permisBtn').click()"); await p2.wait_for_timeout(900)
    lay = await f2.evaluate("""()=>{ const c=document.getElementById('permis').getBoundingClientRect(), g=[...document.querySelectorAll('.pm-grid button')].map(b=>b.getBoundingClientRect());
        return { w:innerWidth, l:c.left, r:c.right, over:g.filter(r=>r.right>c.right+1||r.left<c.left-1).length, sw:document.getElementById('permis').scrollWidth-document.getElementById('permis').clientWidth }; }""")
    check(lay['w'] <= 420 and lay['l'] >= 0 and lay['r'] <= lay['w'] and lay['over'] == 0 and lay['sw'] <= 1, f'téléphone : panneau dans l\'écran, badges sans débordement ({lay})')
    await p2.screenshot(path=os.path.join(OUT, 'permis_panneau_tel.png'))
    await f2.evaluate("()=>document.querySelector('#permis .pm-grid').scrollIntoView()"); await p2.wait_for_timeout(300)
    await p2.screenshot(path=os.path.join(OUT, 'permis_panneau_tel2.png'))
    real = [e for e in errs if 'context' not in e.lower()]
    check(not real, 'aucune erreur JavaScript' + (' : ' + '; '.join(real) if real else ''))
    await ctx.close(); await ph.close()

def etat(dangers):
    sc = {'pts': 20, 'crit': [], 'dangers': []}
    return json.dumps({'v': 2, 'ph': 'scen', 'ri': 15, 'rk': [1]*15, 'qi': 20, 'qk': [1]*20, 'si': 2, 'scens': [sc, sc], 'dangers': dangers})

async def machine():
    for dangers, reduce in (([], False), (['MAIN DANS LA ZONE DANGEREUSE : test'], False), ([], True)):
        init = "matchMedia=(q)=>({matches:/reduce/.test(q),media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});" if reduce else None
        async with Page('scie-radiale', scorm=True, suspend=etat(dangers), init=init) as pg:
            await pg.page.wait_for_timeout(600)
            n0 = await pg.eval("()=>Object.keys(__store).length")
            await pg.eval("()=>window.__atelier.finishScen()"); await pg.page.wait_for_timeout(500)
            r = await pg.eval("""()=>{ const e=document.querySelector('.pf-fete'); return { on:!!e, t:e?.innerText||'', m:e?.dataset.motion, id:e?.dataset.id,
                raw:__store['cmi.core.score.raw'], st:__store['cmi.core.lesson_status'], total:__atelier.parc.total,
                keys:Object.keys(__store).filter(k=>!k.startsWith('cmi.interactions')&&!/^cmi\\.(core|objectives|suspend)/.test(k)) }; }""")
            if dangers:
                check(not r['on'] and r['st'] == 'failed', 'évaluation avec faute grave : pas de badge fêté')
            else:
                check(r['on'] and r['id'] == 'scie-radiale' and 'Badge Scie radiale obtenu !' in r['t'] and f'{r["total"]} / 100' in r['t'],
                      f'évaluation validée : « {r["t"].splitlines()[0] if r["t"] else ""} » ({"sans animation" if reduce else "animé"})')
                check(r['raw'] == str(r['total']) and r['st'] == 'passed' and not r['keys'], 'note et statut Moodle inchangés, aucune valeur Moodle en plus')
                check(r['m'] == ('reduit' if reduce else 'plein'), f'prefers-reduced-motion respecté ({r["m"]})')
                if not reduce:
                    await pg.page.wait_for_timeout(2500); await pg.shot('permis_fete.png')
                    await pg.eval("()=>document.querySelector('.pf-fete [data-pf]').click()")
                    check(not await pg.eval("()=>!!document.querySelector('.pf-fete')"), '« Continuer » ferme le badge')
                    await pg.eval("()=>window.__atelier.app.parcours.render()")
                    check(not await pg.eval("()=>!!document.querySelector('.pf-fete')"), 'résultat relu : badge pas refêté')

async def entrainement(br):
    from jeux import JEUX
    d = tempfile.mkdtemp(prefix='permis_')
    with zipfile.ZipFile(os.path.join(ROOT, 'dist', 'Atelier_bois_3D_entrainement.zip')) as z: z.extractall(d)
    ctx = await br.new_context(viewport={'width': 1400, 'height': 820}); pg = await ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); await pg.route('**/fonts.g*/**', lambda r: r.abort())
    # un vrai exercice guidé réussi dans le module de la scie radiale
    await pg.goto('file://' + os.path.join(d, 'scie-radiale', 'index.html')); await pg.wait_for_function('window.__ready', timeout=120000)
    await pg.evaluate("()=>{ document.getElementById('ui-ex').click(); document.querySelector('[data-mode=serie]').click(); }"); await pg.wait_for_timeout(200)
    await pg.evaluate('async () => {' + HELPERS + JEUX['serie'] + '}'); await pg.wait_for_timeout(400)
    e = await pg.evaluate("()=>JSON.parse(localStorage.getItem('atelier.entraine.scie-radiale')||'null')")
    check(e and e['modes'] == ['serie'] and e['total'] == 3, f'exercice guidé « débit en série » réussi : compté pour le badge « Entraîné » ({e})')
    toast = await pg.evaluate("()=>document.body.innerText")
    check('1 / 3 pour le badge' in toast, 'message « Exercice réussi : 1 / 3 pour le badge « Entraîné » »')
    # les deux autres (simulés) : le badge « Entraîné » est fêté au dernier
    await pg.evaluate("()=>localStorage.setItem('atelier.entraine.scie-radiale', JSON.stringify({modes:['serie','purge'], total:3, date:''}))")
    await pg.evaluate("()=>{ document.querySelector('[data-mode=serie]').click(); }"); await pg.wait_for_timeout(200)
    await pg.evaluate("()=>{ const s=JSON.parse(localStorage.getItem('atelier.entraine.scie-radiale')); s.modes=['purge','biais']; localStorage.setItem('atelier.entraine.scie-radiale', JSON.stringify(s)); }")
    await pg.evaluate('async () => {' + HELPERS + JEUX['serie'] + '}'); await pg.wait_for_timeout(400)
    r = await pg.evaluate("()=>({ f:document.querySelector('.pf-fete')?.innerText||'', e:document.querySelector('.pf-fete')?.dataset.etat, s:JSON.parse(localStorage.getItem('atelier.entraine.scie-radiale')) })")
    check(r['e'] == 'entraine' and 'Entraîné' in r['f'] and len(r['s']['modes']) == 3 and r['s']['date'], f'3 / 3 exercices : badge « Entraîné » fêté ({r["f"].splitlines()[0] if r["f"] else ""})')
    await pg.wait_for_timeout(2500); await pg.screenshot(path=os.path.join(OUT, 'permis_entraine_fete.png'))
    # atelier : badge argent sur le poste, panneau
    await pg.evaluate("()=>localStorage.setItem('atelier.entraine.deligneuse', JSON.stringify({modes:['avives'], total:3, date:''}))")
    await pg.click('#toAtelier'); await pg.wait_for_function('window.__ready && window.__atelier?.permis', timeout=120000); await pg.wait_for_timeout(1500)
    st = await pg.evaluate("()=>({ b:Object.fromEntries(__atelier.STATIONS.map(s=>[s.id,s.lbl.dataset.badge||''])), n:document.getElementById('permisN').textContent, m:__atelier.permis.mode() })")
    check(st['m'] == 'entraine' and st['b']['scie-radiale'] == 'entraine' and st['b']['deligneuse'] == '' and st['n'] == '1/10', f'atelier hors ligne : badge « Entraîné » sur la scie radiale seulement ({st["n"]})')
    await pg.screenshot(path=os.path.join(OUT, 'permis_entraine_atelier.png'))
    await pg.evaluate("()=>document.getElementById('permisBtn').click()"); await pg.wait_for_timeout(1000)
    t = await pg.evaluate("()=>document.getElementById('permis').innerText")
    check('Exercices réussis : 1 / 3' in t and 'Permis atelier bois' not in t and 'Entraîné' in t, 'panneau d\'entraînement : badges argent, exercices réussis par machine, pas de permis complet')
    await pg.screenshot(path=os.path.join(OUT, 'permis_entraine_panneau.png'))
    real = [e for e in errs if 'context' not in e.lower()]
    check(not real, 'aucune erreur JavaScript' + (' : ' + '; '.join(real) if real else ''))
    await ctx.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    print('Données'); meta()
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=CHROMIUM, args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        print('Paquetage unique : atelier'); await paquet(br)
        print('Dossier d\'entraînement'); await entrainement(br)
        await br.close()
    print('Machine : fin d\'évaluation'); await machine()

if __name__ == '__main__': run(main)
