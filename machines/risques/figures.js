/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Personnages de l'atelier (élèves), style « 3D cartoon », générés avec Meshy (demandé par l'enseignant le 06/11/2026 ;
   remplace le personnage fabriqué par programme du 05/11/2026).
   Modèle : machines/risques/eleves.glbz, fabriqué par tools/personnage/meshy/ (voir CLAUDE.md « Personnages des risques
   généraux ») : trois élèves (garçon, fille, élève noir ; groupes garcon, fille, noir), quatre versions chacun (tenue
   d'atelier ou sweat × chaussures de sécurité ou baskets ; fille : queue de cheval en tenue, cheveux détachés en sweat),
   un squelette Mixamo par élève (24 os ; ses autres versions y sont recalées à la fabrication), maillages riggés de
   Meshy (10 000 faces) arrondis ICI au premier usage (subdiv.js), chaque version en quatre pièces (tête, corps, pieds,
   mains) qu'on combine ; quatre EPI (casque antibruit, lunettes, FFP2, demi-masque), l'écharpe et le bracelet.
   Lu ici sans chargeur asynchrone (le module construit ses personnages tout de suite) ; les textures arrivent juste après.
   person(o) rend un groupe debout sur y = 0, regardant vers +Z, environ 1,72 m.
   o.eleve : 'garcon' | 'fille' | 'noir' (sinon d'après o.hair : long / attache = fille, sinon garçon)
   o.epi   : codes d'EPI portés (lunettes, auditif, masque, masque_a, chaussures, gants_manut, gants_chim, tenue)
   o.hair  : pour la fille, 'long' (cheveux détachés) | 'attache' (queue de cheval) : la tête de la version qui a cette
             coiffure, posée sur la tenue portée
   o.echarpe, o.bijoux : écharpe, bracelet (le bracelet est caché sous les gants)
   o.pose  : 'debout' | 'machine' (mains au plan de travail) | 'soufflette' | 'aspire' | 'dos_courbe'
   Sans « tenue » : sweat ; avec : veste de travail. Sans « chaussures » : baskets ; avec : sécurité (vraie version Meshy).
   setEpi(g, o), setPose(g, pose) : changent un personnage déjà construit (avatar du scénario « EPI »).
   g.userData.P : handR (repère de la main qui tient un objet : −Y le long de la main, +Z vers l'avant), arms[i].palm. */
import * as THREE from 'three';
import { unzlibSync } from 'fflate';
import PACK from './eleves.glbz';
import { loop, normales } from './subdiv.js';

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

/* ---------- élèves : pièces partagées (géométries, matières), arrondies au premier usage (subdiv.js) ---------- */
const PIECES=['tete','corps','pieds','mains','cou'];
function pieces(E){ const q=D.view(Uint16Array,E.pos), n=E.n, P=new Float32Array(n*3);
  for(let i=0;i<n;i++) for(let k=0;k<3;k++) P[i*3+k]=E.pmin[k]+q[i*3+k]*E.pscale[k];
  const uq=D.view(Uint16Array,E.uv), UV=new Float32Array(n*2); for(let i=0;i<n*2;i++) UV[i]=uq[i]/65535;
  const wq=D.view(Uint8Array,E.wgt), W=new Float32Array(n*4); for(let i=0;i<n*4;i++) W[i]=wq[i]/255;
  const S=loop({ P, UV, J:D.view(Uint8Array,E.jnt), W, F:Uint32Array.from(D.view(Uint16Array,E.idx)), weld:Uint32Array.from(D.view(Uint16Array,E.weld)), part:D.view(Uint8Array,E.part) });
  const N=normales(S.P,S.F,S.weld), nf=S.F.length/3, out={};
  PIECES.forEach((p,pi)=>{ const map=new Int32Array(S.P.length/3).fill(-1), idx=[]; let m=0;
    for(let f=0;f<nf;f++) if(S.part[f]===pi) for(let k=0;k<3;k++){ const v=S.F[f*3+k]; if(map[v]<0) map[v]=m++; idx.push(map[v]); }
    const pos=new Float32Array(m*3), nor=new Float32Array(m*3), uv=new Float32Array(m*2), ji=new Uint8Array(m*4), jw=new Float32Array(m*4);
    for(let v=0;v<map.length;v++){ const j=map[v]; if(j<0) continue; for(let d=0;d<3;d++){ pos[j*3+d]=S.P[v*3+d]; nor[j*3+d]=N[v*3+d]; } uv[j*2]=S.UV[v*2]; uv[j*2+1]=S.UV[v*2+1];
      for(let d=0;d<4;d++){ ji[j*4+d]=S.J[v*4+d]; jw[j*4+d]=S.W[v*4+d]; } }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setAttribute('skinIndex',new THREE.BufferAttribute(ji,4)); g.setAttribute('skinWeight',new THREE.BufferAttribute(jw,4));
    g.setIndex(m<65536? new THREE.BufferAttribute(Uint16Array.from(idx),1) : new THREE.BufferAttribute(Uint32Array.from(idx),1)); g.computeBoundingSphere(); out[p]=g; });
  return out; }
const EL={}; for(const [k,E] of Object.entries(D.J.eleves)){ let mat=null, geo=null;
  EL[k]={ E, get mat(){ return mat||(mat=new THREE.MeshStandardMaterial({ map:texture(E.tex), roughness:.8, metalness:0 })); }, get geo(){ return geo||(geo=pieces(E)); } }; }
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
/* groupes : trois élèves, quatre versions chacun (tenue d'atelier ou sweat × chaussures de sécurité ou baskets) */
const GRP={ garcon:{ ok:'equipe', ok_b:'equipe_b', mal:'mal', mal_s:'mal_s' },
  fille:{ ok:'fille', ok_b:'fille_b', mal:'fille_mal', mal_s:'fille_mal_s', ok_l:'fille_l', mal_q:'fille_mq' },   // fille_l : tenue, sécurité, cheveux détachés ; fille_mq : sweat, baskets, queue de cheval
  noir:{ ok:'noir', ok_b:'noir_b', mal:'noir_mal', mal_s:'noir_mal_s' } };
export const ELEVES=Object.keys(GRP).filter(k=>D.J.eleves[GRP[k].ok]);
/* version portée : tenue d'atelier ou non, chaussures de sécurité ou non */
const version=(G,ok,secu)=>ok? (secu? G.ok : G.ok_b) : (secu? G.mal_s : G.mal);
const groupeDe=o=>GRP[o.eleve]&&D.J.eleves[GRP[o.eleve].ok]? o.eleve : o.hair==='long'||o.hair==='attache'? 'fille' : 'garcon';

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
  const e0=new Set(o.epi||[]), grp=groupeDe(o), G=GRP[grp];
  const qui=version(G, grp==='fille'? o.hair==='attache' : e0.has('tenue')||o.tenue===true, true);
  inner.scale.setScalar(HAUTEUR/EL[G.ok].E.hauteur);
  const { arm, skel, B }=skeleton(grp); inner.add(arm);
  /* pièces de chaque version, créées au premier usage (setEpi) */
  const L={}; const piece=(k,p)=>{ const n=k+'|'+p; if(L[n]) return L[n]; const m=new THREE.SkinnedMesh(EL[k].geo[p],EL[k].mat);
    m.name=n; m.castShadow=true; m.receiveShadow=true; m.frustumCulled=false; m.bind(skel,new THREE.Matrix4()); inner.add(m); return L[n]=m; };
  for(const p of PIECES) piece(qui,p);
  g.updateMatrixWorld(true);
  /* au repos : direction de chaque main, bout virtuel de la main (pour l'orienter), repères des mains */
  const rqi=wq(inner).invert(), P={ L, piece, B, inner, qui, grp, face:{ mouth:{ visible:true } }, rest:{}, restW:{} };
  for(const [k,b] of Object.entries(B)){ P.rest[k]=b.quaternion.clone(); P.restW[k]=rqi.clone().multiply(wq(b)); }
  const hand=S=>{ const h=B[COTE[S].Main], f=B[COTE[S].AvantBras], hw=h.getWorldPosition(new THREE.Vector3()), dir=hw.clone().sub(f.getWorldPosition(new THREE.Vector3())).normalize();
    const tip=new THREE.Object3D(); tip.position.copy(h.worldToLocal(hw.clone().addScaledVector(dir,0.09))); h.add(tip); h.userData.tip=tip;
    const y=dir.clone().negate(), z=new THREE.Vector3(0,0,1).addScaledVector(y,-y.z).normalize(), x=new THREE.Vector3().crossVectors(y,z);
    const r=new THREE.Object3D(); r.position.copy(hw); r.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)); inner.add(r); r.updateMatrixWorld(true); h.attach(r);
    const palm=new THREE.Object3D(); palm.position.set(0,-0.07,0); r.add(palm); return { r, palm }; };
  const hG=hand('G'), hD=hand('D');
  P.handR=hD.r; P.arms=[{ palm:hG.palm, r:hG.r },{ palm:hD.palm, r:hD.r }];
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
export const POSES={
  debout:     { sh:[[0.05,0.08],[0.05,-0.08]], el:[-0.15,-0.15], sp:0.02, leg:[0,0] },
  machine:    { sh:[[-0.55,0.12],[-0.55,-0.12]], el:[-0.85,-0.85], sp:0.14, leg:[-0.04,0.06], appui:true },
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
  if(A.appui) appuyer(g);
  g.userData.pose=pose; }

/* ---------- mains posées sur la table (demandé par l'enseignant le 07/11/2026 : « les bras passent dans la table de la machine ») ----------
   Poses « au travail » (appui:true) : si la main arrive sur ou sous le plateau d'un appui proche (machine, établi : P.appuis,
   voir setAppuis), elle est posée À PLAT sur le plateau et le bras est recalculé (cinématique inverse à deux os : épaule,
   coude) ; le coude part vers l'extérieur et le bas, ou plus haut si l'avant-bras traverserait le bord de la table. */
const RC=new THREE.Raycaster(), V=(x,y,z)=>new THREE.Vector3(x,y,z);
const vu=o=>{ for(;o;o=o.parent) if(!o.visible) return false; return true; };
/* hauteur du plateau sous le point p : le plus haut dessus à moins de 30 cm au-dessus de p (une main passée sous le plateau y remonte) et 25 cm au moins sous les épaules (pas le capot ni les presseurs de la machine) */
function surface(P,p){ let best=null; const lim=Math.min(p.y+0.30, (P._epaule??9)-0.25); RC.set(V(p.x,p.y+0.5,p.z),DOWN); RC.near=0; RC.far=1.4;
  for(const o of P.appuis){ if(!vu(o)) continue; for(const h of RC.intersectObject(o,true)){ if(!h.object.isMesh || h.object.material?.visible===false || !vu(h.object)) continue;
    if(h.point.y<=lim){ if(best==null||h.point.y>best) best=h.point.y; break; } } } return best; }
/* mains tenant un objet : { G, D } = point monde où poser la paume (null pour revenir à la table) */
export function setCibles(g,c){ g.userData.P.cibles=c||null; if(g.userData.pose) setPose(g,g.userData.pose); }
export function setAppuis(g,list){ const P=g.userData.P; P.appuis=(list||[]).filter(Boolean); if(g.userData.pose) setPose(g,g.userData.pose); }
function appuyer(g){ const P=g.userData.P; if(!P.appuis?.length) return; g.updateMatrixWorld(true);
  P._epaule=Math.min(P.B.LeftArm.getWorldPosition(V()).y, P.B.RightArm.getWorldPosition(V()).y);
  const qg=wq(P.inner), X=V(1,0,0).applyQuaternion(qg).setY(0).normalize(), Z=V(0,0,1).applyQuaternion(qg).setY(0).normalize();
  ['G','D'].forEach((S,i)=>{ const N=COTE[S], a=B_(P,N.Bras), f=B_(P,N.AvantBras), h=B_(P,N.Main);
    /* paume, puis bout des doigts : une main au bord de la table a les doigts dans le plateau → elle avance dessus */
    let palm=P.arms[i].palm.getWorldPosition(V()), ys=null;
    const cible=P.cibles?.[S];
    if(cible){ palm=cible.clone(); ys=cible.y-0.012; }                                 // main posée sur un objet tenu (ponceuse, pinceau)
    else { /* paume et doigts (à 12 et 18 cm du poignet) : le plateau le plus haut qu'ils touchent ; la main s'y pose à plat */
      const hw=h.getWorldPosition(V()), dh=h.userData.tip.getWorldPosition(V()).sub(hw).normalize();
      let best=null;
      const lat=V(-dh.z,0,dh.x).normalize().multiplyScalar(0.045);                    // pouce et petit doigt, de part et d'autre
      for(const [q,k] of [[palm,0],[hw.clone().addScaledVector(dh,0.12),1],[hw.clone().addScaledVector(dh,0.18),2],[hw.clone().addScaledVector(dh,0.09).add(lat),1],[hw.clone().addScaledVector(dh,0.09).sub(lat),1]]){ const y=surface(P,q);
        if(y!=null && q.y<y+(k? 0.03 : 0.04) && (best==null || y>best.y+0.01)) best={ y, q:k? q.clone().lerp(hw,k===2? 0.35 : 0.1) : q }; }
      if(!best) return;                                                                // main au-dessus : rien à corriger
      palm=best.q; ys=best.y; }
    const S0=a.getWorldPosition(V()), E0=f.getWorldPosition(V()), H0=h.getWorldPosition(V()), la=E0.distanceTo(S0), lb=H0.distanceTo(E0);
    const dirH=H0.clone().sub(E0).setY(0); if(dirH.lengthSq()<1e-6) dirH.copy(Z); dirH.normalize();
    const W=V(palm.x,ys+0.055,palm.z).addScaledVector(dirH,-0.065);                     // poignet : la paume à plat sur le plateau
    const side=X.clone().multiplyScalar(S==='G'? 1 : -1), back=Z.clone().negate();
    const poles=[side.clone().multiplyScalar(0.7).add(V(0,-0.5,0)).addScaledVector(back,0.2), side.clone().add(back.clone().multiplyScalar(0.3)), side.clone().multiplyScalar(0.6).add(V(0,0.5,0))];
    let ok=null;
    for(const pole of poles){ const d=W.clone().sub(S0); let L=d.length(); L=Math.max(Math.abs(la-lb)*1.01,Math.min(L,(la+lb)*0.995)); const u=d.normalize();
      const v=pole.clone().addScaledVector(u,-pole.dot(u)).normalize(), ca=(la*la+L*L-lb*lb)/(2*la*L), sa=Math.sqrt(Math.max(0,1-ca*ca));
      const E=S0.clone().addScaledVector(u,la*ca).addScaledVector(v,la*sa), Wr=S0.clone().addScaledVector(u,L);
      ok={ E, Wr };
      /* l'avant-bras ne doit pas traverser le plateau (coude et points de l'avant-bras au-dessus de la table sous eux) */
      let bad=false; for(const t of [0,0.33,0.66]){ const q=E.clone().lerp(Wr,t), y=surface(P,q); if(y!=null && q.y<y+0.02){ bad=true; break; } }
      if(!bad) break; }
    aim(a,ok.E.clone().sub(S0)); aim(f,ok.Wr.clone().sub(ok.E)); aim(h,dirH.clone().add(V(0,-0.07,0)));
    /* paume vers le plateau : rotation de la main autour de son axe (au repos, les paumes regardent les cuisses) */
    { const hw=h.getWorldPosition(V()), d=h.userData.tip.getWorldPosition(V()).sub(hw).normalize(), n=V(S==='G'? -1 : 1,0,0).applyQuaternion(wq(P.arms[i].r));
      const pr=v=>v.clone().addScaledVector(d,-v.dot(d)), n1=pr(n), n2=pr(DOWN);
      if(n1.lengthSq()>1e-6 && n2.lengthSq()>1e-6){ const q=new THREE.Quaternion().setFromUnitVectors(n1.normalize(),n2.normalize());
        h.quaternion.copy(wq(h.parent).invert().multiply(q).multiply(wq(h))); h.updateMatrixWorld(true); } }
  });
  g.updateMatrixWorld(true); }
const B_=(P,n)=>P.B[n];
/* contrôle (tests) : enfoncement des bras sous le plateau, en m (négatif = sous la table) : coudes, avant-bras, poignets,
   paumes, et sommets des mains (gants compris) */
export function enfoncement(g,detail){ const P=g.userData.P; if(!P.appuis?.length) return null; g.updateMatrixWorld(true); P._epaule=Math.min(P.B.LeftArm.getWorldPosition(V()).y, P.B.RightArm.getWorldPosition(V()).y); let m=9; const w=V(), D=[];
  const test=(p,lab)=>{ const y=surface(P,p); if(y!=null){ m=Math.min(m,p.y-y); if(detail&&lab) D.push([lab,+p.y.toFixed(3),+y.toFixed(3)]); } };
  ['G','D'].forEach((S,i)=>{ const N=COTE[S], e=P.B[N.AvantBras].getWorldPosition(V()), h=P.B[N.Main].getWorldPosition(V());
    for(const t of [0,0.25,0.5,0.75,1]) test(e.clone().lerp(h,t),S+'avb'+t); test(P.arms[i].palm.getWorldPosition(V()),S+'paume'); });
  const mains=Object.values(P.L).find(x=>x.visible && x.name.endsWith('|mains'));
  if(mains){ const pa=mains.geometry.attributes.position; for(let i=0;i<pa.count;i+=Math.max(1,Math.floor(pa.count/240))){ mains.getVertexPosition(i,w); w.applyMatrix4(mains.matrixWorld); const y=surface(P,w); if(detail && y!=null && w.y<y) D.push(['sommet',+w.x.toFixed(3),+w.y.toFixed(3),+w.z.toFixed(3),+y.toFixed(3)]); test(w.clone()); } }
  if(detail) return D; return m===9? null : +m.toFixed(3); }

/* ---------- tenue, chaussures, gants, EPI ---------- */
export function setEpi(g,o={}){ const P=g.userData.P, e=new Set(o.epi||[]);
  const G=GRP[P.grp], ok=e.has('tenue') || o.tenue===true, secu=e.has('chaussures'); let V=version(G,ok,secu);
  /* tête : celle de la version portée ; pour la fille, la coiffure demandée (queue de cheval = versions en tenue,
     cheveux détachés = versions en sweat) : sinon la tête de l'autre tenue, mêmes chaussures */
  let T=V; if(P.grp==='fille' && o.hair){ const queue=o.hair==='attache';
    if(!queue && ok && secu && G.ok_l && EL[G.ok_l]){ V=T=G.ok_l; }          // tenue + cheveux détachés : la vraie version Meshy
    else if(queue && !ok && !secu && G.mal_q && EL[G.mal_q]){ V=T=G.mal_q; }   // sweat ouvert + queue de cheval : la vraie version Meshy
    else if(queue!==ok) T=version(G,queue,secu); }
  if(T!==P.qui){ P.qui=T; placerObjets(g); }
  for(const p of PIECES) P.piece(V,p); P.piece(T,'tete'); P.piece(T,'cou');
  const gant=e.has('gants_chim')? 'gants_chim' : e.has('gants_manut')? 'gants_manut' : null;
  for(const [n,m] of Object.entries(P.L)){ const [k,p]=n.split('|');
    m.visible= p==='tete'||p==='cou'? k===T : k===V;
    if(p==='mains') m.material=gant? GANTS[gant] : EL[k].mat; }
  for(const [code,k] of Object.entries(EPI)) if(P.epi[k]) P.epi[k].visible=e.has(code);
  P.face.mouth.visible=!e.has('masque') && !e.has('masque_a');
  P.scarf.visible=!!o.echarpe; P.bracelet.visible=!!o.bijoux && !gant; }

/* repères du visage de l'élève porté (m, repère du personnage au repos : x vers sa gauche, y depuis le sol, z vers l'avant) */
export const reperes=g=>D.J.eleves[g.userData.P.qui].reperes;

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
