/* Pièce sur la dégauchisseuse : forme (profils des 4 faces le long de la pièce), orientation, passes,
   arrachements selon le sens du fil, angle du chant dressé par rapport à la face contre le guide,
   repères au crayon.

   Repère local de la pièce : u le long (bout A en u = 0), v en largeur (chant C1 en v = 0, C2 en v = W),
   w en épaisseur (plat F1 en w = 0, F2 en w = T). Chaque face est décrite par N points le long de u :
   w1[i] (dessous de F1), w2[i] (dessus de F2), v1[i] (C1), v2[i] (C2), en mm.
   Orientation : k quarts de tour autour de l'axe long (en roulant vers le guide) et flip (bout pour bout).
   Une passe de profondeur d enlève la matière sous la face du dessous jusqu'à d au-dessus de ses points d'appui :
   une pièce cintrée se dresse en plusieurs passes. */
import * as THREE from 'three';
import { canvasTex, v3 } from '../../engine/kit.js';
import { TABLE_Y, LEAD0, KNIFE_X, FLAT } from './constants.js';
import { st, guideZ, $ } from './state.js';

const N = 41;
export const RING = ['F1','C1','F2','C2'];
export const FACE_NAME = { F1:'Plat 1', F2:'Plat 2', C1:'Chant 1', C2:'Chant 2' };
const isF = f=>f[0]==='F';

let app=null, pieceRoot=null, partMeshes=null;
export function initPiece(a, model){ app=a; pieceRoot=model.pieceRoot; partMeshes=a.parts.partMeshes; }

/* ---------- état ---------- */
export let p=null;                 // pièce courante
export const cut={ started:false, done:false, blocked:'', inProgress:false, depth:0, lastT:0, lastMsg:'', msgSeq:0 };

/* Création. spec : {L,W,T (mm), wood:'hetre'|'chene'|'frene', bow (mm, cintrage sur le plat, creux côté F1),
   rough (mm), sT, sW (pente du fil dans l'épaisseur et dans la largeur), k, flip, seed} */
export function newPiece(spec){ clearPiece();
  let seed=spec.seed||7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  const noise=a=>{ const ph=[rnd()*6,rnd()*6,rnd()*6]; return i=>{ const x=i/(N-1); return a*(0.5+0.25*Math.sin(x*9+ph[0])+0.15*Math.sin(x*23+ph[1])+0.1*Math.sin(x*41+ph[2])); }; };
  const r=spec.rough??0.6, b=spec.bow||0, nF1=noise(r), nF2=noise(r), nC1=noise(r), nC2=noise(r);
  const shape=i=>{ const x=2*i/(N-1)-1; return b*(1-x*x); };
  const w1=[],w2=[],v1=[],v2=[];
  for(let i=0;i<N;i++){ w1.push(shape(i)+nF1(i)); w2.push(spec.T+shape(i)-nF2(i)); v1.push(nC1(i)); v2.push(spec.W-nC2(i)); }
  p={ L:spec.L, W0:spec.W, T0:spec.T, wood:spec.wood||'hetre', sT:spec.sT||0, sW:spec.sW||0,
      w1,w2,v1,v2, k:spec.k||0, flip:!!spec.flip, zOff:0.05,
      face:{ F1:{passes:0,tear:false,mark:null}, F2:{passes:0,tear:false,mark:null}, C1:{passes:0,tear:false,mark:null,angle:null}, C2:{passes:0,tear:false,mark:null,angle:null} },
      group:null, mesh:null, texKey:'', vmark:null };
  cut.started=false; cut.done=false; cut.inProgress=false; cut.lastT=0; st.t=0;
  return p; }
export function clearPiece(){ if(p&&p.group){ pieceRoot.remove(p.group); disposeGroup(p.group); } if(partMeshes) partMeshes.piece=[]; p=null; }
function disposeGroup(g){ g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }

