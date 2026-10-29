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
   bon sens se rabote en la présentant par l'autre bout.

   Profils usinés (toupie) : q.cuts, liste d'au plus un profil par face. Un profil {f, d, tear} donne, à chaque station i
   et à M_PROF points t de 0 à 1 en travers de la face (du côté F1 / C1 vers le côté F2 / C2), la profondeur enlevée
   d[i][k] (mm, vers l'intérieur de la pièce). Une pièce sans profil (cuts vide) garde exactement le maillage d'avant ;
   une pièce profilée ne repasse pas à la dégauchisseuse ni à la raboteuse (non géré).

   Bouts usinés (tenonneuse) : q.ends, absent tant qu'aucun bout n'est usiné (pieceJSON ne l'écrit alors pas : les pièces des
   autres machines sont inchangées). Voir « bouts usinés » plus bas.

   Mortaises (mortaiseuse) : q.morts, absent tant qu'aucune mortaise n'est usinée (même règle : pieceJSON ne l'écrit pas sinon).
   Chaque plongée du bédane enlève une boîte {u0, u1, v0, v1, w0, w1, ec} en coordonnées locales (mm ; ±1e6 = ouvert, mortaise
   débouchante) ; plusieurs plongées côte à côte font une mortaise plus longue. Maillage : le même que les bouts usinés. */
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
    face:JSON.parse(JSON.stringify(spec.face)), vmark:spec.vmark?{...spec.vmark}:null, cuts:JSON.parse(JSON.stringify(spec.cuts||[])),
    ...(spec.ends? { ends:JSON.parse(JSON.stringify(spec.ends)) } : {}), ...(spec.morts&&spec.morts.length? { morts:JSON.parse(JSON.stringify(spec.morts)) } : {}) };
  let seed=spec.seed||7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  const noise=a=>{ const ph=[rnd()*6,rnd()*6,rnd()*6]; return i=>{ const x=i/(N-1); return a*(0.5+0.25*Math.sin(x*9+ph[0])+0.15*Math.sin(x*23+ph[1])+0.1*Math.sin(x*41+ph[2])); }; };
  const r=spec.rough??0.6, b=spec.bow||0, nF1=noise(r), nF2=noise(r), nC1=noise(r), nC2=noise(r);
  const shape=i=>{ const x=2*i/(N-1)-1; return b*(1-x*x); };
  const w1=[],w2=[],v1=[],v2=[];
  for(let i=0;i<N;i++){ w1.push(shape(i)+nF1(i)); w2.push(spec.T+shape(i)-nF2(i)); v1.push(nC1(i)); v2.push(spec.W-nC2(i)); }
  return { L:spec.L, W0:spec.W, T0:spec.T, wood:spec.wood||'hetre', sT:spec.sT||0, sW:spec.sW||0,
    w1,w2,v1,v2, k:spec.k||0, flip:!!spec.flip,
    face:{ F1:{passes:0,tear:false,mark:null}, F2:{passes:0,tear:false,mark:null}, C1:{passes:0,tear:false,mark:null,angle:null}, C2:{passes:0,tear:false,mark:null,angle:null} },
    vmark:null, cuts:[] }; }
/* ce qu'il faut garder pour passer la pièce à une autre machine */
export function pieceJSON(q){ const {L,W0,T0,wood,sT,sW,w1,w2,v1,v2,k,flip,face,vmark}=q, cuts=q.cuts||[];
  return JSON.parse(JSON.stringify({L,W0,T0,wood,sT,sW,w1,w2,v1,v2,k,flip,face,vmark,cuts, ...(hasEnds(q)? {ends:q.ends} : {}), ...(hasMorts(q)? {morts:q.morts} : {})})); }

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
  if(hasEnds(q0)||hasMorts(q0)) return endsMesh(q0);       // bouts usinés (tenonneuse), mortaises (mortaiseuse)
  if(q0.cuts&&q0.cuts.length) return profiledMesh(q0);     // pièce profilée (toupie) ; sinon, maillage d'origine
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

