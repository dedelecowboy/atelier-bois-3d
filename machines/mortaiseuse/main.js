/* Mortaiseuse KANAK 130 MB : assemblage du module (modèle, bédanes, pièces, règles, scénarios) sur le moteur commun. */
import { createApp } from '../../engine/app.js';
import { initSchema } from '../../engine/schema.js';
import { initFamilies } from '../../engine/families.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import fiches from './data/fiches.txt';
import { BEDANES, bedById, REF0, OSC, ARAS, RULE_P, RULE_T, VER, PROF_MAX, BED_T, PAD_R, VER_MARGE } from './constants.js';
import { st, ctx, $, tool, taquets } from './state.js';
import { buildModel } from './model.js';
import * as C from '../../engine/corroyage.js';
import { initPieces, pieces, cyc, onTable, newPiece, startCycle, stopCycle, tickCycle, placeAll, aside, take, setKind, orient, build,
  span, refEnd, peekCam, plannedS0, curS0, tableX, depth, mortises, fromFace, nearEnd, tenonOf, fit, atLoad, H, D, fmt, dims, sr1, sr2, XR, FACE_NAME } from './piece.js';
import { computeAlerts, cycleBlock, clampCheck, sweeps, moving, running, INTERV, MAINS } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria, USEFUL, onCycleEnd, onIntervention, lot, traverse } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage, fiches });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
ctx.app = app; ctx.model = model;
initPieces(app, model);
const F = app.ex.flash;
const apply=()=>app.apply();
const say=(msg,level='warn')=>{ F.msg=msg; F.level=level; app.ex.invalidate(); apply(); };
const info=msg=>say(msg,'info');
const danger=(t)=>{ app.recordDangers([['danger',t]]); say('Geste refusé : '+t+'.','danger'); };
const mm=v=>fmt(v,v%1?1:0);
let pick=null;          // bédane choisi au râtelier

/* ---------- boutons générés : râtelier, taquets ---------- */
function renderLib(){ $('bedLib').innerHTML=BEDANES.map(b=>`<button class="toggle" type="button" data-bed="${b.id}" aria-pressed="false" data-bad="${b.etat!=='ok'}" title="${b.n} : épaisseur ${b.E} mm, largeur ${BED_T} mm">${b.n.replace('Bédane ','')}<small>${b.etat==='ok'?'dents en bon état':'2 dents ébréchées'}</small></button>`).join('');
  document.querySelectorAll('[data-bed]').forEach(b=>b.onclick=()=>{ pick=b.dataset.bed; F.msg=''; apply(); }); }
renderLib();
const TQC=['#2f9a4e','#e8a020','#c4261c','#2a7bd8'];
$('tqs').innerHTML=[0,1,2,3].map(i=>`<label class="tq-i"><b style="background:${TQC[i]}"></b><span>Taquet ${i+1}${i===0?' (origine)':''}</span><input class="num" id="tq${i}-n" type="number" min="0" max="350" step="1" aria-label="Taquet ${i+1} en mm">${i?`<button class="toggle mini" type="button" data-tqon="${i}" aria-pressed="true">En place</button>`:'<span></span>'}</label>`).join('');

