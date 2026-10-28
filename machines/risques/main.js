/* Risques généraux de l'atelier bois : assemblage du module sur le moteur commun.
   La scène est l'atelier entier (plan réel) ; présentation = visite + fiches risques ; exercices et parcours évalué =
   repérage des équipements, QCM, 4 scénarios notés (dangers, EPI, consignation, départ de feu). */
import { createApp } from '../../engine/app.js';
import { parseDangers, parseEpi, parseFiches } from '../../engine/data.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import dangersTxt from './data/dangers.txt';
import epiTxt from './data/epi.txt';
import fichesTxt from './data/fiches.txt';
import { st, ctx, $ } from './state.js';
import { buildModel } from './model.js';
import { reset, pickDanger, chooseMeasure, measureOrder, toggleEpi, validateEpi, consign, feu, FEU, buildSteps, SCENS, scenCriteria } from './scenarios.js';

const data = ctx.data = { dangers:parseDangers(dangersTxt), epi:parseEpi(epiTxt), fiches:parseFiches(fichesTxt) };
const app = createApp(config, { organes, qcm, reperage });
const { stage, parts } = app;
const THREE = stage.THREE;
const model = ctx.model = buildModel({ root:stage.root, tagPart:parts.tagPart });
ctx.app = app;
/* situations retirées de dangers.txt par l'enseignant : cachées */
for(const [k,o] of Object.entries(model.DANG)) if(k!=='armoire_ouverte' && !data.dangers.some(d=>d.k===k)) o.userData.off=true;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const F = app.ex.flash;
const apply=()=>app.apply();
const say=(msg,level='warn')=>{ F.msg=msg; F.level=level; app.ex.invalidate(); apply(); };
const mode=()=>app.ex.mode;
const parcOn=()=>!!app.parcours?.active;
/* faute grave : notée dans le bilan du scénario et relevée par le parcours (sans effet en entraînement) */
function fault(t){ if(!st.faults.includes(t)) st.faults.push(t); app.recordDangers([['danger',t]]); }
const visible=o=>{ while(o){ if(!o.visible||o.userData.off) return false; o=o.parent; } return true; };

/* ---------- caméra : cadrer des équipements, vue du poste (avatar, feu) ---------- */
function frame(codes){ const b=new THREE.Box3(); for(const k of codes) for(const m of parts.partMeshes[k]||[]) if(visible(m)) b.expandByObject(m);
  if(b.isEmpty()) return; const c=b.getCenter(new THREE.Vector3()), s=b.getSize(new THREE.Vector3()), r=Math.max(s.x,s.y,s.z,0.6);
  const dir=stage.camera.position.clone().sub(stage.controls.target); dir.y=0; if(dir.lengthSq()<0.01) dir.set(0,0,1); dir.normalize();
  /* rester dans la salle : on regarde depuis le centre de l'atelier vers l'équipement s'il est contre un mur */
  const toC=new THREE.Vector3(-c.x,0,-c.z); if(Math.abs(c.x)>9||Math.abs(c.z)>9) dir.copy(toC.normalize());
  const d=Math.min(30,Math.max(2.6,r*2.4)); stage.setCam([c.x+dir.x*d, c.y+d*0.55+0.6, c.z+dir.z*d],[c.x,Math.max(0.4,c.y),c.z]); }
/* vue d'un personnage sans obstacle : on essaie plusieurs côtés autour de la direction qu'il regarde, et on garde le premier
   d'où l'on voit sa poitrine sans traverser une machine, un mur ou un meuble (et sans sortir de la salle) */
