/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Pièces sur la scie radiale : planches brutes (avec ou sans flache, avec défauts), position sur la table,
   coupes par le plan de la lame (droite, d'onglet, biaise), pièces débitées.

   Repère local d'une planche : u le long (mm, bout gauche d'origine en u = 0), v en travers (0 = rive arrière
   d'origine), w dans l'épaisseur (0 = face posée sur la table). Toutes les pièces issues d'une même planche gardent
   le profil de la planche (rives, flache, défauts) ; une pièce = ce profil limité par des plans n·(u,v,w) ≤ d :
   les deux bouts bruts d'origine, puis chaque coupe de la lame (trait de 4 mm retiré).
   Faces : contour de la face posée (w = 0) et de la face du dessus (w = T), chacun découpé par la trace des plans ;
   les flancs (rives, bouts) relient les deux contours.
   Dans la scène : X = tx ± u/1000, Z = tz ± v/1000 (signe − si la pièce est tournée bout pour bout, rev). */
import * as THREE from 'three';
import { canvasTex } from '../../engine/kit.js';
import { clipHalf, area } from '../../engine/poly.js';
import { TABLE_Y, KERF, FENCE_Z, Z_PIV, Z_PARK, STROKE, SERV_X0, EXT_X1, MIN_USE } from './constants.js';
import { st, bladePlane, stopX } from './state.js';

let app=null, pieceRoot=null, partMeshes=null, uid=0, pid=0;
export function initPieces(a, model){ app=a; pieceRoot=model.pieceRoot; partMeshes=a.parts.partMeshes; }

/* ---------- état ---------- */
export const pieces=[];   // toutes les pièces du mode : state 'table' | 'stock'
export const cut={ cuts:0, keep:null, lastMsg:'', msgSeq:0, blocked:'', firstChute:null };
export const onTable=()=>pieces.filter(q=>q.state==='table');
export const keepPiece=()=>{ const t=onTable(); return t.length===1? t[0] : t.find(q=>q.id===cut.keep)||null; };
/* pièce tenue par l'opérateur : la seule sur la table (ou la pièce gardée) */
export const cur=()=>keepPiece();

/* ---------- création ---------- */
/* spec : {L, W, T, wood, flache (retrait de la face du dessus sur chaque rive, mm), wave (ondulation des rives, mm),
   skew0 / skew1 (bouts bruts hors d'équerre, mm sur la largeur), defects:[{type:'noeud'|'fente'|'gerce', u, v, …}],
   x1 (bout droit dans la scène, m), gap (écart au guide, mm), name} */
export function newPiece(spec){
  const prof=makeProfile(spec);
  const q={ id:++uid, prof, planes:[
      { id:++pid, n:[-1, spec.skew0/prof.W, 0], d:0, raw:true },
      { id:++pid, n:[1, spec.skew1/prof.W, 0], d:prof.L, raw:true } ],
    rev:false, tx:0, tz:0, state:'table', gen:0, kind:'piece', group:null };
  q.tx=(spec.x1??-0.04)-prof.L/1000; q.tz=FENCE_Z+(spec.gap||0)/1000-prof.vmin/1000;
  pieces.push(q); q.tz+=FENCE_Z+(spec.gap||0)/1000-extent(q).z0; build(q); return q; }
function makeProfile(s){ const N=Math.max(2,Math.ceil(s.L/50))+1, wv=s.wave||0, fl=s.flache||0; let seed=s.seed||1;
  const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; }, ph=[rnd()*6,rnd()*6,rnd()*6,rnd()*6];
  const st0=[],st1=[];   // stations : [u, v arrière, v avant] pour la face posée (0) et la face du dessus (1)
  for(let i=0;i<N;i++){ const u=-40+(s.L+80)*i/(N-1), x=u/1000;
    const b=wv*(Math.sin(x*2.1+ph[0])*0.6+Math.sin(x*5.3+ph[1])*0.4), f=s.W+wv*(Math.sin(x*1.7+ph[2])*0.6+Math.sin(x*4.1+ph[3])*0.4);
    st0.push([u,b,f]);
    const e=fl? fl*(0.75+0.25*Math.sin(x*3.3+ph[1]))+wv*0.3*Math.sin(x*7.1+ph[0]) : 0, g=fl? fl*(0.75+0.25*Math.sin(x*2.7+ph[3]))+wv*0.3*Math.sin(x*6.3+ph[2]) : 0;
    st1.push([u,b+e,f-g]); }
  let vmin=1e9; for(const r of [...st0,...st1]) vmin=Math.min(vmin,r[1]);
  const defects=(s.defects||[]).map(d=>({ ...d, poly:defectPoly(d,s) }));
  return { L:s.L, W:s.W, T:s.T, wood:s.wood||'sapin', flache:fl>0, st0, st1, vmin, defects, name:s.name||'' }; }
