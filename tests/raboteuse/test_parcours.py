"""Raboteuse : parcours évalué SCORM avec une fausse API Moodle.
1. Parcours complet (2 erreurs de repérage, 3 erreurs de QCM, 3 scénarios réussis) → 94 / 100, passed, 50 interactions.
2. Reprise : un scénario interrompu reprend à son introduction, fautes graves conservées.
3. Fautes graves : passe de 7 mm (5 mm au plus) au moment d'engager la pièce ; main poussée vers l'entrée machine en marche (hors passe).
4. Repérage : un bouton de vue (« Arbre ») n'impose pas la vue intérieure, chaque question remet la transparence qu'elle demande,
   et la rallonge reste cliquable ; « Pièces débitées » visible pendant les scénarios."""
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
    async with Page('raboteuse', scorm=True) as pg:
        s = await pg.eval(ST)
        check(s['ui'] == 'parcours' and s['ph'] == 'rep', 'démarrage en disposition parcours, phase repérage')
        check((await pg.eval("__store['cmi.core.lesson_status']")) == 'incomplete', 'statut « incomplete » au départ')
        tg = await reperage(pg, wrong=(3, 9))
        check(len(tg) == 15, '15 organes à repérer')
        s = await pg.eval(ST); check(s['ph'] == 'qcm', 'repérage terminé → QCM')
        ans = await qcm(pg, wrong=(2, 7, 15))
        check(len(ans) == 20, '20 questions')
        mid = await pg.eval("__store['cmi.suspend_data']")
        for k, mode in enumerate(['piece', 'serie', 'controle']):
            await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
            if k == 1:
                vis = await pg.eval("()=>getComputedStyle(document.querySelector('.debit')).display!=='none' && document.getElementById('debit').textContent.includes('Montant 3')")
                check(vis, '« Pièces débitées » visible pendant le scénario (montants 2 et 3 en attente)')
            r = await pg.eval(js(JEUX[mode]))
            check(all(row[2] == '✓' for row in r['res']), f'scénario {k+1} ({mode}) : pièces conformes')
            await pg.page.click('#scenEnd'); await pg.page.wait_for_timeout(300)
        s = await pg.eval(ST)
        check(s['ph'] == 'fin' and 'Module réussi · 94 / 100' in s['card'], 'note finale 94 / 100, module réussi')
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
    async with Page('raboteuse', scorm=True, suspend=mid) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'scen-intro' and s['qi'] == 20 and 'Scénario 1 / 3' in s['card'], 'reprise au scénario 1 (repérage et QCM conservés)')
    print('Reprise d\'un scénario interrompu avec une faute grave')
    o = json.loads(mid); o.update(ph='scen', si=1, scens=[{'pts': 20, 'crit': [], 'dangers': []}], dangers=['PASSE TROP FORTE : test'])
    async with Page('raboteuse', scorm=True, suspend=json.dumps(o)) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'scen-intro' and s['si'] == 1 and 'Scénario 2 / 3' in s['card'], 'scénario interrompu repris depuis son introduction')
        check(s['dangers'] == ['PASSE TROP FORTE : test'], 'faute grave du scénario interrompu conservée')

async def faute_grave(mid):
    print('Fautes graves pendant un scénario')
    async with Page('raboteuse', scorm=True, suspend=mid) as pg:   # repris après le QCM
        await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
        r = await pg.eval(js(BASE + r"""
          prep(); next(); chant('Traverse');
          const A=P('Traverse'); cote(M(A).Wmax-7); on('motor'); on('feed');
          const before=alerts().filter(a=>a.startsWith('danger'));
          await passe();
          const d1=__atelier.parc.dangers.slice();
          op('push');                                        // main vers l'entrée, machine en marche
          return {before, d1, dangers:__atelier.parc.dangers, card:$('parcCard').textContent};"""))
        check(any('PASSE TROP FORTE' in a for a in r['before']), 'alerte rouge « passe trop forte » avant d\'engager la pièce')
        check(any(d.startswith('PASSE TROP FORTE') for d in r['d1']), 'faute grave relevée au moment d\'engager la pièce')
        check(any(d.startswith('MAINS PRÈS DE L\'ENTRÉE') for d in r['dangers']), 'main poussée vers l\'entrée machine en marche : faute grave relevée')
        check('Fautes graves relevées : 2' in r['card'], 'deux fautes affichées dans la carte du parcours')
        await pg.eval('()=>__atelier.app.parcours.scorm.finish()')   # l'élève ferme la fenêtre
        sd = json.loads(await pg.eval("__store['cmi.suspend_data']"))
        check(sd['ph'] == 'scen' and len(sd['dangers']) == 2, 'fenêtre fermée : fautes enregistrées dans suspend_data')

XR = "__atelier.app.parts.xray"
async def transparence():
    print('Repérage : vue intérieure jamais bloquée')
    async with Page('raboteuse', scorm=True) as pg:
        tg = await pg.eval('__atelier.REP_TARGETS')
        await pg.page.click('#varbre'); await pg.page.wait_for_timeout(200)
        check(not await pg.eval(XR), 'bouton « Arbre » pendant le repérage : pas de vue intérieure imposée')
        await pg.eval("__atelier.app.parts.setXray(true,false)")              # transparence restée active (ancien bug)
        await pg.eval(f"__atelier.repAnswer('{tg[0]}')"); await pg.page.wait_for_function('__atelier.parc.ri>0', timeout=60000)
        check(not await pg.eval(XR), 'question suivante : transparence remise comme la question le demande')
        await pg.page.click('#vsortie'); await pg.page.wait_for_timeout(800)
        xy = await pg.eval("""()=>{ const st=__atelier.app.stage; st.camera.updateMatrixWorld(); const y=__rabot.C?0.955:0.955, v=new st.THREE.Vector3(-1.25,y,0.12).project(st.camera), r=st.canvas.getBoundingClientRect();
          return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height]; }""")
        cand = None
        for _ in range(3):                      # en headless, un rendu lent peut faire manquer le premier clic
            await pg.page.mouse.click(*xy); await pg.page.wait_for_timeout(300)
            cand = await pg.eval('__atelier.parc.cand')
            if cand == 'rallonge_sortie': break
        check(cand == 'rallonge_sortie', 'clic sur la rallonge de sortie : organe proposé')
        i = tg.index('arbre')
        for k in range(1, i):
            await pg.eval(f"__atelier.repAnswer('{tg[k]}')"); await pg.page.wait_for_function(f'__atelier.parc.ri>{k}', timeout=60000)
        check(await pg.eval(XR), 'question « arbre » : vue intérieure affichée')
        j = tg.index('colonnes')
        for k in range(i, j):
            await pg.eval(f"__atelier.repAnswer('{tg[k]}')"); await pg.page.wait_for_function(f'__atelier.parc.ri>{k}', timeout=60000)
        check(await pg.eval(XR), 'question « colonnes » : vue intérieure toujours affichée')

async def main():
    await transparence()
    mid = await complet()
    await reprise(mid)
    await faute_grave(mid)

if __name__=="__main__": run(main)