/* ---------- géométrie : faces, planéité, dimensions ---------- */
const minA=a=>Math.min(...a), maxA=a=>Math.max(...a);
/* écart de planéité d'une face (mm) */
export function flatness(f, q=p){ const a={F1:q.w1,F2:q.w2,C1:q.v1,C2:q.v2}[f]; return maxA(a)-minA(a); }
export const isFlat=(f,q=p)=>flatness(f,q)<=FLAT;
/* « jour » sous la face posée sur la table, le long de la pièce (mm, 0 aux points d'appui) */
function gapProfile(f){ const a={F1:p.w1,F2:p.w2,C1:p.v1,C2:p.v2}[f], lo=f==='F1'||f==='C1'; const m=lo?minA(a):maxA(a); return a.map(x=>lo?x-m:m-x); }
export const thickness=()=>minA(p.w2.map((x,i)=>x-p.w1[i]));
export const width=()=>minA(p.v2.map((x,i)=>x-p.v1[i]));

/* ---------- orientation ---------- */
export function faces(q=p){ const k=((q.k%4)+4)%4; return { down:RING[k], back:RING[(k+(q.flip?3:1))%4], up:RING[(k+2)%4], front:RING[(k+(q.flip?1:3))%4] }; }
export const mode=()=>p&&isF(faces().down)?'plat':'chant';
/* face posée bombée (convexe) : la pièce repose au milieu et bascule */
export function rocking(){ if(!p) return false; const g=gapProfile(faces().down), ends=(g[0]+g[N-1])/2, mid=g[(N-1)>>1]; return ends-mid>0.8; }
export function concaveDown(){ if(!p) return false; const g=gapProfile(faces().down); return g[(N-1)>>1]-(g[0]+g[N-1])/2>0.8; }
/* sens du fil pour la face du dessous : +1 dans le sens du fil, −1 contre le fil, 0 fil droit.
   Bonne orientation : en partant de la face usinée, les fibres montent dans la pièce vers le bout qui entre en premier. */
export function grainSign(q=p){ const f=faces(q).down, comp={F1:q.sT,F2:-q.sT,C1:q.sW,C2:-q.sW}[f], g=comp*(q.flip?1:-1); return Math.abs(g)<0.01?0:Math.sign(g); }

/* ---------- position dans la scène ---------- */
const box=new THREE.Box3();
export function pieceBox(){ if(!p||!p.group) return null; p.group.updateMatrixWorld(true); return box.setFromObject(p.mesh); }
/* encombrements réels (mm) : hauteur posée sur la table, profondeur depuis la face côté guide */
const extentF=()=>maxA(p.w2)-minA(p.w1), extentC=()=>maxA(p.v2)-minA(p.v1);
export const heightMm=()=>!p?0: faces().down[0]==='F'? extentF() : extentC();
export const depthMm=()=>!p?0: faces().down[0]==='F'? extentC() : extentF();
export const backZ=()=>guideZ()+(p?p.zOff:0);
export const frontZ=()=>backZ()+depthMm()/1000;
export const againstGuide=()=>!!p && p.zOff<0.0008;
export const leadX=()=>LEAD0 - st.t/1000;
export const travelMax=()=>p?Math.round((LEAD0+p.L/1000+KNIFE_X)*1000)+40:2000;
export function place(){ if(!p||!p.group) return;
  const inner=p.group.children[0]; inner.rotation.set(-p.k*Math.PI/2,0,0); p.group.rotation.set(0,p.flip?Math.PI:0,0);
  p.group.position.set(0,0,0); p.group.updateMatrixWorld(true); const b=box.setFromObject(p.mesh);
  p.group.position.set(leadX()-b.min.x, TABLE_Y-b.min.y, guideZ()+p.zOff-b.min.z); }

