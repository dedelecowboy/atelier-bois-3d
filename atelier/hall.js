/* Le hall de l'atelier : sol, murs, marquages, stockage des bois et des panneaux, établis,
   réseau d'aspiration, et le tracé de la chaîne de débit au sol.
   Repère : X vers l'est, Z vers l'avant (sud), sol y = 0. Dimensions en mètres. */
import * as THREE from 'three';
import { M, rbox, add, cyl, canvasTex, woodTex } from '../engine/kit.js';

export const HALL = { x0:-13, x1:13, z0:-7.5, z1:7.5, h:4.2 };

const mat = (color, o={})=>new THREE.MeshStandardMaterial({ color, roughness:0.8, metalness:0.05, ...o });
function shadow(o, cast=true){ o.traverse(m=>{ if(m.isMesh){ m.castShadow=cast; m.receiveShadow=true; } }); return o; }

/* bande peinte au sol (rectangle plat) */
function strip(g, x0,z0,x1,z1, w, m){ const L=Math.hypot(x1-x0,z1-z0); const s=new THREE.Mesh(new THREE.PlaneGeometry(L,w), m);
  s.rotation.x=-Math.PI/2; s.rotation.z=-Math.atan2(z1-z0,x1-x0); s.position.set((x0+x1)/2,0.003,(z0+z1)/2); s.receiveShadow=true; g.add(s); return s; }
function rectStrips(g, x0,z0,x1,z1, w, m){ strip(g,x0,z0,x1,z0,w,m); strip(g,x0,z1,x1,z1,w,m); strip(g,x0,z0,x0,z1,w,m); strip(g,x1,z0,x1,z1,w,m); }