const ray=new THREE.Raycaster();
function clearSide(x,z,ry,dist,h,ty,skip){ const tgt=new THREE.Vector3(x,ty+0.25,z);
  /* de face d'abord : on voit le visage et les EPI */
  for(const side of [0.4,-0.4,0.7,-0.7,0.15,-0.15,1.0,-1.0,1.35,-1.35,1.7,-1.7]){ const a=ry+side, p=new THREE.Vector3(x+Math.sin(a)*dist,h,z+Math.cos(a)*dist);
    if(Math.abs(p.x)>10.4||Math.abs(p.z)>10.3) continue;
    const dir=p.clone().sub(tgt), L=dir.length(); ray.set(tgt,dir.normalize()); ray.far=L;
    const hit=ray.intersectObjects(stage.root.children,true).find(h=>visible(h.object) && !skip(h.object) && h.object.material?.opacity!==0);
    if(!hit) return side; }
  return 0.7; }
/* vue du poste : caméra à dist m, décalée de « side » radians par rapport à la direction regardée par le personnage */
function posteView(x,z,ry,dist=2.8,h=1.75,ty=1.1,side=0){ const V=stage.VIEWS.vposte, a=ry+side; V.pos=[x+Math.sin(a)*dist, h, z+Math.cos(a)*dist]; V.tgt=[x,ty,z]; }

