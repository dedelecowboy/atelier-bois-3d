/* Outils de construction des modèles 3D, communs à toutes les machines.
   Unités : mètres. Une machine importe ce dont elle a besoin. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* Matériaux de base d'une machine à bois (tôle, alu, fonte…). */
export const M = {
  body:  new THREE.MeshStandardMaterial({color:0xc7ccd1, metalness:0.25, roughness:0.5}),
  panel: new THREE.MeshStandardMaterial({color:0x34404b, metalness:0.3, roughness:0.42}),
  alu:   new THREE.MeshStandardMaterial({color:0xe8ebee, metalness:0.55, roughness:0.32}),
  aluDk: new THREE.MeshStandardMaterial({color:0xbcc2c8, metalness:0.5, roughness:0.38}),
  cast:  new THREE.MeshStandardMaterial({color:0xcdd2d6, metalness:0.4, roughness:0.35}),
  dark:  new THREE.MeshStandardMaterial({color:0x1d2125, metalness:0.1, roughness:0.65}),
  steel: new THREE.MeshStandardMaterial({color:0x5d646b, metalness:0.9, roughness:0.35}),
  blade: new THREE.MeshStandardMaterial({color:0xe9edf0, metalness:1, roughness:0.2, side:THREE.DoubleSide}),
  guard: new THREE.MeshStandardMaterial({color:0xeef1f3, metalness:0.1, roughness:0.45, side:THREE.DoubleSide}),
  accent:new THREE.MeshStandardMaterial({color:0xd27a1c, metalness:0.2, roughness:0.4}),
  clear: new THREE.MeshPhysicalMaterial({color:0xd9e6ee, metalness:0, roughness:0.05, transmission:0.6, transparent:true, opacity:0.35}),
  red:   new THREE.MeshStandardMaterial({color:0xc4261c, roughness:0.4}),
  yellow:new THREE.MeshStandardMaterial({color:0xe9c22c, roughness:0.5}),
  brass: new THREE.MeshStandardMaterial({color:0xb88a3e, metalness:0.9, roughness:0.35}),
};
/* Matériaux des organes intérieurs (moteurs, courroies, carters). */
export const MI = {
  motor: new THREE.MeshStandardMaterial({color:0x4d6b57, metalness:0.35, roughness:0.5}),
  cast:  new THREE.MeshStandardMaterial({color:0x8f979e, metalness:0.6, roughness:0.45}),
  belt:  new THREE.MeshStandardMaterial({color:0x26282b, roughness:0.85}),
  zinc:  new THREE.MeshStandardMaterial({color:0xb9c0c6, metalness:0.9, roughness:0.28}),
  hose:  new THREE.MeshStandardMaterial({color:0x7d8a95, roughness:0.6, metalness:0.1}),
  plast: new THREE.MeshStandardMaterial({color:0x9aa3ab, roughness:0.6}),
};

export const v3 = (x,y,z)=>new THREE.Vector3(x,y,z);
export function rbox(w,h,d,mat,r=0.006){ return new THREE.Mesh(r>0? new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/2-1e-4,h/2-1e-4,d/2-1e-4)) : new THREE.BoxGeometry(w,h,d), mat); }
export function add(parent, mesh, x=0,y=0,z=0){ mesh.position.set(x,y,z); parent.add(mesh); return mesh; }
export function cyl(r,len,mat,seg=24,axis='y'){ const g=new THREE.CylinderGeometry(r,r,len,seg); if(axis==='x') g.rotateZ(Math.PI/2); if(axis==='z') g.rotateX(Math.PI/2); return new THREE.Mesh(g,mat); }
/* lien étirable entre deux points (géométrie le long de Z local, longueur unité) */
export function link(geom, mat){ const m=new THREE.Mesh(geom,mat); m.userData.link=true; return m; }
export function setBetween(m,a,b){ m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(1,1,a.distanceTo(b)); m.lookAt(b); }

