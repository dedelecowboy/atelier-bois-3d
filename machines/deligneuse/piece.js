/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Pièces sur la déligneuse : forme (avivé ou plateau en flache), orientation, position en travers,
   passe entraînée par le tapis, découpe par les plans des lames, pièces débitées.

   Repère local d'une pièce : u le long (bout A en u = 0), v en travers (0 à W, mm), w dans l'épaisseur
   (face A en w = 0, face B en w = T). À chaque station le long de la pièce, chaque rive est une droite
   entre l'arête de la face A et celle de la face B : a1→b1 (rive basse), a2→b2 (rive haute).
   Rive d'un avivé : a = b (chant scié d'équerre). Rive d'un plateau : a ≠ b (flache).
   Un trait de scie est un plan vertical v = c : la matière est bornée par max(c1, rive basse) et min(c2, rive haute).
   Orientation : flip (retourné : face B sur le tapis), rev (bout pour bout : le bout B entre en premier).
   Dans la scène : x = sens d'avance (la pièce va vers −X), bout avant en xLead ; z = zPos + v (ou W − v si la
   pièce est en miroir : retournée OU bout pour bout, pas les deux). */
import * as THREE from 'three';
import { canvasTex } from '../../engine/kit.js';
import { TABLE_Y, KERF, LEAD0, EXIT_X, HARD, CAP } from './constants.js';
import { st, bladeZ, guideZ, $ } from './state.js';

const N = 21;
let app=null, pieceRoot=null, partMeshes=null, uid=0;
export function initPieces(a, model){ app=a; pieceRoot=model.pieceRoot; partMeshes=a.parts.partMeshes; }

/* ---------- état ---------- */
export const pieces=[];   // toutes les pièces du mode : state 'entry' | 'moving' | 'exit' | 'stock'
export const cut={ inProgress:false, src:null, outs:[], x0:LEAD0, x1:0, passes:0, maxLoad:0, lastMsg:'', msgSeq:0, blocked:'', keep:null };
export const exitPieces=()=>pieces.filter(q=>q.state==='exit');
export const keepPiece=()=>pieces.find(q=>q.id===cut.keep && q.state==='exit')||null;
const SPEEDUP=4;   // l'animation va 4 fois plus vite que l'avance réelle du tapis
export const entry=()=>pieces.find(q=>q.state==='entry')||null;
/* pièce sur la machine : à l'entrée, ou en cours de sciage */
export const cur=()=>cut.inProgress? cut.src : entry();
/* plans de coupure du rendu pendant la passe : la pièce entière à droite des lames, les pièces sciées à gauche */
const planeIn=new THREE.Plane(new THREE.Vector3(1,0,0),100), planeOut=new THREE.Plane(new THREE.Vector3(-1,0,0),100);
function setClip(on){ planeIn.constant= on?0:100; planeOut.constant= on?0:100; }

/* ---------- création ---------- */
/* spec : {L, T, wood, kind:'avive'|'plateau', W (avivé), A:[[a1,a2]…] et B:[[b1,b2]…] (plateau, N stations), flip, rev, name} */
export function newPiece(spec){
  const p={ id:++uid, L:spec.L, T:spec.T, wood:spec.wood||'sapin', a1:[],a2:[],b1:[],b2:[], c1:-1e9, c2:1e9, line:['scie','scie'],
    flip:!!spec.flip, rev:!!spec.rev, zPos:spec.zPos??-0.10, xLead:LEAD0, state:'entry', gen:0, group:null, role:'in' };
  if(spec.kind==='avive'){ for(let i=0;i<N;i++){ p.a1.push(0); p.b1.push(0); p.a2.push(spec.W); p.b2.push(spec.W); } }
  else { for(let i=0;i<N;i++){ p.a1.push(spec.A[i][0]); p.a2.push(spec.A[i][1]); p.b1.push(spec.B[i][0]); p.b2.push(spec.B[i][1]); } p.line=['flache','flache']; }
  normalize(p); pieces.push(p); build(p); return p; }
