/* Scie radiale KANAK 900 R : assemblage du module (modèle, pièces, règles, scénarios) sur le moteur commun. */
import * as THREE from 'three';
import { createApp } from '../../engine/app.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import { TABLE_Y, FENCE_Z, ZONE, STOP_MIN, STOP_MAX, STROKE } from './constants.js';
import { st, head, parked, ctx, bladeX, stopX, $ } from './state.js';
import { buildModel } from './model.js';
import { initPieces, pieces, cut, onTable, cur, extent, toScene, defectsIn, measure, label, fmt, sawThrough, strokeNeeded, setKeep, setKind, evacuate, bringBack, aside, take, toGuide, endForEnd, nudge, clampPiece } from './piece.js';
import { computeAlerts, passBlock, zonePoly, handXZ, handOk, handOnWood, nearestDefect } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
ctx.app = app; ctx.model = model;
initPieces(app, model);
const F = app.ex.flash;
const apply=()=>app.apply();
const say=(msg,level='warn')=>{ F.msg=msg; F.level=level; app.ex.invalidate(); apply(); };

/* ---------- vue de dessus : table, planche, défauts, trait, zone dangereuse, main, butée ---------- */
let planKey='';
function drawPlan(){ const t=onTable(), hx=handXZ();
  const key=JSON.stringify([t.map(q=>[q.id,+q.tx.toFixed(4),+q.tz.toFixed(4),q.rev]),cut.keep,st.alpha,st.beta,st.stopOn,st.stopL,st.handD,st.motor,head.mode]); if(key===planKey) return; planKey=key;
  const X0=-1.15, X1=1.05, X=x=>10+(x-X0)*300/(X1-X0), Z=z=>24+(z-FENCE_Z)*1000*0.32, zf=FENCE_Z+0.36;
  let g=`<rect x="${X(-0.80)}" y="${Z(FENCE_Z)}" width="${X(0.80)-X(-0.80)}" height="${Z(zf)-Z(FENCE_Z)}" fill="var(--panel)" stroke="var(--line)"/>`;
  const zs=[FENCE_Z,zf], bl=z=>bladeX(TABLE_Y,z,0);
  for(const q of t){ const P=(arr)=>arr.map(([u,v])=>{ const [x,z]=toScene(q,u,v); return X(x)+','+Z(z); }).join(' '); const f=q._f||(measure(q),q._f);
    g+=`<polygon points="${P(f.bot)}" fill="#8a7458" stroke="var(--muted)" stroke-width=".5"/><polygon points="${P(f.top)}" fill="#d9b98a" stroke="${q.id===cut.keep&&t.length>1?'#d27a1c':'#8a6a40'}" stroke-width="${q.id===cut.keep&&t.length>1?1.6:.5}"/>`;
    for(const d of defectsIn(q)) g+=`<polygon points="${P(d.poly)}" fill="#7a1810" stroke="#7a1810" stroke-width="${d.type==='noeud'?.5:1.4}"/>`; }
  // zone dangereuse (la même que sur la table : elle suit l'angle du bras et l'inclinaison), coupée au bas de la vue
  { const Q=zonePoly(), k=(zf-Q[0][1])/(Q[3][1]-Q[0][1]), lerp=(a,b)=>[a[0]+(b[0]-a[0])*k,zf];
    g+=`<polygon points="${[Q[0],Q[1],lerp(Q[1],Q[2]),lerp(Q[0],Q[3])].map(([x,z])=>X(x)+','+Z(z)).join(' ')}" fill="var(--danger)" opacity=".16"/>`; }
  g+=`<rect x="0" y="${Z(FENCE_Z)-6}" width="320" height="6" fill="var(--fg)" opacity=".75"/><text x="316" y="${Z(FENCE_Z)-8}" font-size="8" text-anchor="end" fill="var(--muted)">guide</text>`;
  // trait de scie : au ras de la table (trait plein), au-dessus de la pièce si la lame est inclinée (pointillés)
  const c=st.motor?'#ff2a14':'var(--fg)';
  g+=`<line x1="${X(bl(FENCE_Z))}" y1="${Z(FENCE_Z)}" x2="${X(bl(zf))}" y2="${Z(zf)}" stroke="${c}" stroke-width="1.6"/>`;
  if(st.beta){ const T=(cur()?.prof.T||27)/1000, bt=z=>bladeX(TABLE_Y+T,z,0); g+=`<line x1="${X(bt(FENCE_Z))}" y1="${Z(FENCE_Z)}" x2="${X(bt(zf))}" y2="${Z(zf)}" stroke="${c}" stroke-width="1" stroke-dasharray="3 2"/>`; }
  // butée
  if(st.stopOn){ const x=stopX(); if(x<=X1) g+=`<rect x="${X(x)}" y="${Z(FENCE_Z)}" width="4" height="${0.10*320}" fill="var(--fg)"/><text x="${X(x)-3}" y="${Z(FENCE_Z)+40}" font-size="8" text-anchor="end" fill="var(--muted)">butée ${st.stopL}</text>`;
    else g+=`<text x="316" y="${Z(FENCE_Z)+12}" font-size="8" text-anchor="end" fill="var(--muted)">butée → ${st.stopL} mm</text>`; }
  // main de maintien
  if(t.length){ const bad=!handOk(); g+=`<circle cx="${X(hx[0])}" cy="${Z(hx[1])}" r="6" fill="${bad?'var(--danger)':'#e2ad8b'}" stroke="var(--fg)" stroke-width=".8"/><text x="${X(hx[0])}" y="${Z(hx[1])+16}" font-size="8" text-anchor="middle" fill="${bad?'var(--danger)':'var(--muted)'}">main</text>`; }
  // relevés
  let r1='', r2='';
  const p=cur(); if(p && t.length===1){ const e=extent(p), d=(e.x1-bladeX(TABLE_Y,FENCE_Z,1))*1000;
    r1= d>0.5? `Coupé à droite du trait : ${fmt(d,0)} mm` : `Lame hors de la pièce : bout droit à ${fmt(-d,0)} mm du trait`;
    const nd=nearestDefect(); if(nd) r2=`Défaut le plus proche : ${{noeud:'nœud',fente:'fente en bout',gerce:'gerce'}[nd.type]}, ${nd.dist===0?'dans le trait':fmt(Math.abs(nd.dist),0)+' mm '+(nd.dist>0?'à gauche':'à droite')}`; }
  g+=`<text x="4" y="10" font-size="8" fill="var(--muted)">vue de dessus · zone rouge ${ZONE} mm · bras ${st.alpha}° · lame ${st.beta}°</text><text x="4" y="157" font-size="9" fill="var(--fg)">${r1}</text><text x="4" y="168" font-size="9" fill="var(--fg)">${r2}</text>`;
  $('planSvg').innerHTML=g; }