/* ---------- profils usinés (toupie) ---------- */
export const M_PROF = 33;                      // points en travers d'une face profilée
export const cutOf=(q,f)=>(q.cuts||[]).find(c=>c.f===f)||null;
/* profondeur enlevée sur la face f, à la station i, au point t (0 à 1 en travers, du côté F1 / C1 vers F2 / C2) */
export function depthT(q,f,i,t){ const c=cutOf(q,f); if(!c) return 0; const x=Math.max(0,Math.min(1,t))*(M_PROF-1), k=Math.min(M_PROF-2,Math.floor(x)), r=x-k;
  return c.d[i][k]*(1-r)+c.d[i][k+1]*r; }
/* contour de la section à la station i (mm, coordonnées locales v, w), tourné dans le sens direct :
   F1 (de C1 à C2), C2 (de F1 à F2), F2 (de C2 à C1), C1 (de F2 à F1) ; M_PROF points par face.
   Chaque point : {v, w, f (face), t (position en travers de la face avant usinage), cut (déplacé par un profil)}.
   B : profils de base des faces (par défaut ceux de la pièce ; à l'affichage, les écarts de forme exagérés) */
export function section(q,i,B=q){ const v1=B.v1[i],v2=B.v2[i],w1=B.w1[i],w2=B.w2[i], W=v2-v1, T=w2-w1, n=M_PROF, out=[];
  const D=(f,t)=>depthT(q,f,i,t);
  const clampC=P=>{ const t=(P.w-w1)/T; let d=D('C1',t); if(P.v-v1<d) P.v=v1+d; d=D('C2',t); if(v2-P.v<d) P.v=v2-d; };
  const clampF=P=>{ const t=(P.v-v1)/W; let d=D('F1',t); if(P.w-w1<d) P.w=w1+d; d=D('F2',t); if(w2-P.w<d) P.w=w2-d; };
  const push=(f,t,P,bv,bw)=>{ P.f=f; P.t=t; P.cut=Math.hypot(P.v-bv,P.w-bw)>0.02; out.push(P); };
  for(let k=0;k<n;k++){ const t=k/(n-1), bv=v1+t*W; const P={v:bv,w:w1+D('F1',t)}; clampC(P); push('F1',t,P,bv,w1); }
  for(let k=0;k<n;k++){ const t=k/(n-1), bw=w1+t*T; const P={v:v2-D('C2',t),w:bw}; clampF(P); push('C2',t,P,v2,bw); }
  for(let k=0;k<n;k++){ const t=1-k/(n-1), bv=v1+t*W; const P={v:bv,w:w2-D('F2',t)}; clampC(P); push('F2',t,P,bv,w2); }
  for(let k=0;k<n;k++){ const t=1-k/(n-1), bw=w1+t*T; const P={v:v1+D('C1',t),w:bw}; clampF(P); push('C1',t,P,v1,bw); }
  return out; }
function profMat(q,tear){ const key='prof|'+q.wood+'|'+tear; if(MATS[key]) return MATS[key];
  const map=woodTex(q.wood,tear?'tear':'planed',0,null);
  return MATS[key]=new THREE.MeshPhysicalMaterial({map,roughness:tear?0.75:0.36,clearcoat:tear?0:0.3,clearcoatRoughness:0.35,sheen:0.4,sheenRoughness:0.5,sheenColor:new THREE.Color(0xfff2dc)}); }
