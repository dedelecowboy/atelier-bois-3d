# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Note envoyée à Moodle : plafonnée à 69 s'il y a une faute grave (décidé par l'enseignant le 28/10/2026),
pour que « note ≥ 70 » dans les rapports veuille toujours dire « machine validée » (attestations)."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, check, run

def etat(dangers):
    sc = {'pts': 20, 'crit': [], 'dangers': []}
    return json.dumps({'v': 2, 'ph': 'scen', 'ri': 15, 'rk': [1]*15, 'qi': 20, 'qk': [1]*20, 'si': 2,
                       'scens': [sc, sc], 'dangers': dangers})

async def main():
    for dangers, attendu in (([], None), (['MAIN DANS LA ZONE DANGEREUSE : test'], '69')):
        async with Page('scie-radiale', scorm=True, suspend=etat(dangers)) as pg:
            await pg.page.wait_for_timeout(800)
            await pg.eval("()=>window.__atelier.finishScen()")
            await pg.page.wait_for_timeout(300)
            s = await pg.eval("()=>({ raw:__store['cmi.core.score.raw'], st:__store['cmi.core.lesson_status'], obj:__store['cmi.objectives.0.score.raw'],"
                              " total:__atelier.parc.total, bilan:Object.entries(__store).find(([k,v])=>/interactions\\.\\d+\\.id/.test(k)&&v.endsWith('_bilan')),"
                              " card:document.getElementById('parcCard').innerText })")
            n = int(s['bilan'][0].split('.')[2]); b = await pg.eval(f"()=>__store['cmi.interactions.{n}.student_response']")
            if not dangers:
                check(s['raw'] == str(s['total']) and s['st'] == 'passed', f'sans faute grave : note Moodle = vraie note ({s["raw"]}), réussi')
            else:
                check(s['total'] >= 70 and s['raw'] == attendu and s['obj'] == attendu and s['st'] == 'failed',
                      f'faute grave : vraie note {s["total"]}, note Moodle {s["raw"]} (objectif {s["obj"]}), échec')
                check(f'{s["total"]}/100 (note Moodle 69, faute grave)' in b, f'bilan : {b[:90]}…')
                check('ramenée à 69' in s['card'].lower(), 'écran de fin : la note enregistrée est expliquée : ' + s['card'][:160].replace(chr(10), ' '))

if __name__ == '__main__': run(main)
