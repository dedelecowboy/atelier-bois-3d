/* Pièces sur la raboteuse : un lot de pièces de corroyage (logique commune à la dégauchisseuse, engine/corroyage.js),
   posées sur la table d'entrée, entraînées par les rouleaux sous l'arbre, rangées dans « Pièces débitées ».

   La pièce est pressée à plat sur la table par les rouleaux : la face du dessus est ramenée à la cote H au-dessus de la
   face posée, station par station (C.rabote). Une face posée dressée (SR1) donne une face rabotée plane et parallèle ;
   une face posée cintrée ou brute est recopiée sur la face rabotée (la raboteuse ne redresse pas une pièce).

   Dans la scène : x = sens d'avance (la pièce va vers −X), bout avant de la pièce en q.x (le plus petit x), z = q.z
   (côté −Z de la pièce). États : 'entry' (table d'entrée), 'moving' (passe), 'stuck' (coincée entre les rouleaux),
   'exit' (reposée sur le capot par l'aide en sortie, même face dessous), 'stock' (pièces débitées, à côté de la machine). */
import * as THREE from 'three';
import * as C from '../../engine/corroyage.js';
import { LEAD0, X_IN, X_OUT, EXIT_TRAIL, GRIP, THICK_TOL, USE_W, ENTRAXE, HOOD_Y, HOOD_X } from './constants.js';
import { st, tableY } from './state.js';

const N = C.N;
export const FACE_NAME = C.FACE_NAME;
let app=null, pieceRoot=null, partMeshes=null, uid=0;
export function initPieces(a, model){ app=a; pieceRoot=model.pieceRoot; partMeshes=a.parts.partMeshes; }

/* ---------- état ---------- */
export const pieces=[];
export const cut={ inProgress:false, movers:[], sel:null, keep:null, passes:0, lastMsg:'', msgSeq:0, blocked:'', tPrev:null };
const SPEEDUP=4;   // l'animation va 4 fois plus vite que l'avance réelle
export const onMachine=()=>pieces.filter(q=>q.state!=='stock');
export const entryPieces=()=>pieces.filter(q=>q.state==='entry');
export const exitPieces=()=>pieces.filter(q=>q.state==='exit');
export const stuckPieces=()=>pieces.filter(q=>q.state==='stuck');
/* pièce en main : celle entourée en orange s'il y en a plusieurs sur la machine, sinon la seule */
export function selPiece(){ const m=onMachine().filter(q=>q.state==='entry'||q.state==='exit'); if(!m.length) return null; return m.find(q=>q.id===cut.sel)||m.find(q=>q.state==='entry')||m[0]; }
export const keepPiece=()=>{ const ex=exitPieces(); return ex.find(q=>q.id===cut.keep)||ex[0]||null; };

/* ---------- création ---------- */
/* spec : pièce de corroyage (C.makePiece), plus { name, dress:{s1,s2} (pièce sortie de la dégauchisseuse),
   ep (épaisseur déjà faite à la raboteuse), state:'entry'|'stock', k, flip } */
export function newPiece(spec){
  const q={ ...C.makePiece(spec), id:++uid, name:spec.name||'Pièce', state:spec.state||'entry', kind:'piece', x:LEAD0, z:0, group:null, mesh:null, out:null, line:null, res:null, done:0 };
  if(spec.dress){ C.dresseSR(q,spec.dress); }
  if(spec.lar){ C.rabote(q,'C1',spec.lar); Object.assign(q.face.C2,{passes:1,rab:true,full:true,angle:{ref:'F1',deg:90}}); }
  if(spec.ep){ C.rabote(q,'F1',spec.ep); Object.assign(q.face.F2,{passes:1,rab:true,full:true}); }
  q.k=spec.k||0; q.flip=!!spec.flip;
  pieces.push(q);
  if(q.state==='entry'){ q.z=freeZ(q); build(q); }
  return q; }
