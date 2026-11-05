/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Personnages de l'atelier (élèves), style « 3D cartoon » doux, d'après la tenue et les EPI réels de l'atelier
   (demandé par l'enseignant le 05/11/2026 ; remplace les personnages articulés en cylindres).
   Modèle : machines/risques/personnage.glbz (glTF compressé), fabriqué par tools/personnage/perso_atelier.py :
   un corps continu, un squelette (Hanches, Dos_bas, Dos_haut, Cou, Tete, Clavicule_G/D, Bras, AvantBras, Main, Doigts,
   Cuisse, Jambe, Pied, Orteils ; G = gauche du personnage, côté +X), une pièce par couche (tenue, cheveux, EPI) qu'on montre
   ou qu'on cache. Lu ici sans chargeur asynchrone (le module construit ses personnages tout de suite).
   person(o) rend un groupe debout sur y = 0, regardant vers +Z, environ 1,72 m.
   o.epi   : codes d'EPI portés (lunettes, auditif, masque, masque_a, chaussures, gants_manut, gants_chim, tenue)
   o.hair  : 'court' | 'long' (cheveux détachés) | 'attache' (queue de cheval)
   o.echarpe, o.bijoux : accessoires dangereux près des machines
   o.pose  : 'debout' | 'machine' (mains au plan de travail) | 'soufflette' | 'aspire' | 'dos_courbe' (soulève un panneau, jambes tendues)
   o.expr  : 'neutre' | 'inquiet' | 'douleur'
   Sans « tenue » : sweat rouge ouvert, baskets blanches ; avec : veste de travail gris-bleu (empiècement noir, passepoils jaunes).
   Sans « chaussures » : baskets ; avec : chaussures de sécurité basses noires.
   setEpi(g, o), setPose(g, pose) : changent un personnage déjà construit (avatar du scénario « EPI »).
   g.userData.P : handR (repère de la main qui tient un objet : −Y le long de la main, +Z vers l'avant), arms[i].palm. */
import * as THREE from 'three';
import { unzlibSync } from 'fflate';
import GLBZ from './personnage.glbz';

const std=(c,o={})=>new THREE.MeshStandardMaterial({ color:c, roughness:.78, metalness:0, ...o });
const SCALE=1.07;                       // le modèle mesure environ 1,60 m : adulte d'environ 1,72 m

/* ---------- lecture du glTF (synchrone) ---------- */
const GL=(()=>{ const glb=unzlibSync(GLBZ), dv=new DataView(glb.buffer,glb.byteOffset,glb.byteLength);
  const jl=dv.getUint32(12,true), json=JSON.parse(new TextDecoder().decode(glb.subarray(20,20+jl))), bin=glb.subarray(20+jl+8);
  const TY={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}, N={SCALAR:1,VEC3:3,VEC4:4,MAT4:16};
  const acc=i=>{ const a=json.accessors[i], bv=json.bufferViews[a.bufferView], T=TY[a.componentType], n=N[a.type], es=T.BYTES_PER_ELEMENT;
    const stride=bv.byteStride||n*es, off=(bv.byteOffset||0)+(a.byteOffset||0), src=new T(bin.slice(off,off+a.count*stride).buffer), out=new T(a.count*n), se=stride/es;
    for(let k=0;k<a.count;k++) for(let j=0;j<n;j++) out[k*n+j]=src[k*se+j];
    return new THREE.BufferAttribute(out,n,!!a.normalized); };
  const mats=json.materials.map(m=>{ const c=m.pbrMetallicRoughness.baseColorFactor, alpha=c[3]<1;
    const mt=new THREE.MeshStandardMaterial({ color:new THREE.Color().setRGB(c[0],c[1],c[2]), roughness:m.pbrMetallicRoughness.roughnessFactor, metalness:0,
      transparent:alpha, opacity:c[3], depthWrite:!alpha, side:alpha? THREE.DoubleSide : THREE.FrontSide }); mt.name=m.name; return mt; });
  const parts=json.nodes.filter(n=>n.mesh!=null).map(n=>{ const p=json.meshes[n.mesh].primitives[0], g=new THREE.BufferGeometry();
    g.setAttribute('position',acc(p.attributes.POSITION)); g.setAttribute('normal',acc(p.attributes.NORMAL));
    g.setAttribute('skinIndex',acc(p.attributes.JOINTS_0)); g.setAttribute('skinWeight',acc(p.attributes.WEIGHTS_0)); g.setIndex(acc(p.indices));
    return { name:n.name, geo:g, mat:mats[p.material] }; });
  const skin=json.skins[0], ibm=acc(skin.inverseBindMatrices).array;
  const inv=skin.joints.map((_,i)=>new THREE.Matrix4().fromArray(ibm,i*16));
  return { json, parts, skin, inv }; })();

/* un personnage : copies des os (positions de repos), pièces partagées (géométries, matériaux) */
function build(){ const { json, parts, skin, inv }=GL, nodes=json.nodes;
  const bones=new Map(); for(const j of skin.joints){ const b=new THREE.Bone(); b.name=nodes[j].name; b.position.fromArray(nodes[j].translation||[0,0,0]); bones.set(j,b); }
  for(const j of skin.joints) for(const c of nodes[j].children||[]) bones.get(j).add(bones.get(c));
  const skel=new THREE.Skeleton(skin.joints.map(j=>bones.get(j)), inv.map(m=>m.clone()));
  const inner=new THREE.Group(); inner.scale.setScalar(SCALE); inner.add(bones.get(skin.skeleton));
  const L={}; for(const p of parts){ const m=new THREE.SkinnedMesh(p.geo,p.mat); m.name=p.name; m.castShadow=true; m.receiveShadow=true; m.frustumCulled=false;
    m.bind(skel,new THREE.Matrix4()); inner.add(m); L[p.name]=m; }
  const B={}; for(const b of bones.values()) B[b.name]=b;
  return { inner, L, B, skel }; }
/* position de repos (repère du modèle) de chaque os : les rotations de repos sont nulles */
const REST={}; { const n=GL.json.nodes, par={}; for(const j of GL.skin.joints) for(const c of n[j].children||[]) par[c]=j;
  for(const j of GL.skin.joints){ const p=new THREE.Vector3(); let k=j; while(k!=null){ p.add(new THREE.Vector3().fromArray(n[k].translation||[0,0,0])); k=par[k]; } REST[n[j].name]=p; } }

/* ---------- visage : yeux, paupières, sourcils, bouche (posés sur la tête au repos, une seule fois) ---------- */
const FM={ white:std(0xfbfaf6,{roughness:.35}), iris:std(0x5a3a22,{roughness:.35}), pupil:std(0x0c0a09,{roughness:.3}), brow:std(0x2a1a10,{roughness:.8}), mouth:std(0x5b2620,{roughness:.6}),
  hl:new THREE.MeshBasicMaterial({ color:0xffffff }) };
const FACE=(()=>{ const t=build(); t.inner.scale.setScalar(1); t.inner.updateMatrixWorld(true);
  const head=t.L.tete, ray=new THREE.Raycaster();
  const hit=(x,y)=>{ ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)); const h=ray.intersectObject(head,false)[0]; return h? h.point.clone() : new THREE.Vector3(x,y,0.12); };
  return { eyes:[1,-1].map(s=>hit(0.046*s,1.382)), brows:[1,-1].map(s=>hit(0.048*s,1.432)), mouth:hit(0,1.287), skin:head.material.color.clone() }; })();
