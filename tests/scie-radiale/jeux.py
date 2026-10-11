"""Exercices guidés de la scie radiale, joués comme un élève (corps JS passés à harness.js()).
Chaque jeu suppose le mode déjà choisi et rend {log, res, msgs}. Les coupes sont animées : on attend la fin de la course
de la tête (aller, puis retour en position arrière)."""

BASE = r"""
 const next=()=>$('stepNext').click(), stepOk=()=>!$('stepOk').hidden;
 const msgs=[]; const grab=()=>{ for(const a of alerts()) if(!msgs.includes(a)) msgs.push(a); };
 const log=[];
 const on=id=>{ if($(id).getAttribute('aria-pressed')!=='true') $(id).click(); };
 const off=id=>{ if($(id).getAttribute('aria-pressed')==='true') $(id).click(); };
 const wait=async id=>{ let n=0; while($(id).getAttribute('aria-pressed')==='true' && n<400){ await sleep(60); n++; } await sleep(60); };
 const pull=async()=>{ grab(); $('pull').click(); await sleep(60); await wait('pull'); };
 const ret=async()=>{ $('ret').click(); await sleep(60); await wait('ret'); };
 const cutOnce=async()=>{ await pull(); await ret(); op('evac'); };
 /* distance du défaut le plus proche au trait (mm) : > 0 à gauche, < 0 à droite, 0 dans le trait, null sans défaut */
 const dist=()=>{ const a=alerts().find(a=>a.includes('Défaut le plus proche')||a.includes('passe dans le défaut')); if(!a) return null; if(a.includes('passe dans le défaut')) return 0;
   const m=a.match(/à ([\d\s\u202f\u00a0]+) mm (à gauche|à droite)/); const v=+m[1].replace(/[\s\u202f\u00a0]/g,''); return m[2]==='à gauche'? v : -v; };
 /* trait juste à droite du défaut (défaut à gauche, 12 à 22 mm) */
 const rightOf=()=>{ let n=0; while(dist()>122 && n<40){ op('xp100'); n++; } while(dist()>22 && n<80){ op('xp10'); n++; } return dist(); };
 /* trait juste à gauche du défaut (défaut à droite, 12 à 22 mm) */
 const leftOf=()=>{ let n=0; while(!(dist()<=-12) && n<80){ op('xp10'); n++; } return dist(); };
 /* avance la planche pour que le trait enlève environ 30 mm du bout */
 const trim=()=>{ for(let i=0;i<7;i++) op('xp10'); op('xp1'); op('xp1'); };
"""
END = r"""
 op('aside'); off('motor'); log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

SERIE = BASE + r"""
 msgs.push('alertes rouges au départ:'+['PROTECTEUR TROP HAUT','PAS PLAQUÉE'].filter(k=>alerts().some(a=>a.includes(k))).length);
 on('asp'); setN('prot-n',30); op('guide'); log.push(state('préparation')); next();
 trim(); msgs.push('coupé à droite:'+document.getElementById('planSvg').textContent.match(/Coupé à droite du trait : (\d+)/)?.[1]);
 $('pull').click(); msgs.push('coupe refusée lame arrêtée:'+alerts().some(a=>a.includes('Lame arrêtée : démarrez-la')));
 on('motor'); await pull(); msgs.push('lame en avant:'+alerts().some(a=>a.includes('Lame en avant')));
 await ret(); op('evac'); log.push(state('affranchir')); next();
 setN('stop-n',550); $('stopOn').click(); op('back'); setN('hand-n',180); log.push(state('butée')); next();
 for(let i=0;i<4;i++){ await cutOnce(); op('back'); }
 msgs.push('reste trop court:'+alerts().some(a=>a.includes('PIÈCE TROP COURTE')));
 log.push(state('débit')); next();
""" + END

PURGE = BASE + r"""
 msgs.push('alertes rouges au départ:'+['PROTECTEUR TROP HAUT','MAIN DANS LA ZONE'].filter(k=>alerts().some(a=>a.includes(k))).length);
 setN('prot-n',30); $('stopOn').click(); on('asp'); setN('hand-n',250); log.push(state('préparation')); next();
 on('motor');
 msgs.push('fente:'+leftOf()); await cutOnce(); log.push(state('fente')); next();
 msgs.push('nœud 1:'+rightOf()); await cutOnce();
 msgs.push('nœud 2:'+leftOf()); await cutOnce(); log.push(state('nœud')); next();
 msgs.push('gerce 1:'+rightOf()); await cutOnce();
 msgs.push('gerce 2:'+leftOf()); await cutOnce(); log.push(state('gerce')); next();
""" + END

BIAIS = BASE + r"""
 document.querySelector('[data-beta="45"]').click(); msgs.push('inclinaison refusée tête bloquée:'+alerts().some(a=>a.includes('débloquez-les')));
 $('lock').click(); document.querySelector('[data-beta="45"]').click(); $('lock').click();
 setN('prot-n',25); on('asp'); log.push(state('préparation')); next();
 trim(); on('motor'); await pull(); await ret(); op('evac'); log.push(state('affranchir')); next();
 setN('stop-n',600); $('stopOn').click(); op('back'); log.push(state('butée')); next();
 for(let i=0;i<3;i++){ await cutOnce(); op('back'); }
 log.push(state('débit')); next();
""" + END

ATTENDU = {
  'serie': [['Montants de 550 ± 1 mm','4 / 4'],['Bouts sciés d\'équerre','oui']],
  'purge': [],
  'biais': [['Lames de 600 ± 1 mm (face posée)','3 / 3'],['Coupes à 45° aux deux bouts','oui'],['Bouts biais parallèles','oui']],
}
JEUX = {'serie': SERIE, 'purge': PURGE, 'biais': BIAIS}
