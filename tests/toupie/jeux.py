"""Exercices guidés de la toupie, joués comme un élève (corps JS passés à harness.js()).
Chaque jeu suppose le mode déjà choisi et rend {log, res, msgs}. Les passes sont animées : on attend leur fin.
window.__toupie donne l'état, les pièces et le profil aux tests (lecture seulement : l'élève, lui, clique)."""

BASE = r"""
 const next=()=>$('stepNext').click(), stepOk=()=>!$('stepOk').hidden;
 const msgs=[]; const grab=()=>{ for(const a of alerts()) if(!msgs.includes(a)) msgs.push(a); };
 const log=[];
 const on=id=>{ if($(id).getAttribute('aria-pressed')!=='true') $(id).click(); };
 const off=id=>{ if($(id).getAttribute('aria-pressed')==='true') $(id).click(); };
 const T=window.__toupie, P=n=>T.pieces.find(q=>q.name===n), E=()=>T.pieces.find(q=>q.state==='entry');
 const num=(id,v)=>setN(id+'-n',(Math.round(v*10)/10).toFixed(1));
 const tool=id=>document.querySelector(`[data-tool="${id}"]`).click();
 const rpm=n=>document.querySelector(`[data-rpm="${n}"]`).click();
 const ring=d=>document.querySelector(`[data-ring="${d}"]`).click();
 const dir=d=>document.querySelector(`[data-dir="${d}"]`).click();
 const chord=(R,z)=>2*Math.sqrt(R*R-z*z);
 const start=async()=>{ on('motor'); let n=0; while(T.model.spin<0.92&&n<150){ await sleep(100); n++; } };
 const stop=async()=>{ off('motor'); let n=0; while(T.model.spin>0.02&&n<150){ await sleep(100); n++; } await sleep(50); };
 const passe=async()=>{ grab(); $('pass').click(); await sleep(150); let n=0; while(T.cut.inProgress&&n<400){ await sleep(100); n++; } await sleep(100); };
 const take=n=>document.querySelector(`[data-take="${P(n).id}"]`).click();
 const kind=n=>document.querySelector(`[data-kind="${P(n).id}"]`).click();
 const consigne=async()=>{ await stop(); off('main'); on('cad'); on('lock'); };
 const deconsigne=()=>{ off('lock'); $('hand').click(); off('cad'); on('main'); };
 const orientTo=(dn,back)=>{ for(let i=0;i<4;i++){ for(let j=0;j<2;j++){ const f=T.C.faces(E()); if(f.down===dn&&f.back===back) return true; op('end'); } op('rot'); } return false; };
 const presseurs=()=>{ const q=E(); num('hv',T.C.heightMm(q)-2); num('dh',T.C.depthMm(q)-2); on2('push'); };
 const on2=o=>{ const b=document.querySelector(`[data-op=${o}]`); if(b.getAttribute('aria-pressed')!=='true') b.click(); };
"""
END = r"""
 log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

QUART = BASE + r"""
 on('asp'); log.push(state('préparation')); next();
 msgs.push('montage refusé non consignée:'+(()=>{ tool('rainure'); return T.st.tool==='droit'; })());
 await consigne(); tool('quart'); deconsigne(); log.push(state('outil')); next();
 rpm(9000); ring(160); off('hlock'); num('haut',0); on('hlock'); dir(1); log.push(state('réglages')); next();
 num('sail',10); num('esor',0); num('open',chord(62.5,52.5)+6); log.push(state('guide')); next();
 msgs.push('poussoir absent signalé:'+alerts().some(a=>a.includes('MAINS PRÈS DE L\'OUTIL')));
 orientTo('F1','C2'); presseurs(); log.push(state('pièce')); next();
 await start();
 await passe(); log.push(state('usinage')); next();
 op('aside'); await stop();
""" + END

FEUILLURE = BASE + r"""
 on('asp'); log.push(state('préparation')); next();
 await consigne(); tool('droit'); deconsigne(); log.push(state('outil')); next();
 rpm(9000); ring(160); off('hlock'); num('haut',-38); on('hlock'); dir(1); log.push(state('réglages')); next();
 num('sail',7.5); num('esor',0); num('open',chord(62.5,55)+6); log.push(state('guide')); next();
 orientTo('F2','C2'); presseurs(); log.push(state('pièce')); next();
 num('sail',15); const trop=alerts().some(a=>a.includes('PASSE TROP FORTE')); num('sail',7.5);
 msgs.push('passe de 15 mm signalée:'+trop);
 await start(); await passe(); op('back'); await stop();
 num('sail',15); num('open',chord(62.5,47.5)+6); await start(); await passe(); log.push(state('passes')); next();
 op('aside'); await stop();
""" + END

SERIE = BASE + r"""
 on('asp'); log.push(state('préparation')); next();
 msgs.push('vitesse trop haute signalée:'+alerts().some(a=>a.includes('VITESSE TROP ÉLEVÉE')));
 rpm(7000); ring(200); log.push(state('machine')); next();
 op('aside'); take('Baguette courte'); msgs.push('pièce courte signalée:'+alerts().some(a=>a.includes('PIÈCE TROP COURTE')));
 op('aside'); kind('Baguette courte'); take('Baguette 1'); log.push(state('lot')); next();
 num('sail',10); num('esor',2); num('open',chord(80,70)+6); log.push(state('guide')); next();
 orientTo('F1','C2'); presseurs(); log.push(state('pièce')); next();
 await start(); await passe(); op('aside');
 for(const n of ['Baguette 2','Baguette 3']){ take(n); orientTo('F1','C2'); await passe(); op('aside'); }
 log.push(state('série')); next();
 await stop();
""" + END

ATTENDU = {
  'quart':     [['Hauteur du quart de rond 10 ± 0,5 mm','9,8 mm'],['Profondeur 10 ± 0,5 mm','10,0 mm'],['Régulier sur toute la longueur (0,2 mm max.)','0,0 mm'],['Arête SR1 / chant opposé à SR2 seulement','oui'],['Arrachements','aucun'],['Repères SR1 et SR2 conservés','oui']],
  'feuillure': [['Hauteur de la feuillure 12 ± 0,5 mm','12,0 mm'],['Profondeur 15 ± 0,5 mm','15,0 mm'],['Régulière sur toute la longueur (0,2 mm max.)','0,0 mm'],['Côté contre-parement, chant opposé à SR2','oui'],['Deux passes au moins, 10 mm au plus par passe','2 passes, 7,5 mm'],['Arrachements','aucun']],
  'serie':     [['Profil conforme (10 ± 0,5 mm, toute la rive)','3 / 3'],['Régulier sur toute la longueur, sans entaille en bout','3 / 3'],['Pièce de 220 mm mise à part, non usinée','oui'],['Vitesse ≤ n max à chaque passe (Ø 160 : 8\u202f000 tr/min au plus)','oui'],['Arrachements','aucun']],
}
JEUX = {'quart': QUART, 'feuillure': FEUILLURE, 'serie': SERIE}
