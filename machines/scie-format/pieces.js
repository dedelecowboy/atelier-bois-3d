/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Pièces sur le chariot : géométrie (polygones convexes en coordonnées locales u, v avec theta, flip, tx, tz),
   maillages, découpe à la lame, cycle de coupe, manipulation par l'élève, pièces débitées.
   Règles validées : aller seulement ; chute évacuée avant le retour du chariot (tous les modes) ;
   au retour, la pièce revient côté chariot ; la pièce gardée est celle entourée en orange. */
import * as THREE from 'three';
import { canvasTex, woodTex, v3 } from '../../engine/kit.js';
import { centroid, area, clipHalf, zAt, outwardNormal, obb } from '../../engine/poly.js';
import { TABLE_Y, BLADE_Z, R, KERF, MAIN_KERF, SLIDER_HOME, SABOT_FACE, SABOT_Z0, FENCE_FACE, PIECE_Y } from './constants.js';
import { st, guideFace, stopFace, fenceN, fenceD, fenceDist, fenceT, stopT, kerfZ, $ } from './state.js';

let app=null, pieceRoot=null, partMeshes=null;
export function initPieces(a, model){ app=a; pieceRoot=model.pieceRoot; partMeshes=a.parts.partMeshes;
  document.getElementById('debit').addEventListener('click',e=>{ const b=e.target.closest('button[data-d]'); if(!b) return; const id=+b.dataset.id;
    if(b.dataset.d==='kind'){ const it=debit.find(d=>d.id===id); if(it){ it.kind=it.kind==='piece'?'chute':'piece'; debitKey=''; renderDebit(); } } else takeBack(id); });
}

/* plans de coupe : la partie déjà sciée disparaît dans le trait */
const cutPlanes=[new THREE.Plane(),new THREE.Plane(),new THREE.Plane(),new THREE.Plane()];
const clipOpts={clippingPlanes:cutPlanes,clipIntersection:true,clipShadows:true,side:THREE.DoubleSide};

const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let pieces=[], pieceSeq=0, activeId=null, cutLetter=0;
/* Nom du nouveau chant scié. Exercice guidé : la lettre est fixée par l'étape (coupe d'essai ou reprise = même lettre),
   l'ancien chant qui portait cette lettre est renommé X, Y, Z… ; coupe faite avant l'étape prévue = lettre de la prochaine coupe. */
const EXTRA='XYZWVUTS';
function nextCutLetter(){ const {free,step,STEPS}=app.ex;
  if(free) return LETTERS[cutLetter++%26];
  let L=null; for(let i=step;i<STEPS.length&&!L;i++) L=STEPS[i].cut||null;
  if(!L) return EXTRA[cutLetter++%EXTRA.length];
  if(pieces.some(q=>q.meta.some(m=>m.label===L))){ const X=EXTRA[cutLetter++%EXTRA.length]; for(const q of pieces) for(const m of q.meta) if(m.label===L) m.label=X; }
  return L; }
const cut={max:null, blocked:'', inProgress:false, letter:'A', needEvac:false, relocated:false}; let lastS=1450;
const A=()=>pieces.find(p=>p.id===activeId);

/* --- textures --- */
const TEX={};
function texFor(kind){ if(TEX[kind]) return TEX[kind]; let top, side;
  if(kind==='oak'||kind==='plank'){ top=woodTex(); top.wrapS=top.wrapT=THREE.RepeatWrapping; top.repeat.set(1/0.32,1/1.2); if(kind==='plank') top.rotation=Math.PI/2;
    side=canvasTex(256,64,(g,w,h)=>{ g.fillStyle='#b98a52'; g.fillRect(0,0,w,h); for(let i=0;i<40;i++){ g.fillStyle=`rgba(110,70,35,${Math.random()*0.3})`; g.fillRect(0,Math.random()*h,w,1);} });
    side.wrapS=side.wrapT=THREE.RepeatWrapping; side.repeat.set(4,40); }
  else { top=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#f1f0ea'; g.fillRect(0,0,w,h); for(let i=0;i<3000;i++){ g.fillStyle=`rgba(120,120,110,${Math.random()*0.07})`; g.fillRect(Math.random()*w,Math.random()*h,2,2);} });
    top.wrapS=top.wrapT=THREE.RepeatWrapping; top.repeat.set(2,2);
    side=canvasTex(256,64,(g,w,h)=>{ g.fillStyle='#cfae7c'; g.fillRect(0,0,w,h); for(let i=0;i<2500;i++){ const c=150+Math.random()*80|0; g.fillStyle=`rgb(${c},${c*0.8|0},${c*0.55|0})`; g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1+Math.random()*2);} g.fillStyle='#f1f0ea'; g.fillRect(0,0,w,4); g.fillRect(0,h-4,w,4); });
    side.wrapS=side.wrapT=THREE.RepeatWrapping; side.repeat.set(8,52); }
  return TEX[kind]={ cap:new THREE.MeshStandardMaterial({map:top,roughness:kind==='mela'?0.35:0.72,...clipOpts}), side:new THREE.MeshStandardMaterial({map:side,roughness:0.85,...clipOpts}) }; }
