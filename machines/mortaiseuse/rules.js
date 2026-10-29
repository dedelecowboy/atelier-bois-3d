/* Règles de la mortaiseuse : alertes de sécurité et de qualité, blocages.
   Une alerte « danger » active au moment où le cycle démarre (bédane lancé en automatique, ou plongée en manuel) est une faute
   grave (parcours évalué). Gestes dangereux hors cycle (app.recordDangers(liste), geste refusé) : intervenir sur le bédane sans
   consignation ; toucher la pièce (poser, retourner, desserrer, reprendre) bédane en marche ou pendant le cycle.
   Sources : cours « La mortaiseuse à bédane horizontal » et fiches de l'atelier (sécurité, mise en marche, procédure,
   profondeur, distance, arasement), catalogue constructeur ; INRS ED 6122, ED 6109 ; Code du travail R4324-1, R4324-2
   (voir data/sources.txt). */
import { REF0, PROF_MAX, MIN_LEN, MIN_H, JOUE_MIN, VER_MARGE, PAD_R, XBG, XBD, RULE_T } from './constants.js';
import { st, tool, ctx, taquets } from './state.js';
import * as C from '../../engine/corroyage.js';
import { cyc, onTable, H, D, fmt, sr1, sr2, span, plannedS0, curS0, depth, atLoad, tableX, XR } from './piece.js';

/* gestes hors cycle (faute grave, geste refusé) */
export const INTERV = 'INTERVENTION SUR LE BÉDANE SANS CONSIGNATION : interrupteur général sur 0, cadenas posé, essai de démarrage, puis seulement ouvrir le capot et desserrer, démonter, monter ou serrer le bédane';
export const MAINS = 'MAINS DANS LA ZONE DE L\'OUTIL, BÉDANE EN MARCHE : attendez la fin du cycle et l\'arrêt complet du bédane, desserrez les vérins (bouton noir), puis seulement touchez la pièce';

export const moving=()=>!!ctx.model && ctx.model.amp>0.02;      // le bédane oscille encore (frein)
export const running=()=>!!ctx.model && ctx.model.amp>0.9;

const VNAME={ v1:'vertical 1', v2:'vertical 2', h1:'horizontal 1', h2:'horizontal 2' };
/* courses du bédane à contrôler : celles du cycle (automatique) ou la position actuelle (manuel) */
export const sweeps=q=> st.auto? plannedS0(q) : [curS0()];
/* patins hors de la pièce, et patins devant la course du bédane */
export function clampCheck(q){ const [x0,x1]=span(q), off=[], front=[];
  for(const k of ['v1','v2','h1','h2']){ const x=st.ver[k]; if(x<x0+PAD_R-1e-6||x>x1-PAD_R+1e-6) off.push(k);
    for(const s0 of sweeps(q)) if(x>s0-VER_MARGE && x<s0+st.osc+VER_MARGE && !front.includes(k)) front.push(k); }
  return { off, front }; }
/* butée abaissée que la pièce heurterait pendant les déplacements de la table (chargement : X = 0) */
export function buteeHit(q){ if(!q) return null; const [x0,x1]=span(q), Xs=[0,...sweeps(q).map(tableX)], lo=Math.min(...Xs)*1000, hi=Math.max(...Xs)*1000;
  const bg=0, bd=XR;   // butées dans le repère de la table, table en position de chargement
  if(st.butG && x0+lo<bg-0.5 && x1+hi>bg+0.5) return 'gauche';
  if(st.butD && x0+lo<bd-0.5 && x1+hi>bd+0.5) return 'droite';
  return null; }

/* raison de refuser le démarrage du cycle ou la plongée (blocages, pas des fautes) */
export function cycleBlock(q, manual){
  if(!st.main||st.cad) return 'Machine hors tension ou consignée : retirez le cadenas, interrupteur général sur I, puis bouton vert.';
  if(st.au) return 'Arrêt d\'urgence enfoncé : tournez-le pour le déverrouiller, puis bouton vert.';
  if(!st.on) return 'Machine pas en route : appuyez sur le bouton vert (mise en route de la machine).';
  if(st.capot) return 'Capot de protection ouvert : le bédane ne démarre pas (interverrouillage). Refermez le capot.';
  if(!tool()) return 'Aucun bédane dans le porte-outil.';
  if(manual){ if(!running()) return 'Mode manuel : lancez d\'abord le bédane (sélecteur du bédane sur 1) et attendez qu\'il oscille à pleine vitesse.'; }
  else { if(!atLoad()) return 'La table n\'est pas au taquet 1 (position de chargement) : ramenez-la avant de lancer le cycle.';
    if(!plannedS0(q).length) return 'Aucune plongée prévue : il faut le taquet 1 (origine) et au moins un deuxième taquet sur la règle de la table.'; }
  const b=buteeHit(q); if(b) return `Butée ${b} abaissée sur le passage de la pièce : la table la ferait heurter. Relevez la butée ${b} (on n'abaisse que celle qui sert au chargement).`;
  return ''; }

