# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Mortaiseuse : parcours évalué SCORM avec une fausse API Moodle.
1. Fiches à lecture obligatoire (paquetage séparé) : lecture avant le repérage, trace MORTAISE_lecture.
2. Parcours complet (2 erreurs de repérage, 3 erreurs de QCM, 3 scénarios réussis) → 94 / 100, passed, 51 interactions.
3. Reprise : un scénario interrompu reprend à son introduction, fautes graves conservées.
4. Fautes graves : intervention sur le bédane sans consignation (geste refusé) ; cycle lancé pièce non serrée et vérin devant
   le bédane ; pièce touchée pendant le cycle (geste refusé) → module non validé, note Moodle ramenée à 69.
5. Repérage : un bouton de vue n'impose pas la vue intérieure, chaque question remet la transparence qu'elle demande,
   la table reste cliquable."""
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

async def fiches():
    print('Fiches de la machine : lecture obligatoire avant le repérage')
    async with Page('mortaiseuse', scorm=True, lues=False) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'rep' and 'Lisez les fiches' in s['card'], 'paquetage séparé : les fiches s\'affichent avant le repérage')
        n = await pg.eval("()=>__atelier.app.fiches.list.length"); check(n == 8, f'{n} fiches')
        for i in range(n):
            await pg.page.click(f'#parcCard [data-flu="{i}"]'); await pg.page.wait_for_timeout(100)
        s = await pg.eval(ST); store = await pg.eval('__store')
        k = [i for i in range(int(store['cmi.interactions._count'])) if store[f'cmi.interactions.{i}.id'] == 'MORTAISE_lecture']
        check(s['ph'] == 'rep' and 'Trouvez' in s['card'], 'toutes les fiches lues : le repérage commence')
        check(len(k) == 1 and store[f'cmi.interactions.{k[0]}.student_response'].startswith('8/8 fiches lues'), 'trace MORTAISE_lecture « 8/8 fiches lues le … »')

async def complet():
    print('Parcours complet')
    async with Page('mortaiseuse', scorm=True) as pg:
        s = await pg.eval(ST)
        check(s['ui'] == 'parcours' and s['ph'] == 'rep', 'démarrage en disposition parcours, phase repérage')
        check((await pg.eval("__store['cmi.core.lesson_status']")) == 'incomplete', 'statut « incomplete » au départ')
        tg = await reperage(pg, wrong=(3, 9))
        check(len(tg) == 15, '15 organes à repérer')
        s = await pg.eval(ST); check(s['ph'] == 'qcm', 'repérage terminé → QCM')
        ans = await qcm(pg, wrong=(2, 7, 15))
        check(len(ans) == 20, '20 questions')
        mid = await pg.eval("__store['cmi.suspend_data']")
        for k, mode in enumerate(['bedane', 'simple', 'serie']):
            await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
            if k == 2:
                vis = await pg.eval("()=>getComputedStyle(document.querySelector('.debit')).display!=='none' && document.getElementById('debit').textContent.includes('Montant 2')")
                check(vis, '« Pièces débitées » visible pendant le scénario (montants en attente)')
            r = await pg.eval(js(JEUX[mode]))
            check(all(row[2] == '✓' for row in r['res']), f'scénario {k+1} ({mode}) : contrôle conforme' + ('' if all(row[2] == '✓' for row in r['res']) else f" {r['res']}"))
            await pg.page.click('#scenEnd'); await pg.page.wait_for_timeout(300)
        s = await pg.eval(ST)
        check(s['ph'] == 'fin' and 'Module réussi · 94 / 100' in s['card'], 'note finale 94 / 100, module réussi' + ('' if 'Module réussi · 94 / 100' in s['card'] else ' : ' + s['card'][:300]))
        store = await pg.eval('__store')
        check(store['cmi.core.score.raw'] == '94' and store['cmi.core.score.min'] == '0' and store['cmi.core.score.max'] == '100', 'score.raw / min / max envoyés')
        check(store['cmi.core.lesson_status'] == 'passed', 'statut « passed » posé par le module')
        n = int(store['cmi.interactions._count']); ids = [store[f'cmi.interactions.{i}.id'] for i in range(n)]
        check(n == 51, f'51 interactions (15 repérage + 20 QCM + 15 critères de scénarios + 1 bilan) : {n}')
        check(all(i.startswith('MORTAISE_') for i in ids), 'identifiants préfixés « MORTAISE_ »')
        b = [i for i in range(n) if store[f'cmi.interactions.{i}.id'] == 'MORTAISE_bilan']
        check(len(b) == 1 and store[f'cmi.interactions.{b[0]}.student_response'].startswith('VALIDÉE') and store[f'cmi.interactions.{b[0]}.result'] == 'correct',
              'bilan : ' + (store[f'cmi.interactions.{b[0]}.student_response'] if b else '?'))
        check(store.get('cmi.objectives.0.id') == 'MORTAISE' and store.get('cmi.objectives.0.status') == 'passed' and store.get('cmi.objectives.0.score.raw') == store['cmi.core.score.raw'], 'objectif SCORM « MORTAISE » réussi, même note')
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
    async with Page('mortaiseuse', scorm=True, suspend=mid) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'scen-intro' and s['qi'] == 20 and 'Scénario 1 / 3' in s['card'], 'reprise au scénario 1 (repérage et QCM conservés)')
    print('Reprise d\'un scénario interrompu avec une faute grave')
    o = json.loads(mid); o.update(ph='scen', si=1, scens=[{'pts': 20, 'crit': [], 'dangers': []}], dangers=['PIÈCE NON SERRÉE : test'])
    async with Page('mortaiseuse', scorm=True, suspend=json.dumps(o)) as pg:
        s = await pg.eval(ST)
        check(s['ph'] == 'scen-intro' and s['si'] == 1 and 'Scénario 2 / 3' in s['card'], 'scénario interrompu repris depuis son introduction')
        check(s['dangers'] == ['PIÈCE NON SERRÉE : test'], 'faute grave du scénario interrompu conservée')

async def faute_grave(mid):
    print('Fautes graves pendant un scénario')
    async with Page('mortaiseuse', scorm=True, suspend=mid) as pg:   # repris après le QCM : scénario 1 « Changer le bédane »
        await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
        r = await pg.eval(js(BASE + r"""
          on('asp'); next(); on('capot'); off('tight'); const t1=M.st.tight; const d1=__atelier.parc.dangers.slice(); off('capot');
          return {t1, d1};"""))
        check(r['t1'] is True and any(d.startswith('INTERVENTION SUR LE BÉDANE SANS CONSIGNATION') for d in r['d1']), 'bédane desserré sans consignation : refusé, faute grave relevée')
        # le scénario 1 est validé tel quel (faute comprise), puis scénario 2 : cycle lancé pièce non serrée, vérin devant le bédane
        await pg.eval("()=>{ const A=__atelier.app; A.ex.step=A.ex.STEPS.length-1; A.ex.invalidate(); A.apply(); }"); await pg.page.wait_for_timeout(200)
        await pg.page.click('#scenEnd'); await pg.page.wait_for_timeout(300)
        await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
        r = await pg.eval(js(BASE + r"""
          on('asp'); next(); take("Pièce d'essai"); green();
          const before=alerts().filter(a=>a.startsWith('danger'));
          $('bed').click(); await sleep(150);                      // pièce non serrée, vérin devant le bédane
          const d1=__atelier.parc.dangers.slice();
          op('aside'); const still=!!TB();                         // pièce touchée pendant le cycle : refusé
          const d2=__atelier.parc.dangers.slice();
          await until(()=>!M.cyc.on,900); await until(()=>M.model.amp<0.02);
          return {before, d1, d2, still, card:$('parcCard').textContent};"""))
        for k in ('PIÈCE NON SERRÉE', 'VÉRIN DEVANT LE BÉDANE'):
            check(any(k in a for a in r['before']), f'alerte rouge avant le cycle : {k.lower()}')
            check(any(d.startswith(k) for d in r['d1']), f'faute grave relevée au démarrage du cycle : {k.lower()}')
        check(r['still'] and any(d.startswith('MAINS DANS LA ZONE DE L\'OUTIL') for d in r['d2']), 'pièce touchée pendant le cycle : refusé, faute grave relevée')
        n = len(r['d2']); check(f'Fautes graves relevées : {n}' in r['card'], f'{n} fautes affichées dans la carte du parcours')
        await pg.eval("()=>{ const A=__atelier.app; A.ex.step=A.ex.STEPS.length-1; A.ex.invalidate(); A.apply(); }"); await pg.page.wait_for_timeout(200)
        await pg.page.click('#scenEnd'); await pg.page.wait_for_timeout(300)
        await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(300)
        await pg.eval("()=>{ const A=__atelier.app; A.ex.step=A.ex.STEPS.length-1; A.ex.invalidate(); A.apply(); }"); await pg.page.wait_for_timeout(200)
        await pg.page.click('#scenEnd'); await pg.page.wait_for_timeout(300)
        store = await pg.eval('__store')
        check(store['cmi.core.lesson_status'] == 'failed' and int(store['cmi.core.score.raw']) <= 69, f"module non validé, note Moodle {store['cmi.core.score.raw']} (69 au plus avec une faute grave)")
        n = int(store['cmi.interactions._count']); fa = [store[f'cmi.interactions.{i}.id'] for i in range(n) if '_faute_' in store[f'cmi.interactions.{i}.id']]
        check(len(fa) >= 4 and all(i.startswith('MORTAISE_faute_s') for i in fa), f'{len(fa)} fautes graves tracées (MORTAISE_faute_sN_K)')

XR = "__atelier.app.parts.xray"
async def transparence():
    print('Repérage : vue intérieure jamais bloquée')
    async with Page('mortaiseuse', scorm=True) as pg:
        tg = await pg.eval('__atelier.REP_TARGETS')
        await pg.page.click('#vbed'); await pg.page.wait_for_timeout(200)
        check(not await pg.eval(XR), 'bouton « Bédane » pendant le repérage : pas de vue intérieure imposée')
        await pg.eval("__atelier.app.parts.setXray(true,false)")
        await pg.eval(f"__atelier.repAnswer('{tg[0]}')"); await pg.page.wait_for_function('__atelier.parc.ri>0', timeout=60000)
        check(not await pg.eval(XR), 'question suivante : transparence remise comme la question le demande')
        await pg.page.click('#vop'); await pg.page.wait_for_timeout(800)
        xy = await pg.eval("""()=>{ const st=__atelier.app.stage; st.camera.updateMatrixWorld(); const v=new st.THREE.Vector3(0.32,0.9155,0.14).project(st.camera), r=st.canvas.getBoundingClientRect();
          return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height]; }""")
        cand = None
        for _ in range(3):                      # en headless, un rendu lent peut faire manquer le premier clic
            await pg.page.mouse.click(*xy); await pg.page.wait_for_timeout(300)
            cand = await pg.eval('__atelier.parc.cand')
            if cand == 'table': break
        check(cand == 'table', f'clic sur la table : organe proposé ({cand})')
        i = tg.index('bedane')
        for k in range(1, i):
            await pg.eval(f"__atelier.repAnswer('{tg[k]}')"); await pg.page.wait_for_function(f'__atelier.parc.ri>{k}', timeout=60000)
        check(await pg.eval(XR), 'question « bédane » : vue intérieure affichée (capot translucide)')
        j = tg.index('taquets_prof')
        for k in range(i, j):
            await pg.eval(f"__atelier.repAnswer('{tg[k]}')"); await pg.page.wait_for_function(f'__atelier.parc.ri>{k}', timeout=60000)
        check(not await pg.eval(XR), 'question « règle et taquets de profondeur » : vue normale')

async def main():
    await fiches()
    await transparence()
    mid = await complet()
    await reprise(mid)
    await faute_grave(mid)

if __name__=="__main__": run(main)
