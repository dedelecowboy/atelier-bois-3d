/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Pièces sur la scie à ruban : grille en plan, avance et trait de scie, séparation des morceaux, maillage 3D.

   Une pièce est décrite en plan, dans le plan de la table : sa trace au sol (« empreinte ») est une grille de cases
   de RES mm (repère local u le long, v en travers, origine dans un coin), sa hauteur H est l'épaisseur au-dessus de
   la table (pièce à plat : l'épaisseur ; pièce sur chant : la largeur). La lame retire les cases à moins d'une demi-voie
   du point de coupe ; quand le trait ressort de la pièce, les morceaux séparés deviennent des pièces. Une pièce ronde
   (rondin) a une coupe en travers en disque.

   Table (mm) : x vers la droite, z vers l'opérateur, origine au point de coupe (lame en x = 0, pointe des dents en z = 0).
   Pose d'une pièce : x = tx + u·cos θ − v·sin θ ; z = tz + u·sin θ + v·cos θ. La pièce avance vers −z. */
import * as THREE from 'three';
import { canvasTex } from '../../engine/kit.js';
import { TABLE_X0, TABLE_X1, TABLE_Z0, TABLE_Z1, RES, NEAR } from './constants.js';
import { st, voie } from './state.js';

let app=null, pieceRoot=null, partMeshes=null, uid=0;
export function initPieces(a, model){ app=a; pieceRoot=model.pieceRoot; partMeshes=a.parts.partMeshes; }

/* ---------- état ---------- */
export const pieces=[];   // toutes les pièces du mode : state 'table' | 'stock'
export const cut={ keep:null, lastMsg:'', msgSeq:0, bx:0, inWood:false, entered:false, rec:null, forcing:false, kappa:0, sinceMesh:0, cuts:0 };
export const onTable=()=>pieces.filter(q=>q.state==='table');
export const keepPiece=()=>{ const t=onTable(); return t.length===1? t[0] : t.find(q=>q.id===cut.keep)||null; };
export const cur=()=>keepPiece();
export const fmt=(v,n=1)=>(+v).toLocaleString('fr-FR',{minimumFractionDigits:n,maximumFractionDigits:n});
const WOOD={ hetre:{c:'#d9b48a',d:'#b98d5f',n:'hêtre'}, chene:{c:'#c9a172',d:'#8f6a3e',n:'chêne'}, sapin:{c:'#e3c595',d:'#c39a5e',n:'sapin'} };

/* ---------- création ----------
   spec : { name, wood, L, W, T (mm), round (Ø = W = T), trace:{ segs, waste:+1|−1, keep:[u,v], rmin } (en plan à plat),
            at:'front' (posée devant la lame, à plat) } */
export function newPiece(spec){
  const q={ id:++uid, name:spec.name||'', wood:spec.wood||'hetre', L:spec.L, W:spec.W, T:spec.T, round:!!spec.round,
    chant:false, gab:false, state:'table', gen:0, kind:spec.round?'rond':'piece', group:null, tx:0, tz:0, th:0,
    origin:{ trace: spec.trace? traceOf(spec.trace) : null, paths:[], L:spec.L, W:spec.W, tex:null }, slice:null, cutRec:null };
  q.origin.root=q; makeMask(q); pieces.push(q); parkFront(q); build(q); return q; }
/* grille pleine de l'empreinte (à plat : L × W ; sur chant : L × T ; rondin : L × Ø) */
function makeMask(q){ const fw=q.chant? q.T : q.W, w=Math.ceil(q.L/RES), h=Math.ceil(fw/RES);
  q.m={ ox:0, oy:0, w, h, d:new Uint8Array(w*h).fill(1) }; q.H= q.chant? q.W : q.T; }
export const footW=q=>q.chant? q.T : q.W;
/* pièce posée d'avance dans « Pièces débitées » (à reprendre plus tard dans le scénario) */
export function stockPiece(spec){ const q=newPiece(spec); dispose(q); q.state='stock'; partMeshes.piece=pieces.filter(p=>p.group).flatMap(p=>p.group.children.filter(c=>c.isMesh)); return q; }
export function clearPieces(){ for(const p of pieces) dispose(p); pieces.length=0; partMeshes.piece=[]; Object.assign(cut,{keep:null,blocked:'',rec:null,bx:0,inWood:false,entered:false,forcing:false}); }
function dispose(p){ if(p.group){ pieceRoot.remove(p.group); p.group.traverse(o=>o.geometry?.dispose()); p.group=null; } }

/* ---------- tracé (chantournage) : segments droits et arcs, échantillonné tous les 0,5 mm ---------- */
function traceOf(t){ const P=[]; let [x,y]=t.start, a=t.head||0;
  P.push([x,y]);
  for(const s of t.segs){ const n=Math.max(2,Math.ceil((s.len ?? Math.abs(s.R*s.a*Math.PI/180))/0.5));
    if(s.len!=null){ for(let i=1;i<=n;i++) P.push([x+Math.cos(a)*s.len*i/n, y+Math.sin(a)*s.len*i/n]); x+=Math.cos(a)*s.len; y+=Math.sin(a)*s.len; }
    else { const sg=Math.sign(s.a), R=s.R, cx=x-Math.sin(a)*R*sg, cy=y+Math.cos(a)*R*sg, A=s.a*Math.PI/180;
      for(let i=1;i<=n;i++){ const b=a+A*i/n; P.push([cx+Math.sin(b)*R*sg, cy-Math.cos(b)*R*sg]); }
      a+=A; x=cx+Math.sin(a)*R*sg; y=cy-Math.cos(a)*R*sg; } }
  return { pts:P, waste:t.waste, keep:t.keep, rmin:t.rmin, head0:t.head||0 }; }
/* distance signée d'un point au tracé (> 0 côté chute) et abscisse curviligne du point le plus proche */
export function traceDist(T,u,v){ let best=1e9, sgn=1, k=0; const P=T.pts;
  for(let i=1;i<P.length;i++){ const [x1,y1]=P[i-1],[x2,y2]=P[i], dx=x2-x1, dy=y2-y1, L2=dx*dx+dy*dy||1;
    let t=((u-x1)*dx+(v-y1)*dy)/L2; t=Math.max(i===1?-1e9:0,Math.min(i===P.length-1?1e9:1,t));   /* tracé prolongé à ses deux bouts */
    const px=x1+dx*t, py=y1+dy*t, d=Math.hypot(u-px,v-py);
    if(d<best){ best=d; k=i-1+t; const cr=dx*(v-y1)-dy*(u-x1); sgn= cr>=0? 1 : -1; } }
  return { d:best*sgn*T.waste, k }; }

/* ---------- repères ---------- */
const cs=q=>[Math.cos(q.th),Math.sin(q.th)];
export function toTable(q,u,v){ const [c,s]=cs(q); return [q.tx+u*c-v*s, q.tz+u*s+v*c]; }
export function toLocal(q,x,z){ const [c,s]=cs(q), dx=x-q.tx, dz=z-q.tz; return [dx*c+dz*s, -dx*s+dz*c]; }
export const woodAt=(q,x,z)=>{ const [u,v]=toLocal(q,x,z); return !!cell(q,u,v); };
const cell=(q,u,v)=>{ const i=Math.floor(u/RES)-q.m.ox, j=Math.floor(v/RES)-q.m.oy; return (i<0||j<0||i>=q.m.w||j>=q.m.h)? 0 : q.m.d[j*q.m.w+i]; };
/* coins de l'empreinte (case pleine) dans la table : encombrement */
export function extent(q){ let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; const {ox,oy,w,h}=q.m;
  for(const [u,v] of [[ox,oy],[ox+w,oy],[ox+w,oy+h],[ox,oy+h]].map(([i,j])=>[i*RES,j*RES])){ const [x,z]=toTable(q,u,v); x0=Math.min(x0,x); x1=Math.max(x1,x); z0=Math.min(z0,z); z1=Math.max(z1,z); }
  return {x0,x1,z0,z1}; }
/* distance (mm) de la lame à la pièce, sur la table */
export function distToBlade(q){ const e=extent(q), dx= e.x0>0? e.x0 : e.x1<0? -e.x1 : 0, dz= e.z0>0? e.z0 : e.z1<-40? -40-e.z1 : 0; return Math.hypot(dx,dz); }
export const nearBlade=q=>distToBlade(q)<NEAR;

/* ---------- présentation ---------- */
/* posée à plat devant la lame, à droite, à distance (sur la table, côté opérateur) */
export function parkFront(q){ q.th=0; q.tx=40; q.tz=140; place(q); }
/* au départ du tracé : le point de départ juste devant la lame, le tracé dans l'axe d'avance, lame sur le trait */
export function toTrace(q, off=0){ const T=q.origin.trace; if(!T) return 'Cette pièce n\'a pas de tracé.';
  if(q.chant) setChant(q,false);
  const [u0,v0]=T.pts[0], [u1,v1]=T.pts[6], a=Math.atan2(v1-v0,u1-u0);
  q.th=Math.PI/2-a;                       // la direction du tracé passe vers +z dans la table (la lame avance vers l'opérateur dans la pièce)
  const [c,s]=cs(q); const nu=-Math.sin(a)*T.waste, nv=Math.cos(a)*T.waste;   // normale vers la chute (local)
  const pu=u0-Math.cos(a)*4+nu*off, pv=v0-Math.sin(a)*4+nv*off;        // 4 mm avant l'entrée dans le bois
  q.tx=0-(pu*c-pv*s); q.tz=0-(pu*s+pv*c); place(q); return ''; }
/* contre le guide parallèle (sur chant si demandé) : longueur le long de z, bout de départ à 20 mm devant la lame */
export function toFence(q){ q.th=Math.PI/2; q.tx=voie()/2+st.fx; q.tz=20; place(q); }
/* dans le gabarit (vé) : rondin au milieu de la lame */
export function toGab(q){ q.th=Math.PI/2; q.tx=footW(q)/2; q.tz=20; q.gab=true; place(q); }
/* contre le guide d'onglet (à gauche de la lame) : bout de la pièce à 20 mm devant la lame, orientée selon l'angle */
export function toMiter(q){ const a=(90+st.mit)*Math.PI/180; q.th=a; const [c,s]=cs(q);
  const pu=Math.min(150,q.L/2), pv=0; q.tx=0-(pu*c-pv*s); q.tz=20-(pu*s+pv*c); place(q); }
/* sur chant / à plat (pièce rectangulaire entière seulement) */
export function setChant(q,on){ if(q.round||q.gen>0||q.origin.paths.length) return 'Seule une pièce entière, jamais sciée, se pose sur chant.'; if(q.chant===on) return '';
  q.chant=on; makeMask(q); build(q); return ''; }
export function nudge(q,dx,dz){ q.tx+=dx; q.tz+=dz; place(q); }
export function turn(q,deg){ const a=deg*Math.PI/180, B=[cut.bx,0]; const [x,z]=[q.tx-B[0],q.tz-B[1]];
  q.tx=B[0]+x*Math.cos(a)-z*Math.sin(a); q.tz=B[1]+x*Math.sin(a)+z*Math.cos(a); q.th+=a; place(q); }

/* ---------- mode d'avance ---------- */
/* fence : contre le guide parallèle ; gab : dans le gabarit ; miter : guide d'onglet ; free : à main levée */
export function feedMode(q){ if(!q) return 'free'; if(q.gab) return 'gab';
  if(st.fence && Math.abs(q.th-Math.PI/2)<1e-6 && Math.abs(q.tx-(voie()/2+st.fx))<0.6) return 'fence';
  if(st.mitOn && Math.abs(q.th-(90+st.mit)*Math.PI/180)<1e-6) return 'miter';
  return 'free'; }
export const againstFence=q=>feedMode(q)==='fence';

/* ---------- coupe ----------
   Un pas d'avance de ds mm : rotation éventuelle autour du point de coupe (chantournage), puis translation vers −z.
   Renvoie { done } quand la lame est ressortie de la pièce. */
const KMAX=1/45;   // courbure demandée par ◀ / ▶ (rayon 45 mm), limitée par la largeur de la lame
export function feedStep(q, ds, opt={}){
  const mode=feedMode(q), b=opt.blade;
  // courbure : à main levée seulement ; la lame ne suit pas un rayon plus petit que son rayon mini (elle force)
  let k=0; cut.forcing=false;
  if(mode==='free'){ const want=st.steer*KMAX, lim=b? 1/b.rmin : KMAX; k=Math.max(-lim,Math.min(lim,want)); if(Math.abs(want)>lim+1e-9 && cut.inWood) cut.forcing=true;
    k+=(opt.drift||0)*0.002; }
  else if(opt.drift) cut.bx+=opt.drift*ds*0.01;                 // dérive : la lame mal tenue part de côté (mm par 100 mm)
  if(k){ const a=k*ds; turn(q,a*180/Math.PI); }
  q.tz-=ds; cut.kappa=k;
  // point de coupe dans la pièce
  const [u,v]=toLocal(q,cut.bx,0);
  const r=voie()/2; let hit=false;
  { const {ox,oy,w,h,d}=q.m, i0=Math.floor((u-r)/RES)-ox, i1=Math.floor((u+r)/RES)-ox, j0=Math.floor((v-r)/RES)-oy, j1=Math.floor((v+r)/RES)-oy;
    for(let j=Math.max(0,j0);j<=Math.min(h-1,j1);j++) for(let i=Math.max(0,i0);i<=Math.min(w-1,i1);i++){
      const cu=(i+ox+0.5)*RES, cv=(j+oy+0.5)*RES; if(d[j*w+i] && (cu-u)**2+(cv-v)**2<=r*r+RES*RES*0.25){ d[j*w+i]=0; hit=true; } } }
  cut.inWood=hit || woodAhead(q,u,v) || anyWood(q,u,v,1.5);
  if(hit){ if(!cut.entered){ cut.entered=true; cut.rec={ pieceId:q.id, mode, pts:[], blade:b?.id, tilt:st.tilt, fx:st.fx, serv:st.serv, ...(opt.rec||{}) }; q.origin.paths.push(cut.rec); }
    cut.rec.pts.push([u,v]); cut.sinceMesh+=ds; }
  q._m=null;
  /* sortie de la pièce : plus de bois à moins de 6 mm du point de coupe (le long d'un trait déjà fait, il reste du bois de part et d'autre) */
  return { done: cut.entered && !hit && !anyWood(q,u,v,6) }; }
function anyWood(q,u,v,r){ const {ox,oy,w,h,d}=q.m, i0=Math.floor((u-r)/RES)-ox, i1=Math.floor((u+r)/RES)-ox, j0=Math.floor((v-r)/RES)-oy, j1=Math.floor((v+r)/RES)-oy;
  for(let j=Math.max(0,j0);j<=Math.min(h-1,j1);j++) for(let i=Math.max(0,i0);i<=Math.min(w-1,i1);i++) if(d[j*w+i]){ const cu=(i+ox+0.5)*RES-u, cv=(j+oy+0.5)*RES-v; if(cu*cu+cv*cv<=r*r) return true; }
  return false; }
/* reste-t-il du bois juste devant le point de coupe (3 mm) ? */
function woodAhead(q,u,v){ const [c,s]=cs(q), du=s, dv=c;   // direction +z de la table dans le repère local
  for(let t=0.5;t<=3;t+=0.5) if(cell(q,u+du*t, v+dv*t)) return true; return false; }
/* recul de la pièce (sans couper) */
export function backStep(q,ds){ q.tz+=ds; place(q); const [u,v]=toLocal(q,cut.bx,0); cut.inWood=woodAhead(q,u,v)||anyWood(q,u,v,1.5); return !anyWood(q,u,v,6); }
/* courbure du trait sur ses derniers 30 mm (1/mm) : la pièce est-elle engagée dans une courbe ? */
export function inCurve(){ const R=cut.rec; if(!R||!cut.inWood||R.pts.length<20) return false; const P=R.pts, n=P.length;
  const a=P[n-1], b=P[Math.max(0,n-30)], c=P[Math.max(0,n-60)]; if(Math.hypot(a[0]-c[0],a[1]-c[1])<10) return false;
  const h1=Math.atan2(a[1]-b[1],a[0]-b[0]), h2=Math.atan2(b[1]-c[1],b[0]-c[0]); let d=Math.abs(h1-h2); if(d>Math.PI) d=2*Math.PI-d;
  return d>0.04; }

/* fin de coupe : composantes séparées → nouvelles pièces (même pose) */
export function finishCut(){ const q=cur(); cut.entered=false; cut.inWood=false; const rec=cut.rec; cut.rec=null; cut.bx=0;
  if(!q||!rec) return []; cut.cuts++;
  const comps=components(q).filter(c=>c.n*RES*RES>=40);
  let out=[q];
  if(comps.length>1){ const i=pieces.indexOf(q); dispose(q); pieces.splice(i,1);
    out=comps.map(c=>{ const p={ ...q, id:++uid, m:c.m, gen:q.gen+1, group:null, _m:null, gab:false, slice:null };
      if(q.round){ const v0=c.m.oy*RES, v1=(c.m.oy+c.m.h)*RES; p.seg=[Math.max(q.seg?.[0]??0,v0), Math.min(q.seg?.[1]??footW(q),v1)]; }
      return p; });
    pieces.push(...out);
    // la pièce gardée : côté pièce du tracé, sinon la plus grande
    const T=q.origin.trace; let k=null;
    if(T) k=out.find(p=>cell(p,T.keep[0],T.keep[1]));
    if(!k) k=out.slice().sort((a,b)=>area(b)-area(a))[0];
    cut.keep=k.id;
    // refente au guide : épaisseur du morceau entre la lame et le guide, mesurée le long du trait
    if(rec.mode==='fence'){ const s=out.find(p=>p.m.oy*RES<1), V=voie();
      const t=rec.pts.filter(([u])=>u>=0&&u<=q.L).map(([,v])=>v-V/2);
      if(s&&t.length) s.slice={ min:Math.min(...t), max:Math.max(...t), tilt:rec.tilt }; }
    for(const p of out) p.cutRec=rec; }
  for(const p of out) build(p);
  return out; }
function area(q){ let n=0; for(const x of q.m.d) n+=x; return n*RES*RES; }
/* composantes 4-connexes de la grille, recadrées */
function components(q){ const {w,h,d}=q.m, lab=new Int32Array(w*h), out=[]; let L=0; const st_=new Int32Array(w*h);
  for(let s=0;s<w*h;s++){ if(!d[s]||lab[s]) continue; L++; let top=0, n=0, i0=w,i1=0,j0=h,j1=0; st_[top++]=s; lab[s]=L;
    while(top){ const c=st_[--top], i=c%w, j=(c-i)/w; n++; if(i<i0)i0=i; if(i>i1)i1=i; if(j<j0)j0=j; if(j>j1)j1=j;
      for(const nb of [i>0?c-1:-1, i<w-1?c+1:-1, j>0?c-w:-1, j<h-1?c+w:-1]) if(nb>=0&&d[nb]&&!lab[nb]){ lab[nb]=L; st_[top++]=nb; } }
    const cw=i1-i0+1, ch=j1-j0+1, cd=new Uint8Array(cw*ch);
    for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++) if(lab[j*w+i]===L) cd[(j-j0)*cw+(i-i0)]=1;
    out.push({ n, m:{ ox:q.m.ox+i0, oy:q.m.oy+j0, w:cw, h:ch, d:cd } }); }
  return out; }

