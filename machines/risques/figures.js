/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Personnages de l'atelier (élèves), style « 3D cartoon », générés avec Meshy (demandé par l'enseignant le 06/11/2026 ;
   remplace le personnage fabriqué par programme du 05/11/2026).
   Modèle : machines/risques/eleves.glbz, fabriqué par tools/personnage/meshy/ (voir CLAUDE.md « Personnages des risques
   généraux ») : un garçon et une fille, chacun en tenue d'atelier (« equipe », « fille » : veste, chaussures de sécurité,
   queue de cheval pour la fille) et en élève mal équipé (« mal », « fille_mal » : sweat rouge, jean, baskets, cheveux
   détachés pour la fille), un squelette Mixamo par groupe (24 os ; la 2e version de chaque élève y est recalée à la
   fabrication), chaque version en quatre pièces (tête, corps, pieds, mains) qu'on combine ; quatre EPI (casque antibruit,
   lunettes, FFP2, demi-masque), l'écharpe et le bracelet, posés sur le personnage.
   Lu ici sans chargeur asynchrone (le module construit ses personnages tout de suite) ; les textures arrivent juste après.
   person(o) rend un groupe debout sur y = 0, regardant vers +Z, environ 1,72 m.
   o.epi   : codes d'EPI portés (lunettes, auditif, masque, masque_a, chaussures, gants_manut, gants_chim, tenue)
   o.hair  : 'court' (garçon) | 'long' (fille, cheveux détachés) | 'attache' (fille, queue de cheval) ; choisit l'élève à la
             création ; pour la fille, la coiffure change ensuite avec setEpi
   o.echarpe, o.bijoux : écharpe, bracelet (le bracelet est caché sous les gants)
   o.pose  : 'debout' | 'machine' (mains au plan de travail) | 'soufflette' | 'aspire' | 'dos_courbe'
   Sans « tenue » : tenue de l'élève « mal » ; avec : veste de travail. Sans « chaussures » : baskets ; avec : sécurité.
   setEpi(g, o), setPose(g, pose) : changent un personnage déjà construit (avatar du scénario « EPI »).
   g.userData.P : handR (repère de la main qui tient un objet : −Y le long de la main, +Z vers l'avant), arms[i].palm. */
import * as THREE from 'three';
import { unzlibSync } from 'fflate';
import PACK from './eleves.glbz';

const HAUTEUR=1.72;

/* ---------- lecture du fichier ---------- */
const D=(()=>{ const raw=unzlibSync(PACK), dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength), n=dv.getUint32(0,true);
  const J=JSON.parse(new TextDecoder().decode(raw.subarray(4,4+n))), bin=raw.subarray(4+n);
  const view=(T,[o,len])=>new T(bin.slice(o,o+len).buffer);
  return { J, view }; })();
function geometry(G){ const g=new THREE.BufferGeometry(), q=D.view(Uint16Array,G.pos), p=new Float32Array(G.n*3);
  for(let i=0;i<G.n;i++) for(let k=0;k<3;k++) p[i*3+k]=G.pmin[k]+q[i*3+k]*G.pscale[k];
  g.setAttribute('position',new THREE.BufferAttribute(p,3));
  g.setAttribute('normal',new THREE.BufferAttribute(D.view(Int8Array,G.nor),3,true));
  g.setAttribute('uv',new THREE.BufferAttribute(D.view(Uint16Array,G.uv),2,true));
  if(G.jnt){ g.setAttribute('skinIndex',new THREE.BufferAttribute(D.view(Uint8Array,G.jnt),4)); g.setAttribute('skinWeight',new THREE.BufferAttribute(D.view(Uint8Array,G.wgt),4,true)); }
  g.setIndex(new THREE.BufferAttribute(D.view(Uint16Array,G.idx),1)); g.computeBoundingSphere(); return g; }
function texture(r){ const t=new THREE.Texture(); t.flipY=false; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
  try{ const img=new Image(); img.onload=()=>{ t.image=img; t.needsUpdate=true; };
    img.src=URL.createObjectURL(new Blob([D.view(Uint8Array,r)],{ type:'image/jpeg' })); }catch(e){}
  return t; }