const labelMats={};
function labelMat(txt,sawn){ const k=txt+'|'+sawn; if(labelMats[k]) return labelMats[k];
  const t=canvasTex(64,64,(g)=>{ g.fillStyle=sawn?'#2f8a52':'#50565c'; g.beginPath(); g.arc(32,32,29,0,7); g.fill(); g.fillStyle='#fff'; g.font='bold 34px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,32,34); });
  return labelMats[k]=new THREE.SpriteMaterial({map:t}); }
const barkTex=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#5b3d24'; g.fillRect(0,0,w,h); for(let i=0;i<900;i++){ g.fillStyle=`rgba(${30+Math.random()*60|0},${20+Math.random()*30|0},10,${0.3+Math.random()*0.5})`; g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,4+Math.random()*16);} for(let i=0;i<200;i++){ g.fillStyle='rgba(170,130,85,.35)'; g.fillRect(Math.random()*w,Math.random()*h,1,6+Math.random()*10);} });
barkTex.wrapS=barkTex.wrapT=THREE.RepeatWrapping; barkTex.repeat.set(8,8);
const MAT_BARK=new THREE.MeshStandardMaterial({map:barkTex,roughness:0.95,polygonOffset:true,polygonOffsetFactor:-2,...clipOpts});
const chipTex=canvasTex(512,32,(g,w,h)=>{ g.clearRect(0,0,w,h); for(let i=0;i<90;i++){ const x=Math.random()*w, cw=3+Math.random()*12, ch=4+Math.random()*(h-6);
  g.fillStyle=['#a8835a','#c49a6a','#8a6a48'][i%3]; g.beginPath(); g.moveTo(x,h); g.lineTo(x+cw,h); g.lineTo(x+cw*0.6,h-ch); g.lineTo(x+cw*0.25,h-ch*0.7); g.closePath(); g.fill(); } }); // base droite sur l'arête, pointes vers l'intérieur
chipTex.wrapS=THREE.RepeatWrapping;
const MAT_CHIPS=new THREE.MeshStandardMaterial({map:chipTex,transparent:true,roughness:0.9,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,...clipOpts});
const LINE_LASER=new THREE.LineBasicMaterial({color:0xff2020});
const LINE_SAWN=new THREE.LineBasicMaterial({color:0x2f9a4e}), LINE_ACTIVE=new THREE.LineBasicMaterial({color:0xd27a1c});

/* --- géométrie 2D (repère chariot : x = sens d'avance, z = travers) ---
   p.pts = contour de la face A (posée sur la table si la pièce n'est pas retournée). Un chant scié lame inclinée porte
   meta.bev : décalage (m) de son arête sur la face B par rapport à la face A, vers l'intérieur (> 0) ou l'extérieur (< 0),
   et meta.ang : inclinaison de la lame (°). Le contour de la face B s'en déduit (topPts). */
function toSlider(p,q){ const c=Math.cos(p.theta), s=Math.sin(p.theta), u=q[0], v=p.flip?-q[1]:q[1]; return [p.tx+c*u-s*v, p.tz+s*u+c*v]; }
function toLocal(p,w){ const c=Math.cos(p.theta), s=Math.sin(p.theta), dx=w[0]-p.tx, dz=w[1]-p.tz; const u=c*dx+s*dz, v=-s*dx+c*dz; return [u, p.flip?-v:v]; }
const sPts=p=>p.pts.map(q=>toSlider(p,q));
/* contour de la face B : chaque chant décalé de son biseau, sommets = intersections des chants voisins */
function topPts(p){ const P=p.pts, n=P.length; if(!p.meta.some(m=>m.bev)) return P; const C=centroid(P), L=[];
  for(let i=0;i<n;i++){ const a=P[i], b=P[(i+1)%n], dx=b[0]-a[0], dz=b[1]-a[1], l=Math.hypot(dx,dz)||1; let nx=-dz/l, nz=dx/l;
    if((C[0]-a[0])*nx+(C[1]-a[1])*nz<0){ nx=-nx; nz=-nz; } const d=p.meta[i].bev||0; L.push({p:[a[0]+nx*d,a[1]+nz*d], v:[dx/l,dz/l]}); }
  return P.map((q,i)=>{ const A1=L[(i-1+n)%n], B1=L[i], den=A1.v[0]*B1.v[1]-A1.v[1]*B1.v[0];
    if(Math.abs(den)<1e-9) return B1.p; const t=((B1.p[0]-A1.p[0])*B1.v[1]-(B1.p[1]-A1.p[1])*B1.v[0])/den; return [A1.p[0]+A1.v[0]*t, A1.p[1]+A1.v[1]*t]; }); }
const sTop=p=>topPts(p).map(q=>toSlider(p,q));
/* tous les sommets des deux faces (appuis contre la règle, le guide, la butée, le sabot) */
const sAll=p=>[...sPts(p),...sTop(p)];
/* hauteur (scène) des faces A et B */
const faceY=p=>({A:PIECE_Y+(p.flip?p.T:0), B:PIECE_Y+(p.flip?0:p.T)});
function bandRange(p){ const fy=faceY(p); let lo=1e9, hi=-1e9;
  for(const [S,y] of [[sPts(p),fy.A],[sTop(p),fy.B]]){ const z0=kerfZ(y,-1), z1=kerfZ(y,1);
    let [P]=clipHalf(S,S.map(()=>null),q=>q[1]>=z0,(a,b)=>zAt(a,b,z0),null); if(P.length<3) continue;
    [P]=clipHalf(P,P.map(()=>null),q=>q[1]<=z1,(a,b)=>zAt(a,b,z1),null); if(P.length<3) continue;
    for(const q of P){ lo=Math.min(lo,q[0]); hi=Math.max(hi,q[0]); } }
  return hi>lo? {minX:lo, maxX:hi} : null; }
/* --- construction des maillages --- */
function disposePiece(p){ if(!p.group) return; pieceRoot.remove(p.group); p.group.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); partMeshes.piece=partMeshes.piece.filter(m=>m!==p.mesh); p.group=null; }
function buildPiece(p){ disposePiece(p);
  const g=prismGeom(p.pts, topPts(p), p.T);
  const m=texFor(p.kind), mesh=new THREE.Mesh(g,[m.cap,m.side]);
  mesh.castShadow=mesh.receiveShadow=true; mesh.userData.part='piece'; mesh.userData.pieceId=p.id;
  const outer=new THREE.Group(), inner=new THREE.Group(); outer.add(inner); inner.add(mesh);
  inner.rotation.x=p.flip?Math.PI:0; inner.position.y=p.flip?p.T:0;
  const yt=p.flip?-0.0015:p.T+0.0015, yl=p.flip?-0.016:p.T+0.016, n=p.pts.length, C=centroid(p.pts), Q=topPts(p), VIS=p.flip?p.pts:Q;   // VIS : face visible du dessus
  const longest={}; for(let i=0;i<n;i++){ const k=p.meta[i].label+'|'+p.meta[i].sawn, L=segLen(p,i); if(!longest[k]||L>longest[k].L) longest[k]={i,L}; }
  p.meta.forEach((md,i)=>{ if(!md.chips) return; for(const face of ['recto','verso']){ if(!md.chips[face]) continue;
      const F=face==='recto'?Q:p.pts, a=F[i], b=F[(i+1)%n], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<0.01) continue; let nx=-(b[1]-a[1])/L, nz=(b[0]-a[0])/L; const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2; if((C[0]-mx)*nx+(C[1]-mz)*nz<0){ nx=-nx; nz=-nz; }
      const w=0.012, gq=new THREE.BufferGeometry(); const y=face==='recto'?p.T+0.0007:-0.0007;
      gq.setAttribute('position',new THREE.Float32BufferAttribute([a[0],y,a[1], b[0],y,b[1], b[0]+nx*w,y,b[1]+nz*w, a[0]+nx*w,y,a[1]+nz*w],3));
      gq.setAttribute('uv',new THREE.Float32BufferAttribute([0,0, L*12,0, L*12,1, 0,1],2)); gq.setIndex([0,1,2,0,2,3]); gq.computeVertexNormals();
      inner.add(new THREE.Mesh(gq,MAT_CHIPS)); } });
  for(const b of (p.bands||[])){ const g2=new THREE.ShapeGeometry(new THREE.Shape(b.pts.map(q=>new THREE.Vector2(q[0],-q[1])))); g2.rotateX(-Math.PI/2);
    const bm=new THREE.Mesh(g2,MAT_BARK); bm.position.y=p.T+0.0006; bm.receiveShadow=true; inner.add(bm); }
  { const S=sPts(p), xs=[]; for(let i=0;i<S.length;i++){ const a=S[i], b=S[(i+1)%S.length]; if((a[1]-BLADE_Z)*(b[1]-BLADE_Z)<0) xs.push(zAt(a,b,BLADE_Z)[0]); }
    if(xs.length>=2){ const l1=toLocal(p,[Math.min(...xs),BLADE_Z]), l2=toLocal(p,[Math.max(...xs),BLADE_Z]); inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(l1[0],yt+(p.flip?-0.0008:0.0008),l1[1]),v3(l2[0],yt+(p.flip?-0.0008:0.0008),l2[1])]),LINE_LASER)); } }
  for(let i=0;i<n;i++){ const a=VIS[i], b=VIS[(i+1)%n], md=p.meta[i];
    if(md.sawn) inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(a[0],yt,a[1]),v3(b[0],yt,b[1])]),LINE_SAWN));
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<0.05 || longest[md.label+'|'+md.sawn].i!==i) continue;
    const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2, dx=C[0]-mx, dz=C[1]-mz, dl=Math.hypot(dx,dz)||1, off=Math.min(0.04,dl*0.45);
    const sp=new THREE.Sprite(labelMat(md.label,md.sawn)); sp.position.set(mx+dx/dl*off,yl,mz+dz/dl*off); sp.scale.set(0.075,0.075,1); inner.add(sp); }
  if(p.id===activeId && pieces.length>1){ const yo=p.flip?yt-0.0005:yt+0.0005, loop=VIS.map(q=>v3(q[0],yo,q[1])); loop.push(loop[0].clone()); inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop),LINE_ACTIVE)); }
  pieceRoot.add(outer); p.group=outer; p.mesh=mesh; partMeshes.piece.push(mesh); placeGroup(p); }
