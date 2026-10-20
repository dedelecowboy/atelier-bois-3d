/* Déligneuse multilames KANAK 300 M : assemblage du module (modèle, pièces, règles, scénarios) sur le moteur commun. */
import * as THREE from 'three';
import { createApp } from '../../engine/app.js';
import { initSchema } from '../../engine/schema.js';
import { initFamilies } from '../../engine/families.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import { GREEN, MANCHONS, KERF } from './constants.js';
import { st, ctx, bladeZ, guideZ, $ } from './state.js';
import { buildModel } from './model.js';
import { initPieces, pieces, cut, entry, exitPieces, keepPiece, startPass, tickPass, chainSpeed, under, surf, laserKey, load, measure, mirror, take, setKeep, setKind, evacuate, bringBack, aside, flip, endForEnd, toGuide, nudge, clampZ, fmt, label } from './piece.js';
import { computeAlerts, passBlock, presOk } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
/* réglages par famille (couleurs, alertes dans leur panneau) et lien avec la 3D */
initFamilies(app, {
  parts:{ machine:['bati','moteur','transmission','aspiration'], outil:['lames','manchon'], guidage:['guide','reglage_guide','laser'],
    protection:['presseurs','reglage_presseurs','linguets','rideau','capot'], avance:['tapis','vitesse','moteur_avance','table_entree','table_sortie'],
    pupitre:['pupitre','arret'] },
  summary:{
    machine:()=>`aspiration ${st.asp?'en marche':'arrêtée'}`,
    outil:()=>({m1:'1 lame',m2:'2 lames · 140',m4:'4 lames · 45'})[st.man]||st.man,
    guidage:()=> st.guideUp? `guide à ${st.gw} mm${st.laser?' · laser':''}` : `guide escamoté${st.laser?' · laser':''}`,
    protection:()=>`passage ${st.H} mm`,
    avance:()=>`${st.v} m/min · tapis ${st.tapis?'en marche':'arrêté'}`,
    piece:()=>{ const e=entry(); return e? `${e.L} × ${e.T} à l'entrée` : exitPieces().length? 'pièces à la sortie' : 'aucune pièce'; } } });
initSchema({ pinIn:'famBar', sub:'presseurs, guide et traits de scie',
  html:'<svg id="presSvg" viewBox="0 0 300 108" role="img" aria-label="Vue de côté : tapis, pièce et rouleaux presseurs"></svg>', svgs:['planSvg'] });
ctx.app = app; ctx.model = model;
initPieces(app, model);
const F = app.ex.flash;
let curMan=null;

/* ---------- ampèremètre : charge prévue (pointillés) et charge en coupe ---------- */
const ampNow=()=> cut.inProgress? load(cut.src) : st.motor? 8 : 0;
let ampKey='';
function drawAmp(){ const pred=load(), now=ampNow(), key=pred+'|'+now; if(key===ampKey) return; ampKey=key;
  const cx=80, cy=62, r=50, ang=v=>Math.PI*(1-Math.min(150,Math.max(0,v))/150), P=(v,rr)=>[cx+rr*Math.cos(ang(v)),cy-rr*Math.sin(ang(v))];
  const arc=(a,b,c)=>{ const [x0,y0]=P(a,r),[x1,y1]=P(b,r); return `<path d="M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}" stroke="${c}" stroke-width="9" fill="none"/>`; };
  let g=arc(0,GREEN[0],'var(--muted)')+arc(GREEN[0],GREEN[1],'var(--ok)')+arc(GREEN[1],100,'#e0a020')+arc(100,150,'var(--danger)');
  if(pred>0){ const [x,y]=P(pred,r-4); g+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--fg)" stroke-width="1.5" stroke-dasharray="3 2" opacity=".8"/>`; }
  { const [x,y]=P(now,r-2); g+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--danger)" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="4" fill="var(--fg)"/>`; }
  const col=pred>100?'var(--danger)':pred>=GREEN[0]&&pred<=GREEN[1]?'var(--ok)':'var(--muted)';
  g+=`<text x="${cx}" y="${cy-14}" font-size="9" text-anchor="middle" fill="${col}">${cut.inProgress?'en coupe '+now:'prévue '+pred} %</text>`;
  $('ampSvg').innerHTML=g; $('o-amp').textContent= pred? `${pred} %` : '—'; }

