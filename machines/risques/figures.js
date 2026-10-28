/* Personnages de l'atelier (élèves), articulés : bassin, dos, cou, tête ; épaules, coudes, poignets ; hanches, genoux.
   person(o) rend un groupe debout sur y = 0, regardant vers +Z, environ 1,74 m.
   o.epi   : codes d'EPI portés (lunettes, auditif, masque, masque_a, chaussures, gants_manut, gants_chim, tenue)
   o.hair  : 'court' | 'long' (cheveux détachés) | 'attache' (queue de cheval)
   o.echarpe, o.bijoux : accessoires dangereux près des machines
   o.pose  : 'debout' | 'machine' (mains au plan de travail) | 'soufflette' | 'aspire' | 'dos_courbe' (soulève un panneau, jambes tendues)
   Sans « tenue » : sweat à capuche ouvert, pans qui flottent, baskets blanches. Avec : veste de travail fermée à bandes, chaussures de sécurité.
   setEpi(g, o), setPose(g, pose) : changent un personnage déjà construit (avatar du scénario « EPI »).
   Articulations : rotation.x négative = vers l'avant (+Z) pour les bras et les jambes ; positive = dos penché en avant. */
import * as THREE from 'three';

const std=(c,o={})=>new THREE.MeshStandardMaterial({ color:c, roughness:.78, metalness:0, ...o });
const C={ skin:std(0xd9a67e,{roughness:.62}), lip:std(0xb06a5c), eye:std(0x2a2522,{roughness:.3}), white:std(0xf2efe8,{roughness:.4}), brow:std(0x3b2a1d),
  hair:std(0x3b2a1d,{roughness:.9}), pants:std(0x2b3546), pantsK:std(0x1f2633), jacket:std(0x31507d), jacketD:std(0x263f63), band:std(0xc8ccd0,{roughness:.35,metalness:.2}), orange:std(0xe0761a),
  hoodie:std(0x8b3a3a), tee:std(0xbfc4c8), shoeS:std(0x1b1d20,{roughness:.55}), toe:std(0x3a3e43,{roughness:.4,metalness:.4}), shoeB:std(0xf0efea), sole:std(0x9aa0a6),
  yellow:std(0xf0c419,{roughness:.45}), red:std(0xc4261c,{roughness:.5}), black:std(0x1d1f22,{roughness:.6}), glass:new THREE.MeshStandardMaterial({ color:0xbfe3f2, roughness:.05, metalness:.1, transparent:true, opacity:.45 }),
  ffp:std(0xf4f4f0,{roughness:.9}), valve:std(0xd8d8d0), rubber:std(0x4a525a,{roughness:.7}), filt:std(0xb35a6a), gm:std(0xc9a64a,{roughness:.95}), gmc:std(0x6b5a2b), gc:std(0x2f6fd0,{roughness:.5}),
  scarf:std(0xb8322c,{roughness:.95}), gold:new THREE.MeshStandardMaterial({ color:0xd8b04a, metalness:.9, roughness:.25 }) };

const HIP=0.955;   // hauteur des hanches debout : semelles au ras du sol
const mesh=(g,m)=>{ const o=new THREE.Mesh(g,m); o.castShadow=true; o.receiveShadow=true; return o; };
const at=(p,o,x=0,y=0,z=0)=>{ o.position.set(x,y,z); p.add(o); return o; };
const cap=(r,len,m,rs=14)=>mesh(new THREE.CapsuleGeometry(r,len,6,rs),m);
const sph=(r,m,s=18)=>mesh(new THREE.SphereGeometry(r,s,Math.round(s*0.7)),m);
const cyl=(r1,r2,h,m,s=16)=>mesh(new THREE.CylinderGeometry(r1,r2,h,s),m);
/* volume de révolution d'après un profil [rayon, hauteur], aplati en profondeur (sz) */
const lathe=(pts,m,sz=0.66,seg=24)=>{ const o=mesh(new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(r,y)),seg),m); o.scale.z=sz; return o; };
/* segment de membre : articulation (groupe) + capsule qui descend de « len » ; enfant suivant au bout */
function limb(parent,x,y,z,r1,len,m,r2=r1){ const j=new THREE.Group(); j.position.set(x,y,z); parent.add(j);
  const o=mesh(new THREE.CylinderGeometry(r2,r1,len,14),m); o.position.y=-len/2; j.add(o);
  const k=sph(r1*1.02,m,12); j.add(k); j.userData.seg=o; j.userData.len=len; return j; }

