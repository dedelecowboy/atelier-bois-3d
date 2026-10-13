/* Règles de la raboteuse : alertes de sécurité et de qualité.
   Une alerte « danger » active au moment où l'on engage les pièces est une faute grave (parcours évalué).
   Gestes dangereux hors passe (main vers l'entrée ou les rouleaux, machine en marche) : relevés par app.recordDangers(liste).
   Sources : fiche OPPBTP « Raboteuse », cours « La raboteuse » du lycée, catalogue constructeur. */
import { MIN_LEN, PASS_MAX, PASS_WIDE, THICK_TOL, CHANT_RATIO, GRIP, RPM, Z_KNIVES, ENTRAXE } from './constants.js';
import { st } from './state.js';
import * as C from '../../engine/corroyage.js';
import { pieces, cut, entryPieces, stuckPieces, exitPieces, pressedH, baseW, dressed, sr1, sr2, fmt, FACE_NAME } from './piece.js';

/* geste de la main vers l'entrée ou les rouleaux, machine en marche (faute grave, hors passe) */
export const HANDS = 'MAINS PRÈS DE L\'ENTRÉE ET DES ROULEAUX : ne poussez jamais une pièce engagée, ne la débloquez jamais à la main machine en marche. Arrêtez l\'avance et le moteur, descendez la table, puis ressortez la pièce';

/* raison de refuser l'engagement (blocages, pas des fautes) */
export function passBlock(){ if(st.capot) return 'Capot ouvert : fermez-le (le moteur ne peut pas tourner capot ouvert).';
  if(!st.motor) return 'Moteur arrêté : démarrez l\'arbre avant d\'engager la pièce (elle buterait contre les lames).';
  if(!st.feed) return 'Avance arrêtée : mettez l\'avance en marche (interrupteur d\'avance), sinon les rouleaux n\'entraînent pas la pièce.';
  return ''; }

/* pas des ondes laissées par les lames (mm) : avance par tour de l'arbre et par lame */
export const wavePitch=()=>st.v*1000/(RPM*Z_KNIVES);

export function computeAlerts(){ const out=[]; if(cut.blocked) out.push(['danger',cut.blocked]);
  const E=entryPieces();
  for(const q of stuckPieces()) out.push(['warn',`PIÈCE COINCÉE (${q.name.toLowerCase()}) : arrêtez l'avance et le moteur, descendez la table (cote plus grande que la pièce), puis « Ressortir la pièce ». Jamais la main vers les rouleaux, même machine arrêtée.`]);
  if(E.length && !cut.inProgress){
    const grip=E.filter(q=>pressedH(q)>=st.H-GRIP), hmax=grip.length? Math.max(...grip.map(pressedH)) : 0;
    for(const q of E){ const nm=E.length>1? ` (${q.name.toLowerCase()})` : '', f=C.faces(q), H=C.heightMm(q), B=baseW(q);
      if(q.L<MIN_LEN) out.push(['danger',`PIÈCE TROP COURTE${nm} : ${q.L} mm, moins de ${MIN_LEN} mm. Mal tenue par les rouleaux (entraxe ${ENTRAXE} mm), elle peut rester coincée sous l'arbre ou être rejetée. Ne la passez pas.`]);
      if(C.rocking(q)) out.push(['danger',`PIÈCE INSTABLE${nm} : la face posée sur la table est bombée, la pièce bascule sous les rouleaux et peut être rejetée. Une pièce se dégauchit avant d'être rabotée.`]);
      else if(!C.isF(f.down) && H>CHANT_RATIO*B) out.push(['danger',`PIÈCE INSTABLE SUR CHANT${nm} : ${fmt(H,0)} mm de haut pour ${fmt(B,0)} mm d'appui (plus de ${CHANT_RATIO} fois). Elle bascule sous les rouleaux : mise à largeur à une autre machine.`]);
      else if(!dressed(q,f.down)) out.push(['warn',`Section de pièce non rectangulaire${nm}, car rabotage en appui sur une surface non dégauchie (${FACE_NAME[f.down].toLowerCase()} sur la table). Posez la face dressée (SR2 pour la largeur, SR1 pour l'épaisseur), ou renvoyez la pièce à la dégauchisseuse.`]);
      const s1=sr1(q), s2=sr2(q);
      if((s1&&f.up===s1)||(s2&&f.up===s2)) out.push(['warn',`Face de référence dessus${nm} (${f.up===s1?'SR1':'SR2'}, repérée au crayon) : vous allez raboter la référence. Retournez la pièce : la référence sur la table.`]); }
    if(grip.length){ const d=hmax-st.H, wide=Math.max(...grip.map(baseW));
      if(d>PASS_MAX) out.push(['danger',`PASSE TROP FORTE : ${fmt(d)} mm sur la pièce la plus épaisse (${PASS_MAX} mm au maximum). Risque de rejet, d'éclats et de calage du moteur : augmentez la cote.`]);
      else if(d>PASS_WIDE && wide>200) out.push(['warn',`Passe de ${fmt(d)} mm sur une pièce large (${fmt(wide,0)} mm) : ${PASS_WIDE} mm au plus sur les pièces larges.`]);
      if(d<=0.05) out.push(['info',`La cote (${fmt(st.H)} mm) n'est pas plus petite que la pièce (${fmt(hmax)} mm) : les rouleaux l'entraînent sans la raboter.`]); }
    else out.push(['info',`Cote (${fmt(st.H)} mm) plus grande que la pièce : les rouleaux ne la toucheront pas, elle n'avancera pas. Montez la table (cote plus petite).`]);
    if(E.length>1){ const hs=E.map(pressedH), dh=Math.max(...hs)-Math.min(...hs);
      if(dh>THICK_TOL) out.push(['danger',`PIÈCES DE HAUTEURS DIFFÉRENTES DE FRONT (écart ${fmt(dh)} mm) : le rouleau d'entrée monobloc ne tient que la plus haute ; l'autre est rejetée vers l'opérateur. Passez-les l'une après l'autre à la même cote, puis de front.`]); }
  }
  if(!st.asp) out.push(['warn','Aspiration arrêtée : mettez-la en marche (classe M) avant d\'usiner ; les poussières de bois sont cancérogènes.']);
  if(st.capot) out.push(['info','Capot ouvert : le moteur ne peut pas démarrer. Fermez-le avant le travail.']);
  if(!st.motor && !st.capot) out.push(['info','Moteur arrêté : démarrez l\'arbre, laissez-le prendre sa vitesse, puis l\'avance.']);
  if(st.motor && !st.feed && E.length) out.push(['info','Avance arrêtée : mettez l\'avance en marche pour engager la pièce.']);
  if(cut.inProgress) out.push(['info','Passe en cours : ne touchez plus la pièce, ne vous tenez pas dans l\'axe de l\'entrée (ligne de rejet). Récupérez-la à la sortie.']);
  return out; }
