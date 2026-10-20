/* Page « atelier » : entrée visuelle de l'atelier virtuel.
   Le hall en 3D avec les vrais modèles des machines (buildModel de chaque module, en position de repos),
   la chaîne de débit peinte au sol, une étiquette par poste, une fiche au clic avec le lien vers le simulateur.
   Aperçu élève : machines déverrouillées une à une (dans Moodle, ce sont les restrictions d'accès qui le font). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STATIONS, FAMILLES, FLOW } from './stations.js';
import { buildHall, buildFlow, HALL } from './hall.js';

const $ = id=>document.getElementById(id);
const ETAT = { service:'En service', essai:'En essai', avenir:'À venir' };

/* ---------- rendu ---------- */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate=false;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene();
{ const pm=new THREE.PMREMGenerator(renderer); scene.environment=pm.fromScene(new RoomEnvironment(),0.04).texture; }
scene.add(new THREE.HemisphereLight(0xffffff,0x8a8f94,0.55));
const sun=new THREE.DirectionalLight(0xfff6ea,1.5); sun.position.set(-6,14,9); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{ left:-15, right:15, top:11, bottom:-11, near:2, far:40 });
sun.shadow.bias=-0.0005; sun.shadow.normalBias=0.03; scene.add(sun);

const camera=new THREE.PerspectiveCamera(36,1,0.1,120);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true; controls.maxPolarAngle=Math.PI*0.47; controls.minDistance=2.5; controls.maxDistance=42;
const HOME={ pos:new THREE.Vector3(3.5,17.5,21.5), tgt:new THREE.Vector3(0,0,-0.6) };
camera.position.copy(HOME.pos); controls.target.copy(HOME.tgt);

/* ---------- hall et postes ---------- */
const hall=buildHall(scene);
const flow=buildFlow(scene, FLOW);

const GREY=new THREE.Color(0xb7bcc0);
const pickables=[];
for(const s of STATIONS){
  const g=new THREE.Group(); scene.add(g); s.group=g;
  if(s.build){
    const parts={}; const pm=new Proxy(parts,{ get:(t,k)=>t[k]||(t[k]=[]) });
    const tagPart=(o,k)=>{ o.traverse(m=>{ if(m.isMesh) pm[k].push(m); }); return o; };
    try{ const model=s.build({ root:g, tagPart, partMeshes:pm }); s.rest?.(model); }
    catch(e){ console.error(s.id,e); }
    /* organes hors du poste (flexible d'aspiration de la scie à format vers le mur de sa page…) : cachés */
    if(s.clip){ g.updateMatrixWorld(true); const [x0,x1,z0,z1]=s.clip, b=new THREE.Box3(), c=new THREE.Vector3();
      g.traverse(o=>{ if(o.isMesh){ b.setFromObject(o); b.getCenter(c); if(c.x<x0||c.x>x1||c.z<z0||c.z>z1) o.visible=false; } }); }
  } else {
    /* poste à venir : volume fantôme */
    const [w,h,d]=s.foot; const ghost=new THREE.Mesh(new THREE.BoxGeometry(w,h*1.8,d),
      new THREE.MeshStandardMaterial({ color:0x9aa3aa, transparent:true, opacity:0.18, roughness:0.6, depthWrite:false }));
    ghost.position.y=h*0.9; g.add(ghost);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry), new THREE.LineDashedMaterial({ color:0x6d7780, dashSize:0.12, gapSize:0.08 }));
    edges.position.copy(ghost.position); edges.computeLineDistances(); g.add(edges);
  }
  /* matériaux propres au poste (surbrillance, verrouillage) ; pas de transmission (passe de rendu en plus) */
  const cache=new Map();
  g.traverse(o=>{ if(!o.isMesh) return; o.castShadow=true; o.receiveShadow=true; o.userData.station=s;
    const one=m=>{ if(!cache.has(m)){ const c=m.clone(); if(c.transmission) { c.transmission=0; c.opacity=Math.max(c.opacity,0.35); } c.userData.c0=c.color?.clone(); cache.set(m,c); } return cache.get(m); };
    o.material=Array.isArray(o.material)? o.material.map(one) : one(o.material); pickables.push(o); });
  s.mats=[...cache.values()];
  g.position.set(s.pos[0],0,s.pos[1]); g.rotation.y=s.yaw; g.updateMatrixWorld(true);
  const box=new THREE.Box3();
  g.traverse(o=>{ if(!o.isMesh&&!o.isLineSegments) return; let p=o, vis=true; while(p){ vis=vis&&p.visible; p=p.parent; } if(vis) box.expandByObject(o,true); }); s.box=box; s.center=box.getCenter(new THREE.Vector3()); s.size=box.getSize(new THREE.Vector3());
  /* zone de travail peinte au sol : rectangle à la couleur de la famille */
  const col=new THREE.Color(FAMILLES[s.famille].col), m=0.45;
  const zone=new THREE.Group(); scene.add(zone); s.zone=zone;
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(s.size.x+2*m,s.size.z+2*m), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.07, depthWrite:false, toneMapped:false }));
  fill.rotation.x=-Math.PI/2; fill.position.set(s.center.x,0.004,s.center.z); fill.renderOrder=1; zone.add(fill); s.fill=fill;
  const lineMat=new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.75, toneMapped:false, depthWrite:false });
  const X0=s.center.x-s.size.x/2-m, X1=s.center.x+s.size.x/2+m, Z0=s.center.z-s.size.z/2-m, Z1=s.center.z+s.size.z/2+m, w=0.06;
  for(const [x,z,lx,lz] of [[(X0+X1)/2,Z0,X1-X0,w],[(X0+X1)/2,Z1,X1-X0,w],[X0,(Z0+Z1)/2,w,Z1-Z0],[X1,(Z0+Z1)/2,w,Z1-Z0]]){
    const l=new THREE.Mesh(new THREE.PlaneGeometry(lx,lz),lineMat); l.rotation.x=-Math.PI/2; l.position.set(x,0.005,z); l.renderOrder=1; zone.add(l); }
  s.lineMat=lineMat;
  if(s.build) hall.drop(s.center.x+(s.id==='scie-radiale'? -0.6 : 0), s.center.z-s.size.z*0.2, s.box.max.y);
}
renderer.shadowMap.needsUpdate=true;