/* origine de v sur la matière la plus basse ; W = encombrement en travers */
function normalize(p){ let lo=1e9, hi=-1e9;
  for(let i=0;i<N;i++){ lo=Math.min(lo,bLow(p,i,0),bLow(p,i,p.T)); hi=Math.max(hi,bHigh(p,i,0),bHigh(p,i,p.T)); }
  for(const k of ['a1','a2','b1','b2']) p[k]=p[k].map(x=>x-lo); if(p.c1>-1e8) p.c1-=lo; if(p.c2<1e8) p.c2-=lo;
  p.W=hi-lo; return lo; }
export function clearPieces(){ for(const p of pieces) dispose(p); pieces.length=0; partMeshes.piece=[]; cut.inProgress=false; cut.src=null; cut.outs=[]; cut.keep=null; setClip(false); }
function dispose(p){ if(p.group){ pieceRoot.remove(p.group); p.group.traverse(o=>o.geometry?.dispose()); p.group=null; } }

/* ---------- géométrie ---------- */
const lerp=(a,b,t)=>a+(b-a)*t;
/* bornes de la matière à la profondeur w (mm depuis la face A) */
const bLow =(p,i,w)=>Math.max(p.c1, lerp(p.a1[i],p.b1[i],w/p.T));
const bHigh=(p,i,w)=>Math.min(p.c2, lerp(p.a2[i],p.b2[i],w/p.T));
export const mirror=p=>p.flip!==p.rev;
/* largeur de chaque face, largeur sans flache (pleine épaisseur), à la station i */
const faceW=(p,i,face)=>{ const w=face==='A'?0:p.T; return Math.max(0,bHigh(p,i,w)-bLow(p,i,w)); };
const cleanW=(p,i)=>Math.max(0,Math.min(p.c2,p.a2[i],p.b2[i])-Math.max(p.c1,p.a1[i],p.b1[i]));
const downFace=p=>p.flip?'B':'A', upFace=p=>p.flip?'A':'B';
/* station de la scène (de l'avant vers l'arrière) → station de la pièce */
const stIdx=(p,k)=>p.rev? N-1-k : k;

/* mesures d'une pièce */
export function measure(p){ let wc=1e9, fl=false, sawLo=true, sawHi=true;
  for(let i=0;i<N;i++){ wc=Math.min(wc,cleanW(p,i));
    const lo0=bLow(p,i,0), loT=bLow(p,i,p.T), hi0=bHigh(p,i,0), hiT=bHigh(p,i,p.T);
    if(Math.abs(lo0-loT)>0.3 || Math.abs(hi0-hiT)>0.3) fl=true;
    if(!(p.c1>-1e8 && p.c1>=Math.max(p.a1[i],p.b1[i])-1e-6) && p.line[0]!=='scie') sawLo=false;
    if(!(p.c2<1e8 && p.c2<=Math.min(p.a2[i],p.b2[i])+1e-6) && p.line[1]!=='scie') sawHi=false; }
  const kind= p.W<12 || wc<8 ? 'délignure' : fl ? 'avec flache' : 'avivé';
  return { W:wc, Wmax:p.W, flache:fl, sawn:(sawLo?1:0)+(sawHi?1:0), kind, L:p.L, T:p.T }; }
/* largeur moyenne de la face posée sur le tapis et de la face du dessus ; largeur aux deux bouts */
export function faceStats(p){ let d=0,u=0; for(let i=0;i<N;i++){ d+=faceW(p,i,downFace(p)); u+=faceW(p,i,upFace(p)); }
  const end=k=>{ const i=stIdx(p,k); return (faceW(p,i,'A')+faceW(p,i,'B'))/2; };
  return { down:d/N, up:u/N, lead:end(0), trail:end(N-1) }; }
/* la rive côté guide (−Z) est-elle en flache ? */
export function guideSideFlache(p){ const low=!mirror(p);
  for(let i=0;i<N;i++){ const A=low? bLow(p,i,0):bHigh(p,i,0), B=low? bLow(p,i,p.T):bHigh(p,i,p.T); if(Math.abs(A-B)>0.3) return true; } return false; }

