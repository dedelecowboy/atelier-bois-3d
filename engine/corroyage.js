/* Pièce de corroyage, commune à la dégauchisseuse et à la raboteuse : une pièce dressée à l'une peut passer
   à l'autre (mêmes faces, mêmes repères, même fil). pieceJSON / makePiece(json) la transportent telle quelle.

   Repère local de la pièce : u le long (bout A en u = 0), v en largeur (chant C1 en v = 0, C2 en v = W),
   w en épaisseur (plat F1 en w = 0, F2 en w = T). Chaque face est décrite par N points le long de u :
   w1[i] (dessous de F1), w2[i] (dessus de F2), v1[i] (C1), v2[i] (C2), en mm.
   Orientation : k quarts de tour autour de l'axe long (en roulant vers le guide de la dégauchisseuse) et flip
   (bout pour bout : le bout B passe en premier). État de chaque face : passes, arrachements (tear), repère
   (mark : 'loop' sur SR1, 'v' sur SR2 avec markRef), angle du chant dressé à la dégauchisseuse.

   Sens du fil (même règle pour les deux machines, l'outil tourne contre l'avance) : usinage dans le bon sens si,
   depuis la face usinée, les fibres entrent dans la pièce vers le bout qui passe en premier sous l'outil.
   À la dégauchisseuse la face usinée est dessous, à la raboteuse elle est dessus : une pièce dégauchie dans le
   bon sens se rabote en la présentant par l'autre bout. */
import * as THREE from 'three';
import { canvasTex } from './kit.js';

export const N = 41;
export const RING = ['F1','C1','F2','C2'];
export const FACE_NAME = { F1:'Plat 1', F2:'Plat 2', C1:'Chant 1', C2:'Chant 2' };
export const OPP = { F1:'F2', F2:'F1', C1:'C2', C2:'C1' };
export const FLAT = 0.05;                      // planéité d'une face dressée (mm)
export const isF = f=>f[0]==='F';
const minA=a=>Math.min(...a), maxA=a=>Math.max(...a);

/* ---------- création ---------- */
/* spec : {L,W,T (mm), wood:'hetre'|'chene'|'frene'|'sapin', bow (mm, cintrage sur le plat, creux côté F1), rough (mm),
   sT, sW (pente du fil dans l'épaisseur et dans la largeur), k, flip, seed}
   ou une pièce transportée (pieceJSON) : {L,W0,T0,wood,sT,sW,w1,w2,v1,v2,k,flip,face,vmark}. */
export function makePiece(spec){
  if(spec.w1) return { L:spec.L, W0:spec.W0, T0:spec.T0, wood:spec.wood, sT:spec.sT||0, sW:spec.sW||0,
    w1:spec.w1.slice(), w2:spec.w2.slice(), v1:spec.v1.slice(), v2:spec.v2.slice(), k:spec.k||0, flip:!!spec.flip,
    face:JSON.parse(JSON.stringify(spec.face)), vmark:spec.vmark?{...spec.vmark}:null };
  let seed=spec.seed||7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  const noise=a=>{ const ph=[rnd()*6,rnd()*6,rnd()*6]; return i=>{ const x=i/(N-1); return a*(0.5+0.25*Math.sin(x*9+ph[0])+0.15*Math.sin(x*23+ph[1])+0.1*Math.sin(x*41+ph[2])); }; };
  const r=spec.rough??0.6, b=spec.bow||0, nF1=noise(r), nF2=noise(r), nC1=noise(r), nC2=noise(r);
  const shape=i=>{ const x=2*i/(N-1)-1; return b*(1-x*x); };
  const w1=[],w2=[],v1=[],v2=[];
  for(let i=0;i<N;i++){ w1.push(shape(i)+nF1(i)); w2.push(spec.T+shape(i)-nF2(i)); v1.push(nC1(i)); v2.push(spec.W-nC2(i)); }
  return { L:spec.L, W0:spec.W, T0:spec.T, wood:spec.wood||'hetre', sT:spec.sT||0, sW:spec.sW||0,
    w1,w2,v1,v2, k:spec.k||0, flip:!!spec.flip,
    face:{ F1:{passes:0,tear:false,mark:null}, F2:{passes:0,tear:false,mark:null}, C1:{passes:0,tear:false,mark:null,angle:null}, C2:{passes:0,tear:false,mark:null,angle:null} },
    vmark:null }; }
