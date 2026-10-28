/* Personnages simplifiés de l'atelier (élèves) : corps en volumes simples, tenue, EPI et accessoires.
   person(o) rend un groupe debout sur y = 0, regardant vers +Z (l'avant), environ 1,75 m.
   o.epi   : liste de codes d'EPI visibles (lunettes, auditif, masque, masque_a, chaussures, gants_manut, gants_chim, tenue)
   o.hair  : 'court' | 'long' (cheveux détachés) | 'attache' (queue de cheval)
   o.echarpe, o.bijoux : accessoires dangereux près des machines
   o.pose  : 'debout' | 'machine' (bras vers l'avant) | 'porte' (porte un panneau, dos courbé) | 'soufflette' | 'aspire'
   setEpi(g, o) : remet la tenue d'un personnage déjà construit (avatar du scénario « EPI »). */
import * as THREE from 'three';

const mat=(c,o={})=>new THREE.MeshStandardMaterial({ color:c, roughness:.7, metalness:0, ...o });
const C={ skin:mat(0xe2b48f), pants:mat(0x2e3d55), blouse:mat(0x3d5f8a), blouseOpen:mat(0x8a5a8a), hair:mat(0x3a2a1c), shoeS:mat(0x1d1f22), shoeB:mat(0xf1f1ee),
  yellow:mat(0xe9c22c,{roughness:.45}), glass:new THREE.MeshStandardMaterial({ color:0x9fd0e6, roughness:.1, transparent:true, opacity:.55 }), mask:mat(0xf3f3f0),
  maskA:mat(0x55606a), filt:mat(0xb0342c), gm:mat(0xc9a64a), gc:mat(0x3a7fd0), red:mat(0xc4261c), gold:new THREE.MeshStandardMaterial({ color:0xd8b04a, metalness:.9, roughness:.25 }) };
const box=(w,h,d,m)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.castShadow=o.receiveShadow=true; return o; };
const sph=(r,m,s=16)=>{ const o=new THREE.Mesh(new THREE.SphereGeometry(r,s,Math.round(s*0.75)),m); o.castShadow=true; return o; };
const cyl=(r1,r2,h,m,s=14)=>{ const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,s),m); o.castShadow=true; return o; };
const at=(p,o,x,y,z)=>{ o.position.set(x,y,z); p.add(o); return o; };

/* bras : groupe pivotant à l'épaule, main au bout (y négatif) */
function arm(side){ const g=new THREE.Group(); g.position.set(side*0.27,1.38,0);
  at(g,cyl(0.05,0.045,0.62,C.blouse),0,-0.31,0).userData.sleeve=true;
  const h=at(g,sph(0.055,C.skin,12),0,-0.66,0); h.userData.hand=true; g.userData.hand=h; return g; }

export function person(o={}){
  const g=new THREE.Group(), P={};
  P.body=new THREE.Group(); g.add(P.body);            // tout ce qui s'incline (dos courbé)
  P.legs=[-1,1].map(s=>at(g,box(0.15,0.86,0.17,C.pants),s*0.1,0.47,0));
  P.shoes=[-1,1].map(s=>at(g,box(0.15,0.09,0.3,C.shoeS),s*0.1,0.045,0.05));
  P.torso=at(P.body,box(0.44,0.62,0.25,C.blouse),0,1.15,0);
  P.flap=at(P.body,box(0.2,0.5,0.03,C.blouseOpen),0.13,1.08,0.14); P.flap.rotation.y=-0.7;   // blouse ouverte qui flotte
  P.neck=at(P.body,cyl(0.05,0.05,0.08,C.skin),0,1.5,0);
  P.head=at(P.body,sph(0.12,C.skin),0,1.63,0);
  P.hairShort=at(P.body,sph(0.126,C.hair),0,1.665,-0.012); P.hairShort.scale.set(1,0.75,1);
  P.hairLong=at(P.body,box(0.24,0.42,0.06,C.hair),0,1.45,-0.12);
  P.tail=at(P.body,cyl(0.035,0.02,0.2,C.hair),0,1.6,-0.15); P.tail.rotation.x=0.5;
  P.arms=[arm(-1),arm(1)]; for(const a of P.arms) P.body.add(a);
  /* EPI */
  P.glasses=at(P.body,box(0.22,0.05,0.04,C.glass),0,1.65,0.11);
  P.ear=new THREE.Group(); P.body.add(P.ear);
  { const band=new THREE.Mesh(new THREE.TorusGeometry(0.135,0.012,6,20,Math.PI),C.yellow); band.position.set(0,1.64,0); P.ear.add(band);
    for(const s of [-1,1]){ const c=cyl(0.055,0.055,0.05,C.yellow); c.rotation.z=Math.PI/2; c.position.set(s*0.135,1.63,0); P.ear.add(c); } }
  P.mask=at(P.body,sph(0.07,C.mask,12),0,1.57,0.1); P.mask.scale.set(1,0.8,0.7);
  P.maskA=new THREE.Group(); P.body.add(P.maskA);
  { const m=sph(0.07,C.maskA,12); m.scale.set(1,0.8,0.75); m.position.set(0,1.57,0.1); P.maskA.add(m);
    for(const s of [-1,1]){ const f=cyl(0.035,0.035,0.04,C.filt); f.rotation.x=Math.PI/2; f.position.set(s*0.07,1.55,0.16); P.maskA.add(f); } }
  /* accessoires */
  P.scarf=new THREE.Group(); P.body.add(P.scarf);
  { const t=new THREE.Mesh(new THREE.TorusGeometry(0.08,0.03,6,16),C.red); t.rotation.x=Math.PI/2; t.position.set(0,1.48,0); P.scarf.add(t);
    const e=box(0.08,0.45,0.03,C.red); e.position.set(0.08,1.22,0.15); e.rotation.z=0.25; P.scarf.add(e); }
  P.bracelet=new THREE.Mesh(new THREE.TorusGeometry(0.05,0.012,6,14),C.gold); P.bracelet.rotation.x=Math.PI/2; P.arms[1].add(P.bracelet); P.bracelet.position.set(0,-0.58,0);
  g.userData.P=P;
  setPose(g,o.pose||'debout'); setEpi(g,o);
  return g;
}

