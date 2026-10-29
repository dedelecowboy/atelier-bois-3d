"""Exercices guidés de la scie à ruban, joués comme un élève (corps JS passés à harness.js()).
Chaque jeu suppose le mode déjà choisi et rend {log, res, msgs}. L'avance de la pièce est jouée par __ruban.advance(mm)
(pas de 1 mm, mêmes règles que le bouton « Avance ») ; le chantournage suit le tracé avec le pilote de test
(__ruban.pilot : il tourne la pièce comme un élève qui suit le trait). La vitesse de la lame est forcée (setSpin)
pour ne pas attendre la montée en vitesse et le freinage en headless."""

BASE = r"""
 const R=__ruban, next=()=>$('stepNext').click(), stepOk=()=>!$('stepOk').hidden;
 const msgs=[]; const grab=()=>{ for(const a of alerts()) if(!msgs.includes(a)) msgs.push(a); };
 const log=[];
 const on=id=>{ if($(id).getAttribute('aria-pressed')!=='true') $(id).click(); };
 const off=id=>{ if($(id).getAttribute('aria-pressed')==='true') $(id).click(); };
 const start=async()=>{ on('motor'); R.setSpin(1); await sleep(80); };
 const stop=async()=>{ off('motor'); R.setSpin(0); await sleep(80); };
 const sel=id=>{ $('bladeSel').value=id; $('bladeSel').dispatchEvent(new Event('change')); };
 const consigner=()=>{ off('main'); $('cad').getAttribute('aria-pressed')!=='true' && $('cad').click(); on('gants'); };
 const deconsigner=()=>{ off('doors'); off('cad'); on('main'); };
 /* change la lame : consignation, portes, détente, démontage, montage de la lame id (retournée si besoin), tension */
 const changer=(id,flip)=>{ consigner(); on('doors'); setN('ten-n',0); $('unmount').click(); sel(id); if(flip) $('flip').click(); $('mount').click(); setN('ten-n',R.st.blade?({r6:6,r10:10,r15:15,r20:20,r30:30,r30c:30,r35:35})[id]:0); };
 const guides=(F,B)=>{ setN('gL-n',0.2); setN('gF-n',F); setN('gB-n',B); setN('gLi-n',0.2); setN('gFi-n',F); setN('gBi-n',B); };
 const dev=n=>{ const d=n-R.st.dev; for(let i=0;i<Math.abs(d);i++) $(d>0?'devP':'devM').click(); $('hwheel').click(); };
 const until=async(f,n=400)=>{ let r; for(let i=0;i<n;i++){ r=R.advance(5); grab(); if(f&&f()) break; if(r===false||typeof r==='string') break; } return r; };
"""
END = r"""
 await stop(); op('evac'); op('aside'); log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

LAME = BASE + r"""
 msgs.push('lame au départ:'+R.st.blade);
 consigner(); log.push(state('consigner')); next();
 on('doors'); $('unmount').click(); msgs.push('démontage refusé tendue:'+alerts().some(a=>a.includes('Détendez d\'abord')));
 setN('ten-n',0); $('unmount').click(); log.push(state('démonter')); next();
 sel('r30c'); $('exam').click(); msgs.push('crique vue:'+alerts().some(a=>a.includes('CRIQUE')));
 sel('r30'); $('exam').click(); msgs.push('dents vers le haut annoncées:'+alerts().some(a=>a.includes('vers le haut si on la monte')));
 $('flip').click(); $('mount').click(); log.push(state('monter')); next();
 setN('ten-n',30); log.push(state('tendre')); next();
 dev(0); msgs.push('dents sur le bandage:'+alerts().some(a=>a.includes('Dents sur le bandage')));
 dev(5); log.push(state('dévers')); next();
 guides(8.5,31); log.push(state('guides')); next();
 deconsigner(); await start(); for(let i=0;i<40&&!stepOk();i++) await sleep(100); await stop(); log.push(state('essai')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

CHANT = BASE + r"""
 msgs.push('alertes rouges au départ:'+['PROTECTEUR TROP HAUT','MAIN DANS L\'AXE'].filter(k=>alerts().some(a=>a.startsWith('danger')&&a.includes(k))).length);
 on('asp'); changer('r10'); dev(0); guides(4.5,11); log.push(state('préparation')); next();
 deconsigner(); off('fenceOn'); setN('hg-n',28); document.querySelector('[data-mains=cote]').click(); log.push(state('réglages')); next();
 op('trace'); const g0=R.startGap(); op('xp1'); const g1=R.startGap(); const k=g1>g0? 'xp1':'xm1'; if(k==='xm1') op('xm1');
 let n=0; while(R.startGap()<0.3 && n<6){ op(k); n++; } msgs.push('écart au départ:'+R.startGap().toFixed(2));
 log.push(state('présenter')); next();
 await start(); R.pilot.on=true; R.pilot.off=0.4; await until(); R.pilot.on=false;
 log.push(state('chantourner')); next();
""" + END

REFENTE = BASE + r"""
 msgs.push('alertes au départ:'+['PROTECTEUR TROP HAUT'].filter(k=>alerts().some(a=>a.includes(k))).length);
 setN('tilt-n',0); setN('fx-n',20); on('serv'); on('asp'); log.push(state('préparation')); next();
 op('chant'); setN('hg-n',126); log.push(state('présenter')); next();
 await start(); await until(()=>{ const p=R.pieces.find(q=>q.state==='table'); if(!p) return true; const z=R.extent(p).z1; if(z<200 && R.st.pouss===false){ $('pouss').click(); msgs.push('poussoir pris à '+Math.round(z)+' mm'); } return false; });
 log.push(state('refendre')); next();
 await stop(); op('aside'); document.querySelector('li[data-k=rond] [data-take]').click(); msgs.push('rondin rouge:'+alerts().some(a=>a.startsWith('danger')&&a.includes('PIÈCE RONDE')));
 op('reject'); log.push(state('rondin')); next();
 log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

ATTENDU = {
  'lame': [['Lame montée', '30 mm, pas 15'], ['Tension (indicateur)', '30 pour 30 mm']],
  'chant': [],
  'refente': [['Guide à 20 mm, table à 0°', '20,0 mm · 0°']],
}
JEUX = {'lame': LAME, 'chant': CHANT, 'refente': REFENTE}
