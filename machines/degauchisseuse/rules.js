/* Règles de la dégauchisseuse : alertes de sécurité et de qualité, mesures de la pièce.
   Une alerte « danger » active au moment où la passe commence est une faute grave (parcours évalué).
   Protecteur SUVAMATIC (documentation SUVA) : la couverture repose sur la table contre le guide, rappelée par ressort ;
   le seul réglage est l'orientation du bec d'engagement :
   - dressage du plat (SR1) : bec vertical, la pièce soulève la couverture qui glisse sur elle ;
   - dressage du chant (SR2) : bec horizontal, la pièce écarte la couverture du guide de son épaisseur ;
   la couverture revient seule sur la table, contre le guide, après le passage. */
import { MIN_LEN } from './constants.js';
import { st, guideZ } from './state.js';
import { p, cut, faces, mode, rocking, flatness, isFlat, againstGuide, heightMm, frontZ, leadX, thickness, FACE_NAME } from './piece.js';

/* la pièce est sous la couverture (zone de l'arbre) */
export const engaged=()=>!!p && leadX()<0.07 && leadX()+p.L/1000>-0.05;
/* position de la couverture : y = dessous de la couverture au-dessus de la table (m), zTip = bout côté guide */
export function coverPose(){ if(!engaged()) return { y:0, zTip:guideZ() };
  return st.bec==='plat' ? { y:heightMm()/1000, zTip:guideZ() } : { y:0, zTip:frontZ() }; }
/* état du protecteur : le bec est-il orienté pour le travail en cours ? */
export function protState(){ const m=mode(); return { m, H:heightMm(), ok: st.bec===m }; }
/* raison de bloquer la passe */
export function passBlock(){ return st.motor? '' : 'Moteur arrêté : la pièce bute contre les fers.'; }

export function computeAlerts(){ const out=[]; if(cut.blocked) out.push(['danger',cut.blocked]); if(!p) return out;
  const f=faces(), P=protState();
  if(p.L<MIN_LEN) out.push(['danger',`PIÈCE TROP COURTE (${p.L} mm) : moins de ${MIN_LEN} mm, les mains passent trop près de l'arbre. N'usinez pas cette pièce.`]);
  if(rocking()) out.push(['danger','PIÈCE INSTABLE : la face bombée repose sur la table, la pièce bascule pendant la passe. Retournez-la : le creux sur la table.']);
  if(P.m==='plat'){
    if(!P.ok) out.push(['danger','BEC D\'ENGAGEMENT MAL ORIENTÉ : pour dresser le plat, mettez le bec à la verticale. Horizontal, il fait écarter la couverture sur le côté : elle ne recouvre plus la pièce et les mains passent au-dessus de l\'arbre.']);
  } else {
    if(!P.ok) out.push(['danger','BEC D\'ENGAGEMENT MAL ORIENTÉ : pour dresser le chant, mettez le bec à l\'horizontale. Vertical, il fait monter la couverture sur la pièce : l\'arbre reste découvert devant la pièce.']);
    const todo=!isFlat(f.down)||cut.inProgress;          // conseils de qualité seulement s'il reste à usiner ce chant
    if(todo&&!againstGuide()) out.push(['warn','Plaquez la face dressée (SR1) contre le guide (« Contre le guide »).']);
    else if(todo&&!isFlat(f.back)) out.push(['warn',`La face contre le guide (${FACE_NAME[f.back].toLowerCase()}) n'est pas dressée : le chant ne sera pas d'équerre. Dressez d'abord le plat (SR1).`]);
    if(todo&&Math.abs(st.ga-90)>0.01) out.push(['warn',`Guide incliné à ${st.ga.toLocaleString('fr-FR')}° : pour un chant d'équerre, réglez le guide à 90°.`]);
  }
  if(st.d>2) out.push(['warn',`Passe trop forte (${st.d.toLocaleString('fr-FR')} mm) : 1 à 2 mm pour dégauchir, moins pour finir.`]);
  else if(st.d===0) out.push(['info','Profondeur de passe nulle : la table d\'entrée est au niveau de la table de sortie, rien ne sera enlevé.']);
  if(!st.asp) out.push(['warn','Aspiration arrêtée : mettez-la en marche avant d\'usiner (les poussières de bois sont cancérogènes).']);
  if(!st.motor) out.push(['info','Moteur arrêté : démarrez-le avant la passe.']);
  if(cut.inProgress) out.push(['info','Passe en cours : poussez la pièce régulièrement, sans vous arrêter, en appuyant sur la table de sortie.']);
  if(cut.done) out.push(['warn','Passe terminée : ramenez la pièce en la soulevant (« Ramener la pièce »), sans la faire repasser sur l\'arbre.']);
  return out; }

/* ---------- mesures ---------- */
/* SR1 : plat dressé (de préférence celui qui porte le repère) ; SR2 : chant dressé contre SR1 */
export function sr1(){ if(!p) return null; const fl=['F1','F2'].filter(f=>isFlat(f)); return fl.find(f=>p.face[f].mark==='loop')||fl[0]||null; }
export function sr2(){ const s1=sr1(); if(!s1) return null; const fl=['C1','C2'].filter(f=>isFlat(f)&&p.face[f].angle&&p.face[f].angle.ref===s1); return fl.find(f=>p.face[f].mark)||fl[0]||null; }
export function measureD(){ if(!p) return null; const s1=sr1(), s2=sr2();
  const bestF=s1||(flatness('F1')<=flatness('F2')?'F1':'F2'), bestC=s2||(flatness('C1')<=flatness('C2')?'C1':'C2');
  return { s1, s2, flat1:flatness(bestF), flat2:flatness(bestC), angle: s2? p.face[s2].angle.deg : (p.face[bestC].angle?.deg??null),
    tear1:p.face[bestF].tear, tear2:p.face[bestC].tear,
    mark1: !!(s1&&p.face[s1].mark==='loop'), mark2: !!(s2&&p.face[s2].mark&&p.face[s2].markRef===s1),
    T:thickness(), W:Math.min(...p.v2.map((x,i)=>x-p.v1[i])) }; }
