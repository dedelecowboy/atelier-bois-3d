# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Exercices guidés de la déligneuse multilames, joués comme un élève (corps JS passés à harness.js()).
Chaque jeu suppose le mode déjà choisi et rend {log, res, msgs}. Les passes sont animées : on attend leur fin."""

BASE = r"""
 const next=()=>$('stepNext').click(), stepOk=()=>!$('stepOk').hidden;
 const msgs=[]; const grab=()=>{ for(const a of alerts()) if(!msgs.includes(a)) msgs.push(a); };
 const log=[];
 const on=id=>{ if($(id).getAttribute('aria-pressed')!=='true') $(id).click(); };
 const off=id=>{ if($(id).getAttribute('aria-pressed')==='true') $(id).click(); };
 const man=m=>document.querySelector(`[data-man=${m}]`).click();
 const passe=async()=>{ grab(); $('pass').click(); await sleep(200); let n=0; while($('pass').getAttribute('aria-pressed')==='true' && n<600){ await sleep(100); n++; } await sleep(100); };
"""
END = r"""
 op('aside'); off('tapis'); off('motor'); log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""

AVIVE = BASE + r"""
 msgs.push('presseurs trop hauts au départ:'+alerts().some(a=>a.includes('PRESSEURS TROP HAUTS')));
 on('motor'); man('m1'); msgs.push('manchon refusé lames en marche:'+(document.querySelector('[data-man=m4]').getAttribute('aria-pressed')==='true'));
 off('motor');
 // l'arbre ralentit : attendre son arrêt complet avant de changer de manchon
 for(let n=0;n<80 && document.querySelector('[data-man=m1]').getAttribute('aria-pressed')!=='true';n++){ man('m1'); await sleep(100); }
 on('asp'); log.push(state('préparation')); next();
 setN('gw-n',85); op('guide'); setN('pres-n',25); on('motor');
 msgs.push('ampèremètre bas à 24 m/min:'+alerts().some(a=>a.includes('vous pouvez augmenter')));
 $('pass').click(); msgs.push('passe refusée tapis arrêté:'+alerts().some(a=>a.includes('Tapis arrêté : mettez le tapis en marche')));
 on('tapis'); setR('speed',42); log.push(state('réglages')); next();
 await passe(); log.push(state('passe 1'));
 next(); $('pass').click(); msgs.push('sortie à dégager:'+alerts().some(a=>a.includes('Dégagez d')));
 op('back'); msgs.push('ramener refusé sans évacuer:'+alerts().some(a=>a.includes('Évacuez d')));
 op('evac'); op('back'); msgs.push('reprise 91,8:'+!!document.querySelector('#stepChecks li[data-ok=true]')?.textContent.includes('91,8'));
 op('guide'); log.push(state('passe 2 prête'));
 await passe(); log.push(state('passe 2')); next();
""" + END

PLOT = BASE + r"""
 msgs.push('alertes rouges au départ:'+['PRESSEURS TROP HAUTS','PLATEAU INSTABLE','RIVE EN FLACHE CONTRE LE GUIDE'].filter(k=>alerts().some(a=>a.includes(k))).length);
 msgs.push('petit bout en premier:'+alerts().some(a=>a.includes('petit bout')));
 man('m2'); off('gup'); on('laser'); on('asp'); log.push(state('préparation')); next();
 op('flip'); op('end'); setN('pres-n',38);
 msgs.push('flache entre les traits:'+alerts().some(a=>a.includes('passe dans la flache')));
 for(let i=0;i<40;i++) op('zm10');
 let n=0; while(!ok(3) && n<500){ op('zp1'); n++; }
 msgs.push('décalage:'+n);
 log.push(state('position')); next();
 on('motor'); on('tapis'); msgs.push('surcharge à 24 m/min:'+alerts().some(a=>a.includes('surcharge')));
 setR('speed',14); log.push(state('passe prête'));
 await passe(); log.push(state('passe')); next();
""" + END

MULTI = BASE + r"""
 man('m4'); on('asp'); log.push(state('préparation')); next();
 setN('gw-n',45); op('guide'); setN('pres-n',25); on('motor'); on('tapis');
 msgs.push('surcharge 4 lames à 24 m/min:'+alerts().some(a=>a.includes('surcharge')));
 setR('speed',14); log.push(state('réglages')); next();
 await passe(); log.push(state('passe')); next();
""" + END

ATTENDU = {
  'avive': [['Pièce 1 : 85 ± 0,5 mm','85,0 mm'],['Pièce 2 : 85 ± 0,5 mm','85,0 mm'],['Rives sciées, parallèles','oui'],['Sans flache','aucune']],
  'plot':  [['Largeur 140 ± 0,5 mm','140,0 mm'],['Flache','aucune'],['Deux rives sciées, parallèles','2 / 2']],
  'multi': [['Tasseaux de 45 ± 0,5 mm','4 / 4'],['Rives sciées, parallèles','oui'],['Une seule passe','1']],
}
JEUX = {'avive': AVIVE, 'plot': PLOT, 'multi': MULTI}