/* ce qu'il faut garder pour passer la pièce à une autre machine */
export function pieceJSON(q){ const {L,W0,T0,wood,sT,sW,w1,w2,v1,v2,k,flip,face,vmark}=q; return JSON.parse(JSON.stringify({L,W0,T0,wood,sT,sW,w1,w2,v1,v2,k,flip,face,vmark})); }

/* ---------- géométrie : faces, planéité, dimensions ---------- */
export const prof=(q,f)=>({F1:q.w1,F2:q.w2,C1:q.v1,C2:q.v2}[f]);
export const lowSide=f=>f==='F1'||f==='C1';
/* écart de planéité d'une face (mm) */
export function flatness(q,f){ const a=prof(q,f); return maxA(a)-minA(a); }
export const isFlat=(q,f)=>flatness(q,f)<=FLAT;
/* « jour » sous la face posée sur une table, le long de la pièce (mm, 0 aux points d'appui) */
export function gapProfile(q,f){ const a=prof(q,f), lo=lowSide(f); const m=lo?minA(a):maxA(a); return a.map(x=>lo?x-m:m-x); }
/* épaisseur / largeur à chaque station, et la plus petite */
export const thickProf=q=>q.w2.map((x,i)=>x-q.w1[i]);
export const widthProf=q=>q.v2.map((x,i)=>x-q.v1[i]);
export const thickness=q=>minA(thickProf(q));
export const width=q=>minA(widthProf(q));
/* distance entre une face et la face opposée, station par station (pièce pressée à plat sur la face f) */
export const across=(q,f)=> isF(f)? thickProf(q) : widthProf(q);

/* ---------- orientation ---------- */
/* back = côté −Z de la machine (guide de la dégauchisseuse), front = côté +Z (opérateur à la dégauchisseuse) */
export function faces(q){ const k=((q.k%4)+4)%4; return { down:RING[k], back:RING[(k+(q.flip?3:1))%4], up:RING[(k+2)%4], front:RING[(k+(q.flip?1:3))%4] }; }
export const mode=q=>isF(faces(q).down)?'plat':'chant';
/* face posée bombée (convexe) : la pièce repose au milieu et bascule */
export function rocking(q){ const g=gapProfile(q,faces(q).down), ends=(g[0]+g[N-1])/2, mid=g[(N-1)>>1]; return ends-mid>0.8; }
export function concaveDown(q){ const g=gapProfile(q,faces(q).down); return g[(N-1)>>1]-(g[0]+g[N-1])/2>0.8; }
/* sens du fil pour l'usinage de la face f : +1 dans le sens du fil, −1 contre le fil, 0 fil droit */
export function grainSign(q,f){ const comp={F1:q.sT,F2:-q.sT,C1:q.sW,C2:-q.sW}[f], g=comp*(q.flip?1:-1); return Math.abs(g)<0.01?0:Math.sign(g); }
/* encombrement de la pièce posée : hauteur au-dessus de la table et profondeur en travers (mm) */
const extentF=q=>maxA(q.w2)-minA(q.w1), extentC=q=>maxA(q.v2)-minA(q.v1);
export const heightMm=q=> isF(faces(q).down)? extentF(q) : extentC(q);
export const depthMm=q=> isF(faces(q).down)? extentC(q) : extentF(q);

/* ---------- usinage ---------- */
/* dégauchisseuse : enlève la matière de la face f jusqu'à d au-dessus de ses points d'appui ; rend la profondeur enlevée par station */
export function dresse(q,f,d){ const a=prof(q,f), lo=lowSide(f), out=[];
  if(lo){ const lvl=minA(a)+d; for(let i=0;i<N;i++){ out.push(Math.max(0,lvl-a[i])); a[i]=Math.max(a[i],lvl); } }
  else { const lvl=maxA(a)-d; for(let i=0;i<N;i++){ out.push(Math.max(0,a[i]-lvl)); a[i]=Math.min(a[i],lvl); } }
  return out; }
