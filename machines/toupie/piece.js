/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Pièces à la toupie : pièces de corroyage (engine/corroyage.js : faces F1/F2/C1/C2, repères SR1/SR2, fil), posées sur la
   table, la face « back » (côté −Z) contre le guide, la face « down » sur la table. Une pièce qui sort de la raboteuse arrive
   telle quelle (newPiece({json:C.pieceJSON(q)})) avec ses repères.

   Travail au guide (lot 1) : la pièce est plaquée contre le demi-guide d'entrée ; l'outil enlève la matière de la face contre
   le guide là où son rayon de coupe dépasse la face du guide. Le profil obtenu est gardé dans la pièce (q.cuts, voir
   corroyage.js) : profondeur enlevée à chaque station le long de la pièce (d) et profil fin en travers de la face (g, au milieu
   de la pièce, sans les défauts de bout) pour le contrôle (hauteur, profondeur), la régularité se lisant sur d.

   Demi-guide de sortie : quand la passe usine toute la rive, la face d'appui recule de eNeed ; le demi-guide de sortie doit être
   avancé d'autant (sinon, en fin de passe, la pièce pivote et l'outil entaille le bout arrière) ; s'il est plus avancé que la face
   usinée, le bout avant bute contre lui et la pièce s'arrête.

   Dans la scène : la pièce avance vers −X ; q.x = bout avant (le plus petit x), q.z = face contre le guide.
   États : 'entry' (à l'entrée, contre le demi-guide d'entrée), 'moving' (passe), 'bute' (arrêtée contre le demi-guide de
   sortie), 'exit' (sortie, côté gauche), 'stock' (pièces débitées, à côté de la machine). */
import * as THREE from 'three';
import * as C from '../../engine/corroyage.js';
import { TABLE_Y, LEAD0, EXIT_X, FEED, E_TOL } from './constants.js';
import { st, tool, zOut } from './state.js';
import { rTool } from './tools.js';

const N = C.N, M = C.M_PROF, G = 201;
export const FACE_NAME = C.FACE_NAME;
let app=null, pieceRoot=null, partMeshes=null, uid=0;
export function initPieces(a, model){ app=a; pieceRoot=model.pieceRoot; partMeshes=a.parts.partMeshes; }

/* ---------- état ---------- */
export const pieces=[];
export const cut={ inProgress:false, mover:null, sel:null, keep:null, passes:0, lastMsg:'', msgSeq:0, tPrev:null, exitOrder:[] };
const SPEEDUP=4;
export const onMachine=()=>pieces.filter(q=>q.state!=='stock');
export const entryPiece=()=>pieces.find(q=>q.state==='entry')||null;
export const exitPieces=()=>cut.exitOrder.map(id=>pieces.find(q=>q.id===id)).filter(q=>q&&q.state==='exit');
export const butePiece=()=>pieces.find(q=>q.state==='bute')||null;
/* pièce en main : la pièce de l'entrée, sinon celle entourée en orange à la sortie */
export function selPiece(){ const e=entryPiece(); if(e) return e; const x=exitPieces(); return x.find(q=>q.id===cut.sel)||x[0]||null; }

/* ---------- création ---------- */
/* spec : pièce de corroyage (C.makePiece) ou {json} (pièce venue d'une autre machine), plus { name, dress:{s1,s2} (sortie de la
   dégauchisseuse), lar, ep (largeur et épaisseur faites à la raboteuse : pièce corroyée), state:'entry'|'stock', k, flip } */
export function newPiece(spec){
  const base=spec.json? C.makePiece(spec.json) : C.makePiece(spec);
  const q={ ...base, id:++uid, name:spec.name||'Pièce', state:spec.state||'entry', kind:'piece', x:LEAD0, z:0, group:null, mesh:null, out:null, line:null, res:null, log:[] };
  if(!spec.json){
    if(spec.dress) C.dresseSR(q,spec.dress);
    if(spec.lar){ C.rabote(q,'C1',spec.lar); Object.assign(q.face.C2,{passes:1,rab:true,full:true,angle:{ref:'F1',deg:90}}); }
    if(spec.ep){ C.rabote(q,'F1',spec.ep); Object.assign(q.face.F2,{passes:1,rab:true,full:true}); }
    q.k=spec.k||0; q.flip=!!spec.flip; }
  pieces.push(q);
  if(q.state==='entry') build(q);
  return q; }
