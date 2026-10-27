/* Page « atelier » : entrée visuelle de l'atelier virtuel.
   La salle du plan réel (plan.js) en 3D avec les vrais modèles des machines (buildModel de chaque module, en position de repos),
   la chaîne de débit peinte au sol, une étiquette par poste, une fiche au clic avec le lien vers le simulateur.
   Aperçu élève : machines déverrouillées une à une (dans Moodle, ce sont les restrictions d'accès qui le font).
   Mode « Modifier l'implantation » : glisser-déposer et rotation des machines, cotes des machines sans module,
   ajout et suppression ; disposition gardée dans le navigateur et copiable (même format que plan.js). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STATIONS, FAMILLES, FLOW } from './stations.js';
import { buildHall, buildFlow, decorMachine, HALL, DECOR_MATS, TYPES } from './hall.js';
import { LAYOUT, MODULE_SLOT } from './plan.js';
import { moodleNav, pkg, tocInfo, pkgLock } from '../engine/moodlenav.js';
import { toggleFs, fsOn, onFsChange } from '../engine/fullscreen.js';

const $ = id=>document.getElementById(id);
const ETAT = { service:'En service', essai:'En essai', avenir:'À venir' };
/* dans le paquetage Moodle : pas de modification de l'implantation ni d'aperçu, bilans des machines lus dans le navigateur */
const PKG = pkg();
const bilan=id=>{ try{ return JSON.parse(localStorage.getItem('atelier.bilan.'+id)||'null'); }catch(e){ return null; } };
/* verrous du paquetage : la vérité est le sommaire de Moodle (élément sans lien = prérequis non rempli, statut de son
   icône) ; à défaut (sommaire illisible), le bilan enregistré dans ce navigateur à la fin de chaque évaluation */
const pkgValid=id=>{ const ti=PKG && tocInfo(PKG.titles[id]); if(ti?.status) return ti.status==='passed'||ti.status==='completed'; return !!bilan(id)?.passed; };
const pkgLocked=s=>!!(PKG && pkgLock(s.id));
/* dans le paquetage, l'atelier est un élément SCORM suivi qui reste « incomplete » : Moodle l'ouvre en premier à chaque
   entrée (premier élément non terminé) et il ne compte pas comme machine réussie. Session fermée en partant. */
const atApi=(()=>{ if(!PKG) return null; let w=window, n=0; while(w && !w.API && w.parent && w.parent!==w && n<12){ w=w.parent; n++; }
  const api=w&&w.API; if(!api) return null;
  try{ if(String(api.LMSInitialize(''))!=='true') return null; api.LMSSetValue('cmi.core.lesson_status','incomplete'); api.LMSSetValue('cmi.core.exit','suspend'); api.LMSCommit(''); }catch(e){ return null; }
  let open=true; const close=()=>{ if(!open) return; open=false; try{ api.LMSSetValue('cmi.core.lesson_status','incomplete'); api.LMSCommit(''); api.LMSFinish(''); }catch(e){} };
  addEventListener('pagehide',close); addEventListener('beforeunload',close); return { close }; })();
const DEG = Math.PI/180, UP = new THREE.Vector3(0,1,0);

/* ---------- disposition : celle du plan, ou celle modifiée dans ce navigateur ---------- */
const KEY='atelier.implantation.v1';
const clone=o=>JSON.parse(JSON.stringify(o));
let saved=false;
const lay=(()=>{ const base=clone(LAYOUT);
  try{ const sv=JSON.parse(localStorage.getItem(KEY)||'null');
    if(sv && Array.isArray(sv.machines) && Object.values(MODULE_SLOT).every(id=>sv.machines.some(m=>m.id===id))){
      saved=true; return { ...base, machines:sv.machines.filter(m=>m && m.id && Number.isFinite(+m.x) && Number.isFinite(+m.z)) }; } }
  catch(e){}
  return base; })();
const slotOf=id=>lay.machines.find(m=>m.id===MODULE_SLOT[id]);

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
sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{ left:-14, right:14, top:14, bottom:-14, near:2, far:45 });
sun.shadow.bias=-0.0005; sun.shadow.normalBias=0.03; scene.add(sun);

const camera=new THREE.PerspectiveCamera(36,1,0.25,120);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true; controls.maxPolarAngle=Math.PI*0.47; controls.minDistance=2.5; controls.maxDistance=48;
const HOME={ pos:new THREE.Vector3(3,22,23), tgt:new THREE.Vector3(0,0,-0.3) };
camera.position.copy(HOME.pos); controls.target.copy(HOME.tgt);

/* ---------- hall et postes ---------- */
const hall=buildHall(scene);
const flow=buildFlow(scene, FLOW);

