"""Exercices guidés de la raboteuse, joués comme un élève (corps JS passés à harness.js()).
Chaque jeu suppose le mode déjà choisi et rend {log, res, msgs}. Les passes sont animées : on attend leur fin.
window.__rabot donne les pièces et leurs mesures (lecture seulement : l'élève, lui, clique les pièces)."""

BASE = r"""
 const next=()=>$('stepNext').click(), stepOk=()=>!$('stepOk').hidden;
 const msgs=[]; const grab=()=>{ for(const a of alerts()) if(!msgs.includes(a)) msgs.push(a); };
 const log=[];
 const on=id=>{ if($(id).getAttribute('aria-pressed')!=='true') $(id).click(); };
 const off=id=>{ if($(id).getAttribute('aria-pressed')==='true') $(id).click(); };
 const R=window.__rabot, M=q=>R.measure(q), P=n=>R.pieces.find(q=>q.name===n);
 const cote=v=>setN('cote-n',(Math.round(v*10)/10).toFixed(1));
 const passe=async()=>{ grab(); $('pass').click(); await sleep(150); let n=0; while(R.cut.inProgress && n<900){ await sleep(100); n++; } await sleep(150); };
 const take=n=>document.querySelector(`[data-take="${P(n).id}"]`).click();
 const kind=n=>document.querySelector(`[data-kind="${P(n).id}"]`).click();
 const prep=()=>{ on('asp'); $('ling').click(); setR('speed',10); };
"""
END = r"""
 op('aside'); off('feed'); off('motor'); log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

EPAISSEUR = BASE + r"""
 msgs.push('moteur sans capot fermé:'+(()=>{ $('capot').click(); $('motor').click(); const r=$('motor').getAttribute('aria-pressed')==='false'; $('capot').click(); return r; })());
 prep(); log.push(state('préparation')); next();
 msgs.push('SR1 dessus au départ:'+alerts().some(a=>a.includes('Face de référence dessus')));
 op('flip');                                                     // SR1 sur la table
 const A=P('Montant 1'), B=P('Montant 2'), tmax=Math.max(M(A).Tmax,M(B).Tmax), tmin=Math.min(M(A).T,M(B).T);
 cote(tmax-6.5); msgs.push('passe trop forte signalée:'+alerts().some(a=>a.includes('PASSE TROP FORTE')));
 cote(Math.min(tmax-2.5, tmin-0.3)); on('motor'); on('feed'); log.push(state('réglage')); next();
 await passe(); log.push(state('montant 1 passé'));
 take('Montant 2'); op('back');                                  // les deux montants de front sur la table d'entrée
 msgs.push('épaisseurs différentes de front:'+alerts().some(a=>a.includes("PIÈCES D'ÉPAISSEURS DIFFÉRENTES")));
 op('aside');                                                    // le montant 1 (en main) reste de côté
 op('flip'); await passe(); log.push(state('passe 1'));
 next();
 op('back'); take('Montant 1');                                  // même épaisseur : de front
 msgs.push('de front même épaisseur sans alerte:'+!alerts().some(a=>a.includes("PIÈCES D'ÉPAISSEURS DIFFÉRENTES")));
 cote(28.2); await passe(); op('back'); op('back');
 cote(27.0); await passe(); log.push(state('finition'));
 next();
""" + END

LARGEUR = BASE + r"""
 prep(); log.push(state('préparation')); next();
 const A=P('Traverse');
 for(let i=0;i<4 && !ok(0);i++) op('rot');                       // sur chant, SR2 sur la table
 cote(M(A).Wmax-3); on('motor'); on('feed'); log.push(state('réglage')); next();
 let n=0; while(!(Math.abs(M(A).W-70)<0.05 && stepOk()) && n<6){ await passe(); op('back'); if(M(A).W>70.05) cote(Math.max(70,M(A).W-3.5)); n++; }
 msgs.push('passes:'+n); log.push(state('largeur'));
 next();
""" + END

CONTROLE = BASE + r"""
 prep(); log.push(state('préparation')); next();
 take('Chêne');                                                  // on regarde la pièce de chêne sur la table
 const brute=alerts().some(a=>a.includes('Face posée non dressée'));
 op('aside'); kind('Chêne'); log.push(state('contrôle du lot')); next();
 msgs.push('chêne : face non dressée signalée:'+brute);
 const A=P('Frêne');
 op('flip');                                                     // SR1 sur la table (présenté contre le fil)
 cote(M(A).Tmax-1.5); on('motor'); on('feed'); log.push(state('réglage')); next();
 await passe(); op('back');
 msgs.push('arrachements contre le fil:'+M(A).tear);
 op('end'); cote(M(A).T-1.3); await passe(); op('back');
 msgs.push('arrachements effacés bout pour bout:'+!M(A).tear);
 let n=0; while(M(A).T>22.05 && n<4){ cote(Math.max(22,M(A).T-2)); await passe(); op('back'); n++; }
 log.push(state('épaisseur'));
 next();
""" + END

ATTENDU = {
  'ep':       [['Montant 1 : 27 ± 0,1 mm','27,0 mm'],['Montant 2 : 27 ± 0,1 mm','27,0 mm'],['Faces rabotées parallèles à SR1 (0,1 mm max.)','0,0 mm'],['Repères SR1 et SR2 conservés','oui'],['Arrachements','aucun']],
  'lar':      [['Largeur 70 ± 0,1 mm','70,0 mm'],['Chant raboté parallèle à SR2 (0,1 mm max.)','0,0 mm'],['Équerre SR1 / chant raboté (90 ± 0,2°)','90,0°'],['Repères SR1 et SR2 conservés','oui'],['Arrachements','aucun']],
  'controle': [['Frêne : 22 ± 0,1 mm','22,0 mm'],['Arrachements','aucun'],['Face rabotée parallèle à SR1 (0,1 mm max.)','0,0 mm'],['Pièce cintrée renvoyée à la dégauchisseuse','oui'],['Repères SR1 et SR2 conservés','oui']],
}
JEUX = {'lar': LARGEUR, 'ep': EPAISSEUR, 'controle': CONTROLE}