/* ---------- présentation : fiches risques ---------- */
{ const h=$('presSlot').querySelector('h2'); if(h) h.textContent='Fiches risques'; }
$('fiches').innerHTML=data.fiches.map((f,i)=>`<details class="fiche"${i===0?' open':''}><summary>${esc(f.t)}</summary>${f.blocks.map(b=>b.p?`<p>${esc(b.p)}</p>`:b.ul?`<ul>${b.ul.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p class="src">${esc(b.src)}</p>`).join('')}${f.parts.length?`<button type="button" class="toggle mini" data-fiche="${i}">Voir dans l'atelier</button>`:''}</details>`).join('');
document.querySelectorAll('[data-fiche]').forEach(b=>b.onclick=()=>{ const f=data.fiches[+b.dataset.fiche]; parts.select(null); parts.highlight(f.parts, 0xd27a1c); frame(f.parts);
  $('info').innerHTML=`<b>${esc(f.t)}</b><span>${f.parts.map(k=>parts.PARTS[k]?.n).filter(Boolean).join(' · ')}</span>`; });
/* nomenclature : l'équipement choisi dans la liste est cadré */
$('parts').addEventListener('click',e=>{ const b=e.target.closest('button[data-k]'); if(b && parts.selected===b.dataset.k) frame([b.dataset.k]); });

/* ---------- marqueurs des dangers repérés ---------- */
const marks=new THREE.Group(); stage.root.add(marks);
const ringGeo=new THREE.RingGeometry(0.55,0.68,40); ringGeo.rotateX(-Math.PI/2);
const ringMat={ ok:new THREE.MeshBasicMaterial({ color:0x2e9d4f, transparent:true, opacity:.9, depthWrite:false, toneMapped:false }),
  ko:new THREE.MeshBasicMaterial({ color:0xd9772b, transparent:true, opacity:.9, depthWrite:false, toneMapped:false }),
  cur:new THREE.MeshBasicMaterial({ color:0xd0201c, transparent:true, opacity:.9, depthWrite:false, toneMapped:false }) };
function markAt(code,m){ const o=model.DANG[code]; if(!o) return; const b=new THREE.Box3().setFromObject(o), c=b.getCenter(new THREE.Vector3());
  const r=new THREE.Mesh(ringGeo,m); r.position.set(c.x,0.02,c.z); const s=Math.max(1,Math.min(2.2,Math.max(b.max.x-b.min.x,b.max.z-b.min.z)*0.75)); r.scale.set(s,1,s); r.renderOrder=3; marks.add(r); }
let markKey='';
function renderMarks(){ const k=mode()==='dangers'? JSON.stringify([st.d.found,st.d.pending]) : ''; if(k===markKey) return; markKey=k; marks.clear();
  if(mode()!=='dangers') return; for(const [c,f] of Object.entries(st.d.found)) markAt(c,f.ok?ringMat.ok:ringMat.ko); if(st.d.pending) markAt(st.d.pending,ringMat.cur); }

/* ---------- panneau « Actions » ---------- */
const btn=(act,label,o={})=>`<button type="button" class="toggle act${o.cls?' '+o.cls:''}" data-act="${act}"${o.v!==undefined?` data-v="${o.v}"`:''}${o.dis?' disabled':''}${o.on!==undefined?` aria-pressed="${!!o.on}"`:''}>${label}</button>`;
const fb=o=>o?`<p class="afb" data-l="${o.level}">${o.html}</p>`:'';
let actKey='';
function renderActs(){ const m=mode(), el=$('acts');
  const key=JSON.stringify([m,app.ex.step,st.d,st.e,st.c,st.f,(model.spin>0.02)]); if(key===actKey) return; actKey=key;
  let h='';
  if(m==='libre') h='<p class="hint">Mode visite : touchez un équipement dans l\'atelier ou dans la liste, ou ouvrez une fiche risques. Les scénarios sont dans les boutons « Dangers », « EPI », « Consignation » et « Départ de feu ».</p>';
  else if(m==='dangers'){ const d=data.dangers.find(x=>x.k===st.d.pending), all=data.dangers.filter(x=>x.type==='D');
    h=`<p class="kpi">Dangers repérés <b>${Object.keys(st.d.found).length} / ${all.length}</b> · fausses alertes <b>${st.d.fa.length}</b></p>`;
    h+= d? `<div class="ask"><p><b>Danger repéré :</b> ${esc(d.t)}.</p><p>Quelle est la bonne mesure ?</p><div class="opts">${measureOrder(d).map(i=>btn('measure',esc(d.o[i]),{ v:i, cls:'opt' })).join('')}</div></div>`
      : '<p class="hint">Touchez dans l\'atelier une situation qui vous semble dangereuse (un personnage, un objet, une porte…). Zoomez et tournez pour bien voir.</p>';
    h+=fb(st.d.fb); }
  else if(m==='epi'){ const t=data.epi.tasks[Math.min(app.ex.step,data.epi.tasks.length-1)];
    if(app.ex.step>=data.epi.tasks.length) h='<p class="hint">Toutes les tâches sont validées : voyez le bilan.</p>';
    else { const sel=st.e.sel[t.k]||[], r=st.e.res[t.k];
      h=`<p class="kpi">Tâche : <b>${esc(t.t)}</b></p><div class="epis">${data.epi.epi.map(e=>btn('epi',esc(e.n),{ v:e.k, on:sel.includes(e.k), dis:!!r, cls:'epi' })).join('')}</div>`
        +`<div class="row">${btn('valider','Valider la tenue',{ dis:!!r, cls:'main' })}</div>${r?fb(st.e.fb):''}`; } }
  else if(m==='consignation'){ const C=st.c, spin=model.spin;
    h=`<p class="kpi">Scie à format : <b>${C.on?'en marche':spin>0.02?'lame en train de s\'arrêter':'arrêtée'}</b> · sectionneur <b>${C.sect?'1':'0'}</b>${C.lock?' · <b>cadenas</b>':''}${C.tag?' · <b>panneau</b>':''}${C.au?' · <b>arrêt d\'urgence enfoncé</b>':''}</p>`
      +`<div class="grp"><span>Commandes</span>${btn('stop','O · Arrêter')}${btn('start','I · Démarrer')}${btn('au',C.au?'Déverrouiller l\'arrêt d\'urgence':'Arrêt d\'urgence (coup de poing)')}</div>`
      +`<div class="grp"><span>Sectionneur</span>${btn('sect',C.sect?'Mettre le sectionneur sur 0':'Mettre le sectionneur sur 1')}${btn('lock',C.lock?'Retirer mon cadenas':'Poser mon cadenas')}${btn('key','Garder la clé sur moi',{ on:C.key })}${btn('tag',C.tag?'Retirer le panneau':'Accrocher le panneau « Ne pas manœuvrer »')}</div>`
      +`<div class="grp"><span>Intervention</span>${btn('inter','Changer la lame')}${btn('prot','Remettre le protecteur, ranger les outils')}${btn('warn','Prévenir les personnes autour')}</div>`+fb(C.fb); }
  else if(m==='feu'){ const F=st.f, done=!!F.exit;
    const choice=(act,map,cur,dis)=>Object.entries(map).map(([k,l])=>btn(act,l,{ v:k, on:cur===k, dis:dis||(cur!=null&&cur!==k) })).join('');
    h=`<div class="grp"><span>Alerter</span>${btn('cri','Crier « Au feu ! » et prévenir le professeur',{ on:F.cri })}${btn('alarme','Appuyer sur le déclencheur d\'alarme',{ on:F.alarme })}${btn('au','Arrêt d\'urgence général',{ on:F.au })}</div>`
      +`<div class="grp"><span>Extincteur</span>${choice('ext',FEU.ext,F.ext,done)}</div>`
      +`<div class="grp"><span>Position</span>${choice('pos',FEU.pos,F.pos,done||!F.ext)}</div>`
      +`<div class="grp"><span>Viser</span>${choice('aim',FEU.aim,F.aim,done||!F.pos)}</div>`
      +`<div class="grp"><span>Évacuer</span>${choice('exit',FEU.exit,F.exit,false)}${btn('ferme','Fermer la porte derrière soi',{ on:F.ferme, dis:!F.exit })}${btn('sac','Retourner chercher son sac',{ dis:F.rass })}${btn('rass','Aller au point de rassemblement',{ on:F.rass, dis:!F.exit })}</div>`+fb(F.fb); }
  el.innerHTML=h;
  el.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act,b.dataset.v)); }

