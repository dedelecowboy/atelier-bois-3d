# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Toupie, mode libre : points de sécurité et de qualité propres au travail au guide.
- outil retourné (tranchants à l'envers) : alerte rouge, la passe n'usine rien ; inverseur sur ↻ : « travail en avalant » ;
  inverseur et outil refusés moteur en marche ; vitesse au-dessus de n max ; pièce trop courte ;
- demi-guide de sortie avancé alors que la rive n'est usinée qu'en partie : la pièce bute et s'arrête ; dégager machine en marche
  refusé ; rive entière usinée sans avancer la sortie : entaille en fin de passe (profil irrégulier) ;
- fil incliné passé contre le fil : arrachements ;
- pièce corroyée venue de la raboteuse (pieceJSON) : repères SR1 / SR2 gardés ; un profil voyage avec la pièce (pieceJSON)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import BASE

async def main():
    async with Page('toupie') as pg:
        await pg.eval("()=>document.getElementById('ui-ex').click()")
        r = await pg.eval(js(BASE + r"""
          const out={};
          on('asp'); on2('push'); orientTo('F1','C2');
          // outil retourné : il ne coupe pas
          await consigne(); $('flipT').click(); deconsigne();
          out.envers=alerts().some(a=>a.startsWith('danger')&&a.includes('OUTIL MONTÉ À L\'ENVERS'));
          await start(); await passe(); out.envNoCut=!(P('Avivé').cuts||[]).length; out.envMsg=alerts()[0];
          op('back'); await stop();
          await consigne(); $('flipT').click(); deconsigne();
          // inverseur : refusé moteur en marche, avalant signalé
          await start(); dir(-1); out.invRefus=T.st.dir===1; await stop(); dir(-1);
          out.avalant=alerts().some(a=>a.startsWith('danger')&&a.includes('TRAVAIL EN AVALANT'));
          dir(1);
          // changement d'outil refusé moteur en marche
          await start(); tool('rainure'); out.outilRefus=T.st.tool==='quart'; await stop();
          // vitesse au-dessus de n max (fraise à rainer Ø 200, n max 6 500)
          await consigne(); tool('rainure'); deconsigne(); rpm(7000);
          out.nmax=alerts().some(a=>a.startsWith('danger')&&a.includes('VITESSE TROP ÉLEVÉE'));
          await consigne(); tool('quart'); deconsigne(); rpm(9000);
          // pièce trop courte
          op('aside'); take('Cale'); out.courte=alerts().some(a=>a.startsWith('danger')&&a.includes('PIÈCE TROP COURTE'));
          op('aside'); take('Avivé');
          // demi-guide de sortie avancé, rive en partie usinée : la pièce bute
          num('esor',1); out.buteAlerte=alerts().some(a=>a.startsWith('danger')&&a.includes('DEMI-GUIDE DE SORTIE MAL RÉGLÉ'));
          await start(); await passe(); out.bute=P('Avivé').state==='bute';
          op('back'); out.degagerRefus=P('Avivé').state==='bute';
          await stop(); op('back'); out.degage=P('Avivé').state==='entry';
          num('esor',0); op('aside');
          return out;"""))
        check(r['envers'], 'outil retourné : alerte rouge « outil monté à l\'envers »')
        check(r['envNoCut'] and 'n\'a pas coupé' in r['envMsg'], 'outil retourné : la passe n\'usine rien (message)')
        check(r['invRefus'], 'inverseur refusé moteur en marche')
        check(r['avalant'], 'inverseur sur ↻ : alerte rouge « travail en avalant »')
        check(r['outilRefus'], 'changement d\'outil refusé moteur en marche')
        check(r['nmax'], 'fraise Ø 200 (n max 6 500) à 7 000 tr/min : alerte rouge « vitesse trop élevée »')
        check(r['courte'], 'cale de 220 mm : alerte rouge « pièce trop courte »')
        check(r['buteAlerte'] and r['bute'], 'demi-guide de sortie avancé sur une rive en partie usinée : alerte rouge, la pièce bute')
        check(r['degagerRefus'] and r['degage'], 'pièce arrêtée : dégagement refusé moteur en marche, possible arbre arrêté')

        r = await pg.eval(js(BASE + r"""
          const out={};
          // rive entière (baguette de 20 mm, outil à moulurer) sans avancer la sortie : entaille en bout
          await consigne(); tool('moulure'); deconsigne(); rpm(7000); ring(200); num('sail',10); num('esor',0); $('lam').click();
          const C=T.C, raw=C.makePiece({L:800,W:42,T:22,wood:'hetre',seed:5}); C.dresseSR(raw,{s1:'F1',s2:'C1'}); C.rabote(raw,'C1',40); C.rabote(raw,'F1',20);
          const id=T.importPiece(C.pieceJSON(raw),'Baguette'); const q=T.pieces.find(p=>p.id===id);
          out.marks=!!(q.face.F1.mark==='loop' && q.face.C1.mark==='v');
          orientTo('F1','C2'); presseurs(); await start(); await passe();
          const s=T.profileStats(q,'C2','lo'); out.full=s.full; out.reg=s.reg; out.snipeMsg=alerts()[0];
          const copy=C.makePiece(C.pieceJSON(q)); out.travel=(copy.cuts||[]).length===1 && Math.abs(T.profileStats({...copy},'C2','lo').depth-s.depth)<1e-9;
          op('aside'); await stop();
          // frêne au fil incliné, contre le fil : arrachements
          await consigne(); tool('quart'); deconsigne(); rpm(9000); ring(160); num('sail',10); num('esor',0); $('lam').click();
          take('Frêne'); orientTo('F1','C2'); presseurs(); await start(); await passe();
          const f=T.pieces.find(p=>p.name==='Frêne'), sf=T.profileStats(f,'C2','lo'); out.tear=sf.tear;
          await stop();
          return out;"""))
        check(r['marks'], 'pièce corroyée importée (pieceJSON) : repères SR1 et SR2 gardés')
        check(r['full'] and r['reg'] > 0.5 and 'Entaille en fin de passe' in r['snipeMsg'], f'rive entière sans avancer la sortie : entaille en bout (régularité {r["reg"]:.1f} mm)')
        check(r['travel'], 'le profil voyage avec la pièce (pieceJSON / makePiece)')
        check(r['tear'], 'frêne au fil incliné passé contre le fil : arrachements')
        r = await pg.eval(js(BASE + r'''
          const out={};
          // entraîneur : mise en place automatique sur la pièce, marche après l'arbre, passe sans poussoir
          await stop(); off2('push'); take('Avivé'); orientTo('F1','C2');
          $('entrOn').click(); out.nonPose=!T.st.entr.on;
          $('entrPlace').click(); const EN=T.st.entr, q=T.pieces.find(p=>p.name==='Avivé');
          out.place=EN.placed && Math.abs(T.C.heightMm(q)-EN.y-4)<1e-6 && EN.angle===3 && !T.st.prot;
          await sleep(300);   // le modèle suit l'état : aucun point du bloc ne passe derrière le plan du guide (cassettes, capot)
          { const ST=__atelier.app.stage, V=new ST.THREE.Vector3(), ty=0.87, zG=(T.st.zIn+Math.max(0,T.st.e))/1000; let zmin=9;
            for(const m of __atelier.app.parts.partMeshes.entraineur){ m.updateWorldMatrix(true,false); const p=m.geometry.attributes.position;
              for(let i=0;i<p.count;i++){ V.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld); if(V.y<ty+0.27 && V.z>-0.3 && Math.abs(V.x)<0.9) zmin=Math.min(zmin,V.z); } }
            out.jeu=Math.round((zmin-zG)*1000*10)/10; }
          $('entrOn').click(); out.avantArbre=!T.st.entr.on;
          await start(); $('entrOn').click(); out.marche=T.st.entr.on;
          out.dang=alerts().filter(a=>a.startsWith('danger'));
          const n0=(q.log||[]).length; await passe(); out.passe=q.log.length===n0+1 && q.state==='exit';
          await stop(); out.arret=!T.st.entr.on;
          // pièce plus épaisse que celle du réglage : la passe est refusée tant que l'entraîneur n'est pas replacé
          op('back'); op('rot'); await start(); $('pass').click(); await sleep(200); out.refus=q.state==='entry' && alerts()[0].includes('entraîneur');
          return out;'''))
        check(r['nonPose'] and r['place'], 'entraîneur : marche refusée non posé ; posé sur la pièce 4 mm sous le dessus, à 3° vers le guide, protège-mains escamoté')
        check(r['jeu'] >= 4, f'entraîneur posé : aucun contact avec le guide (bloc à {r["jeu"]} mm devant le plan du guide)')
        check(r['avantArbre'] and r['marche'], 'entraîneur : marche refusée avant l\'arbre, possible après')
        check(not r['dang'] and r['passe'], 'passe à l\'entraîneur sans poussoir ni presseurs : aucune alerte rouge, pièce usinée')
        check(r['arret'], 'arrêt de l\'arbre : l\'entraîneur s\'arrête aussi')
        check(r['refus'], 'pièce posée autrement (hauteur différente) : passe refusée, replacer l\'entraîneur')
        print(await pg.shot('toupie_securite.png'))

if __name__ == '__main__': run(main)