const GREY=new THREE.Color(0xb7bcc0);
const pickables=[];
/* encombrement des parties visibles d'un groupe */
function visBox(g){ const b=new THREE.Box3(); g.updateMatrixWorld(true);
  g.traverse(o=>{ if(!(o.isMesh||o.isLineSegments) || o.userData.drop || o.userData.zone) return; let p=o, vis=true; while(p){ vis=vis&&p.visible; p=p.parent; } if(vis) b.expandByObject(o,true); }); return b; }
/* descente d'aspiration rattachée au groupe : elle suit la machine */
function addDrop(g, x, z, yTop){ for(const m of hall.drop(x,z,yTop)){ m.userData.drop=true; g.attach(m); } }

/* place un poste : le centre de son encombrement sur (x, z) de la disposition, tourné de −rot */
function placeStation(s){ const g=s.group, L=s.slot; s.yaw=-L.rot*DEG; g.rotation.set(0,s.yaw,0);
  const off=s.local.c.clone().setY(0).applyAxisAngle(UP,s.yaw); g.position.set(L.x-off.x,0,L.z-off.z);
  const box=visBox(g); s.box=box; s.center=box.getCenter(new THREE.Vector3()); s.size=box.getSize(new THREE.Vector3()); }

for(const s of STATIONS){
  const g=new THREE.Group(); scene.add(g); s.group=g; s.slot=slotOf(s.id);
  if(s.build){
    const parts={}; const pm=new Proxy(parts,{ get:(t,k)=>t[k]||(t[k]=[]) });
    const tagPart=(o,k)=>{ o.traverse(m=>{ if(m.isMesh) pm[k].push(m); }); return o; };
    try{ const model=s.build({ root:g, tagPart, partMeshes:pm }); s.rest?.(model); }
    catch(e){ console.error(s.id,e); }
    /* organes hors du poste (flexible d'aspiration de la scie à format vers le mur de sa page…) : cachés */
    if(s.clip){ g.updateMatrixWorld(true); const [x0,x1,z0,z1]=s.clip, b=new THREE.Box3(), c=new THREE.Vector3();
      g.traverse(o=>{ if(o.isMesh){ b.setFromObject(o); b.getCenter(c); if(c.x<x0||c.x>x1||c.z<z0||c.z>z1) o.visible=false; } }); }
  } else {
    /* poste à venir : volume fantôme aux cotes de la machine de la disposition */
    const L=s.slot, w=L.l||1, h=L.h||1, d=L.p||1; const ghost=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
      new THREE.MeshStandardMaterial({ color:0x9aa3aa, transparent:true, opacity:0.18, roughness:0.6, depthWrite:false }));
    ghost.position.y=h/2; g.add(ghost);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry), new THREE.LineDashedMaterial({ color:0x6d7780, dashSize:0.12, gapSize:0.08 }));
    edges.position.copy(ghost.position); edges.computeLineDistances(); g.add(edges);
  }
  /* matériaux propres au poste (surbrillance, verrouillage) ; pas de transmission (passe de rendu en plus) */
  const cache=new Map();
  g.traverse(o=>{ if(!o.isMesh) return; o.castShadow=true; o.receiveShadow=true; o.userData.station=s;
    const one=m=>{ if(!cache.has(m)){ const c=m.clone(); if(c.transmission) { c.transmission=0; c.opacity=Math.max(c.opacity,0.35); } c.userData.c0=c.color?.clone(); cache.set(m,c); } return cache.get(m); };
    o.material=Array.isArray(o.material)? o.material.map(one) : one(o.material); pickables.push(o); });
  s.mats=[...cache.values()];
  /* encombrement dans le repère de la machine (organes cachés exclus) */
  const lb=visBox(g), lc=lb.getCenter(new THREE.Vector3()), ls=lb.getSize(new THREE.Vector3()); s.local={ c:lc, s:ls };
  /* zone de travail peinte au sol, dans l'axe de la machine : rectangle à la couleur de la famille */
  const col=new THREE.Color(FAMILLES[s.famille].col), m=0.35;
  const zone=new THREE.Group(); zone.userData.zone=true; g.add(zone); s.zone=zone;
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(ls.x+2*m,ls.z+2*m), new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.07, depthWrite:false, toneMapped:false }));
  fill.rotation.x=-Math.PI/2; fill.position.set(lc.x,0.004,lc.z); fill.renderOrder=1; fill.userData.zone=true; zone.add(fill); s.fill=fill;
  const lineMat=new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.75, toneMapped:false, depthWrite:false });
  const X0=lc.x-ls.x/2-m, X1=lc.x+ls.x/2+m, Z0=lc.z-ls.z/2-m, Z1=lc.z+ls.z/2+m, w=0.06;
  for(const [x,z,lx,lz] of [[(X0+X1)/2,Z0,X1-X0,w],[(X0+X1)/2,Z1,X1-X0,w],[X0,(Z0+Z1)/2,w,Z1-Z0],[X1,(Z0+Z1)/2,w,Z1-Z0]]){
    const l=new THREE.Mesh(new THREE.PlaneGeometry(lx,lz),lineMat); l.rotation.x=-Math.PI/2; l.position.set(x,0.005,z); l.renderOrder=1; l.userData.zone=true; zone.add(l); }
  s.lineMat=lineMat;
  placeStation(s);
  /* disposition du plan (pas encore modifiée) : un module plus long que la machine du plan (rallonges, chariot)
     est ramené dans la salle s'il dépasse un mur ; la disposition garde la place réelle obtenue */
  if(!saved){ const b=s.box, mg=0.15; let dx=0, dz=0;
    if(b.min.x<HALL.x0+mg) dx=HALL.x0+mg-b.min.x; else if(b.max.x>HALL.x1-mg) dx=HALL.x1-mg-b.max.x;
    if(b.min.z<HALL.z0+mg) dz=HALL.z0+mg-b.min.z; else if(b.max.z>HALL.z1-mg) dz=HALL.z1-mg-b.max.z;
    if(dx||dz){ s.slot.x=Math.round((s.slot.x+dx)*20)/20; s.slot.z=Math.round((s.slot.z+dz)*20)/20; placeStation(s); } }
  if(s.build) addDrop(g, s.center.x, s.center.z, s.box.max.y);
}
/* autres machines de la disposition (pas encore de module) : modèles simplifiés, nom au survol */
const moduleIds=new Set(Object.values(MODULE_SLOT));
const DECORS=[];          // { L, g }
let decors=[];            // maillages cliquables
function buildDecor(L){ const g=decorMachine(L); scene.add(g); const d={ L, g };
  g.traverse(o=>{ if(o.isMesh){ o.userData.decor=d; } });
  if((L.l||0)<6){ g.updateMatrixWorld(true); addDrop(g, L.x, L.z, L.h||1.2); }
  return d; }
