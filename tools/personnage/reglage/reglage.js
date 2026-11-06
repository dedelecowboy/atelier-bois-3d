/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Outil de réglage des EPI sur les élèves des risques généraux (demandé par l'enseignant le 06/11/2026).
   Même code que le jeu (machines/risques/figures.js) : ce qu'on voit ici est ce que verront les élèves.
   Les réglages se copient (JSON) et se collent dans la discussion : ils vont dans machines/risques/reglages_epi.json. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { person, setEpi, setPose, REGLAGES, OBJETS, defaut, reglage, placerObjets } from '../../../machines/risques/figures.js';

const ELEVES={ equipe:{ nom:'Garçon · tenue d’atelier', o:{ hair:'court', epi:['tenue','chaussures'] } },
  mal:{ nom:'Garçon · mal équipé', o:{ hair:'court', epi:[] } },
  fille:{ nom:'Fille · queue de cheval', o:{ hair:'attache', epi:['tenue','chaussures'] } },
  fille_mal:{ nom:'Fille · cheveux détachés', o:{ hair:'long', epi:[] } } };
const NOMS={ casque:'Casque antibruit', lunettes:'Lunettes', ffp2:'Masque FFP2', demimasque:'Demi-masque', echarpe:'Écharpe', bracelet:'Bracelet' };
const CODE={ casque:'auditif', lunettes:'lunettes', ffp2:'masque', demimasque:'masque_a' };
const POSES={ debout:'Debout', machine:'À la machine', soufflette:'Soufflette', aspire:'Aspirateur', dos_courbe:'Dos courbé' };
const CLE='atelier.reglage_epi';
const $=s=>document.querySelector(s);

/* réglages gardés dans le navigateur (en plus de ceux du fichier) */
try{ const m=JSON.parse(localStorage.getItem(CLE)||'null'); if(m) for(const [q,v] of Object.entries(m)) REGLAGES[q]={ ...(REGLAGES[q]||{}), ...v }; }catch(e){}
const garder=()=>{ try{ localStorage.setItem(CLE,JSON.stringify(REGLAGES)); }catch(e){} };

/* scène */
const cv=$('#vue'), r=new THREE.WebGLRenderer({ canvas:cv, antialias:true });
r.outputColorSpace=THREE.SRGBColorSpace; r.toneMapping=THREE.ACESFilmicToneMapping; r.setPixelRatio(Math.min(2,devicePixelRatio));
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xdcdfe2);
scene.add(new THREE.HemisphereLight(0xffffff,0x8a8070,1.5)); const sun=new THREE.DirectionalLight(0xffffff,2); sun.position.set(2,4,5); scene.add(sun);
const sol=new THREE.Mesh(new THREE.CircleGeometry(1.2,48),new THREE.MeshStandardMaterial({ color:0xc8c2b8 })); sol.rotation.x=-Math.PI/2; scene.add(sol);
const cam=new THREE.PerspectiveCamera(30,1,0.02,30), ctl=new OrbitControls(cam,cv); ctl.enableDamping=true;

const etat={ eleve:'fille', objet:'casque', pose:'debout', autres:false, prop:true };
let perso=null;
function construire(){ if(perso) scene.remove(perso); const E=ELEVES[etat.eleve];
  perso=person({ ...E.o, pose:etat.pose }); scene.add(perso); habiller(); }
function habiller(){ const E=ELEVES[etat.eleve], on=new Set(etat.autres? OBJETS : [etat.objet]);
  const epi=[...E.o.epi]; for(const [k,c] of Object.entries(CODE)) if(on.has(k)) epi.push(c);
  if(etat.autres && on.has('ffp2') && on.has('demimasque')) epi.splice(epi.indexOf(etat.objet==='ffp2'? 'masque_a' : 'masque'),1);   // un seul masque à la fois
  setEpi(perso,{ ...E.o, epi, echarpe:on.has('echarpe'), bijoux:on.has('bracelet') }); }
function cible(){ const P=perso.userData.P, os=P.B[{ echarpe:'Neck', bracelet:'RightHand' }[etat.objet]||'Head'];
  perso.updateMatrixWorld(true); const c=os.getWorldPosition(new THREE.Vector3()); if(!['echarpe','bracelet'].includes(etat.objet)) c.y+=0.08; return c; }
function vue(n){ const c=cible(), d=etat.objet==='echarpe'? 1.7 : etat.objet==='bracelet'? 0.9 : 1.45;
  const dir={ face:[0,0,1], profil:[1,0,0], gauche:[-1,0,0], dessus:[0,1,0.01], trois:[0.7,0.25,0.7], dos:[0,0,-1] }[n];
  const v=new THREE.Vector3(...dir).normalize().multiplyScalar(d); cam.position.copy(c).add(v); ctl.target.copy(c); ctl.update(); }

/* panneau */
const CHAMPS=[ ['d',0,'Largeur','mm',10,700], ['d',1,'Hauteur','mm',10,700], ['d',2,'Profondeur','mm',10,700],
  ['t',0,'Gauche ↔ droite','mm',-400,400], ['t',1,'Hauteur depuis le sol','mm',0,1900], ['t',2,'Arrière ↔ avant','mm',-400,400],
  ['r',0,'Bascule avant / arrière','°',-180,180], ['r',1,'Tourner (gauche / droite)','°',-180,180], ['r',2,'Pencher sur le côté','°',-180,180] ];
