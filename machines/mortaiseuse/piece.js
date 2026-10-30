/* Pièces à la mortaiseuse : pièces de corroyage (engine/corroyage.js : faces F1/F2/C1/C2, repères SR1/SR2, fil), posées à plat
   sur la table, la face « down » sur la table, la face « back » contre le guide : c'est cette face que le bédane usine.
   Une pièce venue d'une autre machine arrive telle quelle (newPiece({json:C.pieceJSON(q)})), tenons compris.

   Repère de la table (mm) : xs, le long de la table, depuis la butée gauche (position de chargement : table sur le taquet 1).
   Pièce contre la butée gauche : elle occupe [0, L] ; contre la butée droite : [XR − L, XR]. Les patins des vérins sont
   repérés de la même façon (ils sont portés par la table et le portique, ils suivent la pièce).
   Une plongée : course du bédane [s0, s0 + oscillation] (repère de la table), du dessus de la table à ar … ar + E (arasement,
   épaisseur du bédane), de la face arrière jusqu'à la profondeur (taquet d'arrêt − 71). La boîte enlevée est gardée dans la
   pièce (q.morts, voir corroyage.js), en coordonnées locales. États : 'table' (sur la machine), 'stock' (pièces débitées). */
import * as THREE from 'three';
import * as C from '../../engine/corroyage.js';
import { TABLE_Y, FENCE_Z, XC0, XBG, XBD, REF0, DEB_END, V_TETE, V_TABLE, SPEEDUP } from './constants.js';
import { st, tool, taquets } from './state.js';

const N = C.N, BIG = C.BIG;
export const FACE_NAME = C.FACE_NAME;
const PEEK_TILT=0.55, PEEK_Y=TABLE_Y+0.26, PEEK_Z=0.42;
/* caméra pour regarder la pièce soulevée (« Voir les mortaises ») : recul selon la longueur */
export const peekCam=q=>{ const d=0.35+q.L/1000*0.75; return { pos:[0, PEEK_Y+d*0.45, PEEK_Z+d], tgt:[0, PEEK_Y, PEEK_Z] }; };
export const XR = Math.round((XBD-XBG)*1000);       // butée droite dans le repère de la table (mm)
export const XCH = Math.round((XC0-XBG)*1000);      // course du bédane quand la table est en position de chargement (mm)
let app=null, pieceRoot=null, partMeshes=null, uid=0;
export function initPieces(a, model){ app=a; pieceRoot=model.pieceRoot; partMeshes=a.parts.partMeshes; }

/* ---------- état ---------- */
export const pieces=[];
export const cyc={ on:false, phase:'idle', queue:[], i:0, manual:false, tPrev:null, msg:'', seq:0, plunges:0, cuts:0, ec:false, empty:false, log:[] };
export const onTable=()=>pieces.find(q=>q.state==='table')||null;

/* ---------- création ---------- */
/* spec : pièce de corroyage (C.makePiece) ou {json} ; plus { name, dress:{s1,s2}, lar, ep (pièce corroyée), state, k, flip, ref } */
export function newPiece(spec){
  const base=spec.json? C.makePiece(spec.json) : C.makePiece(spec);
  const q={ ...base, id:++uid, name:spec.name||'Pièce', state:spec.state||'table', kind:'piece', ref:spec.ref||'G', group:null, mesh:null, line:null, log:[] };
  if(!spec.json){
    if(spec.dress) C.dresseSR(q,spec.dress);
    if(spec.lar){ C.rabote(q,'C1',spec.lar); Object.assign(q.face.C2,{passes:1,rab:true,full:true,angle:{ref:'F1',deg:90}}); }
    if(spec.ep){ C.rabote(q,'F1',spec.ep); Object.assign(q.face.F2,{passes:1,rab:true,full:true}); }
    q.k=spec.k||0; q.flip=!!spec.flip; }
  pieces.push(q);
  if(q.state==='table') build(q);
  return q; }
export function clearPieces(){ for(const q of pieces) dispose(q); pieces.length=0; partMeshes.piece=[];
  Object.assign(cyc,{on:false,phase:'idle',queue:[],i:0,manual:false,msg:'',plunges:0,cuts:0,ec:false,empty:false,log:[]}); }