/* ---------- vue de côté : tapis, pièce, rouleaux presseurs (réglage 1 à 4 mm sous l'épaisseur) ---------- */
let presKey='';
function drawPres(){ const e=cut.inProgress?cut.src:entry(), T=e?e.T:null, key=st.H+'|'+T; if(key===presKey) return; presKey=key;
  const yT=88, k=0.6, r=11, ok=e&&presOk(e), bute=e&&st.H<T-4, high=e&&st.H>=T;
  const col=!e?'var(--muted)':ok?'var(--ok)':bute?'#c98a12':'var(--danger)';
  let g=`<defs><marker id="dlA" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="var(--fg)"/></marker></defs>`;
  g+=`<rect x="6" y="${yT}" width="288" height="8" rx="4" fill="var(--muted)" opacity=".5"/><text x="8" y="${yT+16}" font-size="8" fill="var(--muted)">tapis → sortie à gauche</text>`;
  if(e) g+=`<rect x="120" y="${yT-T*k}" width="174" height="${T*k}" fill="#d9b98a" stroke="#8a6a40" stroke-width=".7"/><text x="286" y="${yT-T*k/2+3}" text-anchor="end" font-size="8.5" fill="#5a4020">pièce ${T} mm</text>`;
  for(const x of [60,190]) g+=`<circle cx="${x}" cy="${yT-st.H*k-r}" r="${r}" fill="none" stroke="${col}" stroke-width="2"/><circle cx="${x}" cy="${yT-st.H*k-r}" r="2" fill="${col}"/>`;
  g+=`<circle cx="125" cy="${yT-st.H*k-28}" r="22" fill="none" stroke="var(--fg)" stroke-dasharray="3 2" opacity=".5"/>`;
  g+=`<line x1="30" y1="${yT}" x2="30" y2="${yT-st.H*k}" stroke="var(--fg)" stroke-width=".7" marker-start="url(#dlA)" marker-end="url(#dlA)"/><line x1="24" y1="${yT-st.H*k}" x2="${60}" y2="${yT-st.H*k}" stroke="var(--muted)" stroke-dasharray="2 2"/>`;
  g+=`<text x="4" y="12" font-size="9.5" font-weight="600" fill="var(--fg)">presseurs à ${st.H} mm</text>`;
  g+=`<text x="296" y="24" text-anchor="end" font-size="8.5" fill="${col}">${!e?'pas de pièce à l\'entrée':ok?'réglage correct (1 à 4 mm sous la pièce)':high?'trop hauts : pièce non plaquée':'trop bas : la pièce bute'}</text>`;
  $('presSvg').innerHTML=g; }

