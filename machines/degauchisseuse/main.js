/* Dégauchisseuse KANAK 520 D : assemblage du module (modèle, pièce, règles, scénarios) sur le moteur commun. */
import { createApp } from '../../engine/app.js';
import { initSchema } from '../../engine/schema.js';
import { initFamilies } from '../../engine/families.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import fiches from './data/fiches.txt';
import { st, ctx, guideZ, $ } from './state.js';
import { buildModel } from './model.js';
import { initPiece, p, cut, build, place, updateFeed, stopPass, travelMax, faces, flatness, isFlat, rot, endForEnd, toGuide, markRef, markFocus, back, heightMm, thickness, width, FACE_NAME } from './piece.js';
import { computeAlerts, passBlock, protState, coverPose } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage, fiches });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
/* réglages par famille (couleurs, alertes dans leur panneau) et lien avec la 3D */
initFamilies(app, {
  parts:{ machine:['bati','moteur','transmission','aspiration'], outil:['arbre','table_entree','table_sortie','profondeur'],
    guidage:['guide','reglage_guide','carter'], protection:['protecteur'], pupitre:['pupitre','arret'] },
  summary:{
    machine:()=>`aspiration ${st.asp?'en marche':'arrêtée'}`,
    outil:()=>`passe ${fmt(st.d)} mm`,
    guidage:()=>`guide à ${fmt(st.ga)}° · passage ${Math.round(st.gw)} mm`,
    protection:()=>`bec ${st.bec==='plat'?'vertical (plat)':'horizontal (chant)'}`,
    avance:()=>`${Math.round(st.t)} mm`,
    piece:()=> p? `${p.L} × ${fmt(width())} × ${fmt(thickness())}` : 'aucune pièce' } });
initSchema({ pinIn:'famBar', sub:'vue de côté et vue en bout',
  html:'<svg id="sideSvg" viewBox="0 0 300 110" role="img" aria-label="Vue de côté : tables, arbre et profondeur de passe"></svg>', svgs:['protSvg'] });
ctx.app = app; ctx.model = model;
initPiece(app, model);
const F = app.ex.flash;
const fmt=(v,n=1)=>(+v).toLocaleString('fr-FR',{maximumFractionDigits:n});

/* ---------- schéma en bout : table, guide, pièce, et couverture telle qu'elle sera au passage de la pièce ---------- */
function drawProt(){ const el=$('protSvg'); if(!el) return; const P=p?protState():null;
  const sx=0.32, x0=12, yT=58, gx=x0+(520-st.gw)*sx;                       // 0,32 px/mm ; x0 = bord arrière (guide à fond)
  let g=`<rect x="${x0}" y="${yT}" width="${520*sx}" height="10" fill="var(--muted)" opacity=".35"/>`;
  g+=`<rect x="${gx-5}" y="${yT-40}" width="5" height="40" fill="var(--fg)" opacity=".7" transform="rotate(${-(90-st.ga)} ${gx} ${yT})"/>`;
  let by=yT-6, bx=gx;
  if(p){ const b=faces(), wz=(b.down[0]==='F'?p.W0:p.T0)*sx, hy=heightMm()*0.6*1.6, px=gx+(p.zOff*1000)*sx;
    g+=`<rect x="${px}" y="${yT-hy}" width="${wz}" height="${hy}" fill="#d9b98a" stroke="var(--muted)"/>`;
    if(st.bec==='plat') by=yT-hy-6; else bx=px+wz; }
  const ok=!!P&&P.ok;
  g+=`<rect x="${bx}" y="${by}" width="${x0+520*sx+24-bx}" height="6" fill="${ok?'var(--ok)':'#f0b323'}" stroke="var(--fg)" stroke-width=".6"/>`;
  g+=`<text x="4" y="10" font-size="8" fill="var(--muted)">vue en bout : couverture au passage de la pièce</text>`;
  g+=`<text x="216" y="78" font-size="7" text-anchor="end" fill="${ok?'var(--ok)':'var(--danger)'}">${!P?'':ok?(P.m==='plat'?'bec vertical : la couverture passe sur la pièce':'bec horizontal : la couverture plaque la pièce'):'bec mal orienté : arbre découvert'}</text>`;
  el.innerHTML=g; }