export function buildHall(scene){
  const g=new THREE.Group(); scene.add(g);
  const { x0,x1,z0,z1,h }=HALL, W=x1-x0, D=z1-z0;

  /* ---------- sol : béton quartzé, joints de dalle ---------- */
  const conc=canvasTex(1024,1024,(c,w,hh)=>{ c.fillStyle='#a9aca8'; c.fillRect(0,0,w,hh);
    let s=7; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
    for(let i=0;i<5200;i++){ const v=150+Math.floor(r()*50); c.fillStyle=`rgba(${v},${v+2},${v-2},${0.10+r()*0.18})`; const k=1+r()*3; c.fillRect(r()*w,r()*hh,k,k); }
    for(let i=0;i<26;i++){ c.fillStyle=`rgba(90,92,90,${0.015+r()*0.02})`; c.beginPath(); c.arc(r()*w,r()*hh,30+r()*120,0,7); c.fill(); }
    c.strokeStyle='rgba(70,72,72,0.55)'; c.lineWidth=2; c.strokeRect(1,1,w-2,hh-2); });
  conc.wrapS=conc.wrapT=THREE.RepeatWrapping; conc.repeat.set(W/5,D/5);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W,D), new THREE.MeshStandardMaterial({ map:conc, roughness:0.92, metalness:0 }));
  floor.rotation.x=-Math.PI/2; floor.position.set((x0+x1)/2,0,(z0+z1)/2); floor.receiveShadow=true; g.add(floor);
  // socle débordant : l'atelier posé comme une maquette
  add(g, new THREE.Mesh(new THREE.BoxGeometry(W+0.6,0.25,D+0.6), mat(0x5a5f63,{roughness:0.9})), (x0+x1)/2,-0.126,(z0+z1)/2);

  /* ---------- allées de circulation (jaune) ---------- */
  const YEL=new THREE.MeshStandardMaterial({ color:0xe2b11f, roughness:0.7 });
  // allée centrale est-ouest, de la porte (est) au poste de montage
  rectStrips(g, -11.4,-1.95, 12.9,-0.35, 0.08, YEL);
  // passage piéton hachuré devant la porte
  for(let i=0;i<7;i++) strip(g, 11.0+i*0.28,-1.9, 11.0+i*0.28+0.14,-0.4, 0.14, YEL);

  /* ---------- murs : fond et côtés, ouverts vers l'avant ---------- */
  const WALL=mat(0xe9e6df,{roughness:0.95}), BASE=mat(0x7d8790,{roughness:0.8}), GLASS=new THREE.MeshStandardMaterial({ color:0xbfd6e6, roughness:0.15, metalness:0.1, transparent:true, opacity:0.55 });
  const FRAME=mat(0x3f4a52,{metalness:0.4,roughness:0.5});
  const wall=(len,x,z,ry)=>{ const w=new THREE.Group(); w.position.set(x,0,z); w.rotation.y=ry; g.add(w);
    add(w, rbox(len,h,0.2,WALL,0), 0,h/2,-0.1); add(w, rbox(len,1.0,0.22,BASE,0), 0,0.5,-0.1); return w; };
  const back=wall(W,(x0+x1)/2,z0,0);
  // bandeau vitré en haut du mur du fond (lumière naturelle)
  for(let x=x0+1.2;x<x1-1;x+=2.6){ add(back, rbox(2.2,1.1,0.06,GLASS,0), x-(x0+x1)/2+1.1,h-0.95,0.01); add(back, rbox(2.3,0.06,0.1,FRAME,0), x-(x0+x1)/2+1.1,h-1.52,0.02); }
  const west=wall(D,x0,(z0+z1)/2,Math.PI/2);
  const east=wall(D,x1,(z0+z1)/2,-Math.PI/2);
  // porte sectionnelle (mur est), au bout de l'allée
  { const dg=new THREE.Group(); dg.position.set(0,0,0); east.add(dg);
    for(let i=0;i<6;i++) add(dg, rbox(3.2,0.52,0.06,mat(0x9aa5ad,{metalness:0.3,roughness:0.45}),0.01), -1.15,0.28+i*0.54,0.02);
    add(dg, rbox(3.5,0.12,0.12,FRAME,0), -1.15,3.3,0.04); }
  // poteaux
  for(const x of [-6.5,0,6.5]) add(g, rbox(0.3,h,0.3,mat(0xc9cdd0,{metalness:0.3}),0), x,h/2,z0+0.15);
  // panneaux d'affichage sur le mur du fond : consignes de sécurité (pictogrammes simplifiés)
  const sign=(x,y,col,draw)=>{ const t=canvasTex(256,320,(c,w,hh)=>{ c.fillStyle='#fff'; c.fillRect(0,0,w,hh); c.fillStyle=col; c.beginPath(); c.arc(w/2,130,104,0,7); c.fill(); c.fillStyle='#fff'; draw(c,w); c.fillStyle='#1b2228'; });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.42,0.52), new THREE.MeshBasicMaterial({ map:t, toneMapped:false })); m.position.set(x,y,z0+0.012); g.add(m); };
  const glasses=(c,w)=>{ c.fillRect(w/2-80,112,62,40); c.fillRect(w/2+18,112,62,40); c.fillRect(w/2-20,118,40,12); };
  const ears=(c,w)=>{ c.lineWidth=16; c.strokeStyle='#fff'; c.beginPath(); c.arc(w/2,140,62,Math.PI,0); c.stroke(); c.fillRect(w/2-80,128,36,54); c.fillRect(w/2+44,128,36,54); };
  const shoes=(c,w)=>{ c.beginPath(); c.moveTo(w/2-70,170); c.lineTo(w/2-70,96); c.lineTo(w/2-10,96); c.lineTo(w/2-10,140); c.lineTo(w/2+80,150); c.lineTo(w/2+80,176); c.closePath(); c.fill(); };
  sign(-11.3,2.0,'#1f5fae',glasses); sign(-10.8,2.0,'#1f5fae',ears); sign(-10.3,2.0,'#1f5fae',shoes);
  // extincteurs
  for(const [x,z] of [[-12.75,0.4],[12.75,-3.2],[1.0,z0+0.25]]){ const e=add(g, cyl(0.085,0.55,mat(0xc4261c,{roughness:0.4}),18), x,0.62,z); e.castShadow=true; add(g, cyl(0.03,0.08,M.dark,10), x,0.94,z); }

  /* ---------- stockage : bois massifs (râtelier cantilever), panneaux (chevalet) ---------- */
  const STEEL=mat(0x2e5d8c,{metalness:0.4,roughness:0.45}), ARM=mat(0xd06a12,{metalness:0.3,roughness:0.5});
  const wood=woodTex(); wood.wrapS=wood.wrapT=THREE.RepeatWrapping;
  const plank=(L,w,t,tint)=>{ const m=new THREE.MeshStandardMaterial({ map:wood, color:tint, roughness:0.85 }); return rbox(L,t,w,m,0.003); };
  { const r=new THREE.Group(); r.position.set(-12.55,0,-4.4); r.rotation.y=Math.PI/2; g.add(r);
    for(const x of [-1.7,0,1.7]){ add(r, rbox(0.12,2.6,0.12,STEEL,0), x,1.3,-0.3); add(r, rbox(0.12,0.12,0.9,STEEL,0), x,0.06,0.05);
      for(const y of [0.45,1.15,1.85]) add(r, rbox(0.06,0.06,0.62,ARM,0), x,y,0.07); }
    const tints=[0xe9d2a8,0xd8b886,0xc79a68,0xe2c79a];
    for(const [y,n] of [[0.48,6],[1.18,5],[1.88,4]]) for(let i=0;i<n;i++){ const b=plank(3.9-(i%2)*0.3,0.17+0.02*(i%3),0.027,tints[(i+n)%4]); add(r,b,0.05*(i%2),y+0.045+Math.floor(i/3)*0.03,-0.17+(i%3)*0.18); }
    shadow(r); r.userData.label='Stock de bois massifs'; }
  { const p=new THREE.Group(); p.position.set(-12.35,0,4.6); p.rotation.y=Math.PI/2; g.add(p);
    add(p, rbox(3.0,0.12,0.9,STEEL,0), 0,0.06,0); for(const x of [-1.3,1.3]) add(p, rbox(0.1,1.9,0.1,STEEL,0), x,1.0,-0.25);
    const cols=[0xf1efe8,0xd9c29a,0xb07a4a,0xf1efe8,0xe6e2d6];
    for(let i=0;i<5;i++){ const m=add(p, rbox(2.8,2.07,0.019,mat(cols[i],{roughness:0.6}),0.002), 0,1.15,-0.18+i*0.022); m.rotation.x=-0.12; }
    shadow(p); }
  // chariot de transfert et pile de pièces débitées entre les machines
  const cart=(x,z,ry,load)=>{ const c=new THREE.Group(); c.position.set(x,0,z); c.rotation.y=ry; g.add(c);
    add(c, rbox(1.2,0.05,0.7,mat(0x6b7178,{metalness:0.4}),0.004), 0,0.62,0);
    for(const sx of [-0.55,0.55]) for(const sz of [-0.3,0.3]){ add(c, rbox(0.04,0.5,0.04,M.dark,0), sx,0.36,sz); add(c, cyl(0.05,0.03,M.dark,14,'z'), sx,0.06,sz); }
    add(c, rbox(0.04,0.5,0.7,mat(0x6b7178,{metalness:0.4}),0), 0.62,0.9,0);
    for(let i=0;i<load;i++) add(c, plank(1.05,0.08,0.03,0xe1c597), -0.02,0.665+0.032*Math.floor(i/4),-0.24+0.16*(i%4));
    shadow(c); };
  cart(-5.6,-2.75,0,8); cart(6.1,-2.75,0,7); cart(10.6,0.9,Math.PI/2,6);

  /* ---------- établis (montage) ---------- */
  const BENCH=new THREE.MeshStandardMaterial({ map:wood, color:0xd9b98a, roughness:0.75 });
  for(const [x,z] of [[-2.8,4.9],[-0.2,4.9],[-2.8,6.3],[-0.2,6.3]]){ const b=new THREE.Group(); b.position.set(x,0,z); g.add(b);
    add(b, rbox(2.0,0.08,0.75,BENCH,0.006), 0,0.86,0);
    for(const sx of [-0.88,0.88]){ add(b, rbox(0.08,0.82,0.6,mat(0x8a5a32),0), sx,0.41,0); }
    add(b, rbox(1.8,0.05,0.5,mat(0x8a5a32),0), 0,0.18,0);
    add(b, rbox(0.22,0.1,0.18,M.dark,0.004), 0.82,0.93,0.34);     // presse d'établi
    shadow(b); }

  /* ---------- aspiration centralisée : collecteur le long du mur du fond, descentes aux machines ---------- */
  const DUCT=new THREE.MeshStandardMaterial({ color:0xb9c0c6, metalness:0.75, roughness:0.32 });
  const ductY=3.55, ductZ=z0+0.55;
  const main=add(g, cyl(0.16,x1-x0-1.0,DUCT,24,'x'), (x0+x1)/2-0.3,ductY,ductZ);
  for(let x=x0+1;x<x1-1;x+=1.5) add(g, cyl(0.172,0.05,DUCT,24,'x'), x,ductY,ductZ);
  // sortie vers le silo (mur ouest)
  add(g, cyl(0.2,0.6,DUCT,24,'x'), x0+0.25,ductY,ductZ);
  main.castShadow=false;

  return { group:g,
    /* descente d'aspiration jusqu'au-dessus d'une machine (x, z : point de raccordement ; yTop : haut de la machine) */
    drop(x,z,yTop){ const r=0.075; const y1=Math.max(yTop+0.35,2.2);
      const run=z-ductZ; if(Math.abs(run)>0.05){ add(g, cyl(r,Math.abs(run),DUCT,18,'z'), x,ductY-0.02,ductZ+run/2); }
      add(g, cyl(r*1.15,0.1,DUCT,18), x,ductY-0.06,ductZ);
      add(g, cyl(r,ductY-y1,DUCT,18), x,(ductY+y1)/2,z);
      add(g, cyl(r*0.9,0.5,new THREE.MeshStandardMaterial({ color:0x2a2e31, roughness:0.9 }),14), x,y1-0.25,z); } };
}

