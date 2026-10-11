"""Exercices guidés de la dégauchisseuse, joués comme un élève (corps JS passés à harness.js()).
Chaque jeu suppose le mode déjà choisi et rend {log, res, msgs}."""

BASE = r"""
 const pass=()=>{ const mx=+$('travel').max; for(let t=0;t<=mx;t+=10) setR('travel',t); setR('travel',mx); };
 const back=()=>op('back'), next=()=>$('stepNext').click(), stepOk=()=>!$('stepOk').hidden;
 const msgs=[]; const grab=()=>{ for(const a of alerts()) if(!msgs.includes(a)) msgs.push(a); };
 const log=[];
 const on=id=>{ if($(id).getAttribute('aria-pressed')!=='true') $(id).click(); };
 const bec=v=>{ $(v==='plat'?'becPlat':'becChant').click(); return v; };
 const passUntil=()=>{ let n=0; while(!stepOk() && n<8){ pass(); grab(); back(); n++; } return n; };
"""
END = r"""
 $('motor').click(); log.push(state('fin')); next();
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, msgs};
"""
SR2 = r"""
 next(); for(let i=0;i<4 && !(ok(0)&&ok(1));i++){ op('rot'); op('guide'); }
 msgs.push('alerte bec horizontal sur chant:'+alerts().some(a=>a.includes("BEC D'ENGAGEMENT")));
 bec('chant'); log.push(state('sr2 placé, bec vertical'));
 const n2=passUntil(); log.push(state('sr2 après '+n2+' passe(s)'));
 next(); op('flip'); op('mark'); log.push(state('repère sr2')); next();
"""
RECT = BASE + r"""
 on('asp'); on('motor'); log.push(state('prep')); next();
 op('guide'); bec('plat'); log.push(state('sr1 placé, bec horizontal'));
 const n=passUntil(); log.push(state('sr1 après '+n+' passe(s)'));
 next(); op('flip'); op('mark'); log.push(state('repère sr1'));
""" + SR2 + END

COURBE = BASE + r"""
 on('asp'); on('motor'); next();
 const unstable=alerts().some(a=>a.includes('PIÈCE INSTABLE'));
 op('flip'); op('guide'); const stable=!alerts().some(a=>a.includes('PIÈCE INSTABLE'));
 bec('plat'); log.push(state('sr1 placé, bec horizontal'));
 const n=passUntil(); log.push(state('sr1 après '+n+' passe(s)'));
 msgs.push('instable au départ:'+unstable, 'stable retournée:'+stable, 'passes SR1:'+n);
 next(); op('flip'); op('mark'); log.push(state('repère sr1'));
""" + SR2 + END

FIL = BASE + r"""
 on('asp'); on('motor'); next();
 op('guide'); bec('plat');
 pass(); grab(); back();                      // première passe contre le fil : arrachements
 const torn=$('facesTab').textContent.includes('arrachements');
 op('end'); op('guide'); pass(); grab(); back();   // bout pour bout : dans le sens du fil
 const clean=!$('facesTab').textContent.includes('arrachements');
 msgs.push('arrachée contre le fil:'+torn, 'propre dans le sens du fil:'+clean);
 log.push(state('sr1'));
 next(); op('flip'); op('mark'); log.push(state('repère sr1'));
""" + SR2 + END

ATTENDU = {
  'rect':   [['Planéité SR1 (0,05 mm max.)','0 mm'],['Planéité SR2 (0,05 mm max.)','0 mm'],['Angle SR1 / SR2 (90 ± 0,2°)','90°'],['Arrachements','aucun'],['Repères au crayon SR1 et SR2','tracés']],
  'courbe': [['Planéité SR1 (0,05 mm max.)','0 mm'],['Planéité SR2 (0,05 mm max.)','0 mm'],['Angle SR1 / SR2 (90 ± 0,2°)','90°'],['Arrachements','aucun'],['Repères au crayon SR1 et SR2','tracés']],
  'fil':    [['Planéité SR1 (0,05 mm max.)','0 mm'],['Planéité SR2 (0,05 mm max.)','0 mm'],['Angle SR1 / SR2 (90 ± 0,2°)','90°'],['Arrachements','aucun'],['Repères au crayon SR1 et SR2','tracés']],
}
JEUX = {'rect': RECT, 'courbe': COURBE, 'fil': FIL}