/* prisme (biseaux compris) : face A en y = 0, face B en y = T ; groupes 0 = faces, 1 = chants (comme ExtrudeGeometry) */
function prismGeom(P, Q, T){ const n=P.length, pos=[], uv=[], caps=[], sides=[];
  const v=(x,y,z,a,b)=>{ pos.push(x,y,z); uv.push(a,b); return pos.length/3-1; };
  const tri=(arr,a,b,c,hint)=>{ const A=pos.slice(a*3,a*3+3),B=pos.slice(b*3,b*3+3),Cc=pos.slice(c*3,c*3+3), e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], e2=[Cc[0]-A[0],Cc[1]-A[1],Cc[2]-A[2]];
    const nn=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]]; if(nn[0]*hint[0]+nn[1]*hint[1]+nn[2]*hint[2]>=0) arr.push(a,b,c); else arr.push(a,c,b); };
  for(const [F,y,up] of [[P,0,-1],[Q,T,1]]){ const ids=F.map(q=>v(q[0],y,q[1],q[0],-q[1]));
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(F.map(q=>new THREE.Vector2(q[0],q[1])),[])) tri(caps,ids[a],ids[b],ids[c],[0,up,0]); }
  const C=centroid(P);
  for(let i=0;i<n;i++){ const j=(i+1)%n, a=P[i], b=P[j], c=Q[j], d=Q[i], along=Math.abs(b[0]-a[0])>Math.abs(b[1]-a[1]), u=q=>along?q[0]:-q[1];
    const mx=(a[0]+b[0])/2-C[0], mz=(a[1]+b[1])/2-C[1], hint=[mx,0,mz];
    const i0=v(a[0],0,a[1],u(a),1), i1=v(b[0],0,b[1],u(b),1), i2=v(c[0],T,c[1],u(c),1-T), i3=v(d[0],T,d[1],u(d),1-T);
    tri(sides,i0,i1,i2,hint); tri(sides,i0,i2,i3,hint); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex([...caps,...sides]); g.addGroup(0,caps.length,0); g.addGroup(caps.length,sides.length,1); g.computeVertexNormals(); return g; }
