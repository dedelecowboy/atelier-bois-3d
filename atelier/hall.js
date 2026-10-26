/* La salle de l'atelier menuiserie d'après le plan réel (plan.js) : sol, murs relevés sur le DWG (ouverte là où
   le plan n'a pas de mur), portes, aspiration au plafond, autres machines de l'atelier en modèles simplifiés,
   et la chaîne de débit peinte au sol.
   Repère : centre de la salle en (0, 0), X vers la droite du plan, Z vers le bas du plan, sol y = 0. Mètres. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { add, cyl, canvasTex } from '../engine/kit.js';
import { LAYOUT, PORTES } from './plan.js';

const RX=LAYOUT.salle.largeur/2, RZ=LAYOUT.salle.profondeur/2, H=3.4;
export const HALL = { x0:-RX, x1:RX, z0:-RZ, z1:RZ, h:H };

const mat=(c,o={})=>new THREE.MeshStandardMaterial({ color:c, roughness:.55, metalness:.15, ...o });
const box=(w,h,d,m,r=0.02)=>{ const g=r>0? new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/2-1e-3,h/2-1e-3,d/2-1e-3)) : new THREE.BoxGeometry(w,h,d);
  const o=new THREE.Mesh(g,m); o.castShadow=o.receiveShadow=true; return o; };
const put=(p,o,x,y,z)=>{ o.position.set(x,y,z); p.add(o); return o; };

/* ---------- autres machines de l'atelier : modèles simplifiés (ceux de l'outil de placement) ---------- */
const D={ body:mat(0xc7ccd1,{metalness:.25,roughness:.45}), alu:mat(0xe3e6e9,{metalness:.55,roughness:.3}), dark:mat(0x1d2125,{roughness:.6}),
  guard:mat(0xe8ebec,{roughness:.45}), green:mat(0x3f7d5c,{roughness:.5}), greenL:mat(0x5d8f73,{roughness:.55}), blue:mat(0x2b3f9e,{roughness:.45,metalness:.2}),
  teal:mat(0x1f7f86,{roughness:.45}), red:mat(0xa8322c,{roughness:.5}), cream:mat(0xd9d3bd,{roughness:.6}), cast:mat(0xb9c0c6,{metalness:.4,roughness:.35}),
  yellow:mat(0xe9c22c,{roughness:.6}), wood:mat(0xb98a55,{roughness:.8}), bloc:mat(0x9aa3aa,{roughness:.6}) };
const B={
  scie(c=D.blue){ const g=new THREE.Group(); put(g,box(1.2,0.85,0.9,c),0,0.425,0); put(g,box(1.3,0.06,1.1,D.cast),0,0.88,-0.05); put(g,box(3.0,0.06,0.36,D.alu),0,0.9,0.62);
    put(g,box(1.3,0.03,0.7,D.alu),0.3,0.92,1.15); put(g,box(0.06,0.08,1.9,D.alu),0.9,0.97,1.05); put(g,box(0.12,0.18,0.42,D.guard,0.04),0,1.25,0.1); return g; },
  scieV(){ return B.scie(D.green); },
  degau(){ const g=new THREE.Group(); put(g,box(1.2,0.8,0.55,D.green),0,0.4,0); put(g,box(1.35,0.07,0.5,D.cast),-0.72,0.84,0); put(g,box(1.35,0.07,0.5,D.cast),0.72,0.86,0);
    put(g,box(1.3,0.18,0.05,D.cast),0.2,1.0,-0.27); put(g,box(0.5,0.05,0.2,D.yellow,0.02),0,0.95,0.06); return g; },
  rabot(c=D.green){ const g=new THREE.Group(); put(g,box(0.85,0.8,0.8,c),0,0.4,0); put(g,box(0.8,0.06,1.0,D.cast),0,0.83,0); put(g,box(0.9,0.42,0.7,c),0,1.15,0); return g; },
  rabotA(){ return B.rabot(D.alu); }, rabotC(){ return B.rabot(D.cream); },
  ruban(){ const g=new THREE.Group(); put(g,box(0.75,1.0,0.55,D.greenL),0,0.5,0); put(g,box(0.8,0.04,0.7,D.cast),0.05,1.05,0.05); put(g,box(0.16,1.2,0.35,D.greenL),-0.3,1.6,0);
    put(g,box(0.7,0.65,0.38,D.greenL,0.1),0,2.45,0); put(g,box(0.12,0.65,0.1,D.yellow,0.02),0.3,2.45,0.2); return g; },
  toupie(){ const g=new THREE.Group(); put(g,box(1.0,0.85,0.8,D.green),0,0.425,0); put(g,box(1.2,0.05,0.9,D.cast),0,0.87,0); put(g,box(0.55,0.28,0.4,D.cream,0.04),0,1.05,-0.05);
    put(g,cyl(0.05,0.45,D.alu),0.45,1.35,0.2); put(g,box(0.45,0.18,0.24,D.dark,0.03),0.45,1.6,0.2); return g; },
  radiale(){ const g=new THREE.Group(); put(g,box(2.6,0.06,0.9,D.wood,0.01),0,0.9,0); for(const dx of [-1.1,1.1]) put(g,box(0.08,0.86,0.7,D.cream,0.01),dx,0.43,0);
    put(g,cyl(0.08,1.1,D.body),0,1.45,-0.38); put(g,box(0.25,0.18,1.0,D.body,0.03),0,1.9,0); return g; },
  tenon(){ const g=new THREE.Group(); put(g,box(2.4,0.95,0.9,D.cream,0.03),0,0.48,0); put(g,box(2.3,0.1,0.06,D.red,0.01),0,0.55,0.46); put(g,box(2.2,0.08,0.85,D.alu,0.02),0,1.6,0); put(g,box(0.9,0.6,0.15,D.red,0.02),1.4,0.7,0.6); return g; },
  teal(){ const g=new THREE.Group(); put(g,box(2.1,0.9,0.8,D.teal,0.03),0,0.45,0); put(g,box(1.9,0.3,0.6,D.alu,0.03),0,1.05,-0.05); return g; },
  bloc(){ const g=new THREE.Group(); put(g,box(1.6,1.1,1.0,D.bloc,0.04),0,0.55,0); put(g,box(1.7,0.05,1.1,D.cast),0,1.12,0); return g; },
};
/* une machine du plan en modèle simplifié, à l'échelle de ses cotes l × h × p, à sa place */
/* fond estompé quand une machine est choisie : machines sans module et descentes d'aspiration ne cachent plus le poste */
export const DECOR_MATS = Object.values(D);
/* modèles proposés pour une machine sans module (éditeur) */
export const TYPES = { bloc:'Machine (bloc à préciser)', scie:'Scie à format (bleue)', scieV:'Scie à format (verte)', degau:'Dégauchisseuse', rabot:'Raboteuse (verte)',
  rabotA:'Raboteuse (grise)', rabotC:'Raboteuse (beige)', ruban:'Scie à ruban', toupie:'Toupie', radiale:'Scie radiale', tenon:'Tenonneuse', teal:'Machine longue (bleu-vert)' };