/* ---------- élèves : pièces partagées (géométries, matières) ---------- */
const PIECES=['tete','corps','pieds','mains'];
const EL={}; for(const [k,E] of Object.entries(D.J.eleves)){ const mat=new THREE.MeshStandardMaterial({ map:texture(E.tex), roughness:.8, metalness:0 });
  /* même tenue, chaussures repeintes dans l'autre style (sécurité ↔ baskets) : seuls les pixels des chaussures changent */
  const matAutres=E.tex_autres? new THREE.MeshStandardMaterial({ map:texture(E.tex_autres), roughness:.8, metalness:0 }) : mat;
  EL[k]={ E, mat, matAutres, geo:Object.fromEntries(PIECES.map(p=>[p,geometry(E[p])])) }; }
const GANTS={ gants_manut:new THREE.MeshStandardMaterial({ color:0xe9dfc8, roughness:.95 }), gants_chim:new THREE.MeshStandardMaterial({ color:0x2f6fb5, roughness:.45 }) };

/* ---------- EPI, écharpe, bracelet : posés par un RÉGLAGE par élève (machines/risques/reglages_epi.json, fait par
   l'enseignant avec l'outil tools/personnage/reglage : dist/Reglage_EPI.html). Un réglage = { d:[largeur, hauteur,
   profondeur] mm (dimensions de l'objet), t:[x, y, z] mm (centre de l'objet dans le repère du personnage au repos :
   x vers sa gauche, y depuis le sol, z vers l'avant), r:[rx, ry, rz] degrés }. Sans réglage : valeurs de départ
   calculées d'après les repères du visage (oreilles, yeux, nez, menton, haut de la tête) relevés à la fabrication.
   L'objet suit l'os qui le porte : tête (EPI), haut du dos (écharpe), avant-bras droit (bracelet). */
import REGLAGES_FICHIER from './reglages_epi.json';
export const REGLAGES=JSON.parse(JSON.stringify(REGLAGES_FICHIER));
export const OBJETS=['casque','lunettes','ffp2','demimasque','echarpe','bracelet'];
const OS_OBJET={ echarpe:'Spine2', bracelet:'RightForeArm' };     // les autres : Head
const sst=(a,b,x)=>{ const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };
export const TAILLE={}; const OBJ={};
for(const k of OBJETS){ const G=D.J.epi[k]; if(!G) continue; const g=geometry(G), p=g.attributes.position;
  /* écharpe : les pans pendent au milieu du tour de cou dans le modèle ; ramenés devant la poitrine (forme fixe) */
  if(k==='echarpe') for(let i=0;i<p.count;i++) p.setZ(i,p.getZ(i)+0.4*sst(0.35,-0.1,p.getY(i)));
  g.computeBoundingBox(); const c=g.boundingBox.getCenter(new THREE.Vector3()); g.translate(-c.x,-c.y,-c.z); g.computeBoundingBox();
  TAILLE[k]=g.boundingBox.getSize(new THREE.Vector3()).toArray();
  g.deleteAttribute('normal'); g.computeVertexNormals();   // normales en flottants (les normales 8 bits saturent pendant le calcul)
  const m=new THREE.MeshStandardMaterial({ map:texture(G.tex), roughness:k==='echarpe'||k==='bracelet'? .9 : .6, metalness:0, side:THREE.DoubleSide });
  if(k==='lunettes'){ m.transparent=true; m.onBeforeCompile=sh=>{ sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\n float lum=dot(diffuseColor.rgb,vec3(0.3,0.59,0.11)); if(lum>0.45){ diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.85,0.93,0.97),0.6); diffuseColor.a=0.28; }'); }; }
  OBJ[k]={ g, m }; }
const EPI={ lunettes:'lunettes', auditif:'casque', masque:'ffp2', masque_a:'demimasque' };
const mm=v=>Math.round(v*1000);
/* valeurs de départ (sans réglage) d'après les repères du visage et les os au repos */
export function defaut(P,k){ const R=D.J.eleves[P.qui].reperes, A=P.repos;
  if(k==='casque') return { d:[mm(2*R.oreille_x+0.07), mm(R.haut-R.oreille_y+0.07), 110], t:[0, mm((R.haut+R.oreille_y-0.06)/2), mm(R.oreille_z)], r:[0,0,0] };
  if(k==='lunettes') return { d:[mm(2*R.oreille_x+0.01), 60, mm(R.oeil_z+0.03-R.oreille_z)], t:[0, mm(R.oeil_y+0.012), mm((R.oeil_z+0.03+R.oreille_z)/2)], r:[0,0,0] };
  if(k==='ffp2') return { d:[mm(2*R.oreille_x+0.02), mm(R.oeil_y-0.035-R.menton), mm(R.nez_z+0.03-R.oreille_z+0.03)], t:[0, mm((R.oeil_y-0.035+R.menton)/2), mm((R.nez_z+0.03+R.oreille_z-0.03)/2)], r:[0,0,0] };
  if(k==='demimasque') return { d:[mm(2*R.oreille_x+0.06), mm(R.nez_y+0.05-R.menton+0.04), mm(R.nez_z+0.05-R.oreille_z+0.03)], t:[0, mm((R.nez_y+R.menton)/2+0.01), mm((R.nez_z+0.05+R.oreille_z-0.03)/2)], r:[0,0,0] };
  if(k==='echarpe'){ const n=A.Neck; return { d:[340, 500, 240], t:[mm(n.x), mm(n.y-0.17), mm(n.z+0.06)], r:[0,0,0] }; }
  if(k==='bracelet'){ const w=A.RightHand, a=A.RightForeArm, ax=w.clone().sub(a).normalize(), q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),ax),
    e=new THREE.Euler().setFromQuaternion(q), c=w.clone().addScaledVector(ax,-0.03);
    return { d:[75, 18, 75], t:[mm(c.x), mm(c.y), mm(c.z)], r:[e.x,e.y,e.z].map(v=>Math.round(v*180/Math.PI)) }; }
  return { d:[100,100,100], t:[0,1500,0], r:[0,0,0] }; }
