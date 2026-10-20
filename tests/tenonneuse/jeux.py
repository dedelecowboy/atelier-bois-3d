"""Exercices guidés de la tenonneuse, joués comme un élève (corps JS passés à harness.js()).
Chaque jeu suppose le mode déjà choisi et rend {log, res, msgs}. Les passes du chariot sont animées : on attend leur fin.
window.__tenon donne l'état, les pièces et les bouts usinés aux tests (lecture seulement : l'élève, lui, clique)."""

BASE = r"""
 const next=()=>$('stepNext').click(), stepOk=()=>!$('stepOk').hidden;
 const msgs=[]; const grab=()=>{ for(const a of alerts()) if(!msgs.includes(a)) msgs.push(a); };
 const log=[];
 const on=id=>{ if($(id).getAttribute('aria-pressed')!=='true') $(id).click(); };
 const off=id=>{ if($(id).getAttribute('aria-pressed')==='true') $(id).click(); };
 const T=window.__tenon, P=n=>T.pieces.find(q=>q.name===n), CH=()=>T.pieces.find(q=>q.state==='chariot');
 const num=(id,v)=>setN(id+'-n',(Math.round(v*10)/10).toFixed(1));
 const HS=['scie','inf','sup','tou'];
 const until=async(f,n=200)=>{ let i=0; while(!f()&&i<n){ await sleep(100); i++; } };
 const runH=h=>{ const b=document.querySelector(`[data-run=${h}]`); if(b.getAttribute('aria-pressed')!=='true') b.click(); };
 const start=async hs=>{ for(const h of hs) runH(h); await until(()=>hs.every(h=>T.model.spin[h]>0.92)); };
 const stop=async()=>{ $('stop').click(); await until(()=>HS.every(h=>T.model.spin[h]<0.02)); await sleep(50); };
 const openCapot=async()=>{ await stop(); if(!T.st.sel) $('sel').click(); await until(()=>!T.model.anySpin()); on('capot'); };
 const closeCapot=()=>{ off('capot'); if(T.st.sel) $('sel').click(); $('rearm').click(); };
 const passe=async()=>{ grab(); off('lockC'); $('pass').click(); await sleep(150); await until(()=>!T.cut.inProgress,400); await sleep(100); };
 const retour=async()=>{ $('back').click(); await until(()=>T.atHome()); await sleep(100); on('lockC'); };
 const take=n=>document.querySelector(`[data-take="${P(n).id}"]`).click();
 const kind=n=>document.querySelector(`[data-kind="${P(n).id}"]`).click();
 const head=h=>document.querySelector(`[data-head=${h}]`).click();
 const tool=id=>document.querySelector(`[data-tool="${id}"]`).click();
 const usine=async n=>{ take(n); on('presse'); await passe(); await retour(); off('presse'); op('aside'); };
"""
END = r"""
 log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

TENON = BASE + r"""
 on('asp'); log.push(state('préparation')); next();
 num('lt',40); msgs.push('scie refusée capot fermé:'+(T.st.lt===30));
 await openCapot(); log.push(state('capot')); next();
 num('lt',40); log.push(state('scie')); next();
 closeCapot(); log.push(state('capot2')); next();
 num('hinf',9); num('ep',8); msgs.push('réglage en descendant signalé:'+alerts().some(a=>a.includes('en descendant'))); num('ep',9); num('prot',30);
 log.push(state('dérouleurs')); next();
 $('peNew').click(); await start(['scie','inf','sup']); num('hinf',10); msgs.push('réglage refusé outils en marche:'+(T.st.hInf===9));
 await passe(); await retour(); log.push(state('pare-éclat')); next();
 take('Traverse'); msgs.push('non serrée signalée:'+alerts().some(a=>a.includes('PIÈCE NON SERRÉE'))); on('presse');
 log.push(state('pièce')); next();
 await passe(); await retour(); log.push(state('usinage')); next();
 off('presse'); op('aside'); await stop();