export function person(o={}){
  const g=new THREE.Group(), P={};
  /* bassin (articulation des hanches à 0,92 m) */
  P.hips=at(g,new THREE.Group(),0,HIP,0);
  P.pelvis=at(P.hips,lathe([[0.001,-0.1],[0.16,-0.08],[0.175,0.0],[0.162,0.09],[0.001,0.1]],C.pants,0.7),0,0,0);
  at(P.hips,mesh(new THREE.CylinderGeometry(0.168,0.168,0.035,24,1,true),C.black),0,0.075,0).scale.z=0.7;   // ceinture
  /* jambes : cuisse, genou, jambe, pied */
  P.legs=[-1,1].map(s=>{ const th=limb(P.hips,s*0.09,-0.02,0,0.086,0.43,C.pants,0.064);
    const kn=limb(th,0,-0.43,0,0.064,0.42,C.pants,0.05); at(kn,sph(0.066,C.pantsK,12),0,-0.03,0.02).scale.set(1,1.4,0.7);
    const ft=at(kn,new THREE.Group(),0,-0.43,0);
    const sh=new THREE.Group(); ft.add(sh);
    const up=at(sh,cap(0.05,0.15,C.shoeS),0,-0.02,0.05); up.rotation.x=Math.PI/2; up.scale.set(1.05,1,0.75);
    const toe=at(sh,sph(0.052,C.toe,12),0,-0.03,0.135); toe.scale.set(1.02,0.7,0.9);
    const sole=at(sh,mesh(new THREE.BoxGeometry(0.105,0.025,0.27),C.sole),0,-0.055,0.055);
    return { th, kn, ft, up, toe, sole }; });
  /* dos (bas du dos), poitrine, épaules */
  P.spine=at(P.hips,new THREE.Group(),0,0.08,0);
  P.torso=at(P.spine,lathe([[0.155,0],[0.15,0.08],[0.16,0.2],[0.168,0.24],[0.001,0.25]],C.jacket,0.62),0,0,0);
  P.chest=at(P.spine,new THREE.Group(),0,0.2,0);                 // haut du dos : le dos s'arrondit en deux parties
  P.torso2=at(P.chest,lathe([[0.001,-0.02],[0.165,0],[0.185,0.12],[0.19,0.2],[0.15,0.26],[0.07,0.29],[0.001,0.3]],C.jacket,0.62),0,0,0);
  /* veste de travail : bandes réfléchissantes et fermeture ; sweat ouvert : pans et tee-shirt */
  P.bands=new THREE.Group(); P.spine.add(P.bands); P.bands2=new THREE.Group(); P.chest.add(P.bands2);
  { const b=at(P.bands,mesh(new THREE.CylinderGeometry(0.163,0.16,0.03,24,1,true),C.band),0,0.13,0); b.scale.z=0.64;
    const b2=at(P.bands2,mesh(new THREE.CylinderGeometry(0.193,0.19,0.03,24,1,true),C.band),0,0.09,0); b2.scale.z=0.64;
    at(P.bands,mesh(new THREE.BoxGeometry(0.012,0.22,0.012),C.jacketD),0,0.11,0.103); at(P.bands2,mesh(new THREE.BoxGeometry(0.012,0.22,0.012),C.jacketD),0,0.1,0.122);
    for(const s of [-1,1]) at(P.bands2,mesh(new THREE.BoxGeometry(0.07,0.05,0.008),C.jacketD),s*0.08,0.15,0.12); }   // poches de poitrine
  P.open=new THREE.Group(); P.chest.add(P.open);
  { at(P.open,mesh(new THREE.BoxGeometry(0.15,0.42,0.02),C.tee),0,0.02,0.112);
    for(const s of [-1,1]){ const f=new THREE.Group(); f.position.set(s*0.085,0.24,0.115); P.open.add(f);
      at(f,mesh(new THREE.BoxGeometry(0.11,0.5,0.018),C.hoodie),s*0.03,-0.24,0.02); f.rotation.set(-0.12,s*0.35,s*0.06); }
    const hood=at(P.open,lathe([[0.001,0],[0.11,0.02],[0.13,0.1],[0.1,0.16],[0.001,0.17]],C.hoodie,0.55),0,0.2,-0.13); hood.rotation.x=-0.5; }
  /* cou, tête (visage, oreilles), cheveux */
  P.neck=at(P.chest,new THREE.Group(),0,0.27,0);
  at(P.neck,cyl(0.047,0.052,0.09,C.skin),0,0.04,0);
  P.head=at(P.neck,new THREE.Group(),0,0.1,0.005);
  { const H=P.head, sk=at(H,sph(0.098,C.skin,24),0,0.075,0); sk.scale.set(0.92,1.12,1.0);
    const jaw=at(H,sph(0.075,C.skin,18),0,0.02,0.018); jaw.scale.set(0.95,0.9,1.05);
    for(const s of [-1,1]){ const ey=at(H,sph(0.011,C.eye,10),s*0.033,0.085,0.088); const wh=at(H,sph(0.016,C.white,10),s*0.033,0.085,0.082); wh.scale.z=0.5;
      const br=at(H,mesh(new THREE.BoxGeometry(0.03,0.006,0.008),C.brow),s*0.034,0.108,0.09); br.rotation.z=-s*0.12;
      const ear=at(H,sph(0.022,C.skin,10),s*0.09,0.075,-0.005); ear.scale.set(0.45,1,0.75); }
    const nose=at(H,mesh(new THREE.ConeGeometry(0.014,0.04,8),C.skin),0,0.06,0.1); nose.rotation.x=Math.PI/2+0.3;
    at(H,mesh(new THREE.BoxGeometry(0.03,0.006,0.008),C.lip),0,0.028,0.093);
    P.hairCap=at(H,mesh(new THREE.SphereGeometry(0.104,24,14,0,Math.PI*2,0,Math.PI*0.56),C.hair),0,0.085,-0.008); P.hairCap.scale.set(0.95,1.12,1.04); P.hairCap.rotation.x=-0.28;
    P.hairLong=new THREE.Group(); H.add(P.hairLong);
    { const back=at(P.hairLong,lathe([[0.06,0.0],[0.09,0.08],[0.1,0.2],[0.092,0.27],[0.001,0.3]],C.hair,0.45),0,-0.15,-0.06); back.rotation.x=0.08;
      for(const s of [-1,1]){ const side=at(P.hairLong,cap(0.03,0.16,C.hair),s*0.085,-0.0,0.0); side.rotation.z=s*0.08; } }
    P.tail=new THREE.Group(); H.add(P.tail);
    { at(P.tail,sph(0.028,C.hair,10),0,0.09,-0.105); const t=at(P.tail,cap(0.026,0.13,C.hair),0,0.0,-0.13); t.rotation.x=0.35; } }
  /* bras : épaule, coude, poignet, main (pouce) */
  P.arms=[-1,1].map(s=>{ const sh=limb(P.chest,s*0.19,0.205,0,0.05,0.29,C.jacket,0.045); sh.children[1].scale.set(1.15,1.05,1.1);
    const el=limb(sh,0,-0.29,0,0.044,0.25,C.jacket,0.036);
    const cuff=at(el,cyl(0.04,0.04,0.035,C.jacketD),0,-0.23,0);
    const wr=at(el,new THREE.Group(),0,-0.26,0);
    const hand=new THREE.Group(); wr.add(hand);
    const palm=at(hand,cap(0.03,0.05,C.skin,10),0,-0.05,0.005); palm.scale.set(1.15,1,0.62);
    const th=at(hand,cap(0.012,0.035,C.skin,8),s*-0.028,-0.035,0.018); th.rotation.z=s*0.5;
    const glove=at(hand,cyl(0.042,0.036,0.05,C.gm),0,0.0,0.0); glove.visible=false;
    return { sh, el, wr, hand, palm, th, glove, cuff }; });
  P.handR=P.arms[1].wr;
  /* EPI */
  const H=P.head;
  P.glasses=new THREE.Group(); H.add(P.glasses);
  { const l=at(P.glasses,mesh(new THREE.CylinderGeometry(0.108,0.108,0.045,24,1,true,-0.8,1.6),C.glass),0,0.085,-0.01);
    for(const s of [-1,1]) at(P.glasses,mesh(new THREE.BoxGeometry(0.004,0.008,0.1),C.black),s*0.093,0.09,0.0); }
  P.ear=new THREE.Group(); H.add(P.ear);
  { const band=at(P.ear,mesh(new THREE.TorusGeometry(0.11,0.011,8,24,Math.PI),C.yellow),0,0.08,0); band.rotation.z=0;
    for(const s of [-1,1]){ const c=at(P.ear,cyl(0.042,0.046,0.045,C.yellow,18),s*0.105,0.07,0); c.rotation.z=Math.PI/2; at(P.ear,cyl(0.043,0.043,0.012,C.black,18),s*0.083,0.07,0).rotation.z=Math.PI/2; } }
  P.mask=new THREE.Group(); H.add(P.mask);
  { const m=at(P.mask,mesh(new THREE.SphereGeometry(0.06,18,12,0,Math.PI*2,0,Math.PI*0.5),C.ffp),0,0.04,0.075); m.rotation.x=Math.PI/2; m.scale.set(1.05,0.75,1.05);
    const v=at(P.mask,cyl(0.016,0.016,0.012,C.valve,12),0,0.03,0.125); v.rotation.x=Math.PI/2;
    at(P.mask,mesh(new THREE.TorusGeometry(0.1,0.003,4,24),C.ffp),0,0.05,0).rotation.x=Math.PI/2+0.2; }
  P.maskA=new THREE.Group(); H.add(P.maskA);
  { const m=at(P.maskA,mesh(new THREE.SphereGeometry(0.06,18,12,0,Math.PI*2,0,Math.PI*0.5),C.rubber),0,0.04,0.075); m.rotation.x=Math.PI/2; m.scale.set(1.05,0.75,1.05);
    for(const s of [-1,1]){ const f=at(P.maskA,cyl(0.03,0.03,0.035,C.filt,16),s*0.06,0.025,0.105); f.rotation.x=Math.PI/2; f.rotation.z=s*0.5; }
    at(P.maskA,mesh(new THREE.TorusGeometry(0.1,0.005,4,24),C.black),0,0.05,0).rotation.x=Math.PI/2+0.2; }
  /* accessoires dangereux */
  P.scarf=new THREE.Group(); P.neck.add(P.scarf);
  { const t=at(P.scarf,mesh(new THREE.TorusGeometry(0.06,0.025,8,20),C.scarf),0,0.03,0); t.rotation.x=Math.PI/2; t.scale.z=1.2;
    for(const [x,a,L] of [[0.05,0.03,0.4],[-0.035,-0.02,0.32]]){ const e=at(P.scarf,mesh(new THREE.BoxGeometry(0.075,L,0.022),C.scarf),x,-L/2+0.0,0.14); e.rotation.z=a; e.rotation.x=0.04; } }
  P.bracelet=at(P.arms[1].el,mesh(new THREE.TorusGeometry(0.04,0.009,8,18),C.gold),0,-0.215,0); P.bracelet.rotation.x=Math.PI/2;
  g.userData.P=P;
  setPose(g,o.pose||'debout'); setEpi(g,o);
  return g;
}

