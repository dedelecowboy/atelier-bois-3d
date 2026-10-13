/* Règles de la scie radiale : alertes de sécurité et de qualité, blocages de la coupe.
   Une alerte « danger » active au moment où l'on tire la lame est une faute grave (parcours évalué) ;
   toucher une pièce alors que la lame n'est pas revenue en position arrière en est une aussi.
   Sources : cours « La scie radiale » (Lycée André Malraux), fiche méthode « Débit des bois »,
   fiche « Scie radiale » du CCHST, catalogue constructeur.
   - main de maintien à moins de 150 mm du trait (zone rouge de la table) → danger ;
   - main posée hors du bois (pièce non tenue) → danger ;
   - pièce pas plaquée contre le guide → danger (la lame avalante l'entraîne : rejet, blocage) ;
   - protecteur avant plus de 10 mm au-dessus de la pièce → danger ;
   - bras ou tête non bloqués → danger ;
   - pièce à tronçonner plus courte que 300 mm → danger (impossible de la tenir hors de la zone). */
import { TABLE_Y, ZONE, MIN_LEN, MIN_USE, PROT_GAP, FENCE_Z, TABLE_Z1 } from './constants.js';
import { st, head, parked, bladeX } from './state.js';
import { pieces, cut, cur, onTable, extent, handOnWoodAt, defectsIn, againstGuide, againstStop, measure, produced, fmt } from './piece.js';

/* protecteur réglé au plus près : 1 à 10 mm au-dessus de la pièce */
export const protOk=p=>!!p && st.prot>=p.prof.T+PROT_GAP[0] && st.prot<=p.prof.T+PROT_GAP[1];
/* position de la main de maintien dans la scène : sur la pièce, à 70 mm du guide au plus, à handD du trait */
export function handXZ(){ const p=cur(); const e=p? extent(p) : {z0:FENCE_Z,z1:FENCE_Z+0.16};
  const z=e.z0+Math.min(0.07,(e.z1-e.z0)/2), T=p? p.prof.T/1000 : 0.027;
  const x=Math.min(...[TABLE_Y,TABLE_Y+T].map(y=>bladeX(y,z,-1)))-st.handD/1000;   // toujours à gauche de la lame
  return [x,z]; }
/* zone dangereuse peinte sur la table : 150 mm à gauche du trait au-dessus de la pièce, 150 mm à droite du trait au ras de la table ;
   elle suit l'angle du bras et l'inclinaison de la lame. [[x,z]] : arrière gauche, arrière droit, avant droit, avant gauche */
export function zonePoly(){ const T=(cur()?.prof.T||27)/1000, Z=ZONE/1000;
  return [FENCE_Z,TABLE_Z1].flatMap((z,i)=>{ const l=[bladeX(TABLE_Y+T,z,-1)-Z,z], r=[bladeX(TABLE_Y,z,1)+Z,z]; return i? [r,l] : [l,r]; }); }
export const handOnWood=()=>handOnWoodAt(...handXZ());
export const handOk=()=>st.handD>=ZONE && handOnWood();

/* raison de refuser la coupe (pas une faute : la machine ne le permet pas) */
export function passBlock(){ const p=cur(), t=onTable();
  if(!parked()) return 'Ramenez d\'abord la lame en position arrière, contre la colonne.';
  if(!t.length) return 'Pas de pièce sur la table : « Reprendre » une pièce dans « Pièces débitées », ou « Nouvelle pièce ».';
  if(t.length>1) return 'Dégagez d\'abord la table : gardez la pièce utile (contour orange) et « Évacuer les chutes ».';
  if(!st.motor) return 'Lame arrêtée : démarrez-la avant de la tirer.';
  if(st.prot<p.prof.T) return `Le protecteur (${st.prot} mm) bute contre la pièce (${p.prof.T} mm) : réglez-le 1 à 10 mm au-dessus de la pièce.`;
  return ''; }