function refreshDecorPick(){ decors=[]; for(const d of DECORS) d.g.traverse(o=>{ if(o.isMesh && !o.userData.drop) decors.push(o); }); }
for(const L of lay.machines) if(!moduleIds.has(L.id)) DECORS.push(buildDecor(L));
refreshDecorPick();
renderer.shadowMap.needsUpdate=true;

/* ---------- étiquettes ---------- */
const lockSvg='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"/></svg>';
const labels=$('labels');
for(const s of STATIONS){
  const b=document.createElement('button'); b.type='button'; b.className='lbl'; b.dataset.etat=s.etat; b.style.setProperty('--fam',FAMILLES[s.famille].col);
  b.innerHTML=`<span class="num">${s.n}</span><span class="nm">${s.nom}</span><span class="lock">${lockSvg}</span>`;
  b.onclick=()=>editing? edSelect({ s }) : select(s); b.onmouseenter=()=>{ if(!editing) hover(s); }; b.onmouseleave=()=>hover(null);
  labels.appendChild(b); s.lbl=b;
}
/* liste des postes (colonne de gauche) */
const list=$('postes');
for(const s of STATIONS){
  const li=document.createElement('li'); const b=document.createElement('button'); b.type='button'; b.dataset.id=s.id; b.style.setProperty('--fam',FAMILLES[s.famille].col);
  b.innerHTML=`<span class="num">${s.n}</span><span class="tx"><b>${s.nom}</b><small>${s.etat==='avenir'?'Module prévu':s.ref} · ${ PKG && s.etat!=='avenir' ? (b=>b? `<span class="st" data-etat="${b.passed?'service':''}">${b.passed?'validée':'non validée'} · ${b.total}</span>` : '<span class="st">à faire</span>')(bilan(s.id)) : `<span class="st" data-etat="${s.etat}">${ETAT[s.etat].toLowerCase()}</span>`}</small></span><span class="lock">${lockSvg}</span>`;
  b.onclick=()=>editing? edSelect({ s }) : select(s); b.onmouseenter=()=>{ if(!editing) hover(s); }; b.onmouseleave=()=>hover(null);
  li.appendChild(b); list.appendChild(li); s.item=b;
}

