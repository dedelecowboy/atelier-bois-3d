"""Toupie : parcours évalué SCORM avec une fausse API Moodle.
1. Parcours complet (2 erreurs de repérage, 3 erreurs de QCM, 3 scénarios réussis) → 94 / 100, passed, 50 interactions.
2. Reprise : un scénario interrompu reprend à son introduction, fautes graves conservées.
3. Fautes graves : réglage du guide moteur en marche (hors passe), puis passe avec les presseurs trop hauts et trop loin
   et l'ouverture des lamelles trop grande ; démarrage avec l'outil contre les lamelles (choc).
4. Repérage : un bouton de vue (« Guide ») n'impose pas la vue intérieure, chaque question remet la transparence qu'elle
   demande, la table reste cliquable ; « Pièces débitées » visible pendant les scénarios."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, BASE

ST = "()=>({ph:__atelier.parc.ph, ri:__atelier.parc.ri, qi:__atelier.parc.qi, si:__atelier.parc.si, dangers:__atelier.parc.dangers, ui:document.getElementById('app').dataset.ui, card:document.getElementById('parcCard').innerText})"

async def reperage(pg, wrong=()):
    tg = await pg.eval('__atelier.REP_TARGETS')
    for i, t in enumerate(tg):
        await pg.eval(f"__atelier.repAnswer('{'bati' if i in wrong else t}')")
        await pg.page.wait_for_function(f'__atelier.parc.ri>{i}', timeout=60000)
    return tg

async def qcm(pg, wrong=()):
    ans = await pg.eval('__atelier.QCM.map(q=>q.a)')
    for i, a in enumerate(ans):
        if i in wrong: a = (a + 1) % 3
        await pg.page.click(f'#parcCard [data-q="{a}"]'); await pg.page.click('#qNext')
    return ans

async def complet():
    print('Parcours complet')
    async with Page('toupie', scorm=True) as pg:
        s = await pg.eval(ST)
        check(s['ui'] == 'parcours' and s['ph'] == 'rep', 'démarrage en disposition parcours, phase repérage')
        check((await pg.eval("__store['cmi.core.lesson_status']")) == 'incomplete', 'statut « incomplete » au départ')
        tg = await reperage(pg, wrong=(3, 9))
        check(len(tg) == 15, '15 organes à repérer')
        s = await pg.eval(ST); check(s['ph'] == 'qcm', 'repérage terminé → QCM')
        ans = await qcm(pg, wrong=(2, 7, 15))
        check(len(ans) == 20, '20 questions')
        mid = await pg.eval("__store['cmi.suspend_data']")
        for k, mode in enumerate(['quart', 'feuillure', 'serie']):
            await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
            if k == 2:
                vis = await pg.eval("()=>getComputedStyle(document.querySelector('.debit')).display!=='none' && document.getElementById('debit').textContent.includes('Baguette courte')")
                check(vis, '« Pièces débitées » visible pendant le scénario (baguettes en attente)')
            r = await pg.eval(js(JEUX[mode]))
            check(all(row[2] == '✓' for row in r['res']), f'scénario {k+1} ({mode}) : pièces conformes')
            await pg.page.click('#scenEnd'); await pg.page.wait_for_timeout(300)
        s = await pg.eval(ST)
        check(s['ph'] == 'fin' and 'Module réussi · 94 / 100' in s['card'], 'note finale 94 / 100, module réussi' + ('' if 'Module réussi · 94 / 100' in s['card'] else ' : ' + s['card'][:300]))
        store = await pg.eval('__store'); log = await pg.eval('__log')
        check(store['cmi.core.score.raw'] == '94' and store['cmi.core.score.min'] == '0' and store['cmi.core.score.max'] == '100', 'score.raw / min / max envoyés')
        check(store['cmi.core.lesson_status'] == 'passed', 'statut « passed » posé par le module')
        n = int(store['cmi.interactions._count']); ids = [store[f'cmi.interactions.{i}.id'] for i in range(n)]
        check(n == 50, '50 interactions (15 repérage + 20 QCM + 15 critères de scénarios)')
        check(all(' ' not in i for i in ids), 'identifiants d\'interactions sans espace')
        types = {store[f'cmi.interactions.{i}.type'] for i in range(n)}
        check(types <= {'choice', 'numeric', 'performance'}, f'types d\'interactions valides {sorted(types)}')
        sd = store['cmi.suspend_data']; o = json.loads(sd)
        check(o['v'] == 2 and len(sd) <= 4096 and o['done'] and o['passed'], f'suspend_data JSON v:2 de {len(sd)} caractères')
        await pg.eval('()=>__atelier.app.parcours.scorm.finish()')
        store = await pg.eval('__store'); log = await pg.eval('__log')
        check(re.fullmatch(r'\d{4}:\d{2}:\d{2}', store['cmi.core.session_time']) and store['cmi.core.exit'] == 'suspend' and log[-1] == 'finish', 'fin de session : session_time, exit=suspend, LMSFinish')
    return mid

async def reprise(mid):
    print('Reprise après le QCM')
    async with Page('toupie', scorm=True, suspend=mid) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'scen-intro' and s['qi'] == 20 and 'Scénario 1 / 3' in s['card'], 'reprise au scénario 1 (repérage et QCM conservés)')
    print('Reprise d\'un scénario interrompu avec une faute grave')
    o = json.loads(mid); o.update(ph='scen', si=1, scens=[{'pts': 20, 'crit': [], 'dangers': []}], dangers=['TRAVAIL EN AVALANT : test'])
    async with Page('toupie', scorm=True, suspend=json.dumps(o)) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'scen-intro' and s['si'] == 1 and 'Scénario 2 / 3' in s['card'], 'scénario interrompu repris depuis son introduction')
        check(s['dangers'] == ['TRAVAIL EN AVALANT : test'], 'faute grave du scénario interrompu conservée')

async def faute_grave(mid):
    print('Fautes graves pendant un scénario')
    async with Page('toupie', scorm=True, suspend=mid) as pg:   # repris après le QCM
        await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
        r = await pg.eval(js(BASE + r"""
          on('asp'); next(); orientTo('F1','C2'); on2('push');
          num('open',30); await start();                     // lamelles trop près : l'outil droit Ø 125 les touche
          const choc=__atelier.parc.dangers.slice(), motorOn=T.st.motor;
          num('open',180); await start();
          num('sail',5);                                     // réglage du guide moteur en marche
          const d1=__atelier.parc.dangers.slice(), sail=T.st.zIn;
          const before=alerts().filter(a=>a.startsWith('danger'));
          await passe();
          return {choc, motorOn, d1, sail, before, dangers:__atelier.parc.dangers, card:$('parcCard').textContent};"""))
        check(any(d.startswith('CHOC DE L\'OUTIL') for d in r['choc']) and not r['motorOn'], 'démarrage outil contre les lamelles : refusé, faute grave « choc » relevée')
        check(any(d.startswith('RÉGLAGE MOTEUR EN MARCHE') for d in r['d1']) and abs(r['sail'] - 60) < 1e-6, 'réglage du guide moteur en marche : refusé, faute grave relevée')
        check(any('PRESSEUR VERTICAL TROP HAUT' in a for a in r['before']) and any('OUVERTURE DES DEMI-GUIDES TROP GRANDE' in a for a in r['before']), 'alertes rouges avant la passe : presseur trop haut, ouverture trop grande')
        check(any(d.startswith('PRESSEUR VERTICAL TROP HAUT') for d in r['dangers']) and any(d.startswith('OUVERTURE DES DEMI-GUIDES') for d in r['dangers']), 'fautes graves relevées au moment d\'engager la pièce')
        n = len(r['dangers'])
        check(f'Fautes graves relevées : {n}' in r['card'], f'{n} fautes affichées dans la carte du parcours')
        await pg.eval('()=>__atelier.app.parcours.scorm.finish()')   # l'élève ferme la fenêtre
        sd = json.loads(await pg.eval("__store['cmi.suspend_data']"))
        check(sd['ph'] == 'scen' and len(sd['dangers']) == n, 'fenêtre fermée : fautes enregistrées dans suspend_data')

XR = "__atelier.app.parts.xray"
async def transparence():
    print('Repérage : vue intérieure jamais bloquée')
    async with Page('toupie', scorm=True) as pg:
        tg = await pg.eval('__atelier.REP_TARGETS')
        await pg.page.click('#vdessus'); await pg.page.wait_for_timeout(200)
        check(not await pg.eval(XR), 'bouton « Guide » pendant le repérage : pas de vue intérieure imposée')
        await pg.eval("__atelier.app.parts.setXray(true,false)")              # transparence restée active (ancien bug)
        await pg.eval(f"__atelier.repAnswer('{tg[0]}')"); await pg.page.wait_for_function('__atelier.parc.ri>0', timeout=60000)
        check(not await pg.eval(XR), 'question suivante : transparence remise comme la question le demande')
        await pg.page.click('#v34'); await pg.page.wait_for_timeout(800)
        xy = await pg.eval("""()=>{ const st=__atelier.app.stage; st.camera.updateMatrixWorld(); const v=new st.THREE.Vector3(-0.42,0.869,0.24).project(st.camera), r=st.canvas.getBoundingClientRect();
          return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height]; }""")
        cand = None
        for _ in range(3):                      # en headless, un rendu lent peut faire manquer le premier clic
            await pg.page.mouse.click(*xy); await pg.page.wait_for_timeout(300)
            cand = await pg.eval('__atelier.parc.cand')
            if cand == 'table': break
        check(cand == 'table', 'clic sur la table : organe proposé')
        i = tg.index('outil')
        for k in range(1, i):
            await pg.eval(f"__atelier.repAnswer('{tg[k]}')"); await pg.page.wait_for_function(f'__atelier.parc.ri>{k}', timeout=60000)
        check(await pg.eval(XR), 'question « outil » : vue intérieure affichée (capot translucide)')
        j = tg.index('table')
        for k in range(i, j):
            await pg.eval(f"__atelier.repAnswer('{tg[k]}')"); await pg.page.wait_for_function(f'__atelier.parc.ri>{k}', timeout=60000)
        check(not await pg.eval(XR), 'question « table » : vue normale')

async def main():
    await transparence()
    mid = await complet()
    await reprise(mid)
    await faute_grave(mid)

if __name__=="__main__": run(main)
