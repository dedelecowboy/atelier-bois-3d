/* Règles de la tenonneuse : alertes de sécurité et de qualité, blocages.
   Une alerte « danger » active au moment où l'on pousse le chariot est une faute grave (parcours évalué).
   Gestes dangereux hors passe (relevés par app.recordDangers(liste), geste refusé) : charger, retourner ou desserrer la pièce
   chariot avancé ; mettre la main sous le capot (chute coincée) lame en rotation.
   Sources : cours « La tenonneuse » du lycée (organes, procédure de réglage, travail en sécurité), fiche « Tenonneuse : les
   points clés pour travailler en sécurité », photos de la tenonneuse de l'atelier. */
import { HEADS, HEAD_NAME, MIN_LEN, MIN_W, MIN_H, RATIO, JOUE_MAX, PROT_JEU, AV_WARN, AV_MAX, CHUTE_MIN, VC_MIN, VC_MAX, N_HEAD } from './constants.js';
import { st, tool, ctx } from './state.js';
import { speedCheck, edgesOk } from './tools.js';
import * as C from '../../engine/corroyage.js';
import { cut, chariotPiece, atHome, predict, H, D, fmt, butGap, sr1, sr2, endName, farName, overhang, peKey } from './piece.js';

/* gestes hors passe (faute grave, geste refusé) */
export const CHARGE = 'CHARIOT AVANCÉ PENDANT LE CHARGEMENT : la pièce se pose, se retourne et se desserre seulement chariot ramené et verrouillé en position de chargement, loin des outils';
export const INTERV = 'INTERVENTION SOUS LE CAPOT, OUTIL EN ROTATION : arrêtez la machine, attendez l\'arrêt complet des outils (frein), ouvrez le capot (sélecteur, temporisation), puis intervenez';

const hard=q=>q && q.wood!=='sapin';
export const spinning=()=>!!ctx.model && HEADS.some(h=>ctx.model.spin[h]>0.02);
export const heads=()=>HEADS.filter(h=>tool(h));

/* raison de refuser la poussée du chariot (blocages, pas des fautes) */
export function passBlock(q){
  if(!atHome()) return 'Ramenez d\'abord le chariot en position de chargement.';
  if(st.lockC) return 'Chariot verrouillé en position de chargement : déverrouillez-le pour le pousser.';
  if(st.wedge) return 'Une chute fine est coincée près de la lame : arrêtez la scie, attendez l\'arrêt des outils, ouvrez le capot et retirez-la.';
  if(st.ang>0.05) return 'Guide orienté : les tenons biais ne sont pas simulés. Remettez le guide d\'équerre (butée à 90°).';
  if(st.capot||st.sel) return 'Capot ouvert ou sélecteur « Ouverture capot » sur 1 : la machine ne tourne pas.';
  if(q && st.protH < H(q)-0.01) return `La pièce ne passe pas sous le protecteur avant (${fmt(st.protH,0)} mm pour ${fmt(H(q),0)} mm de haut) : relevez-le, juste au-dessus de la pièce.`;
  const R=predict(q,false), slow=R.touch.filter(h=>!(st.run[h] && ctx.model.spin[h]>0.9));
  if(slow.length) return `${slow.map(h=>HEAD_NAME[h]).join(', ')} : ${st.run[slow[0]]?'attendez que l\'outil ait pris sa vitesse':'outil à l\'arrêt, il toucherait la pièce'}. Mettez-le en marche (ou réglez-le hors de la pièce) avant de pousser le chariot.`;
  if(!q && !HEADS.some(h=>st.run[h])) return 'Aucun outil en marche.';
  return ''; }

let cache={k:'',R:null};
export function prediction(q){ const k=JSON.stringify([q.id,q.k,q.flip,q.L,q.zEnd,q.ends,st.lt,st.hInf,st.ep,st.dec,st.ht,st.pt,st.tools,st.flips,st.pe]); if(cache.k!==k) cache={k,R:predict(q,false)}; return cache.R; }

