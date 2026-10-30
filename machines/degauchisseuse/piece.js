/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Pièce sur la dégauchisseuse : forme (profils des 4 faces le long de la pièce), orientation, passes,
   arrachements selon le sens du fil, angle du chant dressé par rapport à la face contre le guide,
   repères au crayon.

   Repère local de la pièce : u le long (bout A en u = 0), v en largeur (chant C1 en v = 0, C2 en v = W),
   w en épaisseur (plat F1 en w = 0, F2 en w = T). Chaque face est décrite par N points le long de u :
   w1[i] (dessous de F1), w2[i] (dessus de F2), v1[i] (C1), v2[i] (C2), en mm.
   Orientation : k quarts de tour autour de l'axe long (en roulant vers le guide) et flip (bout pour bout).
   Une passe de profondeur d enlève la matière sous la face du dessous jusqu'à d au-dessus de ses points d'appui :
   une pièce cintrée se dresse en plusieurs passes. */
import * as THREE from 'three';
import * as C from '../../engine/corroyage.js';
import { TABLE_Y, LEAD0, KNIFE_X } from './constants.js';
import { st, guideZ, $ } from './state.js';

/* faces, orientation, fil, textures et maillage : logique commune à la raboteuse (engine/corroyage.js) */
const N = C.N;
export const RING = C.RING;
export const FACE_NAME = C.FACE_NAME;
const isF = C.isF;

let app=null, pieceRoot=null, partMeshes=null;
export function initPiece(a, model){ app=a; pieceRoot=model.pieceRoot; partMeshes=a.parts.partMeshes; }

/* ---------- état ---------- */
export let p=null;                 // pièce courante
export const cut={ started:false, done:false, blocked:'', inProgress:false, depth:0, lastT:0, lastMsg:'', msgSeq:0 };

/* Création. spec : {L,W,T (mm), wood:'hetre'|'chene'|'frene', bow (mm, cintrage sur le plat, creux côté F1),
   rough (mm), sT, sW (pente du fil dans l'épaisseur et dans la largeur), k, flip, seed}, ou une pièce transportée (pieceJSON) */
export function newPiece(spec){ clearPiece();
  p={ ...C.makePiece(spec), zOff:0.05, group:null, mesh:null };
  cut.started=false; cut.done=false; cut.inProgress=false; cut.lastT=0; st.t=0;
  return p; }
export function clearPiece(){ if(p&&p.group){ pieceRoot.remove(p.group); disposeGroup(p.group); } if(partMeshes) partMeshes.piece=[]; p=null; }
function disposeGroup(g){ g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }

/* ---------- géométrie : faces, planéité, dimensions ---------- */
/* écart de planéité d'une face (mm) */
export const flatness=(f, q=p)=>C.flatness(q,f);
export const isFlat=(f,q=p)=>C.isFlat(q,f);
export const thickness=()=>C.thickness(p);
export const width=()=>C.width(p);

/* ---------- orientation ---------- */
export const faces=(q=p)=>C.faces(q);
export const mode=()=>p&&isF(faces().down)?'plat':'chant';
/* face posée bombée (convexe) : la pièce repose au milieu et bascule */
export const rocking=()=>!!p&&C.rocking(p);
export const concaveDown=()=>!!p&&C.concaveDown(p);
/* sens du fil pour la face du dessous : +1 dans le sens du fil, −1 contre le fil, 0 fil droit.
   Bonne orientation : en partant de la face usinée, les fibres montent dans la pièce vers le bout qui entre en premier. */
export const grainSign=(q=p)=>C.grainSign(q,C.faces(q).down);

/* ---------- position dans la scène ---------- */
const box=new THREE.Box3();
export function pieceBox(){ if(!p||!p.group) return null; p.group.updateMatrixWorld(true); return box.setFromObject(p.mesh); }
/* encombrements réels (mm) : hauteur posée sur la table, profondeur depuis la face côté guide */
export const heightMm=()=>!p?0: C.heightMm(p);
export const depthMm=()=>!p?0: C.depthMm(p);
export const backZ=()=>guideZ()+(p?p.zOff:0);
export const frontZ=()=>backZ()+depthMm()/1000;
export const againstGuide=()=>!!p && p.zOff<0.0008;
export const leadX=()=>LEAD0 - st.t/1000;
export const travelMax=()=>p?Math.round((LEAD0+p.L/1000+KNIFE_X)*1000)+40:2000;
export function place(){ if(!p||!p.group) return;
  const inner=p.group.children[0]; inner.rotation.set(-p.k*Math.PI/2,0,0); p.group.rotation.set(0,p.flip?Math.PI:0,0);
  p.group.position.set(0,0,0); p.group.updateMatrixWorld(true); const b=box.setFromObject(p.mesh);
  p.group.position.set(leadX()-b.min.x, TABLE_Y-b.min.y, guideZ()+p.zOff-b.min.z); }

/* ---------- maillage ---------- */
export function build(){ if(!p) return; if(p.group){ pieceRoot.remove(p.group); disposeGroup(p.group); }
  const mesh=C.pieceMesh(p);
  const inner=new THREE.Group(); inner.add(mesh); const g=new THREE.Group(); g.add(inner);
  pieceRoot.add(g); p.group=g; p.mesh=mesh; partMeshes.piece=[mesh]; place(); app.stage.dirty(); }

