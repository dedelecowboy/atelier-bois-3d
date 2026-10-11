/* Règles de la déligneuse multilames : alertes de sécurité et de qualité, blocages de la passe.
   Une alerte « danger » active au moment où la pièce est engagée est une faute grave (parcours évalué).
   Sources : INRS ED 6019 « Déligneuses à lames multiples », notice constructeur (longueur mini 390 mm).
   - pièce plus courte que la longueur minimale → danger (pas tenue à la fois par les presseurs avant et arrière) ;
   - presseurs à la hauteur de la pièce ou plus haut → danger (pièce non plaquée : rejet vers l'opérateur) ;
   - plateau posé sur sa petite face (petit découvert dessous) → danger (instable sous les presseurs) ;
   - rive en flache contre le guide → danger (comme à la scie à format). */
import { MIN_LEN, GREEN } from './constants.js';
import { st, guideZ } from './state.js';
import { pieces, cut, cur, exitPieces, faceStats, guideSideFlache, againstGuide, predict, bladesIn, load, measure, fmt } from './piece.js';

/* réglage correct des presseurs : 1 à 4 mm sous l'épaisseur de la pièce */
export const presOk=p=>!!p && st.H<=p.T-1 && st.H>=p.T-4;
/* raison de refuser la passe (pas une faute : la machine ne le permet pas) */
export function passBlock(p){
  if(!st.motor) return 'Lames arrêtées : démarrez-les avant d\'engager la pièce.';
  if(!st.tapis) return 'Tapis arrêté : mettez le tapis en marche. La pièce s\'engage toujours tapis en marche, jamais en la poussant sous les lames.';
  if(st.H<p.T-4) return `La pièce (${p.T} mm) bute contre les rouleaux presseurs réglés à ${st.H} mm : réglez-les 1 à 4 mm sous l'épaisseur de la pièce.`;
  return ''; }
/* une pièce de bois sain (sans flache) sortirait-elle entre deux traits ? */
export function innerFlache(p){ return predict(p).some(q=>q.c1>-1e8 && q.c2<1e8 && measure(q).flache); }

export function computeAlerts(){ const out=[]; if(cut.blocked) out.push(['danger',cut.blocked]);
  const p=cur();
  if(p){ const fs=faceStats(p), L=load(p);
    if(p.L<MIN_LEN) out.push(['danger',`PIÈCE TROP COURTE (${p.L} mm) : moins de ${MIN_LEN} mm, elle n'est pas tenue à la fois par les presseurs avant et arrière et peut être rejetée. Ne l'engagez pas.`]);
    if(st.H>=p.T) out.push(['danger',`PRESSEURS TROP HAUTS (${st.H} mm pour une pièce de ${p.T} mm) : ils ne plaquent pas la pièce sur le tapis, elle peut être rejetée vers l'opérateur. Réglez-les 1 à 4 mm sous l'épaisseur.`]);
    if(fs.down<fs.up-10) out.push(['danger','PLATEAU INSTABLE : il est posé sur sa petite face et bascule sous les presseurs (risque de rejet). Retournez-le : grande face sur le tapis, petit découvert dessus.']);
    if(againstGuide(p) && guideSideFlache(p)) out.push(['danger','RIVE EN FLACHE CONTRE LE GUIDE : elle n\'est pas droite, la pièce n\'est pas guidée et peut se mettre de travers ou être rejetée. Escamotez le guide et positionnez le plateau au laser.']);
    if(!cut.inProgress){
      if(fs.lead<fs.trail-8) out.push(['warn','Le petit bout entre en premier : engagez la pièce par son gros bout (« Bout pour bout »), sinon elle risque de se bloquer en fin de sciage.']);
      if(st.guideUp && !againstGuide(p) && !guideSideFlache(p)) out.push(['info','Pièce pas en appui contre le guide : « Contre le guide » pour une largeur exacte.']);
      if(!st.guideUp && !st.laser) out.push(['warn','Guide escamoté : allumez le laser pour voir où passeront les traits de scie.']);
      if(!bladesIn(p)) out.push(['info','Aucune lame ne scie la pièce à cette position.']);
      else if(innerFlache(p)) out.push(['info','Un trait de scie passe dans la flache : la pièce entre les deux traits gardera de la flache. Décalez la pièce.']); }
    if(L>100) out.push(['warn',`Ampèremètre en surcharge (${L} %) : la vitesse d'avance est trop élevée pour ${bladesIn(p)} lame${bladesIn(p)>1?'s':''} dans ${p.T} mm de ${p.wood==='chene'?'chêne':p.wood==='hetre'?'hêtre':'sapin'}. Réduisez-la pour rester dans la zone verte (${GREEN[0]} à ${GREEN[1]} %).`]);
    else if(L>0 && L<GREEN[0]) out.push(['info',`Ampèremètre à ${L} % : vous pouvez augmenter la vitesse d'avance.`]); }
  if(!st.asp) out.push(['warn','Aspiration arrêtée : mettez-la en marche avant de démarrer les lames (poussières de bois cancérogènes, sciure qui engorge la machine).']);
  if(!st.motor) out.push(['info','Lames arrêtées.']);
  if(cut.inProgress && !st.tapis) out.push(['warn','Tapis arrêté : la pièce est immobilisée sous les lames. Remettez le tapis en marche pour la faire sortir.']);
  else if(!st.tapis) out.push(['info','Tapis arrêté.']);
  if(!cut.inProgress && exitPieces().length) out.push(['info','Pièces à la sortie : gardez la pièce utile (contour orange), « Évacuer les chutes », puis « Ramener la pièce » ou « Mettre de côté ».']);
  if(cut.inProgress) out.push(['info','Sciage en cours : restez sur le côté, hors de l\'axe de la pièce. Ne touchez jamais une pièce engagée.']);
  return out; }

/* ---------- mesures des pièces produites par les passes ---------- */
export const produced=()=>pieces.filter(q=>q.gen>0&&q.state!=='moving').map(q=>({q, m:measure(q)}));
export const goodOf=(W,tol=0.5)=>produced().filter(({m})=>m.kind==='avivé' && Math.abs(m.W-W)<=tol);
export const loadOk=()=>cut.maxLoad<=100;
export { fmt };