function dispose(q){ if(q.group){ pieceRoot.remove(q.group); q.group.traverse(o=>o.geometry?.dispose()); q.group=null; q.mesh=null; }
  if(q.line){ pieceRoot.remove(q.line); q.line.geometry.dispose(); q.line=null; } }

/* ---------- mesures ---------- */
export const H=q=>C.heightMm(q);                 // hauteur de la pièce posée (épaisseur à plat)
export const D=q=>C.depthMm(q);                  // profondeur de la pièce, de la face arrière (guide) à la face avant (vérins horizontaux)
export const sr1=q=>['F1','F2'].find(f=>q.face[f].mark==='loop')||null;
export const sr2=q=>{ const s=sr1(q); return s? ['C1','C2'].find(f=>q.face[f].mark==='v'&&q.face[f].markRef===s)||null : null; };
export const fmt=(v,n=1)=>(+v).toLocaleString('fr-FR',{minimumFractionDigits:n,maximumFractionDigits:n});
export const dims=q=>`${fmt(q.L,0)} × ${fmt(Math.min(...C.widthProf(q)))} × ${fmt(Math.min(...C.thickProf(q)))}`;
const ext=q=>({ w:[Math.min(...q.w1),Math.max(...q.w2)], v:[Math.min(...q.v1),Math.max(...q.v2)] });

/* étendue de la pièce dans le repère de la table, selon la butée contre laquelle elle est posée */
export const span=q=> q.ref==='D'? [XR-q.L, XR] : [0, q.L];
/* bout contre la butée (celui depuis lequel la distance de la mortaise se mesure) */
export const refEnd=q=> q.ref==='D'? (q.flip?'A':'B') : (q.flip?'B':'A');
/* coordonnée u (depuis le bout A) d'un point xs du repère de la table */
export function uOf(q,xs){ const [x0]=span(q), d=xs-x0; return q.flip? q.L-d : d; }

/* axes locaux : hauteur au-dessus de la table (y), profondeur depuis la face arrière (z) → coordonnées locales (v, w) */
function axes(q){ const fc=C.faces(q), E=ext(q);
  const lin=f=>({ F1:{ax:'w',o:E.w[0],s:1}, F2:{ax:'w',o:E.w[1],s:-1}, C1:{ax:'v',o:E.v[0],s:1}, C2:{ax:'v',o:E.v[1],s:-1} }[f]);
  return { vert:lin(fc.down), dep:lin(fc.back), fc }; }

/* ---------- plongées : ce que fera le cycle ---------- */
/* courses du bédane prévues (repère de la table) : une par taquet en service après le premier (origine), dans l'ordre */
export function plannedS0(q){ const T=taquets(); if(T.length<2) return [];
  const t1=T[0].v, rel=T.slice(1).map(t=>t.v-t1).filter(p=>p>=0).sort((a,b)=>a-b);
  return rel.map(p=> !q||q.ref!=='D'? p : XR-p-st.osc); }
/* déplacement de la table (m) pour amener la course du bédane en s0 */
export const tableX=s0=>(XCH-s0)/1000;
export const curS0=()=>XCH-st.X*1000;
/* profondeur atteinte par la plongée (mm depuis la face arrière) */
export const depth=()=> st.deb? DEB_END-REF0 : Math.max(0, st.arr-REF0);
/* boîte enlevée par une plongée en s0 (coordonnées locales), ou null si le bédane ne touche pas la pièce */
export function boxOf(q,s0){ const t=tool(); if(!q||!t) return null; const A=axes(q), d=depth(); if(d<=0.01) return null;
  const [x0,x1]=span(q), a=Math.max(x0,s0), b=Math.min(x1,s0+st.osc); if(b-a<0.05) return null;
  const ua=uOf(q,a), ub=uOf(q,b), u0=Math.min(ua,ub), u1=Math.max(ua,ub);
  const c0=A.vert.o+A.vert.s*st.ar, c1=A.vert.o+A.vert.s*(st.ar+t.E), lo=Math.min(c0,c1), hi=Math.max(c0,c1);
  const z=A.dep.o+A.dep.s*d, open=A.dep.s>0? [-BIG, st.deb? BIG : z] : [st.deb? -BIG : z, BIG];
  const box={u0,u1,ec:false}; if(A.vert.ax==='w'){ box.w0=lo; box.w1=hi; } else { box.v0=lo; box.v1=hi; }
  if(A.dep.ax==='v'){ box.v0=open[0]; box.v1=open[1]; } else { box.w0=open[0]; box.w1=open[1]; }
  if(box.v0===undefined){ box.v0=-BIG; box.v1=BIG; } if(box.w0===undefined){ box.w0=-BIG; box.w1=BIG; }
  // le bédane ne touche la pièce que si sa hauteur croise l'épaisseur de la pièce
  const Hp=H(q); if(st.ar>=Hp-0.01 || st.ar+t.E<=0.01) return null;
  return box; }