/* ---------- mesures ---------- */
export function measure(q){ if(q._m) return q._m; const {ox,oy,w,h,d}=q.m; let n=0,i0=w,i1=-1,j0=h,j1=-1;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++) if(d[j*w+i]){ n++; if(i<i0)i0=i; if(i>i1)i1=i; if(j<j0)j0=j; if(j>j1)j1=j; }
  const L=(i1-i0+1)*RES, W=(j1-j0+1)*RES;
  return q._m={ L, W, H:q.H, area:n*RES*RES, u0:(ox+i0)*RES, v0:(oy+j0)*RES }; }
export const label=q=>{ const m=measure(q); return q.round&&q.gen===0? `rondin Ø ${q.W} × ${fmt(m.L,0)}` : q.slice? `lame de ${fmt(q.slice.min)} à ${fmt(q.slice.max)} mm d'épaisseur × ${fmt(m.L,0)}` : `${fmt(m.L,0)} × ${fmt(m.W,0)} × ${fmt(m.H,0)}`; };

/* ---------- maillage : contour des cases pleines (bords orientés, bois à gauche), simplifié ---------- */
function loops(q){ const {w,h,d}=q.m, W1=w+1, nxt=new Map(), on=(i,j)=>i>=0&&j>=0&&i<w&&j<h&&d[j*w+i];
  const add=(a,b)=>{ (nxt.get(a)||nxt.set(a,[]).get(a)).push(b); }, v=(i,j)=>j*W1+i;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){ if(!d[j*w+i]) continue;
    if(!on(i,j-1)) add(v(i,j),v(i+1,j)); if(!on(i+1,j)) add(v(i+1,j),v(i+1,j+1)); if(!on(i,j+1)) add(v(i+1,j+1),v(i,j+1)); if(!on(i-1,j)) add(v(i,j+1),v(i,j)); }
  const out=[];
  for(const [s0] of nxt){ while(nxt.get(s0)?.length){ const L=[]; let a=s0;
    for(let g=0; g<1e6; g++){ const lst=nxt.get(a); if(!lst||!lst.length) break; const b=lst.pop(); if(!lst.length) nxt.delete(a); L.push(a); a=b; if(a===s0) break; }
    if(L.length>3) out.push(L.map(k=>[(k%W1+q.m.ox)*RES,(Math.floor(k/W1)+q.m.oy)*RES])); } }
  return out.map(dp); }