/* ---------- schéma : vue de dessus de la table (pièce, vérins, courses du bédane) + coupe de la pièce au droit du bédane ---------- */
let planKey='';
function drawPlan(){ const q=onTable(), t=tool();
  const key=JSON.stringify([q&&[q.id,q.ref,q.L,q.k,q.flip,q.morts],st.tq,st.osc,st.ver,st.butG,st.butD,st.auto,st.X,st.ar,st.dep,st.arr,st.deb,st.tool,st.press]); if(key===planKey) return; planKey=key;
  const W=320, Hs=118, X0=-120, X1=1000, sx=(W-16)/(X1-X0), X=x=>8+(x-X0)*sx, ZF=26, Dp=q? D(q) : 70, Z=z=>ZF+z*0.55;
  let g='<defs><pattern id="hm" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#c76a14" fill-opacity=".2"/><line x1="0" y1="0" x2="0" y2="5" stroke="#c76a14" stroke-width="1.6"/></pattern></defs>';
  g+=`<rect x="0" y="${ZF-8}" width="${W}" height="8" fill="var(--fg)" opacity=".7"/><text x="${W-4}" y="${ZF-10}" text-anchor="end">guide</text>`;
  // butées
  for(const [x,on,n] of [[0,st.butG,'G'],[XR,st.butD,'D']]) g+=`<rect x="${X(x)-(n==='G'?4:0)}" y="${ZF-12}" width="4" height="${on?20:8}" fill="${on?'var(--fg)':'var(--muted)'}"/><text x="${X(x)+(n==='G'?-6:6)}" y="${ZF-14}" text-anchor="${n==='G'?'end':'start'}">butée ${n}${on?'':' (relevée)'}</text>`;
  if(q){ const [x0,x1]=span(q); g+=`<rect x="${X(x0)}" y="${Z(0)}" width="${X(x1)-X(x0)}" height="${Z(Dp)-Z(0)}" fill="#e2c294" stroke="#7a5428"/>`;
    for(const m of mortises(q)){ const e=refEnd(q), uA= q.flip? q.L-(m.fromA+m.len) : m.fromA, a=x0+uA; g+=`<rect x="${X(a)}" y="${Z(0)}" width="${(m.len)*sx}" height="${Math.min(Dp,m.dep)*0.55}" fill="#4e3e30" stroke="#2b2118"/>`; } }
  // courses prévues du bédane (hachurées) et profondeur
  const dep=Math.min(Dp,depth()); for(const s0 of sweeps(q)) g+=`<rect x="${X(s0)}" y="${Z(0)}" width="${st.osc*sx}" height="${Math.max(2,dep*0.55)}" fill="url(#hm)" stroke="#c76a14" stroke-width=".8"/>`;
  // vérins (patins vus de dessus) : verticaux sur le dessus près du guide, horizontaux contre la face avant
  const K=q? clampCheck(q) : {off:[],front:[]};
  for(const [k,lab] of [['v1','V1'],['v2','V2'],['h1','H1'],['h2','H2']]){ const x=st.ver[k], bad=K.off.includes(k)||K.front.includes(k), zc= k[0]==='v'? 12 : Dp+8;
    g+=`<circle cx="${X(x)}" cy="${Z(zc)}" r="${Math.max(3,PAD_R*sx)}" fill="${k[0]==='v'?'#2c7fd0':'#f2c418'}" stroke="${bad?'var(--danger)':'#333'}" stroke-width="${bad?2:.8}"/><text x="${X(x)}" y="${Z(zc)+(k[0]==='v'?-6:12)}" text-anchor="middle" class="c" style="fill:${bad?'var(--danger)':'var(--fg)'}">${lab}</text>`; }
  // taquets (distances depuis le bout contre la butée)
  const T=taquets(); g+=`<text x="4" y="${Hs-4}">taquets : ${T.map(x=>mm(x.v)).join(' · ')||'—'} · oscillation ${mm(st.osc)} mm${q?` · distance depuis le bout ${refEnd(q)} (butée ${q.ref==='D'?'droite':'gauche'})`:''}</text>`;
  $('planSvg').innerHTML=g;
  /* coupe au droit du bédane : pièce (hauteur × profondeur), bédane à l'arasement, profondeur, taquets */
  const Hp=q? H(q) : 28, CW=300, CH=120, s=Math.min(1.25,(CH-36)/(Hp+30)), ox=96, oy=CH-18, Xc=z=>ox+z*s, Yc=y=>oy-y*s;
  let c='<defs><marker id="ar2" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L6,3L0,6z" fill="var(--fg)"/></marker></defs>';
  c+=`<rect x="${Xc(-70)}" y="${Yc(0)}" width="${CW}" height="5" fill="#9aa1a7"/><text x="${CW-4}" y="${Yc(0)+14}" text-anchor="end">table</text>`;
  c+=`<rect x="${Xc(-10)}" y="${Yc(60*0.9)}" width="${10*s}" height="${60*0.9*s}" fill="var(--fg)" opacity=".55"/><text x="${Xc(-12)}" y="${Yc(60*0.9)-3}" text-anchor="end">guide</text>`;
  if(q){ c+=`<rect x="${Xc(0)}" y="${Yc(Hp)}" width="${Dp*s}" height="${Hp*s}" fill="#e2c294" stroke="#7a5428"/>`; }
  if(t){ const E=t.E, zt=st.R-REF0, d=depth();
    c+=`<rect x="${Xc(Math.min(0,zt)-60)}" y="${Yc(st.ar+E)}" width="${60*s}" height="${E*s}" fill="#6b737a" fill-opacity=".35" stroke="#3a3f45"/>`;
    if(q) c+=`<rect x="${Xc(0)}" y="${Yc(st.ar+E)}" width="${Math.min(Dp,d)*s}" height="${E*s}" fill="url(#hm)" stroke="#c76a14"/>`;
    c+=`<line x1="${Xc(d)}" y1="${Yc(Hp+16)}" x2="${Xc(d)}" y2="${Yc(-2)}" stroke="#c4261c" stroke-width="1.2" stroke-dasharray="3 2"/><text x="${Xc(d)+3}" y="${Yc(Hp+16)+8}" style="fill:#c4261c">arrêt ${mm(st.arr)}</text>`;
    c+=`<line x1="${Xc(st.dep-REF0)}" y1="${Yc(Hp+12)}" x2="${Xc(st.dep-REF0)}" y2="${Yc(-2)}" stroke="#2f7d4f" stroke-width="1.2" stroke-dasharray="3 2"/><text x="${Xc(st.dep-REF0)-3}" y="${Yc(Hp+12)+8}" text-anchor="end" style="fill:#2f7d4f">départ ${mm(st.dep)}</text>`;
    c+=`<line x1="${Xc(-36)}" y1="${Yc(0)}" x2="${Xc(-36)}" y2="${Yc(st.ar)}" stroke="var(--fg)" stroke-width=".8" marker-start="url(#ar2)" marker-end="url(#ar2)"/><text x="${Xc(-38)}" y="${(Yc(0)+Yc(st.ar))/2+3}" text-anchor="end" class="c">${mm(st.ar)}</text>`;
    c+=`<line x1="${Xc(-24)}" y1="${Yc(st.ar)}" x2="${Xc(-24)}" y2="${Yc(st.ar+E)}" stroke="var(--fg)" stroke-width=".8" marker-start="url(#ar2)" marker-end="url(#ar2)"/><text x="${Xc(-22)}" y="${(Yc(st.ar)+Yc(st.ar+E))/2+3}" class="c">${E}</text>`;
    if(!st.deb) c+=`<line x1="${Xc(0)}" y1="${Yc(-8)}" x2="${Xc(d)}" y2="${Yc(-8)}" stroke="var(--fg)" stroke-width=".8" marker-start="url(#ar2)" marker-end="url(#ar2)"/><text x="${(Xc(0)+Xc(d))/2}" y="${Yc(-8)+10}" text-anchor="middle" class="c">${mm(d)}</text>`; }
  c+=`<text x="4" y="10" style="fill:#c76a14">hachuré : matière enlevée · cotes : arasement, épaisseur du bédane, profondeur (arrêt − 71)</text>`;
  $('coupeSvg').innerHTML=c; }