/* ---------- passe ---------- */
export function stopPass(){ st.pass=false; $('pass')?.setAttribute('aria-pressed','false'); }
/* La pièce avance de st.t (mm). Bloquée si le moteur est arrêté ou si le protecteur est sur son passage.
   Elle ne recule jamais sur l'arbre : après la passe, on la ramène en la soulevant (op 'back'). */
export function updateFeed(passBlock){
  cut.blocked='';
  if(!p) return;
  if(st.t < cut.lastT-1e-6){
    if(cut.inProgress){ st.t=cut.lastT; cut.blocked='Ne reculez jamais la pièce sur l\'arbre : terminez la passe.'; stopPass(); }
    else if(cut.done){ st.t=cut.lastT; cut.blocked='Ne tirez pas la pièce en arrière sur l\'arbre : ramenez-la en la soulevant (« Ramener la pièce »).'; stopPass(); }
  }
  const tStart=(LEAD0-KNIFE_X)*1000, tEnd=travelMax()-40;
  if(!cut.started && !cut.done && st.t>tStart){
    const why=passBlock();
    if(why){ st.t=tStart; cut.blocked=why; stopPass(); }
    else { cut.started=true; cut.depth=st.d; app.recordDangers(); }
  }
  if(cut.started && st.t>=tEnd){ applyCut(cut.depth); cut.started=false; cut.done=true; }
  if(cut.done && st.t>tEnd) st.t=Math.min(st.t,travelMax());
  cut.inProgress=cut.started;
  cut.lastT=st.t;
  place();
}
function applyCut(d){ const f=faces().down, fs=p.face[f]; cut.lastMsg='';
  if(d<=0){ cut.lastMsg='Profondeur de passe nulle : aucun copeau enlevé.'; cut.msgSeq++; return; }
  C.dresse(p,f,d);
  fs.passes++; C.clearMark(p,f);
  const gs=grainSign();
  if(gs<0){ fs.tear=true; cut.lastMsg=`Arrachements sur le ${FACE_NAME[f].toLowerCase()} : la pièce est passée contre le fil. Pivotez-la bout pour bout et repassez (1 mm au moins).`; }
  else if(fs.tear){ if(d>=1){ fs.tear=false; cut.lastMsg='Passe dans le sens du fil : les arrachements ont disparu.'; } else cut.lastMsg='Passe trop fine pour effacer les arrachements : 1 mm au moins.'; }
  if(!isF(f)){ // chant : angle avec la face posée contre le guide
    const ref=faces().back, refFlat=isF(ref)&&isFlat(ref), touch=againstGuide();
    const deg= touch&&refFlat? st.ga : touch? 90+Math.min(3,0.6*flatness(ref)+0.4) : 92.5;
    fs.angle={ ref, deg }; }
  if(cut.lastMsg) cut.msgSeq++;
  build(); }

/* ---------- manipulations ---------- */
export function rot(n){ p.k+=n; }
export function endForEnd(){ p.flip=!p.flip; }
export function toGuide(){ place(); p.zOff=0; place(); }
export function setZOff(z){ p.zOff=z; }
/* Repère au crayon. On prend la pièce en main et on la tourne pour voir les faces dressées (la pièce est réorientée) :
   - SR1 seul (ou pas encore repéré) : boucle de parement sur SR1, SR1 dessus ;
   - SR1 et SR2 dressés : repère d'angle, un trait sur SR1 côté angle droit qui repart sur SR2 (petit V à cheval sur l'arête),
     SR1 dessus, SR2 côté opérateur.
   Rend {kind:'loop'|'v', s1, s2} ou {err} ; ne touche pas aux faces brutes. */
export function markRef(){ if(!p) return {err:'Pas de pièce.'};
  const fl=['F1','F2'].filter(f=>p.face[f].passes>0&&isFlat(f)&&!p.face[f].tear);
  if(!fl.length) return {err:'Aucun plat n\'est dressé : dressez d\'abord la face de référence (SR1), puis repérez-la.'};
  const s1=fl.find(f=>p.face[f].mark==='loop')||fl[0];
  const ch=['C1','C2'].filter(f=>p.face[f].passes>0&&isFlat(f)&&p.face[f].angle&&p.face[f].angle.ref===s1);
  const s2=ch.find(f=>p.face[f].mark)||ch[0]||null;
  p.k=(RING.indexOf(s1)+2)%4;                                   // SR1 dessus
  if(p.face[s1].mark!=='loop' || !s2){ p.face[s1].mark='loop'; build(); return {kind:'loop', s1}; }
  p.flip = RING[(p.k+3)%4]!==s2;                                 // SR2 côté opérateur
  const fs=p.face[s2]; fs.mark='v'; fs.markRef=s1; p.vmark={s1,s2}; build(); return {kind:'v', s1, s2}; }
/* point à regarder pour le repère (scène) : sur le dessus, au droit du dessin ; arête avant pour le V */
export function markFocus(kind){ const b=pieceBox(); if(!b) return null;
  const u= kind==='v'? 0.72 : 0.42, cx=(b.min.x+b.max.x)/2, L=b.max.x-b.min.x, x=cx+(u-0.5)*L*(p.flip?-1:1);
  return kind==='v'? [x, b.max.y, b.max.z] : [x, b.max.y, (b.min.z+b.max.z)/2]; }
export function back(){ st.t=0; cut.done=false; cut.started=false; cut.inProgress=false; cut.lastT=0; place(); }