/* ---------- aperçu élève : progression ---------- */
const ORDER=STATIONS.filter(s=>s.etat!=='avenir');
let eleve=false, done=0;
const locked=s=>s.etat==='avenir' || (eleve && ORDER.indexOf(s)>done) || pkgLocked(s);
function applyLocks(){
  for(const s of STATIONS){ const L=locked(s), D=(eleve && ORDER.indexOf(s)>=0 && ORDER.indexOf(s)<done) || !!(PKG && pkgValid(s.id));
    s.lbl.dataset.locked=String(L); s.item.dataset.locked=String(L); s.lbl.dataset.done=String(D); s.item.dataset.done=String(D);
    for(const m of s.mats){ if(!m.userData.c0) continue; m.color.copy(m.userData.c0); if(L && s.build) m.color.lerp(GREY,0.72); }
    s.fill.material.opacity= L? 0.03 : 0.07; s.lineMat.opacity= L? 0.3 : 0.75; }
  $('prog').hidden=!eleve; $('progN').textContent=`${done} / ${ORDER.length}`;
  $('progBar').style.width=`${100*done/ORDER.length}%`;
  if(sel) renderCard(sel);
}
const setVersion=v=>{ eleve=v; $('eleve').setAttribute('aria-pressed',String(v)); $('vWeb').setAttribute('aria-pressed',String(!v)); applyLocks(); };
$('eleve').onclick=()=>setVersion(true); $('vWeb').onclick=()=>setVersion(false);
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
  const c=$('card'), f=FAMILLES[s.famille], L=locked(s), prev= PKG?.prereq?.[s.id] ? STATIONS.find(t=>t.id===PKG.prereq[s.id]) : ORDER[ORDER.indexOf(s)-1];
  c.style.setProperty('--fam',f.col);
  c.innerHTML=`<div class="card-head"><span class="num">${s.n}</span><div><p class="kick">${f.nom} · ${s.ref}</p><h2>${s.nom}</h2></div>
      <button type="button" class="x" id="cardX" aria-label="Fermer la fiche">×</button></div>
    <p class="role">${s.role}</p>
    <p class="etat" data-etat="${s.etat}">${ETAT[s.etat]}</p>
    ${ s.etat==='avenir' ? '<p class="note">Ce module n\'est pas encore construit.</p>'
      : L ? `<p class="note lockmsg">${lockSvg}Verrouillée : valider d'abord le module « ${prev?.nom||''} ».</p>`
      : PKG ? `${(b=>b? `<p class="etat" data-etat="${b.passed?'service':''}">${b.passed?'Validée':'Non validée'} · ${b.total} / 100 · ${b.date}</p>`:'')(bilan(s.id))}<button type="button" class="go" id="cardGo">Ouvrir la machine</button>`
      : `<a class="go" href="${s.url}" target="_blank" rel="noopener">Ouvrir le simulateur</a>` }
    <button type="button" class="toggle back" id="cardBack">Vue d'ensemble</button>`;
  c.hidden=false;
  $('cardX').onclick=()=>select(null); $('cardBack').onclick=()=>select(null);
  const go=$('cardGo'); if(go) go.onclick=()=>{ if(!moodleNav(PKG.titles[s.id],{ before:()=>atApi?.close() })) flash(`Choisissez « ${PKG.titles[s.id]} » dans le sommaire du cours.`); };
}
function select(s){
  if(sel && sel!==hov) tint(sel,false); sel=s;
  for(const t of STATIONS){ t.lbl.classList.toggle('sel',t===s); t.item.setAttribute('aria-pressed',String(t===s)); }
  const op= s? 0.22 : 1; for(const m of DECOR_MATS.concat(hall.drops.map(d=>d.material))){ m.opacity=op; m.depthWrite=op===1; }
  for(const d of decors) d.castShadow=!s; renderer.shadowMap.needsUpdate=true;
  if(editing) return;
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
/* en portrait, la salle (carrée) est vue de plus haut */
const home=()=> portrait()? { pos:new THREE.Vector3(0.5,31,14), tgt:new THREE.Vector3(0,0,0.5) } : HOME;
$('home').onclick=()=>select(null);

/* clic / toucher dans la 3D (glissé toléré) */
const ray=new THREE.Raycaster(), ptr=new THREE.Vector2(); let down=null;
function hitAt(e){ const r=canvas.getBoundingClientRect(); ptr.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ptr,camera); const h=ray.intersectObjects(pickables.concat(decors),false).find(h=>h.object.visible);
  if(!h) return null; if(h.object.userData.station) return h.object.userData.station; return { decor:h.object.userData.decor.L, d:h.object.userData.decor }; }
/* bulle au survol d'une machine sans module */
function tip(e,d){ const t=$('tip'); if(!d){ t.hidden=true; return; } const r=canvas.getBoundingClientRect();
  t.textContent=`${d.nom} · pas encore de module`; t.style.left=(e.clientX-r.left)+'px'; t.style.top=(e.clientY-r.top)+'px'; t.hidden=false; }
canvas.addEventListener('pointerdown',e=>{ down={ x:e.clientX, y:e.clientY, t:e.pointerType }; if(editing) edDown(e); },{ capture:true });
canvas.addEventListener('pointerup',e=>{ if(editing){ edUp(e); down=null; return; } if(!down) return; const tol=down.t==='mouse'?5:14; const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y)>tol; down=null; if(moved) return;
  const s=hitAt(e); if(s?.decor){ tip(e,s.decor); clearTimeout(tipT); tipT=setTimeout(()=>tip(e,null),2200); return; } tip(e,null); select(s); });
