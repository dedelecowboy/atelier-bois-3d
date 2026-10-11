"""Scie radiale : les trois exercices guidés de bout en bout (débit en série, purge des défauts, coupe inclinée),
puis les gestes refusés (pièce touchée lame en avant, réglages lame en marche)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, ATTENDU, BASE

GESTES = BASE + r"""
 const r={};
 on('motor'); document.querySelector('[data-alpha="45"]').click(); r.angle=alerts().some(a=>a.includes('Arrêtez la lame'));
 setN('prot-n',50); r.prot=$('prot-n').value==='32';
 op('guide'); trim(); await pull();
 op('xp10'); r.lameAvant=alerts().some(a=>a.startsWith('danger')&&a.includes('PIÈCE TOUCHÉE LAME EN AVANT'));
 $('pull').click(); r.repull=alerts().some(a=>a.includes('déjà en avant'));
 await ret(); r.efface=!alerts().some(a=>a.includes('PIÈCE TOUCHÉE'));
 op('xp10'); r.deux=alerts().some(a=>a.includes('Deux pièces sur la table'));
 op('evac');
 document.querySelector('[data-hand="d"]').click(); r.croises=alerts().some(a=>a.startsWith('danger')&&a.includes('BRAS CROISÉS'));
 document.querySelector('[data-hand="g"]').click(); op('aside'); [...document.querySelectorAll('[data-take]')].pop().click(); setN('hand-n',250);
 r.vide=alerts().some(a=>a.includes('PIÈCE NON TENUE')); r.court=alerts().some(a=>a.includes('PIÈCE TROP COURTE'));
 return r;"""

async def main():
    async with Page('scie-radiale') as pg:
        for mode, jeu in JEUX.items():
            print(f'Exercice {mode}')
            await pg.eval(f"()=>document.querySelector('[data-mode={mode}]').click()")
            await pg.page.wait_for_timeout(100)
            r = await pg.eval(js(jeu))
            for st in r['log']:
                if st['tag'] not in ('contrôle',): check(st['ok'], f"{st['tag']} : étape réussie ({st['step']})" + ('' if st['ok'] else ' ' + str(st['checks'])))
            got = [row[:2] for row in r['res']]
            check(got[:len(ATTENDU[mode])] == ATTENDU[mode], f'contrôle final conforme : {got}')
            check(r['res'] and all(row[2] == '✓' for row in r['res']), 'toutes les lignes du contrôle sont cochées : ' + str(r['res']))
            m = r['msgs']
            if mode == 'serie':
                check('alertes rouges au départ:2' in m, 'au départ : protecteur trop haut, planche pas plaquée contre le guide')
                check('coupe refusée lame arrêtée:true' in m, 'lame arrêtée : la coupe est refusée')
                check('lame en avant:true' in m, 'après la coupe : alerte « lame en avant, ramenez-la »')
                check('reste trop court:true' in m, 'reste de planche de moins de 300 mm : alerte « pièce trop courte »')
                print('   ', [x for x in m if x.startswith('coupé')])
            if mode == 'purge':
                check('alertes rouges au départ:2' in m, 'au départ : protecteur trop haut, main dans la zone de la lame')
                print('   ', [x for x in m if ':' in x and x.split(':')[0] in ('fente', 'nœud 1', 'nœud 2', 'gerce 1', 'gerce 2')])
            if mode == 'biais':
                check('inclinaison refusée tête bloquée:true' in m, 'inclinaison refusée tant que la tête est bloquée')
            dang = [a for a in m if a.startswith('danger')]
            check(not dang, 'aucune alerte danger au moment des coupes' + ('' if not dang else ' : ' + dang[0]))
        print('Gestes refusés')
        await pg.eval("()=>document.querySelector('[data-mode=libre]').click()"); await pg.page.wait_for_timeout(100)
        r = await pg.eval(js(GESTES))
        check(r['angle'], 'angle du bras refusé lame en marche')
        check(r['prot'], 'protecteur non réglable lame en marche')
        check(r['lameAvant'], 'pièce touchée lame en avant : refusé, alerte rouge « pièce touchée lame en avant »')
        check(r['repull'], 'nouvelle coupe refusée tant que la lame n\'est pas revenue')
        check(r['efface'], 'lame revenue : l\'alerte disparaît')
        check(r['deux'], 'deux pièces sur la table : il faut évacuer les chutes d\'abord')
        check(r['croises'], 'main à droite de la lame : alerte rouge « bras croisés »')
        check(r['vide'], 'chute de 30 mm reprise : main hors du bois, alerte rouge « pièce non tenue »')
        check(r['court'], 'chute de 30 mm reprise : alerte rouge « pièce trop courte »')

if __name__ == '__main__': run(main)