function placeGroup(p){ p.group.position.set(p.tx,PIECE_Y,p.tz); p.group.rotation.y=-p.theta; }
const rebuildAll=()=>{ pieces.forEach(buildPiece); app.stage.dirty(); };
const segLen=(p,i)=>{ const a=p.pts[i], b=p.pts[(i+1)%p.pts.length]; return Math.hypot(b[0]-a[0],b[1]-a[1]); };
function newPiece(kind,T,pts,labels,bands){ const p={id:++pieceSeq,kind,T,pts,meta:labels.map(l=>({sawn:false,label:l})),bands:bands||[],theta:0,flip:false,tx:0,tz:0}; pieces.push(p); return p; }
function clearPieces(){ cut.needEvac=false; cut.relocated=false; lastS=1450; pieces.forEach(disposePiece); pieces=[]; partMeshes.piece=[]; cut.max=null; cutLetter=0; }
/* --- pièces débitées --- */
let debit=[], debitSeq=0, debitKey='';
function toDebit(p,kind){ disposePiece(p); debit.unshift({id:++debitSeq, kind, T:p.T, pkind:p.kind, pts:p.pts, meta:p.meta, bands:p.bands||[]}); }
function debitSvg(it){ const xs=it.pts.map(q=>q[0]), zs=it.pts.map(q=>q[1]); const x0=Math.min(...xs), z0=Math.min(...zs), w=Math.max(...xs)-x0||1, h=Math.max(...zs)-z0||1;
  const sc=Math.min(56/w,36/h), ox=(60-w*sc)/2, oz=(40-h*sc)/2, P=q=>`${(ox+(q[0]-x0)*sc).toFixed(1)},${(oz+(q[1]-z0)*sc).toFixed(1)}`;
  const fill=it.pkind==='mela'?'#ecebe4':'#d9b98a', n=it.pts.length;
  let g=`<polygon points="${it.pts.map(P).join(' ')}" fill="${fill}" stroke="#8a8f94" stroke-width="0.8"/>`;
  for(const b of it.bands) g+=`<polygon points="${b.pts.map(P).join(' ')}" fill="#5b3d24"/>`;
  it.meta.forEach((m,i)=>{ if(m.sawn){ const a=it.pts[i], c=it.pts[(i+1)%n]; g+=`<polyline points="${P(a)} ${P(c)}" stroke="#2f9a4e" stroke-width="2" fill="none"/>`; } });
  return `<svg viewBox="0 0 60 40" aria-hidden="true">${g}</svg>`; }
