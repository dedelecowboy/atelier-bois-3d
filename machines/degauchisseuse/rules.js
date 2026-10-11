/* Règles de la dégauchisseuse : alertes de sécurité et de qualité, mesures de la pièce.
   Une alerte « danger » active au moment où la passe commence est une faute grave (parcours évalué).
   Protecteur à pont (d'après la fiche d'utilisation de l'atelier) :
   - dressage du plat (SR1) : le pont passe au-dessus de la pièce, au plus près (2 mm), et recouvre l'arbre jusqu'au guide ;
   - dressage du chant (SR2) : le pont est abaissé sur la table et vient à 2 mm de la pièce ;
   - en fin de travail : le pont est rabattu contre le guide.
   Seuils proposés : de 2 à 10 mm = attention, plus de 10 mm = danger. */
import { MIN_LEN } from './constants.js';
import { st, bridgeEndZ } from './state.js';
import { p, cut, faces, mode, rocking, flatness, isFlat, againstGuide, heightMm, frontZ, thickness, FACE_NAME } from './piece.js';

/* état du protecteur par rapport à la pièce */
export function protState(){
  const H=heightMm(), zEnd=bridgeEndZ(), zF=frontZ();
  const overlap = zEnd < zF-0.001;                       // le pont est au-dessus de la pièce (ou dessus)
  return { m:mode(), H, dh:st.ph-H, e:(zEnd-zF)*1000, overlap, blocks: overlap && st.ph < H-0.5 };
}
/* raison de bloquer la passe (le pont, ou le moteur arrêté) */
export function passBlock(){ if(!st.motor) return 'Moteur arrêté : la pièce bute contre les fers.';
  const P=protState(); if(P.blocks) return P.m==='plat' ? `Le protecteur bloque la pièce : réglez sa hauteur à l'épaisseur de la pièce (${Math.round(P.H)} mm).` : 'Le protecteur est sur le passage de la pièce : écartez-le à 2 mm.';
  return ''; }

export function computeAlerts(){ const out=[]; if(cut.blocked) out.push(['danger',cut.blocked]); if(!p) return out;
  const f=faces(), P=protState();
  if(p.L<MIN_LEN) out.push(['danger',`PIÈCE TROP COURTE (${p.L} mm) : moins de ${MIN_LEN} mm, les mains passent trop près de l'arbre. N'usinez pas cette pièce.`]);
  if(rocking()) out.push(['danger','PIÈCE INSTABLE : la face bombée repose sur la table, la pièce bascule pendant la passe. Retournez-la : le creux sur la table.']);
  if(P.m==='plat'){
    if(!P.overlap) out.push(['danger','Le protecteur ne recouvre pas la pièce : pour dresser le plat, le pont passe au-dessus de la pièce et recouvre tout l\'arbre jusqu\'au guide.']);
    else if(P.blocks) out.push(['warn',`Le protecteur bloque la pièce : réglez la hauteur du pont à l'épaisseur de la pièce (${Math.round(P.H)} mm), au plus près.`]);
    else {
      if(P.dh>10) out.push(['danger',`PROTECTEUR TROP HAUT (${Math.round(P.dh)} mm au-dessus de la pièce) : les doigts peuvent passer sous le pont et toucher l'arbre. Abaissez-le au plus près de la pièce.`]);
      else if(P.dh>2) out.push(['warn',`Abaissez le protecteur au plus près de la pièce (${Math.round(P.dh)} mm au-dessus ; 2 mm au plus).`]);
      if(st.pg>10) out.push(['danger',`Le pont n'atteint pas le guide (${Math.round(st.pg)} mm) : l'arbre est découvert entre le pont et le guide. Amenez le pont contre le guide.`]);
      else if(st.pg>2) out.push(['warn','Amenez le pont contre le guide.']); }
  } else {
    if(P.blocks) out.push(['warn','Le pont est sur le passage de la pièce : écartez-le pour qu\'il soit à 2 mm de la pièce.']);
    else {
      if(st.ph>10) out.push(['danger','PROTECTEUR RELEVÉ : pour dresser le chant, le pont s\'abaisse sur la table et vient contre la pièce. Relevé, il laisse l\'arbre accessible devant la pièce.']);
      else if(st.ph>2) out.push(['warn','Abaissez le pont sur la table.']);
      if(P.e>10) out.push(['danger',`PROTECTEUR TROP ÉCARTÉ (${Math.round(P.e)} mm de la pièce) : l'arbre est découvert devant la pièce. Réglez le pont à 2 mm de la pièce.`]);
      else if(P.e>2) out.push(['warn',`Approchez le pont à 2 mm de la pièce (il est à ${Math.round(P.e)} mm).`]); }
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
