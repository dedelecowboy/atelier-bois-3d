/* Pièces sur le chariot : géométrie (polygones convexes en coordonnées locales u, v avec theta, flip, tx, tz),
   maillages, découpe à la lame, cycle de coupe, manipulation par l'élève, pièces débitées.
   Règles validées : aller seulement ; chute évacuée avant le retour du chariot (tous les modes) ;
   au retour, la pièce revient côté chariot ; la pièce gardée est celle entourée en orange. */
import * as THREE from 'three';
import { canvasTex, woodTex, v3 } from '../../engine/kit.js';
import { centroid, area, clipHalf, zAt, outwardNormal, obb } from '../../engine/poly.js';
import { TABLE_Y, BLADE_Z, R, KERF, MAIN_KERF, SLIDER_HOME, SABOT_FACE, SABOT_Z0, FENCE_FACE, PIECE_Y } from './constants.js';
import { st, guideFace, stopFace, $ } from './state.js';

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

/* --- géométrie 2D (repère chariot : x = sens d'avance, z = travers) --- */
function toSlider(p,q){ const c=Math.cos(p.theta), s=Math.sin(p.theta), u=q[0], v=p.flip?-q[1]:q[1]; return [p.tx+c*u-s*v, p.tz+s*u+c*v]; }
function toLocal(p,w){ const c=Math.cos(p.theta), s=Math.sin(p.theta), dx=w[0]-p.tx, dz=w[1]-p.tz; const u=c*dx+s*dz, v=-s*dx+c*dz; return [u, p.flip?-v:v]; }
const sPts=p=>p.pts.map(q=>toSlider(p,q));
function bandRange(p){ const S=sPts(p), D=S.map(()=>null);
  let [P]=clipHalf(S,D,q=>q[1]>=BLADE_Z-KERF,(a,b)=>zAt(a,b,BLADE_Z-KERF),null);
  if(P.length<3) return null; [P]=clipHalf(P,P.map(()=>null),q=>q[1]<=BLADE_Z+KERF,(a,b)=>zAt(a,b,BLADE_Z+KERF),null);
  if(P.length<3) return null; const xs=P.map(q=>q[0]); return {minX:Math.min(...xs), maxX:Math.max(...xs)}; }