/* ---------- découpe par les plans des lames ---------- */
function kerfs(p, zs){ return zs.map(z=>{ const zr=(z-p.zPos)*1000, v=mirror(p)? p.W-zr : zr; return [v-KERF/2, v+KERF/2]; })
  .filter(([a,b])=>b>0 && a<p.W).sort((x,y)=>x[0]-y[0]); }
/* lames qui scient réellement la pièce */
export function bladesIn(p, zs=bladeZ()){ return kerfs(p,zs).length; }
/* pièces obtenues si la pièce passe maintenant (sans rien modifier) : [{lo, hi, piece (données)}] */
export function predict(p, zs=bladeZ()){ const K=kerfs(p,zs), out=[]; let lo=-1e9;
  for(const [a,b] of K){ out.push([lo,a]); lo=b; } out.push([lo,1e9]);
  return out.map(([lo,hi])=>strip(p,lo,hi)).filter(Boolean); }
function strip(p, lo, hi){
  const q={ ...p, id:0, a1:p.a1.slice(), a2:p.a2.slice(), b1:p.b1.slice(), b2:p.b2.slice(), c1:Math.max(p.c1,lo), c2:Math.min(p.c2,hi), line:p.line.slice(), group:null };
  let mn=1e9, mx=-1e9; for(let i=0;i<N;i++){ mn=Math.min(mn,bLow(q,i,0),bLow(q,i,q.T)); mx=Math.max(mx,bHigh(q,i,0),bHigh(q,i,q.T)); }
  if(mx-mn<0.5) return null;
  // la matière doit exister quelque part (pas seulement un trait dans le vide)
  let any=false; for(let i=0;i<N;i++) if(bHigh(q,i,0)-bLow(q,i,0)>0.3||bHigh(q,i,q.T)-bLow(q,i,q.T)>0.3) any=true; if(!any) return null;
  const shift=normalize(q);
  q.zPos = mirror(p)? p.zPos+(p.W-mx)/1000 : p.zPos+shift/1000;
  return q; }

/* ---------- textures ---------- */
const WOOD={ sapin:['#e6cfa4','#c9a877','#f2e2c2'], hetre:['#d9ab83','#c08b63','#e8c4a0'], chene:['#c99d68','#9c7448','#dcb88a'] };
const texCache={};
function woodTex(wood,kind){ const key=wood+kind; if(texCache[key]) return texCache[key];
  const [base,dark,light]=WOOD[wood]||WOOD.sapin; let s=17; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const t=canvasTex(1024,128,(g,w,h)=>{
    if(kind==='bark'){ g.fillStyle='#b99566'; g.fillRect(0,0,w,h);                       // flache : aubier en partie écorcé, restes d'écorce
      for(let i=0;i<45;i++){ const x=rnd()*w, y=rnd()*h, rw=60+rnd()*260, rh=10+rnd()*60; g.fillStyle=`rgba(${70+rnd()*30},${52+rnd()*20},${38+rnd()*15},${0.75+rnd()*0.25})`;
        g.beginPath(); g.ellipse(x,y,rw/2,rh/2,0,0,7); g.fill(); }
      for(let i=0;i<160;i++){ g.strokeStyle=`rgba(30,22,16,${0.3+rnd()*0.4})`; g.lineWidth=1+rnd()*2; const x=rnd()*w, y=rnd()*h, l=15+rnd()*60; g.beginPath(); g.moveTo(x,y); g.lineTo(x+l,y+(rnd()-0.5)*6); g.stroke(); }
      return; }
    if(kind==='end'){ g.fillStyle=base; g.fillRect(0,0,w,h); for(let r=6;r<w;r+=7){ g.strokeStyle=`rgba(90,60,30,${0.2+rnd()*0.2})`; g.lineWidth=1.5; g.beginPath(); g.arc(w*0.5,h*2.2,r,0,7); g.stroke(); } return; }
    // bois scié : terne, fibres, stries de sciage en arcs de cercle (lame circulaire)
    g.fillStyle=dark; g.fillRect(0,0,w,h); g.fillStyle=base; g.globalAlpha=0.7; g.fillRect(0,0,w,h); g.globalAlpha=1;
    g.fillStyle='rgba(120,112,100,.25)'; g.fillRect(0,0,w,h);
    for(let i=0;i<14;i++){ const y0=i*h/14+rnd()*4; g.strokeStyle=i%3?`rgba(90,55,25,${0.25+rnd()*0.2})`:`rgba(245,225,190,.35)`; g.lineWidth=2+rnd()*2; g.beginPath();
      for(let x=0;x<=w;x+=16){ const y=y0+Math.sin(x*0.01+i)*2; x?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); }
    for(let x=0;x<w;x+=10+rnd()*6){ g.strokeStyle=`rgba(60,40,20,${0.10+rnd()*0.12})`; g.lineWidth=1.5; g.beginPath(); g.arc(x+180,h/2,190,Math.PI*0.88,Math.PI*1.12); g.stroke(); }
    for(let i=0;i<600;i++){ g.fillStyle=rnd()<0.5?`rgba(40,26,14,${0.2+rnd()*0.25})`:`rgba(240,220,185,${0.2+rnd()*0.2})`; g.fillRect(rnd()*w,rnd()*h,1+rnd()*3,1+rnd()*2); } });
  t.wrapS=THREE.RepeatWrapping; return texCache[key]=t; }