/* ---------- actions ---------- */
function act(a,v){ const m=mode(); F.msg='';
  if(m==='dangers' && a==='measure'){ chooseMeasure(+v); }
  else if(m==='epi'){ const t=data.epi.tasks[app.ex.step]; if(!t) return;
    if(a==='epi') toggleEpi(t.k,v);
    if(a==='valider'){ const r=validateEpi(t.k); if(r.fault) fault(r.fault); }
    dressAvatar(); }
  else if(m==='consignation'){ const r=consign(a,model.spin); if(r.fault) fault(r.fault); syncMachine(); }
  else if(m==='feu'){ const r=feu(a,v); if(r.fault) fault(r.fault); syncFire(); }
  app.ex.invalidate(); apply(); }

/* ---------- liens avec la 3D ---------- */
/* poste de chaque tâche : x, z, orientation du personnage (il regarde son travail ; la caméra se place devant lui, de côté) */
const POSTES={ toupie:[0.7,5.25,Math.PI], poncage:[6.0,9.05,0], manutention:[-9.55,6.9,-Math.PI/2], vernis:[8.6,9.05,0] };
function dressAvatar(){ const t=data.epi.tasks[Math.min(app.ex.step,data.epi.tasks.length-1)]; if(!t) return; const sel=st.e.sel[t.k]||[], p=POSTES[t.k]||[3,0,0];
  model.placeAvatar(p[0],p[1],p[2],{ epi:sel, hair:sel.includes('cheveux')?'attache':'long', echarpe:!sel.includes('bijoux'), bijoux:!sel.includes('bijoux'), pose:t.k==='manutention'?'debout':'machine' }); }
function syncMachine(){ const C=st.c; model.setConsign({ sect:C.sect, lock:C.lock, tag:C.tag, on:C.on }); }
let fireT=0;
function syncFire(){ const F=st.f; if(F.phase===1 && !F.exit){ fireT=performance.now(); } }
function fireLevel(now){ const F=st.f; if(!F) return 0;
  if(!F.attacked && !F.exit) return 0.55;
  const k=Math.min(1,(now-fireT)/4000);
  if(F.attacked && !F.exit) return F.aim==='base'? (k<0.4? 0.55-0.6*k : 0.31+1.4*(k-0.4)) : 0.55+0.6*k;
  return 1.3; }