export function clearPieces(){ for(const q of pieces) dispose(q); pieces.length=0; partMeshes.piece=[]; Object.assign(cut,{inProgress:false,movers:[],sel:null,keep:null,passes:0,blocked:''}); }
function dispose(q){ if(q.group){ pieceRoot.remove(q.group); q.group.traverse(o=>o.geometry?.dispose()); q.group=null; q.mesh=null; q.out=null; }
  if(q.line){ pieceRoot.remove(q.line); q.line.geometry.dispose(); q.line=null; } }

/* ---------- mesures ---------- */
const down=q=>C.faces(q).down, up=q=>C.faces(q).up;
/* hauteur de la pièce pressée à plat sur la table (mm) : plus grande distance face posée – face du dessus */
export const pressedH=q=>Math.max(...C.across(q,down(q)));
export const baseW=q=>C.depthMm(q);
/* profondeur de passe si la pièce passe maintenant (mm) */
export const passDepth=q=>pressedH(q)-st.H;
/* repères au crayon : SR1 (boucle), SR2 (V) */
export const sr1=q=>['F1','F2'].find(f=>q.face[f].mark==='loop')||null;
export const sr2=q=>{ const s=sr1(q); return s? ['C1','C2'].find(f=>q.face[f].mark==='v'&&q.face[f].markRef===s)||null : null; };
/* face dressée (plane, usinée) : la seule qui convient comme face posée */
export const dressed=(q,f)=>q.face[f].passes>0 && C.isFlat(q,f) && !q.face[f].tear;
export function measure(q){ const tp=C.thickProf(q), wp=C.widthProf(q);
  return { L:q.L, T:Math.min(...tp), Tmax:Math.max(...tp), W:Math.min(...wp), Wmax:Math.max(...wp),
    parT:Math.max(...tp)-Math.min(...tp), parW:Math.max(...wp)-Math.min(...wp), tear:['F1','F2','C1','C2'].some(f=>q.face[f].tear),
    s1:sr1(q), s2:sr2(q), planed:['F1','F2','C1','C2'].filter(f=>q.face[f].passes>0) }; }
/* état d'une face pour le tableau : brute, dressée, rabotée, avec manques… */
export function faceState(q,f){ const s=q.face[f]; if(s.passes===0) return 'brute'; if(s.tear) return 'arrachements';
  if(q.face[f].rab){ return q.face[f].full? (C.isFlat(q,f)?'rabotée':'rabotée, pas plane') : 'rabotée avec manques'; }
  return C.isFlat(q,f)? 'dressée' : 'en cours'; }
export const fmt=(v,n=1)=>(+v).toLocaleString('fr-FR',{minimumFractionDigits:n,maximumFractionDigits:n});
export const dims=q=>{ const m=measure(q); return `${q.L} × ${fmt(m.W)} × ${fmt(m.T)}`; };

/* ---------- placement et maillage ---------- */
const box=new THREE.Box3(), LINE_KEEP=new THREE.LineBasicMaterial({color:0xd27a1c});
export function pieceBox(q){ if(!q.group) return null; q.group.updateMatrixWorld(true); return box.setFromObject(q.mesh).clone(); }
/* place la pièce : bout avant en q.x, posée sur la table, côté −Z en q.z */
export function place(q){ if(!q.group) return;
  const inner=q.group.children[0]; inner.rotation.set(-q.k*Math.PI/2,0,0); q.group.rotation.set(0,q.flip?Math.PI:0,0);
  q.group.position.set(0,0,0); q.group.updateMatrixWorld(true); const b=box.setFromObject(q.mesh);
  q.group.position.set(q.x-b.min.x, (q.state==='exit'?HOOD_Y:tableY())-b.min.y, q.z-b.min.z);
  outline(q); }