/* ---------- étiquettes ---------- */
const lockSvg='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"/></svg>';
const labels=$('labels');
for(const s of STATIONS){
  const b=document.createElement('button'); b.type='button'; b.className='lbl'; b.dataset.etat=s.etat; b.style.setProperty('--fam',FAMILLES[s.famille].col);
  b.innerHTML=`<span class="num">${s.n}</span><span class="nm">${s.nom}</span><span class="lock">${lockSvg}</span>`;
  b.onclick=()=>select(s); b.onmouseenter=()=>hover(s); b.onmouseleave=()=>hover(null);
  labels.appendChild(b); s.lbl=b;
}
/* liste des postes (colonne de gauche) */
const list=$('postes');
for(const s of STATIONS){
  const li=document.createElement('li'); const b=document.createElement('button'); b.type='button'; b.dataset.id=s.id; b.style.setProperty('--fam',FAMILLES[s.famille].col);
  b.innerHTML=`<span class="num">${s.n}</span><span class="tx"><b>${s.nom}</b><small>${s.etat==='avenir'?'Module prévu':s.ref} · <span class="st" data-etat="${s.etat}">${ETAT[s.etat].toLowerCase()}</span></small></span><span class="lock">${lockSvg}</span>`;
  b.onclick=()=>select(s); b.onmouseenter=()=>hover(s); b.onmouseleave=()=>hover(null);
  li.appendChild(b); list.appendChild(li); s.item=b;
}

