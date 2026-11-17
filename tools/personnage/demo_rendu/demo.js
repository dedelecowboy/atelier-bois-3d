/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Démonstration du rendu des élèves : la même scène dessinée deux fois, de part et d'autre d'une réglette.
   À gauche : le rendu du module (lumières de engine/stage.js avec les réglages de machines/risques/config.js, matières de figures.js).
   À droite : le rendu proposé (rendu.js). Mêmes personnages (figures.js, eleves.glbz), aucun fichier en plus. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { person, setEpi, setPose, ELEVES } from '../../../machines/risques/figures.js';
import { embellir, eclairage, majLumieres, REGL, FAITES } from './rendu.js';

const $=id=>document.getElementById(id), cv=$('vue');
const R=new THREE.WebGLRenderer({ canvas:cv, antialias:true, alpha:true, powerPreference:'high-performance' });
R.setPixelRatio(Math.min(devicePixelRatio,2)); R.shadowMap.enabled=true; R.shadowMap.type=THREE.PCFSoftShadowMap;
R.toneMapping=THREE.ACESFilmicToneMapping; R.toneMappingExposure=1.12; R.setClearColor(0,0); R.setScissorTest(true);
const scene=new THREE.Scene(); scene.environment=new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(),0.04).texture;
const cam=new THREE.PerspectiveCamera(30,1,0.05,40), ctl=new OrbitControls(cam,cv); ctl.enableDamping=true; ctl.minDistance=0.35; ctl.maxDistance=7; ctl.maxPolarAngle=Math.PI*0.52;

/* sol de l'atelier (gris clair), fondu sur les bords */
{ const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d'), g=x.createRadialGradient(128,128,40,128,128,127); g.addColorStop(0,'#fff'); g.addColorStop(1,'#000'); x.fillStyle=g; x.fillRect(0,0,256,256);
  const sol=new THREE.Mesh(new THREE.CircleGeometry(3.2,64),new THREE.MeshStandardMaterial({ color:0xb9bec3, roughness:.92, alphaMap:new THREE.CanvasTexture(c), transparent:true }));
  sol.rotation.x=-Math.PI/2; sol.receiveShadow=true; scene.add(sol); }

/* rendu actuel : lumières du module */
const A=new THREE.Group(); scene.add(A);
{ A.add(new THREE.HemisphereLight(0xffffff,0x8a8f94,0.55)); const sun=new THREE.DirectionalLight(0xffffff,1.6); sun.position.set(-6,16,9); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{ left:-15,right:15,top:15,bottom:-15,near:1,far:50 }); sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.02; A.add(sun); }
/* rendu proposé */
const B=eclairage(); scene.add(B.groupe);

/* élève */
const etat={ eleve:ELEVES.includes('fille')? 'fille' : ELEVES[0], tenue:'ok', vue:'buste', pose:'debout', coupe:0.5, anime:!matchMedia('(prefers-reduced-motion: reduce)').matches };
const NOMS={ garcon:'Garçon', fille:'Fille', noir:'Élève 3' }, persos={};
const tenue=()=> etat.tenue==='ok'? { epi:['tenue','chaussures','lunettes','auditif'], hair:'attache' } : { epi:[], hair:'long', echarpe:etat.eleve!=='fille', bijoux:etat.eleve==='garcon' };
function montrer(){ for(const [k,g] of Object.entries(persos)) g.visible=k===etat.eleve;
  let g=persos[etat.eleve]; if(!g){ g=persos[etat.eleve]=person({ eleve:etat.eleve, ...tenue(), pose:etat.pose }); scene.add(g); }
  setEpi(g,{ eleve:etat.eleve, ...tenue() }); setPose(g,etat.pose); }
const VUES={ visage:[[0.25,1.56,1.25],[0,1.5,0.03]], buste:[[0.75,1.5,2.3],[0,1.26,0]], pied:[[1.4,1.25,5.2],[0,0.88,0]] };
function vue(k){ const [p,t]=VUES[k]; cam.position.set(...p); ctl.target.set(...t); ctl.update(); }

/* boutons */
function groupe(id,cle,apres){ const el=$(id); const maj=()=>el.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===etat[cle])));
  el.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; etat[cle]=b.dataset.v; maj(); apres(); }); maj(); }
$('gEleve').innerHTML=ELEVES.map(k=>`<button data-v="${k}">${NOMS[k]||k}</button>`).join('');
groupe('gEleve','eleve',montrer); groupe('gTenue','tenue',montrer); groupe('gPose','pose',montrer); groupe('gVue','vue',()=>vue(etat.vue));