const EXPR={ neutre:{ brow:-0.05, browY:0, lid:0.18, smile:1 }, inquiet:{ brow:0.32, browY:0.006, lid:0.0, smile:-0.6 }, douleur:{ brow:0.45, browY:-0.003, lid:0.55, smile:-1 } };
const lidMat=std(0,{roughness:.6}); lidMat.color.copy(FACE.skin);
const SPH=new THREE.SphereGeometry(1,20,14), LID=new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI*0.5);
function face(B, expr){ const E=EXPR[expr]||EXPR.neutre, g=new THREE.Group(); g.position.copy(REST.Tete).negate(); B.Tete.add(g);
  const sph=(m,s,p)=>{ const o=new THREE.Mesh(SPH,m); o.scale.set(...s); o.position.set(...p); return o; };
  [1,-1].forEach((s,i)=>{ const e=new THREE.Group(); e.position.copy(FACE.eyes[i]).add(new THREE.Vector3(0,0,-0.012)); g.add(e);
    e.add(sph(FM.white,[0.024,0.029,0.018],[0,0,0]), sph(FM.iris,[0.014,0.016,0.006],[-0.003*s,-0.002,0.0155]), sph(FM.pupil,[0.0072,0.0082,0.004],[-0.003*s,-0.002,0.0195]),
      sph(FM.hl,[0.0034,0.0034,0.0034],[0.002-0.003*s,0.004,0.022]));
    const lid=new THREE.Mesh(LID,lidMat); lid.scale.set(0.0256,0.0306,0.0196); lid.rotation.x=-(0.55-E.lid*0.8); e.add(lid);
    const cv=new THREE.CatmullRomCurve3([new THREE.Vector3(-0.026,-0.004,0),new THREE.Vector3(0,0.006,0.004),new THREE.Vector3(0.026,0,0)]);
    const br=new THREE.Mesh(new THREE.TubeGeometry(cv,10,0.0062,6),FM.brow); br.position.copy(FACE.brows[i]).add(new THREE.Vector3(0,E.browY,-0.002)); br.rotation.z=E.brow*s; br.scale.x=s; g.add(br); });
  const k=E.smile, mc=new THREE.CatmullRomCurve3([new THREE.Vector3(-0.03,0.008*k,-0.006),new THREE.Vector3(0,-0.006*k,0.002),new THREE.Vector3(0.03,0.008*k,-0.006)]);
  const mo=new THREE.Mesh(new THREE.TubeGeometry(mc,14,0.0045,6),FM.mouth); mo.position.copy(FACE.mouth).add(new THREE.Vector3(0,0,-0.002)); g.add(mo);
  g.traverse(o=>{ if(o.isMesh) o.castShadow=false; }); return { g, mouth:mo }; }

