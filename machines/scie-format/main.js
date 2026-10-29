/* Scie à format KANAK 550 : assemblage du module (modèle, pièces, règles, scénarios) sur le moteur commun. */
import * as THREE from 'three';
import { createApp } from '../../engine/app.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import fiches from './data/fiches.txt';
import { MAIN_KERF } from './constants.js';
import { st, ctx, $ } from './state.js';
import { buildModel } from './model.js';
import { initSchema } from '../../engine/schema.js';
import { initFamilies } from '../../engine/families.js';
import { initPieces, A, pieces, cut, rebuildAll, renderDebit, setActive, scoreState, stopPass, updateCut, doOp, resetForMode, sAll } from './pieces.js';
import { computeAlerts } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage, fiches });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
ctx.app = app; ctx.model = model;
initPieces(app, model);
/* réglages par famille (couleurs, alertes dans leur panneau) et lien avec la 3D */
initFamilies(app, {
  parts:{ machine:['bati','table','rallonge','moteur','transmission','aspiration','armoire'], outil:['lame','couteau','relevage','inclinaison'],
    inciseur:['inciseur'], regle:['cadre','regle','support'], guide:['guide','sabot'], protection:['protecteur','bras'], chariot:['chariot'], pupitre:['pupitre'] },
  summary:{
    machine:()=>'',
    outil:()=>`hauteur ${Math.round(st.h)} mm · ${(+st.t).toFixed(1).replace('.',',')}° · ${st.rpm.toLocaleString('fr-FR')} tr/min`,
    regle:()=>`onglet ${(+st.mit).toFixed(1).replace('.',',')}° · butée ${Math.round(st.stop)} mm`,
    guide:()=>`${Math.round(st.r)} mm${st.guideShort?' · règle courte':''}${st.sabot?' · sabot':''}`,
    chariot:()=>`${st.s>0?'+':''}${Math.round(st.s)} mm`,
    inciseur:()=> st.inc? `en marche · hauteur ${st.incH.toFixed(1).replace('.',',')} mm` : 'arrêté',
    piece:()=> A()? 'pièce sur la machine' : 'aucune pièce' } });
initSchema({ pinIn:'famBar', sub:'vue en bout, depuis l\'opérateur',
  html:'<svg id="endSvg" viewBox="0 0 300 150" role="img" aria-label="Vue en bout : table, pièce, lame (hauteur et inclinaison) et guide parallèle"></svg>', svgs:['incSvg'] });

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

/* ---------- schéma de principe (vue en bout, depuis l'opérateur) : lame, hauteur, inclinaison, pièce, guide parallèle ---------- */
function drawEndSvg(){ const el=$('endSvg'); if(!el) return;
  const p=A(), T=p? Math.round(p.T*1000) : 19, s=0.55, yT=118, bx=196;            // 0,55 px/mm en hauteur ; trait de lame en bx
  const t=st.t*Math.PI/180, ct=Math.cos(t), Tb=T/ct, over=st.h-Tb, low=st.h<Tb+2, high=st.h>Tb+25;
  const col= low?'var(--danger)':high?'#c98a12':'var(--ok)';
  // guide parallèle à gauche (échelle en travers réduite), chariot à droite
  const gx=bx-12-Math.min(1000,st.r)*0.13;
  let g=`<rect x="6" y="${yT}" width="${bx+8-6}" height="12" fill="var(--muted)" opacity=".35"/><rect x="${bx+14}" y="${yT-4}" width="${294-bx-14}" height="16" fill="var(--muted)" opacity=".55"/>`;
  g+=`<text x="${(bx+14+294)/2}" y="${yT+24}" text-anchor="middle" font-size="8" fill="var(--muted)">chariot</text><text x="10" y="${yT+24}" font-size="8" fill="var(--muted)">table</text>`;
  g+=`<rect x="${gx-8}" y="${yT-36}" width="8" height="36" fill="var(--fg)" opacity=".75"/><text x="${gx-4}" y="${yT-40}" text-anchor="middle" font-size="8" fill="var(--muted)">guide</text>`;
  // pièce posée sur la table, à cheval sur le trait
  const pl=Math.max(gx,bx-70), ph=T*s;
  g+=`<rect x="${pl}" y="${yT-ph}" width="${bx+70-pl}" height="${ph}" fill="#d9b98a" stroke="#8a6a40" stroke-width=".7"/>`;
  // lame : elle pivote au ras de la table, autour de son trait, vers le guide
  const H=st.h*s, w=7, rot=-st.t;
  g+=`<g transform="rotate(${rot} ${bx} ${yT})"><rect x="${bx-w/2}" y="${yT-H}" width="${w}" height="${H}" fill="${col}" opacity=".85"/><rect x="${bx-w/2}" y="${yT}" width="${w}" height="12" fill="${col}" opacity=".3"/>`;
  g+=`<path d="M${bx-w/2},${yT-H} l2,-4 l2,4 l2,-4 l1,4" fill="none" stroke="var(--fg)" stroke-width=".8"/></g>`;
  // cotes : hauteur de coupe (le long de la lame), dépassement, guide
  const ex=bx+12;
  g+=`<g transform="rotate(${rot} ${bx} ${yT})"><line x1="${ex+8}" y1="${yT}" x2="${ex+8}" y2="${yT-H}" stroke="var(--fg)" stroke-width=".7" marker-start="url(#sfA)" marker-end="url(#sfA)"/></g>`;
  g+=`<defs><marker id="sfA" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="var(--fg)"/></marker></defs>`;
  g+=`<line x1="${gx}" y1="${yT-50}" x2="${bx-2}" y2="${yT-50}" stroke="var(--fg)" stroke-width=".7" marker-start="url(#sfA)" marker-end="url(#sfA)"/><text x="${(gx+bx)/2}" y="${yT-54}" text-anchor="middle" font-size="9" fill="var(--fg)" font-weight="600">${st.r} mm</text>`;
  g+=`<text x="294" y="12" text-anchor="end" font-size="9" fill="var(--fg)" font-weight="600">hauteur ${st.h} mm${st.t?` · lame à ${st.t}°`:''}</text>`;
  g+=`<text x="294" y="24" text-anchor="end" font-size="8.5" fill="${col}">${low?`lame trop basse : ${Math.round(Tb)+2} mm au moins`:`dépasse de ${Math.round(over)} mm${high?' : trop haute (≈ 10)':' (conseil ≈ 10)'}`}</text>`;
  g+=`<text x="6" y="12" font-size="8.5" fill="var(--muted)">pièce ép. ${T} mm${st.t?` · ${Math.round(Tb)} mm le long de la lame`:''}</text>`;
  if(st.mit) g+=`<text x="6" y="24" font-size="8.5" fill="var(--muted)">règle de tronçonnage : onglet ${st.mit}°</text>`;
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
  $('motor').textContent= st.motor? 'O · Moteur' : 'I · Moteur'; $('pupH').textContent=String(Math.round(st.h)); $('pupT').textContent=(+st.t).toFixed(1).replace('.',',').replace(',0','');
  $('binc').setAttribute('aria-pressed',String(st.inc)); $('binc').textContent=st.inc?'En marche':'Arrêté';
  for(const k of ['incH','incW','incOff']) if(document.activeElement!==$(k)) $(k).value=st[k].toFixed(1);
  drawIncSvg(); drawEndSvg(); $('gshort').setAttribute('aria-pressed',String(st.guideShort));
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
