# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Scie radiale : parcours évalué SCORM avec une fausse API Moodle.
1. Parcours complet (2 erreurs de repérage, 3 erreurs de QCM, 3 scénarios réussis) → 94 / 100, passed.
2. Reprise : un scénario interrompu reprend à son introduction, fautes graves conservées.
3. Fautes graves : lame tirée avec le protecteur trop haut, puis pièce touchée alors que la lame est en avant → relevées, conservées.
4. Repérage : un bouton de vue (« Lame ») n'impose pas la vue intérieure, chaque question remet la transparence qu'elle demande,
   et la table reste cliquable."""
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
    async with Page('scie-radiale', scorm=True) as pg:
        s = await pg.eval(ST)
        check(s['ui'] == 'parcours' and s['ph'] == 'rep', 'démarrage en disposition parcours, phase repérage')
        check((await pg.eval("__store['cmi.core.lesson_status']")) == 'incomplete', 'statut « incomplete » au départ')
        tg = await reperage(pg, wrong=(3, 9))
        check(len(tg) == 15, '15 organes à repérer')
        s = await pg.eval(ST); check(s['ph'] == 'qcm', 'repérage terminé → QCM')
        ans = await qcm(pg, wrong=(2, 7, 15))
        check(len(ans) == 20, '20 questions')
        mid = await pg.eval("__store['cmi.suspend_data']")
        for k, mode in enumerate(['serie', 'purge', 'biais']):
            await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
            r = await pg.eval(js(JEUX[mode]))
            check(r['res'] and all(row[2] == '✓' for row in r['res']), f'scénario {k+1} ({mode}) : pièces conformes')
            if k == 0:
                vis = await pg.eval("()=>{ const d=document.querySelector('.debit'); return {shown:getComputedStyle(d).display!=='none' && d.getBoundingClientRect().height>0, n:document.querySelectorAll('#debit li[data-k]').length}; }")
                check(vis['shown'] and vis['n'] >= 5, f"parcours : pièces évacuées visibles dans « Pièces débitées » ({vis['n']})")
            await pg.page.click('#scenEnd'); await pg.page.wait_for_timeout(300)
        s = await pg.eval(ST)
        check(s['ph'] == 'fin' and 'Module réussi · 94 / 100' in s['card'], 'note finale 94 / 100, module réussi')
        store = await pg.eval('__store'); log = await pg.eval('__log')
        check(store['cmi.core.score.raw'] == '94' and store['cmi.core.score.min'] == '0' and store['cmi.core.score.max'] == '100', 'score.raw / min / max envoyés')
        check(store['cmi.core.lesson_status'] == 'passed', 'statut « passed » posé par le module')
        n = int(store['cmi.interactions._count']); ids = [store[f'cmi.interactions.{i}.id'] for i in range(n)]
        check(n == 51, '51 interactions (15 repérage + 20 QCM + 15 critères de scénarios + 1 bilan)')
        check(all(i.startswith('RADIALE_') for i in ids), 'identifiants préfixés « RADIALE_ »')
        b = [i for i in range(n) if store[f'cmi.interactions.{i}.id'] == 'RADIALE_bilan']
        check(len(b) == 1 and store[f'cmi.interactions.{b[0]}.student_response'].startswith('VALIDÉE') and store[f'cmi.interactions.{b[0]}.result'] == 'correct',
              'bilan : ' + (store[f'cmi.interactions.{b[0]}.student_response'] if b else '?'))
        check(store.get('cmi.objectives.0.id') == 'RADIALE' and store.get('cmi.objectives.0.status') == 'passed' and store.get('cmi.objectives.0.score.raw') == store['cmi.core.score.raw'], 'objectif SCORM « RADIALE » réussi, même note')
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
    async with Page('scie-radiale', scorm=True, suspend=mid) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'scen-intro' and s['qi'] == 20 and 'Scénario 1 / 3' in s['card'], 'reprise au scénario 1 (repérage et QCM conservés)')
    print('Reprise d\'un scénario interrompu avec une faute grave')
    o = json.loads(mid); o.update(ph='scen', si=1, scens=[{'pts': 20, 'crit': [], 'dangers': []}], dangers=['MAIN DANS LA ZONE DE LA LAME (80 mm du trait) : test'])
    async with Page('scie-radiale', scorm=True, suspend=json.dumps(o)) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'scen-intro' and s['si'] == 1 and 'Scénario 2 / 3' in s['card'], 'scénario interrompu repris depuis son introduction')
        check(s['dangers'] == ['MAIN DANS LA ZONE DE LA LAME (80 mm du trait) : test'], 'faute grave du scénario interrompu conservée')

async def faute_grave(mid):
    print('Fautes graves pendant un scénario')
    async with Page('scie-radiale', scorm=True, suspend=mid) as pg:   # repris après le QCM
        await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
        r = await pg.eval(js(BASE + r"""
          on('asp'); op('guide'); $('stepNext').click(); trim(); on('motor');      // protecteur laissé à 90 mm pour une planche de 27 mm
          const before=alerts().filter(a=>a.startsWith('danger'));
          await pull(); const d1=__atelier.parc.dangers.slice();
          op('evac');                                                            // pièce touchée, lame en avant
          return {before, d1, dangers:__atelier.parc.dangers, card:$('parcCard').textContent};"""))
        check(any('PROTECTEUR TROP HAUT' in a for a in r['before']), 'alerte rouge « protecteur trop haut » avant de tirer la lame')
        check(any(d.startswith('PROTECTEUR TROP HAUT') for d in r['d1']), 'faute grave relevée au moment où la lame est tirée')
        check(any(d.startswith('PIÈCE TOUCHÉE LAME EN AVANT') for d in r['dangers']), 'faute grave relevée : pièce touchée alors que la lame est en avant')
        check('Fautes graves relevées : 2' in r['card'] and 'PROTECTEUR TROP HAUT' in r['card'], 'fautes affichées dans la carte du parcours')
        await pg.eval('()=>__atelier.app.parcours.scorm.finish()')   # l'élève ferme la fenêtre
        sd = json.loads(await pg.eval("__store['cmi.suspend_data']"))
        check(sd['ph'] == 'scen' and len(sd['dangers']) >= 2, 'fenêtre fermée : fautes enregistrées dans suspend_data')

XR = "__atelier.app.parts.xray"
async def transparence():
    print('Repérage : vue intérieure jamais bloquée')
    async with Page('scie-radiale', scorm=True) as pg:
        tg = await pg.eval('__atelier.REP_TARGETS')
        await pg.page.click('#vlame'); await pg.page.wait_for_timeout(200)
        check(not await pg.eval(XR), 'bouton « Lame » pendant le repérage : pas de vue intérieure imposée')
        await pg.eval("__atelier.app.parts.setXray(true,false)")              # transparence restée active (ancien bug)
        await pg.eval(f"__atelier.repAnswer('{tg[0]}')"); await pg.page.wait_for_function('__atelier.parc.ri>0', timeout=60000)
        check(not await pg.eval(XR), 'question suivante : transparence remise comme la question le demande')
        await pg.page.click('#v34'); await pg.page.wait_for_timeout(800)
        xy = await pg.eval("""()=>{ const st=__atelier.app.stage; st.camera.updateMatrixWorld(); const v=new st.THREE.Vector3(0.45,0.9005,0.30).project(st.camera), r=st.canvas.getBoundingClientRect();
          return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height]; }""")
        cand = None
        for _ in range(3):                      # en headless, un rendu lent peut faire manquer le premier clic
            await pg.page.mouse.click(*xy); await pg.page.wait_for_timeout(300)
            cand = await pg.eval('__atelier.parc.cand')
            if cand == 'table': break
        check(cand == 'table', 'clic sur la table : organe proposé')
        i = tg.index('colonne')
        for k in range(1, i):
            await pg.eval(f"__atelier.repAnswer('{tg[k]}')"); await pg.page.wait_for_function(f'__atelier.parc.ri>{k}', timeout=60000)
        await pg.page.wait_for_timeout(100)
        check(not await pg.eval(XR), 'question « colonne » : pas de vue intérieure')
        j = tg.index('lame')
        for k in range(i, j):
            await pg.eval(f"__atelier.repAnswer('{tg[k]}')"); await pg.page.wait_for_function(f'__atelier.parc.ri>{k}', timeout=60000)
        await pg.page.wait_for_timeout(100)
        check(await pg.eval(XR), 'question « lame » : vue intérieure affichée')

async def main():
    await transparence()
    mid = await complet()
    await reprise(mid)
    await faute_grave(mid)

if __name__=="__main__": run(main)
