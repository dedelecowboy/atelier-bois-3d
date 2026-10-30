# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Toupie : les trois exercices guidés de bout en bout (quart de rond, feuillure en deux passes, série et machine à contrôler)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, ATTENDU

ETAPES = ('préparation', 'outil', 'réglages', 'guide', 'pièce', 'usinage', 'passes', 'machine', 'lot', 'série', 'fin')

async def main():
    async with Page('toupie') as pg:
        for mode, jeu in JEUX.items():
            print(f'Exercice {mode}')
            await pg.eval(f"()=>document.querySelector('[data-mode={mode}]').click()")
            await pg.page.wait_for_timeout(100)
            r = await pg.eval(js(jeu))
            for st in r['log']:
                if st['tag'] in ETAPES: check(st['ok'], f"{st['tag']} : étape réussie ({st['step']})" + ('' if st['ok'] else ' ' + str(st['checks'])))
            got = [row[:2] for row in r['res']]
            check(got == ATTENDU[mode], f'contrôle final conforme : {got}')
            check(all(row[2] == '✓' for row in r['res']), 'toutes les lignes du contrôle sont cochées')
            m = r['msgs']
            if mode == 'quart':
                check('montage refusé non consignée:true' in m, 'outil non changé machine non consignée')
                check('poussoir absent signalé:true' in m, 'sans poussoir : alerte rouge « mains près de l\'outil en fin de passe »')
            if mode == 'feuillure':
                check('passe de 15 mm signalée:true' in m, 'feuillure de 15 mm en une passe : alerte rouge « passe trop forte »')
            if mode == 'serie':
                check('vitesse trop haute signalée:true' in m, 'machine préparée à 9 000 tr/min pour un outil n max 8 000 : alerte rouge')
                check('pièce courte signalée:true' in m, 'pièce de 220 mm à l\'entrée : alerte rouge « pièce trop courte »')
            dang = [a for a in m if a.startswith('danger') and not any(k in a for k in ('VITESSE TROP', 'TROP COURTE', 'PASSE TROP FORTE'))]
            check(not dang, 'aucune autre alerte danger au moment des passes' + ('' if not dang else ' : ' + dang[0]))
            if mode == 'serie':
                await pg.eval("()=>document.getElementById('vsortie').click()"); await pg.page.wait_for_timeout(600)
        print(await pg.shot('toupie_ex_fin.png'))

if __name__ == '__main__': run(main)