export function clearPieces(){ for(const q of pieces) dispose(q); pieces.length=0; partMeshes.piece=[]; Object.assign(cut,{inProgress:false,mover:null,sel:null,keep:null,passes:0,exitOrder:[]}); }
function dispose(q){ if(q.group){ pieceRoot.remove(q.group); q.group.traverse(o=>o.geometry?.dispose()); q.group=null; q.mesh=null; q.out=null; }
  if(q.line){ pieceRoot.remove(q.line); q.line.geometry.dispose(); q.line=null; } }

/* ---------- mesures ---------- */
export const guided=q=>C.faces(q).back;           // face contre le guide
export const down=q=>C.faces(q).down;             // face sur la table
export const appui=q=>C.depthMm(q);               // largeur d'appui sur la table, en travers du guide
export const haut=q=>C.heightMm(q);               // hauteur de la pièce posée
export const sr1=q=>['F1','F2'].find(f=>q.face[f].mark==='loop')||null;
export const sr2=q=>{ const s=sr1(q); return s? ['C1','C2'].find(f=>q.face[f].mark==='v'&&q.face[f].markRef===s)||null : null; };
export function measure(q){ const tp=C.thickProf(q), wp=C.widthProf(q);
  return { L:q.L, T:Math.min(...tp), W:Math.min(...wp), s1:sr1(q), s2:sr2(q), tear:(q.cuts||[]).some(c=>c.tear), profiled:(q.cuts||[]).map(c=>c.f) }; }
export const fmt=(v,n=1)=>(+v).toLocaleString('fr-FR',{minimumFractionDigits:n,maximumFractionDigits:n});
export const dims=q=>{ const m=measure(q); return `${q.L} × ${fmt(m.W)} × ${fmt(m.T)}`; };

/* ---------- géométrie d'une face contre le guide ---------- */
const across=f=>C.isF(f)? ['v1','v2'] : ['w1','w2'];                 // coordonnée en travers de la face f
/* coordonnée « vers le guide » de la face f, sans profil (mm) : plus elle est grande, plus la face avance vers le guide */
const baseO=(q,f,i)=>({C2:q.v2[i], C1:-q.v1[i], F2:q.w2[i], F1:-q.w1[i]}[f]);
/* hauteur au-dessus de la table du point t (0 à 1 en travers de la face f) à la station i, la pièce posée sur la face dn */
function heightFn(q,f,dn){ const [ka,kb]=across(f), a=q[ka], b=q[kb], lowF=C.isF(f)?'C1':'F1';
  if(dn===lowF){ const ref=Math.min(...a); return (i,t)=>a[i]-ref+t*(b[i]-a[i]); }
  const ref=Math.max(...b); return (i,t)=>ref-(a[i]+t*(b[i]-a[i])); }
/* l'outil coupe-t-il ? ses tranchants doivent tourner dans le sens de l'arbre (outil retourné : sens inversé) */
export const edgesOk=()=>{ const t=tool(); if(!t) return false; const s=(t.sens==='A'?1:-1)*(st.flip?-1:1); return st.dir!==0 && s===st.dir; };
/* travail en avalant : l'arbre tourne dans le sens de l'avance (rotation horaire, pièce de droite à gauche) */
export const climbing=()=>st.dir===-1;