for(const m of DECOR_MATS) m.transparent=true;
export function decorMachine(L){
  const body=(B[L.type]||B.bloc)(); const sz=new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
  const inner=new THREE.Group(); inner.add(body); if(L.l>0&&L.h>0&&L.p>0) inner.scale.set(L.l/sz.x,L.h/sz.y,L.p/sz.z);
  const g=new THREE.Group(); g.add(inner); g.position.set(L.x,0,L.z); g.rotation.y=-L.rot*Math.PI/180; return g; }

export function buildHall(scene){
  const g=new THREE.Group(); scene.add(g);
  const W=2*RX, Dp=2*RZ;

  /* sol : béton, dalles de 5 m */
  const conc=canvasTex(1024,1024,(c,w,hh)=>{ c.fillStyle='#a9aca8'; c.fillRect(0,0,w,hh);
    let s=7; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
    for(let i=0;i<5200;i++){ const v=150+Math.floor(r()*50); c.fillStyle=`rgba(${v},${v+2},${v-2},${0.10+r()*0.18})`; const k=1+r()*3; c.fillRect(r()*w,r()*hh,k,k); }
    for(let i=0;i<26;i++){ c.fillStyle=`rgba(90,92,90,${0.015+r()*0.02})`; c.beginPath(); c.arc(r()*w,r()*hh,30+r()*120,0,7); c.fill(); }
    c.strokeStyle='rgba(70,72,72,0.5)'; c.lineWidth=2; c.strokeRect(1,1,w-2,hh-2); });
  conc.wrapS=conc.wrapT=THREE.RepeatWrapping; conc.repeat.set(W/5,Dp/5);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W,Dp), new THREE.MeshStandardMaterial({ map:conc, roughness:0.92, metalness:0 }));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; g.add(floor);
  add(g, new THREE.Mesh(new THREE.BoxGeometry(W+0.6,0.25,Dp+0.6), mat(0x5a5f63,{roughness:0.9,metalness:0})), 0,-0.145,0);   // dessus 2 cm sous le sol : pas de scintillement (z-fighting) vu de haut

  /* murs relevés sur le plan (soubassement gris, mur vert d'eau) */
  const WALL=mat(0xcfe0d6,{roughness:.95,metalness:0}), BASE=mat(0x7d8790,{roughness:.8,metalness:0});
  for(const [x1,z1,x2,z2] of LAYOUT.murs){ const L=Math.hypot(x2-x1,z2-z1), ry=-Math.atan2(z2-z1,x2-x1);
    const w=new THREE.Group(); w.position.set((x1+x2)/2,0,(z1+z2)/2); w.rotation.y=ry; g.add(w);
    put(w, box(L+0.2,H,0.2,WALL,0), 0,H/2,0); put(w, box(L+0.22,1.0,0.22,BASE,0), 0,0.5,0); }
  /* portes */
  const GLASS=new THREE.MeshStandardMaterial({ color:0xbfd6e4, roughness:.1, metalness:.1, transparent:true, opacity:.5 });
  for(const [x,z,ry,low] of PORTES){ const d=new THREE.Group(); d.position.set(x,0,z); d.rotation.y=ry; g.add(d);
    put(d, box(1.8,2.3,0.26,mat(0x1f9455,{roughness:.5}),0.01), 0,1.15,0);
    if(low) put(d, box(1.8,0.9,0.27,mat(low,{roughness:.5}),0.01), 0,0.55,0);
    for(const sx of [-0.45,0.45]) put(d, box(0.5,0.8,0.28,GLASS,0), sx,1.6,0); }
  /* consignes EPI et extincteurs contre le mur du haut du plan */
  const sign=(x,draw)=>{ const t=canvasTex(256,320,(c,w)=>{ c.fillStyle='#fff'; c.fillRect(0,0,w,320); c.fillStyle='#1f5fae'; c.beginPath(); c.arc(w/2,130,104,0,7); c.fill(); c.fillStyle='#fff'; draw(c,w); });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.42,0.52), new THREE.MeshBasicMaterial({ map:t, toneMapped:false })); m.position.set(x,2.0,-RZ+0.115); g.add(m); };
  sign(-3.9,(c,w)=>{ c.fillRect(w/2-80,112,62,40); c.fillRect(w/2+18,112,62,40); c.fillRect(w/2-20,118,40,12); });
  sign(-3.4,(c,w)=>{ c.lineWidth=16; c.strokeStyle='#fff'; c.beginPath(); c.arc(w/2,140,62,Math.PI,0); c.stroke(); c.fillRect(w/2-80,128,36,54); c.fillRect(w/2+44,128,36,54); });
  sign(-2.9,(c,w)=>{ c.beginPath(); c.moveTo(w/2-70,170); c.lineTo(w/2-70,96); c.lineTo(w/2-10,96); c.lineTo(w/2-10,140); c.lineTo(w/2+80,150); c.lineTo(w/2+80,176); c.closePath(); c.fill(); });
  for(const [x,z] of [[-10.7,-2.6],[4.2,-10.6],[10.7,2.6]]){ put(g, cyl(0.085,0.55,mat(0xc4261c,{roughness:.4}),18), x,0.62,z); put(g, cyl(0.03,0.08,D.dark,10), x,0.94,z); }

  /* aspiration : collecteurs au plafond le long du mur du haut et du mur de gauche */
  const DUCT=new THREE.MeshStandardMaterial({ color:0xb9c0c6, metalness:.75, roughness:.32 });
  const dy=H-0.35, dz=-RZ+0.55, dx=-RX+0.55;
  const DROP=DUCT.clone(), HOSE=new THREE.MeshStandardMaterial({ color:0x2a2e31, roughness:.9 }); DROP.transparent=HOSE.transparent=true;
  add(g, cyl(0.17,W-1.0,DUCT,24,'x'), 0,dy,dz); add(g, cyl(0.17,Dp-1.2,DUCT,24,'z'), dx,dy,0);
  for(let x=-RX+1;x<RX-1;x+=1.5) add(g, cyl(0.182,0.05,DUCT,24,'x'), x,dy,dz);

  const drops=[];
  return { group:g, drops,
    /* descente d'aspiration au-dessus d'une machine */
    drop(x,z,yTop){ const r=0.075, y1=Math.max(yTop+0.3,2.0), yc=H+0.4;   // descente verticale jusqu'au réseau du plafond (non dessiné)
      const m=[add(g, cyl(r,yc-y1,DROP,16), x,(yc+y1)/2,z), add(g, cyl(r*0.9,0.45,HOSE,14), x,y1-0.22,z)]; drops.push(...m); return m; } };
}

