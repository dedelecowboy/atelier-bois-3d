/* Lames de la scie à ruban : râtelier de l'atelier et ruban sans fin en 3D.
   La lame à ruban n'a rien de commun avec la lame circulaire `sawBlade` (engine/kit.js) : c'est un ruban d'acier
   sans fin, soudé, denté, avoyé, qui passe sur les deux volants. Elle est décrite par sa largeur (pointe des dents
   au dos), son épaisseur, son pas de denture et sa voie (largeur du trait de scie).

   Rayon mini selon la largeur (valeurs prudentes, la plus grande des deux tables) : tables des fabricants Dictum
   (« Radientabelle », lames de 3 à 13 mm) et Starrett / Lenox reprise par ACE Makerspace (lames de 1/8" à 3/4") ;
   30 mm et plus : sciage rectiligne seulement (valeur proposée). Voie : environ 1,8 fois l'épaisseur (CFB TB 2 : 1,5 à 1,9). */
import * as THREE from 'three';
import { RV, XW, YL, YU, TABLE_Y } from './constants.js';

export const RMIN = { 6:20, 10:40, 15:95, 20:140, 30:300, 35:400 };
/* râtelier : id, largeur (mm), pas (mm), épaisseur (mm), défaut éventuel */
export const BLADES = [
  { id:'r6',  w:6,  p:4,  e:0.6, n:'6 mm · pas 4' },
  { id:'r10', w:10, p:6,  e:0.7, n:'10 mm · pas 6' },
  { id:'r15', w:15, p:8,  e:0.7, n:'15 mm · pas 8' },
  { id:'r20', w:20, p:10, e:0.8, n:'20 mm · pas 10' },
  { id:'r30', w:30, p:15, e:0.8, n:'30 mm · pas 15 (n° 1)' },
  { id:'r30c',w:30, p:15, e:0.8, n:'30 mm · pas 15 (n° 2)', crack:true },
  { id:'r35', w:35, p:22, e:1.0, n:'35 mm · pas 22 · ép. 1,0' },
];
export const bladeById = id => BLADES.find(b=>b.id===id) || null;
export const rmin = b => b? (RMIN[b.w] ?? 300) : Infinity;
export const voie = b => b? Math.round(b.e*1.8*10)/10 : 1.4;
export const toothH = b => b? Math.round(b.p*0.45*10)/10 : 0;

/* ---------- ruban en 3D ----------
   Chemin du dos de la lame dans le plan XY (rayon RV autour des deux volants) ; la largeur est le long de Z,
   de z = −w (dos) à z = −h (fond de denture) ; les dents (h) sont dessinées seulement sur le brin descendant
   visible (entre le dessous de la table et le carter supérieur) et défilent vers le bas quand la lame tourne. */
const BODY = new THREE.MeshStandardMaterial({ color:0xc9ced3, metalness:0.85, roughness:0.32, side:THREE.DoubleSide });
const TOOTH = new THREE.MeshStandardMaterial({ color:0xe6eaee, metalness:0.9, roughness:0.25, side:THREE.DoubleSide });
const CRACK = new THREE.MeshBasicMaterial({ color:0x111111 });
const Y_T0 = TABLE_Y - 0.14, Y_T1 = YU - RV - 0.02, SPAN = Y_T1 - Y_T0;   // brin denté visible

export function buildBand(){
  const g = new THREE.Group(); g.name='ruban';
  let body=null, teeth=null, crack=null, cur=null, inv=false, off=0;
  function make(b, inverted){
    for(const m of [body,teeth,crack]) if(m){ g.remove(m); m.geometry.dispose(); }
    body=teeth=crack=null; cur=b; inv=!!inverted; if(!b) return;
    const w=b.w/1000, h=toothH(b)/1000, z0=-w, z1=-h;
    /* contour : par-dessus le volant supérieur (de gauche à droite), descente en x = 0, sous le volant inférieur, remontée */
    const pts=[], n=64;
    for(let i=0;i<=n;i++){ const a=Math.PI-Math.PI*i/n; pts.push([XW+RV*Math.cos(a), YU+RV*Math.sin(a)]); }
    for(let i=0;i<=n;i++){ const a=-Math.PI*i/n; pts.push([XW+RV*Math.cos(a), YL+RV*Math.sin(a)]); }
    pts.push(pts[0]);
    const pos=[], idx=[];
    pts.forEach(([x,y],i)=>{ pos.push(x,y,z0, x,y,z1); if(i){ const k=i*2; idx.push(k-2,k-1,k, k-1,k+1,k); } });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setIndex(idx); geo.computeVertexNormals();
    body=new THREE.Mesh(geo,BODY); body.castShadow=true; g.add(body);
    /* dents : prisme triangulaire (épaisseur = voie) ; face d'attaque vers le bas (sens du mouvement) ; à l'envers : vers le haut */
    const p=b.p/1000, t=voie(b)/1000, tip= inverted? 0.88 : 0.12;
    const s=new THREE.Shape(); s.moveTo(-h,0); s.lineTo(0,tip*p); s.lineTo(-h,p*0.98); s.closePath();
    const tg=new THREE.ExtrudeGeometry(s,{ depth:t, bevelEnabled:false }); tg.translate(0,0,-t/2);
    tg.rotateY(-Math.PI/2);     // forme (z, y) dans le plan YZ, épaisseur le long de X
    const N=Math.ceil(SPAN/p)+1;
    teeth=new THREE.InstancedMesh(tg,TOOTH,N); teeth.castShadow=true; g.add(teeth);
    if(b.crack){ crack=new THREE.Mesh(new THREE.BoxGeometry(t*1.6,0.0012,w*0.45),CRACK); g.add(crack); }
    place(); }
  const ob=new THREE.Object3D();
  function place(){ if(!teeth||!cur) return; const p=cur.p/1000, N=teeth.count, L=N*p;
    for(let i=0;i<N;i++){ const y=Y_T0+((i*p-off)%L+L)%L, out=y>Y_T1; ob.position.set(0, out? Y_T0 : y, 0); ob.scale.setScalar(out? 1e-4 : 1); ob.updateMatrix(); teeth.setMatrixAt(i,ob.matrix); }   // hors du brin visible : réduite à rien
    teeth.instanceMatrix.needsUpdate=true;
    if(crack){ const w=cur.w/1000; crack.position.set(0, Y_T0+((0.35-off)%SPAN+SPAN)%SPAN, -w+w*0.22); } }
  return { group:g, set:make, get blade(){ return cur; }, get inverted(){ return inv; },
    /* défilement (m) : la lame descend sur le brin travaillant */
    advance(d){ if(!cur) return; off=(off+d)%1000; place(); } };
}