/* ---------- mise à jour ---------- */
let lastMode='', posteKey='';
function update(){ const m=mode();
  if(m!==lastMode){ lastMode=m;
    model.showDangers(m==='dangers'); for(const o of Object.values(model.DANG)) if(o.userData.off) o.visible=false;
    if(m!=='epi') model.hideAvatar(); if(m!=='feu') model.fire.set(0);
    if(m!=='consignation') model.setConsign({ sect:true, lock:false, tag:false, on:false }); }
  if(m==='epi'){ const k=String(app.ex.step); if(k!==posteKey){ posteKey=k; dressAvatar(); const t=data.epi.tasks[Math.min(app.ex.step,data.epi.tasks.length-1)], p=POSTES[t?.k]; if(p){ const inAv=o=>{ while(o){ if(o===model.avatar) return true; o=o.parent; } return false; }; posteView(p[0],p[1],p[2],2.7,1.55,1.05,clearSide(p[0],p[1],p[2],2.7,1.55,1.05,inAv)); stage.setView('vposte'); } } }
  else posteKey='';
  renderMarks(); }
function renderExtra(){ renderActs(); }

/* ---------- alertes (bandeau du panneau d'exercice) ---------- */
function alerts(){ const m=mode(), A=[];
  if(m==='consignation'){ const C=st.c; if(C.on) A.push(['warn','Machine en marche : ne jamais intervenir sur la lame.']); else if(model.spin>0.02) A.push(['warn','La lame ralentit : attendez son arrêt complet.']);
    if(!C.sect && !C.lock && !C.changed) A.push(['warn','Sectionneur sur 0 mais non condamné : quelqu\'un peut le remettre sur 1.']);
    if(C.changed && !C.prot) A.push(['warn','Protecteur déposé : à remettre avant de déconsigner.']); }
  if(m==='feu' && st.f.exit && !st.f.rass) A.push(['info','Rejoignez le point de rassemblement.']);
  for(const t of st.faults) A.push(['danger','Faute grave : '+t]);
  return A; }

/* ---------- clic dans l'atelier ---------- */
function onPick(hit,hits){ const m=mode();
  if(m==='dangers'){ const h=hits.find(h=>visible(h.object) && (h.object.userData.danger||h.object.userData.part));
    const code=h?.object.userData.danger; if(code){ const d=pickDanger(code); if(d){ app.ex.invalidate(); apply(); } return true; } }
  if(hit && hit.object.userData.part) return false;   // un équipement : nomenclature et fiche (comportement normal)
  return false; }

/* ---------- démarrage ---------- */
let lastApply=0;
app.start({
  update, alerts, renderExtra,
  steps:buildSteps(),
  loadMode(m){ reset(m); F.msg=''; actKey=''; markKey=''; lastMode='';
    if(m==='consignation'){ st.c.on=true; syncMachine(); stage.setView('vmachine'); }
    if(m==='feu'){ model.fire.set(0.55); posteView(-6.4,-6.75,Math.PI*0.62,6.5,3.2,0.6); stage.setView('vposte'); }
    if(m==='dangers') stage.setView('v34');
    if(m==='libre') stage.setView('v34'); },
  panelKey:()=>[mode(),app.ex.step,JSON.stringify(st.c?.t),JSON.stringify(st.f?.t),Object.keys(st.d?.found||{}).length,st.faults.length],
  onPick,
  tick(dt,now){ const anim=model.tick(dt,now); if(mode()==='feu') model.fire.set(fireLevel(performance.now()));
    if(anim && now-lastApply>0.25){ lastApply=now; if(mode()==='consignation') apply(); } },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, scenWeight:15, qcmTitle:'QCM risques généraux',
    labels:{ rep:'Repérage des équipements', item:'équipement', where:'dans l\'atelier',
      scenNote:'Suivez les étapes et vos actions dans le panneau « Actions ». À l\'étape « Contrôle », vos choix sont relevés, et toute faute grave de sécurité est relevée' } },
});
window.__risques={ st, data, model, act, pickDanger:c=>{ pickDanger(c); app.ex.invalidate(); apply(); }, frame };
