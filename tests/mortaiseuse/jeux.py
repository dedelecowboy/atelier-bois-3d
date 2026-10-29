"""Exercices guidés de la mortaiseuse, joués comme un élève (corps JS passés à harness.js()).
Chaque jeu suppose le mode déjà choisi et rend {log, res, msgs}. Les cycles sont animés : on attend leur fin et l'arrêt du bédane.
window.__mortaise donne l'état, les pièces et les mortaises aux tests (lecture seulement : l'élève, lui, clique)."""

BASE = r"""
 const next=()=>$('stepNext').click(), stepOk=()=>!$('stepOk').hidden;
 const msgs=[]; const grab=()=>{ for(const a of alerts()) if(!msgs.includes(a)) msgs.push(a); };
 const log=[];
 const on=id=>{ if($(id).getAttribute('aria-pressed')!=='true') $(id).click(); };
 const off=id=>{ if($(id).getAttribute('aria-pressed')==='true') $(id).click(); };
 const M=window.__mortaise, P=n=>M.pieces.find(q=>q.name===n), TB=()=>M.pieces.find(q=>q.state==='table');
 const num=(id,v)=>setN(id+'-n',String(v));
 const tq=(i,v)=>setN(`tq${i}-n`,String(v));
 const tqOn=i=>{ const b=document.querySelector(`[data-tqon="${i}"]`); if(b.getAttribute('aria-pressed')!=='true') b.click(); };
 const tqOff=i=>{ const b=document.querySelector(`[data-tqon="${i}"]`); if(b.getAttribute('aria-pressed')==='true') b.click(); };
 const ver=(k,v)=>setN(k+'-n',String(v));
 const until=async(f,n=300)=>{ let i=0; while(!f()&&i<n){ await sleep(100); i++; } };
 const bed=id=>document.querySelector(`[data-bed="${id}"]`).click();
 const take=n=>document.querySelector(`[data-take="${P(n).id}"]`).click();
 const kind=n=>document.querySelector(`[data-kind="${P(n).id}"]`).click();
 const green=()=>{ if(!M.st.on) $('green').click(); };
 const cycle=async()=>{ grab(); $('bed').click(); await sleep(150); await until(()=>!M.cyc.on,900); await until(()=>M.model.amp<0.02,200); await sleep(100); };
 const usine=async n=>{ take(n); green(); $('press').click(); await cycle(); $('depress').click(); op('aside'); };
"""
END = r"""
 log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

BEDANE = BASE + r"""
 on('asp'); log.push(state('préparation')); next();
 off('main'); on('cad'); $('green').click(); log.push(state('consigner')); next();
 on('capot'); off('tight'); $('unmount').click(); log.push(state('démonter')); next();
 bed('b10'); $('mount').click(); msgs.push('ébréché signalé au râtelier:'+document.querySelector('[data-bed="b10a"]').textContent.includes('ébréchées'));
 $('tight').click(); log.push(state('monter')); next();
 off('capot'); off('cad'); on('main'); green(); log.push(state('remise en service')); next();
 await cycle(); log.push(state('essai')); next();
""" + END

SIMPLE = BASE + r"""
 on('asp'); msgs.push('départ après 71 signalé:'+alerts().some(a=>a.includes('après 71'))); log.push(state('préparation')); next();
 log.push(state('épaisseur')); next();
 num('osc',40); log.push(state('longueur')); next();
 num('dep',50); num('arr',101); log.push(state('profondeur')); next();
 num('ar',9); msgs.push('arasement refusé capot fermé:'+(M.st.ar===12));
 on('capot'); num('ar',9); log.push(state('arasement')); next();
 off('capot'); tq(1,60); log.push(state('distance')); next();
 take("Pièce d'essai"); msgs.push('vérin devant le bédane signalé:'+alerts().some(a=>a.includes('VÉRIN DEVANT LE BÉDANE')));
 ver('v1',150); green(); $('press').click(); msgs.push('non serrée effacée:'+!alerts().some(a=>a.includes('PIÈCE NON SERRÉE')));
 await cycle(); $('depress').click(); op('peek'); const cam=__atelier.app.stage.camera.position;
 msgs.push('mortaise montée vers l\'élève (« Voir les mortaises »):'+(TB().peek && Math.abs(TB().group.rotation.y-Math.PI)<0.01 && cam.z>0.5 && cam.z<1.0));
 op('aside'); log.push(state('essai')); next();
 await usine('Montant'); log.push(state('montant')); next();
""" + END

SERIE = BASE + r"""
 on('asp'); log.push(state('préparation')); next();
 bed('b10a'); $('quick').click(); msgs.push('ébréché refusé:'+(M.st.tool==='b10'));
 bed('b8'); $('quick').click(); log.push(state('bédane')); next();
 on('capot'); num('ar',8); off('capot'); num('arr',108); log.push(state('profondeur')); next();
 msgs.push('taquet 1 décalé signalé:'+alerts().some(a=>a.includes('Taquet 1 à 20')));
 tq(0,0); tqOn(2); tq(2,160); log.push(state('distance')); next();
 take('Montant court'); msgs.push('pièce courte signalée:'+alerts().some(a=>a.includes('PIÈCE TROP COURTE'))); op('aside'); kind('Montant court'); log.push(state('lot')); next();
 await usine("Pièce d'essai"); log.push(state('essai')); next();
 for(const n of ['Montant 1','Montant 2']) await usine(n);
 log.push(state('premier bout')); next();
 off('butG'); on('butD');
 for(const n of ['Montant 1','Montant 2']){ take(n); op('right'); green(); $('press').click(); await cycle(); $('depress').click(); op('aside'); }
 log.push(state('deuxième bout')); next();
""" + END

ATTENDU = {
  'bedane': [['Consignation complète avant d\'intervenir (0, cadenas, essai de démarrage)','oui'],['Bédane de 10 mm en bon état monté','10 mm n° 2'],['Bédane serré, capot refermé','serré · capot fermé'],['Remise en service et essai à vide','oui']],
  'simple': [['Mortaise de 10,0 mm à 9,0 ± 0,2 mm de SR1','10,0 mm à 9,0 mm'],['Longueur 40,0 ± 0,5, à 60,0 ± 0,5 mm du bout','40,0 mm à 60,0 mm'],['Profondeur 30,0 ± 0,5 mm','30,0 mm'],["Pièce d'essai mortaisée et contrôlée avant le montant",'oui'],['Bords nets (taquet de départ avant 71)','nets']],
  'serie': [['4 mortaises de 8,0 mm à 8,0 ± 0,2 mm de SR1, longueur 60,0 ± 0,5','4 / 4'],['À 150,0 ± 0,5 mm de chaque bout','4 / 4 (150,0 ; 150,0 ; 150,0 ; 150,0)'],['Profondeur 37,0 ± 0,5 mm (tenon de 35 + 2 mm)','4 / 4'],['Montant de 220 mm écarté, non mortaisé','oui'],["Pièce d'essai : le tenon de la traverse entre (assemblage)",'oui']],
}
JEUX = {'bedane': BEDANE, 'simple': SIMPLE, 'serie': SERIE}