/* ---------- flèches : direction réelle à l'écran de la servante (−X) et de la butée (+X) ---------- */
const ARROWS=['→','↗','↑','↖','←','↙','↓','↘'];
function arrowFor(dx){ const cam=stage.camera, a=new THREE.Vector3(0,TABLE_Y,-0.1).project(cam), b=new THREE.Vector3(dx,TABLE_Y,-0.1).project(cam);
  const an=Math.atan2(b.y-a.y,(b.x-a.x)*cam.aspect); return ARROWS[((Math.round(an/(Math.PI/4))%8)+8)%8]; }
let arrowKey='';
function updateNudge(){ const sA=arrowFor(-0.1), bA=arrowFor(0.1); if(sA+bA===arrowKey) return; arrowKey=sA+bA;
  for(const n of [100,10,1]){ const m=document.querySelector(`[data-op=xm${n}]`), p=document.querySelector(`[data-op=xp${n}]`); if(m) m.textContent=`${sA} Servante ${n}`; if(p) p.textContent=`${bA} Butée ${n}`; } }
stage.controls.addEventListener('change',updateNudge);

/* ---------- pièces débitées ---------- */
let debitKey='';
const endTxt=m=>{ if(m.ends.some(e=>e.raw)) return 'bout brut'; if(m.square) return 'bouts d\'équerre';
  return m.ends.map(e=> e.beta? `biais ${e.beta}°` : e.alpha? `onglet ${Math.abs(e.alpha)}°` : 'équerre').join(' / '); };