/* réglette */
const coupe=$('coupe'), eA=$('eA'), eB=$('eB');
function placer(){ const w=cv.clientWidth, x=Math.round(etat.coupe*w); coupe.style.left=eA.style.left=eB.style.left=x+'px'; coupe.setAttribute('aria-valuenow',Math.round(etat.coupe*100));
  eA.hidden=etat.coupe<0.12; eB.hidden=etat.coupe>0.88; }
{ let pris=false; const bouge=e=>{ const r=cv.getBoundingClientRect(); etat.coupe=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)); placer(); };
  coupe.addEventListener('pointerdown',e=>{ pris=true; coupe.setPointerCapture(e.pointerId); bouge(e); });
  coupe.addEventListener('pointermove',e=>{ if(pris) bouge(e); }); coupe.addEventListener('pointerup',()=>pris=false); coupe.addEventListener('pointercancel',()=>pris=false);
  coupe.addEventListener('keydown',e=>{ const d=e.key==='ArrowLeft'? -0.05 : e.key==='ArrowRight'? 0.05 : 0; if(d){ etat.coupe=Math.min(1,Math.max(0,etat.coupe+d)); placer(); e.preventDefault(); } }); }

/* matières : celles de figures.js à gauche, soignées à droite (remises en place après chaque image) */
const liste=[];
function matieres(soigne){ liste.length=0; const g=persos[etat.eleve]; if(!g) return;
  g.traverse(o=>{ if(o.isMesh && o.visible){ liste.push(o,o.material); if(soigne) o.material=embellir(o.material,o); } }); }
const remettre=()=>{ for(let i=0;i<liste.length;i+=2) liste[i].material=liste[i+1]; };

function taille(){ const w=cv.clientWidth, h=cv.clientHeight; if(cv.width!==Math.round(w*R.getPixelRatio())||cv.height!==Math.round(h*R.getPixelRatio())){ R.setSize(w,h,false); cam.aspect=w/h; cam.fov=w<h? 38 : 30; cam.updateProjectionMatrix(); placer(); } }
/* respiration : léger mouvement du buste, des épaules et de la tête, ajouté à la pose */
const souffle=new WeakMap();
function respirer(t){ const g=persos[etat.eleve]; if(!g) return; const B=g.userData.P.B, cle=etat.pose+'|'+etat.tenue; let S=souffle.get(g);
  if(!S||S.cle!==cle){ S={ cle, q:{} }; for(const n of ['Spine1','Spine2','Head','LeftShoulder','RightShoulder']) if(B[n]) S.q[n]=B[n].quaternion.clone(); souffle.set(g,S); }
  const a=Math.sin(t*1.5), b=Math.sin(t*0.43), E=new THREE.Euler(), Q=new THREE.Quaternion(), tour=(n,x,y,z)=>{ if(S.q[n]) B[n].quaternion.copy(S.q[n]).multiply(Q.setFromEuler(E.set(x,y,z))); };
  tour('Spine1',-0.010*a,0,0); tour('Spine2',-0.014*a,0,0); tour('LeftShoulder',0,0,0.012*a); tour('RightShoulder',0,0,-0.012*a); tour('Head',0.018*a+0.012*b,0.05*b,0.012*Math.sin(t*0.31)); }
function image(ms){ taille(); ctl.update(); if(etat.anime) respirer((ms||0)/1000); const w=cv.clientWidth, h=cv.clientHeight, x=Math.round(etat.coupe*w);
  R.setViewport(0,0,w,h);
  if(x>0){ A.visible=true; B.groupe.visible=false; R.toneMappingExposure=1.12; R.setScissor(0,0,x,h); R.render(scene,cam); }
  if(x<w){ A.visible=false; B.groupe.visible=true; R.toneMappingExposure=1.0; majLumieres(cam,B); matieres(true); R.setScissor(x,0,w-x,h); R.render(scene,cam); remettre(); }
  requestAnimationFrame(image); }
montrer(); vue(etat.vue); placer(); image();
window.__demo={ FAITES, etat, vue, montrer, placer, REGL, persos, cam, ctl, B, pret:()=>Object.values(persos).every(g=>{ let ok=true; g.traverse(o=>{ if(o.isMesh&&o.visible&&o.material.map&&!o.material.map.image) ok=false; }); return ok; }) };