/* poses : rotations des bras (avant / arrière, écart) et inclinaison du dos */
export function setPose(g,pose){ const P=g.userData.P;
  const A={ debout:[[0,0.08],[0,-0.08],0], machine:[[-1.15,0.1],[-1.15,-0.1],0.08], porte:[[-1.9,0.25],[-1.9,-0.25],0.75],
    soufflette:[[0,0.08],[-1.35,-0.2],0.15], aspire:[[-0.7,0.15],[-0.95,-0.1],0.35] }[pose]||[[0,0],[0,0],0];
  P.arms.forEach((a,i)=>{ a.rotation.set(A[i][0],0,A[i][1]); }); P.body.rotation.x=A[2];
  P.body.position.set(0,0,0); if(A[2]>0.3){ P.body.position.z=0; } g.userData.pose=pose; }

export function setEpi(g,o={}){ const P=g.userData.P, e=new Set(o.epi||[]);
  P.glasses.visible=e.has('lunettes'); P.ear.visible=e.has('auditif'); P.mask.visible=e.has('masque'); P.maskA.visible=e.has('masque_a');
  const hair=o.hair||'court'; P.hairShort.visible=true; P.hairLong.visible=hair==='long'; P.tail.visible=hair==='attache';
  P.scarf.visible=!!o.echarpe; P.bracelet.visible=!!o.bijoux;
  const tenue=e.has('tenue') || o.tenue===true; P.flap.visible=!tenue;
  for(const s of P.shoes) s.material= e.has('chaussures')? C.shoeS : C.shoeB;
  const hm= e.has('gants_chim')? C.gc : e.has('gants_manut')? C.gm : C.skin;
  for(const a of P.arms){ const h=a.userData.hand; h.material=hm; h.scale.setScalar(hm===C.skin?1:1.25); } }

/* objets tenus ou posés par les personnages */
export function soufflette(){ const g=new THREE.Group(); at(g,box(0.04,0.12,0.03,mat(0x2a2e31)),0,0,0); const b=at(g,cyl(0.008,0.008,0.22,mat(0xb9c0c6,{metalness:.8,roughness:.3})),0,0.04,0.1); b.rotation.x=Math.PI/2; return g; }
/* nuage de poussière (sphères translucides, animées par tick) */
export function dustCloud(n=14, r=0.6){ const g=new THREE.Group(); const m=new THREE.MeshStandardMaterial({ color:0xd6c39a, transparent:true, opacity:.35, depthWrite:false, roughness:1 });
  for(let i=0;i<n;i++){ const s=new THREE.Mesh(new THREE.SphereGeometry(0.12+Math.random()*0.18,10,8),m); s.position.set((Math.random()-.5)*r*2,(Math.random())*r*1.2,(Math.random()-.5)*r*2); s.userData.ph=Math.random()*6; g.add(s); }
  g.userData.tick=t=>{ for(const s of g.children){ s.position.y+=Math.sin(t*0.8+s.userData.ph)*0.0015; s.scale.setScalar(1+0.12*Math.sin(t*1.3+s.userData.ph)); } }; return g; }