export function canvasTex(w,h,draw){ const c=document.createElement('canvas'); c.width=w;c.height=h; const g=c.getContext('2d'); draw(g,w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; t.userData.canvas=c; return t; }
/* règle graduée (mm) */
export function rulerTex(lenMm){ return canvasTex(4096,64,(g,w,h)=>{ g.fillStyle='#e4e7e2'; g.fillRect(0,0,w,h); g.fillStyle='#1c1f22'; g.font='bold 22px monospace';
  const px=w/lenMm; for(let mm=0;mm<=lenMm;mm+=10){ const x=mm*px; const L= mm%100===0?36: mm%50===0?24:12; g.fillRect(x,0,1.5,L); if(mm%100===0&&mm>0&&mm<lenMm) g.fillText(String(mm/10),x+3,58);} }); }

/* courroie autour de deux poulies (enveloppe convexe des deux cercles), dans le plan XY, centrée sur z */
export function beltGeom(c1,r1,c2,r2,w,t){
  const hull=(pad)=>{ const pts=[]; for(const [c,r] of [[c1,r1+pad],[c2,r2+pad]]) for(let i=0;i<64;i++){ const a=i/64*Math.PI*2; pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r]); }
    pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const lo=[],up=[]; for(const p of pts){ while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0) lo.pop(); lo.push(p);} for(const p of pts.slice().reverse()){ while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0) up.pop(); up.push(p);} return lo.slice(0,-1).concat(up.slice(0,-1)); };
  const o=hull(t), i=hull(0); const sh=new THREE.Shape(o.map(p=>new THREE.Vector2(...p))); sh.holes.push(new THREE.Path(i.reverse().map(p=>new THREE.Vector2(...p))));
  const g=new THREE.ExtrudeGeometry(sh,{depth:w,bevelEnabled:false}); g.translate(0,0,-w/2); return g; }
/* poulie à gorges (poly-V) d'axe Z */
export function pulley(r,w,mat){ const g=new THREE.Group(); g.add(cyl(r,w,mat,36,'z')); for(let i=0;i<4;i++){ const gr=new THREE.Mesh(new THREE.TorusGeometry(r,0.0025,4,40),M.dark); gr.position.z=-w/2+w*(i+0.5)/4; g.add(gr);} const sp=rbox(r*1.6,0.012,w*1.05,M.dark,0); g.add(sp); const sp2=sp.clone(); sp2.rotation.z=Math.PI/2; g.add(sp2); return g; }
/* secteur plat (arc) : forme u→z, v→y, épaisseur→x */
export function arcPlate(r0,r1,f0,f1,th,mat){ const s=new THREE.Shape(), n=40; for(let i=0;i<=n;i++){ const f=f0+(f1-f0)*i/n; const p=[r1*Math.sin(f),-r1*Math.cos(f)]; i?s.lineTo(...p):s.moveTo(...p);} for(let i=n;i>=0;i--){ const f=f0+(f1-f0)*i/n; s.lineTo(r0*Math.sin(f),-r0*Math.cos(f)); } s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:th,bevelEnabled:false}); g.translate(0,0,-th/2); g.rotateY(-Math.PI/2); return new THREE.Mesh(g,mat); }

/* texture de bois (fil dans la hauteur du canevas), aléa reproductible */
export function woodTex(){ return canvasTex(512,2048,(g,w,h)=>{
  let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  g.fillStyle='#c79a63'; g.fillRect(0,0,w,h);
  for(let i=0;i<70;i++){ const x0=rnd()*w, amp=4+rnd()*10, fr=0.002+rnd()*0.004, ph=rnd()*6, lw=0.6+rnd()*2.4;
    const dark=rnd()<0.6; g.strokeStyle= dark? `rgba(120,78,38,${0.18+rnd()*0.35})` : `rgba(235,200,150,${0.15+rnd()*0.25})`; g.lineWidth=lw;
    g.beginPath(); for(let y=0;y<=h;y+=16){ const x=x0+Math.sin(y*fr+ph)*amp+Math.sin(y*fr*3.1+ph)*amp*0.25; y?g.lineTo(x,y):g.moveTo(x,y);} g.stroke(); }
  for(let k=0;k<9;k++){ g.strokeStyle=`rgba(110,70,32,${0.25+k*0.03})`; g.lineWidth=1.6; g.beginPath();
    const cx=w*0.55, top=h*0.30+k*55, bw=30+k*16; g.moveTo(cx-bw,h); g.lineTo(cx-bw,top+bw*1.6); g.quadraticCurveTo(cx,top-40,cx+bw,top+bw*1.6); g.lineTo(cx+bw,h); g.stroke(); }
  for(let i=0;i<5000;i++){ g.fillStyle=`rgba(90,55,25,${rnd()*0.25})`; g.fillRect(rnd()*w,rnd()*h,1,2+rnd()*5); }
}); }