/* poses : [épaule G, épaule D] = [avant/arrière, écart], [coude G, coude D], dos, [hanche, genou] */
const POSES={
  debout:     { sh:[[0.05,0.08],[0.05,-0.08]], el:[-0.15,-0.15], sp:0.02, leg:[0,0] },
  machine:    { sh:[[-0.55,0.12],[-0.55,-0.12]], el:[-0.85,-0.85], sp:0.14, leg:[-0.04,0.06] },
  soufflette: { sh:[[-0.35,0.12],[-1.25,-0.1]], el:[-0.9,-0.15], sp:0.12, leg:[-0.03,0.05], wr:[0,0.3] },
  aspire:     { sh:[[-0.7,0.15],[-0.45,-0.05]], el:[-0.6,-0.7], sp:0.35, leg:[-0.25,0.4] },
  dos_courbe: { sh:[[-1.45,0.16],[-1.45,-0.16]], el:[-0.2,-0.2], sp:0.7, hip:0.6, leg:[0,0.04] },   // bassin basculé + dos arrondi, jambes tendues
};
export function setPose(g,pose){ const P=g.userData.P, A=POSES[pose]||POSES.debout;
  P.arms.forEach((a,i)=>{ a.sh.rotation.set(A.sh[i][0],0,A.sh[i][1]); a.el.rotation.set(A.el[i],0,0); a.wr.rotation.set(A.wr?.[i]||0,0,0); });
  P.spine.rotation.x=A.sp*0.55; P.chest.rotation.x=A.sp*0.45;
  const hf=A.hip||0; P.hips.rotation.x=hf;   // flexion des hanches : le haut du corps bascule, les cuisses restent à leur angle
  for(const L of P.legs){ L.th.rotation.x=A.leg[0]-hf; L.kn.rotation.x=A.leg[1]; L.ft.rotation.x=-(A.leg[0]+A.leg[1]); }
  /* pieds au sol : le bassin descend quand les genoux plient */
  const t=0.43, s=0.43, h=t*Math.cos(A.leg[0])+s*Math.cos(A.leg[0]+A.leg[1]);
  P.hips.position.y=HIP-(t+s-h);
  g.userData.pose=pose; }