export function reglage(P,k){ return REGLAGES[P.qui]?.[k] || defaut(P,k); }
/* place chaque objet d'après son réglage (le personnage peut être dans n'importe quelle pose) */
const _M=new THREE.Matrix4();
export function placerObjets(g){ const P=g.userData.P;
  for(const [k,o] of Object.entries(P.epi)){ const R=reglage(P,k), s=TAILLE[k];
    const M=new THREE.Matrix4().compose(new THREE.Vector3(R.t[0]/1000,R.t[1]/1000,R.t[2]/1000),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...R.r.map(v=>v*Math.PI/180))),
      new THREE.Vector3(R.d[0]/1000/s[0],R.d[1]/1000/s[1],R.d[2]/1000/s[2]));
    _M.copy(P.osRepos[k]).multiply(M); _M.decompose(o.position,o.quaternion,o.scale); } }
/* groupes : la tenue d'atelier et la tenue « mal » de chaque élève */
const GRP={ garcon:{ ok:'equipe', mal:'mal' }, fille:{ ok:'fille', mal:'fille_mal' } };

/* ---------- squelette ---------- */
function skeleton(grp){ const S=D.J.squelettes[grp], IBM=D.view(Float32Array,S.ibm), arm=new THREE.Object3D(); arm.position.fromArray(S.armature.t); arm.quaternion.fromArray(S.armature.r); arm.scale.fromArray(S.armature.s);
  const bones=S.os.map(o=>{ const b=new THREE.Bone(); b.name=o.name; b.position.fromArray(o.t); b.quaternion.fromArray(o.r); b.scale.fromArray(o.s); return b; });
  S.os.forEach((o,i)=>(o.parent<0? arm : bones[o.parent]).add(bones[i]));
  const skel=new THREE.Skeleton(bones,bones.map((_,i)=>new THREE.Matrix4().fromArray(IBM,i*16)));
  const B={}; for(const b of bones) B[b.name]=b; return { arm, skel, B }; }
/* noms des os du personnage d'avant (poses) → os Mixamo */
const OS=S=>({ Bras:S+'Arm', AvantBras:S+'ForeArm', Main:S+'Hand', Cuisse:S+'UpLeg', Jambe:S+'Leg', Pied:S+'Foot' });
const COTE={ G:OS('Left'), D:OS('Right') };     // G = gauche du personnage (+X)

const wq=o=>o.getWorldQuaternion(new THREE.Quaternion());
const _a=new THREE.Vector3(), _b=new THREE.Vector3();