export function computeAlerts(){ const out=[], q=onTable(), t=tool();
  /* machine */
  if(st.au) out.push(['warn','Arrêt d\'urgence enfoncé : tout est arrêté. Tournez le coup de poing pour le déverrouiller, puis remettez en route (bouton vert).','machine']);
  if(st.cad) out.push(['info', st.essai? 'Machine consignée (interrupteur général sur 0, cadenassé), essai de démarrage fait : vous pouvez intervenir sur le bédane.' : 'Machine consignée (interrupteur général sur 0, cadenassé). Faites un essai de démarrage (bouton vert) : rien ne doit démarrer.','machine']);
  else if(!st.main) out.push(['info','Interrupteur général sur 0 : la machine est hors tension.','machine']);
  else if(!st.on && !st.au) out.push(['info','Machine sous tension, pas en route : bouton vert (groupe hydraulique) avant de serrer les vérins et de lancer le bédane.','machine']);
  if(st.capot) out.push(['info','Capot de protection ouvert : réglage de l\'arasement (clé de 27) et changement du bédane possibles. Le bédane ne démarre pas capot ouvert.','machine']);
  if(!st.asp) out.push(['warn','Aspiration arrêtée : mettez-la en marche avant d\'usiner (copeaux et poussières de bois cancérogènes).','machine']);
  /* outil */
  if(!t) out.push(['info','Aucun bédane monté : choisissez-en un au râtelier (machine consignée, capot ouvert).','outil']);
  else { if(!st.tight) out.push(['danger','BÉDANE MAL SERRÉ : serrez la vis du porte-bédane (machine consignée, capot ouvert). Un outil mal serré se desserre en oscillant, il casse ou est projeté.','outil']);
    if(t.etat==='ebreche') out.push(['danger',`BÉDANE ÉBRÉCHÉ (${t.n}) : dents de coupe cassées. Il force, chauffe, arrache le bois et peut casser : ne l'utilisez pas, prévenez le professeur et montez un bédane en bon état.`,'outil']); }
  /* réglages de la mortaise */
  if(st.dep>=REF0-1e-6) out.push(['warn',`Taquet de départ à ${fmt(st.dep,0)} mm, après 71 (référence 0) : le bédane part déjà dans le bois, sans prendre sa vitesse. Placez le taquet de départ AVANT 71.`,'cotes']);
  if(!st.deb){ if(st.arr<=REF0+1e-6) out.push(['info','Taquet d\'arrêt à 71 ou moins : profondeur nulle, le bédane ne rentre pas dans la pièce. Profondeur + 71 = taquet d\'arrêt.','cotes']);
    else if(st.arr-REF0>PROF_MAX+1e-6) out.push(['warn',`Profondeur de ${fmt(st.arr-REF0,0)} mm : ${PROF_MAX} mm au plus sur cette machine.`,'cotes']);
    if(st.arr<=st.dep) out.push(['info','Taquet d\'arrêt avant le taquet de départ : la tête ne peut pas avancer.','cotes']); }
  else out.push(['info','Sélecteur sur « mortaise débouchante » : le taquet d\'arrêt est ignoré, le bédane va au bout de sa course, il traverse la pièce.','cotes']);
  /* table, taquets, butées */
  const T=taquets();
  if(T.length && Math.abs(T[0].v)>0.05) out.push(['warn',`Taquet 1 à ${fmt(T[0].v)} mm au lieu de 0 : la table part de ce taquet, toutes les distances de mortaise sont décalées de ${fmt(T[0].v)} mm. Placez le 1er taquet sur 0.`,'guidage']);
  if(T.length<2) out.push(['info','Un seul taquet sur la règle de la table : il faut le taquet 1 sur 0 (origine) et un taquet à la distance de la mortaise.','guidage']);
  if(!st.butG&&!st.butD) out.push(['info','Aucune butée abaissée : abaissez la butée gauche (ou droite) pour poser la pièce à la bonne distance.','guidage']);
  /* pièce sur la table */
  if(q){ const Hp=H(q), Dp=D(q), fc=C.faces(q);
    if(q.L<MIN_LEN) out.push(['danger',`PIÈCE TROP COURTE : ${fmt(q.L,0)} mm, moins de ${MIN_LEN} mm. Les quatre vérins ne la tiennent pas loin du bédane : elle peut être arrachée et rejetée. Mortaisez une pièce plus longue, recoupée ensuite. Ici : pas à la mortaiseuse.`,'piece']);
    if(Hp<MIN_H) out.push(['danger',`PIÈCE TROP MINCE : ${fmt(Hp,0)} mm (${MIN_H} mm au moins) : elle fend sous les vérins et le bédane.`,'piece']);
    const s1=sr1(q), s2=sr2(q);
    if(s1 && fc.down!==s1) out.push(['warn','Face de référence : SR1 (la boucle) sur la table. L\'arasement se règle depuis la table : la mortaise sera décalée par rapport au parement.','piece']);
    else if(s2 && fc.back!==s2) out.push(['warn','Chant à mortaiser : SR2 (le V) contre le guide, le chant de référence.','piece']);
    if(t && st.ar<Hp-0.01){ const top=Hp-st.ar-t.E;
      if(st.ar+t.E>Hp+0.01) out.push(['warn',`Le bédane dépasse au-dessus de la pièce (arasement ${fmt(st.ar)} + bédane ${t.E} mm > ${fmt(Hp)} mm) : la mortaise s'ouvre sur le dessus.`,'cotes']);
      else if(st.ar<JOUE_MIN||top<JOUE_MIN) out.push(['warn',`Joue de ${fmt(Math.min(st.ar,top))} mm seulement (${JOUE_MIN} mm au moins) : elle va casser. Vérifiez l'arasement et l'épaisseur du bédane.`,'cotes']); }
    else if(t) out.push(['info','Arasement au-dessus de la pièce : le bédane passera au-dessus, sans la toucher.','cotes']);
    if(!st.deb && depth()>=Dp-2) out.push(['danger',`LE BÉDANE VA TRAVERSER LA PIÈCE : profondeur ${fmt(depth(),0)} mm pour une pièce de ${fmt(Dp,0)} mm. Il sort côté opérateur, sur les vérins horizontaux, et casse. Réduisez la profondeur (taquet d'arrêt).`,'cotes']);
    if(!st.press) out.push(['danger','PIÈCE NON SERRÉE : mettez les vérins en pression (les deux boutons blancs, à deux mains). Non serrée, la pièce est arrachée et rejetée par le bédane.','protection']);
    const K=clampCheck(q);
    if(K.off.length) out.push(['danger',`VÉRIN HORS DE LA PIÈCE (${K.off.map(k=>VNAME[k]).join(', ')}) : les 4 vérins doivent appuyer sur la pièce, sinon elle pivote et est rejetée. Déplacez-les sur la pièce.`,'protection']);
    if(K.front.length) out.push(['danger',`VÉRIN DEVANT LE BÉDANE (${K.front.map(k=>VNAME[k]).join(', ')}) : un patin est au droit de la course du bédane (${VER_MARGE} mm de marge). Le bédane et sa tête le heurtent, cassent et projettent des morceaux : écartez ce vérin de la mortaise.`,'protection']);
    const sw=sweeps(q), [x0,x1]=span(q); if(sw.some(s0=>s0+st.osc<=x0+0.05||s0>=x1-0.05)) out.push(['info','Une plongée tombe en dehors de la pièce : vérifiez les taquets de la table et la butée utilisée.','guidage']);
    const b=buteeHit(q); if(b) out.push(['warn',`Butée ${b} abaissée sur le passage de la pièce : relevez-la, elle gênerait le déplacement de la table.`,'guidage']); }
  if(cyc.on) out.push(['info', cyc.manual? 'Plongée en cours : mains sur le pupitre, loin de la table.' : 'Cycle automatique en cours : plongées et va-et-vient de la table. Mains loin de la table et des vérins.','machine']);
  else if(moving() && !st.bed) out.push(['info','Le bédane ralentit (frein) : attendez son arrêt complet.','machine']);
  return out; }
