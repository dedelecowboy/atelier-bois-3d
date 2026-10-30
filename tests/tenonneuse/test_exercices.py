# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Tenonneuse : les trois exercices guidés de bout en bout (tenon simple, série aux deux bouts, enfourchement et machine à contrôler)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, ATTENDU

ETAPES = ('préparation', 'capot', 'scie', 'capot2', 'dérouleurs', 'pare-éclat', 'pièce', 'usinage', 'essai', 'premier bout', 'butée', 'deuxième bout', 'machine', 'réglages', 'hauteurs', 'lot', 'fin')

async def main():
    async with Page('tenonneuse') as pg:
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
            if mode == 'tenon':
                check('scie refusée capot fermé:true' in m, 'position de la scie refusée capot fermé (compteur sous le capot)')
                check('réglage en descendant signalé:true' in m, 'épaisseur réglée en descendant : alerte « régler en montant »')
                check('réglage refusé outils en marche:true' in m, 'hauteur du dérouleur refusée outils en marche')
                check('non serrée signalée:true' in m, 'pièce posée sans presse : alerte rouge « pièce non serrée »')
            if mode == 'serie':
                check('butée refusée outils en marche:true' in m, 'butée de longueur refusée outils en marche')
            if mode == 'enfourchement':
                check('vitesse trop haute signalée:true' in m, 'fraise n max 4 500 sur un arbre à 6 000 tr/min : alerte rouge')
                check('outil refusé non consigné:true' in m, 'outil non changé machine non consignée')
                check('pièce courte signalée:true' in m, 'pièce de 200 mm sur le chariot : alerte rouge « pièce trop courte »')
            dang = [a for a in m if a.startswith('danger') and not any(k in a for k in ('VITESSE TROP', 'TROP COURTE', 'NON SERRÉE'))]
            check(not dang, 'aucune autre alerte danger au moment des passes' + ('' if not dang else ' : ' + dang[0]))
        await pg.eval("()=>document.getElementById('vtenon').click()"); await pg.page.wait_for_timeout(600)
        print(await pg.shot('tenonneuse_ex_fin.png'))

if __name__ == '__main__': run(main)