/* lecture des mortaises, tenon d'une traverse et assemblage : engine/assemblage.js (communs avec la tenonneuse, 30/10/2026 :
   la mortaise se fait AVANT le tenon, le tenon est ajusté à la mortaise) */
export { mortises, fromFace, nearEnd, tenonOf, fit } from '../../engine/assemblage.js';

/* ---------- placement et maillage ---------- */
const box3=new THREE.Box3(), LINE_KEEP=new THREE.LineBasicMaterial({color:0xd27a1c});
export function place(q){ if(!q.group) return;
  /* « Voir les mortaises » : la pièce est soulevée devant la machine et pivotée d'un demi-tour (comme dans les mains) :
     la face qui était contre le guide vient face à l'opérateur, inclinée vers le haut ; SR1 reste dessous */
  const inner=q.group.children[0]; inner.rotation.set(-q.k*Math.PI/2,0,0); q.group.rotation.set(q.peek?-PEEK_TILT:0,(q.flip?Math.PI:0)+(q.peek?Math.PI:0),0);
  q.group.position.set(0,0,0); q.group.updateMatrixWorld(true); const b=box3.setFromObject(q.mesh);
  if(q.peek){ q.group.position.set(-(b.min.x+b.max.x)/2, PEEK_Y-(b.min.y+b.max.y)/2, PEEK_Z-(b.min.z+b.max.z)/2); if(q.line) q.line.visible=false; return; }
  if(q.line) q.line.visible=true;
  const x= q.ref==='D'? XBD+st.X-b.max.x : XBG+st.X-b.min.x;
  q.group.position.set(x, TABLE_Y-b.min.y, FENCE_Z-b.min.z); outline(q); }
function outline(q){ q.group.updateMatrixWorld(true); const b=box3.setFromObject(q.mesh), y=b.max.y+0.001;
  const pts=[[b.min.x,b.min.z],[b.max.x,b.min.z],[b.max.x,b.max.z],[b.min.x,b.max.z],[b.min.x,b.min.z]].map(([x,z])=>new THREE.Vector3(x,y,z));
  if(!q.line){ q.line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),LINE_KEEP); pieceRoot.add(q.line); }
  else q.line.geometry.setFromPoints(pts); }
export function build(q){ dispose(q); if(q.state==='stock') return;
  const mesh=C.pieceMesh(q); mesh.userData.pieceId=q.id;
  const inner=new THREE.Group(); inner.add(mesh); const g=new THREE.Group(); g.add(inner);
  pieceRoot.add(g); q.group=g; q.mesh=mesh; place(q); refreshMeshes(); }
function refreshMeshes(){ partMeshes.piece=pieces.filter(x=>x.mesh).map(x=>x.mesh); app.stage.dirty(); }
export function placeAll(){ for(const q of pieces) if(q.group) place(q); }

/* ---------- cycle : automatique (plongées à chaque taquet, va-et-vient de la table) ou plongée manuelle ---------- */
export const atLoad=()=>Math.abs(st.X)<1e-5 && !cyc.on;
/* lance le cycle ; block() rend une raison de refuser (blocage, pas une faute) ou '' */
export function startCycle(manual, block){
  if(cyc.on) return '';
  const q=onTable(), why=block(q,manual); if(why) return why;
  app.recordDangers();                                // faute grave : alerte « danger » active au moment où le cycle démarre
  const queue= manual? [curS0()] : plannedS0(q);
  Object.assign(cyc,{ on:true, manual, queue, i:0, phase: manual? 'in' : 'move', tPrev:null, msg:'', plunges:0, cuts:0, ec:false, empty:!q });
  cyc.log.push({ piece:q?q.id:null, ref:q?q.ref:null, down:q?C.faces(q).down:null, back:q?C.faces(q).back:null, dep:st.dep, arr:st.arr, ar:st.ar, osc:st.osc, deb:st.deb, tool:st.tool, press:st.press, done:false });
  return ''; }
