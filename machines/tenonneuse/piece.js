/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Pièces à la tenonneuse : pièces de corroyage (engine/corroyage.js : faces F1/F2/C1/C2, repères SR1/SR2, fil, profils de
   la toupie), posées en travers sur le chariot, la face « down » sur la table du chariot, la face « back » contre le
   pare-éclat du guide (+X). Le bout usiné est A (bout en u = 0) ou B si la pièce est retournée bout pour bout (flip).
   Une pièce qui sort de la raboteuse ou de la toupie arrive telle quelle (newPiece({json:C.pieceJSON(q)})).

   Une passe : le chariot emmène la pièce devant la scie (le bout est coupé au trait de scie, trimEnd), puis devant les
   dérouleurs (joues : tout ce qui est sous la hauteur de la joue, et au-dessus de hInf + épaisseur), puis devant l'unité de
   toupillage (enfourchement : une bande de la hauteur de la fraise). Les usinages sont gardés dans la pièce (q.ends, voir
   corroyage.js) : de d0 à d1 mm depuis le bout, bande [a, b] de la coordonnée locale verticale (w si la pièce est à plat,
   v si elle est sur chant).

   Dans la scène : q.zEnd (mm) = position du bout usiné (le plan d'arasement est en z = 0, le trait de scie en z = −lt).
   États : 'chariot' (sur le chariot), 'stock' (pièces débitées). */
import * as THREE from 'three';
import * as C from '../../engine/corroyage.js';
import { TABLE_Y, C_HOME, C_END, GUIDE_DX, PE_T, X_SAW, X_DER, X_TOU, SPEEDUP, OVER0, CHUTE_MIN, HEADS } from './constants.js';
import { st, tool, ctx, eff } from './state.js';
import { edgesOk } from './tools.js';

const N = C.N, BIGY = 1e7;
export const FACE_NAME = C.FACE_NAME;
let app=null, pieceRoot=null, partMeshes=null, uid=0;
let peRoot=null;
export function initPieces(a, model){ app=a; pieceRoot=model.pieceRoot; peRoot=model.peG; partMeshes=a.parts.partMeshes; }

/* ---------- pare-éclat : martyr en hêtre vissé contre le guide, au ras du trait de scie, usiné par les outils exactement
   comme la pièce (même calcul de passe, mêmes bouts usinés) ; le chariot le porte, son bout usiné est A (vers les outils) ---------- */
export const pe={ q:null, mesh:null };
export function peRenew(){ const q=C.makePiece({L:Math.round(150+st.lt), W:PE_T, T:35, wood:'hetre', rough:0, seed:3});
  for(const f of C.RING) q.face[f].passes=1;
  q.zEnd=-st.lt; pe.q=q; peBuild(); }
/* pare-éclat usiné avec les réglages de départ (machine laissée par un autre groupe) */
export function peMachineAll(){ peRenew(); const R=predict(pe.q,false); if(R.chute>0){ C.trimEnd(pe.q,'A',R.chute); pe.q.zEnd=R.zEnd; }
  const E=C.endRec(pe.q,'A'); for(const c of R.cuts){ const {h,...k}=c; E.cuts.push(k); } peBuild(); }
export function peBuild(){ if(pe.mesh){ peRoot.remove(pe.mesh.parent.parent); pe.mesh.geometry.dispose(); pe.mesh=null; } partMeshes.pare_eclat=[];
  if(!pe.q) return; const mesh=C.pieceMesh(pe.q); mesh.userData.part='pare_eclat';
  const inner=new THREE.Group(); inner.add(mesh); const g=new THREE.Group(); g.add(inner); g.rotation.set(0,-Math.PI/2,0); peRoot.add(g);
  g.updateMatrixWorld(true); const b=new THREE.Box3().setFromObject(mesh), p=new THREE.Vector3(); g.getWorldPosition(p);
  // position dans le repère du chariot : contre le guide, sur la table, bout usiné en zEnd
  const ox=b.max.x-p.x, oy=b.min.y-p.y, oz=b.min.z-p.z; g.position.set(GUIDE_DX-ox, TABLE_Y-oy, pe.q.zEnd/1000-oz);
  g.visible=st.pe.on; if(!st.pe.on) g.position.y-=2;          // retiré : rangé (le Raycaster ignore « visible »)
  pe.mesh=mesh; partMeshes.pare_eclat=[mesh]; app.stage.dirty(); }

/* ---------- état ---------- */
export const pieces=[];
export const cut={ inProgress:false, phase:'idle', mover:null, res:null, done:{}, lastMsg:'', msgSeq:0, tPrev:null, chutes:0, passes:0 };
export const chariotPiece=()=>pieces.find(q=>q.state==='chariot')||null;
export const atHome=()=>Math.abs(st.cx-C_HOME)<1e-4;
export const endName=q=>q.flip?'B':'A';
export const farName=q=>q.flip?'A':'B';

/* ---------- création ---------- */
/* spec : pièce de corroyage (C.makePiece) ou {json} (pièce venue d'une autre machine), plus { name, dress:{s1,s2},
   lar, ep (pièce corroyée), state:'chariot'|'stock', k, flip } */
export function newPiece(spec){
  const base=spec.json? C.makePiece(spec.json) : C.makePiece(spec);
  const q={ ...base, id:++uid, name:spec.name||'Pièce', state:spec.state||'chariot', kind:'piece', zEnd:0, group:null, mesh:null, line:null, log:[] };
  if(!spec.json){
    if(spec.dress) C.dresseSR(q,spec.dress);
    if(spec.lar){ C.rabote(q,'C1',spec.lar); Object.assign(q.face.C2,{passes:1,rab:true,full:true,angle:{ref:'F1',deg:90}}); }
    if(spec.ep){ C.rabote(q,'F1',spec.ep); Object.assign(q.face.F2,{passes:1,rab:true,full:true}); }
    if(spec.morts) q.morts=spec.morts(q);      // pièce déjà mortaisée (montant venu de la mortaiseuse)
    q.k=spec.k||0; q.flip=!!spec.flip; }
  pieces.push(q);
  if(q.state==='chariot'){ placeDefault(q); build(q); }
  return q; }
export function clearPieces(){ for(const q of pieces) dispose(q); pieces.length=0; partMeshes.piece=[];
  Object.assign(cut,{inProgress:false,phase:'idle',mover:null,res:null,done:{},chutes:0,passes:0}); }
function dispose(q){ if(q.group){ pieceRoot.remove(q.group); q.group.traverse(o=>o.geometry?.dispose()); q.group=null; q.mesh=null; }
  if(q.line){ pieceRoot.remove(q.line); q.line.geometry.dispose(); q.line=null; } }

/* ---------- mesures ---------- */
export const H=q=>C.heightMm(q);                 // hauteur de la pièce posée sur le chariot
export const D=q=>C.depthMm(q);                  // largeur d'appui contre le guide (le long de X)
export const sr1=q=>['F1','F2'].find(f=>q.face[f].mark==='loop')||null;
export const sr2=q=>{ const s=sr1(q); return s? ['C1','C2'].find(f=>q.face[f].mark==='v'&&q.face[f].markRef===s)||null : null; };
export const fmt=(v,n=1)=>(+v).toLocaleString('fr-FR',{minimumFractionDigits:n,maximumFractionDigits:n});
export const dims=q=>`${fmt(q.L,0)} × ${fmt(Math.min(...C.widthProf(q)))} × ${fmt(Math.min(...C.thickProf(q)))}`;
const tenoned=q=>C.hasEnds(q);

/* axe local vertical de la pièce posée : y (mm au-dessus du chariot) → coordonnée locale */
/* (cotes prises sur la section du bout usiné : la joue est réglée depuis la face posée, au droit de l'outil) */
export function vmap(q){ const dn=C.faces(q).down, i= endName(q)==='A'? 0 : N-1;
  const wmin=q.w1[i], wmax=q.w2[i], vmin=q.v1[i], vmax=q.v2[i];
  if(dn==='F1') return {ax:'w', f:y=>wmin+y};
  if(dn==='F2') return {ax:'w', f:y=>wmax-y};
  if(dn==='C1') return {ax:'v', f:y=>vmin+y};
  return {ax:'v', f:y=>vmax-y}; }
const band=(q,y0,y1)=>{ const m=vmap(q), a=m.f(y0), b=m.f(y1); return {ax:m.ax, a:Math.min(a,b), b:Math.max(a,b)}; };

/* ---------- position de la pièce sur le chariot ---------- */
/* arasement du bout opposé côté chariot (là où vient la butée) : distance au bout (0 : la butée touche le bout) */
export function farShoulder(q){ const R=q.ends&&q.ends[farName(q)]; if(!R) return 0; const m=vmap(q), y0=m.f(0.5);
  let d=0; for(const c of R.cuts) if(c.ax===m.ax && c.d0<0.5 && y0>c.a && y0<c.b) d=Math.max(d,c.d1); return d; }
/* position du bout usiné quand la pièce touche la butée (mm) */
export const zContact=q=>st.but-q.L+farShoulder(q);
export const butGap=q=>st.butOn? zContact(q)-q.zEnd : null;
export function setZ(q,z){ q.zEnd= st.butOn? Math.min(z, zContact(q)) : z; }
export function placeDefault(q){ setZ(q, -st.lt-OVER0); }
export const overhang=q=>-st.lt-q.zEnd;          // dépassement au-delà du trait de scie (mm)

/* ---------- passe : ce que fera chaque arbre ---------- */
const turning=h=>st.run[h] && !!ctx.model && ctx.model.spin[h]>0.9;
export const cutsH=(h,live)=>{ const t=tool(h); return !!t && edgesOk(t,st.flips[h],h) && (!live || turning(h)); };
/* clé des réglages : le pare-éclat usiné avec d'autres réglages ne soutient plus la sortie des outils */
export const peKey=()=>JSON.stringify([st.lt,st.hInf,st.ep,st.dec,st.ht,st.pt,HEADS.map(h=>[st.tools[h],st.flips[h],cutsH(h,false)])]);
/* résultat d'une passe de la pièce q (null : passe à vide). live : seuls les arbres en marche coupent ; sinon tous les
   outils montés dans le bon sens. touch : arbres dont l'outil toucherait la pièce (même arrêté). */
export function predict(q, live){
  const R={ zEnd0:q?q.zEnd:null, zEnd:q?q.zEnd:null, chute:0, cuts:[], touch:[], ec:false, depth:{inf:0,sup:0}, inc:[] };
  if(!q) return R;
  const Hp=H(q); let z=q.zEnd;
  // scie d'affranchissement : coupe au trait de scie
  if(z < -st.lt-0.01){ R.touch.push('scie'); if(cutsH('scie',live)){ R.chute=-st.lt-z; z=-st.lt; } }
  R.zEnd=z;
  if(z<0){
    const ti=tool('inf'), ts=tool('sup'), tt=tool('tou');
    // dérouleur inférieur : joue du dessous, jusqu'à hInf au-dessus du chariot, de son arasement (z = 0) sur Lc
    const hI=eff('hInf'), eP=eff('ep'), hT=eff('ht');
    if(ti && hI>0.05){ const d1=-z, d0=Math.max(0,-ti.Lc-z); if(d1-d0>0.01){ R.touch.push('inf');
      if(cutsH('inf',live)){ R.cuts.push({h:'inf', d0, d1, ...band(q,-BIGY,hI), k:'joue'}); R.depth.inf=Math.min(hI,Hp); if(d0>0) R.inc.push('inf'); } } }
    // dérouleur supérieur : joue du dessus, au-dessus de hInf + épaisseur, arasement décalé de dec vers le bout
    const ys=hI+eP;
    if(ts && ys<Hp-0.05){ const za=-st.dec, d1=za-z, d0=Math.max(0,(za-ts.Lc)-z); if(d1-d0>0.01){ R.touch.push('sup');
      if(cutsH('sup',live)){ R.cuts.push({h:'sup', d0, d1, ...band(q,ys,BIGY), k:'joue'}); R.depth.sup=Hp-Math.max(0,ys); if(d0>0) R.inc.push('sup'); } } }
    // unité de toupillage : fraise disque, bande [ht, ht + e], jusqu'à pt au-delà du trait de scie
    if(tt && hT<Hp-0.05 && hT+tt.Lc>0.05){ const zf=-st.lt+st.pt, d1=zf-z; if(d1>0.01){ R.touch.push('tou');
      if(cutsH('tou',live)) R.cuts.push({h:'tou', d0:0, d1, ...band(q,hT,hT+tt.Lc), k:'enf'}); } }
  }
  R.ec= R.cuts.length>0 && !(st.pe.on && (st.pe.key===null || st.pe.key===peKey()));
  return R; }

/* ---------- bouts usinés : lecture (contrôle au pied à coulisse, au réglet) ---------- */
/* pour le bout e : tenon (épaisseur, position depuis chaque face, longueurs des joues), enfourchement ou joue seule */
export function endInfo(q,e){ const R=q.ends&&q.ends[e]; if(!R||!R.cuts.length) return null;
  const i= e==='A'? 0 : N-1, ext={ w:[q.w1[i],q.w2[i]], v:[q.v1[i],q.v2[i]] }, out={ e, ec:!!R.ec, items:[] };
  for(const ax of ['w','v']){ const cs=R.cuts.filter(c=>c.ax===ax && c.d0<0.5); if(!cs.length) continue; const [lo,hi]=ext[ax];
    const rem=cs.map(c=>({a:Math.max(lo,c.a), b:Math.min(hi,c.b), c})).filter(r=>r.b>r.a+1e-6).sort((x,y)=>x.a-y.a);
    const kept=[]; let p=lo; for(const r of rem){ if(r.a>p+1e-6) kept.push([p,r.a]); p=Math.max(p,r.b); } if(hi>p+1e-6) kept.push([p,hi]);
    const low=rem.find(r=>r.a<=lo+1e-6), high=rem.find(r=>r.b>=hi-1e-6), mid=rem.find(r=>r.a>lo+1e-6&&r.b<hi-1e-6);
    if(!kept.length){ out.items.push({type:'coupe', ax}); continue; }
    if(mid && kept.length>=2){ out.items.push({type:'enf', ax, width:mid.b-mid.a, fromLo:mid.a-lo, fromHi:hi-mid.b, depth:mid.c.d1}); }
    if(low||high){ const k=kept.find(x=>x[0]>=lo-1e-6&&x[1]<=hi+1e-6&&(!low||x[0]>=low.b-1e-6)&&(!high||x[1]<=high.a+1e-6))||kept[0];
      out.items.push({type: low&&high? 'tenon' : 'joue', ax, th:k[1]-k[0], fromLo:k[0]-lo, fromHi:hi-k[1], lenLo:low?low.c.d1:0, lenHi:high?high.c.d1:0, inc:!!((low&&low.c.d0>0.05)||(high&&high.c.d0>0.05))}); } }
  return out; }
/* distance du tenon (ou de l'enfourchement) à la face de référence f (SR1 ou SR2) : f côté bas (F1 / C1) ou haut */
export const fromFace=(it,f)=> (f==='F1'||f==='C1')? it.fromLo : it.fromHi;
/* longueur de la joue côté face f (arasement de ce côté) */
export const lenFace=(it,f)=> (f==='F1'||f==='C1')? it.lenLo : it.lenHi;
/* longueur entre arasements (côté SR1), tenons aux deux bouts */
export function betweenShoulders(q){ const s=sr1(q)||'F1', a=endInfo(q,'A'), b=endInfo(q,'B'); if(!a||!b) return null;
  const ta=a.items.find(x=>x.type==='tenon'&&x.ax==='w'), tb=b.items.find(x=>x.type==='tenon'&&x.ax==='w'); if(!ta||!tb) return null;
  return q.L-lenFace(ta,s)-lenFace(tb,s); }

/* ---------- placement et maillage ---------- */
const box=new THREE.Box3(), LINE_KEEP=new THREE.LineBasicMaterial({color:0xd27a1c});
export function place(q){ if(!q.group) return;
  const inner=q.group.children[0]; inner.rotation.set(-q.k*Math.PI/2,0,0); q.group.rotation.set(0,q.flip?Math.PI/2:-Math.PI/2,0);
  q.group.position.set(0,0,0); q.group.updateMatrixWorld(true); const b=box.setFromObject(q.mesh);
  q.group.position.set(st.cx+GUIDE_DX-PE_T/1000-b.max.x, TABLE_Y-b.min.y, q.zEnd/1000-b.min.z); outline(q); }
/* contour orange : la pièce en main, sur le chariot */
function outline(q){ q.group.updateMatrixWorld(true); const b=box.setFromObject(q.mesh), y=b.max.y+0.001;
  const pts=[[b.min.x,b.min.z],[b.max.x,b.min.z],[b.max.x,b.max.z],[b.min.x,b.max.z],[b.min.x,b.min.z]].map(([x,z])=>new THREE.Vector3(x,y,z));
  if(!q.line){ q.line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),LINE_KEEP); pieceRoot.add(q.line); }
  else { q.line.geometry.setFromPoints(pts); } }