/* ---------- chaîne de débit : chevrons peints au sol le long d'un tracé ---------- */
export function buildFlow(scene, points){
  const g=new THREE.Group(); scene.add(g);
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0.006,z)),false,'centripetal',0.4);
  const L=curve.getLength(), step=0.6, n=Math.floor(L/step);
  const sh=new THREE.Shape(); sh.moveTo(-0.13,-0.17); sh.lineTo(0.02,-0.17); sh.lineTo(0.2,0); sh.lineTo(0.02,0.17); sh.lineTo(-0.13,0.17); sh.lineTo(0.05,0); sh.closePath();
  const geo=new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI/2);
  const chev=[];
  for(let i=0;i<n;i++){ const u=(i+0.5)/n, p=curve.getPointAt(u), t=curve.getTangentAt(u);
    const m=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:0xe0761a, transparent:true, opacity:0.85, depthWrite:false, toneMapped:false }));
    m.position.copy(p); m.rotation.y=Math.atan2(-t.z,t.x); m.renderOrder=2; g.add(m); chev.push({ m, u }); }
  return { group:g, curve,
    tick(time){ for(const c of chev){ const w=0.5+0.5*Math.sin((c.u*L/step)*0.9 - time*3.2); c.m.material.opacity=0.35+0.6*w; } } };
}