/* ---------- mortaises de la pièce, pièces débitées ---------- */
let profKey='';
function renderProfile(){ const q=onTable();
  if(!q){ $('mortTab').innerHTML=''; $('profN').textContent=''; $('pmes').innerHTML='Aucune pièce sur la table : « Reprendre » une pièce dans « Pièces débitées ».'; return; }
  const fc=C.faces(q), key=JSON.stringify([q.id,q.k,q.flip,q.ref,q.L,q.morts]); if(key===profKey) return; profKey=key;
  $('profN').textContent=`${q.name} · ${dims(q)}`;
  const mk=f=>q.face[f].mark==='loop'?' (SR1)':q.face[f].mark==='v'?' (SR2)':'';
  const s1=sr1(q)||'F1', M=mortises(q), T=tenonOf(traverse(),'A');
  const rows=M.map((m,i)=>{ const n=nearEnd(m), f=fit(m,T,s1,'F1');
    return `<tr><td>Mortaise ${i+1} : ${FACE_NAME[m.face].toLowerCase()}${mk(m.face)}</td><td>${fmt(m.th)} × ${fmt(m.len)} mm · profondeur ${m.through?'débouchante':fmt(m.dep)+' mm'} · à ${fmt(fromFace(m,s1))} mm de SR1 · à ${fmt(n.d)} mm du bout ${n.e}${m.plunges>1?` · ${m.plunges} plongées`:''}</td><td style="color:${m.ec?'var(--danger)':'var(--ok)'}">${m.ec?'éclats':'net'}</td></tr>`
      + (Math.abs(m.th-T.th)<1 ? `<tr><td>  · tenon de traverse 8 × 35 × 60</td><td>${f.ok?'il entre : assemblage correct':f.why}</td><td style="color:${f.ok?'var(--ok)':'var(--danger)'}">${f.ok?'✓':'✗'}</td></tr>` : ''); });
  $('mortTab').innerHTML= rows.length? rows.join('') : '<tr><td colspan="3">Pas encore de mortaise.</td></tr>';
  $('pmes').innerHTML=`<b>${q.name}</b> ${fmt(q.L,0)} mm · sur la table : ${FACE_NAME[fc.down].toLowerCase()}${mk(fc.down)} · contre le guide : ${FACE_NAME[fc.back].toLowerCase()}${mk(fc.back)} · contre la butée ${q.ref==='D'?'droite':'gauche'} (bout ${refEnd(q)})`; }
let debitKey='';
function renderDebit(){ const list=pieces.filter(q=>q.state==='stock');
  const key=JSON.stringify([list.map(q=>[q.id,q.kind,q.morts]),cyc.on]); if(key===debitKey) return; debitKey=key;
  const ni=list.filter(q=>q.kind==='interdite').length; $('debitN').textContent=list.length?`${list.length} pièce${list.length>1?'s':''}${ni?` · ${ni} écartée${ni>1?'s':''}`:''}`:'';
  $('debit').innerHTML= list.length? list.map(q=>{ const n=mortises(q).length;
      return `<li data-k="${q.kind}"><div><b>${q.name} · ${dims(q)}</b> <small>${n? n+' mortaise'+(n>1?'s':'') : 'pas de mortaise'}</small></div>
        <div class="d-act"><button class="toggle mini" type="button" data-kind="${q.id}" aria-pressed="${q.kind==='interdite'}" title="Pièce à ne pas mortaiser (trop courte ou trop mince)">${q.kind==='interdite'?'Pas à la mortaiseuse':'Pièce'}</button><button class="toggle mini" type="button" data-take="${q.id}">Reprendre</button></div></li>`; }).join('')
    : '<li class="debit-empty">Les pièces du lot en attente et les pièces mises de côté apparaissent ici.</li>';
  document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{ if(!handGuard()) return; if(st.press) return say('Desserrez d\'abord les vérins (bouton noir).');
    const why=take(+b.dataset.take); if(why) return say(why); const q=onTable(); if(q){ const o=otherButee(q); if(o){ q.state='stock'; build(q); debitKey=''; return say(`La butée ${o} est abaissée dans la longueur de la pièce : relevez-la avant de poser la pièce.`); } } F.msg=''; app.ex.invalidate(); apply(); });
  document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ setKind(+b.dataset.kind); debitKey=''; app.ex.invalidate(); apply(); }); }