/* résultat d'une passe de la pièce q avec les réglages actuels (sans modifier la pièce) */
export function predict(q){
  const fc=C.faces(q), f=fc.back, dn=fc.down, T=tool(), hF=heightFn(q,f,dn), old=C.cutOf(q,f), cuts=edgesOk();
  const Dold=(i,k)=>old? old.d[i][k] : 0;
  let oMax=-1e9; for(let i=0;i<N;i++) for(let k=0;k<M;k++) oMax=Math.max(oMax, baseO(q,f,i)-Dold(i,k));
  /* limite atteinte par l'outil, en coordonnée « vers le guide » : la face du guide est à zIn de l'axe, l'outil coupe jusqu'à r(h) */
  const lim=h=>{ const r=cuts? rTool(T, h-st.h, st.flip) : 0; return r>0? oMax-(r-st.zIn) : Infinity; };
  const d=[]; let depth=0, oNewMax=-1e9;
  for(let i=0;i<N;i++){ const row=[], b=baseO(q,f,i);
    for(let k=0;k<M;k++){ const o=b-Dold(i,k), on=Math.min(o, lim(hF(i,k/(M-1)))); row.push(b-on); depth=Math.max(depth,(b-on)-Dold(i,k)); oNewMax=Math.max(oNewMax,on); }
    d.push(row); }
  const eNeed=Math.max(0, oMax-oNewMax);
  /* défauts du demi-guide de sortie : entaille en bout arrière, ou bout avant qui bute */
  const snipe= st.e < eNeed-E_TOL ? eNeed-st.e : 0, bute= st.e > eNeed+E_TOL;
  const half=st.open/2, L=q.L;
  const fromTrail=i=>{ const u=i/(N-1)*L; return q.flip? u : L-u; }, fromLead=i=>L-fromTrail(i);
  if(snipe>0) for(let i=0;i<N;i++) if(fromTrail(i)<=half){ const b=baseO(q,f,i);
    for(let k=0;k<M;k++){ const o=b-Dold(i,k), on=Math.min(o, lim(hF(i,k/(M-1)))-snipe); d[i][k]=b-on; } }
  /* profil fin (contrôle), à la station du milieu, avec le profil déjà fait */
  const im=(N-1)>>1, bm=baseO(q,f,im), gOld=old?.g, g=[];
  for(let k=0;k<G;k++){ const t=k/(G-1), od=gOld? gOld[k] : 0, o=bm-od; g.push(Math.max(od, bm-Math.min(o, lim(hF(im,t))))); }
  const gs=C.grainSign(q,f), any=depth>0.02;
  return { f, dn, d, g, depth, any, eNeed, snipe, bute, buteAt:half, cuts, gs, tear:any&&gs<0,
    stopAt: bute? Math.min(1, half/L) : 1, lead:i=>fromLead(i) }; }

/* applique la passe aux stations déjà passées devant l'outil (part : de 0 à 1 depuis le bout avant) */
function applyRes(q, R, part){ const f=R.f; let c=C.cutOf(q,f);
  if(!R.any){ q.log.push(logEntry(R)); return; }
  if(!c){ c={f, d:Array.from({length:N},()=>new Array(M).fill(0)), g:new Array(G).fill(0), tear:false}; (q.cuts||(q.cuts=[])).push(c); }
  for(let i=0;i<N;i++) if(R.lead(i)<=part*q.L+1e-6) c.d[i]=R.d[i].slice();
  if(part>=1-1e-9) c.g=R.g.slice();                                                       // passe interrompue : profil fin inchangé
  if(R.tear) c.tear=true; else if(R.gs>=0 && R.depth>=1) c.tear=false;
  if(c.d.every(r=>r.every(x=>x>0.05))) C.clearMark(q,f);                                  // toute la face usinée : le repère disparaît
  q.log.push(logEntry(R)); }
const logEntry=R=>({ tool:st.tool, flip:st.flip, rpm:st.rpm, dir:st.dir, f:R.f, depth:+R.depth.toFixed(2), eNeed:+R.eNeed.toFixed(2), e:st.e, snipe:R.snipe, bute:R.bute, cut:R.any });