let tipT=0;
canvas.addEventListener('pointermove',e=>{ if(editing){ edMove(e); return; } if(e.pointerType!=='mouse'||e.buttons) return; const s=hitAt(e); tip(e,s?.decor); hover(s?.decor? null : s); });
canvas.addEventListener('pointerleave',()=>{ hover(null); tip(null,null); });
addEventListener('keydown',e=>{ if(editing){ edKey(e); return; } if(e.key==='Escape' && sel) select(null); });

/* ---------- modifier l'implantation ---------- */
let editing=false, esel=null, drag=null, topView=true;
const RXm=HALL.x1-0.2, RZm=HALL.z1-0.2;
const itemL=it=> it.s? it.s.slot : it.d.L;
const itemName=it=> it.s? it.s.nom : it.d.L.nom;
const snap=v=>Math.round(v*20)/20, r1=v=>Math.round(v*10)/10, r2=v=>Math.round(v*100)/100;
function placeItem(it){ const L=itemL(it);
  if(it.s) placeStation(it.s); else { it.d.g.position.set(L.x,0,L.z); it.d.g.rotation.set(0,-L.rot*DEG,0); }
  placeRing(); renderer.shadowMap.needsUpdate=true; }
/* anneau orange au sol autour de la machine choisie */
const ring=new THREE.Mesh(new THREE.RingGeometry(0.95,1,64), new THREE.MeshBasicMaterial({ color:0xd27a1c, toneMapped:false, transparent:true, depthWrite:false }));
ring.rotation.x=-Math.PI/2; ring.position.y=0.012; ring.renderOrder=3; ring.visible=false; scene.add(ring);
function placeRing(){ if(!esel){ ring.visible=false; return; } ring.visible=true; const L=itemL(esel);
  const r= esel.s? Math.max(esel.s.local.s.x,esel.s.local.s.z)/2+0.3 : Math.max(L.l||1.6,L.p||1)/2+0.3;
  const c= esel.s? esel.s.center : new THREE.Vector3(L.x,0,L.z); ring.position.set(c.x,0.012,c.z); ring.scale.set(r,r,1); }
/* disposition exportée : même format que LAYOUT dans plan.js */
function layoutJSON(){ return { salle:lay.salle, machines:lay.machines.map(m=>({ id:m.id, nom:m.nom, type:m.type, x:r2(m.x), z:r2(m.z), rot:Math.round(m.rot),
  ...(m.l>0&&m.h>0&&m.p>0? { l:m.l, h:m.h, p:m.p } : {}) })), murs:lay.murs }; }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify({ machines:layoutJSON().machines })); saved=true; }catch(e){}
  const t=$('edOut'); if(t) t.value=JSON.stringify(layoutJSON()); }
/* étiquettes des machines sans module, en mode modification */
function decorPins(on){ for(const d of DECORS){ if(!d.pin){ const e=document.createElement('button'); e.type='button'; e.className='dlbl'; e.onclick=()=>edSelect({ d }); labels.appendChild(e); d.pin=e; }
    d.pin.textContent=d.L.nom; d.pin.hidden=!on; } }
function setTop(on){ topView=on; const b1=$('edTop'), b2=$('ed3d'); b1?.setAttribute('aria-pressed',String(on)); b2?.setAttribute('aria-pressed',String(!on));
  controls.enableRotate=!on; controls.mouseButtons.LEFT= on? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE; controls.touches.ONE= on? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  controls.screenSpacePanning=!on;
  if(on){ /* toute la salle à l'écran, dans la part de la vue que le panneau de modification laisse libre */
    const W=canvas.clientWidth, H=canvas.clientHeight, wide=W>900, t=Math.tan(camera.fov*DEG/2), asp=W/Math.max(H,1);
    const fw= wide? Math.max(0.3,(W-352)/W) : 1, fh= wide? 1 : 0.5;          // part libre en largeur / en hauteur
    const need=Math.max((HALL.z1-HALL.z0+2.5)/2/(t*fh), (HALL.x1-HALL.x0+3)/2/(t*asp*fw));
    const tz= wide? 0 : need*t*(1-fh);                                      // téléphone : la salle dans la moitié haute
    fly(new THREE.Vector3(0, need, tz+0.01), new THREE.Vector3(0,0,tz)); }
  else { const hm=home(); fly(hm.pos,hm.tgt); } }