/* contour orange de la pièce en main (plusieurs pièces sur la machine) */
function outline(q){ if(q.line){ pieceRoot.remove(q.line); q.line.geometry.dispose(); q.line=null; }
  const many=onMachine().filter(x=>x.state==='entry'||x.state==='exit').length>1, s=selPiece()===q || (q.state==='exit'&&keepPiece()===q&&exitPieces().length>1);
  if(!many||!s||!(q.state==='entry'||q.state==='exit')) return;
  q.group.updateMatrixWorld(true); const b=box.setFromObject(q.mesh), y=b.max.y+0.001;
  const pts=[[b.min.x,b.min.z],[b.max.x,b.min.z],[b.max.x,b.max.z],[b.min.x,b.max.z],[b.min.x,b.min.z]].map(([x,z])=>new THREE.Vector3(x,y,z));
  q.line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),LINE_KEEP); pieceRoot.add(q.line); }
export function build(q){ dispose(q); if(q.state==='stock') return;
  const mesh=C.pieceMesh(q); mesh.userData.pieceId=q.id;
  const inner=new THREE.Group(); inner.add(mesh); const g=new THREE.Group(); g.add(inner);
  pieceRoot.add(g); q.group=g; q.mesh=mesh; place(q); refreshMeshes(); }
function refreshMeshes(){ partMeshes.piece=pieces.filter(x=>x.mesh).flatMap(x=>[x.mesh,...(x.out?[x.out]:[])]); app.stage.dirty(); }
export const placeAll=()=>{ for(const q of pieces) if(q.group) place(q); };
/* emplacement libre en travers sur la table d'entrée (côté −Z de la pièce), ou null */
export function freeZ(q, others=entryPieces().filter(x=>x!==q)){ const d=baseW(q)/1000, half=USE_W/2000;
  if(!others.length) return -d/2;
  const used=others.map(o=>[o.z,o.z+baseW(o)/1000]).sort((a,b)=>a[0]-b[0]);
  for(const z0 of [-d/2, ...used.map(u=>u[1]+0.03), ...used.map(u=>u[0]-0.03-d)]){
    if(z0<-half-1e-6||z0+d>half+1e-6) continue;
    if(used.every(([a,b])=>z0+d<=a-0.01||z0>=b+0.01)) return z0; }
  return null; }

/* hauteur du dessus des pièces au-dessus de la table, à l'abscisse x (m) : pour les rouleaux, presseurs et linguets */
export function topAt(x,z){ let h=0; for(const q of pieces){ if(!q.group||q.state==='stock'||q.state==='exit') continue;
  const L=q.L/1000; if(x<q.x||x>q.x+L) continue; if(z!==undefined && (z<q.z-0.004||z>q.z+baseW(q)/1000+0.004)) continue;
  const pr= q.res&&x<0? q.res.h : pressedH(q); h=Math.max(h,pr/1000); } return h; }

/* ---------- passe ---------- */
/* station de la pièce à la position s (0 au bout avant, 1 au bout arrière) */
const stIdx=(q,s)=>Math.round((q.flip? 1-s : s)*(N-1));
/* engage les pièces de la table d'entrée. block(pièces) rend une raison de refuser, ou ''. Rend un message d'échec, ou '' */
export function startPass(block){
  if(cut.inProgress) return '';
  const E=entryPieces(); if(!E.length) return 'Pas de pièce sur la table d\'entrée : « Reprendre » une pièce dans « Pièces débitées », ou « Ramener la pièce ».';
  if(stuckPieces().length) return 'Une pièce est coincée dans la machine : arrêtez la machine, descendez la table, « Ressortir la pièce ».';
  const why=block(E); if(why) return why;
  /* les rouleaux entraînent une pièce qui dépasse la cote (moins l'écrasement) ; le rouleau d'entrée monobloc ne tient que les plus épaisses */
  const grip=E.filter(q=>pressedH(q)>=st.H-GRIP);
  if(!grip.length){ cut.lastMsg=`La pièce n'avance pas : elle est plus mince que la cote (${fmt(pressedH(E[0]))} mm pour ${fmt(st.H)} mm), les rouleaux ne la touchent pas. Réduisez la cote (montez la table) de quelques millimètres.`; cut.msgSeq++; return ' '; }
  app.recordDangers();                               // faute grave : alerte danger active au moment d'engager les pièces
  const hmax=Math.max(...grip.map(pressedH)), held=grip.filter(q=>pressedH(q)>=hmax-THICK_TOL), rej=E.filter(q=>!held.includes(q));
  for(const q of held){ q.state='moving'; q.res=predict(q); q.stuckMsg=''; buildPass(q); }
  cut.movers=held; cut.inProgress=true; cut.tPrev=null; cut.rejected=rej.map(q=>q.id); cut.lastMsg='';
  if(rej.length){ cut.lastMsg=`Pièce plus mince non tenue par le rouleau d'entrée (monobloc) : ${rej.map(q=>q.name.toLowerCase()).join(', ')} rejetée vers l'opérateur, retenue par les linguets anti-recul.`; cut.msgSeq++; }
  return ''; }