function dp(P){ const tol=RES*0.7; if(P.length<8) return P;
  const keep=new Uint8Array(P.length); keep[0]=keep[P.length-1]=1; const stack=[[0,P.length-1]];
  while(stack.length){ const [a,b]=stack.pop(); let md=0, mi=-1; const [x1,y1]=P[a],[x2,y2]=P[b], L=Math.hypot(x2-x1,y2-y1)||1;
    for(let i=a+1;i<b;i++){ const dd=Math.abs((x2-x1)*(y1-P[i][1])-(x1-P[i][0])*(y2-y1))/L; if(dd>md){ md=dd; mi=i; } }
    if(md>tol){ keep[mi]=1; stack.push([a,mi],[mi,b]); } }
  return P.filter((_,i)=>keep[i]); }
const sArea=P=>{ let a=0; for(let i=0;i<P.length;i++){ const [x1,y1]=P[i],[x2,y2]=P[(i+1)%P.length]; a+=x1*y2-x2*y1; } return a/2; };

const SIDE={}, TOPM={};
function sideMat(wood){ return SIDE[wood]||(SIDE[wood]=new THREE.MeshStandardMaterial({color:WOOD[wood].c,roughness:0.78})); }
function topTex(q){ const O=q.origin; if(O.tex) return O.tex; const Lm=O.L, Wm=Math.max(O.W,q.T), k=Math.min(4,2048/Lm), wd=WOOD[q.wood];
  O.tex=canvasTex(Math.round(Lm*k),Math.round(Wm*k),(g,w,h)=>{ let s=13; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
    g.fillStyle=wd.c; g.fillRect(0,0,w,h);
    for(let i=0;i<60;i++){ const y0=rnd()*h, amp=2+rnd()*6, ph=rnd()*6; g.strokeStyle=`rgba(110,72,36,${0.10+rnd()*0.22})`; g.lineWidth=0.6+rnd()*1.8;
      g.beginPath(); for(let x=0;x<=w;x+=12){ const y=y0+Math.sin(x*0.004+ph)*amp; x?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); }
    const T=O.trace; if(T){ const P=T.pts;
      // zone de chute hachurée, tracé au crayon
      g.save(); g.beginPath(); P.forEach(([u,v],i)=>i?g.lineTo(u*k,v*k):g.moveTo(u*k,v*k)); const big=4000;
      const [ue,ve]=P[P.length-1]; g.lineTo(ue*k+(T.waste>0?0:0),ve*k); g.lineTo(w,T.waste>0? h : 0); g.lineTo(0,T.waste>0? h : 0); g.closePath(); g.clip();
      g.strokeStyle='rgba(60,40,20,.28)'; g.lineWidth=2; for(let x=-h;x<w;x+=14){ g.beginPath(); g.moveTo(x,0); g.lineTo(x+h,h); g.stroke(); }
      g.fillStyle='rgba(60,40,20,.55)'; g.font=`bold ${Math.round(14*k/2)}px sans-serif`; g.fillText('CHUTE',(P[Math.floor(P.length/2)][0])*k,(T.waste>0? h-12 : 26)); g.restore();
      g.strokeStyle='#1b1410'; g.lineWidth=Math.max(1.6,0.8*k); g.beginPath(); P.forEach(([u,v],i)=>i?g.lineTo(u*k,v*k):g.moveTo(u*k,v*k)); g.stroke(); } });
  O.tex.flipY=false; return O.tex; }