export function setEpi(g,o={}){ const P=g.userData.P, e=new Set(o.epi||[]);
  P.glasses.visible=e.has('lunettes'); P.ear.visible=e.has('auditif'); P.mask.visible=e.has('masque'); P.maskA.visible=e.has('masque_a');
  const hair=o.hair||'court'; P.hairLong.visible=hair==='long'; P.tail.visible=hair==='attache';
  P.scarf.visible=!!o.echarpe; P.bracelet.visible=!!o.bijoux;
  const tenue=e.has('tenue') || o.tenue===true;
  P.torso.material=P.torso2.material= tenue? C.jacket : C.hoodie; P.bands.visible=P.bands2.visible=tenue; P.open.visible=!tenue;
  for(const a of P.arms){ a.sh.userData.seg.material=a.el.userData.seg.material= tenue? C.jacket : C.hoodie; a.cuff.material= tenue? C.jacketD : C.hoodie;
    a.sh.children[1].material=a.el.children[1].material= tenue? C.jacket : C.hoodie; }
  const safe=e.has('chaussures');
  for(const L of P.legs){ L.up.material= safe? C.shoeS : C.shoeB; L.toe.material= safe? C.toe : C.shoeB; L.sole.material= safe? C.black : C.sole; L.toe.scale.y= safe? 0.7 : 0.55; }
  const gm= e.has('gants_chim')? C.gc : e.has('gants_manut')? C.gm : null;
  for(const a of P.arms){ a.palm.material=a.th.material= gm||C.skin; a.hand.scale.setScalar(gm?1.18:1); a.glove.visible=!!gm; if(gm) a.glove.material= gm===C.gm? C.gmc : C.gc; } }