function renderDebit(){ const list=pieces.filter(q=>q.state==='stock'), free=!onTable().length && parked();
  const key=JSON.stringify([list.map(q=>[q.id,q.kind]),free]); if(key===debitKey) return; debitKey=key;
  const np=list.filter(q=>q.kind==='piece').length; $('debitN').textContent=list.length?`${np} pièce${np>1?'s':''} · ${list.length-np} chute${list.length-np>1?'s':''}`:'';
  $('debit').innerHTML= list.length? list.map(q=>{ const m=measure(q);
      return `<li data-k="${q.kind}"><div><b>${fmt(m.L)} mm</b> <small>${m.defNames.length?'avec '+m.defNames.join(', ')+' · ':''}${endTxt(m)} · ${q.prof.T} × ${fmt(m.W,0)}</small></div>
        <div class="d-act"><button class="toggle mini" type="button" data-kind="${q.id}" aria-pressed="${q.kind==='piece'}">${q.kind==='piece'?'Pièce':'Chute'}</button><button class="toggle mini" type="button" data-take="${q.id}" ${free?'':'disabled title="Libérez d\'abord la table, lame en position arrière"'}>Reprendre</button></div></li>`; }).join('')
    : '<li class="debit-empty">Les pièces évacuées ou mises de côté apparaissent ici.</li>';
  document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{ if(!guardHands()) return; const why=take(+b.dataset.take); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); });
  document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ setKind(+b.dataset.kind); debitKey=''; renderDebit(); }); }

/* ---------- mise à jour complète ---------- */
function update(){
  if(parked() && cut.blocked) cut.blocked='';
  const t=onTable(), hx=handXZ(), p=cur(), onW=handOnWood();
  model.update({ alpha:st.alpha, beta:st.beta, s:head.s, prot:st.prot, stopX:stopX(), stopOn:st.stopOn,
    zone:zonePoly(), hand:{ show:t.length>0, x:hx[0], y:TABLE_Y+(onW&&p? p.prof.T/1000 : 0)+0.001, z:hx[1], bad:!handOk() } });
  for(const k of ['motor','asp']) $(k).setAttribute('aria-pressed',String(st[k]));
  $('pull').setAttribute('aria-pressed',String(head.mode==='pull')); $('ret').setAttribute('aria-pressed',String(head.mode==='back'));
  $('lock').setAttribute('aria-pressed',String(st.lock)); $('lock').textContent=st.lock?'Bras et tête bloqués':'Bras et tête débloqués';
  $('stopOn').setAttribute('aria-pressed',String(st.stopOn)); $('stopOn').textContent=st.stopOn?'Butée en service':'Butée relevée';
  document.querySelectorAll('[data-alpha]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.alpha===st.alpha)));
  document.querySelectorAll('[data-beta]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.beta===st.beta)));
  for(const [k,key] of [['prot','prot'],['stop','stopL'],['hand','handD']]){ $(k).value=st[key]; if(document.activeElement!==$(k+'-n')) $(k+'-n').value=st[key]; }
  const moving=head.mode==='pull'||head.mode==='back';
  for(const id of ['prot','prot-n','stop','stop-n','stopOn','lock']) $(id).disabled=moving;
  drawPlan();
}

/* ---------- manipulations de la pièce : jamais lame en avant ---------- */
const HANDS_FAULT='PIÈCE TOUCHÉE LAME EN AVANT : la lame n\'a pas été ramenée en position arrière. Ramenez toujours la lame derrière le guide, sans lâcher la poignée, avant de toucher aux pièces.';
function guardHands(){
  if(head.mode==='pull'||head.mode==='back'){ say('Coupe en cours : la main gauche tient la pièce, la droite retient la poignée. Ne touchez à rien d\'autre.'); return false; }
  if(head.mode==='front'){ cut.blocked=HANDS_FAULT; app.recordDangers([['danger',HANDS_FAULT]]); say('Refusé : ramenez d\'abord la lame en arrière (« Ramener la lame »).','danger'); return false; }
  return true; }
function doOp(op){
  if(op==='reset'){ app.ex.setMode(app.ex.mode); return; }
  if(!guardHands()) return;
  if(op==='evac'){ const why=evacuate(); if(why) return say(why,'info'); F.msg=''; debitKey=''; app.ex.invalidate(); apply(); return; }
  if(op==='back'){ const why=bringBack(); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); return; }
  if(op==='aside'){ const why=aside(); if(why) return say(why); F.msg=''; debitKey=''; app.ex.invalidate(); apply(); return; }
  const t=onTable(); if(!t.length) return say('Pas de pièce sur la table : « Reprendre » une pièce dans « Pièces débitées », ou « Nouvelle pièce ».');
  if(t.length>1) return say('Deux pièces sur la table : gardez la pièce utile (contour orange) et « Évacuer les chutes » d\'abord.');
  const p=t[0]; F.msg='';
  if(op==='guide') toGuide(p);
  else if(op==='end') endForEnd(p);
  else { const d={xm100:-100,xm10:-10,xm1:-1,xp1:1,xp10:10,xp100:100}[op]; if(d){ const hit=nudge(p,d/1000); if(hit) say('La pièce est contre la butée : relevez la butée (« Butée en service ») pour la faire avancer plus loin.','info'); } }
  clampPiece(p); app.ex.invalidate(); apply(); }
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>doOp(b.dataset.op));