function renderExtra(){ renderProfile(); renderDebit(); drawPlan(); }

/* ---------- réglages par famille et lien avec la 3D ---------- */
initFamilies(app, {
  parts:{ machine:['bati','armoire','hydraulique','capot','aspiration','sectionneur'],
    outil:['bedane','porte_outil','tete','ratelier','cle','vernier'], cotes:['reglage_haut','taquets_prof'],
    guidage:['table','regle_table','guide','butee_g','butee_d','cale'], protection:['verin_v','verin_h','portique'], piece:['piece'],
    pupitre:['pupitre','arret_urgence','marche','sel_bedane','sel_auto','btn_verins','btn_depression'] },
  summary:{
    machine:()=> st.cad? 'consignée' : !st.main? 'hors tension' : st.capot? 'capot ouvert' : st.on? 'en route' : 'sous tension',
    outil:()=>{ const t=tool(); return t? `${t.n}${st.tight?'':' (desserré)'} · oscillation ${mm(st.osc)} mm` : 'aucun bédane'; },
    cotes:()=>`profondeur ${st.deb?'débouchante':mm(Math.max(0,st.arr-REF0))+' mm'} · arasement ${mm(st.ar)} mm`,
    guidage:()=>`taquets ${taquets().map(t=>mm(t.v)).join(' · ')} · butée ${st.butG&&st.butD?'G et D':st.butG?'gauche':st.butD?'droite':'—'}`,
    protection:()=>`${st.press?'en pression':'desserrés'} · V ${mm(st.ver.v1)} / ${mm(st.ver.v2)} · H ${mm(st.ver.h1)} / ${mm(st.ver.h2)}`,
    piece:()=>{ const q=onTable(); return q? dims(q) : 'aucune pièce sur la table'; } } });
const schema=initSchema({ pinIn:'famBar', sub:'vue de dessus de la table et coupe au droit du bédane',
  html:'<svg class="plan-svg" id="planSvg" viewBox="0 0 320 118" role="img" aria-label="Vue de dessus : guide, butées, pièce, vérins et courses du bédane"></svg><svg class="coupe-svg" id="coupeSvg" viewBox="0 0 300 120" role="img" aria-label="Coupe de la pièce au droit du bédane : arasement, épaisseur du bédane, profondeur"></svg>' });