function renderDebit(){ const key=JSON.stringify([debit.map(d=>d.id+d.kind),pieces.length,st.s>=1400]); if(key===debitKey) return; debitKey=key;
  const np=debit.filter(d=>d.kind==='piece').length; $('debitN').textContent=debit.length?`${np} pièce${np>1?'s':''} · ${debit.length-np} chute${debit.length-np>1?'s':''}`:'';
  const canTake=pieces.length===0 && st.s>=1400;
  $('debit').innerHTML= debit.length? debit.map(it=>{ const d=obb(it.pts), ns=it.meta.filter(m=>m.sawn).length, fl=it.bands.length?' · flache':'';
    return `<li data-k="${it.kind}">${debitSvg(it)}<div><b>${Math.round(d.L)} × ${Math.round(d.W)}</b><small>ép. ${Math.round(it.T*1000)} · ${ns} chant${ns>1?'s':''} scié${ns>1?'s':''}${fl}</small></div>
      <div class="d-act"><button class="toggle mini" type="button" data-d="kind" data-id="${it.id}" aria-pressed="${it.kind==='piece'}">${it.kind==='piece'?'Pièce':'Chute'}</button><button class="toggle mini" type="button" data-d="take" data-id="${it.id}" ${canTake?'':'disabled title="Libérez d\'abord la machine (« Mettre de côté ») et ramenez le chariot"'}>Reprendre</button></div></li>`; }).join('')
    : '<li class="debit-empty" style="display:block;border:0;background:none;padding:0">Les pièces évacuées ou mises de côté apparaissent ici.</li>'; }
function takeBack(id){ const k=debit.findIndex(d=>d.id===id); if(k<0) return; if(pieces.length||st.s<1400){ app.ex.flash.msg='Libérez d\'abord la machine (« Mettre de côté ») et ramenez le chariot.'; app.ex.flash.level='warn'; app.ex.invalidate(); app.apply(); return; }
  const it=debit.splice(k,1)[0]; const p={id:++pieceSeq,kind:it.pkind,T:it.T,pts:it.pts,meta:it.meta,bands:it.bands,theta:0,flip:false,tx:0,tz:0}; pieces.push(p); activeId=p.id;
  toFence(p); const S=sPts(p); p.tz+=0.30-Math.min(...S.map(q=>q[1])); cut.max=null; cut.relocated=false; cut.needEvac=false; app.ex.flash.msg=''; rebuildAll(); debitKey=''; app.ex.invalidate(); app.apply(); }
function setActive(id){ activeId=id; rebuildAll(); const p=A(); if(p) $('info').innerHTML=`<b>Pièce active</b><span>${pieceInfo(p)}</span>`; app.ex.invalidate(); app.apply(); }
function pieceInfo(p){ const n=p.pts.length; return 'Chants : '+p.meta.map((m,i)=>{ const a=p.pts[i], b=p.pts[(i+1)%n]; const ch=m.chips&&(m.chips.recto||m.chips.verso)?`, éclats ${m.chips.recto&&m.chips.verso?'recto et verso':m.chips.recto?'recto':'verso'}`:''; return `${m.label} ${Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])*1000)} mm${m.sawn?' (scié'+ch+')':' (brut)'}`; }).join(' · '); }