/* résultat de la passe (sans modifier la pièce) */
function predict(q){ const r=C.makePiece(C.pieceJSON(q)), dn=down(q), u=C.OPP[dn], rem=C.rabote(r,dn,st.H);
  const any=rem.some(x=>x>0.001), full=rem.every((x,i)=>x>0.001 || Math.abs(C.across(r,dn)[i]-st.H)<0.01);
  return { piece:r, rem, any, full, face:u, down:dn, H:st.H, h:Math.min(pressedH(q),st.H), gs:C.grainSign(q,u) }; }
/* applique le résultat aux stations déjà passées sous l'arbre (toutes en fin de passe) */
function applyRes(q, upTo=1){ const R=q.res; if(!R) return; const f=R.face, fs=q.face[f], a=C.prof(q,f), b=C.prof(R.piece,f);
  let cutN=0, minRem=1e9, cutAny=false;
  for(let i=0;i<N;i++){ const s=q.flip? 1-i/(N-1) : i/(N-1); if(s>upTo+1e-9) continue; if(R.rem[i]>0.001){ cutAny=true; minRem=Math.min(minRem,R.rem[i]); } a[i]=b[i]; cutN++; }
  const msgs=[];
  if(cutAny && !dressed(q,R.down)) msgs.push(`Section de pièce non rectangulaire, car rabotage en appui sur une surface non dégauchie (${q.name.toLowerCase()}).`);
  if(cutAny){ fs.passes++; fs.rab=true; fs.full= upTo>=1 && (R.full || fs.full&&R.rem.every(x=>x<=0.001)); C.clearMark(q,f);
    if(R.gs<0){ fs.tear=true; msgs.push(`Arrachements sur le ${FACE_NAME[f].toLowerCase()} : la pièce est passée contre le fil. Présentez-la bout pour bout et repassez (1 mm au moins).`); }
    else if(fs.tear){ if(minRem>=1-1e-6 && upTo>=1){ fs.tear=false; msgs.push('Passe dans le sens du fil : les arrachements ont disparu.'); } else msgs.push('Passe trop fine pour effacer les arrachements : 1 mm au moins.'); }
    if(!C.isF(f)){ const ref=sr1(q)||(C.isF(C.faces(q).back)?C.faces(q).back:'F1'), dn=q.face[R.down];
      fs.angle={ ref, deg: dn.angle&&dressed(q,R.down)? dn.angle.deg : 90+Math.min(3,0.6*C.flatness(q,R.down)+0.4) }; } }
  q.res=null; return { cutAny, msgs }; }