/* maillage d'une pièce profilée : sections le long de la pièce, arêtes vives gardées (normales lissées sous 40°) */
function profiledMesh(q0){
  const B={ w1:exag(q0.w1), w2:exag(q0.w2), v1:exag(q0.v1), v2:exag(q0.v2) };
  const L=q0.L/1000, T=q0.T0/1000, W=q0.W0/1000, pos=[], nor=[], uv=[], groups=[[],[],[],[],[],[],[]], FI={F1:0,F2:1,C1:2,C2:3};
  const X=i=>i/(N-1)*L-L/2, Y=w=>w/1000-T/2, Z=v=>v/1000-W/2;
  const secs=[]; for(let i=0;i<N;i++) secs.push(section(q0,i,B));
  const nP=secs[0].length, COS=Math.cos(40*Math.PI/180);
  const segN=secs.map(S=>S.map((P,j)=>{ const Q=S[(j+1)%nP], dv=Q.v-P.v, dw=Q.w-P.w, l=Math.hypot(dv,dw); return l<1e-4? null : [dw/l,-dv/l]; }));
  /* normale du segment j à son début (end=0) ou à sa fin (end=1), lissée avec le premier voisin non dégénéré si l'angle est faible */
  const nAt=(NS,j,end)=>{ const n=NS[j]; if(!n) return null; let m=null; for(let s=1;s<6&&!m;s++) m=NS[(j+(end?s:-s)+nP*6)%nP];
    if(m&&n[0]*m[0]+n[1]*m[1]>COS){ const a=n[0]+m[0], b=n[1]+m[1], l=Math.hypot(a,b); return [a/l,b/l]; } return n; };
  const tearOf=f=>!!cutOf(q0,f)?.tear;
  for(let i=0;i<N-1;i++){ const S0=secs[i], S1=secs[i+1];
    for(let j=0;j<nP;j++){ const j1=(j+1)%nP; const n0=segN[i][j], n1=segN[i+1][j]; if(!n0&&!n1) continue;
      const f= S0[j].f===S0[j1].f? S0[j].f : S0[j1].f, cut=S0[j].cut||S0[j1].cut||S1[j].cut||S1[j1].cut;
      const mat= cut? (tearOf(f)?6:5) : FI[f];
      const nn=(NS,o,end)=>nAt(NS,j,end)||nAt(o,j,end);
      const base=pos.length/3;
      for(const [S,NS,o,ii] of [[S0,segN[i],segN[i+1],i],[S1,segN[i+1],segN[i],i+1]]) for(const [P,end] of [[S[j],0],[S[j1],1]]){
        const n=nn(NS,o,end); pos.push(X(ii),Y(P.w),Z(P.v)); nor.push(0,n[1],n[0]); uv.push(ii/(N-1),P.t); }
      const a=base, b=base+1, c=base+2, d=base+3; groups[mat].push(a,c,b, b,c,d); } }
  const cap=(i,sgn)=>{ const S=secs[i], P2=[]; for(const P of S){ const l=P2[P2.length-1]; if(!l||Math.hypot(P.v-l.v,P.w-l.w)>1e-3) P2.push(P); }
    if(P2.length>2&&Math.hypot(P2[0].v-P2[P2.length-1].v,P2[0].w-P2[P2.length-1].w)<1e-3) P2.pop();
    const tris=THREE.ShapeUtils.triangulateShape(P2.map(P=>new THREE.Vector2(P.v,P.w)),[]), base=pos.length/3, vv=B.v2[i]-B.v1[i], ww=B.w2[i]-B.w1[i];
    for(const P of P2){ pos.push(X(i),Y(P.w),Z(P.v)); nor.push(sgn,0,0); uv.push((P.v-B.v1[i])/vv,(P.w-B.w1[i])/ww); }
    for(const [a,b,c] of tris){ const A=P2[a],Bq=P2[b],Cq=P2[c], ccw=(Bq.v-A.v)*(Cq.w-A.w)-(Bq.w-A.w)*(Cq.v-A.v)>0;   // sens direct dans (v, w) : normale −x
      if((sgn<0)===ccw) groups[4].push(base+a,base+b,base+c); else groups[4].push(base+a,base+c,base+b); } };
  cap(0,-1); cap(N-1,1);
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const idx=[]; groups.forEach((g,m)=>{ if(g.length){ geo.addGroup(idx.length,g.length,m); for(const x of g) idx.push(x); } }); geo.setIndex(idx);
  const mesh=new THREE.Mesh(geo,[faceMat(q0,'F1'),faceMat(q0,'F2'),faceMat(q0,'C1'),faceMat(q0,'C2'),endMat(q0),profMat(q0,false),profMat(q0,true)]);
  mesh.castShadow=mesh.receiveShadow=true; mesh.userData.part='piece';
  return mesh; }

/* ---------- bouts usinés (tenonneuse) ----------
   q.ends = { A:{cuts, ec, log}, B:{…} } : A = bout en u = 0, B = bout en u = L.
   Une coupe {d0, d1, ax, a, b, k} enlève, de d0 à d1 mm depuis le bout, toute la matière dont la coordonnée locale ax
   ('w' : épaisseur, de F1 vers F2 ; 'v' : largeur, de C1 vers C2) est comprise entre a et b (mm), sur toute l'autre dimension
   (les outils de la tenonneuse sont plus larges que la pièce). k : 'joue' (dérouleurs) ou 'enf' (enfourchement, unité de
   toupillage). ec : éclats en sortie d'outil sur ce bout. La scie d'affranchissement raccourcit la pièce (trimEnd).
   Le maillage d'une pièce aux bouts usinés est fait par tranches le long de la pièce (sections de la station la plus proche,
   profils de la toupie compris) : arêtes vives, sans exagération des écarts de forme (pièce corroyée). */