function edPanel(){ const c=$('edit'), it=esel;
  const L=it? itemL(it) : null, isMod=!!it?.s;
  c.innerHTML=`<div class="ed-head"><h2>Modifier l'implantation</h2><button type="button" class="x" id="edX" aria-label="Terminer">×</button></div>
    <div class="vseg" role="group" aria-label="Vue"><button class="toggle" type="button" id="edTop" aria-pressed="${topView}">Dessus</button><button class="toggle" type="button" id="ed3d" aria-pressed="${!topView}">3D</button></div>
    <section class="ed-sel">${ !it ? `<p class="note">Touchez une machine pour la choisir, puis glissez-la. Touchez le sol vide pour la lâcher.</p>` : `
      <p class="kick">${isMod? `Module · ${it.s.ref}` : 'Machine sans module'}</p>
      ${isMod? `<h3>${it.s.nom}</h3>` : `<label>Nom<input type="text" id="edName" maxlength="60"></label>
        <label>Modèle<select id="edType">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${k===L.type?'selected':''}>${v}</option>`).join('')}</select></label>`}
      <div class="ed-rot"><button class="toggle" type="button" data-r="-90" title="Tourner de 90° vers la gauche">↺ 90°</button><button class="toggle" type="button" data-r="-15" title="Tourner de 15° vers la gauche (Maj + R)">↺ 15°</button><button class="toggle" type="button" data-r="15" title="Tourner de 15° vers la droite (R)">↻ 15°</button><button class="toggle" type="button" data-r="90" title="Tourner de 90° vers la droite">↻ 90°</button></div>
      <div class="ed-row3"><label>X (m)<input type="number" id="edX_" step="0.1"></label><label>Z (m)<input type="number" id="edZ_" step="0.1"></label><label>Angle (°)<input type="number" id="edR_" step="1"></label></div>
      ${isMod? `<p class="note">Le modèle 3D est celui du simulateur : ses cotes ne se changent pas ici.</p>` : `
      <div class="ed-row3"><label>Longueur<input type="number" id="edL" min="0.1" max="20" step="0.05"></label><label>Hauteur<input type="number" id="edH" min="0.1" max="6" step="0.05"></label><label>Profondeur<input type="number" id="edP" min="0.1" max="20" step="0.05"></label></div>
      <p class="note">Cotes en mètres. Longueur : de gauche à droite quand la machine est à 0°.</p>
      <button class="toggle" type="button" id="edDel">Supprimer cette machine</button>`}`}
    </section>
    <section class="ed-acts">
      <button class="toggle" type="button" id="edAdd">+ Ajouter une machine</button>
      <button class="toggle main" type="button" id="edCopy">Copier la disposition</button>
      <textarea id="edOut" readonly aria-label="Disposition à copier"></textarea>
      <p class="note">${saved? 'Disposition modifiée, gardée dans ce navigateur.' : 'Disposition du plan.'} Pour qu'elle serve à tous, copiez-la et collez-la dans la discussion avec Claude. La chaîne de débit peinte au sol ne suit pas les déplacements.</p>
      <button class="toggle" type="button" id="edReset">Revenir au plan d'origine</button>
    </section>`;
  c.hidden=false;
  $('edX').onclick=()=>setEditing(false);
  $('edTop').onclick=()=>setTop(true); $('ed3d').onclick=()=>setTop(false);
  $('edOut').value=JSON.stringify(layoutJSON());
  $('edAdd').onclick=edAdd; $('edCopy').onclick=edCopy;
  $('edReset').onclick=()=>{ const b=$('edReset'); if(b.dataset.arm!=='1'){ b.dataset.arm='1'; b.textContent='Confirmer : effacer mes modifications'; return; }
    try{ localStorage.removeItem(KEY); }catch(e){} location.reload(); };
  if(!it) return;
  c.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>edRotate(+b.dataset.r));
  for(const [id,k] of [['edX_','x'],['edZ_','z'],['edR_','rot']]) $(id).onchange=e=>{ const v=parseFloat(e.target.value); if(!Number.isFinite(v)) return edSync();
    L[k]= k==='rot'? ((Math.round(v)%360)+360)%360 : Math.max(k==='x'?-RXm:-RZm, Math.min(k==='x'?RXm:RZm, snap(v))); placeItem(it); edSync(); save(); };
  if(!isMod){
    $('edName').value=L.nom; $('edName').oninput=e=>{ L.nom=e.target.value||'Sans nom'; if(it.d.pin) it.d.pin.textContent=L.nom; save(); };
    $('edType').onchange=e=>{ L.type=e.target.value; edRebuild(it); save(); };
    for(const [id,k] of [['edL','l'],['edH','h'],['edP','p']]){ $(id).value=L[k]??''; $(id).onchange=e=>{ const v=parseFloat(e.target.value);
      if(v>=0.1&&v<=20){ L[k]=Math.round(v*100)/100; if(!(L.l>0&&L.h>0&&L.p>0)){ L.l=L.l||1.6; L.h=L.h||1.1; L.p=L.p||1.0; } edRebuild(it); save(); } else e.target.value=L[k]??''; }; }
    $('edDel').onclick=()=>{ const b=$('edDel'); if(b.dataset.arm!=='1'){ b.dataset.arm='1'; b.textContent='Confirmer la suppression'; return; }
      scene.remove(it.d.g); it.d.pin?.remove(); DECORS.splice(DECORS.indexOf(it.d),1); lay.machines.splice(lay.machines.indexOf(L),1); refreshDecorPick(); edSelect(null); save(); };
  }
  edSync(); }
function edSync(){ if(!esel||!$('edX_')) return; const L=itemL(esel);
  for(const [id,v] of [['edX_',r2(L.x)],['edZ_',r2(L.z)],['edR_',Math.round(L.rot)]]) if(document.activeElement?.id!==id) $(id).value=v; }
function edSelect(it){ esel=it; placeRing(); edPanel();
  for(const t of STATIONS) t.lbl.classList.toggle('sel', !!it && it.s===t);
  for(const d of DECORS) d.pin?.classList.toggle('sel', !!it && it.d===d); }
function edRotate(da){ if(!esel) return; const L=itemL(esel); L.rot=((Math.round(L.rot+da)%360)+360)%360; placeItem(esel); edSync(); save(); }
function edRebuild(it){ const i=DECORS.indexOf(it.d), pin=it.d.pin; scene.remove(it.d.g); const d=buildDecor(it.d.L); d.pin=pin; DECORS[i]=d; it.d=d;
  refreshDecorPick(); placeItem(it); }
function edAdd(){ let n=1; while(lay.machines.some(m=>m.id==='ajout'+n)) n++;
  const t=controls.target, L={ id:'ajout'+n, nom:'Nouvelle machine '+n, type:'bloc', x:snap(t.x), z:snap(t.z), rot:0, l:1.6, h:1.1, p:1.0 };
  lay.machines.push(L); const d=buildDecor(L); DECORS.push(d); refreshDecorPick(); decorPins(true); edSelect({ d }); save(); }
async function edCopy(){ save(); const t=$('edOut'); try{ await navigator.clipboard.writeText(t.value); flash('Disposition copiée : collez-la dans la discussion.'); }
  catch(e){ t.focus(); t.select(); flash('Copie automatique refusée : le texte est sélectionné, faites Ctrl+C.'); } }
let flashT=0; function flash(txt){ const e=$('tip'); e.textContent=txt; e.style.left='50%'; e.style.top='56px'; e.classList.add('flash'); e.hidden=false; clearTimeout(flashT); flashT=setTimeout(()=>{ e.hidden=true; e.classList.remove('flash'); },2800); }
/* glisser-déposer sur le sol */
const floorPlane=new THREE.Plane(UP,0), fp=new THREE.Vector3();
function floorAt(e){ const r=canvas.getBoundingClientRect(); ptr.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1); ray.setFromCamera(ptr,camera); return ray.ray.intersectPlane(floorPlane,fp); }
function edDown(e){ const h=hitAt(e); if(!h) return; const it= h.decor? { d:h.d } : { s:h }; if(!esel || (esel.s||esel.d)!==(it.s||it.d)) edSelect(it);
  if(!floorAt(e)) return; const L=itemL(esel); drag={ dx:L.x-fp.x, dz:L.z-fp.z, id:e.pointerId, moved:false };
  controls.enabled=false; canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing'; }
function edMove(e){ if(!drag){ if(e.pointerType==='mouse'&&!e.buttons) canvas.style.cursor= hitAt(e)? 'grab' : ''; return; }
  if(e.pointerId!==drag.id || !floorAt(e)) return; const L=itemL(esel);
  L.x=Math.max(-RXm,Math.min(RXm,snap(fp.x+drag.dx))); L.z=Math.max(-RZm,Math.min(RZm,snap(fp.z+drag.dz))); drag.moved=true; placeItem(esel); edSync(); }
function edUp(e){ if(drag){ const m=drag.moved; drag=null; controls.enabled=true; canvas.style.cursor=''; if(m) save(); return; }
  if(down && Math.hypot(e.clientX-down.x,e.clientY-down.y)<=(down.t==='mouse'?5:14) && !hitAt(e)) edSelect(null); }
function edKey(e){ if(/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
  if(e.key==='Escape'){ esel? edSelect(null) : setEditing(false); return; }
  if(!esel) return; const L=itemL(esel), st=e.shiftKey? 0.5 : 0.1;
  if(e.key==='r'||e.key==='R'){ edRotate(e.shiftKey? -15 : 15); e.preventDefault(); return; }
  const mv={ ArrowLeft:[-st,0], ArrowRight:[st,0], ArrowUp:[0,-st], ArrowDown:[0,st] }[e.key]; if(!mv) return;
  e.preventDefault(); L.x=Math.max(-RXm,Math.min(RXm,snap(L.x+mv[0]))); L.z=Math.max(-RZm,Math.min(RZm,snap(L.z+mv[1]))); placeItem(esel); edSync(); save(); }
function setEditing(on){ if(on===editing) return; if(on) select(null); editing=on; $('editBtn').setAttribute('aria-pressed',String(on));
  document.body.classList.toggle('editing',on); $('help').textContent= on? 'Glisser une machine pour la déplacer · R : tourner de 15° · flèches : 10 cm' : 'Glisser pour tourner · molette ou pincement pour zoomer · clic sur une machine';
  decorPins(on); if(on){ edSelect(null); setTop(true); } else { esel=null; drag=null; ring.visible=false; $('edit').hidden=true; controls.enabled=true;
    for(const t of STATIONS) t.lbl.classList.remove('sel'); setTop(false); controls.enableRotate=true; controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE; controls.touches.ONE=THREE.TOUCH.ROTATE; controls.screenSpacePanning=true; } }
$('editBtn').onclick=()=>setEditing(!editing);

/* plein écran */
$('fs').onclick=()=>{ toggleFs().catch(()=>flash('Plein écran indisponible dans cet affichage : utilisez la touche F11.')); };
onFsChange(()=>$('fs').setAttribute('aria-pressed',String(fsOn())));

/* ---------- boucle ---------- */
const v=new THREE.Vector3();
function resize(){ const w=canvas.clientWidth, h=canvas.clientHeight; const pr=renderer.getPixelRatio();
  if(canvas.width!==Math.floor(w*pr)||canvas.height!==Math.floor(h*pr)){ renderer.setSize(w,h,false); camera.aspect=w/h;
    camera.fov= w/h>=1.05? 36 : Math.min(62, 2*Math.atan(Math.tan(18*Math.PI/180)*1.15/(w/h))*180/Math.PI); viewOffset(true); } }
/* fiche ouverte sur ordinateur : la scène glisse à gauche pour que la machine choisie ne soit pas sous la fiche */
let offNow=0;
function viewOffset(force){ const w=canvas.clientWidth, h=canvas.clientHeight, card=$('card'), ed=$('edit');
  const pan= !card.hidden? card : !ed.hidden? ed : null;
  const want= (pan && w>900)? Math.min(pan.offsetWidth+32, w*0.4)/2 : 0;
  if(!force && Math.abs(want-offNow)<0.5) return; offNow+= force? want-offNow : (want-offNow)*0.18;
  if(Math.abs(want-offNow)<0.5) offNow=want;
  if(offNow) camera.setViewOffset(w,h,offNow,0,w,h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); }
function placeLabels(){ const w=canvas.clientWidth, h=canvas.clientHeight;
  for(const s of STATIONS){ v.set(s.center.x,s.box.max.y+0.35,s.center.z).project(camera);
    const off= v.z>1 || v.x<-1.1 || v.x>1.1 || v.y<-1.1 || v.y>1.1;
    s.lbl.style.visibility= off? 'hidden' : 'visible';
    s.lbl.style.transform=`translate(${(v.x*0.5+0.5)*w}px,${(-v.y*0.5+0.5)*h}px) translate(-50%,-100%)`; }
  if(editing) for(const d of DECORS){ if(!d.pin) continue; v.set(d.L.x,(d.L.h||1.2)+0.15,d.L.z).project(camera);
    const off= v.z>1 || Math.abs(v.x)>1.1 || Math.abs(v.y)>1.1; d.pin.style.visibility= off? 'hidden' : 'visible';
    d.pin.style.transform=`translate(${(v.x*0.5+0.5)*w}px,${(-v.y*0.5+0.5)*h}px) translate(-50%,-50%)`; } }
let last=performance.now()/1000;
function frame(){ requestAnimationFrame(frame);
  try{ const now=performance.now()/1000, dt=Math.min(0.05,now-last); last=now;
    if(anim){ anim.k=Math.min(1,(now-anim.start)/0.9); const e=anim.k<0.5? 4*anim.k**3 : 1-(-2*anim.k+2)**3/2;
      camera.position.lerpVectors(anim.p0,anim.p1,e); controls.target.lerpVectors(anim.t0,anim.t1,e); if(anim.k>=1) anim=null; }
    resize(); viewOffset(false); controls.update(); flow.tick(now); renderer.render(scene,camera); placeLabels(); }
  catch(err){ console.error(err); } }
canvas.addEventListener('webglcontextlost',e=>{ e.preventDefault(); $('lost').hidden=false; });
$('relaunch').onclick=()=>location.reload();
if(PKG){ $('editBtn').hidden=true; document.querySelector('.vseg').hidden=true; }
applyLocks(); resize(); { const h=home(); camera.position.copy(h.pos); controls.target.copy(h.tgt); } frame();
window.__atelier={ STATIONS, DECORS, lay, select, scene, camera, controls, setEditing, edSelect, edRotate, layoutJSON, get esel(){ return esel; } };
window.__ready=true;