const matCache={}, LINE_KEEP=new THREE.LineBasicMaterial({color:0xd27a1c});
function mats(p){ const clip=p.role==='out'?planeOut:planeIn, key=p.wood+p.role; if(matCache[key]) return matCache[key];
  const m=(kind)=>{ const map=woodTex(p.wood,kind); return kind==='saw'? new THREE.MeshStandardMaterial({map,roughness:0.95,bumpMap:map,bumpScale:1.5,clippingPlanes:[clip],side:THREE.DoubleSide})
    : new THREE.MeshStandardMaterial({map,roughness:kind==='bark'?1:0.85,bumpMap:kind==='bark'?map:null,bumpScale:3,clippingPlanes:[clip],side:THREE.DoubleSide}); };
  return matCache[key]=[m('saw'),m('bark'),m('end')]; }

/* ---------- maillage ---------- */
/* section à la station i : 6 points (v, w) — rive basse en w = 0, wm, T ; rive haute en T, wm, 0 —
   et nature de chaque demi-rive (sciée ou flache) */
function section(p,i){ const T=p.T;
  const side=(lineA,lineB,c,low)=>{   // point de cassure entre le trait de scie et la flache
    const L=w=>lerp(lineA,lineB,w/T), cut=low? c>-1e8 : c<1e8; let wm=T/2;
    if(cut){ const d=lineB-lineA; if(Math.abs(d)>1e-6){ wm=Math.max(0,Math.min(T,(c-lineA)/d*T)); } else wm=T/2; }
    const at=w=> low? Math.max(c,L(w)) : Math.min(c,L(w));
    const sawn=w=> cut && (low? c>=L(w)-1e-6 : c<=L(w)+1e-6);
    return { pts:[[at(0),0],[at(wm),wm],[at(T),T]], lower:sawn(wm*0.5), upper:sawn((wm+T)*0.5) }; };
  const lo=side(p.a1[i],p.b1[i],p.c1,true), hi=side(p.a2[i],p.b2[i],p.c2,false);
  return { pts:[...lo.pts, ...hi.pts.slice().reverse()], lo, hi }; }