/* ---------- commandes de la machine ---------- */
const num=(el,v)=>Math.max(+el.min,Math.min(+el.max,Math.round(+v||0)));
const stillBlade=()=>!st.motor && model.spin<0.05;
$('motor').onclick=()=>{ if(head.mode==='pull') return say('Finissez la coupe avant d\'arrêter la lame.'); st.motor=!st.motor; F.msg=''; apply(); };
$('asp').onclick=()=>{ st.asp=!st.asp; apply(); };
$('lock').onclick=()=>{ if(!parked()) return say('Ramenez d\'abord la lame en position arrière.'); st.lock=!st.lock; F.msg=''; apply(); };
function setAngle(key,v){ if(st[key]===v) return;
  if(!stillBlade()) return say('Arrêtez la lame et attendez son arrêt complet avant de changer l\'angle du bras ou l\'inclinaison.');
  if(!parked()) return say('Ramenez d\'abord la lame en position arrière.');
  if(st.lock) return say('Bras et tête bloqués : débloquez-les (« Bras et tête bloqués ») pour changer l\'angle, puis rebloquez-les.');
  st[key]=v; F.level='info'; F.msg= key==='alpha'? `Bras orienté à ${v}° : pensez à le rebloquer.` : `Lame inclinée à ${v}° : pensez à rebloquer la tête.`; app.ex.invalidate(); apply(); }
document.querySelectorAll('[data-alpha]').forEach(b=>b.onclick=()=>setAngle('alpha',+b.dataset.alpha));
document.querySelectorAll('[data-beta]').forEach(b=>b.onclick=()=>setAngle('beta',+b.dataset.beta));
function setProt(v){ if(!stillBlade()){ say('Arrêtez la lame avant de régler le protecteur : tous les réglages se font moteur arrêté.'); return; } st.prot=v; apply(); }
$('prot').addEventListener('input',e=>setProt(+e.target.value));
$('prot-n').addEventListener('change',e=>setProt(num($('prot'),e.target.value)));
function setStop(v){ v=Math.max(STOP_MIN,Math.min(STOP_MAX,v)); const t=onTable();
  if(st.stopOn && t.length>1){ say('Dégagez d\'abord la table (« Évacuer les chutes ») avant de déplacer la butée.'); return; }
  st.stopL=v; if(st.stopOn && t.length===1) clampPiece(t[0]); apply(); }
$('stop').addEventListener('input',e=>setStop(+e.target.value));
$('stop-n').addEventListener('change',e=>setStop(num($('stop'),e.target.value)));
$('stopOn').onclick=()=>{ const t=onTable();
  if(!st.stopOn && t.some(q=>extent(q).x1>stopX()+1e-4)) return say('La pièce passe sous la butée : faites-la glisser vers la servante avant d\'abaisser la butée.');
  st.stopOn=!st.stopOn; F.msg=''; apply(); };