export function stopCycle(msg){ if(!cyc.on) return; cyc.on=false; cyc.phase='idle'; cyc.msg=msg||''; cyc.seq++; }
/* avance d'un pas ; rend true si quelque chose a bougé. ok() : le bédane oscille toujours (sinon arrêt du cycle) */
export function tickCycle(now, ok){ const dt=Math.min(0.25,now-(cyc.tPrev??now)); cyc.tPrev=now; if(!cyc.on) return false;
  if(!ok()){ const man=cyc.manual; stopCycle('Cycle interrompu : le bédane s\'est arrêté. La tête revient au taquet de départ'+(man?'':', la table au taquet 1')+' ; contrôlez la pièce.'); st.R=st.dep; if(!man){ st.X=0; placeAll(); } return true; }
  const step=(cur,tgt,v)=>{ const d=tgt-cur, m=v*SPEEDUP*dt; return Math.abs(d)<=m? tgt : cur+Math.sign(d)*m; };
  const q=onTable(), s0=cyc.queue[cyc.i];
  if(cyc.phase==='move'){ const tx=tableX(s0); st.X=step(st.X,tx,V_TABLE); placeAll(); if(Math.abs(st.X-tx)<1e-6) cyc.phase='in'; return true; }
  if(cyc.phase==='in'){ const tgt= st.deb? DEB_END : st.arr; st.R=step(st.R,tgt,V_TETE*1000);
    if(Math.abs(st.R-tgt)<1e-6){ const b=boxOf(q,cyc.manual? curS0() : s0);
      if(b){ b.ec= st.dep>=REF0-1e-6; q.morts=(q.morts||[]).concat([b]); cyc.cuts++; if(b.ec) cyc.ec=true; build(q); }
      cyc.plunges++; cyc.phase='out'; }
    return true; }
  if(cyc.phase==='out'){ st.R=step(st.R,st.dep,V_TETE*1000); if(Math.abs(st.R-st.dep)<1e-6){
      if(cyc.manual){ finish(); return true; }
      cyc.i++; cyc.phase= cyc.i<cyc.queue.length? 'move' : 'return'; }
    return true; }
  if(cyc.phase==='return'){ st.X=step(st.X,0,V_TABLE); placeAll(); if(Math.abs(st.X)<1e-6) finish(); return true; }
  return false; }
function finish(){ const q=onTable(), last=cyc.log[cyc.log.length-1]; if(last) last.done=true;
  cyc.on=false; cyc.phase='idle'; if(!cyc.manual) st.bed=false;
  const m=[];
  if(!q) m.push('Cycle à vide : le bédane a fait ses plongées sans pièce.');
  else if(!cyc.cuts) m.push('Le bédane n\'a pas touché la pièce : vérifiez l\'arasement, la profondeur et les taquets.');
  else m.push(`${cyc.cuts} plongée${cyc.cuts>1?'s':''} dans la pièce.`);
  if(cyc.ec) m.push('Le bédane est parti du taquet de départ placé après 71 : il a attaqué le bois sans élan, les bords de la mortaise sont éclatés.');
  if(!cyc.manual) m.push('Fin de cycle : la table est revenue au taquet 1, le bédane s\'est arrêté. La mortaise est dans le chant contre le guide : desserrez les vérins (bouton noir), puis « Voir les mortaises » pour la contrôler.');
  cyc.msg=m.join(' '); cyc.seq++; refreshMeshes(); }

/* ---------- manipulations (table en position de chargement, bédane arrêté, vérins desserrés) ---------- */
const toStock=q=>{ q.state='stock'; dispose(q); };
export function aside(){ const q=onTable(); if(!q) return 'Aucune pièce sur la table.'; toStock(q); refreshMeshes(); return ''; }
export function take(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(!q||cyc.on) return '';
  if(onTable()) return 'Une pièce est déjà sur la table : mortaisez-la, ou mettez-la de côté avant d\'en reprendre une autre.';
  q.state='table'; q.ref= st.butD&&!st.butG? 'D' : 'G'; build(q); return ''; }
export function setKind(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(q) q.kind=q.kind==='piece'?'interdite':'piece'; }
export function orient(q,op){ if(op==='rot') q.k+=1; else if(op==='flip') q.k+=2; else if(op==='end') q.flip=!q.flip; build(q); }