export function build(p){ dispose(p); if(p.state==='stock') return;
  const L=p.L/1000, T=p.T, mir=mirror(p), sec=[];
  for(let k=0;k<N;k++){ const i=stIdx(p,k), s=section(p,i), x=k/(N-1)*L;
    const P=s.pts.map(([v,w])=>[x,(p.flip?T-w:w)/1000,(mir?p.W-v:v)/1000]); sec.push({P,s}); }
  const pos=[],uv=[],idx=[[],[],[]];
  const vtx=(q,u,v)=>{ pos.push(...q); uv.push(u,v); return pos.length/3-1; };
  // bande entre les points a et b des sections, matériau choisi par segment ; sens d'enroulement d'après la normale voulue
  const band=(a,b,hint,matOf)=>{ for(let k=0;k<N-1;k++){ const A=sec[k].P[a],B=sec[k].P[b],C=sec[k+1].P[a],D=sec[k+1].P[b];
      const u0=k/(N-1)*p.L/1000, u1=(k+1)/(N-1)*p.L/1000;   // texture répétée tous les mètres
      const i0=vtx(A,u0,0),i1=vtx(B,u0,1),i2=vtx(C,u1,0),i3=vtx(D,u1,1);
      const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]], n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
      const ok=n[0]*hint[0]+n[1]*hint[1]+n[2]*hint[2]>=0, m=matOf(k);
      if(ok) idx[m].push(i0,i1,i2, i1,i3,i2); else idx[m].push(i0,i2,i1, i1,i2,i3); } };
  const yA=p.flip?1:-1, zLo=mir?1:-1;
  band(0,5,[0,yA,0],()=>0); band(2,3,[0,-yA,0],()=>0);
  const sideMat=(which,part,line)=>k=>{ const a=sec[k].s[which][part], b=sec[k+1].s[which][part]; return a&&b?0: line==='scie'?0:1; };
  band(0,1,[0,0,zLo],sideMat('lo','lower',p.line[0])); band(1,2,[0,0,zLo],sideMat('lo','upper',p.line[0]));
  band(5,4,[0,0,-zLo],sideMat('hi','lower',p.line[1])); band(4,3,[0,0,-zLo],sideMat('hi','upper',p.line[1]));
  for(const [k,sx] of [[0,-1],[N-1,1]]){ const P=sec[k].P, c=P.reduce((a,q)=>[a[0]+q[0]/6,a[1]+q[1]/6,a[2]+q[2]/6],[0,0,0]); const ic=vtx(c,0.5,0.5);
    for(let j=0;j<6;j++){ const A=P[j],B=P[(j+1)%6]; const ia=vtx(A,(A[2]*1000)/p.W,A[1]*1000/T), ib=vtx(B,(B[2]*1000)/p.W,B[1]*1000/T);
      const e1=[A[0]-c[0],A[1]-c[1],A[2]-c[2]], e2=[B[0]-c[0],B[1]-c[1],B[2]-c[2]], nx=e1[1]*e2[2]-e1[2]*e2[1];
      if(nx*sx>=0) idx[2].push(ic,ia,ib); else idx[2].push(ic,ib,ia); } }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const all=[...idx[0],...idx[1],...idx[2]]; geo.setIndex(all); geo.addGroup(0,idx[0].length,0); geo.addGroup(idx[0].length,idx[1].length,1); geo.addGroup(idx[0].length+idx[1].length,idx[2].length,2);
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mats(p)); mesh.castShadow=mesh.receiveShadow=true; mesh.userData.part='piece'; mesh.userData.pieceId=p.id;
  const g=new THREE.Group(); g.add(mesh);
  if(p.state==='exit' && p.id===cut.keep && exitPieces().length>1){   // pièce gardée : contour orange sur la face du dessus
    const [a,b]=p.flip?[0,5]:[2,3], lift=v=>new THREE.Vector3(v[0],v[1]+0.0008,v[2]);
    const loop=[...sec.map(q=>lift(q.P[a])),...sec.slice().reverse().map(q=>lift(q.P[b]))]; loop.push(loop[0].clone());
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop),LINE_KEEP)); } pieceRoot.add(g); p.group=g; p.mesh=mesh; place(p);
  partMeshes.piece=pieces.filter(q=>q.group).map(q=>q.mesh); app.stage.dirty(); }
export function place(p){ if(p.group) p.group.position.set(p.xLead,TABLE_Y,p.zPos); }