/* contour d'un défaut sur la face (u, v en mm) */
function defectPoly(d,s){ const P=[];
  if(d.type==='noeud'){ for(let k=0;k<20;k++){ const a=k/20*Math.PI*2; P.push([d.u+Math.cos(a)*d.r*1.25, d.v+Math.sin(a)*d.r]); } }
  else if(d.type==='fente'){ const L=d.len, e=d.end==='g'?0:s.L, dir=d.end==='g'?1:-1;   // fente en bout : coin ouvert au bout, qui se referme vers l'intérieur
    P.push([e-dir*5, d.v-2.5],[e+dir*L, d.v-0.3],[e+dir*L, d.v+0.3],[e-dir*5, d.v+2.5]); }
  else { P.push([d.u, d.v-0.6],[d.u+d.len*0.5, d.v-1.0],[d.u+d.len, d.v-0.2],[d.u+d.len, d.v+0.2],[d.u+d.len*0.5, d.v+1.0],[d.u, d.v+0.6]); }   // gerce
  if(area(P)>0 && ccw(P)<0) P.reverse(); return P; }
const ccw=P=>{ let a=0; for(let i=0;i<P.length;i++){ const [x1,z1]=P[i],[x2,z2]=P[(i+1)%P.length]; a+=x1*z2-x2*z1; } return a; };
export function clearPieces(){ for(const p of pieces) dispose(p); pieces.length=0; partMeshes.piece=[]; cut.keep=null; cut.blocked=''; }
function dispose(p){ if(p.group){ pieceRoot.remove(p.group); p.group.traverse(o=>o.geometry?.dispose()); p.group=null; } }

/* ---------- faces : contours découpés par les plans ---------- */
function outline(prof, top){ const S=top?prof.st1:prof.st0, P=[], M=[];
  for(const r of S){ P.push([r[0],r[1]]); M.push('back'); } M[M.length-1]='xR';
  for(let i=S.length-1;i>=0;i--){ P.push([S[i][0],S[i][2]]); M.push('front'); } M[M.length-1]='xL';
  return [P,M]; }
function face(q, top){ let [P,M]=outline(q.prof,top); const w=top?q.prof.T:0;
  for(const pl of q.planes){ const [a,b,c]=pl.n, d=pl.d-c*w;
    [P,M]=clipHalf(P,M,p=>a*p[0]+b*p[1]<=d+1e-9,(p,r)=>{ const fp=a*p[0]+b*p[1], fr=a*r[0]+b*r[1], t=(d-fp)/(fr-fp); return [p[0]+(r[0]-p[0])*t, p[1]+(r[1]-p[1])*t]; },'p'+pl.id);
    if(P.length<3) return [[],[]]; }
  return [P,M]; }
function faces(q){ if(!q._f){ const [bot,botM]=face(q,false), [top,topM]=face(q,true); q._f={bot,botM,top,topM}; } return q._f; }
const uExt=(P,M,lab)=>{ let lo=1e9,hi=-1e9; for(let i=0;i<P.length;i++) if(!lab||M[i]===lab){ for(const p of [P[i],P[(i+1)%P.length]]){ lo=Math.min(lo,p[0]); hi=Math.max(hi,p[0]); } } return hi>lo? [lo,hi] : null; };