/* ---------- aperçu élève : progression ---------- */
const ORDER=STATIONS.filter(s=>s.etat!=='avenir');
let eleve=false, done=0;
const locked=s=>s.etat==='avenir' || (eleve && ORDER.indexOf(s)>done);
function applyLocks(){
  for(const s of STATIONS){ const L=locked(s), D=eleve && ORDER.indexOf(s)>=0 && ORDER.indexOf(s)<done;
    s.lbl.dataset.locked=String(L); s.item.dataset.locked=String(L); s.lbl.dataset.done=String(D); s.item.dataset.done=String(D);
    for(const m of s.mats){ if(!m.userData.c0) continue; m.color.copy(m.userData.c0); if(L && s.build) m.color.lerp(GREY,0.72); }
    s.fill.material.opacity= L? 0.03 : 0.07; s.lineMat.opacity= L? 0.3 : 0.75; }
  $('prog').hidden=!eleve; $('progN').textContent=`${done} / ${ORDER.length}`;
  $('progBar').style.width=`${100*done/ORDER.length}%`;
  if(sel) renderCard(sel);
}
$('eleve').onclick=()=>{ eleve=!eleve; $('eleve').setAttribute('aria-pressed',String(eleve)); applyLocks(); };
$('progMinus').onclick=()=>{ done=Math.max(0,done-1); applyLocks(); };
$('progPlus').onclick=()=>{ done=Math.min(ORDER.length,done+1); applyLocks(); };
$('chaine').onclick=()=>{ flow.group.visible=!flow.group.visible; $('chaine').setAttribute('aria-pressed',String(flow.group.visible)); };

/* ---------- survol et sélection ---------- */
let hov=null, sel=null;
function tint(s,on){ if(!s) return; for(const m of s.mats) if(m.emissive) m.emissive.setHex(on? 0x3a1d00 : 0x000000);
  s.fill.material.opacity= on? 0.16 : (locked(s)?0.03:0.07); }
function hover(s){ if(s===hov) return; if(hov && hov!==sel) tint(hov,false); hov=s; if(s) tint(s,true);
  for(const t of STATIONS){ t.lbl.classList.toggle('hot',t===s||t===sel); t.item.classList.toggle('hot',t===s); }
  canvas.style.cursor= s? 'pointer' : ''; }

function renderCard(s){
  const c=$('card'), f=FAMILLES[s.famille], L=locked(s), prev=ORDER[ORDER.indexOf(s)-1];
  c.style.setProperty('--fam',f.col);
  c.innerHTML=`<div class="card-head"><span class="num">${s.n}</span><div><p class="kick">${f.nom} · ${s.ref}</p><h2>${s.nom}</h2></div>
      <button type="button" class="x" id="cardX" aria-label="Fermer la fiche">×</button></div>
    <p class="role">${s.role}</p>
    <p class="etat" data-etat="${s.etat}">${ETAT[s.etat]}</p>
    ${ s.etat==='avenir' ? '<p class="note">Ce module n\'est pas encore construit.</p>'
      : L ? `<p class="note lockmsg">${lockSvg}Verrouillée : valider d'abord le module « ${prev?.nom||''} ».</p>`
      : `<a class="go" href="${s.url}" target="_blank" rel="noopener">Ouvrir le simulateur</a>` }
    <button type="button" class="toggle back" id="cardBack">Vue d'ensemble</button>`;
  c.hidden=false;
  $('cardX').onclick=()=>select(null); $('cardBack').onclick=()=>select(null);
}
function select(s){
  if(sel && sel!==hov) tint(sel,false); sel=s;
  for(const t of STATIONS){ t.lbl.classList.toggle('sel',t===s); t.item.setAttribute('aria-pressed',String(t===s)); }
  if(!s){ $('card').hidden=true; const h=home(); fly(h.pos,h.tgt); return; }
  tint(s,true); renderCard(s);
  /* caméra : du côté de l'opérateur de la vue d'ensemble, à une distance qui dépend de la taille de la machine */
  const r=Math.max(s.size.x,s.size.z,1.6), dist=r*1.45+3.4;
  const tgt=new THREE.Vector3(s.center.x,Math.min(1.0,s.size.y*0.45),s.center.z);
  const dir=new THREE.Vector3().subVectors(camera.position,controls.target).setY(0).normalize();
  if(dir.lengthSq()<0.1) dir.set(0.3,0,1).normalize();
  const pos=tgt.clone().addScaledVector(dir,dist*0.82).setY(tgt.y+dist*0.62);
  fly(pos,tgt);
}
let anim=null;
/* déplacement de caméra sur l'horloge réelle (0,9 s), pas sur le nombre d'images */
function fly(pos,tgt){ anim={ p0:camera.position.clone(), t0:controls.target.clone(), p1:pos.clone(), t1:tgt.clone(), start:performance.now()/1000 }; }
const portrait=()=>canvas.clientWidth/canvas.clientHeight<1.05;
/* en portrait, l'atelier est vu depuis la porte (est) : sa longueur suit la hauteur de l'écran */
const home=()=> portrait()? { pos:new THREE.Vector3(17.5,22,3.2), tgt:new THREE.Vector3(0,0,0.2) } : HOME;
$('home').onclick=()=>select(null);

