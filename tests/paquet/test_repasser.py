# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Nouvelle tentative d'une machine non validée (demandé par l'enseignant le 06/11/2026) : on ne refait que les parties ratées,
sans limite, et chaque tentative est comptée dans les traces Moodle. Le statut et la note ne bougent pas avant le nouveau résultat."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, check, run

SC = {'pts': 20, 'crit': [], 'dangers': []}
FAUTE = {'pts': 16, 'crit': [], 'dangers': ['MAIN DANS LA ZONE DANGEREUSE : test']}

def fin(rk=15, qk=20, scens=(SC, SC, SC), **autres):
    """évaluation terminée et non validée, telle qu'enregistrée dans Moodle"""
    return json.dumps({'v': 2, 'ph': 'fin', 'ri': 15, 'rk': [1]*rk + [0]*(15-rk), 'qi': 20, 'qk': [1]*qk + [0]*(20-qk), 'si': 3,
                       'scens': list(scens), 'dangers': [], 'done': True, 'total': 60, 'note': 60, 'passed': False, **autres})

ETAT = """()=>{ const p=__atelier.parc, S=__store, n=+S['cmi.interactions._count']||0, I=[];
  for(let i=0;i<n;i++) I.push([S[`cmi.interactions.${i}.id`], S[`cmi.interactions.${i}.student_response`], S[`cmi.interactions.${i}.result`]]);
  return { ph:p.ph, si:p.si, ri:p.ri, qi:p.qi, rk:p.rk.length, qk:p.qk.length, scens:p.scens.map(s=>s?s.pts:null), essai:p.essai, todo:p.todo, done:p.done, passed:p.passed,
           st:S['cmi.core.lesson_status'], raw:S['cmi.core.score.raw'], I, card:document.getElementById('parcCard').textContent,
           steps:[...document.querySelectorAll('#parcSteps li')].map(l=>l.dataset.s), sd:S['cmi.suspend_data'], mode:__atelier.app.ex.mode, step:__atelier.app.ex.step }; }"""

async def termine_qcm(pg):
    await pg.eval("""()=>{ const A=__atelier, Q=A.QCM, card=document.getElementById('parcCard');
      for(let i=A.parc.qi;i<Q.length;i++){ card.querySelector(`[data-q="${Q[i].a}"]`).click(); document.getElementById('qNext').click(); } }""")
    await pg.page.wait_for_timeout(150)

async def fait_scenario(pg, fautes=()):
    await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(250)
    await pg.eval("(F)=>{ __atelier.parc.dangers.push(...F); __atelier.finishScen(); }", list(fautes))
    await pg.page.wait_for_timeout(250)