/* ---------- mesures ---------- */
const DEF_NAME={ noeud:'nœud', fente:'fente en bout', gerce:'gerce' };
export function measure(q){ if(q._m) return q._m;
  const {bot,botM,top,topM}=faces(q);
  const lenOf=(P,M,lab)=>{ const e=uExt(P,M,lab)||uExt(P,M); return e? e[1]-e[0] : 0; };
  const Lb=[lenOf(bot,botM,'back'),lenOf(bot,botM,'front')], Lt=[lenOf(top,topM,'back'),lenOf(top,topM,'front')];
  let vlo=1e9,vhi=-1e9; for(const p of bot){ vlo=Math.min(vlo,p[1]); vhi=Math.max(vhi,p[1]); }
  // bouts : plans présents dans les contours (hors rives)
  const labs=new Set([...botM,...topM].filter(l=>l[0]==='p')), ends=[];
  for(const pl of q.planes) if(labs.has('p'+pl.id)){
    const side=pl.n[0]<0?'g':'d', ext=(P,M)=>uExt(P,M,'back')||uExt(P,M);
    const eb=ext(bot,botM), et=ext(top,topM); let longAt=null;
    if(eb&&et&&pl.beta){ const ub=side==='g'?eb[0]:eb[1], ut=side==='g'?et[0]:et[1], dl=side==='g'? ut-ub : ub-ut; if(dl>0.5) longAt='dessous'; else if(dl<-0.5) longAt='dessus'; }
    ends.push({ side, raw:!!pl.raw, alpha:pl.alpha??0, beta:pl.beta??0, longAt }); }
  const defects=q.prof.defects.filter(d=>hasDefect(q,d)).map(d=>d.type);
  const L=Math.max(...Lb), Lmin=Math.min(...Lb);
  return q._m={ L, Lmin, Lb, Lt, W:vhi-vlo, T:q.prof.T, ends, defects, flache:q.prof.flache,
    square:ends.length===2 && ends.every(e=>!e.raw && Math.abs(e.alpha)<0.01 && Math.abs(e.beta)<0.01),
    raw:ends.some(e=>e.raw), defNames:defects.map(t=>DEF_NAME[t]) }; }
/* le défaut est-il (même en partie) dans la pièce ? (gerce : en surface, face du dessus seulement) */
function hasDefect(q,d){ for(const w of d.type==='gerce'?[q.prof.T]:[0,q.prof.T]){ let P=d.poly, M=P.map(()=>'d');
    for(const pl of q.planes){ const [a,b,c]=pl.n, dd=pl.d-c*w;
      [P,M]=clipHalf(P,M,p=>a*p[0]+b*p[1]<=dd+1e-9,(p,r)=>{ const fp=a*p[0]+b*p[1], fr=a*r[0]+b*r[1], t=(dd-fp)/(fr-fp); return [p[0]+(r[0]-p[0])*t, p[1]+(r[1]-p[1])*t]; },'c');
      if(P.length<3) break; }
    if(P.length>=3 && area(P)>1) return true; }
  return false; }
/* défauts présents dans la pièce : contour découpé par les plans de la pièce (face du dessus), en local */
export function defectsIn(q){ const out=[], T=q.prof.T;
  for(const d of q.prof.defects){ let P=d.poly, M=P.map(()=>'d');
    for(const pl of q.planes){ const [a,b,c]=pl.n, dd=pl.d-c*T; [P,M]=clipHalf(P,M,p=>a*p[0]+b*p[1]<=dd+1e-9,(p,r)=>{ const fp=a*p[0]+b*p[1], fr=a*r[0]+b*r[1], t=(dd-fp)/(fr-fp); return [p[0]+(r[0]-p[0])*t, p[1]+(r[1]-p[1])*t]; },'c'); if(P.length<3) break; }
    if(P.length>=3 && area(P)>1) out.push({ ...d, poly:P }); }
  return out; }