/* ---------- personnage ---------- */
export function person(o={}){
  const g=new THREE.Group(), inner=new THREE.Group(); g.add(inner);
  const e0=new Set(o.epi||[]), grp=o.hair==='long'||o.hair==='attache'? 'fille' : 'garcon', G=GRP[grp];
  const qui= grp==='fille'? (o.hair==='attache'? G.ok : G.mal) : (e0.has('tenue')||o.tenue===true? G.ok : G.mal);
  inner.scale.setScalar(HAUTEUR/EL[G.ok].E.hauteur);
  const { arm, skel, B }=skeleton(grp); inner.add(arm);
  const L={}; for(const k of [G.ok,G.mal]) for(const p of PIECES){ const m=new THREE.SkinnedMesh(EL[k].geo[p],EL[k].mat);
    m.name=k+'|'+p; m.castShadow=true; m.receiveShadow=true; m.frustumCulled=false; m.bind(skel,new THREE.Matrix4()); inner.add(m); L[m.name]=m; }
  g.updateMatrixWorld(true);
  /* au repos : direction de chaque main, bout virtuel de la main (pour l'orienter), repères des mains */
  const rqi=wq(inner).invert(), P={ L, B, inner, qui, grp, face:{ mouth:{ visible:true } }, rest:{}, restW:{} };
  for(const [k,b] of Object.entries(B)){ P.rest[k]=b.quaternion.clone(); P.restW[k]=rqi.clone().multiply(wq(b)); }
  const hand=S=>{ const h=B[COTE[S].Main], f=B[COTE[S].AvantBras], hw=h.getWorldPosition(new THREE.Vector3()), dir=hw.clone().sub(f.getWorldPosition(new THREE.Vector3())).normalize();
    const tip=new THREE.Object3D(); tip.position.copy(h.worldToLocal(hw.clone().addScaledVector(dir,0.09))); h.add(tip); h.userData.tip=tip;
    const y=dir.clone().negate(), z=new THREE.Vector3(0,0,1).addScaledVector(y,-y.z).normalize(), x=new THREE.Vector3().crossVectors(y,z);
    const r=new THREE.Object3D(); r.position.copy(hw); r.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)); inner.add(r); r.updateMatrixWorld(true); h.attach(r);
    const palm=new THREE.Object3D(); palm.position.set(0,-0.07,0); r.add(palm); return { r, palm }; };
  const hG=hand('G'), hD=hand('D');
  P.handR=hD.r; P.arms=[{ palm:hG.palm },{ palm:hD.palm }];
  /* EPI posés sur la tête de l'élève (au repos), puis attachés à l'os de la tête */
  /* EPI, écharpe, bracelet : enfants de leur os ; P.osRepos[k] = inverse de la place de l'os au repos (repère du personnage) */
  const innerInv=inner.matrixWorld.clone().invert(); P.repos={}; for(const [k,b] of Object.entries(B)) P.repos[k]=inner.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  P.epi={}; P.osRepos={}; for(const [k,{ g:geo, m }] of Object.entries(OBJ)){ const o2=new THREE.Mesh(geo,m); o2.castShadow=true; o2.frustumCulled=false; o2.name='objet_'+k;
    const os=B[OS_OBJET[k]||'Head']; os.add(o2); P.osRepos[k]=innerInv.clone().multiply(os.matrixWorld).invert(); o2.visible=false; P.epi[k]=o2; }
  P.scarf=P.epi.echarpe||new THREE.Object3D(); P.bracelet=P.epi.bracelet||new THREE.Object3D();
  g.userData.P=P; placerObjets(g);
  P.y0=B.Hips.position.y; P.foot=null;
  setPose(g,'debout'); setPose(g,o.pose||'debout'); setEpi(g,o);
  return g; }

/* ---------- poses ---------- */
/* mêmes réglages que les anciennes poses : [épaule avant/arrière, écart], coude, dos, [hanche, genou] ; index 0 = bras G, 1 = bras D ;
   chaque os est orienté vers la direction voulue depuis sa direction au repos */
const POSES={
  debout:     { sh:[[0.05,0.08],[0.05,-0.08]], el:[-0.15,-0.15], sp:0.02, leg:[0,0] },
  machine:    { sh:[[-0.55,0.12],[-0.55,-0.12]], el:[-0.85,-0.85], sp:0.14, leg:[-0.04,0.06] },
  soufflette: { sh:[[-0.35,0.12],[-1.25,-0.1]], el:[-0.9,-0.15], sp:0.12, leg:[-0.03,0.05], wr:[0,0.3] },
  aspire:     { sh:[[-0.7,0.15],[-0.45,-0.05]], el:[-0.6,-0.7], sp:0.35, leg:[-0.25,0.4] },
  dos_courbe: { sh:[[-1.45,0.16],[-1.45,-0.16]], el:[-0.2,-0.2], sp:0.7, hip:0.6, leg:[0,0.04] },
};
const DOWN=new THREE.Vector3(0,-1,0), E=(x,y,z)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));
/* tourne l'os o pour que son segment (vers son os enfant, ou le bout virtuel de la main) suive la direction monde Dw */
function aim(o,Dw){ const c=o.children.find(x=>x.isBone)||o.userData.tip; o.updateMatrixWorld(true);
  o.getWorldPosition(_a); c.getWorldPosition(_b); const d=_b.sub(_a).normalize();
  const w=new THREE.Quaternion().setFromUnitVectors(d,Dw.clone().normalize()).multiply(wq(o)); o.quaternion.copy(wq(o.parent).invert().multiply(w)); o.updateMatrixWorld(true); }