/* ---------- vue de côté : tables, arbre, profondeur de passe (exagérée) ---------- */
function drawSide(){ const el=$('sideSvg'); if(!el) return;
  const yS=70, ax=150, R=16, k=5, dy=st.d*k, warn=st.d>2;                       // profondeur exagérée : 5 px/mm
  let g=`<defs><pattern id="dgH" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--danger)" stroke-width="1.4"/></pattern>
    <marker id="dgA" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="var(--fg)"/></marker></defs>`;
  g+=`<rect x="8" y="${yS}" width="${ax-R-4-8}" height="22" fill="var(--muted)" opacity=".45"/><rect x="${ax+R+4}" y="${yS+dy}" width="${292-ax-R-4}" height="22" fill="var(--muted)" opacity=".45"/>`;
  g+=`<circle cx="${ax}" cy="${yS+R}" r="${R}" fill="none" stroke="var(--fg)" stroke-width="1" stroke-dasharray="3 2"/><circle cx="${ax}" cy="${yS+R}" r="5" fill="var(--fg)" opacity=".6"/>`;
  g+=`<text x="12" y="${yS+14}" font-size="8" fill="var(--fg)">table de sortie</text><text x="288" y="${yS+dy+14}" text-anchor="end" font-size="8" fill="var(--fg)">table d'entrée</text>`;
  if(p){ const h=26, top=yS+dy-h;                                                   // pièce posée sur la table d'entrée, avance vers la gauche
    g+=`<rect x="${ax+4}" y="${top}" width="${250-ax-4}" height="${h}" fill="#d9b98a" stroke="#8a6a40" stroke-width=".7"/>`;
    if(st.d>0) g+=`<rect x="${ax+4}" y="${yS}" width="${250-ax-4}" height="${dy}" fill="url(#dgH)" opacity=".8"/>`;
    g+=`<text x="${(ax+250)/2}" y="${top+14}" text-anchor="middle" font-size="8.5" fill="#5a4020">pièce ← avance</text>`; }
  g+=`<line x1="${ax+24}" y1="${yS}" x2="280" y2="${yS}" stroke="var(--muted)" stroke-dasharray="3 3"/>`;
  if(st.d>0) g+=`<line x1="268" y1="${yS-14}" x2="268" y2="${yS}" stroke="var(--fg)" stroke-width=".7" marker-end="url(#dgA)"/><line x1="268" y1="${yS+dy+14}" x2="268" y2="${yS+dy}" stroke="var(--fg)" stroke-width=".7" marker-end="url(#dgA)"/>`;
  g+=`<text x="296" y="${yS-30}" text-anchor="end" font-size="9.5" font-weight="600" fill="${warn?'#c98a12':'var(--fg)'}">passe ${fmt(st.d)} mm${warn?' : 2 mm au plus':''}</text>`;
  g+=`<text x="4" y="12" font-size="8" fill="var(--muted)">vue de côté (profondeur exagérée)</text>`;
  el.innerHTML=g; }

/* ---------- tableau des faces ---------- */
let facesKey='';
function renderFaces(){ if(!p){ $('facesTab').innerHTML=''; return; }
  const fc=faces(), pos={[fc.down]:'dessous',[fc.up]:'dessus',[fc.back]:'côté guide',[fc.front]:'côté opérateur'};
  const key=JSON.stringify([pos,p.face,flatness('F1'),flatness('F2'),flatness('C1'),flatness('C2')]); if(key===facesKey) return; facesKey=key;
  $('dimN').textContent=`${p.L} × ${fmt(width())} × ${fmt(thickness())}`;
  $('facesTab').innerHTML=['F1','F2','C1','C2'].map(f=>{ const s=p.face[f], fl=flatness(f);
    const etat= s.passes===0?'brute':s.tear?'arrachements':isFlat(f)?'dressée':'en cours';
    const mk= s.mark? (f[0]==='F'?' · repère':' · repère ∠') : '';
    const col= etat==='dressée'?'var(--ok)':etat==='arrachements'?'var(--danger)':'var(--fg)';
    return `<tr><td>${FACE_NAME[f]}</td><td>${pos[f]}</td><td style="color:${col}">${etat}${mk} · ${fmt(fl,2)} mm</td></tr>`; }).join(''); }

/* ---------- mise à jour complète ---------- */
function update(){
  updateFeed(passBlock);
  model.update(coverPose());
  $('o-travel').textContent=`${Math.round(st.t)} mm`; $('travel').value=st.t;
  $('o-depth').textContent=`${fmt(st.d)} mm`; $('depth').value=st.d;
  $('o-gangle').textContent=`${fmt(st.ga)}°`; $('gangle').value=st.ga;
  if(document.activeElement!==$('gwidth-n')) $('gwidth-n').value=Math.round(st.gw); $('gwidth').value=st.gw;
  $('becPlat').setAttribute('aria-pressed',String(st.bec==='plat')); $('becChant').setAttribute('aria-pressed',String(st.bec==='chant'));
  for(const k of ['motor','asp']) $(k).setAttribute('aria-pressed',String(st[k]));
  $('motor').textContent= st.motor? 'O · Moteur' : 'I · Moteur'; $('pupD').textContent=fmt(st.d);
  $('depth').disabled=$('gangle').disabled=$('gwidth').disabled=cut.inProgress;
  drawProt(); drawSide();
}
const apply=()=>app.apply();