export const autoKind=q=>{ const m=measure(q); return m.L<MIN_USE||m.defects.length? 'chute' : 'piece'; };
export const fmt=(v,n=1)=>(+v).toLocaleString('fr-FR',{minimumFractionDigits:n,maximumFractionDigits:n});
export const label=m=>`${fmt(m.L)} mm${m.defNames.length?' (avec '+m.defNames.join(', ')+')':''}`;

/* ---------- repère : pièce ↔ scène ---------- */
const sgn=q=>q.rev?-1:1;
export const toScene=(q,u,v)=>[q.tx+sgn(q)*u/1000, q.tz+sgn(q)*v/1000];
export const toLocal=(q,x,z)=>[sgn(q)*(x-q.tx)*1000, sgn(q)*(z-q.tz)*1000];
/* plan de la scène N·P ≤ D → plan local de la pièce */
function localPlane(q,N,D,meta){ const s=sgn(q);
  return { id:++pid, n:[N[0]*s, N[2]*s, N[1]], d:1000*(D-N[0]*q.tx-N[1]*TABLE_Y-N[2]*q.tz), ...meta }; }
/* encombrement dans la scène (m) */
export function extent(q){ const {bot,top}=faces(q); let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const [u,v] of [...bot,...top]){ const [x,z]=toScene(q,u,v); x0=Math.min(x0,x); x1=Math.max(x1,x); z0=Math.min(z0,z); z1=Math.max(z1,z); }
  return {x0,x1,z0,z1}; }
/* point (x, z) de la scène sur le bois d'une pièce de la table ? */
export function woodAt(x,z){ for(const q of onTable()){ const [u,v]=toLocal(q,x,z), P=faces(q).top; if(inPoly(P,u,v)) return q; } return null; }
/* la main (paume de 85 mm) repose entièrement sur le bois */
export const handOnWoodAt=(x,z)=>!!woodAt(x,z) && !!woodAt(x-0.03,z) && !!woodAt(x+0.03,z);
function inPoly(P,x,y){ let c=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const [xi,yi]=P[i],[xj,yj]=P[j]; if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) c=!c; } return c; }