/* ---------- contrôle d'un profil ---------- */
/* hauteur, profondeur, régularité du profil de la face f ; side : 'lo' (côté F1 / C1) ou 'hi' (côté F2 / C2) : l'arête mesurée */
export function profileStats(q,f,side){ const c=C.cutOf(q,f); if(!c) return null; const [ka,kb]=across(f), im=(N-1)>>1, ext=q[kb][im]-q[ka][im];
  const g=side==='hi'? c.g.slice().reverse() : c.g, th=0.003;
  let hEnd=0; for(let k=0;k<G;k++){ if(g[k]>th) continue; const a=k?g[k-1]:g[0]; hEnd= k? ((k-1)+(a-th)/(a-g[k]))/(G-1) : 0; break; }
  if(g.every(x=>x>th)) hEnd=1;
  let lo=-1, hi=-1; for(let k=0;k<G;k++) if(c.g[k]>th){ if(lo<0) lo=k; hi=k; }
  let reg=0; for(let i=0;i<N;i++) for(let k=0;k<M;k++) reg=Math.max(reg, Math.abs(c.d[i][k]-c.d[im][k]));
  return { edge:g[0], height:hEnd*ext, depth:Math.max(...c.g), full:c.g.every(x=>x>th), min:Math.min(...c.g), reg, tear:c.tear,
    from: lo<0? 0 : lo/(G-1)*ext, to: hi<0? 0 : hi/(G-1)*ext, width: lo<0? 0 : (hi-lo)/(G-1)*ext, ext }; }

/* ---------- placement et maillage ---------- */
const box=new THREE.Box3(), LINE_KEEP=new THREE.LineBasicMaterial({color:0xd27a1c});
export function place(q){ if(!q.group) return;
  const inner=q.group.children[0]; inner.rotation.set(-q.k*Math.PI/2,0,0); q.group.rotation.set(0,q.flip?Math.PI:0,0);
  q.group.position.set(0,0,0); q.group.updateMatrixWorld(true); const b=box.setFromObject(q.mesh);
  q.group.position.set(q.x-b.min.x, TABLE_Y-b.min.y, q.z-b.min.z); outline(q); }
function outline(q){ if(q.line){ pieceRoot.remove(q.line); q.line.geometry.dispose(); q.line=null; }
  const vis=onMachine().filter(x=>x.state==='entry'||x.state==='exit');
  if(vis.length<2||selPiece()!==q) return;
  q.group.updateMatrixWorld(true); const b=box.setFromObject(q.mesh), y=b.max.y+0.001;
  const pts=[[b.min.x,b.min.z],[b.max.x,b.min.z],[b.max.x,b.max.z],[b.min.x,b.max.z],[b.min.x,b.min.z]].map(([x,z])=>new THREE.Vector3(x,y,z));
  q.line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),LINE_KEEP); pieceRoot.add(q.line); }
export function build(q){ dispose(q); if(q.state==='stock') return;
  const mesh=C.pieceMesh(q); mesh.userData.pieceId=q.id;
  const inner=new THREE.Group(); inner.add(mesh); const g=new THREE.Group(); g.add(inner);
  pieceRoot.add(g); q.group=g; q.mesh=mesh; placeAll(); refreshMeshes(); }
function refreshMeshes(){ partMeshes.piece=pieces.filter(x=>x.mesh).flatMap(x=>[x.mesh,...(x.out?[x.out]:[])]); app.stage.dirty(); }
/* positions : la pièce de l'entrée (et celle en passe) contre le demi-guide d'entrée ; à la sortie, la dernière contre le
   demi-guide de sortie, les précédentes rangées devant elle (vers l'opérateur) */
export function placeAll(){ for(const q of pieces){ if(!q.group) continue; if(q.state==='entry'||q.state==='moving'||q.state==='bute') q.z=st.zIn/1000; }
  let z=zOut()/1000; for(const q of exitPieces().slice().reverse()){ q.z=z; z+=appui(q)/1000+0.02; }
  for(const q of pieces) if(q.group) place(q); }