/* ---------- vue de dessus : pièce, flache, traits de scie, guide (échelle en travers agrandie) ---------- */
let planKey='';
function drawPlan(){ const e=cut.inProgress?cut.src:entry(), key=JSON.stringify([laserKey(),st.gw,st.guideUp,st.man,st.laser,e&&e.c1,e&&e.c2]); if(key===planKey) return; planKey=key;
  const Z0=-0.30, sz=0.24, X=x=>12+x*130, Z=z=>8+(z-Z0)*1000*sz, H=8+600*sz;   // 130 px/m le long, 0,24 px/mm en travers
  let g=`<text x="2" y="${H+12}" font-size="8" fill="var(--muted)">← machine</text><text x="318" y="${H+12}" font-size="8" text-anchor="end" fill="var(--muted)">opérateur</text>`;
  if(e){ const L=e.L/1000, N=21, mir=mirror(e), zr=v=>e.zPos+(mir?e.W-v:v)/1000;
    const edge=(face,hi)=>Array.from({length:N},(_,k)=>{ const i=e.rev?N-1-k:k, w=face==='A'?0:e.T;
      const lo=Math.max(e.c1,e.a1[i]+(e.b1[i]-e.a1[i])*w/e.T), hh=Math.min(e.c2,e.a2[i]+(e.b2[i]-e.a2[i])*w/e.T); return [X(k/(N-1)*L), Z(zr(hi^mir?hh:lo))]; });
    const up=e.flip?'A':'B', dn=e.flip?'B':'A', poly=(f)=>[...edge(f,0),...edge(f,1).reverse()].map(q=>q.join(',')).join(' ');
    g+=`<polygon points="${poly(dn)}" fill="#7a6650" stroke="var(--muted)" stroke-width=".6"/><polygon points="${poly(up)}" fill="#d9b98a" stroke="#8a6a40" stroke-width=".6"/>`; }
  if(st.guideUp){ const y=Z(guideZ()); g+=`<line x1="${X(-0.02)}" y1="${y-2}" x2="${X(0.80)}" y2="${y-2}" stroke="var(--fg)" stroke-width="3"/><text x="${X(0.82)}" y="${y+1}" font-size="8" fill="var(--muted)">guide ${st.gw} mm</text>`; }
  for(const z of bladeZ()) g+=`<line x1="0" y1="${Z(z)}" x2="320" y2="${Z(z)}" stroke="${st.laser?'#ff2a14':'var(--muted)'}" stroke-width="${st.laser?1.2:0.8}" ${st.laser?'':'stroke-dasharray="4 3"'}/>`;
  g+=`<text x="2" y="7" font-size="8" fill="var(--muted)">vue de dessus · ${st.laser?'traits laser':'traits de scie (laser éteint)'} · trait ${String(KERF).replace('.',',')} mm</text>`;
  $('planSvg').innerHTML=g; }

/* ---------- flèches de décalage : direction réelle à l'écran du guide (−Z) et du pupitre (+Z) ---------- */
const ARROWS=['→','↗','↑','↖','←','↙','↓','↘'];
function arrowFor(dz){ const cam=stage.camera, a=new THREE.Vector3(1.0,0.78,0).project(cam), b=new THREE.Vector3(1.0,0.78,dz).project(cam);
  const an=Math.atan2(b.y-a.y,(b.x-a.x)*cam.aspect); return ARROWS[((Math.round(an/(Math.PI/4))%8)+8)%8]; }
let arrowKey='';
function updateNudge(){ const gA=arrowFor(-0.1), pA=arrowFor(0.1); if(gA+pA===arrowKey) return; arrowKey=gA+pA;
  const t={zm10:`${gA} Guide 10`,zm1:`${gA} Guide 1`,zp1:`${pA} Pupitre 1`,zp10:`${pA} Pupitre 10`};
  for(const k in t){ const b=document.querySelector(`[data-op=${k}]`); if(b) b.textContent=t[k]; } }
stage.controls.addEventListener('change',updateNudge);

