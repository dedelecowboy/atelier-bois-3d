/* Scène 3D commune : rendu, caméra et vues, lumières, boucle d'affichage, perte de contexte WebGL,
   plein écran et messages flottants (toast). */
import * as THREE from 'three';
import { toggleFs, fsOn, onFsChange } from './fullscreen.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = id=>document.getElementById(id);

export function createStage(views, opt={}){
  /* opt (facultatif, config.stage) : grande scène (atelier entier) : { fov, far, minDistance, maxDistance, maxPolar, shadow:{ ext, size }, sun:[x,y,z], floor:false } */
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; // ombres recalculées seulement quand quelque chose bouge
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000,0); // fond transparent : la couleur vient de la feuille de style (.stage)

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const FOV = opt.fov||34;
  const camera = new THREE.PerspectiveCamera(FOV, 1, opt.near||0.05, opt.far||60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.maxPolarAngle = opt.maxPolar||Math.PI*0.49; controls.minDistance = opt.minDistance||0.12; controls.maxDistance = opt.maxDistance||14;
  const VIEWS = Object.fromEntries(views.map(v=>[v.id,v]));
  function setView(k){ const v=VIEWS[k]; camera.position.set(...v.pos); controls.target.set(...v.tgt); controls.update(); }
  function setCam(pos,tgt){ camera.position.set(...pos); controls.target.set(...tgt); controls.update(); }
  setView(views[0].id);

  // lumières et sol (ombres portées)
  scene.add(new THREE.HemisphereLight(0xffffff,0x8a8f94,0.55));
  const sun = new THREE.DirectionalLight(0xffffff,1.6);
  sun.position.set(...(opt.sun||[2.5,6,4])); sun.castShadow = true;
  { const e=opt.shadow?.ext||4, z=opt.shadow?.size||1536; sun.shadow.mapSize.set(z,z); Object.assign(sun.shadow.camera,{left:-e,right:e,top:e,bottom:-e,near:1,far:opt.shadow?.far||15}); } sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.02;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.ShadowMaterial({opacity:0.18}));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; if(opt.floor!==false) scene.add(floor);

  const root = new THREE.Group(); scene.add(root); // tout ce qui peut être cliqué

  /* en portrait, le champ vertical s'élargit (55° max) pour que la machine tienne à l'écran */
  function resize(){ const w=canvas.clientWidth,h=canvas.clientHeight; if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){ renderer.setSize(w,h,false); camera.aspect=w/h; { const a=w/h, k=Math.tan(17*Math.PI/180)*1.05; camera.fov= a>=1.05? FOV : Math.min(55, 2*Math.atan(Math.tan(FOV/2*Math.PI/180)*1.05/a)*180/Math.PI); } camera.updateProjectionMatrix(); } }

  /* boucle : tick(dt, now) fourni par la machine ; le rendu ne doit jamais casser la page */
  function run(tick){ let last=performance.now()/1000;
    function frame(){ requestAnimationFrame(frame); try{
      const now=performance.now()/1000, dt=Math.min(0.05,now-last); last=now;
      tick(dt,now); resize(); controls.update(); renderer.render(scene,camera); }catch(err){ console.error(err); } }
    frame(); }

  /* perte de contexte WebGL (carte graphique) */
  function onContext(restored){
    const lost=$('lost');
    canvas.addEventListener('webglcontextlost',e=>{ e.preventDefault(); lost.hidden=false; });
    canvas.addEventListener('webglcontextrestored',()=>{ lost.hidden=true; restored(); renderer.shadowMap.needsUpdate=true; });
    $('relaunch').onclick=()=>location.reload(); }

  /* message flottant */
  let toastT=0;
  function toast(html,ms=4500){ const t=$('toast'); t.innerHTML=html; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,ms); }

  /* plein écran (dans le paquetage unique : le lecteur Moodle entier, voir fullscreen.js) */
  $('fs').onclick=async()=>{ try{ await toggleFs(); }
    catch(e){ toast('Plein écran indisponible dans cet affichage. Ouvrez la page dans un nouvel onglet du navigateur, ou utilisez la touche <kbd>F11</kbd>.',6000); } };
  function onFs(){ const on=fsOn(); $('fs').setAttribute('aria-pressed',String(on)); $('fs').textContent=on?'⛶ Quitter':'⛶';
    if(on) toast('Plein écran : appuyez sur <kbd>Échap</kbd> (ou <kbd>Esc</kbd>) pour quitter.'); }
  onFsChange(onFs); onFs();

  return { THREE, canvas, renderer, scene, camera, controls, root, VIEWS, setView, setCam, resize, run, onContext, toast,
    dirty(){ renderer.shadowMap.needsUpdate=true; } };
}
