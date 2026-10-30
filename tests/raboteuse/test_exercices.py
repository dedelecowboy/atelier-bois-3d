# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Raboteuse : les trois exercices guidés de bout en bout (épaisseur de deux montants, largeur sur chant, contrôle du lot et fil)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, ATTENDU

ETAPES = ('préparation', 'réglage', 'réglage largeur', 'largeur', 'réglage épaisseur', 'épaisseur', 'largeur série', 'épaisseur série', 'contrôle du lot', 'fin')

async def main():
    async with Page('raboteuse') as pg:
        for mode, jeu in JEUX.items():
            print(f'Exercice {mode}')
            await pg.eval(f"()=>document.querySelector('[data-mode={mode}]').click()")
            await pg.page.wait_for_timeout(100)
            r = await pg.eval(js(jeu))
            for st in r['log']:
                if st['tag'] in ETAPES: check(st['ok'], f"{st['tag']} : étape réussie ({st['step']})")
            got = [row[:2] for row in r['res']]
            check(got == ATTENDU[mode], f'contrôle final conforme : {got}')
            check(all(row[2] == '✓' for row in r['res']), 'toutes les lignes du contrôle sont cochées')
            m = r['msgs']
            if mode == 'piece':
                check('moteur refusé capot ouvert:true' in m, 'capot ouvert : le moteur ne démarre pas (interverrouillage)')
                check('SR1 dessus au départ:true' in m, 'pièce posée SR1 dessus : alerte « face de référence dessus »')
            if mode == 'serie':
                check('largeurs différentes de front:true' in m, 'deux montants de largeurs différentes sur chant, de front : alerte rouge')
                check('de front même largeur sans alerte:true' in m, 'après une passe à la même cote : de front sans alerte')
            if mode == 'controle':
                check('chêne : face non dressée signalée:true' in m, 'pièce de chêne brute sur la table : « section de pièce non rectangulaire »')
                check('arrachements contre le fil:true' in m, 'frêne présenté contre le fil : arrachements')
                check('arrachements effacés bout pour bout:true' in m, 'bout pour bout, passe de 1 mm au moins : arrachements effacés')
            dang = [a for a in m if a.startswith('danger') and 'HAUTEURS DIFFÉRENTES' not in a]
            check(not dang, 'aucune autre alerte danger au moment des passes' + ('' if not dang else ' : ' + dang[0]))
        print(await pg.shot('raboteuse_ex_fin.png'))

if __name__ == '__main__': run(main)