/* ---------- pièces débitées ---------- */
let debitKey='';
function renderDebit(){ const list=pieces.filter(q=>q.state==='stock'), free=!entry()&&!exitPieces().length&&!cut.inProgress;
  const key=JSON.stringify([list.map(q=>[q.id,q.kind]),free]); if(key===debitKey) return; debitKey=key;
  const np=list.filter(q=>q.kind==='piece').length; $('debitN').textContent=list.length?`${np} pièce${np>1?'s':''} · ${list.length-np} chute${list.length-np>1?'s':''}`:'';
  $('debit').innerHTML= list.length? list.map(q=>{ const m=measure(q);
      return `<li data-k="${q.kind}"><div><b>${fmt(m.kind==='avivé'?m.W:m.Wmax)} mm</b> <small>${m.kind==='avivé'?'avivé':m.kind==='délignure'?'délignure':`en flache, ${fmt(m.W)} mm sans flache`} · ${q.T} × ${q.L}</small></div>
        <div class="d-act"><button class="toggle mini" type="button" data-kind="${q.id}" aria-pressed="${q.kind==='piece'}">${q.kind==='piece'?'Pièce':'Chute'}</button><button class="toggle mini" type="button" data-take="${q.id}" ${free?'':'disabled title="Libérez d\'abord la machine : entrée et sortie dégagées"'}>Reprendre</button></div></li>`; }).join('')
    : '<li class="debit-empty">Les pièces évacuées ou mises de côté apparaissent ici.</li>';
  document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{ const why=take(+b.dataset.take); if(why) return say(why); F.msg=''; clampZ(entry()); app.ex.invalidate(); apply(); });
  document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ setKind(+b.dataset.kind); debitKey=''; renderDebit(); }); }

/* ---------- mise à jour complète ---------- */
function update(){
  if(st.man!==curMan){ curMan=st.man; model.setManchon(bladeZ()); stage.dirty(); }
  const e=entry(); if(e && !cut.inProgress) clampZ(e);          // le guide en place repousse la pièce
  model.update({ H:st.H, guideZ:guideZ(), guideUp:st.guideUp, under, laser:st.laser, bladeZs:bladeZ(), surf, laserKey:laserKey(), amp:ampNow() });
  for(const k of ['motor','tapis','asp','laser']) $(k).setAttribute('aria-pressed',String(st[k]));
  $('pass').setAttribute('aria-pressed',String(cut.inProgress));
  $('motor').textContent= st.motor? 'O · Lames' : 'I · Lames'; $('tapis').textContent= st.tapis? 'O · Tapis' : 'I · Tapis'; $('pupV').textContent= st.tapis? String(st.v) : '0';
  $('gup').setAttribute('aria-pressed',String(st.guideUp)); $('gup').textContent=st.guideUp?'Guide en place':'Guide escamoté';
  document.querySelectorAll('[data-man]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.man===st.man)));
  $('o-speed').textContent=`${st.v} m/min`; $('speed').value=st.v;
  for(const [k,key] of [['pres','H'],['gw','gw']]){ $(k).value=st[key]; if(document.activeElement!==$(k+'-n')) $(k+'-n').value=st[key]; }
  for(const id of ['speed','pres','gw','pres-n','gw-n','gup']) $(id).disabled=cut.inProgress;
  drawAmp(); drawPlan(); drawPres();
}
const apply=()=>app.apply();
const say=(msg,level='warn')=>{ F.msg=msg; F.level=level; app.ex.invalidate(); apply(); };

/* ---------- manipulations de la pièce ---------- */
function doOp(op){
  if(op==='reset'){ app.ex.setMode(app.ex.mode); return; }
  if(cut.inProgress) return say('Sciage en cours : ne touchez jamais une pièce engagée. Restez hors de son axe.');
  if(op==='evac'){ if(!exitPieces().length) return say('Aucune pièce à la sortie.'); evacuate(); F.msg=''; debitKey=''; app.ex.invalidate(); apply(); return; }
  if(op==='back'){ const why=bringBack(); if(why) return say(why); F.msg=''; clampZ(entry()); debitKey=''; app.ex.invalidate(); apply(); return; }
  if(op==='aside'){ const why=aside(); if(why) return say(why); F.msg=''; debitKey=''; app.ex.invalidate(); apply(); return; }
  const p=entry(); if(!p) return say(exitPieces().length? 'La pièce est à la sortie : « Évacuer les chutes », puis « Ramener la pièce ».' : 'Pas de pièce à l\'entrée : « Reprendre » une pièce dans « Pièces débitées », ou « Nouvelle pièce ».');
  F.msg='';
  if(op==='flip') flip(p); else if(op==='end') endForEnd(p);
  else if(op==='guide'){ if(!st.guideUp) return say('Guide escamoté : remettez-le en place pour y plaquer la pièce.'); toGuide(p); }
  else { const d={zm10:-10,zm1:-1,zp1:1,zp10:10}[op]; if(d) nudge(p,d/1000); }
  clampZ(p); app.ex.invalidate(); apply(); }
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>doOp(b.dataset.op));