/* ---------- mise à jour complète ---------- */
function update(){
  placeAll();
  const q=onTable(); model.update(q? {H:H(q),D:D(q)} : null);
  for(const k of ['main','cad','asp','capot','butG','butD']) $(k).setAttribute('aria-pressed',String(!!st[k]));
  $('main').textContent= st.main? 'Interrupteur général : I' : 'Interrupteur général : 0';
  $('cad').textContent= st.cad? 'Consignée (cadenas)' : 'Consigner';
  $('capot').textContent= st.capot? 'Capot ouvert' : 'Capot fermé';
  $('butG').textContent= st.butG? 'Butée gauche abaissée' : 'Butée gauche relevée'; $('butD').textContent= st.butD? 'Butée droite abaissée' : 'Butée droite relevée';
  $('au').setAttribute('aria-pressed',String(st.au)); $('au').textContent= st.au? 'Arrêt d\'urgence enfoncé' : 'Arrêt d\'urgence';
  $('green').setAttribute('aria-pressed',String(st.on)); $('green').textContent= st.on? 'Machine en route' : 'Mise en route';
  $('press').setAttribute('aria-pressed',String(st.press)); $('press').textContent= st.press? 'Vérins en pression' : 'Vérins ⇩ 2 mains';
  $('pupAuto').setAttribute('aria-pressed',String(st.auto)); $('pupAuto').textContent= st.auto? 'Auto' : 'Manuel';
  $('pupDeb').setAttribute('aria-pressed',String(st.deb)); $('pupDeb').textContent= st.deb? 'Débouchante' : 'Non débouchante';
  $('bed').setAttribute('aria-pressed',String(st.bed)); $('bed').textContent= st.bed? (cyc.on&&!cyc.manual?'Cycle en cours':'Bédane : 1') : 'Bédane : 0';
  $('pupP').textContent= st.deb? 'déb.' : mm(Math.max(0,st.arr-REF0)); $('pupA').textContent=fmt(st.ar);
  $('tight').setAttribute('aria-pressed',String(st.tight)); $('tight').textContent= st.tight? 'Vis serrée' : 'Vis desserrée';
  { const b=document.querySelector('[data-op="peek"]'); if(b) b.setAttribute('aria-pressed',String(!!q?.peek)); }
  document.querySelectorAll('[data-bed]').forEach(b=>{ b.setAttribute('aria-pressed',String(b.dataset.bed===pick)); b.dataset.mounted=String(b.dataset.bed===st.tool); });
  const t=tool(); $('o-bed').textContent= t? t.n.replace('Bédane ','')+(st.tight?'':' · desserré') : 'aucun';
  $('bedInfo').textContent= (t? `Monté : ${t.n} (mortaise de ${t.E} mm), ${t.etat==='ok'?'dents en bon état':'DENTS ÉBRÉCHÉES'}, vis ${st.tight?'serrée':'desserrée'}.` : 'Aucun bédane monté.')+(pick&&pick!==st.tool?` Choisi au râtelier : ${bedById(pick).n}.`:'');
  const setR=(id,v,n=0)=>{ $(id).value=v; if(document.activeElement!==$(id+'-n')) $(id+'-n').value=(+v).toFixed(n); };
  setR('osc',st.osc); setR('dep',st.dep); setR('arr',st.arr); setR('ar',st.ar,1);
  for(let i=0;i<4;i++){ const v=st.tq[i], n=$(`tq${i}-n`); if(document.activeElement!==n) n.value= v===null? '' : (+v).toFixed(0); n.disabled= v===null||cyc.on;
    const b=document.querySelector(`[data-tqon="${i}"]`); if(b){ b.setAttribute('aria-pressed',String(v!==null)); b.textContent= v!==null? 'En place' : 'Retiré'; } }
  for(const k of ['v1','v2','h1','h2']) if(document.activeElement!==$(k+'-n')) $(k+'-n').value=(+st.ver[k]).toFixed(0);
  $('cotInfo').textContent=`Profondeur ${st.deb?'débouchante (arrêt ignoré)':mm(Math.max(0,st.arr-REF0))+' mm = '+mm(st.arr)+' − 71'} · départ ${mm(st.dep)} (${st.dep<REF0?'avant 71 : le bédane prend sa vitesse':'APRÈS 71'}) · mortaise de ${t?t.E:'—'} mm à ${mm(st.ar)} mm de la table`;
  { const T=taquets(), P=T.length>1? T.slice(1).map(x=>x.v-T[0].v) : [];
    $('tqInfo').textContent= P.length? `Plongées à ${P.map(mm).join(' et ')} mm du bout contre la butée, chacune de ${mm(st.osc)} mm : mortaise de ${mm(Math.max(...P)-Math.min(...P)+st.osc)} mm si elles se touchent.` : 'Aucune plongée : il faut au moins deux taquets.'; }
  { const K=q? clampCheck(q) : null; $('verInfo').textContent= !q? 'Pas de pièce sur la table.' : `${K.off.length?'Vérin hors de la pièce : '+K.off.join(', ')+'. ':''}${K.front.length?'Vérin devant le bédane : '+K.front.join(', ')+'. ':''}${!K.off.length&&!K.front.length?'Les 4 vérins sont sur la pièce, hors de la course du bédane (± '+VER_MARGE+' mm).':''}`; }
  for(const id of ['osc','osc-n','dep','dep-n','arr','arr-n','ar','ar-n','v1-n','v2-n','h1-n','h2-n']) $(id).disabled=cyc.on;
  usefulButtons();
}
/* ---------- boutons utiles à chaque exercice (tous en mode libre) ---------- */
function usefulButtons(){ const m=app.ex.mode, U=m==='libre'? null : USEFUL[m]||null;
  document.querySelectorAll('#tools [data-op]').forEach(b=>{ b.hidden= !!U && b.dataset.op!=='reset' && !U.ops.includes(b.dataset.op); });
  $('quick').hidden= !!U && !U.quick;
  for(const id of ['pupDeb','plonge','jog']) $(id).hidden= !!U && !U.manual;
  $('pupAuto').hidden= !!U && !U.manual; }

/* ---------- gardes ---------- */
/* réglage : bédane arrêté (blocage, pas une faute) */
function setGuard(what, capot=false){
  if(cyc.on){ say('Cycle en cours : attendez la fin du cycle.'); return false; }
  if(st.bed){ say(`Arrêtez le bédane (sélecteur sur 0) avant de ${what} : les réglages se font bédane arrêté.`); return false; }
  if(moving()){ say(`Attendez l'arrêt complet du bédane avant de ${what}.`); return false; }
  if(capot && !st.capot){ say(`Ce réglage est sous le capot : ouvrez le capot de protection avant de ${what}.`); return false; }
  return true; }
/* intervention sur le bédane : capot ouvert, machine consignée (sinon faute grave, geste refusé) */
function toolGuard(what){ if(!setGuard(what)) return false;
  if(!st.capot){ say(`Le porte-bédane est sous le capot : ouvrez d'abord le capot pour ${what}.`); return false; }
  if(!st.cad){ danger(INTERV); return false; }
  onIntervention(); return true; }
/* pièce : bédane arrêté et cycle fini (sinon faute grave, geste refusé), table au taquet 1 */
function handGuard(){ if(cyc.on || st.bed || moving()){ danger(MAINS); return false; }
  if(!atLoad()){ say('La table n\'est pas au taquet 1 : ramenez-la (mode manuel : « Table : taquet suivant » jusqu\'au retour).'); return false; } return true; }
/* l'autre butée abaissée dans la longueur de la pièce posée */
function otherButee(q){ const [x0,x1]=span(q); if(st.butD && q.ref!=='D' && x1>XR+0.5 && x0<XR-0.5) return 'droite'; if(st.butG && q.ref!=='G' && x0<-0.5 && x1>0.5) return 'gauche'; return null; }
const stopBed=()=>{ st.bed=false; if(cyc.on){ const man=cyc.manual; stopCycle('Cycle interrompu : le bédane a été arrêté. La tête est revenue au taquet de départ'+(man?'.':', la table au taquet 1.')); if(!man){ st.X=0; placeAll(); } } st.R=st.dep; };