$('hand').addEventListener('input',e=>{ st.handD=+e.target.value; apply(); });
$('hand-n').addEventListener('change',e=>{ st.handD=num($('hand'),e.target.value); apply(); });
$('pull').onclick=()=>{ if(head.mode!=='park') return say(head.mode==='front'? 'La lame est déjà en avant : ramenez-la en arrière.' : 'Coupe en cours.');
  const why=passBlock(); if(why) return say(why);
  app.recordDangers();                              // faute grave : alerte danger active au moment où l'on tire la lame
  head.target=strokeNeeded(); head.mode='pull'; F.msg=''; app.ex.invalidate(); apply(); };
$('ret').onclick=()=>{ if(head.mode==='pull') return say('Laissez la lame finir de traverser la pièce, en la retenant.'); if(head.mode!=='front') return; head.mode='back'; F.msg=''; app.ex.invalidate(); apply(); };

/* ---------- tête : tirée à travers la pièce, puis ramenée ---------- */
const PULL=0.40/STROKE, BACK=0.75/STROKE;   // vitesses à l'affichage (course par seconde)
function moveHead(dt){
  if(head.mode==='pull'){ head.s=Math.min(head.target,head.s+PULL*dt);
    if(head.s>=head.target){ const out=sawThrough(handXZ()); head.mode='front';
      const ms=out.map(q=>measure(q)).sort((a,b)=>b.L-a.L);
      cut.lastMsg= out.length? `Coupe faite : ${out.length} pièce${out.length>1?'s':''} (${ms.map(label).join(' ; ')}). Ramenez la lame en arrière`+(out.length>1?', puis gardez la pièce utile (contour orange) et « Évacuer les chutes ».':'.') : 'La lame n\'a rien coupé. Ramenez-la en arrière.';
      cut.msgSeq++; } return true; }
  if(head.mode==='back'){ head.s=Math.max(0,head.s-BACK*dt); if(head.s<=0){ head.mode='park'; cut.blocked=''; } return true; }
  return false; }

/* ---------- démarrage ---------- */
window.__radiale={ st, head, cut, pieces, measure };   // poignée pour les tests automatiques
let lastSeq=0;
app.start({
  update, alerts:()=>{ if(cut.msgSeq!==lastSeq){ lastSeq=cut.msgSeq; F.msg=cut.lastMsg; F.level='info'; } return computeAlerts(); },
  steps:STEPS,
  loadMode(m){ LOADERS[m](); model.stopNow(); lastSeq=cut.msgSeq; planKey=debitKey=''; if(m!=='libre') stage.setView('vop'); },
  renderExtra:renderDebit,
  panelKey:()=>[head.mode,pieces.length,onTable().length,cut.keep,st.stopOn],
  onPanel(){ const busy=head.mode==='pull'||head.mode==='back'; document.querySelectorAll('#tools button,#nudge button').forEach(b=>b.disabled=busy && b.dataset.op!=='reset'); },
  onPick(hit){ const q=hit && pieces.find(x=>x.id===hit.object.userData.pieceId); if(!q) return false; const m=measure(q);
    if(setKeep(q.id)){ F.level='info'; F.msg=`Pièce gardée : ${label(m)} (contour orange).`; app.ex.invalidate(); apply(); }
    $('info').innerHTML=`<b>${q.kind==='piece'?'Pièce':'Chute'} · ${fmt(m.L)} mm</b><span>${q.prof.T} × ${fmt(m.W,0)} mm · ${endTxt(m)}${m.defNames.length?' · avec '+m.defNames.join(', '):''}</span>`; return true; },
  tick(dt,now){ model.tick(dt,st.motor); const rdt=Math.min(0.5,now-(head.tPrev??now)); head.tPrev=now;   // course en temps réel (pas le pas d'image plafonné)
    if(moveHead(rdt)) apply(); else if(cut.msgSeq!==lastSeq) apply(); updateNudge(); },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, ignore:['piece'] },
});