const LINE_KEEP=new THREE.LineBasicMaterial({color:0xd27a1c});
export function build(q){ dispose(q); q._m=null; if(q.state!=='table') return;
  const g=new THREE.Group(); let mesh;
  if(q.round){ mesh=roundMesh(q); }
  else { const L=loops(q); if(!L.length) return; L.sort((a,b)=>Math.abs(sArea(b))-Math.abs(sArea(a)));
    const outer=L[0], sh=new THREE.Shape(outer.map(([u,v])=>new THREE.Vector2(u,v)));
    for(const H of L.slice(1)) if(sArea(H)<0) sh.holes.push(new THREE.Path(H.map(([u,v])=>new THREE.Vector2(u,v))));
    const geo=new THREE.ExtrudeGeometry(sh,{ depth:q.H, bevelEnabled:false, curveSegments:1 });
    geo.rotateX(Math.PI/2); geo.translate(0,q.H,0); geo.scale(0.001,0.001,0.001); geo.computeVertexNormals();
    const t=topTex(q), O=q.origin; const top=TOPM[q.origin.root.id+(q.chant?'c':'')]||(TOPM[q.origin.root.id+(q.chant?'c':'')]=new THREE.MeshStandardMaterial({ map:q.chant? null : t, color:q.chant? WOOD[q.wood].c : 0xffffff, roughness:0.75 }));
    if(!q.chant){ t.repeat.set(1/O.L,1/Math.max(O.W,q.T)); }
    mesh=new THREE.Mesh(geo,[top,sideMat(q.wood)]);
    if(q.id===cut.keep && onTable().length>1){ const P=outer.map(([u,v])=>new THREE.Vector3(u/1000,(q.H+0.8)/1000,v/1000)); P.push(P[0].clone());
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(P),LINE_KEEP)); } }
  mesh.castShadow=mesh.receiveShadow=true; mesh.userData.part='piece'; mesh.userData.pieceId=q.id; g.add(mesh);
  pieceRoot.add(g); q.group=g; q.mesh=mesh; place(q);
  partMeshes.piece=pieces.filter(p=>p.group).flatMap(p=>p.group.children.filter(c=>c.isMesh)); app.stage.dirty(); }