export const hasEnds=q=>!!q&&!!q.ends&&['A','B'].some(e=>q.ends[e]&&q.ends[e].cuts&&q.ends[e].cuts.length);
export function endRec(q,e){ if(!q.ends) q.ends={}; return q.ends[e]||(q.ends[e]={cuts:[],ec:false}); }
/* coupe le bout e de t mm (scie d'affranchissement) : profils rééchantillonnés, coupes du bout raccourcies */
export function trimEnd(q,e,t){ if(!(t>0)) return; const L=q.L, L2=L-t, off=e==='A'?t:0;
  const at=i=>{ const x=(off+i/(N-1)*L2)/L*(N-1), k=Math.max(0,Math.min(N-2,Math.floor(x))); return [k,x-k]; };
  const rs=a=>{ const out=[]; for(let i=0;i<N;i++){ const [k,r]=at(i); out.push(a[k]*(1-r)+a[k+1]*r); } return out; };
  q.w1=rs(q.w1); q.w2=rs(q.w2); q.v1=rs(q.v1); q.v2=rs(q.v2);
  for(const c of q.cuts||[]){ const nd=[]; for(let i=0;i<N;i++){ const [k,r]=at(i); nd.push(c.d[k].map((x,j)=>x*(1-r)+c.d[k+1][j]*r)); } c.d=nd; }
  q.L=Math.round(L2*100)/100;
  const R=q.ends&&q.ends[e]; if(R) R.cuts=R.cuts.map(c=>({...c, d0:Math.max(0,c.d0-t), d1:c.d1-t})).filter(c=>c.d1>0.05);
  if(hasMorts(q)) q.morts=q.morts.map(m=> e==='A'? {...m, u0:Math.max(0,m.u0-t), u1:m.u1-t} : {...m, u1:Math.min(L2,m.u1)}).filter(m=>m.u1-m.u0>0.05); }
export const hasMorts=q=>!!q&&Array.isArray(q.morts)&&q.morts.length>0;
export const BIG=1e6;
/* matière enlevée au point u (mm depuis le bout A) : rectangles {v0, v1, w0, w1} de la section (bandes des bouts usinés,
   strictement à l'intérieur de [d0, d1] ; boîtes des mortaises, strictement à l'intérieur de [u0, u1]) */
function bandsAt(q,u){ const out=[];
  for(const e of ['A','B']){ const R=q.ends&&q.ends[e]; if(!R) continue; const d= e==='A'? u : q.L-u;
    for(const c of R.cuts) if(d>c.d0+1e-7 && d<c.d1-1e-7) out.push(c.ax==='v'? {v0:c.a, v1:c.b, w0:-BIG, w1:BIG, ec:!!R.ec} : {v0:-BIG, v1:BIG, w0:c.a, w1:c.b, ec:!!R.ec}); }
  for(const m of q.morts||[]) if(u>m.u0+1e-7 && u<m.u1-1e-7) out.push({v0:m.v0, v1:m.v1, w0:m.w0, w1:m.w1, ec:!!m.ec, mort:true});
  return out; }
const inBands=(B,v,w)=>B.find(b=>v>b.v0+1e-9 && v<b.v1-1e-9 && w>b.w0+1e-9 && w<b.w1-1e-9)||null;
/* cellules (rectangles) délimitées par les bords des rectangles enlevés */
function cellsOf(B){ const br=ax=>[...new Set(B.flatMap(b=>ax==='v'?[b.v0,b.v1]:[b.w0,b.w1]).filter(x=>Math.abs(x)<BIG/2))].sort((a,b)=>a-b);
  const iv=xs=>{ const out=[]; let p=-BIG; for(const x of xs){ out.push([p,x]); p=x; } out.push([p,BIG]); return out; };
  const mid=([a,b])=> a<=-BIG/2&&b>=BIG/2? 0 : a<=-BIG/2? b-0.5 : b>=BIG/2? a+0.5 : (a+b)/2;
  const out=[]; for(const V of iv(br('v'))) for(const W of iv(br('w'))) out.push({V,W,cv:mid(V),cw:mid(W)}); return out; }