/* le trait passe-t-il dans un défaut ? distance du trait au défaut le plus proche (mm), côté gauche/droit */
export function nearestDefect(){ const p=cur(); if(!p) return null; let best=null;
  for(const d of defectsIn(p)){ let lo=1e9, hi=-1e9; for(const [u,v] of d.poly){ const x=p.tx+(p.rev?-1:1)*u/1000; lo=Math.min(lo,x); hi=Math.max(hi,x); }
    const xl=bladeX(TABLE_Y,FENCE_Z,-1), xr=bladeX(TABLE_Y,FENCE_Z,1);
    const dist= hi<xl? (xl-hi)*1000 : lo>xr? -(lo-xr)*1000 : 0;   // > 0 : défaut à gauche du trait ; < 0 : à droite ; 0 : dans le trait
    if(!best||Math.abs(dist)<Math.abs(best.dist)) best={type:d.type, dist}; }
  return best; }

export function computeAlerts(){ const out=[]; if(cut.blocked) out.push(['danger',cut.blocked]);
  const p=cur(), t=onTable();
  if(p && parked() && t.length===1){ const m=measure(p);
    if(st.handD<ZONE) out.push(['danger',`MAIN DANS LA ZONE DE LA LAME (${st.handD} mm du trait) : la main de maintien reste hors de la zone rouge, à ${ZONE} mm au moins du trait, le plus loin possible de la lame.`]);
    if(st.handD>=ZONE && !handOnWood()) out.push(['danger','PIÈCE NON TENUE : la main n\'est pas posée sur le bois. La lame avalante entraîne une pièce libre. Rapprochez la main du trait, sans entrer dans la zone rouge.']);
    if(!againstGuide(p)) out.push(['danger','PIÈCE PAS PLAQUÉE CONTRE LE GUIDE : la lame, qui travaille en avalant, l\'entraînerait brutalement vers le guide (rejet, blocage de la lame). « Contre le guide ».']);
    if(st.prot>p.prof.T+PROT_GAP[1]) out.push(['danger',`PROTECTEUR TROP HAUT (${st.prot} mm pour une pièce de ${p.prof.T} mm) : l'avant de la lame est accessible. Réglez-le au plus près, ${PROT_GAP[0]} à ${PROT_GAP[1]} mm au-dessus de la pièce.`]);
    if(!st.lock) out.push(['danger','BRAS ET TÊTE NON BLOQUÉS : l\'angle peut changer pendant la coupe et la lame se coincer. Bloquez-les avant de démarrer.']);
    if(m.L<MIN_LEN) out.push(['danger',`PIÈCE TROP COURTE (${fmt(m.L,0)} mm) : moins de ${MIN_LEN} mm, on ne peut pas la tenir hors de la zone de la lame. Ne la tronçonnez pas.`]);
    if(st.stopOn && !againstStop(p)) out.push(['info','Butée en service : la pièce n\'est pas contre la butée (« Mettre la pièce en butée » la pousse contre le guide et la butée).']);
    const nd=nearestDefect(); if(nd){ const N={noeud:'nœud',fente:'fente en bout',gerce:'gerce'}[nd.type];
      if(nd.dist===0) out.push(['info',`Le trait de scie passe dans le défaut (${N}).`]);
      else out.push(['info',`Défaut le plus proche : ${N}, à ${fmt(Math.abs(nd.dist),0)} mm ${nd.dist>0?'à gauche':'à droite'} du trait.`]); } }
  if(!st.asp) out.push(['warn','Aspiration arrêtée : mettez-la en marche avant de démarrer la lame (poussières de bois cancérogènes).']);
  if(!st.motor) out.push(['info','Lame arrêtée.']);
  if(head.mode==='front') out.push(['warn','Lame en avant : ramenez-la en position arrière, derrière le guide, sans lâcher la poignée, AVANT de toucher aux pièces.']);
  if(head.mode==='pull'||head.mode==='back') out.push(['info','Lame en mouvement : la main gauche tient la pièce, la droite retient la poignée.']);
  if(parked() && t.length>1) out.push(['info','Deux pièces sur la table : gardez la pièce utile (contour orange, cliquez l\'autre pour la garder), « Évacuer les chutes », puis « Mettre la pièce en butée » ou « Mettre de côté ».']);
  return out; }

/* ---------- mesures des pièces produites ---------- */
export const goodOf=(L,tol=1)=>produced().filter(q=>{ const m=measure(q); return !m.defects.length && m.Lb.every(x=>Math.abs(x-L)<=tol); });
export { fmt };
