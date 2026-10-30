# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Tenonneuse, mode libre : points de sécurité et de qualité.
- interverrouillages : capot (sélecteur, temporisation, démarrage refusé capot ouvert), filin de sécurité (boîtier puis réarmement) ;
- outils : lame retournée (ne coupe pas), dérouleur du mauvais sens, n max, carters déposés ;
- passe : profondeur de joue trop forte, avance trop rapide, guide orienté refusé, butée qui tomberait sur la pièce ;
- chute fine coincée : retrait refusé lame en rotation (intervention), possible scie arrêtée capot ouvert ;
- qualité : éclats sans pare-éclat, tenon usiné SR1 dessus (décalé), arasements décalés, épaulements sur chant ;
- pièce corroyée importée avec ses repères ; bouts usinés transportés par pieceJSON (et absents d'une pièce brute)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import BASE

async def main():
    async with Page('tenonneuse') as pg:
        await pg.eval("()=>document.getElementById('ui-ex').click()")
        r = await pg.eval(js(BASE + r"""
          const out={}, D=k=>alerts().some(a=>a.startsWith('danger')&&a.includes(k)), W=k=>alerts().some(a=>a.includes(k));
          const q0=()=>CH();
          // capot : démarrage refusé sélecteur sur 1 ; capot verrouillé pendant la temporisation
          await start(['scie']); $('sel').click(); out.selStop=!T.st.run.scie; on('capot'); out.tempo=!T.st.capot;
          await until(()=>!T.model.anySpin()); on('capot'); out.open=T.st.capot; runH('inf'); out.startCapot=!T.st.run.inf;
          closeCapot(); out.rearmed=T.st.armed;
          // filin : tout s'arrête, redémarrage après le boîtier et le réarmement
          await start(['inf']); $('filin').click(); out.filStop=!T.st.run.inf; runH('inf'); out.filRefus=!T.st.run.inf;
          $('rearm').click(); out.filRearm=!T.st.armed; $('filin').click(); $('rearm').click(); runH('inf'); out.filOk=T.st.run.inf; await stop();
          // outils : lame retournée, dérouleur du mauvais sens, n max, carters
          await openCapot(); off('main'); on('cad'); off('carters'); out.carters=D('CARTERS DES OUTILS DÉPOSÉS');
          head('scie'); on('lock'); $('flipT').click(); off('lock'); out.envers=D('OUTIL MONTÉ À L\'ENVERS');
          head('sup'); on('lock'); tool('dinf180'); out.sens=D('SENS DE ROTATION NON ADAPTÉ'); tool('dsup200'); out.nmax=D('VITESSE TROP ÉLEVÉE'); tool('dsup180'); off('lock');
          on('carters'); off('cad'); on('main'); closeCapot();
          // lame retournée : elle n'affranchit pas
          on('presse'); num('prot',30); await start(['scie','inf','sup']); const L0=CH().L; await passe(); out.envNoCut=CH().L===L0; out.envMsg=alerts()[0]; await retour();
          await stop(); await openCapot(); off('main'); on('cad'); off('carters'); head('scie'); on('lock'); $('flipT').click(); off('lock'); on('carters'); off('cad'); on('main'); closeCapot();
          // profondeur de joue, avance, guide orienté
          num('hinf',22); out.joue=D('PROFONDEUR DE PASSE TROP FORTE'); num('hinf',21); num('hinf',9); num('ep',9);
          document.querySelector('[data-av="20"]').click(); out.av=D('AVANCE DU CHARIOT TROP RAPIDE'); document.querySelector('[data-av="8"]').click();
          num('ang',30); off('lockC'); $('pass').click(); await sleep(100); out.angRefus=!T.cut.inProgress&&T.st.cx>0.3; num('ang',0); on('lockC');
          // butée qui tomberait sur la pièce (pièce plus loin que la butée)
          num('but',300); on('butOn'); out.butRefus=!T.st.butOn;
          // chute fine : coincée près de la lame
          off('presse'); setN('over-n','2'); out.fine=W('Chute d\'affranchissement très fine'); on('presse');
          await start(['scie','inf','sup']); await passe(); await retour(); out.wedge=T.st.wedge;
          op('wedge'); out.wedgeRefus=T.st.wedge && W('Chute fine coincée');
          await openCapot(); op('wedge'); out.wedgeOk=!T.st.wedge; closeCapot();
          // éclats sans pare-éclat
          off('presse'); op('aside'); take('Traverse 2'); on('presse'); off('peOn');
          await start(['scie','inf','sup']); await passe(); await retour(); out.ec=T.endInfo(CH(),'A').ec; await stop(); on('peOn');
          // tenon usiné SR1 dessus (retournée) : position fausse depuis SR1
          off('presse'); op('end'); op('flip'); num('hinf',5); num('hinf',6); out.refWarn=W('Face de référence'); on('presse');
          await start(['scie','inf','sup']); await passe(); await retour(); { const I=T.endInfo(CH(),'B').items[0]; out.decale=[I.th, I.fromHi, I.fromLo]; } await stop();
          // arasements décalés et épaulements sur chant (pièce corroyée importée de la raboteuse)
          off('presse'); op('aside');
          const json=T.C.pieceJSON(T.pieces.find(q=>q.name==='Cale')); json.L=600;
          const raw=T.C.makePiece({L:600,W:72,T:29.5,wood:'chene',seed:41}); T.C.dresseSR(raw,{s1:'F1',s2:'C1'}); T.C.rabote(raw,'C1',70); T.C.rabote(raw,'F1',27);
          const id=T.importPiece(T.C.pieceJSON(raw),'Importée'); const Q=T.pieces.find(q=>q.id===id);
          out.imp=Q.state==='chariot' && Q.face.F1.mark==='loop' && Q.face.C1.mark==='v' && !('ends' in T.C.pieceJSON(Q));
          await openCapot(); num('dec',5); closeCapot(); num('hinf',9); on('presse');
          await start(['scie','inf','sup']); await passe(); await retour(); { const I=T.endInfo(Q,'A').items[0]; out.dec=[I.lenLo, I.lenHi]; }
          out.json=!!T.C.pieceJSON(Q).ends && T.C.pieceJSON(Q).ends.A.cuts.length===2 && T.C.makePiece(T.C.pieceJSON(Q)).ends.A.cuts.length===2;
          await stop(); await openCapot(); num('dec',0); closeCapot();
          off('presse'); op('end'); op('rot'); num('hinf',10); num('ep',50); num('prot',75); on('presse');
          await start(['scie','inf','sup']); await passe(); await retour(); { const I=T.endInfo(Q,'B'); out.ep=I.items.map(x=>[x.type,x.ax,+x.th.toFixed(1)]); }
          // chariot avancé : on ne touche pas la pièce
          await passe(); off('presse'); out.charge=T.st.presse && W('CHARIOT AVANCÉ PENDANT LE CHARGEMENT'); await retour(); await stop();
          return out;"""))
        print(r)
        check(r['selStop'] and r['tempo'] and r['open'] and r['startCapot'] and r['rearmed'], 'capot : sélecteur sur 1 arrête les outils, temporisation, démarrage refusé capot ouvert, réarmement')
        check(r['filStop'] and r['filRefus'] and r['filRearm'] and r['filOk'], 'filin tiré : tout s\'arrête ; réarmement après le bouton bleu du boîtier seulement')
        check(r['carters'], 'carters déposés : alerte rouge')
        check(r['envers'] and r['envNoCut'] and 'envers' in r['envMsg'], 'lame retournée : alerte rouge, la scie n\'affranchit pas')
        check(r['sens'], 'dérouleur ↻ sur l\'arbre supérieur ↺ : alerte rouge « sens de rotation non adapté »')
        check(r['nmax'], 'dérouleur n max 4 500 sur un arbre à 6 000 tr/min : alerte rouge')
        check(r['joue'], 'joue de 22 mm : alerte rouge « profondeur de passe trop forte »')
        check(r['av'], 'avance de 20 m/min : alerte rouge')
        check(r['angRefus'], 'guide orienté : passe refusée (tenons biais non simulés)')
        check(r['butRefus'], 'butée qui tomberait sur la pièce : refusée')
        check(r['fine'] and r['wedge'], 'dépassement de 2 mm : chute fine signalée, puis coincée près de la lame')
        check(r['wedgeRefus'] and r['wedgeOk'], 'chute coincée : retrait refusé lame en rotation, possible scie arrêtée capot ouvert')
        check(r['ec'], 'pare-éclat retiré : éclats sur le bout usiné')
        check(r['refWarn'] and abs(r['decale'][0]-9) < 0.05 and abs(r['decale'][2]-12) < 0.05, f'pièce SR1 dessus : alerte, tenon à 12 mm de SR1 au lieu de 6 ({r["decale"]})')
        check(r['imp'], 'pièce corroyée importée : repères SR1 / SR2 gardés, pas de bouts usinés dans pieceJSON')
        check(abs(r['dec'][0]-40) < 0.05 and abs(r['dec'][1]-35) < 0.05, f'arasements décalés de 5 mm : joues de 40 et 35 mm ({r["dec"]})')
        check(r['json'], 'bouts usinés transportés par pieceJSON / makePiece')
        check(any(x[0] == 'tenon' and x[1] == 'v' for x in r['ep']), f'pièce sur chant : épaulements (tenon dans la largeur) {r["ep"]}')
        check(r['charge'], 'presse manœuvrée chariot au bout de sa course : geste refusé')
        await pg.eval("()=>document.getElementById('vtenon').click()"); await pg.page.wait_for_timeout(700)
        print(await pg.shot('tenonneuse_epaulements.png'))

if __name__ == '__main__': run(main)