/* ---------- commandes de la machine ---------- */
const num=(el,v)=>Math.max(+el.min,Math.min(+el.max,Math.round(+v||0)));
$('speed').addEventListener('input',e=>{ st.v=+e.target.value; apply(); });
for(const [k,key] of [['pres','H'],['gw','gw']]){
  $(k).addEventListener('input',e=>{ st[key]=+e.target.value; apply(); });
  $(k+'-n').addEventListener('change',e=>{ st[key]=num($(k),e.target.value); apply(); }); }
$('gup').onclick=()=>{ if(cut.inProgress) return; st.guideUp=!st.guideUp; apply(); };
$('motor').onclick=()=>{ if(cut.inProgress) return say('Pièce en cours de sciage : laissez-la sortir avant d\'arrêter les lames (ou arrêt d\'urgence en cas de problème).');
  if(!st.motor && !st.asp) F.msg=''; st.motor=!st.motor; apply(); };
$('asp').onclick=()=>{ st.asp=!st.asp; apply(); };
$('tapis').onclick=()=>{ st.tapis=!st.tapis; apply(); };
$('laser').onclick=()=>{ st.laser=!st.laser; apply(); };
document.querySelectorAll('[data-man]').forEach(b=>b.onclick=()=>{ if(st.man===b.dataset.man) return;
  if(st.motor||model.spin>0.05||cut.inProgress) return say('Arrêtez les lames et attendez l\'arrêt complet de l\'arbre : la porte d\'accès aux lames reste verrouillée tant qu\'il tourne.');
  st.man=b.dataset.man; F.level='info'; F.msg=`Manchon « ${MANCHONS[st.man].label} » monté, porte refermée et verrouillée.`; app.ex.invalidate(); apply(); });
$('pass').onclick=()=>{ if(cut.inProgress) return; const why=startPass(passBlock); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); };

/* ---------- démarrage ---------- */
let lastSeq=0;
app.start({
  update, alerts:()=>{ if(cut.msgSeq!==lastSeq){ lastSeq=cut.msgSeq; F.msg=cut.lastMsg; F.level='info'; } return computeAlerts(); },
  steps:STEPS,
  loadMode(m){ LOADERS[m](); model.stopNow(); lastSeq=cut.msgSeq; planKey=ampKey=debitKey=''; if(m!=='libre') stage.setView('vop'); },
  renderExtra:renderDebit,
  panelKey:()=>[cut.inProgress,pieces.length,entry()?.id,exitPieces().length,cut.keep,st.tapis],
  onPanel(){ document.querySelectorAll('#tools button,#nudge button').forEach(b=>b.disabled=cut.inProgress && b.dataset.op!=='reset'); },
  onPick(hit){ const q=hit && pieces.find(x=>x.id===hit.object.userData.pieceId); if(!q) return false; const m=measure(q);
    if(q.state==='exit' && !cut.inProgress && setKeep(q.id)){ F.level='info'; F.msg=`Pièce gardée : ${label(m)} (contour orange).`; app.ex.invalidate(); apply(); }
    $('info').innerHTML=`<b>${m.kind[0].toUpperCase()+m.kind.slice(1)} · ${fmt(m.W)} mm</b><span>${q.L} × ${q.T} mm · ${m.flache?'flache sur une rive au moins':'rives sciées'}</span>`; return true; },
  tick(dt,now){ const d=tickPass(now); model.tick(dt,st.motor,d,st.tapis?chainSpeed()*dt:0); if(d) apply(); else if(cut.msgSeq!==lastSeq) apply(); updateNudge(); },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, ignore:['piece'] },
});
