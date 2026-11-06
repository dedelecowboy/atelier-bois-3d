# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Risques généraux : les quatre exercices guidés joués comme un élève (mode Exercice, sans Moodle).
- Dangers : tous les dangers de dangers.txt repérés avec la bonne mesure → bilan conforme ; une situation correcte touchée = fausse alerte ;
  une mauvaise mesure est signalée.
- Relecture de l'équipe (nov. 2026) : la déligneuse qui déborde sur l'allée se touche en mode Dangers (et seulement là) ;
  le câble se touche même un peu à côté.
- EPI : 4 tenues correctes ; des gants à la toupie = faute grave.
- Consignation : arrêter, séparer, condamner, signaler, vérifier, intervenir, déconsigner → bilan conforme ;
  intervention machine en marche ou après le seul arrêt d'urgence refusée (faute grave).
- Départ de feu : alerter, couper, extincteur à eau à 2 – 3 m, base des flammes, porte B, rassemblement → bilan conforme ;
  feu entre soi et la sortie, porte enfumée, retour pour le sac = fautes graves."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import JEUX, FAUTES, BASE

async def mode(pg, m):
    await pg.eval(js(f"$('ui-ex').click(); await sleep(200); $('m-{m}').click(); await sleep(500);"))

async def main():
    async with Page('risques', viewport=(1400, 900)) as pg:
        for m in ['dangers', 'epi', 'consignation', 'feu']:
            print('Exercice', m)
            await mode(pg, m)
            r = await pg.eval(js(JEUX[m]))
            check(r['step'].startswith('Étape') and all(row[2] == '✓' for row in r['res']), f'{m} : bilan conforme ({len(r["res"])} lignes)')
            check(not r['faults'], f'{m} : aucune faute grave')
            await pg.shot(f'risques_{m}_fin.png')
        print('Fausse alerte et mauvaise mesure')
        await mode(pg, 'dangers')
        r = await pg.eval(js(BASE + r"""
          R.pickDanger('p_chariot'); const fa=R.st.d.fa.slice(), fb1=document.querySelector('.afb')?.textContent||'';
          R.pickDanger('cable'); const d=R.data.dangers.find(x=>x.k==='cable'); a('measure',(d.a+1)%d.o.length);
          const fb2=document.querySelector('.afb')?.textContent||''; const marks=R.st.d.found;
          return {fa, fb1, fb2, marks};"""))
        check(r['fa'] == ['p_chariot'] and r['fb1'].startswith('Fausse alerte'), 'situation correcte touchée : fausse alerte expliquée')
        check(r['marks']['cable']['ok'] is False and 'pas la bonne mesure' in r['fb2'], 'mauvaise mesure : signalée, avec la bonne réponse')
        print('Zones de clic (relecture de l\'équipe)')
        r = await pg.eval(js(r"""
          const R=window.__risques, S=window.__atelier.app.stage, THREE=S.THREE, ray=new THREE.Raycaster();
          const first=(from,to)=>{ ray.set(new THREE.Vector3(...from), new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize());
            const h=ray.intersectObjects(S.root.children,true).find(h=>{ let o=h.object; while(o){ if(!o.visible||o.userData.off) return false; o=o.parent; } return true; }); return h?.object.userData.danger||null; };
          const c=new THREE.Box3().setFromObject(R.model.DEC.m21.g).getCenter(new THREE.Vector3());
          const mach=first([c.x,c.y+5,c.z+0.01],[c.x,c.y,c.z]);
          const cab=first([-8.9+0.08,3,-5.6],[-8.9+0.08,0,-5.6]);    // 8 cm à côté du câble
          $('m-epi').click(); await sleep(400); const off=[]; R.model.DEC.m21.g.traverse(o=>{ if(o.userData.danger) off.push(o); });
          return {mach, cab, off:off.length};"""))
        check(r['mach'] == 'machine_allee', f'déligneuse sur l\'allée : touchable en mode Dangers ({r["mach"]})')
        check(r['cab'] == 'cable', f'câble touché à 8 cm à côté ({r["cab"]})')
        check(r['off'] == 0, 'dans un autre exercice, la déligneuse n\'est plus une situation')
        print('Fautes graves')
        await mode(pg, 'epi')
        r = await pg.eval(js(FAUTES['epi']))
        check(any('gants de manutention' in f for f in r['faults']), 'EPI : gants à la toupie = faute grave')
        await mode(pg, 'consignation')
        r = await pg.eval(js(FAUTES['consignation']))
        check(r['f'] == ['Intervention sur la lame en mouvement', 'Intervention sur une machine non consignée'], 'consignation : intervention machine en marche, puis après le seul arrêt d\'urgence : refusées, fautes graves')
        check(not await pg.eval('__risques.st.c.changed'), 'consignation : la lame n\'a pas été changée')
        await mode(pg, 'feu')
        r = await pg.eval(js(FAUTES['feu']))
        check(set(r['faults']) == {'Feu entre soi et la sortie', 'Sortie par la porte enfumée', 'Retour dans l\'atelier pour chercher ses affaires'}, 'feu : trois fautes graves relevées')
        check(all(row[2] == '✗' for row in r['res']), 'feu : aucun critère rempli (pas d\'alerte, CO2, haut des flammes, porte A, retour)')

if __name__ == '__main__': run(main)