/* hauteur du dessus de la pièce (m) au point (x, z) de la scène, 0 hors de la pièce */
function heightAt(p,x,z){ if(!p.group) return 0; const L=p.L/1000; if(x<p.xLead||x>p.xLead+L) return 0;
  if(cut.inProgress && ((p===cut.src&&x<0)||(cut.outs.includes(p)&&x>0))) return 0;
  const k=Math.min(N-1,Math.round((x-p.xLead)/L*(N-1))), i=stIdx(p,k), zr=(z-p.zPos)*1000, v=mirror(p)?p.W-zr:zr;
  for(let j=8;j>=0;j--){ const y=p.T*j/8, w=p.flip?p.T-y:y; if(v>=bLow(p,i,w)-1e-6 && v<=bHigh(p,i,w)+1e-6) return y/1000; }   // du dessus vers le tapis
  return 0; }
export const under=(x,z)=>{ let h=0; for(const p of pieces) if(p.group) h=Math.max(h,heightAt(p,x,z)); return h; };
/* surface éclairée par le laser : pièce à l'entrée (ou qui entre) */
export const surf=(x,z)=>{ const p=cut.inProgress?cut.src:entry(); return p?heightAt(p,x,z):0; };
export const laserKey=()=>{ const p=cut.inProgress?cut.src:entry(); return p?[p.id,+p.xLead.toFixed(4),+p.zPos.toFixed(4),p.flip,p.rev]:0; };

/* ---------- charge du moteur (ampèremètre, %) ---------- */
export function load(p=cur()){ if(!p) return 0; const n=bladesIn(p); if(!n) return 0; return Math.round(st.v*p.T*n*(HARD[p.wood]||1)/CAP*100); }

/* ---------- passe ---------- */
export const againstGuide=p=>!!p && st.guideUp && Math.abs(p.zPos-guideZ())<0.0008;
export function startPass(blockWhy){ const p=entry(); cut.blocked='';
  if(cut.inProgress) return '';
  if(exitPieces().length) return 'Dégagez d\'abord la sortie : « Évacuer les chutes » puis « Ramener la pièce », ou « Mettre de côté ».';
  if(!p) return 'Pas de pièce à l\'entrée : « Ramener la pièce », « Reprendre » dans « Pièces débitées », ou « Nouvelle pièce ».';
  const why=blockWhy(p); if(why) return why;
  cut.maxLoad=Math.max(cut.maxLoad,load(p));
  app.recordDangers();                              // faute grave : alerte danger active au moment d'engager la pièce
  const outs=predict(p).map(q=>{ q.id=++uid; q.state='moving'; q.role='out'; q.gen=cut.passes+1; return q; });
  p.state='moving'; cut.src=p; cut.outs=outs; pieces.push(...outs);
  for(const q of outs) build(q);
  cut.x0=p.xLead; cut.x1=EXIT_X-p.L/1000; cut.inProgress=true; setClip(true); return ''; }
/* vitesse du tapis à l'affichage (m/s) */
export const chainSpeed=()=>st.v/60*SPEEDUP;
/* la pièce avance avec le tapis (immobile si le tapis est arrêté) ; rend la distance parcourue, ou 0 */
export function tickPass(now){ const dt=Math.min(0.5,now-(cut.tPrev??now)); cut.tPrev=now;   // temps réel (pas le pas d'image plafonné)
  if(!cut.inProgress || !st.tapis) return 0;
  const x=Math.max(cut.x1, cut.src.xLead-chainSpeed()*dt), d=cut.src.xLead-x;
  for(const q of [cut.src,...cut.outs]){ q.xLead=x; place(q); }
  if(x<=cut.x1){ const src=cut.src; pieces.splice(pieces.indexOf(src),1); dispose(src);
    for(const q of cut.outs){ q.state='exit'; q.role='out'; }
    cut.passes++; cut.inProgress=false; setClip(false);
    const ms=cut.outs.map(q=>({q,m:measure(q)})), useful=ms.filter(o=>o.m.kind!=='délignure');
    const keep=(useful.length?useful:ms).slice().sort((a,b)=>b.m.Wmax-a.m.Wmax)[0];
    cut.keep=keep?keep.q.id:null; for(const q of cut.outs) build(q);
    cut.lastMsg=`Passe terminée : ${ms.length} pièce${ms.length>1?'s':''} sortie${ms.length>1?'s':''} (${ms.map(o=>label(o.m)).join(' ; ')}).`
      + (ms.length>1? ` Pièce gardée : ${label(keep.m)} (contour orange) ; cliquez une autre pièce pour la garder. « Évacuer les chutes », puis « Ramener la pièce » pour une nouvelle passe, ou « Mettre de côté ».` : ' « Ramener la pièce » pour une nouvelle passe, ou « Mettre de côté ».');
    cut.msgSeq++; cut.src=null; cut.outs=[]; partMeshes.piece=pieces.filter(q=>q.group).map(q=>q.mesh); }
  return d; }