/* ---------- textures ---------- */
const WOOD={ sapin:['#e6cfa4','#c9a877','#f2e2c2'], chene:['#c99d68','#9c7448','#dcb88a'], meleze:['#d9a877','#b07a4c','#ecc49a'] };
const texCache={};
function woodTex(wood,kind){ const key=wood+kind; if(texCache[key]) return texCache[key];
  const [base,dark,light]=WOOD[wood]||WOOD.sapin; let s=29; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const t=canvasTex(1024,128,(g,w,h)=>{
    if(kind==='bark'){ g.fillStyle='#b99566'; g.fillRect(0,0,w,h);                       // flache : aubier en partie écorcé, restes d'écorce
      for(let i=0;i<45;i++){ const x=rnd()*w, y=rnd()*h, rw=60+rnd()*260, rh=10+rnd()*60; g.fillStyle=`rgba(${70+rnd()*30},${52+rnd()*20},${38+rnd()*15},${0.75+rnd()*0.25})`; g.beginPath(); g.ellipse(x,y,rw/2,rh/2,0,0,7); g.fill(); }
      for(let i=0;i<160;i++){ g.strokeStyle=`rgba(30,22,16,${0.3+rnd()*0.4})`; g.lineWidth=1+rnd()*2; const x=rnd()*w, y=rnd()*h, l=15+rnd()*60; g.beginPath(); g.moveTo(x,y); g.lineTo(x+l,y+(rnd()-0.5)*6); g.stroke(); }
      return; }
    if(kind==='end'||kind==='raw'){   // bois de bout : cernes ; bout brut grisé, sale, fibres arrachées
      g.fillStyle=kind==='raw'?'#8f7a62':light; g.fillRect(0,0,w,h);
      for(let r=5;r<w*1.4;r+=6+rnd()*5){ g.strokeStyle=`rgba(${kind==='raw'?60:110},${kind==='raw'?48:72},30,${0.25+rnd()*0.25})`; g.lineWidth=1.2+rnd()*1.5; g.beginPath(); g.arc(w*0.5,h*3.2,r,0,7); g.stroke(); }
      if(kind==='raw') for(let i=0;i<900;i++){ g.fillStyle=`rgba(40,32,24,${0.15+rnd()*0.3})`; g.fillRect(rnd()*w,rnd()*h,1+rnd()*4,1+rnd()*3); }
      return; }
    // face sciée : fibres le long, stries de sciage
    g.fillStyle=dark; g.fillRect(0,0,w,h); g.fillStyle=base; g.globalAlpha=0.72; g.fillRect(0,0,w,h); g.globalAlpha=1;
    for(let i=0;i<16;i++){ const y0=i*h/16+rnd()*4; g.strokeStyle=i%3?`rgba(90,55,25,${0.22+rnd()*0.2})`:`rgba(245,225,190,.35)`; g.lineWidth=2+rnd()*2; g.beginPath();
      for(let x=0;x<=w;x+=16){ const y=y0+Math.sin(x*0.01+i)*2; x?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); }
    for(let x=0;x<w;x+=12+rnd()*8){ g.strokeStyle=`rgba(60,40,20,${0.06+rnd()*0.08})`; g.lineWidth=1.2; g.beginPath(); g.moveTo(x,0); g.lineTo(x+(rnd()-0.5)*6,h); g.stroke(); }
    for(let i=0;i<600;i++){ g.fillStyle=rnd()<0.5?`rgba(40,26,14,${0.18+rnd()*0.22})`:`rgba(240,220,185,${0.2+rnd()*0.2})`; g.fillRect(rnd()*w,rnd()*h,1+rnd()*3,1+rnd()*2); } });
  t.wrapS=t.wrapT=THREE.RepeatWrapping; return texCache[key]=t; }
const matCache={}, LINE_KEEP=new THREE.LineBasicMaterial({color:0xd27a1c});
function mats(wood){ if(matCache[wood]) return matCache[wood];
  const m=kind=>new THREE.MeshStandardMaterial({map:woodTex(wood,kind),roughness:kind==='bark'?1:0.88,bumpMap:kind==='bark'||kind==='raw'?woodTex(wood,kind):null,bumpScale:2,side:THREE.DoubleSide});
  return matCache[wood]=[m('saw'),m('bark'),m('end'),m('raw')]; }
const knotTex=canvasTex(128,128,(g,w,h)=>{ g.clearRect(0,0,w,h); const c=w/2; for(let r=c;r>0;r-=3){ const k=r/c; g.fillStyle=`rgb(${60+70*k},${36+44*k},${20+22*k})`; g.beginPath(); g.ellipse(c,c,r,r,0,0,7); g.fill(); } g.fillStyle='#24160c'; g.beginPath(); g.ellipse(c,c,c*0.25,c*0.22,0,0,7); g.fill(); });
const DS=THREE.DoubleSide, DEF_MAT={ noeud:new THREE.MeshStandardMaterial({map:knotTex,roughness:0.7,side:DS,polygonOffset:true,polygonOffsetFactor:-2}),
  fente:new THREE.MeshBasicMaterial({color:0x140c06,side:DS,polygonOffset:true,polygonOffsetFactor:-2}), gerce:new THREE.MeshBasicMaterial({color:0x2a1a0e,side:DS,polygonOffset:true,polygonOffsetFactor:-2}) };

/* ---------- maillage ---------- */
function chains(P,M){ const n=P.length, out={}; if(!n) return out; let s=0; for(let i=0;i<n;i++) if(M[i]!==M[(i-1+n)%n]){ s=i; break; }
  let curL=null, pts=null; for(let k=0;k<n;k++){ const i=(s+k)%n; if(M[i]!==curL){ curL=M[i]; pts=[P[i]]; (out[curL]||(out[curL]=[])).push(pts); } pts.push(P[(i+1)%n]); }
  for(const k in out) out[k]=out[k].sort((a,b)=>b.length-a.length)[0];
  return out; }