export function build(q){ dispose(q); if(q.state==='stock') return;
  const mesh=C.pieceMesh(q); mesh.userData.pieceId=q.id;
  const inner=new THREE.Group(); inner.add(mesh); const g=new THREE.Group(); g.add(inner);
  pieceRoot.add(g); q.group=g; q.mesh=mesh; place(q); refreshMeshes(); }
function refreshMeshes(){ partMeshes.piece=pieces.filter(x=>x.mesh).map(x=>x.mesh); app.stage.dirty(); }
export function placeAll(){ for(const q of pieces) if(q.group) place(q); }
/* dessus de la pièce sur le chariot (m au-dessus du chariot) et sa face avant (x), pour la presse */
export const pieceTop=()=>{ const q=chariotPiece(); return q? H(q)/1000 : 0; };

/* ---------- passe ---------- */
/* pousse le chariot. block() rend une raison de refuser (blocage), ou ''. Rend un message de refus, ou '' */
export function startPass(block){
  if(cut.inProgress) return '';
  const q=chariotPiece(), why=block(q); if(why) return why;
  app.recordDangers();                       // faute grave : alerte danger active au moment de pousser le chariot
  cut.res=predict(q,true); cut.mover=q; cut.done={}; cut.inProgress=true; cut.phase='push'; cut.tPrev=null; cut.lastMsg='';
  cut.peBefore=st.pe.key; cut.peKeyNow=peKey(); cut.peRes= st.pe.on&&pe.q? predict(pe.q,true) : null; cut.peDone={};
  if(q) q.log.push({ e:endName(q), down:C.faces(q).down, back:C.faces(q).back, av:st.av, presse:st.presse, chute:0, cuts:[], ec:false,
    tools:Object.fromEntries(HEADS.filter(h=>cut.res.touch.includes(h)).map(h=>[h,st.tools[h]])), done:false });
  return ''; }