""" + END

SERIE = BASE + r"""
 on('asp'); log.push(state('préparation')); next();
 await openCapot(); log.push(state('capot')); next();
 num('lt',35); log.push(state('scie')); next();
 closeCapot(); log.push(state('capot2')); next();
 num('hinf',7); num('hinf',8); num('ep',7); num('ep',8); num('prot',27); log.push(state('dérouleurs')); next();
 $('peNew').click(); await start(['scie','inf','sup']); await passe(); await retour(); log.push(state('pare-éclat')); next();
 await usine("Pièce d'essai"); log.push(state('essai')); next();
 for(const n of ['Traverse 1','Traverse 2','Traverse 3']) await usine(n);
 log.push(state('premier bout')); next();
 num('but',500); msgs.push('butée refusée outils en marche:'+(T.st.but===400));
 await stop(); num('but',500); on('butOn'); log.push(state('butée')); next();
 await start(['scie','inf','sup']);
 for(const n of ['Traverse 1','Traverse 2','Traverse 3']){ take(n); op('end'); op('butee'); on('presse'); await passe(); await retour(); off('presse'); op('aside'); }
 log.push(state('deuxième bout')); next();
 await stop();
""" + END

ENFOURCHEMENT = BASE + r"""
 on('asp'); msgs.push('vitesse trop haute signalée:'+alerts().some(a=>a.includes('VITESSE TROP ÉLEVÉE'))); log.push(state('préparation')); next();
 head('tou'); tool('enf9'); msgs.push('outil refusé non consigné:'+(T.st.tools.tou==='rain250'));
 await openCapot(); off('main'); on('cad'); off('carters'); on('lock'); tool('enf9'); off('lock'); on('carters'); off('cad'); on('main');
 log.push(state('machine')); next();
 num('lt',40); num('pt',40); log.push(state('réglages')); next();
 closeCapot(); log.push(state('capot2')); next();
 num('hinf',0); num('ep',40); num('ht',9); num('prot',30); log.push(state('hauteurs')); next();
 take('Montant court'); msgs.push('pièce courte signalée:'+alerts().some(a=>a.includes('PIÈCE TROP COURTE'))); op('aside'); kind('Montant court');
 log.push(state('lot')); next();
 $('peNew').click(); await start(['scie','tou']); await passe(); await retour(); log.push(state('pare-éclat')); next();
 for(const n of ['Montant 1','Montant 2']) await usine(n);
 log.push(state('usinage')); next();
 await stop();
""" + END

ATTENDU = {
  'tenon': [['Épaisseur du tenon 9,0 ± 0,1 mm (pied à coulisse)','9,0 mm'],['Tenon à 9,0 ± 0,1 mm de SR1 (pied à coulisse)','9,0 mm'],['Longueur des joues 40,0 ± 0,5 mm (réglet)','40,0 / 40,0 mm'],['Arasements nets, sans éclat','nets'],['Réglé depuis SR1 (table) et SR2 (guide)','oui']],
  'serie': [['Tenons conformes aux deux bouts (8,0 à 8,0 de SR1, joues 35,0)','3 / 3'],['Longueur entre arasements 500,0 ± 0,5 mm','3 / 3 (500,0 ; 500,0 ; 500,0)'],['SR1 sur la table à chaque passe (même référence aux deux bouts)','oui'],['Arasements nets, sans éclat','oui'],["Pièce d'essai usinée et contrôlée",'oui']],
  'enfourchement': [['Enfourchements de 9,0 ± 0,1 mm à 9,0 ± 0,1 mm de SR1','2 / 2'],['Profondeur 40,0 ± 0,5 mm','2 / 2 (40,0 ; 40,0)'],['Pièce de 200 mm écartée, non usinée','oui'],['Vitesse ≤ n max des outils à chaque passe','oui'],['Sans éclat, joues intactes','oui']],
}
JEUX = {'tenon': TENON, 'serie': SERIE, 'enfourchement': ENFOURCHEMENT}