/* --- découpe --- */
function scoreState(){ if(!st.inc||!st.motor) return 'off'; if(st.incH<0.8) return 'low';
  const half=MAIN_KERF/2; if(st.incOff-st.incW/2>-half+1e-6 || st.incOff+st.incW/2<half-1e-6) return st.incW<MAIN_KERF? 'narrow':'misaligned'; return 'ok'; }
function splitPiece(p){ const S=sPts(p), down=p.flip?'recto':'verso', bad=p.kind==='mela'&&scoreState()!=='ok';
  // lame inclinée : le trait est à une autre cote sur la face A et sur la face B ; le nouveau chant porte ce biseau
  const fy=faceY(p), zA1=kerfZ(fy.A,1), zA0=kerfZ(fy.A,-1), dz=kerfZ(fy.B)-kerfZ(fy.A);
  const meta=k=>({sawn:true,label:cut.letter,chips:p.kind==='mela'?{recto:bad&&down==='recto',verso:bad&&down==='verso'}:null,
    bev: st.t? (k===0? dz : -dz) : 0, ang: st.t||0});
  const hp=[[q=>q[1]>=zA1-1e-9,(a,b)=>zAt(a,b,zA1)],[q=>q[1]<=zA0+1e-9,(a,b)=>zAt(a,b,zA0)]];
  const sides=hp.map(([f,g],k)=>{ const r=clipHalf(S,p.meta,f,g,meta(k)); r.push((p.bands||[]).map(b=>{ const BP=b.pts.map(w=>toSlider(p,w)); const [Cb]=clipHalf(BP,BP.map(()=>null),f,g,null); return Cb.length>=3&&area(Cb)>1e-7? {label:b.label,pts:Cb.map(w=>toLocal(p,w))} : null; }).filter(Boolean)); return r; });
  const onGuide=!!guideEdge(p); // délignage contre le guide : la pièce utile est entre lame et guide
  const wasActive=p.id===activeId; disposePiece(p); pieces=pieces.filter(q=>q!==p); const made=[null,null];
  sides.forEach(([P,M,B],k)=>{ if(P.length<3 || area(P)<1e-5) return;
    const q={id:++pieceSeq,kind:p.kind,T:p.T,theta:p.theta,flip:p.flip,tx:p.tx,tz:p.tz,pts:P.map(w=>toLocal(p,w)),meta:M,bands:B}; pieces.push(q); made[k]=q; });
  const keep = onGuide ? (made[1]||made[0]) : (made[0]||made[1]); // [0] côté chariot, [1] côté table
  if(wasActive && keep){ activeId=keep.id; if(made[0]&&made[1]){ app.ex.flash.msg=`Pièce gardée : ${onGuide?'celle entre la lame et le guide':'celle côté chariot'} (contour orange). Pour garder l\'autre, cliquez-la avant d\'évacuer.`; app.ex.flash.level='info'; } } }