const center=q=>st.cx+GUIDE_DX-PE_T/1000-(q?D(q):0)/2000;
/* avance du chariot ; rend true si quelque chose a bougé */
export function tickPass(now, ok){ const dt=Math.min(0.5,now-(cut.tPrev??now)); cut.tPrev=now;
  if(cut.phase==='return'){ st.cx=Math.min(C_HOME, st.cx+0.9*dt); if(st.cx>=C_HOME-1e-6){ st.cx=C_HOME; cut.phase='idle'; } placeAll(); return true; }
  if(cut.phase!=='push') return false;
  if(!ok()){ halt(); return true; }          // un arbre utile s'arrête (arrêt d'urgence, filin) : on n'avance plus
  st.cx=Math.max(C_END, st.cx-st.av/60*SPEEDUP*dt);
  const q=cut.mover, R=cut.res, x=center(q);
  if(cut.peRes){ const P=cut.peRes, xp=st.cx+GUIDE_DX-PE_T/2000;     // le pare-éclat passe devant les outils avec la pièce
    if(!cut.peDone.scie && xp<=X_SAW){ cut.peDone.scie=true; if(P.chute>0){ C.trimEnd(pe.q,'A',P.chute); pe.q.zEnd=P.zEnd; peBuild(); } }
    if(!cut.peDone.der && xp<=X_DER){ cut.peDone.der=true; peCuts(P,['inf','sup']); }
    if(!cut.peDone.tou && xp<=X_TOU){ cut.peDone.tou=true; peCuts(P,['tou']); } }
  if(q){
    if(!cut.done.scie && x<=X_SAW){ cut.done.scie=true; if(R.chute>0){ C.trimEnd(q,endName(q),R.chute); q.zEnd=R.zEnd; cut.chutes++; last(q).chute=R.chute; if(R.chute<CHUTE_MIN) st.wedge=true; build(q); } }
    if(!cut.done.der && x<=X_DER){ cut.done.der=true; applyCuts(q,R,['inf','sup']); }
    if(!cut.done.tou && x<=X_TOU){ cut.done.tou=true; applyCuts(q,R,['tou']); } }
  placeAll();
  if(st.cx<=C_END+1e-6) finish();
  return true; }