async def main():
    print(' QCM et scénario 2 ratés')
    async with Page('scie-radiale', scorm=True, suspend=fin(qk=10, scens=(SC, FAUTE, SC))) as pg:
        await pg.eval("()=>{ __store['cmi.core.lesson_status']='failed'; __store['cmi.core.score.raw']='69'; }")
        s = await pg.eval(ETAT)
        check(s['ph'] == 'fin' and 'À refaire : QCM sécurité, scénario 2' in s['card'] and 'Repasser ce qui est raté' in s['card'], 'résultat : ' + s['card'][-90:].replace(chr(10), ' '))
        await pg.shot('repasser_resultat_ordinateur.png')
        d = await pg.eval("()=>{ const r=document.getElementById('parcRetry').getBoundingClientRect(); return r.bottom<=innerHeight; }")
        check(d, 'ordinateur : le bouton est visible sans faire défiler')
        await pg.page.click('#parcRetry'); await pg.page.wait_for_timeout(250)
        s = await pg.eval(ETAT)
        check(s['ph'] == 'qcm' and s['qi'] == 0 and s['qk'] == 0 and s['essai'] == 2 and s['todo'] == ['qcm', 's1'], 'le QCM repart de la première question, tentative 2')
        check(s['rk'] == 15 and s['scens'] == [20, None, 20], 'le repérage et les scénarios 1 et 3 sont gardés, le scénario 2 est effacé')
        check(s['st'] == 'failed' and s['raw'] == '69', 'statut et note Moodle inchangés pendant la nouvelle tentative (verrous et badge inchangés)')
        t = [i for i in s['I'] if i[0] == 'RADIALE_tentative_2']
        check(len(t) == 1 and 'à refaire QCM sécurité, scénario 2' in t[0][1], 'tentative comptée : ' + t[0][1])
        check(s['steps'][1] == 'done' and s['steps'][2] == 'cur' and s['steps'][3] == 'done' and s['steps'][4] == 'lock' and s['steps'][5] == 'done', f'étapes : {s["steps"]}')
        await termine_qcm(pg)
        s = await pg.eval(ETAT)
        check(s['ph'] == 'scen-intro' and s['si'] == 1 and 'Tentative 2' in s['card'] and 'Scénario 2' in s['card'], 'après le QCM, on passe directement au scénario 2')
        sd = s['sd']
    print(' reprise de la tentative après fermeture de la page')
    async with Page('scie-radiale', scorm=True, suspend=sd) as pg:
        await pg.eval("()=>{ __store['cmi.core.lesson_status']='failed'; __store['cmi.core.score.raw']='69'; }")
        s = await pg.eval(ETAT)
        check(s['ph'] == 'scen-intro' and s['si'] == 1 and s['essai'] == 2 and s['qk'] == 20, 'la tentative reprend au scénario 2')
        await pg.page.click('#scenGo'); await pg.page.wait_for_timeout(250)
        s = await pg.eval(ETAT)
        check(s['ph'] == 'scen' and s['step'] == 0, 'le scénario 2 repart de sa première étape')
        check('scénario suivant' not in s['card'] , 'bouton du dernier scénario à refaire : ' + s['card'][-60:].replace(chr(10), ' '))
        await pg.eval("()=>__atelier.finishScen()"); await pg.page.wait_for_timeout(300)
        s = await pg.eval(ETAT)
        check(s['ph'] == 'fin' and s['done'] and s['passed'] and s['st'] == 'passed' and int(s['raw']) >= 70, f'machine validée à la tentative 2 : {s["raw"]} / 100, statut {s["st"]}')
        b = [i for i in s['I'] if i[0] == 'RADIALE_bilan']
        check(len(b) == 1 and b[0][1].startswith('VALIDÉE') and 'Tentative 2' in b[0][1], 'bilan : ' + b[0][1])
        check('parcRetry' not in await pg.eval("()=>document.getElementById('parcCard').innerHTML"), 'machine validée : plus de bouton pour repasser')
        check(await pg.eval("()=>!!document.querySelector('.pf-fete')"), 'badge fêté à la réussite')

    print(' faute grave répétée : aucune limite, seul le scénario fautif est à refaire')
    async with Page('scie-radiale', scorm=True, suspend=fin(scens=(SC, SC, FAUTE))) as pg:
        for essai in (2, 3):
            await pg.page.click('#parcRetry'); await pg.page.wait_for_timeout(250)
            s = await pg.eval(ETAT)
            check(s['ph'] == 'scen-intro' and s['si'] == 2 and s['essai'] == essai and s['todo'] == ['s2'], f'tentative {essai} : scénario 3 seul')
            await fait_scenario(pg, ['MAIN DANS LA ZONE DANGEREUSE : test'])
            s = await pg.eval(ETAT)
            check(s['ph'] == 'fin' and not s['passed'] and s['st'] == 'failed' and s['raw'] == '69', f'tentative {essai} avec faute grave : échec, note 69')
        b = [i[1] for i in s['I'] if i[0] == 'RADIALE_bilan']
        check(len(b) == 2 and 'Tentative 2' in b[0] and 'Tentative 3' in b[1], 'une ligne de bilan par tentative : ' + b[1][:60])
        check('Tentative 3' in s['card'] and 'Repasser ce qui est raté' in s['card'], 'on peut encore repasser')

    print(' note sous 70 sans faute grave')
    async with Page('scie-radiale', scorm=True, suspend=fin(rk=6, qk=8, scens=({**SC, 'pts': 8}, SC, {**SC, 'pts': 12}))) as pg:
        await pg.page.click('#parcRetry'); await pg.page.wait_for_timeout(300)
        s = await pg.eval(ETAT)
        check(s['ph'] == 'rep' and s['ri'] == 0 and s['todo'] == ['rep', 'qcm', 's0', 's2'], f'parties sous 70 % : {s["todo"]}')
        check('Trouvez' in s['card'], 'le repérage repart de la première question')
        for i, k in enumerate(await pg.eval("()=>__atelier.REP_TARGETS")):
            await pg.eval("(k)=>__atelier.repAnswer(k)", k)
            await pg.page.wait_for_function("(i)=>__atelier.parc.ph!=='rep'||__atelier.parc.ri>i", arg=i, timeout=8000)
            await pg.page.wait_for_timeout(120)
        s = await pg.eval(ETAT)
        check(s['ph'] == 'qcm', 'après le repérage : QCM')
        await termine_qcm(pg); await fait_scenario(pg)
        s = await pg.eval(ETAT)
        check(s['ph'] == 'scen-intro' and s['si'] == 2, 'le scénario 2, réussi, est sauté')

    print(' repérage repris sur la scie à format : lame remontée à 80 mm')
    async with Page('scie-format', scorm=True, suspend=fin(rk=6, qk=20)) as pg:
        await pg.page.click('#parcRetry'); await pg.page.wait_for_timeout(300)
        s = await pg.eval(ETAT)
        check(s['ph'] == 'rep' and s['todo'] == ['rep'], 'repérage seul à refaire')
        check(await pg.eval("()=>__scie.st.h") == 80, 'machine remise en place, lame à 80 mm comme au premier repérage')

    print(' paquetage unique : la carte d\'entrée')
    init = """window.ATELIER_PKG={atelier:'Atelier',titles:{'scie-radiale':'1. Scie radiale',risques:'0. Risques généraux'},prereq:{'scie-radiale':'risques'}};
      try{ localStorage.setItem('atelier.bilan.risques', JSON.stringify({total:50,passed:false,date:''})); }catch(e){}"""
    async with Page('scie-radiale', scorm=True, suspend=fin(qk=6), init=init) as pg:
        c = await pg.eval("()=>({t:document.getElementById('chEvalT').textContent, s:document.getElementById('chEvalS').textContent, d:document.getElementById('chEval').disabled})")
        check(c['t'] == 'Voir mon résultat' and 'repasser' in c['s'] and not c['d'], 'évaluation terminée : ' + c['s'])
    rep = json.dumps({'v': 2, 'ph': 'rep', 'ri': 0, 'rk': [], 'qi': 20, 'qk': [1]*20, 'si': 0, 'scens': [SC, SC, SC], 'dangers': [], 'done': False, 'essai': 2, 'todo': ['rep'], 'passed': False})
    async with Page('scie-radiale', scorm=True, suspend=rep, init=init) as pg:
        c = await pg.eval("()=>({t:document.getElementById('chEvalT').textContent, d:document.getElementById('chEval').disabled})")
        check(c['t'] == "Reprendre l'évaluation" and not c['d'], 'tentative commencée : jamais bloquée à la reprise')

    print(' téléphone')
    async with Page('scie-radiale', scorm=True, suspend=fin(qk=10, scens=(SC, FAUTE, SC)), viewport=(412, 860), touch=True) as pg:
        await pg.page.wait_for_timeout(300)
        await pg.eval("()=>document.getElementById('parcRetry').scrollIntoView({block:'center'})")
        await pg.shot('repasser_resultat_telephone.png')
        d = await pg.eval("()=>{ const r=document.getElementById('parcRetry').getBoundingClientRect(); return {l:r.left, r:r.right, w:innerWidth, sw:document.documentElement.scrollWidth}; }")
        check(d['l'] >= 0 and d['r'] <= d['w'] and d['sw'] <= d['w'] + 1, f'bouton entier à l\'écran, pas de défilement de côté ({d})')
        await pg.page.tap('#parcRetry'); await pg.page.wait_for_timeout(250)
        check((await pg.eval(ETAT))['ph'] == 'qcm', 'au doigt : la tentative démarre')
        await pg.shot('repasser_qcm_telephone.png')

if __name__ == '__main__': run(main)
