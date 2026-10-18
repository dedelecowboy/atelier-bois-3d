/* Règles de la toupie (travail au guide) : alertes de sécurité et de qualité, blocages.
   Une alerte « danger » active au moment où l'on engage la pièce est une faute grave (parcours évalué).
   Gestes dangereux hors passe (réglage moteur en marche, choc de l'outil au démarrage, main vers la pièce arrêtée) :
   relevés par app.recordDangers(liste).
   Sources : fiche INRS A646 « Toupie (travail au guide) », fiche OPPBTP « Toupie : les points clés », article OPPBTP
   « Travailler en sécurité sur une toupie », cours « La toupie » du lycée, procédure de réglage de l'atelier. */
import { MIN_LEN, MIN_BASE, RATIO, PASS_MAX, JEU_MIN, JEU_OK, JEU_MAX, E_TOL, E_SNIPE, PRESS_DOWN, RING_JEU, RING_WIDE, RPMS } from './constants.js';
import { st, tool, saillie } from './state.js';
import { Rmax, speedCheck, advisedRpm, Dmm, VC_MIN, VC_MAX } from './tools.js';
import { cut, entryPiece, butePiece, predict, edgesOk, appui, haut, fmt } from './piece.js';
import { lamStatus, entrPress, ENT_PRESS, ENT_DOWN, entrZ, rollCover, ENT_CLR } from './guide.js';

/* gestes hors passe (faute grave) */
export const INTERV = 'RÉGLAGE MOTEUR EN MARCHE : outil, inverseur, hauteur, guide, presseurs ou bague de table ne se règlent qu\'arbre arrêté. Arrêtez le moteur, attendez l\'arrêt complet de l\'arbre (frein), puis réglez';
export const CHOC = 'CHOC DE L\'OUTIL AU DÉMARRAGE : l\'outil touche les lamelles du guide ou la bague de table. Machine consignée, faites tourner l\'outil à la main pour vérifier qu\'il ne touche rien avant de démarrer';
export const HANDS = 'MAINS VERS LA PIÈCE ARRÊTÉE CONTRE L\'OUTIL, MOTEUR EN MARCHE : arrêtez le moteur et attendez l\'arrêt complet de l\'arbre avant de dégager la pièce';

/* jeu entre l'outil et les lamelles de chaque demi-guide, au plan du guide (mm) ; Infinity sans outil */
export function jeu(){ const t=tool(); if(!t) return Infinity; const R=Rmax(t), z=Math.min(st.zIn, st.zIn+st.e);
  const chord= z>=R? 0 : 2*Math.sqrt(R*R-z*z); return (st.open-chord)/2; }
/* contact de l'outil avec la bague de table (outil en partie sous la table) */
export const ringJeu=()=>{ const t=tool(); return t? (st.ring/2-Rmax(t)) : Infinity; };
export const ringContact=()=>tool() && st.h<0 && ringJeu()<RING_JEU;
export const contacts=()=>{ const out=[]; if(jeu()<JEU_MIN||lamStatus().contact) out.push('les lamelles du guide'); if(ringContact()) out.push('la bague de table'); if(entrGuide()) out.push('l\'entraîneur (contre le guide)'); return out; };
/* entraîneur posé avant un recul du guide : son bloc touche les cassettes ou le capot */
export const entrGuide=()=>st.entr.placed && st.entr.z < entrZ(st.entr.angle)-ENT_CLR-1e-6;

/* raison de refuser l'engagement de la pièce (blocages, pas des fautes) */
export function passBlock(q, spin){ const t=tool();
  if(!st.motor) return 'Moteur arrêté : démarrez l\'arbre (inverseur sur ↺, bouton I) avant d\'engager la pièce.';
  if(spin<0.9) return 'Attendez que l\'arbre ait pris sa vitesse avant d\'engager la pièce.';
  if(!t) return 'Aucun outil sur l\'arbre.';
  if(st.entr.placed){ const H=haut(q), c=entrPress(H);
    if(c<ENT_PRESS[0]) return `L'entraîneur ne presse pas la pièce (rouleaux ${fmt(-c)} mm au-dessus) : il a été placé pour une pièce de ${fmt(st.entr.H,0)} mm. « Placer sur la pièce » (arbre arrêté).`;
    if(c>ENT_PRESS[1]) return `La pièce ne passe pas sous l'entraîneur (${fmt(c)} mm d'écrasement des ressorts) : il a été placé pour une pièce de ${fmt(st.entr.H,0)} mm. « Placer sur la pièce » (arbre arrêté).`;
    if(!st.entr.on) return 'Entraîneur arrêté : mettez-le en marche (après l\'arbre) ; c\'est lui qui pousse la pièce.';
    return ''; }
  if(st.prot){ const H=haut(q), A=appui(q);
    if(st.hv<H-PRESS_DOWN) return `La pièce ne passe pas sous le presseur vertical (${fmt(st.hv,0)} mm pour ${fmt(H,0)} mm de haut) : réglez-le 0,5 à ${PRESS_DOWN} mm sous la hauteur de la pièce.`;
    if(st.dh<A-PRESS_DOWN) return `La pièce ne passe pas entre le guide et le presseur horizontal (${fmt(st.dh,0)} mm pour ${fmt(A,0)} mm) : réglez-le 0,5 à ${PRESS_DOWN} mm sous la largeur de la pièce.`; }
  return ''; }

