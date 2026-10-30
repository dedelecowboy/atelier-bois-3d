# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Risques généraux : parcours évalué SCORM avec une fausse API Moodle.
1. Parcours complet (2 erreurs de repérage, 3 erreurs de QCM, 4 scénarios réussis) → 94 / 100, passed, 56 interactions,
   4 scénarios de 15 points (5 critères de 3 points).
2. Repérage au clic dans l'atelier (vue « Électricité » imposée par la question).
3. Faute grave (gants à la toupie au scénario EPI) → module non validé, note Moodle ramenée à 69 au plus.
4. Reprise : un scénario interrompu reprend à son introduction, fautes graves conservées."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, FAUTES

ST = "()=>({ph:__atelier.parc.ph, ri:__atelier.parc.ri, qi:__atelier.parc.qi, si:__atelier.parc.si, dangers:__atelier.parc.dangers, ui:document.getElementById('app').dataset.ui, card:document.getElementById('parcCard').innerText})"
MODES = ['dangers', 'epi', 'consignation', 'feu']

async def reperage(pg, wrong=()):
    tg = await pg.eval('__atelier.REP_TARGETS')
    for i, t in enumerate(tg):
        await pg.eval(f"__atelier.repAnswer('{'allee' if i in wrong else t}')")
        await pg.page.wait_for_function(f'__atelier.parc.ri>{i}', timeout=60000)
    return tg

async def qcm(pg, wrong=()):
    ans = await pg.eval('__atelier.QCM.map(q=>q.a)')
    for i, a in enumerate(ans):
        if i in wrong: a = (a + 1) % 3
        await pg.page.click(f'#parcCard [data-q="{a}"]'); await pg.page.click('#qNext')
    return ans

async def scenarios(pg, jeux):
    for k, m in enumerate(MODES):
        await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(400)
        vis = await pg.eval("()=>getComputedStyle(document.getElementById('acts')).display!=='none' && document.getElementById('acts').innerHTML.length>50")
        check(vis, f'scénario {k+1} ({m}) : panneau « Actions » visible')
        r = await pg.eval(js(jeux.get(m, JEUX[m])))
        await pg.page.click('#scenEnd'); await pg.page.wait_for_timeout(300)

async def complet():
    print('Parcours complet')
    async with Page('risques', scorm=True) as pg:
        s = await pg.eval(ST)
        check(s['ui'] == 'parcours' and s['ph'] == 'rep', 'démarrage en disposition parcours, phase repérage')
        check('Repérage des équipements' in await pg.eval("document.getElementById('parcSteps').textContent"), 'étapes : « Repérage des équipements »')
        tg = await reperage(pg, wrong=(3, 9))
        check(len(tg) == 15, '15 équipements à repérer')
        await qcm(pg, wrong=(2, 7, 15))
        mid = await pg.eval("__store['cmi.suspend_data']")
        await scenarios(pg, {})
        s = await pg.eval(ST)
        check(s['ph'] == 'fin' and 'Module réussi · 94 / 100' in s['card'], 'note finale 94 / 100, module réussi')
        check(all(x in s['card'] for x in ['15 / 15', 'Scénario 4']), 'bilan : scénarios sur 15 points, 4 scénarios')
        store = await pg.eval('__store')
        check(store['cmi.core.score.raw'] == '94' and store['cmi.core.lesson_status'] == 'passed', 'score 94 et statut « passed »')
        n = int(store['cmi.interactions._count']); ids = [store[f'cmi.interactions.{i}.id'] for i in range(n)]
        check(n == 56, '56 interactions (15 repérage + 20 QCM + 20 critères de scénarios + 1 bilan)')
        check(all(i.startswith('RISQUES_') and ' ' not in i for i in ids), 'identifiants préfixés « RISQUES_ », sans espace')
        b = ids.index('RISQUES_bilan'); resp = store[f'cmi.interactions.{b}.student_response']
        check(resp.startswith('VALIDÉE 94/100') and 'S4 15/15' in resp, 'bilan : ' + resp)
        check(store.get('cmi.objectives.0.id') == 'RISQUES' and store.get('cmi.objectives.0.status') == 'passed', 'objectif SCORM « RISQUES » réussi')
        crit = [store[f'cmi.interactions.{i}.student_response'] for i in range(n) if ids[i].startswith('RISQUES_s')]
        check(len(crit) == 20 and all(store[f'cmi.interactions.{i}.result'] == 'correct' for i in range(n) if ids[i].startswith('RISQUES_s')), '20 critères de scénarios, tous corrects')
        sd = store['cmi.suspend_data']; check(len(sd) <= 4096 and json.loads(sd)['done'], f'suspend_data de {len(sd)} caractères')
        await pg.shot('risques_parcours_fin.png')
    return mid

async def clic():
    print('Repérage au clic dans l\'atelier')
    async with Page('risques', scorm=True) as pg:
        tg = await pg.eval('__atelier.REP_TARGETS'); i = tg.index('armoire_elec')
        for k in range(i):
            await pg.eval(f"__atelier.repAnswer('{tg[k]}')"); await pg.page.wait_for_function(f'__atelier.parc.ri>{k}', timeout=60000)
        await pg.page.wait_for_timeout(500)
        xy = await pg.eval("""()=>{ const st=__atelier.app.stage; st.camera.updateMatrixWorld(); const v=new st.THREE.Vector3(-10.7,1.2,-1.8).project(st.camera), r=st.canvas.getBoundingClientRect();
          return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height]; }""")
        cand = None
        for _ in range(3):
            await pg.page.mouse.click(*xy); await pg.page.wait_for_timeout(300)
            cand = await pg.eval('__atelier.parc.cand')
            if cand == 'armoire_elec': break
        check(cand == 'armoire_elec', 'clic sur l\'armoire électrique : équipement proposé (vue « Électricité »)')
        await pg.page.click('#repOk'); await pg.page.wait_for_timeout(1200)
        check(await pg.eval('__atelier.parc.rk[__atelier.parc.rk.length-1]') == 1, 'validé : bonne réponse')

async def faute(mid):
    print('Faute grave au scénario EPI')
    async with Page('risques', scorm=True, suspend=mid) as pg:
        await scenarios(pg, {'epi': FAUTES['epi']})
        s = await pg.eval(ST); store = await pg.eval('__store')
        check(s['ph'] == 'fin' and 'Module non validé' in s['card'], 'module non validé')
        check(int(store['cmi.core.score.raw']) <= 69 and store['cmi.core.lesson_status'] == 'failed', f'note Moodle {store["cmi.core.score.raw"]} (69 au plus), statut « failed »')
        n = int(store['cmi.interactions._count']); ids = [store[f'cmi.interactions.{i}.id'] for i in range(n)]
        check('RISQUES_faute_s2_1' in ids, 'faute grave tracée : RISQUES_faute_s2_1')

async def reprise(mid):
    print('Reprise d\'un scénario interrompu')
    o = json.loads(mid); o.update(ph='scen', si=2, scens=[{'pts': 15, 'crit': [], 'dangers': []}, {'pts': 15, 'crit': [], 'dangers': []}], dangers=['Intervention sur une machine non consignée'])
    async with Page('risques', scorm=True, suspend=json.dumps(o)) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'scen-intro' and s['si'] == 2 and 'Scénario 3 / 4' in s['card'], 'scénario 3 repris depuis son introduction')
        check(s['dangers'] == ['Intervention sur une machine non consignée'], 'faute grave du scénario interrompu conservée')

async def main():
    await clic()
    mid = await complet()
    await faute(mid)
    await reprise(mid)

if __name__ == '__main__': run(main)