/* ---------- textures du bois ---------- */
const WOOD={ hetre:['#d9ab83','#c08b63','#e8c4a0'], chene:['#c99d68','#9c7448','#dcb88a'], frene:['#e4cfa8','#b89a6c','#f0e2c4'] };
const texCache={};
/* kind : raw (brut de sciage) | planed (dressé) | tear (arrachements) | end (bois de bout). slopePx : pente des fibres dans le dessin.
   mark : null ou liste séparée par « + » : 'loop' (repère de parement SR1) ;
          'arm:b|t:dx:dy' (un des deux traits du repère d'angle : il part de l'arête du bas (b) ou du haut (t) du dessin
          et rentre dans la face ; les deux traits, sur SR1 et SR2, forment un petit V à cheval sur l'arête commune) */
function woodTex(wood,kind,slope,mark){ const key=[wood,kind,slope.toFixed(3),mark].join('|'); if(texCache[key]) return texCache[key];
  const [base,dark,light]=WOOD[wood]||WOOD.hetre; let s=11;
  const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const t=canvasTex(1024,128,(g,w,h)=>{ g.fillStyle=kind==='raw'?dark:base; g.fillRect(0,0,w,h);
    if(kind==='end'){ for(let r=8;r<w;r+=9){ g.strokeStyle=`rgba(90,60,30,${0.25+rnd()*0.2})`; g.lineWidth=1.5; g.beginPath(); g.arc(w*0.5,h*1.6,r,0,7); g.stroke(); } return; }
    g.fillStyle=kind==='raw'?base:light; g.globalAlpha=kind==='raw'?0.55:0.35; g.fillRect(0,0,w,h); g.globalAlpha=1;
    if(kind==='raw') for(let x=0;x<w;x+=6+rnd()*5){ g.strokeStyle=`rgba(60,38,20,${0.08+rnd()*0.1})`; g.lineWidth=2; g.beginPath(); g.moveTo(x,0); g.quadraticCurveTo(x+6,h/2,x,h); g.stroke(); }   // traits de scie
    // fibres : pente réelle du fil (lisible sur la face), réparties sur toute la longueur
    const span=Math.abs(slope)*w+h, n=Math.max(7,Math.round(span/34));
    for(let i=0;i<n;i++){ const y0=(slope>0?-Math.abs(slope)*w:0)+i*span/n+rnd()*4, dark=i%3!==1;
      g.strokeStyle= dark?`rgba(80,46,20,${0.5+rnd()*0.2})`:`rgba(245,222,180,0.45)`; g.lineWidth=dark?3+rnd()*2.5:2;
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
function faceMat(f){ const fs=p.face[f], kind=fs.passes===0?'raw':fs.tear?'tear':'planed';
  // pente du fil dans le dessin : sur un chant (C) on voit la pente dans l'épaisseur, sur un plat (F) celle dans la largeur
  const across=isF(f)?p.W0:p.T0, s=-(isF(f)?p.sW:p.sT)*(128/across)/(1024/p.L);   // y du dessin vers le bas = vers la face v1 / w1
  const parts=[]; if(fs.mark==='loop') parts.push('loop');
  const vm=p.vmark; if(vm&&(f===vm.s1||f===vm.s2)){ const other=f===vm.s1?vm.s2:vm.s1;
    // l'arête avec une face « 1 » (F1 ou C1) est en bas du dessin, avec une face « 2 » en haut ; trait de 14 mm le long, 18 mm vers l'intérieur
    const dx=Math.round(14*1024/p.L), dy=Math.round(Math.min(18,0.7*across)*128/across);
    parts.push(`arm:${other.endsWith('1')?'b':'t'}:${dx}:${dy}`); }
  const mark=parts.length?parts.join('+'):null;
  const key=[p.wood,kind,s.toFixed(3),mark].join('|');
  return MATS[key]||(MATS[key]=new THREE.MeshStandardMaterial({map:woodTex(p.wood,kind,s,mark),roughness:kind==='raw'?0.9:0.6})); }
function endMat(){ return MATS['end'+p.wood]||(MATS['end'+p.wood]=new THREE.MeshStandardMaterial({map:woodTex(p.wood,'end',0,null),roughness:0.85})); }
const EX=3;   // à l'affichage seulement, les écarts de forme (cintrage, brut de sciage) sont exagérés ×3
const exag=a=>{ const n=a.length-1; return a.map((x,i)=>{ const lin=a[0]+(a[n]-a[0])*i/n; return x+(EX-1)*(x-lin); }); };
export function build(){ if(!p) return; if(p.group){ pieceRoot.remove(p.group); disposeGroup(p.group); }
  const q={...p, w1:exag(p.w1), w2:exag(p.w2), v1:exag(p.v1), v2:exag(p.v2)};
  const L=p.L/1000, T=p.T0/1000, W=p.W0/1000, pos=[], uv=[], idx=[], groups=[];
  const P=(i,v,w)=>[i/(N-1)*L-L/2, w/1000-T/2, v/1000-W/2];
  const strip=(fn, flipWinding)=>{ const start=idx.length, base=pos.length/3;
    for(let i=0;i<N;i++){ const [a,b]=fn(i); pos.push(...a,...b); uv.push(i/(N-1),0, i/(N-1),1); }
    for(let i=0;i<N-1;i++){ const q=base+i*2; if(flipWinding) idx.push(q,q+2,q+1, q+1,q+2,q+3); else idx.push(q,q+1,q+2, q+1,q+3,q+2); }
    return [start, idx.length-start]; };
  // F1 (dessous, w1) : de C1 à C2 ; F2 (dessus, w2) ; C1 (v1) : de F1 à F2 ; C2 (v2)
  const gF1=strip(i=>[P(i,q.v1[i],q.w1[i]),P(i,q.v2[i],q.w1[i])],true);
  const gF2=strip(i=>[P(i,q.v1[i],q.w2[i]),P(i,q.v2[i],q.w2[i])],false);
  const gC1=strip(i=>[P(i,q.v1[i],q.w1[i]),P(i,q.v1[i],q.w2[i])],false);
  const gC2=strip(i=>[P(i,q.v2[i],q.w1[i]),P(i,q.v2[i],q.w2[i])],true);
  const cap=(i,flipW)=>{ const start=idx.length, base=pos.length/3;
    for(const [v,w] of [[q.v1[i],q.w1[i]],[q.v2[i],q.w1[i]],[q.v2[i],q.w2[i]],[q.v1[i],q.w2[i]]]){ pos.push(...P(i,v,w)); uv.push((v-q.v1[i])/p.W0,(w-q.w1[i])/p.T0); }
    if(flipW) idx.push(base,base+2,base+1, base,base+3,base+2); else idx.push(base,base+1,base+2, base,base+2,base+3);
    return [start, idx.length-start]; };
  const gA=cap(0,false), gB=cap(N-1,true);
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geo.setIndex(idx);
  [[gF1,0],[gF2,1],[gC1,2],[gC2,3],[gA,4],[gB,4]].forEach(([[s,c],m])=>geo.addGroup(s,c,m));
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,[faceMat('F1'),faceMat('F2'),faceMat('C1'),faceMat('C2'),endMat()]);
  mesh.castShadow=mesh.receiveShadow=true; mesh.userData.part='piece';
  const inner=new THREE.Group(); inner.add(mesh); const g=new THREE.Group(); g.add(inner);
  pieceRoot.add(g); p.group=g; p.mesh=mesh; partMeshes.piece=[mesh]; place(); app.stage.dirty(); }

/* ---------- passe ---------- */
export function stopPass(){ st.pass=false; $('pass')?.setAttribute('aria-pressed','false'); }
/* La pièce avance de st.t (mm). Bloquée si le moteur est arrêté ou si le protecteur est sur son passage.
   Elle ne recule jamais sur l'arbre : après la passe, on la ramène en la soulevant (op 'back'). */
export function updateFeed(passBlock){
  cut.blocked='';
  if(!p) return;
  if(st.t < cut.lastT-1e-6){
    if(cut.inProgress){ st.t=cut.lastT; cut.blocked='Ne reculez jamais la pièce sur l\'arbre : terminez la passe.'; stopPass(); }
    else if(cut.done){ st.t=cut.lastT; cut.blocked='Ne tirez pas la pièce en arrière sur l\'arbre : ramenez-la en la soulevant (« Ramener la pièce »).'; stopPass(); }
  }
  const tStart=(LEAD0-KNIFE_X)*1000, tEnd=travelMax()-40;
  if(!cut.started && !cut.done && st.t>tStart){
    const why=passBlock();
    if(why){ st.t=tStart; cut.blocked=why; stopPass(); }
    else { cut.started=true; cut.depth=st.d; app.recordDangers(); }
  }
  if(cut.started && st.t>=tEnd){ applyCut(cut.depth); cut.started=false; cut.done=true; }
  if(cut.done && st.t>tEnd) st.t=Math.min(st.t,travelMax());
  cut.inProgress=cut.started;
  cut.lastT=st.t;
  place();
}
function applyCut(d){ const f=faces().down, fs=p.face[f]; cut.lastMsg='';
  if(d<=0){ cut.lastMsg='Profondeur de passe nulle : aucun copeau enlevé.'; cut.msgSeq++; return; }
  const a={F1:p.w1,F2:p.w2,C1:p.v1,C2:p.v2}[f], lo=f==='F1'||f==='C1';
  if(lo){ const lvl=minA(a)+d; for(let i=0;i<N;i++) a[i]=Math.max(a[i],lvl); }
  else { const lvl=maxA(a)-d; for(let i=0;i<N;i++) a[i]=Math.min(a[i],lvl); }
  fs.passes++; fs.mark=null; if(p.vmark&&(p.vmark.s1===f||p.vmark.s2===f)) p.vmark=null;
  const gs=grainSign();
  if(gs<0){ fs.tear=true; cut.lastMsg=`Arrachements sur le ${FACE_NAME[f].toLowerCase()} : la pièce est passée contre le fil. Pivotez-la bout pour bout et repassez (1 mm au moins).`; }
  else if(fs.tear){ if(d>=1){ fs.tear=false; cut.lastMsg='Passe dans le sens du fil : les arrachements ont disparu.'; } else cut.lastMsg='Passe trop fine pour effacer les arrachements : 1 mm au moins.'; }
  if(!isF(f)){ // chant : angle avec la face posée contre le guide
    const ref=faces().back, refFlat=isF(ref)&&isFlat(ref), touch=againstGuide();
    const deg= touch&&refFlat? st.ga : touch? 90+Math.min(3,0.6*flatness(ref)+0.4) : 92.5;
    fs.angle={ ref, deg }; }
  if(cut.lastMsg) cut.msgSeq++;
  build(); }

/* ---------- manipulations ---------- */
export function rot(n){ p.k+=n; }
export function endForEnd(){ p.flip=!p.flip; }
export function toGuide(){ place(); p.zOff=0; place(); }
export function setZOff(z){ p.zOff=z; }
/* repère au crayon sur la face du dessus */
export function markTop(){ const f=faces().up, fs=p.face[f];
  if(isF(f)) fs.mark='loop';
  else { // repère d'angle : trait sur SR1 côté angle droit + trait sur SR2, qui se rejoignent à l'arête commune
    const ref=fs.angle?.ref || (p.face.F1.mark?'F1':p.face.F2.mark?'F2':'F1'); fs.mark='v'; fs.markRef=ref; p.vmark={s1:ref,s2:f}; }
  build(); return f; }
export function back(){ st.t=0; cut.done=false; cut.started=false; cut.inProgress=false; cut.lastT=0; place(); }