/* ---------- commandes de la machine ---------- */
$('main').onclick=()=>{ if(st.main){ st.main=false; st.on=false; stopBed(); apply(); return; }
  if(st.cad) return say('Machine consignée : retirez le cadenas (« Consignée ») avant de remettre sous tension.'); st.main=true; info('Machine sous tension : bouton vert pour la mettre en route.'); };
$('cad').onclick=()=>{ if(st.cad){ st.cad=false; st.essai=false; F.msg=''; apply(); return; }
  if(st.main) return say('Pour consigner : interrupteur général sur 0 d\'abord, puis le cadenas.');
  if(moving()) return say('Attendez l\'arrêt complet du bédane.'); st.cad=true; st.essai=false; info('Cadenas posé sur l\'interrupteur général, clé dans votre poche. Faites l\'essai de démarrage : bouton vert, rien ne doit démarrer.'); };
$('asp').onclick=()=>{ st.asp=!st.asp; apply(); };
$('capot').onclick=()=>{ if(st.capot){ st.capot=false; info('Capot refermé : le bédane peut redémarrer.'); return; }
  if(cyc.on||st.bed||moving()) return say('Capot verrouillé tant que le bédane oscille : sélecteur du bédane sur 0, attendez l\'arrêt complet.');
  st.capot=true; F.msg=''; apply(); };
$('au').onclick=()=>{ if(st.au){ st.au=false; info('Coup de poing déverrouillé (tourné) : bouton vert pour remettre en route.'); return; } st.au=true; st.on=false; stopBed(); info('Arrêt d\'urgence : la machine est arrêtée.'); };
$('green').onclick=()=>{ if(st.cad){ st.essai=true; return info('Essai de démarrage : rien ne démarre. La consignation est efficace, vous pouvez intervenir.'); }
  if(!st.main) return say('Interrupteur général sur 0 : la machine est hors tension.');
  if(st.au) return say('Arrêt d\'urgence enfoncé : tournez-le pour le déverrouiller.');
  if(st.on) return; st.on=true; F.msg=''; apply(); };
$('press').onclick=()=>{ if(st.press) return; if(onTable()?.peek) return say('Reposez d\'abord la pièce (« Voir les mortaises »).'); if(!st.main||st.cad||!st.on) return say('Machine pas en route : bouton vert d\'abord (le groupe hydraulique serre les vérins).');
  if(!onTable()) return say('Pas de pièce sur la table.'); if(!atLoad()) return say('Table pas au taquet 1.');
  st.press=true; info('Vérins en pression : les deux boutons blancs, appuyés ensemble, gardent les deux mains sur le pupitre, loin des patins (risque d\'écrasement).'); };
$('depress').onclick=()=>{ if(cyc.on) return say('Cycle en cours : attendez la fin du cycle avant de desserrer.'); if(!st.press) return; st.press=false; F.msg=''; apply(); };
$('pupAuto').onclick=()=>{ if(cyc.on||st.bed) return say('Arrêtez le bédane avant de changer de mode.'); st.auto=!st.auto; apply(); };
$('pupDeb').onclick=()=>{ if(cyc.on) return say('Cycle en cours.'); st.deb=!st.deb; apply(); };
$('bed').onclick=()=>{ if(st.bed){ stopBed(); apply(); return; }
  if(onTable()?.peek) return say('Reposez d\'abord la pièce sur la table (« Voir les mortaises »).');
  if(st.auto){ const why=startCycle(false,cycleBlock); if(why) return say(why); st.bed=true; F.msg=''; app.ex.invalidate(); apply(); return; }
  const why=cycleBlock(onTable(),true); if(why && !/oscille/.test(why)) return say(why); st.bed=true; F.msg=''; apply(); };
$('plonge').onclick=()=>{ if(st.auto) return say('Mode automatique : le cycle se lance par le sélecteur du bédane.'); const why=startCycle(true,cycleBlock); if(why) return say(why); F.msg=''; apply(); };
$('jog').onclick=()=>{ if(st.auto) return say('Mode automatique : la table se déplace seule pendant le cycle.'); if(cyc.on) return say('Plongée en cours.');
  if(!st.main||st.cad||!st.on) return say('Machine pas en route : bouton vert.');
  const q=onTable(), S=plannedS0(q); if(!S.length) return say('Aucun taquet de plongée sur la règle.');
  const cur=curS0(), i=S.findIndex(s=>Math.abs(s-cur)<0.5), nx= atLoad()? S[0] : (i<0||i===S.length-1? null : S[i+1]);
  st.X= nx===null? 0 : tableX(nx); placeAll(); info(nx===null? 'Table revenue au taquet 1 (position de chargement).' : `Table au taquet suivant : course du bédane à ${mm(nx)} mm.`); };

/* ---------- bédane : râtelier, vis, montage ---------- */
$('tight').onclick=()=>{ if(!tool()) return say('Aucun bédane monté.'); if(!toolGuard(st.tight?'desserrer la vis du porte-bédane':'serrer la vis du porte-bédane')) return; st.tight=!st.tight;
  info(st.tight? 'Vis du porte-bédane serrée (clé du porte-bédane).' : 'Vis desserrée : le bédane peut être retiré.'); };