/* raboteuse : pièce pressée à plat sur la face posée (down) par les rouleaux, la face opposée est ramenée à la cote H
   (mm) au-dessus de la face posée, station par station ; rend la profondeur enlevée par station */
export function rabote(q,down,H){ const up=OPP[down], a=prof(q,down), b=prof(q,up), lo=lowSide(down), out=[];
  for(let i=0;i<N;i++){ if(lo){ const lvl=a[i]+H; out.push(Math.max(0,b[i]-lvl)); b[i]=Math.min(b[i],lvl); }
    else { const lvl=a[i]-H; out.push(Math.max(0,lvl-b[i])); b[i]=Math.max(b[i],lvl); } }
  return out; }
/* marque une face usinée : le repère tracé dessus disparaît */
export function clearMark(q,f){ q.face[f].mark=null; if(q.vmark&&(q.vmark.s1===f||q.vmark.s2===f)) q.vmark=null; }
/* repères au crayon : boucle de parement sur s1 ; petit V à cheval sur l'arête s1 / s2 (si s2) */
export function repere(q,s1,s2){ q.face[s1].mark='loop'; if(s2){ const fs=q.face[s2]; fs.mark='v'; fs.markRef=s1; q.vmark={s1,s2}; } }
/* pièce telle qu'elle sort de la dégauchisseuse : SR1 (plat) puis SR2 (chant, angle deg avec SR1) dressés
   par passes de 1 mm dans le bon sens, repérés au crayon */
export function dresseSR(q,{s1='F1',s2='C1',deg=90,marks=true}={}){
  for(const f of [s1,s2]){ let n=0; while(!isFlat(q,f)&&n<20){ dresse(q,f,1); n++; } const fs=q.face[f]; fs.passes=Math.max(1,n); fs.tear=false;
    if(!isF(f)) fs.angle={ref:s1,deg}; }
  if(marks) repere(q,s1,s2); return q; }

/* ---------- textures du bois ---------- */
const WOOD={ hetre:['#d9ab83','#c08b63','#e8c4a0'], chene:['#c99d68','#9c7448','#dcb88a'], frene:['#e4cfa8','#b89a6c','#f0e2c4'], sapin:['#e6cfa4','#c9a877','#f2e2c2'] };
const texCache={};
/* kind : raw (brut de sciage) | planed (dressé ou raboté) | tear (arrachements) | end (bois de bout). slope : pente des fibres dans le dessin.
   mark : null ou liste séparée par « + » : 'loop' (repère de parement SR1) ;
          'arm:b|t:dx:dy' (un des deux traits du repère d'angle : il part de l'arête du bas (b) ou du haut (t) du dessin
          et rentre dans la face ; les deux traits, sur SR1 et SR2, forment un petit V à cheval sur l'arête commune) */