/* polygone (v, w) découpé par un demi-plan (Sutherland-Hodgman) */
function clipHalfVW(P,ax,c,keepHi){ const out=[], n=P.length, val=p=>ax==='v'?p.v:p.w, ins=p=>keepHi? val(p)>=c-1e-9 : val(p)<=c+1e-9;
  const inter=(S,E)=>{ const s=val(S), r=(c-s)/(val(E)-s); return {v:S.v+(E.v-S.v)*r, w:S.w+(E.w-S.w)*r, f:S.f===E.f?S.f:E.f, cut:S.cut||E.cut}; };
  for(let i=0;i<n;i++){ const S=P[i], E=P[(i+1)%n], si=ins(S), ei=ins(E); if(ei){ if(!si) out.push(inter(S,E)); out.push(E); } else if(si) out.push(inter(S,E)); }
  return out; }
function clipCell(P,cell){ let Q=P; const [v0,v1]=cell.V, [w0,w1]=cell.W;
  if(v0>-BIG/2) Q=clipHalfVW(Q,'v',v0,true); if(v1<BIG/2) Q=clipHalfVW(Q,'v',v1,false);
  if(w0>-BIG/2) Q=clipHalfVW(Q,'w',w0,true); if(w1<BIG/2) Q=clipHalfVW(Q,'w',w1,false);
  const R=[]; for(const p of Q){ const l=R[R.length-1]; if(!l||Math.hypot(p.v-l.v,p.w-l.w)>1e-5) R.push(p); }
  if(R.length>2&&Math.hypot(R[0].v-R[R.length-1].v,R[0].w-R[R.length-1].w)<1e-5) R.pop();
  return R.length>2? R : null; }
/* section à la station i : contour de la toupie, ou rectangle simple (pièce sans profil) */
function sectionPoly(q,i){ if(q.cuts&&q.cuts.length) return section(q,i).map(p=>({v:p.v,w:p.w,f:p.f,cut:p.cut}));
  const v1=q.v1[i],v2=q.v2[i],w1=q.w1[i],w2=q.w2[i];
  return [{v:v1,w:w1,f:'C1'},{v:v2,w:w1,f:'F1'},{v:v2,w:w2,f:'C2'},{v:v1,w:w2,f:'F2'}]; }
