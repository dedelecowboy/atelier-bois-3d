"""Scie à ruban : les trois exercices guidés de bout en bout (changement et réglage de la lame, chantournage suivant un
tracé, refente au guide), puis les gestes refusés et les alertes de sécurité en mode libre."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, ATTENDU, BASE

GESTES = BASE + r"""
 const r={}, A=k=>alerts().some(a=>a.includes(k)), D=k=>alerts().some(a=>a.startsWith('danger')&&a.includes(k));
 // réglages et portes refusés lame en marche
 await start(); setN('ten-n',20); r.tension=R.st.ten===10&&A('tous les réglages se font machine arrêtée');
 $('doors').click(); r.portes=!R.st.doors&&A('Portes verrouillées');
 // intervention sur la lame sans consignation (lame arrêtée, portes ouvertes)
 await stop(); $('doors').click(); $('unmount').click(); r.loto=D('INTERVENTION SUR LA LAME SANS CONSIGNATION')&&R.st.blade==='r10';
 // démarrage portes ouvertes refusé
 $('motor').click(); r.demarrage=!R.st.motor&&A('Portes des volants ouvertes');
 // lame retournée : danger
 consigner(); setN('ten-n',0); $('flip').click(); r.envers=D('LAME MONTÉE À L\'ENVERS'); $('flip').click(); setN('ten-n',10); $('hwheel').click(); deconsigner();
 // lame large (30) : elle force dans la courbe ; pas de 15 trop grand pour 27 mm
 consigner(); on('doors'); setN('ten-n',0); $('unmount').click(); sel('r30'); $('flip').click(); $('mount').click(); setN('ten-n',30); dev(5); guides(8.5,31); deconsigner();
 setN('hg-n',32); on('asp'); op('trace'); r.pas=A('moins de 3 dents en prise'); await start(); R.st.steer=-1; r.force=false; for(let i=0;i<14;i++){ R.advance(4); r.force=r.force||A('LA LAME FORCE'); }
 // recul dans la courbe lame en marche : refusé (faute grave)
 R.back(5); r.recul=D('RECUL DANS UNE COURBE');
 // recul lame arrêtée : possible
 await stop(); R.st.steer=0; const z0=R.pieces[0].tz; R.back(10); r.reculOk=R.pieces[0].tz>z0;
 // dégager une chute à la main lame en marche : refusé
 await start(); R.st.steer=0; for(let i=0;i<120;i++){ const o=R.advance(5); if(o===false) break; }
 op('evac'); r.chute=D('CHUTE DÉGAGÉE À LA MAIN'); op('pchute'); r.pchute=R.pieces.filter(q=>q.state==='table').length===1;
 // pièce ronde sans gabarit : refusée
 await stop(); op('aside'); op('reset'); return r;"""

GESTES2 = BASE + r"""
 const r={}, A=k=>alerts().some(a=>a.includes(k)), D=k=>alerts().some(a=>a.startsWith('danger')&&a.includes(k));
 // fin de passe sans poussoir (refente au guide, pièce de 400 mm)
 on('fenceOn'); setN('fx-n',20); setN('hg-n',32); on('asp'); op('fence'); await start(); r.pousInfo=A('Poussoir à portée de main');
 for(let i=0;i<120;i++){ R.advance(5); if(D('FIN DE PASSE SANS POUSSOIR')) break; } r.fin=D('FIN DE PASSE SANS POUSSOIR');
 $('pouss').click(); r.finOk=!D('FIN DE PASSE SANS POUSSOIR');
 for(let i=0;i<200;i++){ if(R.advance(5)===false) break; }
 // mains dans l'axe (chantournage)
 await stop(); op('pchute'); op('aside'); op('reset'); setN('hg-n',32); document.querySelector('[data-mains=axe]').click(); r.axe=D('MAIN DANS L\'AXE DE LA LAME');
 // protecteur trop haut
 setN('hg-n',80); r.prot=D('PROTECTEUR TROP HAUT');
 // rupture de la lame : danger, portes refusées avant l'arrêt complet, puis conduite à tenir
 await start(); $('rupture').click(); r.rupture=D('LAME CASSÉE'); off('motor'); $('doors').click(); r.portesRupture=!R.st.doors;
 R.setSpin(0); await sleep(100); consigner(); on('doors'); setN('ten-n',0); $('unmount').click(); r.apres=!R.st.blade&&!A('LAME CASSÉE');
 return r;"""

RONDIN = BASE + r"""
 const r={}, D=k=>alerts().some(a=>a.startsWith('danger')&&a.includes(k));
 setN('tilt-n',0); on('serv'); on('asp'); op('aside'); document.querySelector('li[data-k=rond] [data-take]').click();
 setN('hg-n',95); r.rouge=D('PIÈCE RONDE'); await start(); $('feed').click(); r.refus=!R.st.feed&&D('PIÈCE RONDE');
 op('fence'); r.pasGuide=alerts().some(a=>a.includes('ne se scie pas contre le guide'));
 op('gab'); r.gabOk=!D('PIÈCE RONDE');
 $('pouss').click(); for(let i=0;i<200;i++){ if(R.advance(5)===false) break; }
 r.moities=R.pieces.filter(q=>q.round&&q.gen>0).length;
 return r;"""

async def main():
    async with Page('scie-ruban') as pg:
        for mode, jeu in JEUX.items():
            print(f'Exercice {mode}')
            await pg.eval(f"()=>document.querySelector('[data-mode={mode}]').click()")
            await pg.page.wait_for_timeout(100)
            r = await pg.eval(js(jeu))
            for st in r['log']:
                if st['tag'] != 'contrôle': check(st['ok'], f"{st['tag']} : étape réussie ({st['step']})" + ('' if st['ok'] else ' ' + str(st['checks'])))
            got = [row[:2] for row in r['res']]
            check(got[:len(ATTENDU[mode])] == ATTENDU[mode], f'contrôle final conforme : {got}')
            check(r['res'] and all(row[2] == '✓' for row in r['res']), 'toutes les lignes du contrôle sont cochées : ' + str(r['res']))
            m = r['msgs']
            if mode == 'lame':
                check('démontage refusé tendue:true' in m, 'démontage refusé tant que la lame est tendue')
                check('crique vue:true' in m, 'la lame n° 2 examinée : crique à la soudure')
                check('dents vers le haut annoncées:true' in m, 'la lame n° 1 est accrochée dents vers le haut : à retourner avant de la monter')
                check('dents sur le bandage:true' in m, 'lame large au milieu du bandage : alerte « dents sur le bandage »')
            if mode == 'chant':
                check('alertes rouges au départ:2' in m, 'au départ : protecteur trop haut, main dans l\'axe de la lame')
                print('   ', [x for x in m if x.startswith('écart')])
            if mode == 'refente':
                check('rondin rouge:true' in m, 'rondin sur la table : alerte rouge « pièce ronde non maintenue »')
                print('   ', [x for x in m if x.startswith('poussoir')])
            dang = [a for a in m if a.startswith('danger')]
            check(not dang, 'aucune alerte danger pendant l\'avance' + ('' if not dang else ' : ' + dang[0]))
            await pg.shot(f'scie-ruban_{mode}.png')
        print('Gestes refusés et alertes (mode libre)')
        await pg.eval("()=>document.querySelector('[data-mode=libre]').click()"); await pg.page.wait_for_timeout(100)
        r = await pg.eval(js(GESTES))
        check(r['tension'], 'tension refusée lame en marche')
        check(r['portes'], 'portes verrouillées lame en marche')
        check(r['loto'], 'démontage sans consignation : refusé, alerte rouge « intervention sur la lame sans consignation »')
        check(r['demarrage'], 'démarrage refusé portes ouvertes')
        check(r['envers'], 'lame retournée : alerte rouge « lame montée à l\'envers »')
        check(r['pas'], 'lame de pas 15 pour 27 mm : « moins de 3 dents en prise »')
        check(r['force'], 'lame de 30 mm dans une courbe : « la lame force »')
        check(r['recul'], 'recul dans une courbe lame en marche : refusé, alerte rouge')
        check(r['reculOk'], 'recul lame arrêtée : possible')
        check(r['chute'], 'chute contre la lame dégagée à la main lame en marche : refusé, alerte rouge')
        check(r['pchute'], 'chute dégagée au poussoir lame en marche : possible')
        r = await pg.eval(js(GESTES2))
        check(r['pousInfo'], 'contre le guide : « poussoir à portée de main »')
        check(r['fin'], 'fin de passe à moins de 120 mm sans poussoir : alerte rouge')
        check(r['finOk'], 'poussoir pris : l\'alerte disparaît')
        check(r['axe'], 'main devant la lame : alerte rouge « main dans l\'axe de la lame »')
        check(r['prot'], 'protecteur à 80 mm pour 27 mm : alerte rouge « protecteur trop haut »')
        check(r['rupture'], 'rupture de la lame : alerte rouge « lame cassée »')
        check(r['portesRupture'], 'rupture : portes refusées avant l\'arrêt complet')
        check(r['apres'], 'rupture : à l\'arrêt, machine consignée, lame cassée démontée')
        print('Rondin dans le gabarit (refente)')
        await pg.eval("()=>document.querySelector('[data-mode=refente]').click()"); await pg.page.wait_for_timeout(100)
        r = await pg.eval(js(RONDIN))
        check(r['rouge'] and r['refus'], 'rondin tenu à la main : alerte rouge, avance refusée')
        check(r['pasGuide'], 'rondin contre le guide parallèle : refusé')
        check(r['gabOk'] and r['moities'] == 2, f'rondin dans le gabarit : scié en deux moitiés ({r["moities"]})')
        await pg.shot('scie-ruban_rondin.png')

if __name__ == '__main__': run(main)