$('unmount').onclick=()=>{ if(!tool()) return say('Aucun bédane monté.'); if(!toolGuard('démonter le bédane')) return;
  if(st.tight) return say('Desserrez d\'abord la vis du porte-bédane.'); st.tool=null; info('Bédane démonté et rangé au râtelier.'); };
$('mount').onclick=()=>{ if(!pick) return say('Choisissez d\'abord un bédane au râtelier.'); if(tool()) return say('Un bédane est déjà monté : démontez-le d\'abord.'); if(!toolGuard('monter le bédane')) return;
  st.tool=pick; st.tight=false; const b=bedById(pick); info(`${b.n} engagé à fond dans le porte-bédane${b.etat==='ok'?'':' (ATTENTION : dents ébréchées)'}. Serrez la vis.`); };
$('quick').onclick=()=>{ if(!pick) return say('Choisissez d\'abord le bédane au râtelier (épaisseur de la mortaise).'); const b=bedById(pick);
  if(b.etat!=='ok') return say(`${b.n} : 2 dents ébréchées, il ne doit pas être monté. Choisissez un bédane en bon état et prévenez le professeur.`);
  if(!setGuard('changer le bédane')) return;
  st.main=false; st.on=false; st.cad=true; st.essai=true; st.capot=true; onIntervention(); st.tool=pick; st.tight=true; st.capot=false; st.cad=false; st.essai=false; st.main=true;
  info(`Procédure complète : interrupteur sur 0, cadenas, essai de démarrage, capot ouvert, ancien bédane desserré et démonté, ${b.n} monté et serré, capot refermé, cadenas retiré, interrupteur sur I. Bouton vert pour remettre en route.`); };

/* ---------- réglages numériques ---------- */
const clamp=(v,[a,b])=>Math.max(a,Math.min(b,v));
function numCtl(id, set, what, capot){ const h=v=>{ if(!setGuard(what,capot)){ apply(); return; } set(+v); F.msg=''; apply(); };
  $(id)?.addEventListener('input',e=>h(e.target.value)); $(id+'-n')?.addEventListener('change',e=>h(e.target.value)); }
numCtl('osc', v=>{ st.osc=Math.round(clamp(v,OSC)); }, 'régler l\'oscillation (vernier)');
numCtl('dep', v=>{ st.dep=Math.round(clamp(v,RULE_P)); st.R=st.dep; }, 'déplacer le taquet de départ');
numCtl('arr', v=>{ st.arr=Math.round(clamp(v,RULE_P)); }, 'déplacer le taquet d\'arrêt');
numCtl('ar', v=>{ st.ar=Math.round(clamp(v,ARAS)*10)/10; }, 'régler la hauteur du bédane (clé de 27)', true);
for(let i=0;i<4;i++){ $(`tq${i}-n`).addEventListener('change',e=>{ if(!setGuard('déplacer un taquet de la table')||!atLoad()){ if(!atLoad()) say('Ramenez la table au taquet 1.'); return apply(); }
  st.tq[i]=Math.round(clamp(+e.target.value,RULE_T)); F.msg=''; apply(); }); }
document.querySelectorAll('[data-tqon]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.tqon; if(!setGuard(st.tq[i]===null?'remettre un taquet':'retirer un taquet')) return;
  st.tq[i]= st.tq[i]===null? Math.min(350,(st.tq[i-1]??0)+50) : null; F.msg=''; apply(); });
for(const k of ['v1','v2','h1','h2']) $(k+'-n').addEventListener('change',e=>{ if(cyc.on){ say('Cycle en cours.'); return apply(); } if(st.press){ say('Desserrez d\'abord les vérins (bouton noir) pour les déplacer.'); return apply(); }
  st.ver[k]=Math.round(clamp(+e.target.value,VER)); F.msg=''; apply(); });
const butGuard=()=>{ if(cyc.on){ say('Cycle en cours.'); return false; } return true; };
$('butG').onclick=()=>{ if(!butGuard()) return; const q=onTable(); if(!st.butG && q && q.ref!=='G'){ const [x0,x1]=span(q); if(x0<-0.5&&x1>0.5) return say('La butée gauche tomberait sur la pièce : déplacez la pièce, ou laissez la butée relevée.'); } st.butG=!st.butG; F.msg=''; apply(); };
$('butD').onclick=()=>{ if(!butGuard()) return; const q=onTable(); if(!st.butD && q && q.ref!=='D'){ const [x0,x1]=span(q); if(x0<XR-0.5&&x1>XR+0.5) return say('La butée droite tomberait sur la pièce : déplacez la pièce, ou laissez la butée relevée.'); } st.butD=!st.butD; F.msg=''; apply(); };

/* « Voir les mortaises » : caméra rapprochée sur la première mortaise (ou sur la pièce, s'il n'y en a pas) */
function peekView(q){ const m=mortises(q)[0];
  if(!m){ const c=peekCam(q); stage.setCam(c.pos,c.tgt); return; }
  q.mesh.updateMatrixWorld(true); const v=q.mesh.localToWorld(new stage.THREE.Vector3((m.fromA+m.len/2)/1000-q.L/2000,0,0)), d=0.26+m.len/1000;
  stage.setCam([v.x+0.04, v.y+d*0.55, v.z+d], [v.x, v.y, v.z]); }
