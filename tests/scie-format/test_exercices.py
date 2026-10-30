# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Scie à format : les trois exercices guidés de bout en bout, avec contrôle des résultats et du cycle de coupe."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, ATTENDU

async def main():
    async with Page('scie-format') as pg:
        for mode, jeu in JEUX.items():
            print(f'Exercice {mode}')
            await pg.eval(f"()=>document.querySelector('[data-mode={mode}]').click()")
            await pg.page.wait_for_timeout(100)
            r = await pg.eval(js(jeu))
            for st in r['log'][1:-1]:
                if st['tag'].endswith('done'): check(st['ok'], f"{st['tag']} : étape réussie ({st['step']})")
            got = [row[:2] for row in r['res']]
            check(got == ATTENDU[mode], f'contrôle final conforme : {got}')
            check(all(row[2] == '✓' for row in r['res']), 'toutes les lignes du contrôle sont cochées')
            if mode == 'format':
                # après l'aller, le retour du chariot est bloqué tant que la chute n'est pas évacuée
                check(any('Chute à évacuer' in t for t in r['evac']), 'alerte « chute à évacuer » après l\'aller')
                check(r['blocked'] == '-1495', 'retour du chariot bloqué avant évacuation de la chute')
            alerts = [a for st in r['log'] for a in st['alerts'] if a.startswith('danger')]
            check(not alerts, 'aucune alerte danger pendant l\'exercice')

if __name__=="__main__": run(main)