function woodTex(wood,kind,slope,mark){ const key=[wood,kind,slope.toFixed(3),mark].join('|'); if(texCache[key]) return texCache[key];
  const [base,dark,light]=WOOD[wood]||WOOD.hetre; let s=11;
  const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const t=canvasTex(1024,128,(g,w,h)=>{ g.fillStyle=kind==='raw'?dark:base; g.fillRect(0,0,w,h);
    if(kind==='raw'){ g.fillStyle='rgba(110,104,94,.5)'; g.fillRect(0,0,w,h); }   // bois brut de sciage : terne, grisé
    if(kind==='end'){ for(let r=8;r<w;r+=9){ g.strokeStyle=`rgba(90,60,30,${0.25+rnd()*0.2})`; g.lineWidth=1.5; g.beginPath(); g.arc(w*0.5,h*1.6,r,0,7); g.stroke(); } return; }
    g.fillStyle=kind==='raw'?base:light; g.globalAlpha=kind==='raw'?0.55:0.35; g.fillRect(0,0,w,h); g.globalAlpha=1;
    if(kind==='raw'){ for(let x=0;x<w;x+=5+rnd()*4){ g.strokeStyle=`rgba(55,35,18,${0.18+rnd()*0.17})`; g.lineWidth=2+rnd()*2; g.beginPath(); g.moveTo(x,0); g.quadraticCurveTo(x+8,h/2,x,h); g.stroke(); }   // traits de scie marqués
      for(let i=0;i<900;i++){ const v=rnd(); g.fillStyle=v<0.5?`rgba(40,26,14,${0.25+rnd()*0.3})`:`rgba(235,215,180,${0.2+rnd()*0.25})`; g.fillRect(rnd()*w,rnd()*h,1+rnd()*3,1+rnd()*2); } }   // fibres soulevées
    // fibres : pente réelle du fil (lisible sur la face), réparties sur toute la longueur
    const span=Math.abs(slope)*w+h, n=Math.max(7,Math.round(span/34));
    for(let i=0;i<n;i++){ const y0=(slope>0?-Math.abs(slope)*w:0)+i*span/n+rnd()*4, dark=i%3!==1;
      g.strokeStyle= dark?`rgba(80,46,20,${(kind==='raw'?0.25:0.5)+rnd()*0.2})`:`rgba(245,222,180,${kind==='raw'?0.2:0.45})`; g.lineWidth=dark?3+rnd()*2.5:2;
      g.beginPath(); for(let x=0;x<=w;x+=16){ const y=y0+slope*x+Math.sin(x*0.012+i)*1.8; x?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); }
    if(kind==='tear') for(let i=0;i<70;i++){ const x=rnd()*w, y=rnd()*h, l=8+rnd()*26; g.fillStyle='rgba(70,40,18,.55)'; g.beginPath(); g.moveTo(x,y); g.lineTo(x+l,y+slope*l-3); g.lineTo(x+l*0.8,y+slope*l+4); g.closePath(); g.fill(); }
    if(mark) for(const m of mark.split('+')){ g.strokeStyle='#222'; g.lineWidth=5; g.lineCap='round'; g.beginPath();
      if(m==='loop'){ const cx=w*0.42, cy=h*0.5; g.ellipse(cx,cy,46,30,0,0,Math.PI*2); g.moveTo(cx+40,cy+16); g.quadraticCurveTo(cx+110,cy+40,cx+170,h-4); }
      else if(m.startsWith('arm:')){ const [,side,dx,dy]=m.split(':'), b=side==='b', y0=b?h-1:1, cx=w*0.72;
        g.lineWidth=6; g.moveTo(cx,y0); g.lineTo(cx+(+dx), b? y0-(+dy) : y0+(+dy)); }
      g.stroke(); } });
  t.wrapS=THREE.ClampToEdgeWrapping; return texCache[key]=t; }

/* ---------- maillage ---------- */
const MATS={};
function faceMat(q,f){ const fs=q.face[f], kind=fs.passes===0?'raw':fs.tear?'tear':'planed';
  // pente du fil dans le dessin : sur un chant (C) on voit la pente dans l'épaisseur, sur un plat (F) celle dans la largeur
  const acr=isF(f)?q.W0:q.T0, s=-(isF(f)?q.sW:q.sT)*(128/acr)/(1024/q.L);   // y du dessin vers le bas = vers la face v1 / w1
  const parts=[]; if(fs.mark==='loop') parts.push('loop');
  const vm=q.vmark; if(vm&&(f===vm.s1||f===vm.s2)){ const other=f===vm.s1?vm.s2:vm.s1;
    // l'arête avec une face « 1 » (F1 ou C1) est en bas du dessin, avec une face « 2 » en haut ; trait de 14 mm le long, 18 mm vers l'intérieur
    const dx=Math.round(14*1024/q.L), dy=Math.round(Math.min(18,0.7*acr)*128/acr);
    parts.push(`arm:${other.endsWith('1')?'b':'t'}:${dx}:${dy}`); }
  const mark=parts.length?parts.join('+'):null;
  const key=[q.wood,kind,s.toFixed(3),mark].join('|');
  if(MATS[key]) return MATS[key]; const map=woodTex(q.wood,kind,s,mark);
  // brut : mat et rugueux (relief) ; dressé : lisse, léger brillant (surface rabotée)
  return MATS[key]= kind==='raw'? new THREE.MeshStandardMaterial({map,roughness:1,bumpMap:map,bumpScale:2.5})
    : new THREE.MeshPhysicalMaterial({map,roughness:kind==='tear'?0.75:0.42,clearcoat:kind==='tear'?0:0.35,clearcoatRoughness:0.35,sheen:0.4,sheenRoughness:0.5,sheenColor:new THREE.Color(0xfff2dc)}); }