/* ---------- accessoires dangereux : écharpe, bracelet ---------- */
const AM={ scarf:std(0xb8322c,{roughness:.95}), gold:new THREE.MeshStandardMaterial({ color:0xd8b04a, metalness:.9, roughness:.25 }) };
function scarf(B){ const g=new THREE.Group(); g.position.copy(REST.Cou).negate(); B.Cou.add(g);
  const t=new THREE.Mesh(new THREE.TorusGeometry(0.074,0.024,8,22),AM.scarf); t.rotation.x=Math.PI/2; t.position.set(0,1.19,0.0); t.scale.set(1,1.15,1); g.add(t);
  for(const [x,a,L] of [[0.045,0.04,0.36],[-0.03,-0.03,0.3]]){ const e=new THREE.Mesh(new THREE.BoxGeometry(0.07,L,0.022),AM.scarf); e.position.set(x,1.19-L/2,0.14); e.rotation.set(0.12,0,a); g.add(e); }
  g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); return g; }
function bracelet(B){ const g=new THREE.Group(); g.position.copy(REST.AvantBras_D).negate(); B.AvantBras_D.add(g);
  const a=REST.AvantBras_D, w=REST.Main_D, ax=w.clone().sub(a).normalize();
  const r=new THREE.Mesh(new THREE.TorusGeometry(0.05,0.009,8,20),AM.gold); r.position.copy(w).addScaledVector(ax,-0.035); r.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),ax); g.add(r); return g; }