/* tourne l'os o de l'angle a autour de l'axe X du personnage (penché vers l'avant si a > 0) */
function lean(o,rq,a){ if(!a) return; const R=rq.clone().multiply(E(a,0,0)).multiply(rq.clone().invert());
  o.quaternion.copy(wq(o.parent).invert().multiply(R).multiply(wq(o))); o.updateMatrixWorld(true); }
export function setPose(g,pose){ const P=g.userData.P, B=P.B, A=POSES[pose]||POSES.debout;
  for(const [k,b] of Object.entries(B)) b.quaternion.copy(P.rest[k]); B.Hips.position.y=P.y0; g.updateMatrixWorld(true);
  const rq=wq(P.inner), dir=q=>DOWN.clone().applyQuaternion(rq.clone().multiply(q));
  const hf=A.hip||0; lean(B.Hips,rq,hf);                                                     // bascule du bassin
  lean(B.Spine,rq,A.sp*0.4); lean(B.Spine1,rq,A.sp*0.3); lean(B.Spine2,rq,A.sp*0.3);
  lean(B.Neck,rq,-(hf+A.sp)*0.35);                                                           // le regard reste vers l'avant
  const chest=E(hf+A.sp,0,0);
  ['G','D'].forEach((S,i)=>{ const N=COTE[S], qs=chest.clone().multiply(E(A.sh[i][0],0,A.sh[i][1])), qe=qs.clone().multiply(E(A.el[i],0,0)), qw=qe.clone().multiply(E(A.wr?.[i]||0,0,0));
    aim(B[N.Bras],dir(qs)); aim(B[N.AvantBras],dir(qe)); aim(B[N.Main],dir(qw));
    aim(B[N.Cuisse],dir(E(A.leg[0],0,0))); aim(B[N.Jambe],dir(E(A.leg[0]+A.leg[1],0,0)));
    const f=B[N.Pied]; f.quaternion.copy(wq(f.parent).invert().multiply(rq.clone().multiply(P.restW[N.Pied]))); f.updateMatrixWorld(true); });   // pied à plat
  /* pieds au sol : le bassin descend quand les genoux plient (hauteur de référence : la pose debout) */
  g.updateMatrixWorld(true); const low=Math.min(B.LeftFoot.getWorldPosition(_a).y, B.RightFoot.getWorldPosition(_b).y);
  if(P.foot==null) P.foot=low; else { B.Hips.position.y=P.y0-(low-P.foot)/B.Hips.parent.getWorldScale(_a).y; g.updateMatrixWorld(true); }
  g.userData.pose=pose; }

/* ---------- tenue, chaussures, gants, EPI ---------- */
export function setEpi(g,o={}){ const P=g.userData.P, L=P.L, e=new Set(o.epi||[]);
  const G=GRP[P.grp], tenue=e.has('tenue') || o.tenue===true ? G.ok : G.mal, secu=e.has('chaussures');
  if(P.grp==='fille' && o.hair){ const q= o.hair==='attache'? G.ok : G.mal; if(q!==P.qui){ P.qui=q; placerObjets(g); } }
  const gant=e.has('gants_chim')? 'gants_chim' : e.has('gants_manut')? 'gants_manut' : null;
  for(const [n,m] of Object.entries(L)){ const [k,p]=n.split('|');
    m.visible=(p==='tete' && k===P.qui) || (p==='corps' && k===tenue) || (p==='pieds' && k===tenue) || (p==='mains' && k===tenue);
    if(p==='mains') m.material=gant? GANTS[gant] : EL[k].mat;
    /* chaussures de la tenue portée, dans le style choisi (pas de mélange de modèles à la cheville) */
    if(p==='pieds') m.material= (EL[k].E.chaussures==='securite')===secu ? EL[k].mat : EL[k].matAutres; }
  for(const [code,k] of Object.entries(EPI)) if(P.epi[k]) P.epi[k].visible=e.has(code);
  P.face.mouth.visible=!e.has('masque') && !e.has('masque_a');
  P.scarf.visible=!!o.echarpe; P.bracelet.visible=!!o.bijoux && !gant; }

/* ---------- objets tenus par les personnages ---------- */
const std=(c,o={})=>new THREE.MeshStandardMaterial({ color:c, roughness:.78, metalness:0, ...o });
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