function stopPass(){ st.pass=false; $('pass').setAttribute('aria-pressed','false'); }
function updateCut(){
  cut.blocked='';
  if(st.s>lastS+1e-6){ // le chariot revient vers l'opérateur
    if(cut.inProgress){ st.s=lastS; cut.blocked='Ne reculez jamais le chariot pendant la coupe : terminez la passe.'; if(st.pass) stopPass(); }
    else if(cut.needEvac){ st.s=lastS; cut.blocked='Évacuez la chute avant de ramener le chariot.'; if(st.pass) stopPass(); }
    else if(cut.max!==null && !cut.relocated){ relocateForReturn(); cut.relocated=true; }
  }
  let sx=SLIDER_HOME+st.s/1000;
  const all=pieces.map(p=>({p,r:bandRange(p)})).filter(o=>o.r);
  const live=all.filter(o=>!(cut.max!==null && cut.max>=o.r.maxX));
  if(live.length){
    // la lame (inclinée de t) monte le long de son plan : centre à h − R du pivot, mi-épaisseur à (ym − table)/cos t
    const T=Math.max(...live.map(o=>o.p.T)), ct=Math.cos(st.t*Math.PI/180), sc=st.h/1000-R, ym=PIECE_Y+T/2, sm=(ym-TABLE_Y)/ct;
    const c=Math.abs(sm-sc)<R? Math.sqrt(R*R-(sm-sc)**2) : (sc+R>(PIECE_Y-TABLE_Y)/ct? 0.02 : -1);
    if(c>0){ const limit=Math.min(...live.map(o=>Math.max(cut.max??-Infinity,o.r.minX))), reach=c-sx;
      if(reach>limit){
        const why= !st.motor? 'Moteur arrêté : la pièce bute contre la lame.'
          : st.h/1000 < (T+0.004)/ct ? `Lame trop basse : elle ne traverse pas la pièce (épaisseur ${Math.round(T*1000)} mm${st.t?`, lame inclinée à ${st.t}°`:''}). Passe bloquée.` : '';
        if(why){ sx=c-limit; st.s=(sx-SLIDER_HOME)*1000; cut.blocked=why; if(st.pass) stopPass(); }
        else { if(cut.max===null){ cut.letter=nextCutLetter(); app.recordDangers(); } cut.max=Math.max(cut.max??-Infinity,reach); }
      } } }
  let split=false; for(const o of all) if(cut.max!==null && cut.max>=o.r.maxX){ splitPiece(o.p); split=true; }
  if(split){ rebuildAll(); if(pieces.length>1) cut.needEvac=true; }
  lastS=st.s;
  cut.inProgress=pieces.some(p=>{ const r=bandRange(p); return r && cut.max!==null && cut.max>r.minX && cut.max<r.maxX; });
  { const t=st.t*Math.PI/180, nb=v3(0,Math.sin(t),Math.cos(t)), D=nb.y*TABLE_Y+nb.z*BLADE_Z;   // plans du trait, lame inclinée comprise
    cutPlanes[0].set(nb,-(D+KERF)); cutPlanes[1].set(nb.clone().negate(),D-KERF); }
  cutPlanes[2].set(v3(1,0,0),-(sx+(cut.max??-10))); cutPlanes[3].set(v3(0,1,0),-(TABLE_Y+st.h/1000*Math.cos(st.t*Math.PI/180)));
}

/* --- retour du chariot : la pièce ne repasse jamais entre lame et guide --- */
function relocateForReturn(){ let moved=false;
  for(const p of pieces){ const S=sAll(p), minZ=Math.min(...S.map(q=>q[1])), maxZ=Math.max(...S.map(q=>q[1]));
    let dz=0;
    if(maxZ<=BLADE_Z+KERF+1e-4) dz=0.30-minZ;                          // délignage : pièce reposée sur le chariot
    else if(minZ<BLADE_Z+KERF+0.010) dz=BLADE_Z+KERF+0.010-minZ;       // tronçonnage : pièce écartée de 10 mm de la lame
    if(dz){ p.tz+=dz; moved=true; } }
  if(moved){ rebuildAll(); app.ex.flash.msg='Retour du chariot : la pièce a été écartée de la lame, côté chariot.'; app.ex.flash.level='info'; } }

/* --- manipulation de la pièce active --- */
function rotatePiece(p,d){ const C0=centroid(sPts(p)); p.theta+=d; const C1=centroid(sPts(p)); p.tx+=C0[0]-C1[0]; p.tz+=C0[1]-C1[1]; }
function alignEdge(p,target){ const S=sPts(p); let best=-2,bi=0; S.forEach((_,i)=>{ const n=outwardNormal(S,i), d=n[0]*target[0]+n[1]*target[1]; if(d>best){best=d;bi=i;} });
  const n=outwardNormal(S,bi); rotatePiece(p, Math.atan2(target[1],target[0])-Math.atan2(n[1],n[0])); }
/* contre la règle (orientable) : on garde l'appui sur la règle, le guide sert alors de butée */
function toFence(p){ if(!guideEdge(p)){ const n=fenceN(); alignEdge(p,[-n[0],-n[1]]); } const n=fenceN(), m=Math.min(...sAll(p).map(fenceDist)); p.tx-=n[0]*m; p.tz-=n[1]*m; }
function toGuide(p){ if(!fenceEdge(p)) alignEdge(p,[0,-1]); p.tz+=guideFace()-Math.min(...sAll(p).map(q=>q[1])); }
/* en butée : la butée glisse sur la règle ; lecture directe de la longueur le long de la règle */
function toStop(p){ const d=fenceD(), m=stopT()-Math.max(...sAll(p).map(fenceT)); p.tx+=d[0]*m; p.tz+=d[1]*m; }
/* chant en appui sur une droite (dist(q) = 0), sur la face A ou la face B */
function lineEdge(p,dist){ for(const S of [sPts(p),sTop(p)]) for(let i=0;i<S.length;i++){ const a=S[i], b=S[(i+1)%S.length]; if(Math.abs(dist(a))<0.0008 && Math.abs(dist(b))<0.0008) return p.meta[i]; } return null; }
const sabotContact=p=>!!p&&st.sabot&&Math.abs(Math.max(...sAll(p).map(q=>q[0]))-SABOT_FACE)<0.0008;
const fenceEdge=p=>p&&lineEdge(p,fenceDist), guideEdge=p=>p&&lineEdge(p,q=>q[1]-guideFace());
function stopEdge(p){ if(!p) return null; const st0=stopT(), d=fenceD(); if(!sAll(p).some(v=>Math.abs(fenceT(v)-st0)<0.0008)) return null;
  const S=sPts(p); let best=-2,bi=-1; S.forEach((_,i)=>{ const a=S[i], b=S[(i+1)%S.length], n=outwardNormal(S,i), k=n[0]*d[0]+n[1]*d[1]; if(Math.max(fenceT(a),fenceT(b))>st0-0.003 && k>best){best=k;bi=i;} }); return bi>=0?p.meta[bi]:null; }
