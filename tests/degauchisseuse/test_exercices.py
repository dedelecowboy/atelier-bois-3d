# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Dégauchisseuse : les trois exercices guidés de bout en bout (rectiligne, cintrée, fil incliné)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, ATTENDU

async def main():
    async with Page('degauchisseuse') as pg:
        for mode, jeu in JEUX.items():
            print(f'Exercice {mode}')
            await pg.eval(f"()=>document.querySelector('[data-mode={mode}]').click()")
            await pg.page.wait_for_timeout(100)
            r = await pg.eval(js(jeu))
            for st in r['log']:
                if st['tag'].startswith(('sr1 après','sr2 après','repère','fin')): check(st['ok'], f"{st['tag']} : étape réussie ({st['step']})")
            got = [row[:2] for row in r['res']]
            check(got[:5] == ATTENDU[mode], f'contrôle final conforme : {got}')
            check(all(row[2] == '✓' for row in r['res']), 'toutes les lignes du contrôle sont cochées')
            dang = [m for m in r['msgs'] if m.startswith('danger')]
            check('alerte bec vertical sur chant:true' in r['msgs'], 'pièce sur chant avec le bec vertical : alerte rouge « bec mal orienté »')
            dang = [m for m in dang if 'BEC D' not in m]
            if mode == 'courbe':
                check('instable au départ:true' in r['msgs'] and 'stable retournée:true' in r['msgs'], 'pièce posée sur son bombé : alerte « pièce instable », levée une fois retournée')
                n = int([m for m in r['msgs'] if m.startswith('passes SR1:')][0].split(':')[1])
                check(n >= 2, f'pièce cintrée : {n} passes pour dresser SR1 (une seule ne suffit pas)')
                dang = [m for m in dang if 'INSTABLE' not in m]
            if mode == 'fil':
                check('arrachée contre le fil:true' in r['msgs'], 'passe contre le fil : arrachements')
                check('propre dans le sens du fil:true' in r['msgs'], 'repasse bout pour bout : arrachements effacés')
            check(not dang, 'aucune alerte danger pendant les passes' + ('' if not dang else ' : ' + dang[0]))

if __name__ == '__main__': run(main)
