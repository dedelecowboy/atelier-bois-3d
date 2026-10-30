# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Exercices guidés de la scie à format, joués comme un élève (corps JS passés à harness.js()).
Chaque jeu suppose le mode déjà choisi et rend {log, res, evac}."""

PASS = r"""
 const pass=()=>{ for(let s=1450;s>=-1500;s-=8){ setR('slide',s); }
   window.__evac=alerts().filter(t=>/Évacuez|évacuer/.test(t)); setR('slide',-1400); window.__blocked=$('slide').value;
   op('evac'); for(let s=-1500;s<=1450;s+=50) setR('slide',s); };
 const log=[];
"""
END = r"""
 log.push(state('contrôle'));
 return {log, res:results(), info:$('stepRes').textContent, evac:window.__evac, blocked:window.__blocked};
"""

# Mise au format 800 × 450 : dresser, équerrer, déligner, tronçonner.
FORMAT = PASS + r"""
 setR('height',30); setR('rip',700); log.push(state('prep')); $('stepNext').click();
 setR('stop',600); op('stop'); log.push(state('c1 placed')); pass(); log.push(state('c1 done')); $('stepNext').click();
 op('evac'); setR('stop',1010);
 for(let i=0;i<4;i++){ op('rotR'); op('fence'); if(ok(1)) break; }
 op('stop'); log.push(state('c2 placed')); pass(); log.push(state('c2 done')); $('stepNext').click();
 op('evac'); setR('rip',450);
 for(let i=0;i<4;i++){ op('rotR'); op('guide'); if(ok(2)) break; }
 log.push(state('c3 placed')); pass(); log.push(state('c3 done')); $('stepNext').click();
 op('evac'); setR('rip',700); setR('stop',800);
 let okp=false; for(let f=0;f<2&&!okp;f++){ if(f) op('flip'); for(let i=0;i<4;i++){ op('rotR'); op('fence'); op('stop'); if(ok(2)&&ok(3)){okp=true;break;} } }
 log.push(state('c4 placed')); pass(); log.push(state('c4 done')); $('stepNext').click();
""" + END

# Délignage d'une planche avec flache : rive au sabot, puis avivé de 160 mm.
PLANCHE = PASS + r"""
 setR('height',37); setR('rip',400); $('bsabot').click(); $('gshort').click(); log.push(state('prep')); $('stepNext').click();
 op('sabot'); let n=0; for(;n<200 && !ok(1);n++) op('zm1'); log.push(state('c1 placed after '+n+' mm')); pass(); log.push(state('c1 done')); $('stepNext').click();
 op('evac'); setR('rip',160); op('guide'); log.push(state('c2 placed')); pass(); log.push(state('c2 done')); $('stepNext').click();
""" + END

# Mélaminé avec inciseur : coupe d'essai sans inciseur, réglage, puis 800 × 400 sans éclat.
INCISEUR = PASS + r"""
 setR('height',30); setR('rip',700); log.push(state('prep')); $('stepNext').click();
 setR('stop',900); op('stop'); log.push(state('c1 placed')); pass(); op('flip'); log.push(state('c1 done')); $('stepNext').click();
 $('binc').click(); setN('incH',1.5); setN('incW',4.6); setN('incOff',0); log.push(state('reglage')); $('stepNext').click();
 setR('stop',800);
 let found=false; for(let f=0;f<2&&!found;f++){ if(f) op('flip'); for(let i=0;i<4;i++){ op('rotR'); op('fence'); op('stop'); if(ok(4)&&ok(6)){found=true;break;} } }
 log.push(state('c2 placed')); pass(); log.push(state('c2 done')); $('stepNext').click();
 setR('rip',400); for(let i=0;i<4;i++){ op('rotR'); op('guide'); if(ok(5)) break; }
 log.push(state('c3 placed')); pass(); log.push(state('c3 done')); $('stepNext').click();
""" + END

# Résultats attendus au contrôle final (libellé, valeur) ; toutes les lignes doivent être conformes (✓).
ATTENDU = {
  'format':   [['Longueur (800)', '800,0 mm'], ['Largeur (450)', '450,0 mm'], ['Écart de diagonales', '0,0 mm'], ["Défaut d'angle max", '0°'], ['Chants sciés', '4 / 4']],
  'planche':  [['Largeur (160)', '160,0 mm'], ['Défaut de parallélisme', '0°'], ['Flache restante', 'aucune'], ['Rives sciées', '2 / 2']],
  'inciseur': [['Longueur (800)', '800,0 mm'], ['Largeur (400)', '400,0 mm'], ['Éclats au recto', 'aucun'], ['Éclats au verso', 'aucun'], ['Équerrage (diagonales)', '0,0 mm']],
}
JEUX = {'format': FORMAT, 'planche': PLANCHE, 'inciseur': INCISEUR}