/* largeur affichée : sans flache pour un avivé, encombrement pour une délignure ou une pièce en flache */
export const label=m=> m.kind==='avivé'? `${fmt(m.W)} mm` : m.kind==='délignure'? `délignure de ${fmt(m.Wmax)} mm` : `${fmt(m.Wmax)} mm en flache (${fmt(m.W)} mm sans flache)`;
export const fmt=(v,n=1)=>(+v).toLocaleString('fr-FR',{minimumFractionDigits:n,maximumFractionDigits:n});

/* ---------- manipulations ---------- */
const autoKind=q=>measure(q).kind==='avivé'?'piece':'chute';
const toStock=(q,kind)=>{ q.state='stock'; q.kind=kind; dispose(q); };
export function setKeep(id){ if(!exitPieces().some(q=>q.id===id)) return false; cut.keep=id; for(const q of exitPieces()) build(q); return true; }
/* retire de la sortie toutes les pièces sauf la pièce gardée (rangées dans « Pièces débitées ») */
export function evacuate(){ const k=keepPiece(); for(const q of exitPieces()) if(q!==k) toStock(q,autoKind(q)); if(k) build(k); }
/* ramène la pièce gardée à l'entrée (la sortie doit être dégagée des autres pièces) */
export function bringBack(){ const k=keepPiece(); if(!k) return 'Aucune pièce à la sortie.';
  if(exitPieces().length>1) return 'Évacuez d\'abord les chutes (« Évacuer les chutes ») : seule la pièce gardée (contour orange) est ramenée.';
  if(entry()) return 'Une pièce est déjà sur la table d\'entrée : mettez-la de côté d\'abord.';
  k.state='entry'; k.role='in'; k.xLead=LEAD0; if(st.guideUp) k.zPos=guideZ(); cut.keep=null; build(k); return ''; }
/* range la pièce gardée (et les autres pièces sorties), ou la pièce de l'entrée */
export function aside(){ const ex=exitPieces();
  if(ex.length){ const k=keepPiece(); for(const q of ex) toStock(q, q===k?'piece':autoKind(q)); cut.keep=null; return ''; }
  const e=entry(); if(!e) return 'Aucune pièce sur la machine.'; toStock(e,'piece'); return ''; }
export function setKind(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(q) q.kind=q.kind==='piece'?'chute':'piece'; }
/* reprend une pièce rangée : machine libre (entrée et sortie dégagées) */
export function take(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(!q||cut.inProgress) return '';
  if(entry()||exitPieces().length) return 'Libérez d\'abord la machine : entrée et sortie dégagées (« Mettre de côté »).';
  q.state='entry'; q.role='in'; q.xLead=LEAD0; if(st.guideUp) q.zPos=guideZ(); build(q); return ''; }
export function flip(p){ p.flip=!p.flip; build(p); }
export function endForEnd(p){ p.rev=!p.rev; build(p); }
export function toGuide(p){ p.zPos=guideZ(); place(p); }
export function nudge(p,dz){ p.zPos+=dz; clampZ(p); place(p); }
export function clampZ(p){ if(!p) return; if(st.guideUp) p.zPos=Math.max(p.zPos,guideZ()); p.zPos=Math.max(-0.47,Math.min(0.31-p.W/1000,p.zPos)); place(p); }