function resample(C,n){ const d=[0]; for(let i=1;i<C.length;i++) d.push(d[i-1]+Math.hypot(C[i][0]-C[i-1][0],C[i][1]-C[i-1][1])); const L=d[d.length-1]||1, out=[];
  for(let j=0;j<=n;j++){ const t=j/n*L; let i=1; while(i<C.length-1 && d[i]<t) i++; const f=(t-d[i-1])/((d[i]-d[i-1])||1); out.push([C[i-1][0]+(C[i][0]-C[i-1][0])*f, C[i-1][1]+(C[i][1]-C[i-1][1])*f]); }
  return out; }
export function build(q){ dispose(q); q._f=null; q._m=null; if(q.state!=='table') return;
  const {bot,botM,top,topM}=faces(q), T=q.prof.T, W=Math.max(60,q.prof.W);
  const pos=[],uv=[],idx=[[],[],[],[]];
  const vtx=(u,v,w,s,t)=>{ pos.push(u/1000,w/1000,v/1000); uv.push(s,t); return pos.length/3-1; };
  const tri=(m,a,b,c,hint)=>{ const A=pos.slice(a*3,a*3+3),B=pos.slice(b*3,b*3+3),C=pos.slice(c*3,c*3+3);
    const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]], nn=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
    if(nn[0]*hint[0]+nn[1]*hint[1]+nn[2]*hint[2]>=0) idx[m].push(a,b,c); else idx[m].push(a,c,b); };
  // faces posée et du dessus
  for(const [P,w,up] of [[bot,0,-1],[top,T,1]]){ if(P.length<3) continue;
    const ids=P.map(([u,v])=>vtx(u,v,w,u/1000,v/250));
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(P.map(p=>new THREE.Vector2(p[0],p[1])),[])) tri(0,ids[a],ids[b],ids[c],[0,up,0]); }
  // flancs : rives et bouts
  const CB=chains(bot,botM), CT=chains(top,topM);
  const matOf=lab=>{ if(lab==='back'||lab==='front') return q.prof.flache?1:0; const pl=q.planes.find(p=>'p'+p.id===lab); return pl&&pl.raw?3:2; };
  for(const lab in CB){ if(!CT[lab]) continue; const B=CB[lab], Tt=CT[lab], n=Math.max(B.length,Tt.length)-1, m=matOf(lab), rive=m<2;
    const rb=resample(B,n), rt=resample(Tt,n);
    for(let j=0;j<n;j++){ const [b0,b1,t0,t1]=[rb[j],rb[j+1],rt[j],rt[j+1]], du=b1[0]-b0[0], dv=b1[1]-b0[1], hint=[dv,0,-du];
      const st=(p,w)=> rive? [p[0]/1000, w/T] : [p[1]/W, w/T];
      const i0=vtx(b0[0],b0[1],0,...st(b0,0)), i1=vtx(b1[0],b1[1],0,...st(b1,0)), i2=vtx(t1[0],t1[1],T,...st(t1,T)), i3=vtx(t0[0],t0[1],T,...st(t0,T));
      tri(m,i0,i1,i2,hint); tri(m,i0,i2,i3,hint); } }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const all=[].concat(...idx); geo.setIndex(all); let o=0; idx.forEach((a,i)=>{ geo.addGroup(o,a.length,i); o+=a.length; });
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mats(q.prof.wood)); mesh.castShadow=mesh.receiveShadow=true; mesh.userData.part='piece'; mesh.userData.pieceId=q.id;
  const g=new THREE.Group(); g.add(mesh);
  // défauts visibles sur la face du dessus
  for(const d of defectsIn(q)){ const P=d.poly;
    const dp=[],du=[]; for(const [u,v] of P){ dp.push(u/1000,(T+0.35)/1000,v/1000); du.push((u-d.u)/(d.r*2.5||1)+0.5,(v-d.v)/(d.r*2||1)+0.5); }
    const dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.Float32BufferAttribute(dp,3)); dg.setAttribute('uv',new THREE.Float32BufferAttribute(du,2));
    const ti=[]; for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(P.map(p=>new THREE.Vector2(p[0],p[1])),[])) ti.push(a,c,b);
    dg.setIndex(ti); dg.computeVertexNormals(); const dm=new THREE.Mesh(dg,DEF_MAT[d.type]); dm.userData.part='piece'; dm.userData.pieceId=q.id; g.add(dm); }
  // pièce gardée : contour orange sur la face du dessus
  if(q.id===cut.keep && onTable().length>1){ const loop=top.map(([u,v])=>new THREE.Vector3(u/1000,(T+0.8)/1000,v/1000)); loop.push(loop[0].clone());
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop),LINE_KEEP)); }
  pieceRoot.add(g); q.group=g; q.mesh=mesh; place(q);
  partMeshes.piece=pieces.filter(p=>p.group).flatMap(p=>p.group.children.filter(c=>c.isMesh)); app.stage.dirty(); }
