/* Scie à format KANAK 550 : assemblage du module (modèle, pièces, règles, scénarios) sur le moteur commun. */
import * as THREE from 'three';
import { createApp } from '../../engine/app.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import { MAIN_KERF } from './constants.js';
import { st, ctx, $ } from './state.js';
import { buildModel } from './model.js';
import { initPieces, pieces, cut, rebuildAll, renderDebit, setActive, scoreState, stopPass, updateCut, doOp, resetForMode, sAll } from './pieces.js';
import { computeAlerts } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
ctx.app = app; ctx.model = model;
initPieces(app, model);

/* ---------- schéma de l'inciseur (vue en bout du trait) ---------- */
function drawIncSvg(){ const el=$('incSvg'); if(!el) return;
  // panneau de 19 mm posé sur la table, trait de lame et saignée de l'inciseur (échelle horizontale 12 px/mm, verticale 2,2 px/mm)
  const cx=110, sx=12, top=10, T=19*2.2, bot=top+T, sc=scoreState(), ok=sc==='ok', k=MAIN_KERF;
  const col=ok?'var(--ok)':'var(--danger)', on=st.inc&&st.motor;
  let g=`<rect x="4" y="${top}" width="212" height="${T}" fill="var(--panel)" stroke="var(--muted)" stroke-width="1"/>`;
  g+=`<rect x="${cx-k/2*sx}" y="${top-6}" width="${k*sx}" height="${T+6}" fill="var(--fg)" opacity=".75"/>`;
  if(on){ const w=st.incW*sx, d=Math.min(5,st.incH)*2.2; g+=`<rect x="${cx+st.incOff*sx-w/2}" y="${bot-d}" width="${w}" height="${d+5}" fill="none" stroke="${col}" stroke-width="2"/>`; }
  if(!ok) for(const sgn of [-1,1]) g+=`<path d="M${cx+sgn*k/2*sx},${bot} l${sgn*6},-5 l${sgn*3},5 l${sgn*5},-3 l${sgn*2},3" fill="none" stroke="var(--danger)" stroke-width="1.5"/>`;
  g+=`<line x1="4" y1="${bot+5}" x2="216" y2="${bot+5}" stroke="var(--muted)" stroke-dasharray="3 3"/>`;
  g+=`<text x="6" y="8" font-size="8" fill="var(--muted)">trait de lame ${k.toFixed(1).replace('.',',')} mm</text>`;
  g+=`<text x="214" y="${bot+14}" font-size="8" text-anchor="end" fill="${on?col:'var(--muted)'}">${on? (ok?'incision OK : pas d\'éclat':'incision mal réglée : éclats') : 'inciseur arrêté : éclats en dessous'}</text>`;
  el.innerHTML=g; }

/* ---------- flèches de décalage : direction réelle à l'écran de la lame (−Z) et du chariot (+Z) ---------- */
const ARROWS=['→','↗','↑','↖','←','↙','↓','↘'];
function arrowFor(dz){ const cam=stage.camera, a=new THREE.Vector3(0,0.9,0.25).project(cam), b=new THREE.Vector3(0,0.9,0.25+dz).project(cam);
  const ang=Math.atan2(b.y-a.y,(b.x-a.x)*cam.aspect); return ARROWS[((Math.round(ang/(Math.PI/4))%8)+8)%8]; }
let arrowKey='';
function updateNudge(){ const l=arrowFor(-0.1), c=arrowFor(0.1); if(l+c===arrowKey) return; arrowKey=l+c;
  const t={zm10:`${l} Lame 10`,zm1:`${l} Lame 1`,zp1:`${c} Chariot 1`,zp10:`${c} Chariot 10`};
  for(const k in t){ const b=document.querySelector(`[data-op=${k}]`); if(b) b.textContent=t[k]; } }
stage.controls.addEventListener('change',updateNudge);