let cache={k:'',R:null};
export function prediction(q){ const k=JSON.stringify([q.id,q.k,q.flip,q.cuts?.length,q.log?.length,st.tool,st.flip,st.h,st.zIn,st.e,st.open,st.dir]); if(cache.k!==k) cache={k,R:predict(q)}; return cache.R; }

/* alerte : [niveau, texte, panneau] ; le panneau (engine/families.js, data-key des sections) l'affiche aussi dans sa famille */
export function computeAlerts(){ const out=[], t=tool(), q=entryPiece();
  /* machine */
  if(st.au) out.push(['warn','Arrêt d\'urgence enfoncé : la machine ne peut pas démarrer. Réarmez-le (tourner le coup de poing) quand tout est en ordre.','machine']);
  if(st.cad) out.push(['info','Machine consignée (interrupteur général sur 0, cadenassé) : montage et réglage de l\'outil possibles. Déconsignez avant de démarrer.','machine']);
  else if(!st.main) out.push(['info','Interrupteur général sur 0 : la machine est hors tension.','machine']);
  if(st.lock) out.push(['warn','Arbre verrouillé en rotation : déverrouillez-le avant de démarrer (le moteur ne démarre pas arbre verrouillé).','outil']);
  if(st.motor) out.push(['info','Arbre en rotation : aucun réglage de l\'outil, du guide ni des presseurs (faute grave). Restez hors de la ligne de rejet.','machine']);
  if(!t) out.push(['info','Aucun outil sur l\'arbre : consignez la machine, verrouillez l\'arbre, montez un outil de la bibliothèque.','outil']);
  else {
    const sp=speedCheck(t,st.rpm), adv=advisedRpm(t,RPMS);
    if(sp.over) out.push(['danger',`VITESSE TROP ÉLEVÉE POUR L'OUTIL : ${st.rpm.toLocaleString('fr-FR')} tr/min pour un outil marqué n max ${t.nmax.toLocaleString('fr-FR')} (Ø ${Dmm(t)}). Risque d'éclatement de l'outil : ${adv.toLocaleString('fr-FR')} tr/min au plus.`,'outil']);
    else if(sp.low) out.push(['warn',`Vitesse de coupe faible : ${fmt(sp.v,0)} m/s (${VC_MIN} à ${VC_MAX} m/s). Mauvais état de surface, risque de rejet : ${adv.toLocaleString('fr-FR')} tr/min conseillés.`,'outil']);
    else if(sp.high) out.push(['warn',`Vitesse de coupe élevée : ${fmt(sp.v,0)} m/s (${VC_MIN} à ${VC_MAX} m/s) : ${adv.toLocaleString('fr-FR')} tr/min conseillés.`,'outil']);
    if(st.dir!==0 && !edgesOk()) out.push(['danger', st.flip&&st.dir===1? 'OUTIL MONTÉ À L\'ENVERS : retourné, ses tranchants tournent dans le mauvais sens. Il ne coupe pas, frotte, chauffe et rejette la pièce. Consignez et remontez-le, flèche ↺ dessus.'
      : 'ROTATION INVERSÉE NON ADAPTÉE À L\'OUTIL : avec l\'inverseur sur ↻, les tranchants de l\'outil tournent à l\'envers. Remettez l\'inverseur sur ↺ (arbre arrêté).','outil']);
    if(st.dir===-1) out.push(['danger','TRAVAIL EN AVALANT : rotation horaire, la pièce avancerait dans le sens de rotation de l\'outil. Elle serait arrachée des mains et projetée, les mains entraînées vers l\'outil. Jamais d\'avance manuelle en avalant : inverseur sur ↺ (anti-horaire).','outil']);
    if(st.dir===0) out.push(['info','Inverseur sur 0 : mettez-le sur ↺ (anti-horaire) pour une avance de droite à gauche, arbre arrêté.','outil']);
    const j=jeu(), L=lamStatus();
    if(!L.set) out.push(['danger','LUMIÈRE DU GUIDE OUVERTE : les lamelles ne sont pas fermées autour de l\'outil. Le bout de la pièce peut plonger dans l\'ouverture et être happé. « Fermer les lamelles » (arbre arrêté).','guidage']);
    else if(L.contact) out.push(['danger','LAMELLES CONTRE L\'OUTIL : l\'outil, sa hauteur ou la saillie ont changé depuis la fermeture des lamelles. Arbre arrêté, « Fermer les lamelles » à nouveau.','guidage']);
    else if(j<JEU_MIN) out.push(['danger',`OUTIL CONTRE LES LAMELLES DU GUIDE : ouverture de ${fmt(st.open,0)} mm, il faut au moins ${fmt(st.open-2*j+2*JEU_MIN,0)} mm. Écartez les lamelles (arbre arrêté).`,'guidage']);
    else if(L.loose && j<=JEU_MAX) out.push(['warn','Lumière du guide plus fermée au maximum : des lamelles pourraient passer au-dessus ou au-dessous de l\'outil. « Fermer les lamelles » à nouveau.','guidage']);
    else if(j>JEU_MAX) out.push(['danger',`OUVERTURE DES DEMI-GUIDES TROP GRANDE : ${fmt(j,0)} mm de jeu de chaque côté de l'outil (${JEU_OK} mm au plus). Le bout de la pièce peut plonger dans l'ouverture et être happé : rapprochez les lamelles.`,'guidage']);
    else if(j>JEU_OK) out.push(['warn',`Ouverture des lamelles à réduire : ${fmt(j,0)} mm de jeu de chaque côté de l'outil (1 à ${JEU_OK} mm).`,'guidage']);
    if(ringContact()) out.push(['danger',`OUTIL CONTRE LA BAGUE DE TABLE : outil Ø ${Dmm(t)} sous la table dans une bague de Ø ${st.ring}. Montez une bague plus grande (arbre arrêté).`,'protection']);
    else if(ringJeu()>RING_WIDE) out.push(['warn',`Lumière de table trop grande : ${fmt(ringJeu(),0)} mm entre l'outil et la bague de chaque côté. Réduisez-la (bague plus petite, ${RING_WIDE} mm au plus).`,'protection']);
    if(!st.hlock) out.push(['warn','Hauteur de l\'arbre non bloquée : bloquez-la avant d\'usiner.','outil']);
  }
  /* pièce à l'entrée */
  if(q && !cut.inProgress){ const A=appui(q), H=haut(q);
    if(q.L<MIN_LEN) out.push(['danger',`PIÈCE TROP COURTE POUR LE TRAVAIL AU GUIDE : ${q.L} mm, moins de ${MIN_LEN} mm. Elle ne porte pas sur les deux demi-guides et les mains arrivent près de l'outil : usinez-la dans un serre-pièces (type Duluc) ou un montage d'usinage, ou usinez une pièce plus longue et recoupez-la ensuite. Ici : interdite au guide.`,'piece']);
    if(A<MIN_BASE) out.push(['danger',`PIÈCE TROP ÉTROITE : ${fmt(A,0)} mm d'appui sur la table (${MIN_BASE} mm au moins). Mal tenue par les presseurs, les doigts passent près de l'outil : montage d'usinage, ou pièce plus large recoupée ensuite.`,'piece']);
    else if(H>RATIO*A) out.push(['danger',`PIÈCE INSTABLE : ${fmt(H,0)} mm de haut pour ${fmt(A,0)} mm d'appui (plus de ${RATIO} fois). Elle bascule contre le guide : posez-la sur une autre face.`,'piece']);
    if(t && edgesOk()){ const R=prediction(q);
      if(R.any){
        if(R.depth>PASS_MAX+1e-6) out.push(['danger',`PASSE TROP FORTE : ${fmt(R.depth)} mm de profondeur en une passe (${PASS_MAX} mm au plus en avance manuelle). Risque de rejet et d'éclats : usinez en plusieurs passes (saillie réduite, puis augmentée).`,'guidage']);
        if(R.bute) out.push(['danger',`DEMI-GUIDE DE SORTIE MAL RÉGLÉ : avancé de ${fmt(st.e)} mm alors que la face usinée recule de ${fmt(R.eNeed)} mm. Le bout de la pièce va buter contre lui (rejet). ${R.eNeed<E_TOL?'Toute la rive n\'est pas usinée : demi-guides alignés (0 mm).':'Avancez-le de la profondeur de passe.'}`,'guidage']);
        else if(R.snipe>E_SNIPE) out.push(['danger',`DEMI-GUIDE DE SORTIE MAL RÉGLÉ : toute la rive est usinée (${fmt(R.eNeed)} mm), le demi-guide de sortie n'est avancé que de ${fmt(st.e)} mm. Après l'outil la rive n'est pas soutenue : en fin de passe la pièce pivote vers l'outil (entaille, rejet). Avancez-le de ${fmt(R.eNeed)} mm.`,'guidage']);
        else if(R.snipe>0) out.push(['warn',`Demi-guide de sortie un peu en retrait (${fmt(st.e)} mm pour ${fmt(R.eNeed)} mm) : entaille en fin de passe.`,'guidage']); }
      else out.push(['info','L\'outil ne touchera pas la pièce avec ces réglages (saillie ou hauteur).','guidage']); }
    if(st.entr.placed){ const c=entrPress(H);
      if(c<ENT_PRESS[0]||c>ENT_PRESS[1]) out.push(['warn',`Entraîneur réglé pour une pièce de ${fmt(st.entr.H,0)} mm, celle-ci fait ${fmt(H,0)} mm : replacez-le sur la pièce (rouleaux ${ENT_DOWN} mm sous le dessus).`,'avance']);
      else if(entrGuide()) out.push(['danger','ENTRAÎNEUR CONTRE LE GUIDE : le guide a été déplacé après la mise en place de l\'entraîneur. Arbre arrêté, « Placer sur la pièce » à nouveau.','avance']);
      else if(Math.min(...rollCover(appui(q)))<10) out.push(['warn',`Pièce étroite pour l'entraîneur : un rouleau ne la presse que sur ${fmt(Math.min(...rollCover(appui(q))),0)} mm (le bloc reste à ${ENT_CLR} mm du guide). Usinez une pièce plus large recoupée ensuite, ou travaillez au protège-mains.`,'avance']);
      else out.push(['info',`Entraîneur sur la pièce : rouleaux ${fmt(c)} mm sous le dessus (ressorts), bloc à ${st.entr.angle}° vers le guide, ${st.entr.v} m/min. Mains hors de la zone des rouleaux et de l'outil.`,'avance']); }
    else if(!st.prot) out.push(['danger','PROTECTEUR ESCAMOTÉ : les presseurs ne tiennent pas la pièce et ne couvrent pas l\'outil. Mettez le protège-mains à presseurs en place et réglez-le sur la pièce.','protection']);
    else {
      if(st.hv>H+1e-6) out.push(['danger',`PRESSEUR VERTICAL TROP HAUT : ${fmt(st.hv,0)} mm pour une pièce de ${fmt(H,0)} mm. Il ne plaque pas la pièce sur la table et laisse passer les doigts : réglez-le 0,5 à ${PRESS_DOWN} mm sous la hauteur de la pièce.`,'protection']);
      if(st.dh>A+1e-6) out.push(['danger',`PRESSEUR HORIZONTAL TROP LOIN : ${fmt(st.dh,0)} mm du guide pour une pièce de ${fmt(A,0)} mm. Il ne plaque pas la pièce contre le guide : réglez-le 0,5 à ${PRESS_DOWN} mm sous la largeur de la pièce.`,'protection']); }
    if(!st.push && !st.entr.placed) out.push(['danger','MAINS PRÈS DE L\'OUTIL EN FIN DE PASSE : prenez le poussoir pour pousser la fin de la pièce (mains à droite de l\'outil, jamais au-dessus).','piece']);
  }
  if(butePiece()) out.push(['warn','Pièce arrêtée contre le demi-guide de sortie : arrêtez le moteur, attendez l\'arrêt de l\'arbre, puis « Dégager la pièce ».','piece']);
  if(!st.asp) out.push(['warn','Aspiration arrêtée : mettez-la en marche avant d\'usiner (copeaux projetés, poussières de bois cancérogènes).','machine']);
  if(cut.inProgress) out.push(['info','Passe en cours : poussez régulièrement, mains à droite de l\'outil, sans revenir en arrière. Fin de passe au poussoir.']);
  return out; }

/* informations des réglages (pour l'affichage) */
export function guideInfo(){ const t=tool(); if(!t) return 'Aucun outil monté.'; const q=entryPiece(), p=saillie(), j=jeu();
  const L=lamStatus();
  let s=`Saillie ${fmt(p)} mm · ` + (!L.set? 'lamelles ouvertes : lumière du guide ouverte' : L.contact? 'lamelles à refermer : elles touchent l\'outil' : `lamelles fermées : ${L.n} / ${st.lam.length} passées autour de l'outil, demi-guides à ${isFinite(j)?fmt(j,0):'—'} mm de l'outil${L.loose?' (à refermer : lumière plus fermée au maximum)':''}`);
  if(q && edgesOk()){ const R=prediction(q); if(R.any) s+= R.eNeed>E_TOL? ` · toute la rive est usinée : sortie à avancer de ${fmt(R.eNeed)} mm` : ' · rive en partie usinée : demi-guides alignés'; }
  return s; }