function lire(){ return JSON.parse(JSON.stringify(reglage(perso.userData.P,etat.objet))); }
function ecrire(R){ const q=perso.userData.P.qui; (REGLAGES[q]||(REGLAGES[q]={}))[etat.objet]=R; placerObjets(perso); garder(); remplir(); }
function remplir(){ const R=lire(), q=perso.userData.P.qui, regle=!!REGLAGES[q]?.[etat.objet];
  for(const [g,i] of CHAMPS){ const id=`${g}${i}`; $('#n_'+id).value=R[g][i]; $('#s_'+id).value=R[g][i]; }
  $('#etat').textContent= regle? 'Réglé' : 'Valeurs de départ'; $('#etat').dataset.regle=regle; }
function champ(g,i,nom,u,min,max){ const id=`${g}${i}`;
  return `<div class="ch"><label for="n_${id}">${nom}</label><div class="lg"><button type="button" class="pas" data-id="${id}" data-d="-1" aria-label="${nom} moins">−</button>
    <input type="range" id="s_${id}" min="${min}" max="${max}" step="1"><button type="button" class="pas" data-id="${id}" data-d="1" aria-label="${nom} plus">+</button>
    <input type="number" id="n_${id}" step="1"><span class="u">${u}</span></div></div>`; }
$('#reglages').innerHTML=`<fieldset><legend>Dimensions de l’objet</legend>${CHAMPS.slice(0,3).map(c=>champ(...c)).join('')}
  <label class="cc"><input type="checkbox" id="prop" checked> Garder les proportions</label></fieldset>
  <fieldset><legend>Position du centre</legend>${CHAMPS.slice(3,6).map(c=>champ(...c)).join('')}</fieldset>
  <fieldset><legend>Rotation</legend>${CHAMPS.slice(6).map(c=>champ(...c)).join('')}</fieldset>`;
function changer(id,v){ const g=id[0], i=+id[1], R=lire(); v=Math.round(+v); if(!isFinite(v)) return;
  if(g==='d' && etat.prop){ const k=v/R.d[i]; R.d=R.d.map((x,j)=> j===i? v : Math.max(1,Math.round(x*k))); } else R[g][i]=v;
  ecrire(R); }
for(const [g,i] of CHAMPS){ const id=`${g}${i}`; $('#s_'+id).oninput=e=>changer(id,e.target.value); $('#n_'+id).onchange=e=>changer(id,e.target.value); }
document.querySelectorAll('.pas').forEach(b=>b.onclick=e=>{ const id=b.dataset.id, R=lire(), v=R[id[0]][+id[1]]+(+b.dataset.d)*(e.shiftKey? 10 : 1); changer(id,v); });
$('#prop').onchange=e=>etat.prop=e.target.checked;

const sel=(id,obj,cle)=>{ const s=$(id); s.innerHTML=Object.entries(obj).map(([k,v])=>`<option value="${k}">${typeof v==='string'? v : v.nom}</option>`).join(''); s.value=etat[cle];
  s.onchange=()=>{ etat[cle]=s.value; if(cle==='objet'){ habiller(); remplir(); vue('trois'); } else { construire(); remplir(); if(cle==='eleve') vue('trois'); } }; };
sel('#eleve',ELEVES,'eleve'); sel('#objet',NOMS,'objet'); sel('#pose',POSES,'pose');
$('#autres').onchange=e=>{ etat.autres=e.target.checked; habiller(); };
document.querySelectorAll('[data-vue]').forEach(b=>b.onclick=()=>vue(b.dataset.vue));
$('#depart').onclick=()=>{ const q=perso.userData.P.qui; if(REGLAGES[q]) delete REGLAGES[q][etat.objet]; placerObjets(perso); garder(); remplir(); };
$('#versAutre').onclick=()=>{ const q=perso.userData.P.qui, autre={ equipe:'mal', mal:'equipe', fille:'fille_mal', fille_mal:'fille' }[q];
  (REGLAGES[autre]||(REGLAGES[autre]={}))[etat.objet]=lire(); garder(); msg(`Réglage copié sur « ${ELEVES[autre].nom} ».`); };
const msg=t=>{ $('#msg').textContent=t; clearTimeout(msg.t); msg.t=setTimeout(()=>$('#msg').textContent='',4000); };
const texte=()=>'Réglages des EPI (outil de réglage) : '+JSON.stringify(REGLAGES);
$('#copier').onclick=()=>{ const t=texte(); $('#sortie').value=t; $('#sortie').hidden=false; $('#sortie').select();
  (navigator.clipboard?.writeText(t)||Promise.reject()).then(()=>msg('Réglages copiés : collez-les dans la discussion.'),()=>msg('Sélectionnez le texte ci-dessous et copiez-le (Ctrl + C).')); };
$('#coller').onclick=()=>{ $('#entree').hidden=!$('#entree').hidden; $('#appliquer').hidden=$('#entree').hidden; };
$('#appliquer').onclick=()=>{ try{ const t=$('#entree').value, j=JSON.parse(t.slice(t.indexOf('{'))); for(const [q,v] of Object.entries(j)) REGLAGES[q]={ ...(REGLAGES[q]||{}), ...v };
  placerObjets(perso); garder(); remplir(); msg('Réglages appliqués.'); }catch(e){ msg('Texte non reconnu : collez le texte copié par « Copier les réglages ».'); } };

function taille(){ const w=cv.clientWidth, h=cv.clientHeight; r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
new ResizeObserver(taille).observe(cv);
construire(); remplir(); taille(); vue('trois');
(function boucle(){ ctl.update(); r.render(scene,cam); requestAnimationFrame(boucle); })();
window.__reglage={ etat, REGLAGES, vue, changer, get perso(){ return perso; } };
document.title='Réglage des EPI';