export function computeAlerts(){ const out=[], q=chariotPiece();
  /* machine */
  if(st.au) out.push(['warn','Arrêt d\'urgence enfoncé : la machine ne peut pas démarrer. Déverrouillez le coup de poing, puis réarmez (bouton bleu).']);
  if(st.filin) out.push(['warn','Filin de sécurité tiré : le boîtier sectionneur a coupé la machine. Tirez le bouton bleu du boîtier, puis réarmez au pupitre.']);
  if(st.cad) out.push(['info','Machine consignée (interrupteur général sur 0, cadenassé) : montage des outils et des carters possible. Déconsignez avant de démarrer.']);
  else if(!st.main) out.push(['info','Interrupteur général sur 0 : la machine est hors tension.']);
  else if(!st.armed && !st.au && !st.filin && !st.sel && !st.capot) out.push(['info','Machine sous tension, non réarmée : appuyez sur « Réarmement » (bouton bleu) avant de démarrer les outils.']);
  if(st.capot) out.push(['info','Capot de protection ouvert : réglages sous le capot et changement d\'outil possibles. Refermez-le, sélecteur sur 0, puis réarmez.']);
  else if(st.sel) out.push(['info', spinning()? 'Ouverture du capot demandée : temporisation, attendez l\'arrêt complet des outils (le voyant s\'allume).' : 'Capot déverrouillé (voyant allumé) : vous pouvez l\'ouvrir.']);
  if(!st.carters) out.push(['danger','CARTERS DES OUTILS DÉPOSÉS : remettez les carters de la scie, des dérouleurs et de l\'unité de toupillage (machine consignée, capot ouvert) avant de démarrer.']);
  for(const h of heads()){ const t=tool(h), sp=speedCheck(t,h);
    if(sp.over) out.push(['danger',`VITESSE TROP ÉLEVÉE POUR L'OUTIL (${HEAD_NAME[h]}) : l'arbre tourne à ${N_HEAD[h].toLocaleString('fr-FR')} tr/min, l'outil est marqué n max ${t.nmax.toLocaleString('fr-FR')} (Ø ${t.D}). Risque d'éclatement : montez un outil prévu pour cette vitesse.`]);
    else if(sp.low||sp.high) out.push(['warn',`Vitesse de coupe ${sp.low?'faible':'élevée'} (${HEAD_NAME[h]}) : ${fmt(sp.v,0)} m/s (${VC_MIN} à ${VC_MAX} m/s conseillés).`]);
    if(!edgesOk(t,st.flips[h],h)) out.push(['danger', st.flips[h]? `OUTIL MONTÉ À L'ENVERS (${HEAD_NAME[h]}) : retourné, ses tranchants tournent dans le mauvais sens. Il frotte, chauffe et rejette la pièce. Consignez et remontez-le.`
      : `SENS DE ROTATION NON ADAPTÉ À L'OUTIL (${HEAD_NAME[h]}) : outil ${t.sens>0?'↺':'↻'} sur un arbre qui tourne ${h==='inf'?'↻':'↺'} (dérouleur prévu pour l'autre arbre). Il ne coupe pas et rejette la pièce : montez l'outil du bon sens.`]); }
  if(st.wedge) out.push(['warn','Chute fine coincée près de la lame : n\'y mettez jamais la main lame en rotation. Arrêtez, attendez l\'arrêt, ouvrez le capot, retirez la chute.']);
  if(st.ang>0.05) out.push(['info',`Guide orienté à ${fmt(st.ang,0)}° : tenons biais non simulés dans cette version. Remettez-le d'équerre (butée à 90°).`]);
  /* pièce sur le chariot */
  if(q && !cut.inProgress){ const Hp=H(q), A=D(q);
    if(!atHome()) out.push(['info','Chariot au bout de sa course : ramenez-le en position de chargement avant de toucher la pièce.']);
    else if(!st.lockC) out.push(['warn','Chariot non verrouillé en position de chargement : verrouillez-le pendant que vous posez, retournez ou desserrez la pièce.']);
    if(q.L<MIN_LEN) out.push(['danger',`PIÈCE TROP COURTE POUR LE CHARIOT : ${fmt(q.L,0)} mm, moins de ${MIN_LEN} mm. La presse la tient trop près des outils, les mains arrivent dans la zone des outils : usinez une pièce plus longue recoupée ensuite. Ici : pas à la tenonneuse.`]);
    if(A<MIN_W) out.push(['danger',`PIÈCE TROP ÉTROITE : ${fmt(A,0)} mm d'appui contre le guide (${MIN_W} mm au moins). Mal tenue par la presse, elle peut pivoter et être happée.`]);
    else if(Hp>RATIO*A) out.push(['danger',`PIÈCE INSTABLE : ${fmt(Hp,0)} mm de haut pour ${fmt(A,0)} mm d'appui (plus de ${RATIO} fois). Posez-la sur une autre face.`]);
    if(Hp<MIN_H) out.push(['danger',`PIÈCE TROP MINCE : ${fmt(Hp,0)} mm (${MIN_H} mm au moins) : la presse la fend, les joues l'arrachent.`]);
    if(!st.presse) out.push(['danger','PIÈCE NON SERRÉE : serrez le presse-pièce sur la pièce. Non serrée, elle est entraînée par les outils et rejetée.']);
    { const g=butGap(q); if(g!==null && g>0.3) out.push(['warn',`Pièce pas en butée : ${fmt(g)} mm entre la pièce et la butée de longueur. « Contre la butée » avant de serrer (longueur entre arasements fausse).`]); }
    if(st.protH>Hp+PROT_JEU+0.01) out.push(['danger',`PROTECTEUR AVANT TROP HAUT : ${fmt(st.protH,0)} mm pour une pièce de ${fmt(Hp,0)} mm. Réglez-le au plus près de la pièce (${PROT_JEU} mm au plus au-dessus), outils arrêtés.`]);
    if(st.mains==='piece') out.push(['danger','MAINS DANS LA ZONE DES OUTILS : la pièce est tenue par la presse ; poussez le chariot par sa poignée, les deux mains loin des bords usinés.']);
    if(st.av>AV_MAX) out.push(['danger',`AVANCE DU CHARIOT TROP RAPIDE : ${st.av} m/min (${AV_MAX} au plus). Les outils arrachent le bois, la pièce peut être rejetée : poussez régulièrement, sans forcer.`]);
    else if(st.av>=AV_WARN && hard(q)) out.push(['warn',`Avance de ${st.av} m/min en bois dur : éclats et surcharge des moteurs. 4 à 8 m/min conseillés.`]);
    const R=prediction(q);
    for(const h of ['inf','sup']) if(R.depth[h]>JOUE_MAX+1e-6) out.push(['danger',`PROFONDEUR DE PASSE TROP FORTE (${HEAD_NAME[h]}) : joue de ${fmt(R.depth[h])} mm en une passe (${JOUE_MAX} mm au plus). Risque de rejet et de surcharge : débitez plus près de la cote, ou deux passes.`]);
    if(R.chute>0 && R.chute<CHUTE_MIN) out.push(['warn',`Chute d'affranchissement très fine (${fmt(R.chute)} mm) : elle risque d'être projetée ou de se coincer. Affranchissez au moins ${CHUTE_MIN} mm.`]);
    if(!R.touch.includes('scie') && overhang(q)<-0.05) out.push(['info',`Le bout n'atteint pas le trait de scie (${fmt(-overhang(q))} mm en retrait) : il ne sera pas affranchi, tenon plus court.`]);
    if(R.inc.length) out.push(['warn','Tenon plus long que la longueur de coupe du dérouleur : la joue sera incomplète au bout.']);
    if(R.cuts.length && !st.pe.on) out.push(['warn','Pare-éclat absent : à la sortie des outils (côté guide), l\'arête de la pièce éclate. Remettez un pare-éclat.']);
    else if(R.cuts.length && st.pe.key!==null && st.pe.key!==peKey()) out.push(['warn','Pare-éclat usiné avec d\'autres réglages : il ne soutient plus la sortie des outils (éclats côté guide). Renouvelez-le et usinez-le (passe à vide).']);
    const s1=sr1(q), s2=sr2(q), fc=C.faces(q), first=!(q.ends&&q.ends[farName(q)]&&q.ends[farName(q)].cuts.length);
    if(C.isF(fc.down)){ if(s1 && fc.down!==s1 && (R.cuts.length||R.chute)) out.push(['warn','Face de référence : SR1 (la boucle) doit être sur la table du chariot pour régler le tenon depuis SR1. Sinon, défaut de qualité (tenon décalé).']); }
    else if(s2 && fc.down!==s2 && R.cuts.length) out.push(['warn','Pièce sur chant (épaulements) : SR2 (le V) sur la table du chariot, pour régler les épaulements depuis SR2.']);
    if(C.isF(fc.down) && fc.down===s1 && s2 && first && fc.back!==s2 && R.cuts.length) out.push(['warn','Premier bout : SR2 (le V) contre le guide. Au deuxième bout, SR1 reste sur la table (SR2 passe alors à l\'opposé du guide).']);
    if(!R.cuts.length && !R.chute && R.touch.length===0) out.push(['info','Aucun outil ne touchera la pièce avec ces réglages.']); }
  if(!st.asp) out.push(['warn','Aspiration arrêtée : mettez-la en marche avant d\'usiner (copeaux et poussières de bois cancérogènes).']);
  if(cut.inProgress) out.push(['info','Chariot en mouvement : poussez régulièrement par la poignée, sans forcer, mains loin des outils.']);
  return out; }