/* --- construction des maillages --- */
function disposePiece(p){ if(!p.group) return; pieceRoot.remove(p.group); p.group.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); partMeshes.piece=partMeshes.piece.filter(m=>m!==p.mesh); p.group=null; }
function buildPiece(p){ disposePiece(p);
  const sh=new THREE.Shape(p.pts.map(q=>new THREE.Vector2(q[0],-q[1])));
  const g=new THREE.ExtrudeGeometry(sh,{depth:p.T,bevelEnabled:false}); g.rotateX(-Math.PI/2);
  const m=texFor(p.kind), mesh=new THREE.Mesh(g,[m.cap,m.side]);
  mesh.castShadow=mesh.receiveShadow=true; mesh.userData.part='piece'; mesh.userData.pieceId=p.id;
  const outer=new THREE.Group(), inner=new THREE.Group(); outer.add(inner); inner.add(mesh);
  inner.rotation.x=p.flip?Math.PI:0; inner.position.y=p.flip?p.T:0;
  const yt=p.flip?-0.0015:p.T+0.0015, yl=p.flip?-0.016:p.T+0.016, n=p.pts.length, C=centroid(p.pts);
  const longest={}; for(let i=0;i<n;i++){ const k=p.meta[i].label+'|'+p.meta[i].sawn, L=segLen(p,i); if(!longest[k]||L>longest[k].L) longest[k]={i,L}; }
  p.meta.forEach((md,i)=>{ if(!md.chips) return; for(const face of ['recto','verso']){ if(!md.chips[face]) continue;
      const a=p.pts[i], b=p.pts[(i+1)%n], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<0.01) continue; let nx=-(b[1]-a[1])/L, nz=(b[0]-a[0])/L; const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2; if((C[0]-mx)*nx+(C[1]-mz)*nz<0){ nx=-nx; nz=-nz; }
      const w=0.012, gq=new THREE.BufferGeometry(); const y=face==='recto'?p.T+0.0007:-0.0007;
      gq.setAttribute('position',new THREE.Float32BufferAttribute([a[0],y,a[1], b[0],y,b[1], b[0]+nx*w,y,b[1]+nz*w, a[0]+nx*w,y,a[1]+nz*w],3));
      gq.setAttribute('uv',new THREE.Float32BufferAttribute([0,0, L*12,0, L*12,1, 0,1],2)); gq.setIndex([0,1,2,0,2,3]); gq.computeVertexNormals();
      inner.add(new THREE.Mesh(gq,MAT_CHIPS)); } });
  for(const b of (p.bands||[])){ const g2=new THREE.ShapeGeometry(new THREE.Shape(b.pts.map(q=>new THREE.Vector2(q[0],-q[1])))); g2.rotateX(-Math.PI/2);
    const bm=new THREE.Mesh(g2,MAT_BARK); bm.position.y=p.T+0.0006; bm.receiveShadow=true; inner.add(bm); }
  { const S=sPts(p), xs=[]; for(let i=0;i<S.length;i++){ const a=S[i], b=S[(i+1)%S.length]; if((a[1]-BLADE_Z)*(b[1]-BLADE_Z)<0) xs.push(zAt(a,b,BLADE_Z)[0]); }
    if(xs.length>=2){ const l1=toLocal(p,[Math.min(...xs),BLADE_Z]), l2=toLocal(p,[Math.max(...xs),BLADE_Z]); inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(l1[0],yt+(p.flip?-0.0008:0.0008),l1[1]),v3(l2[0],yt+(p.flip?-0.0008:0.0008),l2[1])]),LINE_LASER)); } }
  for(let i=0;i<n;i++){ const a=p.pts[i], b=p.pts[(i+1)%n], md=p.meta[i];
    if(md.sawn) inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(a[0],yt,a[1]),v3(b[0],yt,b[1])]),LINE_SAWN));
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<0.05 || longest[md.label+'|'+md.sawn].i!==i) continue;
    const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2, dx=C[0]-mx, dz=C[1]-mz, dl=Math.hypot(dx,dz)||1, off=Math.min(0.04,dl*0.45);
    const sp=new THREE.Sprite(labelMat(md.label,md.sawn)); sp.position.set(mx+dx/dl*off,yl,mz+dz/dl*off); sp.scale.set(0.075,0.075,1); inner.add(sp); }
  if(p.id===activeId && pieces.length>1){ const yo=p.flip?yt-0.0005:yt+0.0005, loop=p.pts.map(q=>v3(q[0],yo,q[1])); loop.push(loop[0].clone()); inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop),LINE_ACTIVE)); }
  pieceRoot.add(outer); p.group=outer; p.mesh=mesh; partMeshes.piece.push(mesh); placeGroup(p); }
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
  const meta={sawn:true,label:cut.letter,chips:p.kind==='mela'?{recto:bad&&down==='recto',verso:bad&&down==='verso'}:null};
  const hp=[[q=>q[1]>=BLADE_Z+KERF-1e-9,(a,b)=>zAt(a,b,BLADE_Z+KERF)],[q=>q[1]<=BLADE_Z-KERF+1e-9,(a,b)=>zAt(a,b,BLADE_Z-KERF)]];
  const sides=hp.map(([f,g])=>{ const r=clipHalf(S,p.meta,f,g,meta); r.push((p.bands||[]).map(b=>{ const BP=b.pts.map(w=>toSlider(p,w)); const [Cb]=clipHalf(BP,BP.map(()=>null),f,g,null); return Cb.length>=3&&area(Cb)>1e-7? {label:b.label,pts:Cb.map(w=>toLocal(p,w))} : null; }).filter(Boolean)); return r; });
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
    const T=Math.max(...live.map(o=>o.p.T)), cy=TABLE_Y+st.h/1000-R, ym=PIECE_Y+T/2;
    const c=Math.abs(ym-cy)<R? Math.sqrt(R*R-(ym-cy)**2) : (cy+R>PIECE_Y? 0.02 : -1);
    if(c>0){ const limit=Math.min(...live.map(o=>Math.max(cut.max??-Infinity,o.r.minX))), reach=c-sx;
      if(reach>limit){
        const why= !st.motor? 'Moteur arrêté : la pièce bute contre la lame.'
          : st.h/1000 < T+0.002 ? `Lame trop basse : elle ne traverse pas la pièce (épaisseur ${Math.round(T*1000)} mm). Passe bloquée.`
          : st.t!==0 ? 'Lame inclinée : les coupes inclinées ne sont pas encore simulées. Passe bloquée.' : '';
        if(why){ sx=c-limit; st.s=(sx-SLIDER_HOME)*1000; cut.blocked=why; if(st.pass) stopPass(); }
        else { if(cut.max===null){ cut.letter=nextCutLetter(); app.recordDangers(); } cut.max=Math.max(cut.max??-Infinity,reach); }
      } } }
  let split=false; for(const o of all) if(cut.max!==null && cut.max>=o.r.maxX){ splitPiece(o.p); split=true; }
  if(split){ rebuildAll(); if(pieces.length>1) cut.needEvac=true; }
  lastS=st.s;
  cut.inProgress=pieces.some(p=>{ const r=bandRange(p); return r && cut.max!==null && cut.max>r.minX && cut.max<r.maxX; });
  cutPlanes[0].set(v3(0,0,1),-(BLADE_Z+KERF)); cutPlanes[1].set(v3(0,0,-1),BLADE_Z-KERF);
  cutPlanes[2].set(v3(1,0,0),-(sx+(cut.max??-10))); cutPlanes[3].set(v3(0,1,0),-(TABLE_Y+st.h/1000));
}

