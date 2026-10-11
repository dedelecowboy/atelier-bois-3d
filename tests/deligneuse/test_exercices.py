"""Déligneuse multilames : les trois exercices guidés de bout en bout (avivés, plateau de plot, multidélignage)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, ATTENDU

async def main():
    async with Page('deligneuse') as pg:
        for mode, jeu in JEUX.items():
            print(f'Exercice {mode}')
            await pg.eval(f"()=>document.querySelector('[data-mode={mode}]').click()")
            await pg.page.wait_for_timeout(100)
            r = await pg.eval(js(jeu))
            for st in r['log']:
                if st['tag'] in ('préparation', 'réglages', 'position', 'passe 1', 'passe 2', 'passe', 'fin'): check(st['ok'], f"{st['tag']} : étape réussie ({st['step']})")
            got = [row[:2] for row in r['res']]
            check(got[:len(ATTENDU[mode])] == ATTENDU[mode], f'contrôle final conforme : {got}')
            check(all(row[2] == '✓' for row in r['res']), 'toutes les lignes du contrôle sont cochées (ampèremètre jamais en surcharge compris)')
            m = r['msgs']
            if mode == 'avive':
                check('presseurs trop hauts au départ:true' in m, 'presseurs à 60 mm pour 27 mm : alerte rouge « presseurs trop hauts »')
                check('manchon refusé lames en marche:true' in m, 'changement de manchon refusé tant que les lames tournent')
                check('ampèremètre bas à 24 m/min:true' in m, '1 lame dans du sapin à 24 m/min : on peut accélérer')
                check('passe refusée tapis arrêté:true' in m, 'pièce engagée tapis arrêté : refusé')
                check('sortie à dégager:true' in m, 'nouvelle passe refusée tant que la sortie n\'est pas dégagée')
                check('ramener refusé sans évacuer:true' in m, '« Ramener la pièce » refusé avant d\'évacuer les chutes')
                check('reprise 91,8:true' in m, 'la pièce de 91,8 mm (gardée, contour orange) est ramenée pour la deuxième passe')
            if mode == 'plot':
                check('alertes rouges au départ:3' in m, 'plateau au départ : presseurs trop hauts, posé sur sa petite face, rive en flache contre le guide')
                check('petit bout en premier:true' in m, 'petit bout vers la machine : alerte « engagez par le gros bout »')
                check('flache entre les traits:true' in m, 'trait dans la flache : information affichée')
                check('surcharge à 24 m/min:true' in m, 'chêne de 41 mm, 2 lames, 24 m/min : ampèremètre en surcharge')
            if mode == 'multi':
                check('surcharge 4 lames à 24 m/min:true' in m, '4 lames dans du hêtre à 24 m/min : ampèremètre en surcharge')
            dang = [a for a in m if a.startswith('danger')]
            check(not dang, 'aucune alerte danger au moment des passes' + ('' if not dang else ' : ' + dang[0]))

if __name__ == '__main__': run(main)