function endsMesh(q0){
  const L=q0.L, T=q0.T0/1000, W=q0.W0/1000, FI={F1:0,F2:1,C1:2,C2:3};
  const vmin=Math.min(...q0.v1), vmax=Math.max(...q0.v2), wmin=Math.min(...q0.w1), wmax=Math.max(...q0.w2);
  const X=u=>u/1000-L/2000, Y=w=>w/1000-T/2, Z=v=>v/1000-W/2;
  const pos=[], nor=[], uv=[], groups=[[],[],[],[],[],[],[],[]];
  /* tranches : stations et bords des coupes */
  let br=[0,L]; for(let i=1;i<N-1;i++) br.push(i/(N-1)*L);
  for(const e of ['A','B']){ const R=q0.ends&&q0.ends[e]; if(R) for(const c of R.cuts) for(const d of [c.d0,c.d1]) br.push(e==='A'? d : L-d); }
  for(const m of q0.morts||[]) br.push(m.u0,m.u1);
  br=[...new Set(br.map(x=>Math.round(Math.max(0,Math.min(L,x))*1e4)/1e4))].sort((a,b)=>a-b);
  const st=u=>Math.max(0,Math.min(N-1,Math.round(u/L*(N-1))));
  const slabs=[]; for(let s=0;s<br.length-1;s++){ const u0=br[s], u1=br[s+1]; if(u1-u0<1e-4) continue; const um=(u0+u1)/2; slabs.push({u0,u1,B:bandsAt(q0,um),S:sectionPoly(q0,st(um))}); }
  const ALL=[{v0:-BIG,v1:BIG,w0:-BIG,w1:BIG}];
  const quad=(x0,x1,P,Q,n,mat,uvy)=>{ const base=pos.length/3;
    for(const [x,ux] of [[x0,0],[x1,1]]) for(const [p,k] of [[P,0],[Q,1]]){ pos.push(X(x),Y(p.w),Z(p.v)); nor.push(0,n[1],n[0]); uv.push(x/L,uvy(p)); }
    const a=base,b=base+1,c=base+2,d=base+3; groups[mat].push(a,c,b, b,c,d); };
  const across=(f,p)=> (f==='F1'||f==='F2')? (p.v-vmin)/(vmax-vmin) : (p.w-wmin)/(wmax-wmin);
  for(const sl of slabs){ const cells=cellsOf(sl.B).filter(c=>!inBands(sl.B,c.cv,c.cw));
    for(const cell of cells){ const P=clipCell(sl.S,cell); if(!P) continue; const n=P.length;
      for(let j=0;j<n;j++){ const A=P[j], Bq=P[(j+1)%n], dv=Bq.v-A.v, dw=Bq.w-A.w, l=Math.hypot(dv,dw); if(l<1e-6) continue;
        const nn=[dw/l,-dv/l];
        const onLine=[...cell.V,...cell.W].some((c,k)=>Math.abs(c)<BIG/2 && (k<2? Math.abs(A.v-c)<1e-6&&Math.abs(Bq.v-c)<1e-6 : Math.abs(A.w-c)<1e-6&&Math.abs(Bq.w-c)<1e-6));
        if(onLine){ const mv=(A.v+Bq.v)/2+nn[0]*0.3, mw=(A.w+Bq.w)/2+nn[1]*0.3, band=inBands(sl.B,mv,mw); if(!band) continue;   // limite intérieure entre deux cellules gardées
          quad(sl.u0,sl.u1,A,Bq,nn,band.mort?7:band.ec?6:5,p=>Math.abs(nn[0])>0.5? (p.w-wmin)/(wmax-wmin) : (p.v-vmin)/(vmax-vmin)); continue; }
        const f=A.f===Bq.f?A.f:Bq.f, mat=(A.cut||Bq.cut)? (cutOf(q0,f)?.tear?6:5) : FI[f];
        quad(sl.u0,sl.u1,A,Bq,nn,mat,p=>across(f,p)); } } }
  /* faces en bout (bois de bout) : là où un côté de la limite garde la matière et pas l'autre */
  const cap=(u,P,sgn)=>{ const tris=THREE.ShapeUtils.triangulateShape(P.map(p=>new THREE.Vector2(p.v,p.w)),[]), base=pos.length/3;
    for(const p of P){ pos.push(X(u),Y(p.w),Z(p.v)); nor.push(sgn,0,0); uv.push((p.v-vmin)/(vmax-vmin),(p.w-wmin)/(wmax-wmin)); }
    for(const [a,b,c] of tris){ const A=P[a],Bq=P[b],Cq=P[c], ccw=(Bq.v-A.v)*(Cq.w-A.w)-(Bq.w-A.w)*(Cq.v-A.v)>0;
      if((sgn<0)===ccw) groups[4].push(base+a,base+b,base+c); else groups[4].push(base+a,base+c,base+b); } };
  for(let s=0;s<=slabs.length;s++){ const Lf=slabs[s-1], Rt=slabs[s], u= Rt? Rt.u0 : Lf.u1;
    const BL=Lf? Lf.B : ALL, BR=Rt? Rt.B : ALL;
    for(const cell of cellsOf([...BL,...BR])){ const kL=!!Lf&&!inBands(BL,cell.cv,cell.cw), kR=!!Rt&&!inBands(BR,cell.cv,cell.cw); if(kL===kR) continue;
      const P=clipCell((kL?Lf:Rt).S,cell); if(P) cap(u,P,kL?1:-1); } }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const idx=[]; groups.forEach((g,m)=>{ if(g.length){ geo.addGroup(idx.length,g.length,m); for(const x of g) idx.push(x); } }); geo.setIndex(idx);
  const mesh=new THREE.Mesh(geo,[faceMat(q0,'F1'),faceMat(q0,'F2'),faceMat(q0,'C1'),faceMat(q0,'C2'),endMat(q0),profMat(q0,false),profMat(q0,true),cavMat(q0)]);
  mesh.castShadow=mesh.receiveShadow=true; mesh.userData.part='piece';
  return mesh; }
/* intérieur d'une mortaise : bois coupé par le bédane, dans l'ombre (plus sombre que les faces rabotées) */
function cavMat(q){ const key='cav|'+q.wood; return MATS[key]||(MATS[key]=new THREE.MeshStandardMaterial({map:woodTex(q.wood,'planed',0,null),color:0x8f7a64,roughness:0.95})); }