/* --- retour du chariot : la pièce ne repasse jamais entre lame et guide --- */
function relocateForReturn(){ let moved=false;
  for(const p of pieces){ const S=sPts(p), minZ=Math.min(...S.map(q=>q[1])), maxZ=Math.max(...S.map(q=>q[1]));
    let dz=0;
    if(maxZ<=BLADE_Z+KERF+1e-4) dz=0.30-minZ;                          // délignage : pièce reposée sur le chariot
    else if(minZ<BLADE_Z+KERF+0.010) dz=BLADE_Z+KERF+0.010-minZ;       // tronçonnage : pièce écartée de 10 mm de la lame
    if(dz){ p.tz+=dz; moved=true; } }
  if(moved){ rebuildAll(); app.ex.flash.msg='Retour du chariot : la pièce a été écartée de la lame, côté chariot.'; app.ex.flash.level='info'; } }

/* --- manipulation de la pièce active --- */
function rotatePiece(p,d){ const C0=centroid(sPts(p)); p.theta+=d; const C1=centroid(sPts(p)); p.tx+=C0[0]-C1[0]; p.tz+=C0[1]-C1[1]; }
function alignEdge(p,target){ const S=sPts(p); let best=-2,bi=0; S.forEach((_,i)=>{ const n=outwardNormal(S,i), d=n[0]*target[0]+n[1]*target[1]; if(d>best){best=d;bi=i;} });
  const n=outwardNormal(S,bi); rotatePiece(p, Math.atan2(target[1],target[0])-Math.atan2(n[1],n[0])); }
function toFence(p){ if(!guideEdge(p)) alignEdge(p,[-1,0]); const S=sPts(p); p.tx+=FENCE_FACE-Math.min(...S.map(q=>q[0])); } // contre le guide : la règle ne fait que pousser
// contre la règle : on garde l'appui sur la règle, le guide sert alors de butée
function toGuide(p){ if(!fenceEdge(p)) alignEdge(p,[0,-1]); const S=sPts(p); p.tz+=guideFace()-Math.min(...S.map(q=>q[1])); }
function toStop(p){ const S=sPts(p); p.tz+=stopFace()-Math.max(...S.map(q=>q[1])); }
function contactEdge(p,ax,val){ const S=sPts(p), k=ax==='x'?0:1; for(let i=0;i<S.length;i++){ const a=S[i], b=S[(i+1)%S.length]; if(Math.abs(a[k]-val)<0.0008 && Math.abs(b[k]-val)<0.0008) return p.meta[i]; } return null; }
const sabotContact=p=>!!p&&st.sabot&&Math.abs(Math.max(...sPts(p).map(q=>q[0]))-SABOT_FACE)<0.0008;
const fenceEdge=p=>p&&contactEdge(p,'x',FENCE_FACE), guideEdge=p=>p&&contactEdge(p,'z',guideFace());
function stopEdge(p){ if(!p) return null; const S=sPts(p), sf=stopFace(); if(!S.some(v=>Math.abs(v[1]-sf)<0.0008)) return null;
  let best=-2,bi=-1; S.forEach((_,i)=>{ const a=S[i], b=S[(i+1)%S.length], n=outwardNormal(S,i); if(Math.max(a[1],b[1])>sf-0.0008 && n[1]>best){best=n[1];bi=i;} }); return bi>=0?p.meta[bi]:null; }
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
  else if(op==='sabot'){ if(!st.sabot){ app.ex.flash.msg='Montez d\'abord le sabot de délignage (Réglages).'; } else { const S=sPts(p); p.tx+=SABOT_FACE-Math.max(...S.map(q=>q[0])); } }
  else if(op[0]==='z'){ p.tz+=({zm10:-0.010,zm1:-0.001,zp1:0.001,zp10:0.010})[op]; }
  if(st.sabot){ const S=sPts(p), mx=Math.max(...S.map(q=>q[0])); if(mx>SABOT_FACE && S.some(q=>q[1]>SABOT_Z0-0.01)) p.tx-=mx-SABOT_FACE; } // le sabot arrête la pièce
  { const mx=Math.min(...sPts(p).map(q=>q[0])); if(mx<FENCE_FACE) p.tx+=FENCE_FACE-mx; } // la pièce ne peut pas traverser la règle
  rebuildAll(); app.ex.invalidate(); app.apply(); }

/* --- accès pour les autres fichiers --- */
export const setActiveId=id=>{ activeId=id; };
/* remise à zéro au changement de mode (pièces débitées, chariot en position de départ) */
export function resetForMode(){ debit=[]; debitKey=''; stopPass(); st.s=1450; lastS=1450; }
export { pieces, cut, A, sPts, toSlider, toLocal, bandRange, segLen, newPiece, clearPieces, rebuildAll, renderDebit, setActive,
  scoreState, stopPass, updateCut, toFence, toGuide, toStop, fenceEdge, guideEdge, stopEdge, sabotContact, doOp };