/* ---------- mise à jour complète d'après les réglages ---------- */
const fmt = { slide:v=>`${v>0?'+':''}${Math.round(v)} mm`, height:v=>`${Math.round(v)} mm`, tilt:v=>`${(+v).toFixed(1)}°`, mit:v=>`${(+v).toFixed(1).replace('.',',')}°`, rip:v=>`${Math.round(v)} mm` };
function update(){
  updateCut();
  model.update();
  $('bsabot').setAttribute('aria-pressed',String(st.sabot));
  $('binc').setAttribute('aria-pressed',String(st.inc)); $('binc').textContent=st.inc?'En marche':'Arrêté';
  for(const k of ['incH','incW','incOff']) if(document.activeElement!==$(k)) $(k).value=st[k].toFixed(1);
  drawIncSvg(); $('gshort').setAttribute('aria-pressed',String(st.guideShort));
  $('slide').value=st.s;
  $('o-vc').textContent=`Vc ${Math.round(Math.PI*0.4*st.rpm/60)} m/s`;
  document.querySelectorAll('[data-rpm]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.rpm===st.rpm)));
  for(const k of ['slide','height','tilt','mit']){ const map={slide:'s',height:'h',tilt:'t',mit:'mit'}; $('o-'+k).textContent=fmt[k](st[map[k]]); }
  for(const k of ['rip','stop']){ const n=$(k+'-n'); if(document.activeElement!==n) n.value=Math.round(k==='rip'?st.r:st.stop); }
  $('stop').value=st.stop;
  $('height').disabled=$('tilt').disabled=$('mit').disabled=cut.inProgress;
  $('mit').value=st.mit; $('tilt').value=st.t;
  { const lbl=st.s>=1400?'Passe de coupe':'Retour du chariot'; if($('pass').textContent!==lbl) $('pass').textContent=lbl; }
}
const apply=()=>app.apply();

/* ---------- commandes ---------- */
for(const [k,key] of [['slide','s'],['height','h'],['tilt','t'],['mit','mit'],['rip','r'],['stop','stop']]){
  $(k).value = st[key];
  $(k).addEventListener('input',e=>{ st[key]=+e.target.value; if(k==='slide'){ st.pass=false; $('pass').setAttribute('aria-pressed','false'); } apply(); });
}
$('motor').setAttribute('aria-pressed',String(st.motor));
document.querySelectorAll('[data-rpm]').forEach(b=>b.onclick=()=>{ st.rpm=+b.dataset.rpm; apply(); });
$('motor').onclick=()=>{ st.motor=!st.motor; $('motor').setAttribute('aria-pressed',String(st.motor)); apply(); };
/* passe de coupe animée : aller vers −1500, ou retour vers 1450 */
let passT0=0, passFrom=1450, passTo=-1500;
$('pass').onclick=()=>{ if(st.pass){ stopPass(); return; }
  if(st.s<1400 && cut.needEvac){ app.ex.flash.msg='Évacuez la chute avant de ramener le chariot.'; app.ex.invalidate(); apply(); return; }
  passTo = st.s>=1400 ? -1500 : 1450; passFrom=st.s; passT0=performance.now()/1000; st.pass=true; app.ex.flash.msg=''; $('pass').setAttribute('aria-pressed','true'); };
for(const k of ['rip','stop']) $(k+'-n').addEventListener('change',e=>{ const el=$(k); const v=Math.max(+el.min,Math.min(+el.max,Math.round(+e.target.value||0))); if(k==='rip') st.r=v; else st.stop=v; el.value=v; apply(); });
$('bsabot').onclick=()=>{ st.sabot=!st.sabot; apply(); };
$('binc').onclick=()=>{ st.inc=!st.inc; apply(); };
for(const [id,k] of [['incH','incH'],['incW','incW'],['incOff','incOff']]) $(id).addEventListener('change',e=>{ const el=e.target; st[k]=Math.round(Math.max(+el.min,Math.min(+el.max,+el.value||0))*10)/10; apply(); });
$('gshort').onclick=()=>{ st.guideShort=!st.guideShort; $('gshort').setAttribute('aria-pressed',String(st.guideShort)); apply(); };
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>doOp(b.dataset.op));

/* ---------- démarrage ---------- */
window.__scie={ st, pieces:()=>pieces, sAll, cam:(p,t)=>{ stage.setCam(p,t); stage.shadowsDirty?.(); } };   // poignée pour les tests automatiques
app.start({
  update, alerts:computeAlerts, steps:STEPS,
  loadMode(m){ resetForMode(); LOADERS[m](); if(m==='planche') stage.setView('vop');
    for(const k of ['height','rip','stop']) $(k).value=st[{height:'h',rip:'r',stop:'stop'}[k]];
    rebuildAll(); },
  renderExtra:renderDebit,
  panelKey:()=>[pieces.length,cut.inProgress,cut.needEvac],
  onPanel(){ document.querySelectorAll('#tools button,#nudge button').forEach(b=>b.disabled=cut.inProgress && b.dataset.op!=='reset'); },
  onPick(hit){ if(hit && hit.object.userData.pieceId){ setActive(hit.object.userData.pieceId); return true; } return false; },
  tick(dt,now){
    model.tick(dt);
    if(st.pass){ const dur=Math.max(1.5,Math.abs(passTo-passFrom)/(passTo<passFrom?420:700)), t=Math.min(1,(now-passT0)/dur), ez=x=>x<0.5?2*x*x:1-2*(1-x)*(1-x);
      st.s = passFrom + (passTo-passFrom)*ez(t); apply(); if(t>=1) stopPass(); }
    updateNudge(); },
  onContextRestored(){ model.resetScreen(); },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, ignore:['piece'],
    onStart(){ st.h=80; } }, // lame montée à 80 mm pour repérer lame et couteau
});