/* objets tenus par les personnages */
export function soufflette(){ const g=new THREE.Group(); at(g,mesh(new THREE.BoxGeometry(0.035,0.11,0.03),std(0x2a2e31)),0,-0.05,0.01);
  const b=at(g,cyl(0.007,0.007,0.24,std(0xb9c0c6,{metalness:.8,roughness:.3})),0,-0.03,0.13); b.rotation.x=Math.PI/2;
  const hose=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,-0.1,0),new THREE.Vector3(0.05,-0.4,-0.1),new THREE.Vector3(0.1,-0.9,-0.05)]),16,0.008,6),std(0x1d1f22)); g.add(hose); return g; }
/* nuage de poussière (sphères translucides, animées par tick) */
export function dustCloud(n=14, r=0.6){ const g=new THREE.Group(); const m=new THREE.MeshStandardMaterial({ color:0xd6c39a, transparent:true, opacity:.3, depthWrite:false, roughness:1 });
  for(let i=0;i<n;i++){ const s=new THREE.Mesh(new THREE.SphereGeometry(0.1+Math.random()*0.16,10,8),m); s.position.set((Math.random()-.5)*r*2,(Math.random())*r*1.2,(Math.random()-.5)*r*2); s.userData.ph=Math.random()*6; g.add(s); }
  g.userData.tick=t=>{ for(const s of g.children){ s.position.y+=Math.sin(t*0.8+s.userData.ph)*0.0015; s.scale.setScalar(1+0.12*Math.sin(t*1.3+s.userData.ph)); } }; return g; }