/* dessus et face avant des pièces au droit de x (m), pour les presseurs */
export function topAt(x){ let h=0; for(const q of pieces){ if(!q.group||q.state==='stock'||q.state==='exit') continue; if(x<q.x-0.005||x>q.x+q.L/1000+0.005) continue; h=Math.max(h,haut(q)/1000); } return h; }
export function frontAt(x){ let z=0; for(const q of pieces){ if(!q.group||q.state==='stock'||q.state==='exit') continue; if(x<q.x-0.005||x>q.x+q.L/1000+0.005) continue; z=Math.max(z,q.z+appui(q)/1000); } return z; }

/* ---------- passe ---------- */
const PLANE_IN=new THREE.Plane(new THREE.Vector3(1,0,0),0), PLANE_OUT=new THREE.Plane(new THREE.Vector3(-1,0,0),0);
const clipMats=(mesh,plane)=>{ mesh.material=mesh.material.map(m=>{ const c=m.clone(); c.clippingPlanes=[plane]; return c; }); };
/* engage la pièce de l'entrée. block(q) rend une raison de refuser (blocage), ou ''. Rend un message de refus, ou '' */
export function startPass(block){
  if(cut.inProgress) return '';
  const q=entryPiece(); if(!q) return 'Pas de pièce à l\'entrée : « Reprendre » une pièce dans « Pièces débitées », ou « Ramener la pièce ».';
  if(butePiece()) return 'Une pièce est arrêtée contre le demi-guide de sortie : arrêtez la machine, puis « Dégager la pièce ».';
  const why=block(q); if(why) return why;
  app.recordDangers();                                // faute grave : alerte danger active au moment d'engager la pièce
  const R=predict(q); q.res=R; q.state='moving';
  /* maillages de la passe : pièce entière côté entrée (x > 0), pièce usinée côté sortie (x < 0) */
  build(q); clipMats(q.mesh,PLANE_IN);
  const r=C.makePiece(C.pieceJSON(q)); r.face=JSON.parse(JSON.stringify(q.face)); r.vmark=q.vmark?{...q.vmark}:null; r.k=q.k; r.flip=q.flip; r.cuts=JSON.parse(JSON.stringify(q.cuts||[])); r.log=[];
  applyRes(r, R, R.stopAt);
  const out=C.pieceMesh(r); out.userData.pieceId=q.id; clipMats(out,PLANE_OUT); q.mesh.parent.add(out); q.out=out; refreshMeshes();
  cut.mover=q; cut.inProgress=true; cut.tPrev=null; cut.lastMsg='';
  return ''; }
export const feedSpeed=()=>(st.entr.placed&&st.entr.on? st.entr.v : FEED)/60*SPEEDUP;   // entraîneur : sa vitesse ; sinon avance à la main
/* avance de la pièce ; rend true si quelque chose a bougé */
export function tickPass(now, running){ const dt=Math.min(0.5,now-(cut.tPrev??now)); cut.tPrev=now;
  const q=cut.mover; if(!cut.inProgress||!q) return false;
  if(!running){ return false; }                                      // arbre arrêté (arrêt d'urgence) : la pièce n'avance plus
  const R=q.res, stopX=R.bute? -R.buteAt/1000 : -Infinity;
  q.x=Math.max(stopX, q.x-feedSpeed()*dt);
  placeAll();
  if(R.bute && q.x<=stopX+1e-9){ endBute(q); return true; }
  if(q.x+q.L/1000<=EXIT_X+1e-6) finish(q);
  return true; }
function finish(q){ const R=q.res; applyRes(q,R,1); q.res=null; q.state='exit'; q.x=EXIT_X-q.L/1000; cut.exitOrder=cut.exitOrder.filter(id=>id!==q.id).concat(q.id); cut.sel=q.id; build(q);
  endPass([passMsg(q,R)]); }
function endBute(q){ const R=q.res; applyRes(q,R,R.stopAt); q.res=null; q.state='bute'; build(q);
  endPass([`La pièce bute contre le demi-guide de sortie : il est plus avancé (${fmt(st.e)} mm) que la face usinée (${fmt(R.eNeed)} mm). Arrêtez la machine, attendez l'arrêt de l'arbre, « Dégager la pièce », puis alignez le demi-guide de sortie.`]); }