/* maillages de la passe : pièce entière côté entrée (x > 0), pièce rabotée côté sortie (x < 0) */
const PLANE_IN=new THREE.Plane(new THREE.Vector3(1,0,0),0), PLANE_OUT=new THREE.Plane(new THREE.Vector3(-1,0,0),0);
const clipMats=(mesh,plane)=>{ mesh.material=mesh.material.map(m=>{ const c=m.clone(); c.clippingPlanes=[plane]; return c; }); };
function buildPass(q){ build(q); clipMats(q.mesh,PLANE_IN);
  const R=q.res, r=R.piece; r.face=JSON.parse(JSON.stringify(q.face)); if(R.any){ const fs=r.face[R.face]; fs.passes++; fs.mark=null; if(R.gs<0) fs.tear=true; else if(fs.tear && Math.min(...R.rem.filter(x=>x>0.001))>=1-1e-6) fs.tear=false; }
  r.vmark= q.vmark&&(q.vmark.s1===R.face||q.vmark.s2===R.face)? null : q.vmark; r.k=q.k; r.flip=q.flip;
  // même repère local que la pièce entière : la face posée coïncide, seule la face rabotée change
  const out=C.pieceMesh(r); out.userData.pieceId=q.id; clipMats(out,PLANE_OUT); q.mesh.parent.add(out); q.out=out;
  refreshMeshes(); }
/* vitesse d'avance à l'affichage (m/s) */
export const feedSpeed=()=>st.v/60*SPEEDUP;
/* une pièce est entraînée si elle touche un rouleau (ou si on la pousse jusqu'au rouleau d'entrée) */
const driven=q=>{ const lead=q.x, trail=q.x+q.L/1000; if(lead>X_IN) return true;
  return [X_IN,...X_OUT].some(x=>lead<=x+1e-6&&trail>=x-1e-6) || trail<X_OUT[1]; };
/* avance des pièces ; rend true si quelque chose a bougé */
export function tickPass(now){ const dt=Math.min(0.5,now-(cut.tPrev??now)); cut.tPrev=now;
  if(!cut.inProgress||!st.feed||!st.motor) return false;
  let moved=false;
  for(const q of cut.movers){ if(q.state!=='moving') continue;
    if(!driven(q)){ q.state='stuck'; applyRes(q, partDone(q)); build(q);
      cut.lastMsg=`La ${q.name.toLowerCase()} s'est arrêtée sous l'arbre : plus courte (${q.L} mm) que l'entraxe des rouleaux (${ENTRAXE} mm), aucun rouleau ne la tient plus. `; cut.msgSeq++; continue; }
    // petits pas : une pièce courte ne doit pas « sauter » l'intervalle entre deux rouleaux d'une image à l'autre
    let rest=feedSpeed()*dt, stuck=false;
    while(rest>1e-9){ const dx=Math.min(rest,0.003); if(!driven(q)){ stuck=true; break; } q.x=Math.max(EXIT_TRAIL-q.L/1000, q.x-dx); rest-=dx; }
    place(q); moved=true;
    if(stuck) continue;
    if(q.x+q.L/1000<=EXIT_TRAIL+1e-6){ finish(q); } }
  if(cut.movers.every(q=>q.state!=='moving')) endPass();
  return moved; }
/* part de la pièce déjà passée sous l'arbre (0 à 1, depuis le bout avant) */
const partDone=q=>Math.max(0,Math.min(1,-q.x/(q.L/1000)));
/* l'aide en sortie reçoit la pièce et la repose sur le capot, sans la retourner (la face qui était sur la table reste dessous) */
function finish(q){ const r=applyRes(q,1); const z=hoodZ(q); q.state='exit'; q.x=(HOOD_X[0]+HOOD_X[1])/2-q.L/2000; q.z=z; build(q); q.doneMsgs=r.msgs; }
function hoodZ(q){ const d=baseW(q)/1000, used=exitPieces().map(o=>[o.z,o.z+baseW(o)/1000]).sort((a,b)=>a[0]-b[0]);
  for(const z0 of [-d/2,...used.map(u=>u[1]+0.02),...used.map(u=>u[0]-0.02-d)]) if(z0>=-0.50&&z0+d<=0.50&&used.every(([a,b])=>z0+d<=a-0.005||z0>=b+0.005)) return z0;
  return used.length? used[used.length-1][1]+0.02 : -d/2; }