export function place(q){ if(q.group){ q.group.position.set(q.tx,TABLE_Y,q.tz); q.group.rotation.y=q.rev?Math.PI:0; } app?.stage.dirty(); }

/* ---------- coupe ---------- */
/* course de la tête nécessaire pour que la lame sorte entièrement des pièces (0 à 1) */
export function strokeNeeded(){ const a=st.alpha*Math.PI/180, sa=Math.sin(a), ca=Math.cos(a); let t=-1e9;
  for(const q of onTable()){ const {bot}=faces(q); for(const [u,v] of bot){ const [x,z]=toScene(q,u,v); t=Math.max(t, x*sa+(z-Z_PIV)*ca); } }
  if(t<-1e8) return 0.45; return Math.max(0.25, Math.min(1, (t+0.07-(Z_PARK-Z_PIV))/STROKE)); }
/* la lame passe : chaque pièce traversée est séparée en deux (trait de 4 mm retiré) ; rend les pièces obtenues */
export function sawThrough(handXZ){
  const { N, D }=bladePlane(), k=KERF/2000, meta={ raw:false, alpha:st.alpha, beta:st.beta }, out=[];
  for(const q of onTable()){ const A0=area(faces(q).bot), pressed=againstGuide(q);
    const L=split(q,localPlane(q,N,D-k,meta)), R=split(q,localPlane(q,N.map(x=>-x),-D-k,meta));
    const parts=[L,R].filter(Boolean);
    if(parts.length===2 || (parts.length===1 && area(faces(parts[0]).bot)<A0-1)){
      dispose(q); pieces.splice(pieces.indexOf(q),1);
      for(const p of parts){ p.id=++uid; p.gen=cut.cuts+1; p.kind=autoKind(p); pieces.push(p); out.push(p); if(pressed) toGuide(p); } } }   // la main garde la pièce plaquée contre le guide
  cut.cuts++;
  // pièce gardée : celle que tient la main, sinon celle de gauche (la planche)
  const held=handXZ? out.find(p=>{ const [u,v]=toLocal(p,...handXZ); return inPoly(faces(p).top,u,v); }) : null;
  const side=p=>{ const P=faces(p).bot; let x=0,z=0; for(const [u,v] of P){ const [a,b]=toScene(p,u,v); x+=a/P.length; z+=b/P.length; } return N[0]*x+N[1]*TABLE_Y+N[2]*z-D; };
  const keep=held || out.slice().sort((a,b)=>side(a)-side(b))[0];
  cut.keep=out.length>1&&keep? keep.id : null;
  for(const p of out) build(p);
  return out; }