function passMsg(q,R){ const m=[];
  if(!R.cuts) m.push(tool()? 'L\'outil n\'a pas coupé : ses tranchants tournent à l\'envers (outil monté à l\'envers ou rotation inversée). Il frotte et chauffe : arrêtez, consignez, remontez l\'outil dans le sens de rotation.' : 'Aucun outil sur l\'arbre : rien n\'a été usiné.');
  else if(!R.any) m.push('L\'outil n\'a pas touché la pièce : augmentez la saillie (reculez le guide) ou réglez la hauteur.');
  else { m.push(`Passe terminée sur le ${FACE_NAME[R.f].toLowerCase()} (${fmt(R.depth)} mm enlevés au plus).`);
    if(R.tear) m.push('Arrachements : la pièce est passée contre le fil. Lisez le fil avant d\'usiner (depuis la face usinée, les fibres doivent entrer dans la pièce vers le bout qui passe en premier).');
    if(R.snipe>0) m.push(`Entaille en fin de passe (${fmt(R.snipe)} mm) : toute la rive est usinée et le demi-guide de sortie n'est pas avancé de la profondeur de passe (${fmt(R.eNeed)} mm). La pièce n'est plus soutenue après l'outil.`);
    if(climbing()) m.push('Travail en avalant : dans la réalité, la pièce est arrachée des mains et projetée, les mains sont entraînées vers l\'outil.'); }
  return m.join(' ')+' La pièce est à la sortie : « Ramener la pièce » pour une autre passe, ou « Mettre de côté ».'; }
function endPass(msgs){ cut.inProgress=false; cut.mover=null; cut.passes++; cut.lastMsg=msgs.join(' '); cut.msgSeq++; refreshMeshes(); }

/* ---------- manipulations ---------- */
export function setSel(id){ const q=pieces.find(x=>x.id===id); if(!q||q.state!=='exit') return false; cut.sel=id; placeAll(); return true; }
const toStock=q=>{ q.state='stock'; dispose(q); cut.exitOrder=cut.exitOrder.filter(id=>id!==q.id); if(cut.sel===q.id) cut.sel=null; };
/* ramène la pièce en main de la sortie à l'entrée (la pièce de l'entrée doit être libre) */
export function bringBack(){ if(entryPiece()) return 'Une pièce est déjà à l\'entrée : passez-la, ou mettez-la de côté.';
  const q=selPiece(); if(!q||q.state!=='exit') return 'Aucune pièce à la sortie.';
  q.state='entry'; q.x=LEAD0; cut.exitOrder=cut.exitOrder.filter(id=>id!==q.id); build(q); return ''; }
/* dégage une pièce arrêtée contre le demi-guide de sortie (machine arrêtée) : elle revient à l'entrée */
export function release(){ const q=butePiece(); if(!q) return 'Aucune pièce arrêtée.'; q.state='entry'; q.x=LEAD0; build(q); return ''; }
/* range la pièce en main (entrée, sinon sortie) dans « Pièces débitées » */
export function aside(){ const q=entryPiece()||selPiece(); if(!q) return 'Aucune pièce sur la machine.'; toStock(q); placeAll(); refreshMeshes(); return ''; }
export function take(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(!q||cut.inProgress) return '';
  if(entryPiece()) return 'Une pièce est déjà à l\'entrée : passez-la, ou mettez-la de côté avant d\'en reprendre une autre.';
  if(butePiece()) return 'Dégagez d\'abord la pièce arrêtée contre le demi-guide de sortie.';
  q.state='entry'; q.x=LEAD0; build(q); return ''; }
export function setKind(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(q) q.kind=q.kind==='piece'?'interdite':'piece'; }
export function orient(q,op){ if(op==='rot') q.k+=1; else if(op==='flip') q.k+=2; else if(op==='end') q.flip=!q.flip; build(q); }