const last=q=>q.log[q.log.length-1];
/* bruit (engine/audio.js) : quels outils sont dans le bois pendant la poussée du chariot (0 / 1 par outil) ; la pièce, large de D(q)
   le long de X, coupe tant qu'elle est devant l'outil (demi-corde proposée : scie Ø 400 ≈ 120 mm, dérouleurs ≈ 70 mm, toupillage ≈ 90 mm) */
export function bruitCoupe(){ const out={ scie:0, inf:0, sup:0, tou:0 }, q=cut.mover, R=cut.res; if(cut.phase!=='push'||!q||!R) return out;
  const x=center(q), w=D(q)/2000, near=(X,r)=>Math.abs(x-X)<w+r;
  out.scie= R.chute>0 && near(X_SAW,0.12)? 1 : 0;
  for(const h of ['inf','sup']) out[h]= R.cuts.some(c=>c.h===h) && near(X_DER,0.07)? 1 : 0;
  out.tou= R.cuts.some(c=>c.h==='tou') && near(X_TOU,0.09)? 1 : 0;
  return out; }
function peCuts(P,hs){ const cs=P.cuts.filter(c=>hs.includes(c.h)); if(!cs.length) return; const E=C.endRec(pe.q,'A'); for(const c of cs){ const {h,...k}=c; E.cuts.push(k); } peBuild(); }
function applyCuts(q,R,hs){ const cs=R.cuts.filter(c=>hs.includes(c.h)); if(!cs.length) return; const E=C.endRec(q,endName(q));
  for(const c of cs){ const {h,...k}=c; E.cuts.push(k); last(q).cuts.push(h); } if(R.ec){ E.ec=true; last(q).ec=true; } build(q); }