function split(q,pl){ const p={ ...q, planes:[...q.planes,pl], group:null, _f:null, _m:null };
  const {bot,top,botM,topM}=faces(p); if(bot.length<3||top.length<3) return null;
  const e=uExt(bot,botM); if(!e||e[1]-e[0]<3||area(bot)<60) return null;
  const used=new Set([...botM,...topM]); p.planes=p.planes.filter(x=>used.has('p'+x.id)); p._f=null; return p; }

/* ---------- position sur la table ---------- */
/* la planche reste contre ou devant le guide, à droite de la servante, à gauche de la butée en service ; rend 'butee' si la butée l'arrête */
export function clampPiece(q){ if(!q) return ''; let hit='';
  let e=extent(q); if(e.z0<FENCE_Z){ q.tz+=FENCE_Z-e.z0; }
  e=extent(q); if(st.stopOn && e.x1>stopX()+1e-6){ q.tx-=e.x1-stopX(); hit='butee'; }
  e=extent(q); if(e.x0<SERV_X0){ q.tx+=SERV_X0-e.x0; } if(e.x1>EXT_X1){ q.tx-=e.x1-EXT_X1; }
  if(e.z1>0.40){ q.tz-=e.z1-0.40; }
  place(q); return hit; }
export const againstGuide=q=>!!q && Math.abs(extent(q).z0-FENCE_Z)<0.0008;
export const againstStop=q=>!!q && st.stopOn && Math.abs(extent(q).x1-stopX())<0.0006;
export function toGuide(q){ q.tz-=extent(q).z0-FENCE_Z; place(q); }
export function toStop(q){ q.tx+=stopX()-extent(q).x1; place(q); }
export function nudge(q,dx,dz=0){ q.tx+=dx; q.tz+=dz; return clampPiece(q); }
export function endForEnd(q){ const a=extent(q), cx=(a.x0+a.x1)/2, cz=(a.z0+a.z1)/2; q.rev=!q.rev; q._f=null;
  const b=extent(q); q.tx+=cx-(b.x0+b.x1)/2; q.tz+=cz-(b.z0+b.z1)/2; build(q); clampPiece(q); }

/* ---------- pièces débitées ---------- */
const toStock=(q,kind)=>{ q.state='stock'; q.kind=kind; dispose(q); };
export function setKeep(id){ const t=onTable(); if(t.length<2||!t.some(q=>q.id===id)) return false; cut.keep=id; for(const q of t) build(q); return true; }
/* retire de la table toutes les pièces sauf la pièce gardée */
export function evacuate(){ const k=keepPiece(), t=onTable(); if(t.length<2) return 'Une seule pièce sur la table : rien à évacuer. « Mettre de côté » pour la ranger.';
  for(const q of t) if(q!==k) toStock(q,autoKind(q)); cut.keep=null; if(k) build(k); return ''; }
/* remet la pièce gardée en position de coupe : contre le guide, et contre la butée si elle est en service */
export function bringBack(){ const t=onTable(); if(!t.length) return 'Aucune pièce sur la table.';
  if(t.length>1) return 'Évacuez d\'abord les chutes (« Évacuer les chutes ») : seule la pièce gardée (contour orange) reste sur la table.';
  const q=t[0]; toGuide(q); if(st.stopOn) toStop(q); clampPiece(q); return ''; }
export function aside(){ const t=onTable(); if(!t.length) return 'Aucune pièce sur la table.'; for(const q of t) toStock(q,autoKind(q)); cut.keep=null; return ''; }
export function setKind(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(q) q.kind=q.kind==='piece'?'chute':'piece'; }
/* reprend une pièce rangée : table libre ; posée contre le guide, son bout droit juste à gauche de la lame */
export function take(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(!q) return '';
  if(onTable().length) return 'Libérez d\'abord la table (« Mettre de côté »).';
  q.state='table'; q._f=null; q._m=null; const e=extent(q); q.tx+=-0.04-e.x1; q.tz+=FENCE_Z-e.z0; build(q); clampPiece(q); return ''; }
export const produced=()=>pieces.filter(q=>q.gen>0);