/* ---------- personnage ---------- */
export function person(o={}){
  const g=new THREE.Group(), { inner, L, B }=build(); g.add(inner);
  const f=face(B,o.expr||'neutre');
  /* repères des mains : −Y le long de la main (bras écartés de 36° au repos), +Z vers l'avant */
  const hand=S=>{ const h=new THREE.Group(); B['Main_'+S].add(h); h.rotation.z=(S==='G'? 1 : -1)*36*Math.PI/180; return h; };
  const hG=hand('G'), hD=hand('D'); const palm=h=>{ const p=new THREE.Object3D(); p.position.set(0,-0.05,0); h.add(p); return p; };
  /* la main qui tient la soufflette est celle de l'index 1 des poses (bras levé), côté D */
  const P={ L, B, inner, face:f, handR:hD, arms:[{ palm:palm(hG) },{ palm:palm(hD) }], scarf:scarf(B), bracelet:bracelet(B), foot:null };
  g.userData.P=P;
  P.rest={}; for(const [k,b] of Object.entries(B)) P.rest[k]=b.quaternion.clone();
  P.y0=B.Hanches.position.y;
  setPose(g,'debout'); setPose(g,o.pose||'debout'); setEpi(g,o);
  return g; }

/* ---------- poses ---------- */
/* mêmes réglages que les anciennes poses : [épaule avant/arrière, écart], coude, dos, [hanche, genou] ; index 0 = bras G, 1 = bras D ;
   chaque os est orienté vers la direction voulue depuis sa direction au repos (bras écartés du modèle) */
const POSES={
  debout:     { sh:[[0.05,0.08],[0.05,-0.08]], el:[-0.15,-0.15], sp:0.02, leg:[0,0] },
  machine:    { sh:[[-0.55,0.12],[-0.55,-0.12]], el:[-0.85,-0.85], sp:0.14, leg:[-0.04,0.06] },
  soufflette: { sh:[[-0.35,0.12],[-1.25,-0.1]], el:[-0.9,-0.15], sp:0.12, leg:[-0.03,0.05], wr:[0,0.3] },
  aspire:     { sh:[[-0.7,0.15],[-0.45,-0.05]], el:[-0.6,-0.7], sp:0.35, leg:[-0.25,0.4] },
  dos_courbe: { sh:[[-1.45,0.16],[-1.45,-0.16]], el:[-0.2,-0.2], sp:0.7, hip:0.6, leg:[0,0.04] },
};
const DOWN=new THREE.Vector3(0,-1,0), E=(x,y,z)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));
const wq=o=>o.getWorldQuaternion(new THREE.Quaternion());
const _a=new THREE.Vector3(), _b=new THREE.Vector3();
/* tourne l'os o pour que son segment (vers son os enfant) suive la direction monde D */
function aim(o,D){ const c=o.children.find(x=>x.isBone); o.updateMatrixWorld(true);
  o.getWorldPosition(_a); c.getWorldPosition(_b); const d=_b.sub(_a).normalize();
  const w=new THREE.Quaternion().setFromUnitVectors(d,D.clone().normalize()).multiply(wq(o)); o.quaternion.copy(wq(o.parent).invert().multiply(w)); o.updateMatrixWorld(true); }
export function setPose(g,pose){ const P=g.userData.P, B=P.B, A=POSES[pose]||POSES.debout;
  for(const [k,b] of Object.entries(B)) b.quaternion.copy(P.rest[k]); B.Hanches.position.y=P.y0; g.updateMatrixWorld(true);
  const rq=wq(P.inner), dir=q=>DOWN.clone().applyQuaternion(rq.clone().multiply(q));
  const hf=A.hip||0; B.Hanches.quaternion.premultiply(E(hf,0,0));                 // bascule du bassin
  B.Dos_bas.quaternion.premultiply(E(A.sp*0.55,0,0)); B.Dos_haut.quaternion.premultiply(E(A.sp*0.45,0,0)); g.updateMatrixWorld(true);
  const chest=E(hf+A.sp,0,0);
  ['G','D'].forEach((S,i)=>{ const qs=chest.clone().multiply(E(A.sh[i][0],0,A.sh[i][1])), qe=qs.clone().multiply(E(A.el[i],0,0)), qw=qe.clone().multiply(E(A.wr?.[i]||0,0,0));
    aim(B['Bras_'+S],dir(qs)); aim(B['AvantBras_'+S],dir(qe)); aim(B['Main_'+S],dir(qw));
    aim(B['Cuisse_'+S],dir(E(A.leg[0],0,0))); aim(B['Jambe_'+S],dir(E(A.leg[0]+A.leg[1],0,0)));
    const f=B['Pied_'+S]; f.quaternion.copy(wq(f.parent).invert().multiply(rq)); f.updateMatrixWorld(true); });   // pied à plat
  /* pieds au sol : le bassin descend quand les genoux plient (hauteur de référence : la pose debout) */
  g.updateMatrixWorld(true); const low=Math.min(B.Pied_G.getWorldPosition(_a).y, B.Pied_D.getWorldPosition(_b).y);
  if(P.foot==null) P.foot=low; else { B.Hanches.position.y=P.y0-(low-P.foot)/(g.getWorldScale(_a).y*SCALE); g.updateMatrixWorld(true); }
  g.userData.pose=pose; }