/* clic / toucher dans la 3D (glissé toléré) */
const ray=new THREE.Raycaster(), ptr=new THREE.Vector2(); let down=null;
function hitAt(e){ const r=canvas.getBoundingClientRect(); ptr.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ptr,camera); const h=ray.intersectObjects(pickables,false).find(h=>h.object.visible); return h?.object.userData.station||null; }
canvas.addEventListener('pointerdown',e=>{ down={ x:e.clientX, y:e.clientY, t:e.pointerType }; });
canvas.addEventListener('pointerup',e=>{ if(!down) return; const tol=down.t==='mouse'?5:14; const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y)>tol; down=null; if(moved) return;
  const s=hitAt(e); select(s); });
canvas.addEventListener('pointermove',e=>{ if(e.pointerType!=='mouse'||e.buttons) return; hover(hitAt(e)); });
canvas.addEventListener('pointerleave',()=>hover(null));
addEventListener('keydown',e=>{ if(e.key==='Escape' && sel) select(null); });

/* plein écran */
$('fs').onclick=()=>{ const el=document.documentElement; if(document.fullscreenElement) document.exitFullscreen?.(); else (el.requestFullscreen||el.webkitRequestFullscreen)?.call(el); };

/* ---------- boucle ---------- */
const v=new THREE.Vector3();
function resize(){ const w=canvas.clientWidth, h=canvas.clientHeight; const pr=renderer.getPixelRatio();
  if(canvas.width!==Math.floor(w*pr)||canvas.height!==Math.floor(h*pr)){ renderer.setSize(w,h,false); camera.aspect=w/h;
    camera.fov= w/h>=1.05? 36 : Math.min(62, 2*Math.atan(Math.tan(18*Math.PI/180)*1.15/(w/h))*180/Math.PI); viewOffset(true); } }
/* fiche ouverte sur ordinateur : la scène glisse à gauche pour que la machine choisie ne soit pas sous la fiche */
let offNow=0;
function viewOffset(force){ const w=canvas.clientWidth, h=canvas.clientHeight, card=$('card');
  const want= (!card.hidden && w>900)? Math.min(card.offsetWidth+32, w*0.4)/2 : 0;
  if(!force && Math.abs(want-offNow)<0.5) return; offNow+= force? want-offNow : (want-offNow)*0.18;
  if(Math.abs(want-offNow)<0.5) offNow=want;
  if(offNow) camera.setViewOffset(w,h,offNow,0,w,h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); }
function placeLabels(){ const w=canvas.clientWidth, h=canvas.clientHeight;
  for(const s of STATIONS){ v.set(s.center.x,s.box.max.y+0.35,s.center.z).project(camera);
    const off= v.z>1 || v.x<-1.1 || v.x>1.1 || v.y<-1.1 || v.y>1.1;
    s.lbl.style.visibility= off? 'hidden' : 'visible';
    s.lbl.style.transform=`translate(${(v.x*0.5+0.5)*w}px,${(-v.y*0.5+0.5)*h}px) translate(-50%,-100%)`; } }
let last=performance.now()/1000;
function frame(){ requestAnimationFrame(frame);
  try{ const now=performance.now()/1000, dt=Math.min(0.05,now-last); last=now;
    if(anim){ anim.k=Math.min(1,(now-anim.start)/0.9); const e=anim.k<0.5? 4*anim.k**3 : 1-(-2*anim.k+2)**3/2;
      camera.position.lerpVectors(anim.p0,anim.p1,e); controls.target.lerpVectors(anim.t0,anim.t1,e); if(anim.k>=1) anim=null; }
    resize(); viewOffset(false); controls.update(); flow.tick(now); renderer.render(scene,camera); placeLabels(); }
  catch(err){ console.error(err); } }
canvas.addEventListener('webglcontextlost',e=>{ e.preventDefault(); $('lost').hidden=false; });
$('relaunch').onclick=()=>location.reload();
applyLocks(); resize(); { const h=home(); camera.position.copy(h.pos); controls.target.copy(h.tgt); } frame();
window.__atelier={ STATIONS, select, scene, camera, controls };
window.__ready=true;
