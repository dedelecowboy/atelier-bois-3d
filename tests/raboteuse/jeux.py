# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
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
 const prep=()=>{ on('asp'); setR('speed',10); };
 const sel=n=>R.setSel(P(n).id);
 const down=n=>R.C.faces(P(n)).down;
 const chant=n=>{ sel(n); for(let i=0;i<4 && down(n)!=='C1';i++) op('rot'); };      // sur chant, SR2 (C1) sur la table
 const plat=n=>{ sel(n); for(let i=0;i<4 && down(n)!=='F1';i++) op('rot'); };       // à plat, SR1 (F1) sur la table
 const back=n=>{ sel(n); op('back'); };
 const mx=(ns,f)=>Math.max(...ns.map(n=>M(P(n))[f])), mn=(ns,f)=>Math.min(...ns.map(n=>M(P(n))[f]));
"""
END = r"""
 op('aside'); off('feed'); off('motor'); log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

PIECE = BASE + r"""
 msgs.push('moteur refusé capot ouvert:'+(()=>{ $('capot').click(); $('motor').click(); const r=$('motor').getAttribute('aria-pressed')==='false'; $('capot').click(); return r; })());
 msgs.push('SR1 dessus au départ:'+alerts().some(a=>a.includes('Face de référence dessus')));
 prep(); log.push(state('préparation')); next();
 const N='Traverse', A=P(N);
 chant(N); cote(M(A).Wmax-3); on('motor'); on('feed'); log.push(state('réglage largeur')); next();
 let n=0; while(!stepOk() && n<6){ await passe(); back(N); if(M(A).W>70.05) cote(Math.max(70,M(A).W-3.5)); n++; }
 log.push(state('largeur')); next();
 plat(N); cote(M(A).Tmax-2); log.push(state('réglage épaisseur')); next();
 n=0; while(!stepOk() && n<6){ await passe(); back(N); if(M(A).T>27.05) cote(Math.max(27,M(A).T-2.5)); n++; }
 log.push(state('épaisseur')); next();
""" + END

SERIE = BASE + r"""
 prep(); log.push(state('préparation')); next();
 const S=['Montant 1','Montant 2','Montant 3'];
 chant(S[0]); take(S[1]);                                          // deux montants de largeurs différentes sur chant, de front
 chant(S[1]); msgs.push('largeurs différentes de front:'+alerts().some(a=>a.includes('HAUTEURS DIFFÉRENTES DE FRONT')));
 op('aside');
 cote(Math.min(mx(S,'Wmax')-2.5, mn(S,'W')-0.3)); on('motor'); on('feed'); log.push(state('réglage largeur')); next();
 await passe(); take(S[1]); chant(S[1]); await passe(); take(S[2]); chant(S[2]); await passe();
 for(const s of S) back(s);                                        // même largeur : de front
 msgs.push('de front même largeur sans alerte:'+!alerts().some(a=>a.includes("DIFFÉRENTES")));
 cote(72.4); await passe(); for(const s of S) back(s); cote(70); await passe();
 log.push(state('largeur série')); next();
 back(S[0]); plat(S[0]); cote(Math.min(mx(S,'Tmax')-2.5, mn(S,'T')-0.3)); log.push(state('réglage épaisseur')); next();
 await passe(); back(S[1]); plat(S[1]); await passe(); back(S[2]); plat(S[2]); await passe();
 for(const s of S) back(s); cote(28.3); await passe(); for(const s of S) back(s); cote(27); await passe();
 log.push(state('épaisseur série')); next();
""" + END

CONTROLE = BASE + r"""
 prep(); log.push(state('préparation')); next();
 take('Chêne');                                                  // on regarde la pièce de chêne sur la table
 const brute=alerts().some(a=>a.includes('Section de pièce non rectangulaire'));
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
  'piece':    [['Largeur 70 ± 0,1 mm','70,0 mm'],['Épaisseur 27 ± 0,1 mm','27,0 mm'],['Faces rabotées parallèles à SR1 et SR2 (0,1 mm max.)','0,0 mm'],['Équerre SR1 / chant raboté (90 ± 0,2°)','90,0°'],['Repères SR1 et SR2 conservés','oui'],['Arrachements','aucun']],
  'serie':    [['Largeur 70 ± 0,1 mm','3 / 3'],['Épaisseur 27 ± 0,1 mm','3 / 3'],['Faces rabotées parallèles (0,1 mm max.)','0,0 mm'],['Repères SR1 et SR2 conservés','oui'],['Arrachements','aucun']],
  'controle': [['Frêne : 22 ± 0,1 mm','22,0 mm'],['Arrachements','aucun'],['Face rabotée parallèle à SR1 (0,1 mm max.)','0,0 mm'],['Pièce cintrée renvoyée à la dégauchisseuse','oui'],['Repères SR1 et SR2 conservés','oui']],
}
JEUX = {'piece': PIECE, 'serie': SERIE, 'controle': CONTROLE}