/* ---------- tenue, cheveux, EPI ---------- */
const EPI={ lunettes:['epi_lunettes'], auditif:['epi_casque'], masque:['epi_ffp2','epi_ffp2soupape'], masque_a:['epi_demimasque','epi_filtres'],
  gants_manut:['epi_gants','epi_gantsenduit'], gants_chim:['epi_gantschim'] };
const HAIR={ court:'cheveux', long:'cheveux_longs', attache:'queue' };
export function setEpi(g,o={}){ const P=g.userData.P, L=P.L, e=new Set(o.epi||[]);
  const tenue=e.has('tenue') || o.tenue===true, safe=e.has('chaussures'), on=new Set(['tete']);
  for(const n of Object.keys(L)){ const base=n.split('_')[0];
    if((base==='veste' && tenue) || (base==='sweat' && !tenue) || (base==='chaussures' && safe) || (base==='baskets' && !safe) || base==='pantalon') on.add(n); }
  on.add(HAIR[o.hair||'court']||'cheveux');
  for(const [k,ls] of Object.entries(EPI)) if(e.has(k)) ls.forEach(n=>on.add(n));
  const gants=e.has('gants_manut') || e.has('gants_chim'); if(!gants) on.add('mains');
  for(const [n,m] of Object.entries(L)) m.visible=on.has(n);
  P.face.mouth.visible=!e.has('masque') && !e.has('masque_a');
  P.scarf.visible=!!o.echarpe; P.bracelet.visible=!!o.bijoux && !gants; }

/* ---------- objets tenus par les personnages ---------- */
const at=(p,o,x=0,y=0,z=0)=>{ o.position.set(x,y,z); p.add(o); return o; };
const mesh=(g,m)=>{ const o=new THREE.Mesh(g,m); o.castShadow=true; o.receiveShadow=true; return o; };
const cyl=(r1,r2,h,m,s=16)=>mesh(new THREE.CylinderGeometry(r1,r2,h,s),m);
export function soufflette(){ const g=new THREE.Group(); at(g,mesh(new THREE.BoxGeometry(0.035,0.11,0.03),std(0x2a2e31)),0,-0.05,0.01);
  const b=at(g,cyl(0.007,0.007,0.24,std(0xb9c0c6,{metalness:.8,roughness:.3})),0,-0.03,0.13); b.rotation.x=Math.PI/2;
  const hose=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,-0.1,0),new THREE.Vector3(0.05,-0.4,-0.1),new THREE.Vector3(0.1,-0.9,-0.05)]),16,0.008,6),std(0x1d1f22)); g.add(hose); return g; }
/* nuage de poussière (sphères translucides, animées par tick) */
export function dustCloud(n=14, r=0.6){ const g=new THREE.Group(); const m=new THREE.MeshStandardMaterial({ color:0xd6c39a, transparent:true, opacity:.3, depthWrite:false, roughness:1 });
  for(let i=0;i<n;i++){ const s=new THREE.Mesh(new THREE.SphereGeometry(0.1+Math.random()*0.16,10,8),m); s.position.set((Math.random()-.5)*r*2,(Math.random())*r*1.2,(Math.random()-.5)*r*2); s.userData.ph=Math.random()*6; g.add(s); }
  g.userData.tick=t=>{ for(const s of g.children){ s.position.y+=Math.sin(t*0.8+s.userData.ph)*0.0015; s.scale.setScalar(1+0.12*Math.sin(t*1.3+s.userData.ph)); } }; return g; }