/* rondin (ou moitié de rondin) : disque de Ø W (coupé à seg = [v0, v1]) extrudé le long de u */
function roundMesh(q){ const D=q.W, R=D/2, [a,b]=q.seg||[0,D], s=new THREE.Shape(), n=40, pts=[];
  for(let i=0;i<=n;i++){ const t=i/n*2*Math.PI, v=R+R*Math.cos(t), y=R+R*Math.sin(t); pts.push([-Math.max(a,Math.min(b,v)), y]); }
  pts.forEach(([v,y],i)=>i?s.lineTo(v,y):s.moveTo(v,y));
  const {u0,L}=measure(q), geo=new THREE.ExtrudeGeometry(s,{ depth:L, bevelEnabled:false, curveSegments:1 });
  geo.rotateY(Math.PI/2); geo.translate(u0,0,0);                 // forme (−v, y), extrusion le long de u → (u, y, v)
  geo.scale(0.001,0.001,0.001); geo.computeVertexNormals();
  const m=new THREE.MeshStandardMaterial({color:0xb08458,roughness:0.85}); return new THREE.Mesh(geo,[m,sideMat(q.wood)]); }
export function place(q){ if(q.group){ q.group.position.set(q.tx/1000,0,q.tz/1000); q.group.rotation.y=-q.th; } app?.stage.dirty(); }