/* Lame de scie circulaire carbure, la même sur toutes les machines (d'après la lame réelle de la scie à format :
   dents trapézoïdales à plaquettes carbure, fentes de dilatation terminées par un trou, fentes anti-bruit rouges,
   marquage gravé et flèche de rotation). Disque dans le plan XY, axe Z, centre à l'origine.
   o = { R (m), Z (dents), plate (corps, m), kerf (plaquettes, m), bore (Ø d'alésage, m), pins (trous d'entraînement),
         dir : +1 si la lame tourne dans le sens rotation.z croissant, −1 sinon (les dents attaquent dans ce sens),
         mark : [ligne 1, ligne 2] gravées sur la face }
   Les géométries, textures et matériaux sont partagés entre les lames identiques (cache). */
const bladeCache = new Map();
export function sawBlade(o={}){
  const R=o.R??0.2, Z=o.Z??72, plate=o.plate??0.0032, kerf=o.kerf??0.0044, bore=o.bore??0.03, dir=o.dir??-1;
  const mark=o.mark||[`Ø${Math.round(R*2000)} × ${(kerf*1000).toFixed(1).replace('.',',')}/${(plate*1000).toFixed(1).replace('.',',')} × ${Math.round(bore*1000)}  Z${Z}  HW`,'n max 6000 RPM'];
  const key=JSON.stringify([R,Z,plate,kerf,bore,!!o.pins,mark,dir<0]);
  let c=bladeCache.get(key);
  if(!c){
    const N=Z, st=Math.PI*2/N, P=(r,an)=>[Math.cos(an)*r,Math.sin(an)*r];
    const k=Math.min(2.2, (2*Math.PI*R/N)/(2*Math.PI*0.2/72)), q=R/0.2;   // profondeur des dents : suit le pas ; fentes : suivent le rayon
    const s=new THREE.Shape();
    // dent trapézoïdale : dos incliné, sommet plat, face d'attaque raide, creux arrondi (sens d'attaque = angle croissant ; mise en miroir si dir < 0)
    for(let i=0;i<N;i++){ const a=i*st;
      const pts=[P(R-0.0075*k,a),P(R-0.0072*k,a+st*0.08),P(R-0.0050*k,a+st*0.25),P(R-0.0012*k,a+st*0.62),P(R,a+st*0.70),P(R,a+st*0.76),P(R-0.0040*k,a+st*0.79),P(R-0.0068*k,a+st*0.86),P(R-0.0076*k,a+st*0.94)];
      pts.forEach(([x,y],j)=> (i===0&&j===0)? s.moveTo(x,y): s.lineTo(x,y)); }
    s.closePath();
    const hole=new THREE.Path(); hole.absarc(0,0,bore/2,0,Math.PI*2,true); s.holes.push(hole);
    if(o.pins) for(const sx of [-1,1]){ const pin=new THREE.Path(); pin.absarc(sx*(bore/2+0.012),0,0.0045,0,Math.PI*2,true); s.holes.push(pin); }   // trous d'entraînement
    for(let j=0;j<6;j++){ const a=j*Math.PI/3+0.26, w=0.0008, r1=R-0.040*q, r2=R-0.013*q;              // fentes de dilatation terminées par un trou
      const sl=new THREE.Path(), cs=Math.cos(a), sn=Math.sin(a), px=-sn*w, py=cs*w;
      sl.moveTo(cs*r1+px,sn*r1+py); sl.lineTo(cs*r2+px,sn*r2+py); sl.lineTo(cs*r2-px,sn*r2-py); sl.lineTo(cs*r1-px,sn*r1-py); s.holes.push(sl);
      const e=new THREE.Path(); e.absarc(cs*(r1-0.0045),sn*(r1-0.0045),0.0032,0,Math.PI*2,true); s.holes.push(e); }
    const geom=new THREE.ExtrudeGeometry(s,{depth:plate,bevelEnabled:false,curveSegments:10}); geom.translate(0,0,-plate/2);
    // face : acier brossé, anneau, fentes anti-bruit rouges, marquage et flèche de rotation
    const T=1024, off=document.createElement('canvas'); off.width=off.height=T; const g=off.getContext('2d'), cc=T/2, kk=T/(2*R);
    const grd=g.createRadialGradient(cc,cc,20,cc,cc,cc); grd.addColorStop(0,'#eef1f3'); grd.addColorStop(0.6,'#d6dbdf'); grd.addColorStop(1,'#c9ced3'); g.fillStyle=grd; g.fillRect(0,0,T,T);
    for(let i=0;i<260;i++){ const r=40+Math.random()*(cc-50), a0=Math.random()*6.28; g.strokeStyle=`rgba(${Math.random()<.5?255:120},${Math.random()<.5?255:125},${Math.random()<.5?255:130},.10)`; g.lineWidth=1; g.beginPath(); g.arc(cc,cc,r,a0,a0+0.4+Math.random()*1.4); g.stroke(); }
    g.strokeStyle='rgba(120,128,136,.45)'; g.lineWidth=2; g.beginPath(); g.arc(cc,cc,0.60*R*kk,0,7); g.stroke();
    for(let i=0;i<6;i++){ const a=i*Math.PI/3+0.26+Math.PI/6, rr=0.76*R*kk; g.save(); g.translate(cc+Math.cos(a)*rr,cc+Math.sin(a)*rr); g.rotate(a);
      g.strokeStyle='#c7332b'; g.lineWidth=8; g.lineCap='round'; g.beginPath(); const L=86, A=20; g.moveTo(-A,-L/2);
      for(let t=0;t<=1.0001;t+=0.02) g.lineTo(Math.sin(t*Math.PI*3)*A,-L/2+t*L); g.stroke();
      g.fillStyle='#c7332b'; for(const yy of [-L/2,L/2]){ g.beginPath(); g.arc(Math.sin((yy>0?1:0)*Math.PI*3)*A,yy,7,0,7); g.fill(); } g.restore(); }
    g.fillStyle='rgba(95,103,110,.85)'; g.textAlign='center'; g.font='600 30px "JetBrains Mono",monospace';
    g.fillText(mark[0],cc,cc+0.36*R*kk); g.font='500 24px "JetBrains Mono",monospace'; if(mark[1]) g.fillText(mark[1],cc,cc+0.36*R*kk+34);
    g.strokeStyle='rgba(95,103,110,.85)'; g.lineWidth=5; g.beginPath(); g.arc(cc,cc,0.47*R*kk,Math.PI*0.62,Math.PI*0.38,true); g.stroke();
    const ea=Math.PI*0.38, ex=cc+Math.cos(ea)*0.47*R*kk, ey=cc+Math.sin(ea)*0.47*R*kk; g.fillStyle='rgba(95,103,110,.85)'; g.save(); g.translate(ex,ey); g.rotate(ea-Math.PI/2); g.beginPath(); g.moveTo(-14,0); g.lineTo(14,0); g.lineTo(0,-22); g.closePath(); g.fill(); g.restore();
    let src=off;
    if(dir<0){ src=document.createElement('canvas'); src.width=src.height=T; const h=src.getContext('2d'); h.translate(T,0); h.scale(-1,1); h.drawImage(off,0,0); } // pré-miroir (le disque est en miroir)
    const tex=new THREE.CanvasTexture(src); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8; tex.repeat.set(1/(2*R),1/(2*R)); tex.offset.set(0.5,0.5);
    const face=new THREE.MeshStandardMaterial({map:tex,metalness:0.55,roughness:0.32,side:THREE.DoubleSide});
    const tipG=new THREE.BoxGeometry(0.0055*Math.min(k,1.6),0.0032,kerf), tipM=new THREE.MeshStandardMaterial({color:0x9aa2a9,metalness:0.7,roughness:0.35});
    c={geom,face,tipG,tipM,N,st,k}; bladeCache.set(key,c); }
  const grp=new THREE.Group(), disc=new THREE.Group(); if(dir<0) disc.scale.x=-1; grp.add(disc);
  disc.add(new THREE.Mesh(c.geom,[c.face,M.blade]));
  const tips=new THREE.InstancedMesh(c.tipG,c.tipM,c.N), ob=new THREE.Object3D();
  for(let i=0;i<c.N;i++){ const a=i*c.st+c.st*0.70; ob.position.set(Math.cos(a)*(R-0.0016),Math.sin(a)*(R-0.0016),0); ob.rotation.set(0,0,a+Math.PI/2); ob.updateMatrix(); tips.setMatrixAt(i,ob.matrix); }
  disc.add(tips); return grp; }