/* ---------- manipulations de la pièce ---------- */
function doOp(op){ F.level='warn';
  if(op==='reset'){ app.ex.setMode(app.ex.mode); return; }
  if(!p) return;
  if(cut.inProgress){ F.msg='Terminez la passe en cours avant de toucher la pièce.'; app.ex.invalidate(); apply(); return; }
  if(op==='back'){ back(); F.msg=''; app.ex.invalidate(); apply(); return; }
  if(cut.done||st.t>0){ F.msg='Ramenez d\'abord la pièce sur la table d\'entrée en la soulevant (« Ramener la pièce »).'; app.ex.invalidate(); apply(); return; }
  stopPass(); F.msg='';
  if(op==='rot') rot(1); else if(op==='flip') rot(2); else if(op==='end') endForEnd();
  else if(op==='guide') toGuide();
  else if(op==='mark'){ const r=markRef();
    if(r.err) F.msg=r.err;
    else { place(); const c=markFocus(r.kind);   // vue rapprochée sur le repère
      if(c){ const o= r.kind==='v'? [0.10,0.22,0.32] : [0.12,0.36,0.32]; stage.setCam(c.map((v,i)=>v+o[i]), c); }
      F.level='info'; F.msg= r.kind==='v'
        ? `Repère d'angle tracé : un trait sur SR1 (${FACE_NAME[r.s1].toLowerCase()}) qui repart sur SR2 (${FACE_NAME[r.s2].toLowerCase()}). Le petit V montre l'angle droit. Bouton « Opérateur » pour revenir à la vue de travail.`
        : `Repère de parement tracé sur SR1 (${FACE_NAME[r.s1].toLowerCase()}), face sur le dessus. Bouton « Opérateur » pour revenir à la vue de travail.`; } }
  place(); app.stage.dirty(); app.ex.invalidate(); apply(); }

/* ---------- commandes ---------- */
const num=(el,v)=>Math.max(+el.min,Math.min(+el.max,v));
$('travel').addEventListener('input',e=>{ st.t=+e.target.value; stopPass(); apply(); });
$('depth').addEventListener('input',e=>{ st.d=+e.target.value; apply(); });
$('gangle').addEventListener('input',e=>{ st.ga=+e.target.value; apply(); });
$('gwidth').addEventListener('input',e=>{ st.gw=+e.target.value; apply(); });
$('gwidth-n').addEventListener('change',e=>{ st.gw=num($('gwidth'),Math.round(+e.target.value||0)); apply(); });
$('becPlat').onclick=()=>{ if(cut.inProgress) return; st.bec='plat'; apply(); };
$('becChant').onclick=()=>{ if(cut.inProgress) return; st.bec='chant'; apply(); };
$('motor').onclick=()=>{ st.motor=!st.motor; apply(); };
$('asp').onclick=()=>{ st.asp=!st.asp; apply(); };
let passT0=0, passFrom=0, passTo=0;
$('pass').onclick=()=>{ if(st.pass){ stopPass(); return; }
  if(cut.done){ F.msg='Ramenez d\'abord la pièce en la soulevant (« Ramener la pièce »).'; F.level='warn'; app.ex.invalidate(); apply(); return; }
  passFrom=st.t; passTo=travelMax(); passT0=performance.now()/1000; st.pass=true; F.msg=''; $('pass').setAttribute('aria-pressed','true'); };
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>doOp(b.dataset.op));

/* ---------- démarrage ---------- */
let lastSeq=0;
app.start({
  /* bruit (engine/audio.js, essai sur la toupie) : à remplir quand l'enseignant aura validé le rendu de la toupie ;
     bruit:{ niveaux:{ vide, coupe, rpm }, etat(){ return { on, rpm, spin, cut, charge, dents }; } }, */
  update, alerts:()=>{ const a=computeAlerts(); if(cut.msgSeq!==lastSeq){ lastSeq=cut.msgSeq; F.msg=cut.lastMsg; F.level=cut.lastMsg.startsWith('Arrachements')?'warn':'info'; } return a; },
  steps:STEPS,
  loadMode(m){ stopPass(); st.bec='plat'; cut.lastMsg=''; lastSeq=cut.msgSeq; LOADERS[m](); build(); $('travel').max=travelMax(); if(m!=='libre') stage.setView('vop'); },
  renderExtra:renderFaces,
  panelKey:()=>[cut.inProgress,cut.done,p&&p.face],
  onPanel(){ document.querySelectorAll('#tools button').forEach(b=>b.disabled=cut.inProgress && b.dataset.op!=='reset'); },
  onPick(hit){ if(hit && hit.object.userData.part==='piece' && p){ const fc=faces();
      $('info').innerHTML=`<b>Pièce ${p.L} × ${fmt(width())} × ${fmt(thickness())} mm</b><span>Dessous : ${FACE_NAME[fc.down].toLowerCase()} · contre le guide : ${FACE_NAME[fc.back].toLowerCase()} · dessus : ${FACE_NAME[fc.up].toLowerCase()}</span>`; return true; } return false; },
  tick(dt,now){ model.tick(dt);
    if(st.pass){ const dur=Math.max(2,Math.abs(passTo-passFrom)/400), t=Math.min(1,(now-passT0)/dur);
      st.t = passFrom + (passTo-passFrom)*t; apply(); if(t>=1) stopPass(); } },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, ignore:['piece'] },
});