/* ---------- pièces sur la table ---------- */
export function setKeep(id){ const t=onTable(); if(t.length<2||!t.some(q=>q.id===id)) return false; cut.keep=id; for(const q of t) build(q); return true; }
export const chutes=()=>{ const k=keepPiece(); return onTable().filter(q=>q!==k); };
export function evacuate(){ const k=keepPiece(), t=onTable(); if(t.length<2) return 'Une seule pièce sur la table : rien à évacuer. « Mettre de côté » pour la ranger.';
  for(const q of t) if(q!==k) toStock(q,'chute'); cut.keep=null; if(k) build(k); return ''; }
function toStock(q,kind){ q.state='stock'; q.kind= q.kind==='rond'&&q.gen===0? 'rond' : kind; dispose(q); partMeshes.piece=pieces.filter(p=>p.group).flatMap(p=>p.group.children.filter(c=>c.isMesh)); }
export function aside(){ const t=onTable(); if(!t.length) return 'Aucune pièce sur la table.'; for(const q of t) toStock(q,'piece'); cut.keep=null; return ''; }
/* pièce ronde écartée : à scier dans un gabarit */
export function reject(){ const q=cur(); if(!q) return 'Aucune pièce sur la table.'; toStock(q,'gabarit'); q.kind='gabarit'; return ''; }
export function setKind(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(q&&q.kind!=='rond'&&q.kind!=='gabarit') q.kind=q.kind==='piece'?'chute':'piece'; }
export function take(id){ const q=pieces.find(x=>x.id===id&&x.state==='stock'); if(!q) return '';
  if(onTable().length) return 'Libérez d\'abord la table (« Mettre de côté »).';
  q.state='table'; q.gab=false; parkFront(q); build(q); return ''; }
export const produced=()=>pieces.filter(q=>q.gen>0);
/* encore sur la table (zone de la table) ? */
export function onTableArea(q){ const e=extent(q); return e.x1>TABLE_X0*1000-200 && e.x0<TABLE_X1*1000+200 && e.z1>TABLE_Z0*1000-1200 && e.z0<TABLE_Z1*1000+600; }