/* ---------- manipulations de la pièce ---------- */
function doOp(op){
  if(op==='reset'){ app.ex.setMode(app.ex.mode); return; }
  if(!handGuard()) return;
  const q=onTable();
  if(!q) return say('Pas de pièce sur la table : « Reprendre » une pièce dans « Pièces débitées ».');
  if(st.press) return say('Desserrez d\'abord les vérins (bouton noir).');
  if(op==='peek'){ q.peek=!q.peek; build(q); if(q.peek){ peekView(q); schema.pin(false); } else stage.setView('vop'); F.msg=''; app.ex.invalidate(); apply();
    if(q.peek) info(mortises(q).length? 'Pièce soulevée et tournée vers vous : la face qui était contre le guide, avec ses mortaises. « Voir les mortaises » encore une fois pour la reposer contre la butée.' : 'Pièce soulevée et tournée vers vous : pas encore de mortaise sur la face qui était contre le guide.'); return; }
  if(q.peek){ q.peek=false; build(q); }
  if(op==='aside'){ const why=aside(); if(why) return say(why); F.msg=''; debitKey=''; app.ex.invalidate(); apply(); return; }
  if(op==='left'||op==='right'){ const R=op==='left'?'G':'D';
    if(!(R==='G'?st.butG:st.butD)) return say(`Butée ${R==='G'?'gauche':'droite'} relevée : abaissez-la d'abord.`);
    const old=q.ref; q.ref=R; const o=otherButee(q); if(o){ q.ref=old; return say(`La butée ${o} est abaissée dans la longueur de la pièce : relevez-la d'abord.`); }
    build(q); F.msg=''; app.ex.invalidate(); apply(); return; }
  orient(q,op); F.msg=''; app.ex.invalidate(); apply(); }
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>doOp(b.dataset.op));
$('resetPres').onclick=()=>{ if(cyc.on) return say('Cycle en cours : attendez la fin du cycle.'); app.ex.setMode(app.ex.mode); info('Pièce de départ remise sur la table, machine arrêtée.'); };

/* ---------- démarrage ---------- */
let lastSeq=0;
app.start({
  /* bruit (engine/audio.js, essai sur la toupie) : à remplir quand l'enseignant aura validé le rendu de la toupie ;
     bruit:{ niveaux:{ vide, coupe, rpm }, etat(){ return { on, rpm, spin, cut, charge, dents }; } }, */
  update, alerts:()=>{ if(cyc.seq!==lastSeq){ lastSeq=cyc.seq; F.msg=cyc.msg; F.level=/(éclat|interrompu|pas touché)/.test(cyc.msg)?'warn':'info'; onCycleEnd(); } return computeAlerts(); },
  steps:STEPS,
  loadMode(m){ LOADERS[m](); model.stopNow(); lastSeq=cyc.seq; profKey=debitKey=planKey=''; pick=null; F.msg=''; renderLib(); if(m!=='libre') stage.setView(m==='bedane'?'vbed':'vop'); },
  renderExtra,
  panelKey:()=>[cyc.on,cyc.phase,pieces.map(q=>q.state+q.kind).join(),st.bed,st.cad,st.capot,st.press,model.amp>0.02,model.amp>0.9,app.ex.mode],
  onPanel(){},   // boutons de la pièce jamais grisés : pendant le cycle, le geste est refusé (faute grave « mains dans la zone de l'outil »)
  onPick(hit){ const q=hit && pieces.find(x=>x.id===hit.object.userData.pieceId); if(!q) return false; const fc=C.faces(q);
    $('info').innerHTML=`<b>${q.name} · ${dims(q)} mm</b><span>Sur la table : ${FACE_NAME[fc.down].toLowerCase()}${fc.down===sr1(q)?' (SR1)':''} · contre le guide : ${FACE_NAME[fc.back].toLowerCase()}${fc.back===sr2(q)?' (SR2)':''} · ${mortises(q).length} mortaise(s)</span>`; return true; },
  tick(dt,now){ const moved=tickCycle(now, ()=>st.bed && st.on && !st.au && st.main && !st.cad);
    if(model.tick(dt)||moved||cyc.seq!==lastSeq) apply(); },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, ignore:['piece'] },
});
/* poignée pour les tests et pour la future page « atelier » : importPiece(pieceJSON d'une autre machine) pose la pièce sur la table ;
   tenon(json) lit le tenon d'une traverse de la tenonneuse ; assemble(idMontant, jsonTraverse) dit si le tenon entre dans la mortaise */
window.__mortaise={ st, pieces, cyc, C, model, mortises, lot, fit, tenonOf, traverse, atLoad,
  importPiece(json,name='Pièce'){ if(onTable()) aside(); const q=newPiece({json,name}); apply(); return q.id; },
  tenon(json){ const q=C.makePiece(json); return tenonOf(q,'A')||tenonOf(q,'B'); },
  assemble(id,json){ const q=pieces.find(x=>x.id===id), t=this.tenon(json), m=q&&mortises(q)[0]; return m&&t? fit(m,t,sr1(q)||'F1','F1') : null; } };