function doOp(op){
  app.ex.flash.level='warn';
  if(op==='reset'){ app.ex.setMode(app.ex.mode); return; }
  const p=A(); if(!p) return;
  if(cut.inProgress){ app.ex.flash.msg='Terminez la passe en cours avant de déplacer la pièce.'; app.ex.invalidate(); app.apply(); return; }
  if(op==='aside'){ pieces.filter(q=>q!==p).forEach(q=>toDebit(q,'chute')); toDebit(p,'piece'); pieces=[]; activeId=null; cut.needEvac=false; cut.max=null; app.ex.flash.msg=''; rebuildAll(); debitKey=''; app.ex.invalidate(); app.apply(); return; }
  if(op==='evac'){ pieces.filter(q=>q!==p).forEach(q=>toDebit(q,'chute')); pieces=[p]; debitKey=''; cut.needEvac=false; app.ex.flash.msg=''; rebuildAll(); app.ex.invalidate(); app.apply(); return; }
  if(st.s<1400){ app.ex.flash.msg=cut.needEvac? 'Évacuez la chute, puis ramenez le chariot avant de replacer la pièce.' : 'Ramenez d\'abord le chariot en position de départ (« Retour du chariot »).'; app.ex.invalidate(); app.apply(); return; }
  stopPass(); cut.max=null; cut.relocated=false; app.ex.flash.msg='';
  if(op==='rotL') rotatePiece(p,Math.PI/2); else if(op==='rotR') rotatePiece(p,-Math.PI/2);
  else if(op==='flip'){ const C0=centroid(sPts(p)); p.flip=!p.flip; const C1=centroid(sPts(p)); p.tx+=C0[0]-C1[0]; p.tz+=C0[1]-C1[1]; }
  else if(op==='fence') toFence(p); else if(op==='guide') toGuide(p); else if(op==='stop') toStop(p);
  else if(op==='evac'){ pieces.filter(q=>q!==p).forEach(disposePiece); pieces=[p]; }
  else if(op==='sabot'){ if(!st.sabot){ app.ex.flash.msg='Montez d\'abord le sabot de délignage (Réglages).'; } else { const S=sAll(p); p.tx+=SABOT_FACE-Math.max(...S.map(q=>q[0])); } }
  else if(op[0]==='z'){ p.tz+=({zm10:-0.010,zm1:-0.001,zp1:0.001,zp10:0.010})[op]; }
  if(st.sabot){ const S=sAll(p), mx=Math.max(...S.map(q=>q[0])); if(mx>SABOT_FACE && S.some(q=>q[1]>SABOT_Z0-0.01)) p.tx-=mx-SABOT_FACE; } // le sabot arrête la pièce
  { const n=fenceN(), m=Math.min(...sAll(p).map(fenceDist)); if(m<0){ p.tx-=n[0]*m; p.tz-=n[1]*m; } } // la pièce ne peut pas traverser la règle
  rebuildAll(); app.ex.invalidate(); app.apply(); }

/* --- accès pour les autres fichiers --- */
export const setActiveId=id=>{ activeId=id; };
/* remise à zéro au changement de mode (pièces débitées, chariot en position de départ) */
export function resetForMode(){ debit=[]; debitKey=''; stopPass(); st.s=1450; lastS=1450; }
export { pieces, cut, A, sPts, sTop, sAll, topPts, toSlider, toLocal, bandRange, segLen, newPiece, clearPieces, rebuildAll, renderDebit, setActive,
  scoreState, stopPass, updateCut, toFence, toGuide, toStop, fenceEdge, guideEdge, stopEdge, sabotContact, doOp };