/* ---------- chaîne de débit : chevrons peints au sol le long d'un tracé ---------- */
export function buildFlow(scene, points){
  const g=new THREE.Group(); scene.add(g);
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0.006,z)),false,'centripetal',0.4);
  const L=curve.getLength(), step=0.62, n=Math.floor(L/step);
  const sh=new THREE.Shape(); sh.moveTo(-0.13,-0.17); sh.lineTo(0.02,-0.17); sh.lineTo(0.2,0); sh.lineTo(0.02,0.17); sh.lineTo(-0.13,0.17); sh.lineTo(0.05,0); sh.closePath();
  const geo=new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI/2);
  const chev=[];
  for(let i=0;i<n;i++){ const u=(i+0.5)/n, p=curve.getPointAt(u), t=curve.getTangentAt(u);
    const m=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:0xe0761a, transparent:true, opacity:0.85, depthWrite:false, toneMapped:false }));
    m.position.copy(p); m.rotation.y=Math.atan2(-t.z,t.x); m.renderOrder=2; g.add(m); chev.push({ m, u }); }
  return { group:g, curve,
    tick(time){ for(const c of chev){ const w=0.5+0.5*Math.sin((c.u*L/step)*0.9 - time*3.2); c.m.material.opacity=0.35+0.6*w; } } };
}
