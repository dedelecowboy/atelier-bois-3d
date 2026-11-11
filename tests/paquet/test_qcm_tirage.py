# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""QCM tiré au hasard (décidé par l'enseignant le 07/11/2026) : banque d'environ 30 questions par module, 20 tirées à
chaque tentative, dans un ordre au hasard, réponses mélangées.
1. Deux élèves n'ont pas les mêmes questions dans le même ordre ; 20 questions distinctes de la banque.
2. Traces : CODE_qcm_NN = numéro de la question dans la banque, réponse = lettre du fichier (la bonne réponse donne la lettre
   de la ligne « + » du fichier, quel que soit l'ordre affiché).
3. Reprise au milieu du QCM : mêmes questions, même ordre des réponses (suspend_data qs / qo).
4. Ancienne sauvegarde (sans qs) reprise au milieu du QCM : questions dans l'ordre du fichier, sans erreur."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, check, run

async def jusqu_au_qcm(pg):
    tg = await pg.eval('__atelier.REP_TARGETS')
    for i, t in enumerate(tg):
        await pg.eval(f"__atelier.repAnswer('{t}')")
        await pg.page.wait_for_function(f'__atelier.parc.ri>{i}', timeout=60000)

async def main():
    tirages = []
    for n in range(2):
        async with Page('scie-radiale', scorm=True) as pg:
            await jusqu_au_qcm(pg)
            p = await pg.eval("()=>({ qs:__atelier.parc.qs, banque:__atelier.BANQUE.length, ph:__atelier.parc.ph })")
            check(p['ph'] == 'qcm' and len(p['qs']) == 20 and len(set(p['qs'])) == 20 and p['banque'] == 30 and all(0 <= i < 30 for i in p['qs']),
                  f'élève {n+1} : 20 questions distinctes tirées dans la banque de 30')
            tirages.append(p['qs'])
            if n == 0:
                # 3 réponses justes, puis on garde la sauvegarde pour la reprise
                for k in range(3):
                    a = await pg.eval(f"__atelier.QCM[{k}].a")
                    await pg.page.click(f'#parcCard [data-q="{a}"]'); await pg.page.click('#qVal'); await pg.page.click('#qNext')
                I = await pg.eval("()=>{ const S=__store, n=+S['cmi.interactions._count']||0, o=[]; for(let i=0;i<n;i++) o.push([S[`cmi.interactions.${i}.id`],S[`cmi.interactions.${i}.student_response`],S[`cmi.interactions.${i}.result`]]); return o.filter(x=>/_qcm_/.test(x[0])); }")
                bonne = await pg.eval("()=>__atelier.parc.qs.slice(0,3).map(i=>'abcdef'[__atelier.BANQUE[i].a])")
                num = [f'RADIALE_qcm_{i+1:02d}' for i in tirages[0][:3]]
                check([x[0] for x in I] == num, f'identifiants = numéros dans la banque {[x[0] for x in I]}')
                check([x[1] for x in I] == bonne and all(x[2] == 'correct' for x in I), f'réponse = lettre de la bonne réponse dans le fichier {[x[1] for x in I]}')
                ordre = await pg.eval("()=>__atelier.QCM.slice(3,6).map(q=>q.o.join('|'))")
                mid = await pg.eval("__store['cmi.suspend_data']")
    check(tirages[0] != tirages[1], 'deux élèves : questions ou ordre différents')
    async with Page('scie-radiale', scorm=True, suspend=mid) as pg:
        p = await pg.eval("()=>({ qs:__atelier.parc.qs, qi:__atelier.parc.qi, ph:__atelier.parc.ph, o:__atelier.QCM.slice(3,6).map(q=>q.o.join('|')), card:document.getElementById('parcCard').innerText })")
        check(p['qs'] == tirages[0] and p['qi'] == 3 and p['ph'] == 'qcm' and p['o'] == ordre and 'question 4 / 20' in p['card'].lower(),
              'reprise : mêmes questions, même ordre des réponses, question 4 / 20')
    o = json.loads(mid); o.pop('qs', None); o.pop('qo', None)
    async with Page('scie-radiale', scorm=True, suspend=json.dumps(o)) as pg:
        p = await pg.eval("()=>({ qs:__atelier.parc.qs, card:document.getElementById('parcCard').innerText })")
        check(p['qs'] == list(range(20)) and 'question 4 / 20' in p['card'].lower(), 'ancienne sauvegarde : questions dans l\'ordre du fichier, reprise à la question 4')

if __name__ == '__main__': run(main)