function finish(){ const q=cut.mover, R=cut.res; cut.phase='end'; cut.inProgress=false;
  // le pare-éclat est usiné par la passe (avec ou sans pièce) : il soutient désormais la sortie des outils avec ces réglages
  if(st.pe.on && HEADS.some(h=>h!=='scie'&&cutsH(h,true))) st.pe.key=cut.peKeyNow;
  if(q) last(q).done=true;
  cut.passes++; cut.mover=null; cut.lastMsg=passMsg(q,R); cut.msgSeq++; refreshMeshes(); }
function halt(){ const q=cut.mover; cut.phase='halted'; cut.inProgress=false; cut.mover=null;
  cut.lastMsg='Passe interrompue : un arbre s\'est arrêté. Ramenez le chariot en position de chargement, contrôlez la pièce, puis repassez.'+(q?'':''); cut.msgSeq++; }
function passMsg(q,R){ const m=[];
  if(!q){ m.push(st.pe.on? 'Passe à vide : le pare-éclat est usiné aux réglages en cours.' : 'Passe à vide (pas de pièce sur le chariot).'); }
  else {
    const wrong=HEADS.filter(h=>R.touch.includes(h)&&tool(h)&&!edgesOk(tool(h),st.flips[h],h));
    if(wrong.length) m.push(`Les tranchants de ${wrong.map(h=>h==='scie'?'la scie':h==='tou'?'l\'unité de toupillage':'du dérouleur '+(h==='sup'?'supérieur':'inférieur')).join(' et ')} tournent à l'envers : l'outil frotte et chauffe, il n'usine pas. Arrêtez, consignez, montez un outil adapté au sens de l'arbre.`);
    if(R.chute>0) m.push(`Bout affranchi : chute de ${fmt(R.chute)} mm.`);
    if(R.cuts.length) m.push(`Bout usiné : ${R.cuts.map(c=>c.h==='inf'?'joue du dessous':c.h==='sup'?'joue du dessus':'enfourchement').join(', ')}.`);
    else if(!R.chute) m.push('Aucun outil n\'a touché la pièce.');
    if(R.inc.length) m.push('Joue incomplète : le tenon est plus long que la longueur de coupe du dérouleur, le bout n\'est pas usiné.');
    if(R.ec) m.push('Éclats sur l\'arête côté guide, à la sortie des outils : le pare-éclat n\'était pas en place ou pas usiné aux réglages en cours.');
    if(R.chute>0 && R.chute<CHUTE_MIN) m.push(`Chute très fine (${fmt(R.chute)} mm) : elle s'est coincée près de la lame. Arrêtez la scie, attendez l'arrêt, ouvrez le capot pour la retirer.`); }
  return m.join(' ')+' Ramenez le chariot en position de chargement.'; }
export function returnChariot(){ if(cut.inProgress) return 'Passe en cours.'; if(atHome()) return 'Le chariot est déjà en position de chargement.';
  cut.phase='return'; cut.tPrev=null; st.lockC=false; return ''; }

/* ---------- manipulations (chariot en position de chargement) ---------- */
const toStock=q=>{ q.state='stock'; dispose(q); };
export function aside(){ const q=chariotPiece(); if(!q) return 'Aucune pièce sur le chariot.'; toStock(q); refreshMeshes(); return ''; }
export function take(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(!q||cut.inProgress) return '';
  if(chariotPiece()) return 'Une pièce est déjà sur le chariot : usinez-la, ou mettez-la de côté avant d\'en reprendre une autre.';
  q.state='chariot'; placeDefault(q); build(q); return ''; }
export function setKind(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(q) q.kind=q.kind==='piece'?'interdite':'piece'; }
export function orient(q,op){ if(op==='rot') q.k+=1; else if(op==='flip') q.k+=2; else if(op==='end') q.flip=!q.flip; placeDefault(q); build(q); }