function endPass(){ const done=cut.movers.filter(q=>q.state==='exit'); cut.inProgress=false; cut.passes++;
  if(done.length){ cut.keep=done[0].id; for(const q of exitPieces()) build(q); }
  const parts=done.map(q=>{ const m=measure(q); return `${q.name.toLowerCase()} : ${fmt(m.T)} × ${fmt(m.W)} mm`; });
  const extra=done.flatMap(q=>q.doneMsgs||[]); const stuck=cut.movers.filter(q=>q.state==='stuck');
  if(done.length){ cut.lastMsg=`Passe terminée (${parts.join(' ; ')}).`+(extra.length?' '+extra.join(' '):'')+(done.length>1?' Pièce en main : contour orange (cliquez une autre pièce pour la prendre).':'')+' L\'aide en sortie l\'a reposée sur le capot : « Ramener la pièce » pour une nouvelle passe, ou « Mettre de côté ».'; cut.msgSeq++; } cut.movers=[]; refreshMeshes(); }

/* ---------- manipulations ---------- */
export function setSel(id){ const q=pieces.find(x=>x.id===id); if(!q||!(q.state==='entry'||q.state==='exit')) return false; cut.sel=id; if(q.state==='exit') cut.keep=id; placeAll(); return true; }
const toStock=q=>{ q.state='stock'; dispose(q); if(cut.sel===q.id) cut.sel=null; };
/* ramène la pièce en main (contour orange) du capot sur la table d'entrée, à côté des autres */
export function bringBack(){ const k=keepPiece(); if(!k) return 'Aucune pièce à la sortie.';
  const z=freeZ(k); if(z===null) return 'Plus de place sur la table d\'entrée : mettez une pièce de côté.';
  k.state='entry'; k.x=LEAD0; k.z=z; cut.sel=k.id; cut.keep=null; build(k); placeAll(); return ''; }
/* range les pièces de la sortie (ou la pièce en main sur la table d'entrée) dans « Pièces débitées » */
export function aside(){ const s=pieces.find(q=>q.id===cut.sel&&q.state==='entry');
  if(s){ toStock(s); placeAll(); refreshMeshes(); return ''; }                 // la pièce en main, sur la table d'entrée
  const ex=exitPieces(); if(ex.length){ for(const q of ex) toStock(q); cut.keep=null; placeAll(); refreshMeshes(); return ''; }   // les pièces du capot
  const q=selPiece(); if(!q) return 'Aucune pièce sur la machine.'; toStock(q); placeAll(); refreshMeshes(); return ''; }
/* reprend une pièce rangée sur la table d'entrée (à côté des autres s'il reste de la place) */
export function take(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(!q||cut.inProgress) return '';
  const z=freeZ(q); if(z===null) return 'Plus de place sur la table d\'entrée : mettez une pièce de côté.';
  q.state='entry'; q.x=LEAD0; q.z=z; cut.sel=q.id; build(q); placeAll(); return ''; }
export function setKind(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(q) q.kind=q.kind==='piece'?'retour':'piece'; }
/* orientation de la pièce en main (table d'entrée) ; la pièce reste à sa place en travers si elle tient */
export function orient(q,op){ if(op==='rot') q.k+=1; else if(op==='flip') q.k+=2; else if(op==='end') q.flip=!q.flip;
  const others=entryPieces().filter(x=>x!==q), d=baseW(q)/1000, fits=z=>z>=-USE_W/2000-1e-6 && z+d<=USE_W/2000+1e-6 && others.every(o=>z+d<=o.z-0.01||z>=o.z+baseW(o)/1000+0.01);
  if(!others.length) q.z=-d/2; else if(!fits(q.z)) q.z=freeZ(q,others)??q.z;
  build(q); placeAll(); }
/* ressort une pièce coincée (machine arrêtée, table descendue) : la partie déjà passée sous l'arbre est rabotée */
export function pullOut(q){ q.state='entry'; q.x=LEAD0; q.res=null; const z=freeZ(q); q.z=z??q.z; cut.sel=q.id; build(q); placeAll(); }