function endMat(q){ return MATS['end'+q.wood]||(MATS['end'+q.wood]=new THREE.MeshStandardMaterial({map:woodTex(q.wood,'end',0,null),roughness:0.85})); }
export const EX=3;   // à l'affichage seulement, les écarts de forme (cintrage, brut de sciage) sont exagérés ×3
const exag=a=>{ const n=a.length-1; return a.map((x,i)=>{ const lin=a[0]+(a[n]-a[0])*i/n; return x+(EX-1)*(x-lin); }); };
/* maillage de la pièce, centré sur son origine locale (u le long de x, w en y, v en z), sans orientation */
export function pieceMesh(q0){
  const q={...q0, w1:exag(q0.w1), w2:exag(q0.w2), v1:exag(q0.v1), v2:exag(q0.v2)};
  const L=q0.L/1000, T=q0.T0/1000, W=q0.W0/1000, pos=[], uv=[], idx=[];
  const P=(i,v,w)=>[i/(N-1)*L-L/2, w/1000-T/2, v/1000-W/2];
  const strip=(fn, flipWinding)=>{ const start=idx.length, base=pos.length/3;
    for(let i=0;i<N;i++){ const [a,b]=fn(i); pos.push(...a,...b); uv.push(i/(N-1),0, i/(N-1),1); }
    for(let i=0;i<N-1;i++){ const k=base+i*2; if(flipWinding) idx.push(k,k+2,k+1, k+1,k+2,k+3); else idx.push(k,k+1,k+2, k+1,k+3,k+2); }
    return [start, idx.length-start]; };
  // F1 (dessous, w1) : de C1 à C2 ; F2 (dessus, w2) ; C1 (v1) : de F1 à F2 ; C2 (v2)
  const gF1=strip(i=>[P(i,q.v1[i],q.w1[i]),P(i,q.v2[i],q.w1[i])],true);
  const gF2=strip(i=>[P(i,q.v1[i],q.w2[i]),P(i,q.v2[i],q.w2[i])],false);
  const gC1=strip(i=>[P(i,q.v1[i],q.w1[i]),P(i,q.v1[i],q.w2[i])],false);
  const gC2=strip(i=>[P(i,q.v2[i],q.w1[i]),P(i,q.v2[i],q.w2[i])],true);
  const cap=(i,flipW)=>{ const start=idx.length, base=pos.length/3;
    for(const [v,w] of [[q.v1[i],q.w1[i]],[q.v2[i],q.w1[i]],[q.v2[i],q.w2[i]],[q.v1[i],q.w2[i]]]){ pos.push(...P(i,v,w)); uv.push((v-q.v1[i])/q0.W0,(w-q.w1[i])/q0.T0); }
    if(flipW) idx.push(base,base+2,base+1, base,base+3,base+2); else idx.push(base,base+1,base+2, base,base+2,base+3);
    return [start, idx.length-start]; };
  const gA=cap(0,false), gB=cap(N-1,true);
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geo.setIndex(idx);
  [[gF1,0],[gF2,1],[gC1,2],[gC2,3],[gA,4],[gB,4]].forEach(([[s,c],m])=>geo.addGroup(s,c,m));
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,[faceMat(q0,'F1'),faceMat(q0,'F2'),faceMat(q0,'C1'),faceMat(q0,'C2'),endMat(q0)]);
  mesh.castShadow=mesh.receiveShadow=true; mesh.userData.part='piece';
  return mesh; }
