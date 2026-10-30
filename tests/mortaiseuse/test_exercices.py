# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Mortaiseuse : les trois exercices guidés de bout en bout, comme un élève, et les gestes refusés.
1. Changer le bédane : consignation complète (0, cadenas, essai de démarrage), bédane de 10 mm en bon état, serré, essai à vide.
2. Mortaise à la cote : 10 × 40 × 30 à 9 mm de SR1 et 60 mm du bout, pièce d'essai d'abord ; pièges : taquet de départ après 71,
   vérin devant le bédane, arasement refusé capot fermé.
3. Série en butée : 4 mortaises 8 × 60 × 37 à 150 mm de chaque bout (butée gauche puis droite), (l'assemblage avec la traverse se contrôle maintenant à la tenonneuse)
   tenonnée ; pièges : bédane ébréché refusé, taquet 1 pas sur 0, pièce courte.
4. Gestes refusés : intervention sur le bédane sans consignation, pièce touchée bédane en marche, réglages bédane en marche,
   capot verrouillé, cycle refusé (butée sur le passage, capot ouvert), mortaise transportée par pieceJSON."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, ATTENDU, BASE

async def exercice(mode):
    print(f'Exercice « {mode} »')
    async with Page('mortaiseuse') as pg:
        await pg.eval(f"()=>{{ document.getElementById('ui-ex').click(); document.getElementById('m-{mode}').click(); }}"); await pg.page.wait_for_timeout(300)
        r = await pg.eval(js(JEUX[mode]))
        for s in r['log']:
            if s['tag'] in ('fin', 'contrôle'): continue
            check(s['ok'], f"étape « {s['tag']} » réussie" + ('' if s['ok'] else f" : {s['checks']} {s['alerts'][:3]}"))
        got = [[row[0], row[1]] for row in r['res']]
        for row in r['res']: check(row[2] == '✓', f"contrôle : {row[0]} = {row[1]}")
        check(got == ATTENDU[mode], f'résultats attendus' + ('' if got == ATTENDU[mode] else f' : {got}'))
        for m in r['msgs']:
            if ':' in m and m.split(':')[-1] in ('true', 'false') and not m.startswith(('danger', 'warn', 'info')):
                check(m.endswith('true'), m)
        await pg.shot(f'mortaiseuse_{mode}.png')

GESTES = BASE + r"""
 const out={};
 // intervention sur le bédane sans consignation : refusée (capot ouvert, machine sous tension)
 on('capot'); off('tight'); out.tightNonCons=M.st.tight; out.msgInterv=alerts()[0]||'';
 // consigné : desserrer possible
 off('capot'); off('main'); on('cad'); on('capot'); off('tight'); out.tightCons=M.st.tight; $('tight').click(); off('capot'); off('cad'); on('main'); green();
 // pièce sur la table, bédane lancé (manuel) : toucher la pièce refusé, réglages refusés, capot verrouillé
 $('pupAuto').click(); $('bed').click(); await until(()=>M.model.amp>0.9);
 op('aside'); out.asideRun=!!TB(); out.msgMains=alerts()[0]||'';
 num('osc',30); out.oscRun=M.st.osc; on('capot'); out.capRun=M.st.capot;
 $('press').click(); $('plonge').click(); await sleep(150); await until(()=>!M.cyc.on,300); out.manuel=M.mortises(TB()).length;
 $('jog').click(); out.jogX=M.st.X; $('jog').click(); out.jogBack=M.st.X;
 $('bed').click(); await until(()=>M.model.amp<0.02); $('depress').click(); $('pupAuto').click();
 // butée droite abaissée sur le passage de la pièce : cycle refusé
 on('butD'); out.butD=M.st.butD; $('bed').click(); out.cycleButee=M.cyc.on; out.msgButee=alerts()[0]||''; off('butD');
 // capot ouvert : le bédane ne démarre pas
 on('capot'); $('bed').click(); out.cycleCapot=M.cyc.on; off('capot');
 // mortaise transportée par pieceJSON vers une autre machine (et retour)
 const q=TB(), J=M.C.pieceJSON(q); out.json=!!(J.morts&&J.morts.length); const id=M.importPiece(J,'Copie'); out.copie=M.mortises(M.pieces.find(x=>x.id===id)).length;
 out.tenon=M.tenon(M.C.pieceJSON(M.traverse()));
 // arrêt d'urgence pendant le cycle : tout s'arrête, la tête revient au départ, la table au taquet 1
 $('depress').click(); green(); $('press').click(); $('bed').click(); await until(()=>M.cyc.phase==='in'||!M.cyc.on,300); $('au').click();
 out.auStop=!M.cyc.on && !M.st.on; await until(()=>M.model.amp<0.02); out.auX=M.st.X; out.auR=M.st.R===M.st.dep; $('au').click();
 return out;"""

async def gestes():
    print('Gestes refusés et transport de la pièce')
    async with Page('mortaiseuse') as pg:
        r = await pg.eval(js(GESTES))
        check(r['tightNonCons'] is True and 'SANS CONSIGNATION' in r['msgInterv'], 'desserrer le bédane machine non consignée : refusé (« intervention sans consignation »)')
        check(r['tightCons'] is False, 'machine consignée, capot ouvert : vis desserrée')
        check(r['asideRun'] is True and 'MAINS DANS LA ZONE' in r['msgMains'], 'pièce touchée bédane en marche : refusé (« mains dans la zone de l\'outil »)')
        check(r['oscRun'] == 50, 'oscillation refusée bédane en marche')
        check(r['capRun'] is False, 'capot verrouillé tant que le bédane oscille')
        check(r['manuel'] == 1, 'mode manuel : une plongée, une mortaise')
        check(r['jogX'] > 0 and r['jogBack'] == 0, 'mode manuel : table au taquet suivant, puis retour au taquet 1')
        check(r['butD'] is True and r['cycleButee'] is False and 'Butée droite' in r['msgButee'], 'butée droite sur le passage de la pièce : cycle refusé')
        check(r['cycleCapot'] is False, 'capot ouvert : le cycle ne démarre pas')
        check(r['json'] and r['copie'] == 1, 'mortaise transportée par pieceJSON (importPiece)')
        check(r['auStop'] and r['auX'] == 0 and r['auR'], 'arrêt d\'urgence pendant le cycle : cycle arrêté, tête au départ, table au taquet 1')
        t = r['tenon']; check(t and abs(t['th'] - 8) < 0.05 and abs(t['fromLo'] - 8) < 0.05 and abs(t['len'] - 35) < 0.05 and abs(t['width'] - 60) < 0.05, f'tenon de la traverse lu : {t}')

async def main():
    for m in ['bedane', 'simple', 'serie']: await exercice(m)
    await gestes()

if __name__ == '__main__': run(main)
