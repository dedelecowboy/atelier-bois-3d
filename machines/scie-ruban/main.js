/* Scie à ruban KANAK 800 RB : assemblage du module (modèle, lame, pièces, règles, scénarios) sur le moteur commun. */
import { createApp } from '../../engine/app.js';
import { initSchema } from '../../engine/schema.js';
import { initFamilies } from '../../engine/families.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import { TABLE_Y, ZONE, NEAR, PROT_GAP, VC, DEV_MAX, DEV_STEP, GUIDE_LAT, GUIDE_BACK, GUIDE_FRONT, RIM_W } from './constants.js';
import { st, lame, voie, rmin, dents, rimPos, rimOk, wide, tensionOk, ctx, $ } from './state.js';
import { BLADES, bladeById, rmin as rminOf, toothH } from './lame.js';
import { buildModel } from './model.js';
import { initPieces, pieces, cut, onTable, cur, extent, measure, label, fmt, feedMode, feedStep, backStep, finishCut, inCurve, build, place,
  toTrace, toFence, toGab, toMiter, setChant, nudge, chutes, nearBlade, distToBlade, woodAt, evacuate, aside, reject, setKeep, setKind, take, traceDist, toLocal } from './piece.js';
import { computeAlerts, motorBlock, feedBlock, drift, remaining, broken, guideIssues, guidesOk, protOk } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria, ev, startGap } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
initFamilies(app, {
  parts:{ machine:['bati','commande','sectionneur','aspiration','moteur','porte_sup','porte_inf','brosse','carter_montant','fenetre'],
    outil:['lame','volant_sup','volant_inf','bandage','tension','indicateur','devers'], guides:['guide_sup','guide_inf'], protection:['protecteur','coulisseau'],
    table:['table','bloc_table','inclinaison','guide_par','regle','onglet','servante'], mains:['poussoir'], pupitre:['arret'] },
  summary:{
    machine:()=>`${st.cad?'consignée':st.main?'sous tension':'sectionneur sur 0'} · portes ${st.doors?'ouvertes':'fermées'} · aspiration ${st.asp?'en marche':'arrêtée'}`,
    outil:()=>{ const b=lame(); return b? `${b.w} mm · pas ${b.p}${st.inv?' · à l\'envers':''} · tension ${st.ten}` : 'aucune lame montée'; },
    guides:()=> !lame()? '—' : (guideIssues(true).length||guideIssues(false).length)? 'à régler' : 'réglés',
    protection:()=>{ const p=cur(); return `${st.hg} mm${p?` · pièce ${fmt(p.H,0)} mm`:''}`; },
    table:()=>`table ${st.tilt}° · guide ${st.fence? fmt(st.fx)+' mm' : 'retiré'}${st.mitOn?` · onglet ${st.mit}°`:''}${st.serv?' · servante':''}`,
    mains:()=>`${st.mains==='cote'?'mains de part et d\'autre':'une main devant la lame'} · avance ${['','lente','normale','rapide'][st.speed]}`,
    piece:()=>{ const t=onTable(); return t.length? `${t.length} pièce${t.length>1?'s':''} sur la table` : 'table libre'; } } });
initSchema({ pinIn:'famBar', sub:'guide-lame vu de dessus, lame sur le bandage, protecteur',
  html:'<svg id="guideSvg" viewBox="0 0 300 150" role="img" aria-label="Vue de dessus du guide-lame : lame, galets latéraux, galet arrière ; position de la lame sur le bandage"></svg><svg id="protSvg" viewBox="0 0 300 96" role="img" aria-label="Vue de côté : table, pièce et bas du guide-lame supérieur"></svg>' });
ctx.app = app; ctx.model = model;
initPieces(app, model);
const F = app.ex.flash;
const apply=()=>app.apply();
const say=(msg,level='warn')=>{ F.msg=msg; F.level=level; app.ex.invalidate(); apply(); };
const info=msg=>say(msg,'info');
const spin=()=>model.spin;
window.__rubanSpin=spin;
const stopped=()=>!st.motor && model.spin<0.02;
const RACK0={ r30:true }, rackInv={ ...RACK0 };   // sens des lames sur le râtelier : la lame de 30 n° 1 est accrochée dents vers le haut (à retourner avant de la monter)
let bladeKey='';
function syncBlade(){ const k=(broken.on?'X':'')+st.blade+'|'+st.inv; if(k===bladeKey) return; bladeKey=k; model.setBlade(broken.on? null : lame(), st.inv); }

/* ---------- schéma : guide-lame vu de dessus (jeux exagérés), lame sur le bandage ; protecteur vu de côté ---------- */
let guideKey='';
function drawGuide(){ const b=lame(), r=rimPos(), key=JSON.stringify([st.blade,st.inv,st.gL,st.gF,st.gB,st.posDev,st.posOk,st.dev]); if(key===guideKey) return; guideKey=key;
  let g='';
  if(!b){ $('guideSvg').innerHTML='<text x="150" y="70" text-anchor="middle" font-size="11" fill="var(--muted)">aucune lame montée</text>'; return; }
  // vue de dessus : la lame (pointe des dents à gauche), galets latéraux et galet arrière ; échelle 4 px/mm, jeux latéraux ×20
  const k=Math.min(4,150/(b.w+6)), X=z=>20+z*k, yc=60, e=8, iss=guideIssues(true), ok=!iss.length;
  const h=toothH(b), L=st.gL*20;
  g+=`<text x="4" y="11" font-size="9" fill="var(--muted)">guide-lame supérieur vu de dessus · jeux latéraux ×20</text>`;
  g+=`<rect x="${X(h)}" y="${yc-e/2}" width="${(b.w-h)*k}" height="${e}" fill="#c9ced3" stroke="var(--fg)" stroke-width=".6"/>`;
  for(let z=0;z<h;z+=h/3) g+=`<path d="M${X(z)},${yc} L${X(z+h/3)},${yc-e/2-2} L${X(z+h/3)},${yc+e/2+2} z" fill="#e6eaee" stroke="var(--fg)" stroke-width=".5"/>`;
  g+=`<line x1="${X(h)}" y1="${yc-26}" x2="${X(h)}" y2="${yc+26}" stroke="var(--muted)" stroke-dasharray="2 2"/><text x="${X(h)}" y="${yc+36}" font-size="8" text-anchor="middle" fill="var(--muted)">fond de denture</text>`;
  const gc= iss.some(s=>/latéraux|denture|avant|fond/.test(s))? 'var(--danger)' : 'var(--ok)';
  for(const s of [-1,1]){ const y= s<0? yc-e/2-L-14 : yc+e/2+L; g+=`<rect x="${X(st.gF)}" y="${y}" width="${26*k/2.6}" height="14" rx="3" fill="#9aa2a8" stroke="${gc}" stroke-width="1.4"/>`; }
  const bc= iss.some(s=>/arrière/.test(s))? 'var(--danger)' : 'var(--ok)';
  g+=`<circle cx="${X(st.gB)+9}" cy="${yc}" r="9" fill="#9aa2a8" stroke="${bc}" stroke-width="1.4"/>`;
  g+=`<text x="4" y="${yc+52}" font-size="9" fill="var(--fg)">galets : jeu ${fmt(st.gL,2)} · avant ${fmt(st.gF)} · arrière ${fmt(st.gB)} (dos à ${b.w})</text>`;
  g+=`<text x="4" y="${yc+64}" font-size="9" fill="${ok?'var(--ok)':'var(--danger)'}">${ok?'réglé':iss[0]}</text>`;
  // lame sur le bandage (coupe du volant supérieur)
  const bx=214, bw=58, kk=bw/RIM_W, cy=yc-6;
  g+=`<text x="${bx-6}" y="22" font-size="8.5" fill="var(--muted)">sur le volant</text><rect x="${bx}" y="${cy}" width="${bw}" height="12" fill="#26282a"/><text x="${bx+bw/2}" y="${cy+24}" font-size="8" text-anchor="middle" fill="var(--muted)">bandage</text>`;
  if(st.posOk&&r){ const z0=bx+bw/2+(r.c-b.w/2)*kk, col=rimOk()?'var(--ok)':'var(--danger)';
    g+=`<rect x="${z0}" y="${cy-5}" width="${b.w*kk}" height="5" fill="#c9ced3" stroke="${col}" stroke-width="1.2"/><text x="${bx-6}" y="${cy+40}" font-size="8.5" fill="${col}">${rimOk()? (wide()?'dents dehors':'au milieu') : (wide()?'dents dessus':'décentrée')}</text>`; }
  else g+=`<text x="${bx-6}" y="${cy+40}" font-size="8.5" fill="var(--muted)">tourner le volant</text>`;
  $('guideSvg').innerHTML=g; }
let protKey='';
function drawProt(){ const p=cur(), H=p?p.H:null, key=st.hg+'|'+H; if(key===protKey) return; protKey=key;
  const yT=84, k=Math.min(0.42,60/Math.max(60,(H||40)+30)), ok=p&&protOk(p), low=p&&st.hg<H, col=!p?'var(--muted)':ok?'var(--ok)':low?'#c98a12':'var(--danger)', yg=yT-st.hg*k;
  let g=`<rect x="6" y="${yT}" width="288" height="7" fill="var(--muted)" opacity=".45"/>`;
  if(p) g+=`<rect x="40" y="${yT-H*k}" width="180" height="${H*k}" fill="#d9b98a" stroke="#8a6a40" stroke-width=".7"/>`;
  const yb=Math.max(30,yg-20), hb=Math.max(4,Math.min(20,yg-yb)), clip=yg-20<30;   // sous les deux lignes de texte ; trop haut : flèche
  g+=`<line x1="150" y1="${yb}" x2="150" y2="${yT}" stroke="var(--fg)" stroke-dasharray="3 2" opacity=".5"/>`;
  g+=`<rect x="134" y="${yb}" width="32" height="${clip?14:hb}" fill="#e9c22c" stroke="${col}" stroke-width="1.6"/>`;
  if(clip) g+=`<text x="171" y="${yb+11}" font-size="10" font-weight="700" fill="${col}">↑ plus haut</text>`;
  g+=`<text x="4" y="12" font-size="9.5" font-weight="600" fill="var(--fg)">guide-lame à ${st.hg} mm${p?` · pièce ${fmt(H,0)} mm`:''}</text>`;
  g+=`<text x="4" y="24" font-size="8.5" fill="${col}">${!p?'pas de pièce':ok?`réglé au plus près (${PROT_GAP[0]} à ${PROT_GAP[1]} mm)`:low?'plus bas que la pièce : elle ne passe pas':'trop haut : lame accessible'}</text>`;
  $('protSvg').innerHTML=g; }

/* ---------- vue de dessus autour de la lame (dock) : bois, tracé, trait de scie, guide parallèle ---------- */
let planKey='', planT=0;
function drawPlan(force){ const p=cur(), t=onTable(), b=lame(); const now=performance.now();
  const key=JSON.stringify([t.map(q=>[q.id,Math.round(q.tx*2),Math.round(q.tz*2),+q.th.toFixed(3),q.chant]),cut.keep,st.fence,st.fx,st.mitOn,st.mit,st.blade,cut.cuts]);
  if(key===planKey&&!force) return; if(!force&&now-planT<120&&st.feed) return; planKey=key; planT=now;
  const K=2.4, cx=160, cz=96, X=x=>cx+x*K, Z=z=>cz+(z-12)*K, W=320/K, D=180/K, step=1.6;
  let g='';
  // bois : cases de la pièce (grille 1,6 mm) dans la fenêtre
  for(const q of t){ const col=q.id===cut.keep&&t.length>1? '#e2b67e' : '#d9b98a'; let d='';
    for(let zz=-D/2+12;zz<D/2+12;zz+=step){ let run=null;
      for(let xx=-W/2;xx<=W/2;xx+=step){ const [u,v]=toLocal(q,xx,zz), i=Math.floor(u/0.5)-q.m.ox, j=Math.floor(v/0.5)-q.m.oy;
        const on= i>=0&&j>=0&&i<q.m.w&&j<q.m.h&&q.m.d[j*q.m.w+i];
        if(on&&run===null) run=xx; if((!on||xx+step>W/2)&&run!==null){ d+=`M${X(run).toFixed(1)},${Z(zz).toFixed(1)}h${((xx-run)*K).toFixed(1)}v${(step*K).toFixed(1)}h${(-(xx-run)*K).toFixed(1)}z`; run=null; } } }
    g+=`<path d="${d}" fill="${col}"/>`;
    const T=q.origin.trace; if(T){ let s=''; for(let i=0;i<T.pts.length;i+=4){ const [x,z]=(()=>{ const c=Math.cos(q.th), sn=Math.sin(q.th), [u,v]=T.pts[i]; return [q.tx+u*c-v*sn, q.tz+u*sn+v*c]; })(); s+=(s?'L':'M')+X(x).toFixed(1)+','+Z(z).toFixed(1); } g+=`<path d="${s}" fill="none" stroke="#1b1410" stroke-width="1.2"/>`; } }
  // guide parallèle, guide d'onglet
  if(st.fence){ const x=voie()/2+st.fx; g+=`<rect x="${X(x)}" y="0" width="${4*K}" height="180" fill="var(--muted)" opacity=".7"/><text x="${X(x)+12}" y="12" font-size="8" fill="var(--muted)">guide ${fmt(st.fx)} mm</text>`; }
  // lame (vue de dessus : de la pointe des dents au dos)
  if(b){ g+=`<rect x="${X(-voie()/2)}" y="${Z(-b.w)}" width="${voie()*K}" height="${b.w*K}" fill="${st.motor?'#ff2a14':'var(--fg)'}"/>`; }
  // relevés
  let r1='', r2='';
  if(p){ const mode=feedMode(p);
    if(p.origin.trace&&mode==='free'){ const sg=startGap(p), [u,v]=toLocal(p,cut.bx,0), d=traceDist(p.origin.trace,u,v), gap=d.d-voie()/2;
      if(Math.abs(d.d)<=8) r1= gap<-0.3? `Trait de scie DANS la pièce : ${fmt(-gap)} mm au-delà du trait` : `Trait côté chute : bord à ${fmt(gap)} mm du trait`;
      if(sg!==null&&!cut.entered) r2='Départ du tracé devant la lame'; }
    if(mode==='fence') r1=`Contre le guide : épaisseur sciée ${fmt(st.fx)} mm`;
    if(mode==='fence'||mode==='miter') r2=`Arrière de la pièce à ${fmt(remaining(p),0)} mm de la lame${remaining(p)<ZONE&&!st.pouss?' : poussoir !':''}`; if(mode==='gab') r2='Rondin dans le gabarit en vé : mains sur la poignée du gabarit'; }
  g+=`<text x="4" y="10" font-size="8" fill="var(--muted)">vue de dessus · lame en rouge quand elle tourne · opérateur en bas</text><text x="4" y="164" font-size="9" fill="var(--fg)">${r1}</text><text x="4" y="176" font-size="9" fill="var(--fg)">${r2}</text>`;
  $('planSvg').innerHTML=g; }

/* ---------- pièces débitées ---------- */
let debitKey='';
const KIND={ piece:'Pièce', chute:'Chute', rond:'À scier', gabarit:'Gabarit nécessaire' };
function renderDebit(){ const list=pieces.filter(q=>q.state==='stock'), free=!onTable().length;
  const key=JSON.stringify([list.map(q=>[q.id,q.kind]),free]); if(key===debitKey) return; debitKey=key;
  const np=list.filter(q=>q.kind==='piece').length; $('debitN').textContent=list.length?`${np} pièce${np>1?'s':''} · ${list.length-np} autre${list.length-np>1?'s':''}`:'';
  $('debit').innerHTML= list.length? list.map(q=>`<li data-k="${q.kind}"><div><b>${q.name||'Pièce'}</b> <small>${label(q)} · ${KIND[q.kind]||q.kind}</small></div>
        <div class="d-act">${q.kind==='piece'||q.kind==='chute'?`<button class="toggle mini" type="button" data-kind="${q.id}" aria-pressed="${q.kind==='piece'}">${q.kind==='piece'?'Pièce':'Chute'}</button>`:''}<button class="toggle mini" type="button" data-take="${q.id}" ${free?'':'disabled title="Libérez d\'abord la table"'}>Reprendre</button></div></li>`).join('')
    : '<li class="debit-empty">Les pièces évacuées ou mises de côté apparaissent ici.</li>';
  document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{ if(cut.inWood) return say('La lame est dans la pièce : finissez la coupe.'); const why=take(+b.dataset.take); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); });
  document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ setKind(+b.dataset.kind); debitKey=''; renderDebit(); }); }

/* ---------- mains et poussoir (repère de la table) ---------- */
function handsPose(){ const p=cur(); if(!p) return { hands:[], pouss:null }; const e=extent(p), y=p.H/1000+0.001, mode=feedMode(p), out=[];
  if(mode==='free'){ if(distToBlade(p)>60) return { hands:[], pouss:null };
    // mains posées sur le bois, près de la lame : de part et d'autre (derrière la pointe des dents), ou une main dans l'axe
    const put=(cands,o)=>{ for(const [x,z] of cands) if(woodAt(p,x,z)){ out.push({x:x/1000,z:z/1000+0.03,y,...o}); return; } };
    if(st.mains==='cote'){ put([[-110,90],[-90,140],[-140,60],[-80,200]],{rot:0.35}); put([[110,90],[90,140],[140,60],[80,200]],{rot:-0.35}); }
    else { put([[0,80],[0,120],[0,170]],{bad:true}); put([[-140,140],[-110,200],[110,140]],{rot:0.3}); }
    return { hands:out, pouss:null }; }
  const xm=(e.x0+e.x1)/2000, zt=e.z1/1000, bad=remaining(p)<ZONE&&(cut.entered||cut.inWood);
  // main gauche : elle tient la pièce sur son flanc gauche, jamais à moins de 200 mm devant la lame ; plus de bois à portée : posée sur la table
  const left={x:e.x0/1000-0.06,z:Math.max(0.20,Math.min(zt-0.10,0.35)),y:0.001,rot:0.3};
  if(mode==='gab')     // gabarit : les deux mains sur la poignée et sur la planchette, derrière le rondin
    return { hands:[{x:0.045,z:zt+0.19,y:0.065,rot:-0.2},{x:-0.085,z:zt+0.15,y:0.022,rot:0.35}], pouss:null, gab:{z0:e.z0/1000,z1:zt} };
  if(st.pouss){        // poussoir entre la lame et le guide, talon contre l'arrière de la pièce ; la main droite sur sa poignée
    const xa=voie()/2+0.5, xb= mode==='fence'? voie()/2+st.fx : e.x1, w=Math.max(6,Math.min(40,xb-xa-2)), xc=(xa+xb)/2000, py=Math.max(0,Math.min(p.H/1000,0.12)-0.05);
    return { hands:[{x:xc,z:zt+0.31,y:py+0.085,rot:0},{...left,z:Math.max(0.25,left.z)}], pouss:{x:xc,z:zt+0.20,y:py,th:-Math.PI/2,w:w/1000}, gab:null }; }
  return { hands:[{x:xm,z:zt+0.10,y:Math.min(y,0.06),bad},left], pouss:null, gab:null }; }

/* ---------- mise à jour complète ---------- */
function update(){
  syncBlade();
  const b=lame(), H=handsPose();
  model.update({ hg:st.hg, tilt:st.tilt, fence:st.fence, fx:(voie()/2+st.fx)/1000, mitOn:st.mitOn, mit:st.mit, serv:st.serv, doors:st.doors, cad:st.cad, main:st.main, au:st.au, ten:st.ten,
    guide:{ L:st.gL, B:st.gB, F:st.gF, Li:st.gLi, Bi:st.gBi, Fi:st.gFi }, e:b?.e||0.8, hands:H.hands, pouss:H.pouss, gab:H.gab||null });
  for(const k of ['asp','gants','main','cad','doors','serv','pouss','feed','au']) $(k)?.setAttribute('aria-pressed',String(!!st[k]));
  syncTools();
  $('motor').setAttribute('aria-pressed',String(st.motor)); $('motor').textContent= st.motor? 'O · Lame' : 'I · Lame';
  $('main').textContent= st.main? 'Sectionneur sur I' : 'Sectionneur sur 0'; $('cad').textContent= st.cad? 'Consignée (cadenas)' : 'Consigner';
  $('doors').textContent= st.doors? 'Portes ouvertes' : 'Portes fermées'; $('serv').textContent= st.serv? 'Servante en sortie' : 'Servante rangée';
  $('fenceOn').setAttribute('aria-pressed',String(st.fence)); $('fenceOn').textContent= st.fence? 'Guide parallèle en place sur la table' : 'Guide parallèle rangé sur le support';
  $('mitOn').setAttribute('aria-pressed',String(st.mitOn)); $('mitOn').textContent= st.mitOn? 'Guide d\'onglet en place sur la table' : 'Guide d\'onglet rangé sur le support';
  $('feed').textContent= st.feed? 'Avance : arrêter' : 'Avance';
  document.querySelectorAll('[data-mains]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.mains===st.mains)));
  document.querySelectorAll('[data-speed]').forEach(x=>x.setAttribute('aria-pressed',String(+x.dataset.speed===st.speed)));
  for(const k of ['ten','gL','gF','gB','gLi','gFi','gBi','hg','tilt','fx','mit']){ $(k).value=st[k]; if(document.activeElement!==$(k+'-n')) $(k+'-n').value=st[k]; }
  $('pupV').textContent=fmt(VC*spin(),0); $('pupH').textContent=String(st.hg);
  $('o-dv').textContent=`${st.dev>0?'+':''}${st.dev} ¼ t`;
  { const sel=b? b : bladeById($('bladeSel').value); $('o-bl').textContent= b? `${b.w} mm montée` : 'démontée';
    $('bladeInfo').textContent= b? `Montée : ${b.n}, épaisseur ${fmt(b.e)} mm, voie ${fmt(voie())} mm, rayon mini ${rminOf(b)>=300?'— (sciage droit)':rminOf(b)+' mm'} ; dents ${st.inv?'vers le haut':'vers le bas'}.` : (sel? `Choisie : ${sel.n}, rayon mini ${rminOf(sel)>=300?'— (sciage droit)':rminOf(sel)+' mm'} ; sur le râtelier, dents ${rackInv[sel.id]?'vers le haut':'vers le bas'} une fois montée.`:''); }
  { const r=rimPos(); $('rimInfo').textContent= !b? '' : !st.posOk? 'Position pas vérifiée : machine consignée, portes ouvertes, tournez le volant à la main.' : `Lame ${r.c>=0?'avancée':'reculée'} de ${Math.abs(r.c)} mm sur le bandage ; dents ${r.over>=0?`${fmt(r.over,0)} mm devant`:`${fmt(-r.over,0)} mm en retrait de l'avant`} du bandage${rimOk()?' : bien placée.':'.'}`; }
  const busy=st.feed||cut.inWood;
  for(const id of ['exam','flip','unmount','mount']) $(id).disabled=false;
  $('rupture').hidden= app.ex.mode!=='libre';
  document.querySelectorAll('#tools button,#nudge button').forEach(x=>x.disabled= busy && x.dataset.op!=='reset' && x.dataset.op!=='pchute');
  drawGuide(); drawProt(); drawPlan();
}

/* ---------- commandes de la machine ---------- */
const num=(el,v)=>Math.max(+el.min,Math.min(+el.max,Math.round((+v||0)/(+el.step||1))*(+el.step||1)));
function settingGuard(){ if(!stopped()){ say('Arrêtez la lame et attendez son arrêt complet : tous les réglages se font machine arrêtée.'); return false; } return true; }
$('main').onclick=()=>{ if(st.main){ st.main=false; st.motor=false; st.feed=false; F.msg=''; apply(); return; }
  if(st.cad) return say('Machine consignée : retirez d\'abord votre cadenas (« Consignée »).'); st.main=true; F.msg=''; apply(); };
$('cad').onclick=()=>{ if(st.cad){ st.cad=false; info('Cadenas retiré. Vérifiez que tout est en place avant de remettre le sectionneur sur I.'); return; }
  if(st.main) return say('Pour consigner : sectionneur sur 0 d\'abord, puis le cadenas.');
  if(spin()>0.02) return say('Attendez l\'arrêt complet de la lame.');
  st.cad=true; info('Machine consignée : sectionneur sur 0, cadenassé. Gardez la clé sur vous.'); };
$('doors').onclick=()=>{ if(st.doors){ st.doors=false; F.msg=''; apply(); return; }
  if(st.motor||spin()>0.02) return say('Portes verrouillées : elles ne s\'ouvrent qu\'à l\'arrêt complet de la lame. N\'ouvrez jamais avant.');
  st.doors=true; F.msg=''; apply(); };
$('asp').onclick=()=>{ st.asp=!st.asp; apply(); };
$('gants').onclick=()=>{ st.gants=!st.gants; apply(); };
/* intervention sur la lame : machine consignée et portes ouvertes ; sans consignation = faute grave (geste refusé) */
const NO_LOTO='INTERVENTION SUR LA LAME SANS CONSIGNATION : sectionneur sur 0 et cadenas avant de toucher la lame. Quelqu\'un pourrait redémarrer la machine.';
function bladeGuard(){ if(spin()>0.02||st.motor){ say('Arrêtez la lame et attendez son arrêt complet.'); return false; }
  if(!st.cad){ app.recordDangers([['danger',NO_LOTO]]); say('Refusé : '+NO_LOTO,'danger'); return false; }
  if(!st.doors){ say('Ouvrez d\'abord les portes des volants.'); return false; }
  return true; }
const gloveTip=()=> st.gants? '' : ' Mettez les gants de manutention pour manipuler la lame (dents coupantes).';
$('bladeSel').innerHTML=BLADES.map(b=>`<option value="${b.id}">${b.n}</option>`).join('');
$('bladeSel').onchange=()=>apply();
$('exam').onclick=()=>{ const b=bladeById($('bladeSel').value); if(!b) return;
  const pb=[]; if(b.crack) pb.push('CRIQUE à la soudure : lame à mettre au rebut'); if(b.e>0.8) pb.push(`épaisseur ${fmt(b.e)} mm, plus que 0,8 mm (volants de 800)`);
  info(`Lame ${b.n} : épaisseur ${fmt(b.e)} mm, rayon mini ${rminOf(b)>=300?'— (sciage droit seulement)':rminOf(b)+' mm'}, dents ${rackInv[b.id]?'vers le haut':'vers le bas'} si on la monte comme elle est accrochée. ${pb.length? pb.join(' ; ')+'.' : 'Pas de crique, denture en bon état.'}`); };
$('flip').onclick=()=>{ if(st.blade){ if(!bladeGuard()) return; if(st.ten>2) return say('Détendez d\'abord la lame pour la retourner.'); st.inv=!st.inv; st.posOk=false; info(`Lame retournée : dents ${st.inv?'vers le haut':'vers le bas'}.`+gloveTip()); return; }
  const id=$('bladeSel').value; rackInv[id]=!rackInv[id]; info(`Lame ${bladeById(id).n} retournée : montée ainsi, dents ${rackInv[id]?'vers le haut':'vers le bas'}.`); };
$('unmount').onclick=()=>{ if(!st.blade) return say('Aucune lame montée.'); if(!bladeGuard()) return;
  if(st.ten>2) return say('Détendez d\'abord la lame (volant de tension jusqu\'à 0).');
  const was=lame(); rackInv[was.id]=st.inv; st.blade=null; st.inv=false; st.posOk=false; ev.demonte=true; broken.on=false; info(`Lame de ${was.w} mm démontée et rangée.`+gloveTip()); };
$('mount').onclick=()=>{ if(st.blade) return say('Démontez d\'abord la lame en place.'); if(!bladeGuard()) return;
  const id=$('bladeSel').value; st.blade=id; st.inv=!!rackInv[id]; st.ten=0; st.posOk=false;
  info(`Lame ${bladeById(id).n} montée sur les volants, dents ${st.inv?'VERS LE HAUT':'vers le bas'}. Tendez-la, tournez le volant à la main, réglez les guide-lames.`+gloveTip()); };
function setTen(v){ if(!settingGuard()) return; if(!st.blade) return say('Aucune lame montée.'); st.ten=v; apply(); }
$('ten').addEventListener('input',e=>setTen(+e.target.value)); $('ten-n').addEventListener('change',e=>setTen(num($('ten'),e.target.value)));
function setDev(d){ if(!settingGuard()) return; st.dev=Math.max(-DEV_MAX,Math.min(DEV_MAX,st.dev+d)); st.posOk=false; F.msg=''; apply(); }
$('devM').onclick=()=>setDev(-1); $('devP').onclick=()=>setDev(1);
$('hwheel').onclick=()=>{ if(!st.blade) return say('Aucune lame montée.'); if(!bladeGuard()) return;
  if(st.ten<lame().w*0.5) return say('Tendez d\'abord la lame : détendue, elle ne se place pas.');
  st.posDev=st.dev; st.posOk=true; const r=rimPos(), b=lame();
  info(`Volant tourné à la main : la lame se place ${r.c>0?'vers l\'avant':r.c<0?'vers l\'arrière':'au milieu'} du bandage. ${rimOk()? 'Bonne position.' : wide()? (r.frac<0.6? 'Elle déborde trop : elle sortirait du volant.' : 'Dents encore sur le bandage : un quart de tour de plus (+).') : 'Ramenez-la au milieu du bandage.'}`); };
/* simplifications de l'exercice : changement de lame complet en un geste (la procédure est l'objet du scénario 1, où ce bouton est caché),
   guide-lame inférieur réglé comme le supérieur, aide au suivi du trait (exercice guidé seulement, jamais au parcours) */
const goodGuides=b=>({ L:0.2, F:Math.round((toothH(b)+2)*2)/2, B:b.w+1 });
function goodDev(b){ for(let d=0; d<=DEV_MAX; d++){ if(b.w<20) return 0; const c=d*DEV_STEP, over=c+b.w/2-RIM_W/2, on=Math.max(0,Math.min(RIM_W/2,c+b.w/2)-Math.max(-RIM_W/2,c-b.w/2)); if(over>=toothH(b)&&on/b.w>=0.6) return d; } return 0; }
$('quick').onclick=()=>{ if(spin()>0.02||st.motor) return say('Arrêtez la lame et attendez son arrêt complet.');
  const b=bladeById($('bladeSel').value); if(!b) return;
  if(b.crack) return say(`Lame ${b.n} : CRIQUE à la soudure (« Examiner »). Elle va au rebut : choisissez-en une autre.`);
  if(st.blade===b.id&&!st.inv&&tensionOk()&&rimOk()&&guidesOk(true)&&guidesOk(false)) return info('Cette lame est déjà montée et réglée.');
  const was=lame(); if(was) rackInv[was.id]=false;
  st.motor=false; st.main=false; st.cad=true; st.gants=true; st.doors=true; st.ten=0;
  st.blade=b.id; st.inv=false; st.ten=b.w; st.dev=goodDev(b); st.posDev=st.dev; st.posOk=true; broken.on=false; if(was) ev.demonte=true;
  const g=goodGuides(b); Object.assign(st,{ gL:g.L, gF:g.F, gB:g.B, gLi:g.L, gFi:g.F, gBi:g.B });
  st.doors=false; st.cad=false; st.main=true;
  info(`Lame changée${was?` (${was.w} mm démontée)`:''} : ${b.n}, dents vers le bas. Procédure faite pour vous : consigner (sectionneur sur 0, cadenas, gants), ouvrir les portes, détendre et démonter, monter, tendre sur ${b.w}, tourner le volant à la main (${b.w>=20?'dents hors du bandage':'lame au milieu du bandage'}), guide-lames (galets à 0,2 mm, avant à ${fmt(g.F)} mm, galet arrière à ${fmt(g.B)} mm), fermer, déconsigner.`); };
$('gCopy').onclick=()=>{ if(!settingGuard()) return; st.gLi=st.gL; st.gFi=st.gF; st.gBi=st.gB; info('Guide-lame inférieur réglé comme le supérieur.'); };
$('aide').onclick=()=>{ pilot.on=!pilot.on; pilot.aide=pilot.on; pilot.off=0.5; if(!pilot.on) st.steer=0;
  info(pilot.on? 'Aide au suivi du trait : la pièce tourne seule pour suivre le trait. Gérez l\'avance (« Avance », vitesse lente dans les courbes) et arrêtez à la fin. Pas d\'aide dans le parcours noté.' : 'Aide au suivi du trait arrêtée : ↺ ↻ (ou les flèches) pour suivre le trait.'); };
/* boutons de la pièce utiles dans chaque exercice (tous en mode libre) */
const OPS_OF={ chant:['trace','evac','pchute','aside','xm1','xp1','zm10','zp10','reset'], refente:['fence','chant','gab','reject','evac','pchute','aside','zm10','zp10','reset'] };
function syncTools(){ const m=app.ex?.mode||'libre', ui=$('app')?.dataset.ui, list=OPS_OF[m];
  document.querySelectorAll('#tools [data-op], #nudge [data-op]').forEach(b=>{ b.hidden= !!list && !list.includes(b.dataset.op); });
  $('quick').hidden= m==='lame';
  const aideOk= ui==='ex' && m==='chant'; $('aideRow').hidden=!aideOk; if(!aideOk&&pilot.aide){ pilot.on=pilot.aide=false; st.steer=0; }
  $('aide').setAttribute('aria-pressed',String(pilot.on)); }
for(const k of ['gL','gF','gB','gLi','gFi','gBi','hg','tilt']){
  const fn=v=>{ if(!settingGuard()) return; if(k==='tilt'&&cut.inWood) return say('La lame est dans la pièce.'); st[k]=v; apply(); };
  $(k).addEventListener('input',e=>fn(+e.target.value)); $(k+'-n').addEventListener('change',e=>fn(num($(k),e.target.value))); }
for(const k of ['fx','mit']){
  const fn=v=>{ if(!settingGuard()) return; if(cut.inWood) return say('La lame est dans la pièce.'); const p=cur(), was=p&&k==='fx'&&feedMode(p)==='fence'; st[k]=v; if(was) toFence(p); apply(); };
  $(k).addEventListener('input',e=>fn(+e.target.value)); $(k+'-n').addEventListener('change',e=>fn(num($(k),e.target.value))); }
$('fenceOn').onclick=()=>{ if(!settingGuard()) return; st.fence=!st.fence; apply(); };
$('mitOn').onclick=()=>{ if(!settingGuard()) return; st.mitOn=!st.mitOn; apply(); };
$('serv').onclick=()=>{ st.serv=!st.serv; apply(); };
document.querySelectorAll('[data-mains]').forEach(x=>x.onclick=()=>{ st.mains=x.dataset.mains; apply(); });
document.querySelectorAll('[data-speed]').forEach(x=>x.onclick=()=>{ st.speed=+x.dataset.speed; apply(); });
$('rupture').onclick=()=>{ if(app.ex.mode!=='libre') return; if(!st.motor||spin()<0.9) return say('La lame doit tourner pour simuler une rupture.');
  broken.on=true; st.feed=false; say('LA LAME A CASSÉ ! Restez à l\'écart, arrêtez la machine (O ou arrêt d\'urgence). N\'ouvrez rien avant l\'arrêt complet des volants.','danger'); };

/* ---------- pupitre ---------- */
$('motor').onclick=()=>{ if(st.motor){ st.motor=false; st.feed=false; F.msg=''; apply(); return; }
  const why=motorBlock(); if(why) return say(why);
  app.recordDangers(computeAlerts(spin()).filter(a=>a[0]==='danger'&&(a[2]==='outil'||a[2]==='machine')));   // faute grave : démarrer une lame dangereuse
  st.motor=true; F.msg=''; apply(); };
$('au').onclick=()=>{ if(st.au){ st.au=false; info('Arrêt d\'urgence déverrouillé. Redémarrez avec I si tout est en ordre.'); return; } st.au=true; st.motor=false; st.feed=false; say('Arrêt d\'urgence : la lame freine.','info'); };
$('pouss').onclick=()=>{ st.pouss=!st.pouss; const p=cur(), m=p&&feedMode(p);
  if(st.pouss) info(m==='gab'? 'Poussoir en main. Au gabarit, il n\'est pas utile : les mains restent sur la poignée du gabarit, derrière le rondin.'
    : m==='free'? 'Poussoir en main : il sert en fin de passe contre le guide parallèle ou au guide d\'onglet. À main levée, les mains restent de part et d\'autre de la lame.'
    : 'Poussoir en main : son talon pousse l\'arrière de la pièce, entre la lame et le guide. Continuez « Avance » jusqu\'à la sortie de la lame ; la main reste sur la poignée, loin de la lame.');
  else info('Poussoir reposé : les mains poussent directement la pièce.');
  apply(); };
$('feed').onclick=()=>{ if(st.feed){ st.feed=false; F.msg=''; apply(); return; } startFeed(); };
function startFeed(){ const p=cur(), why=feedBlock(spin()); if(why){ say(why); return false; }
  if(p.round&&!p.gab&&p.gen===0){ app.recordDangers(); say('Refusé : PIÈCE RONDE NON MAINTENUE. Elle roulerait sous la lame et entraînerait la main. Gabarit (vé) ou « Écarter : gabarit ».','danger'); return false; }
  app.recordDangers(); st.feed=true; F.msg=''; app.ex.invalidate(); apply(); return true; }
const hold=(id,on,off)=>{ const b=$(id); b.addEventListener('pointerdown',e=>{ e.preventDefault(); b.setAttribute('aria-pressed','true'); on(); });
  for(const ev_ of ['pointerup','pointerleave','pointercancel']) b.addEventListener(ev_,()=>{ b.setAttribute('aria-pressed','false'); off(); }); };
hold('left',()=>st.steer=-1,()=>st.steer=0); hold('right',()=>st.steer=1,()=>st.steer=0);
let backing=false; hold('back',()=>{ backing=true; },()=>{ backing=false; });
addEventListener('keydown',e=>{ if(e.target.closest?.('input,select,textarea')) return; if(e.key==='ArrowLeft'){ st.steer=-1; e.preventDefault(); } if(e.key==='ArrowRight'){ st.steer=1; e.preventDefault(); } });
addEventListener('keyup',e=>{ if(e.key==='ArrowLeft'||e.key==='ArrowRight') st.steer=0; });

/* ---------- avance de la pièce : pas de 1 mm, trait de scie, fautes graves, fin de passe ---------- */
const SPEED=[0,10,20,40];   // mm/s à l'affichage
const pilot={ on:false, off:0.5 };   // tests : suit le tracé avec le bord du trait à « off » mm côté chute
function pilotSteer(p){ const T=p.origin.trace; if(!T) return 0; const P=T.pts, n=P.length, [u,v]=toLocal(p,cut.bx,0), d=traceDist(T,u,v), c=i=>P[Math.max(0,Math.min(n-1,i))];
  const i=Math.max(0,Math.min(n-2,Math.round(d.k)));
  // courbure du tracé un peu en avant (+ : tourne à gauche), direction du tracé, direction d'avance de la lame dans la pièce
  const a=c(i+2), b=c(i+8), e=c(i+14), cr=(b[0]-a[0])*(e[1]-b[1])-(b[1]-a[1])*(e[0]-b[0]), la=Math.hypot(b[0]-a[0],b[1]-a[1])*Math.hypot(e[0]-b[0],e[1]-b[1])*Math.hypot(e[0]-a[0],e[1]-a[1])||1;
  const kap=2*cr/la, tu=c(i+3)[0]-c(i)[0], tv=c(i+3)[1]-c(i)[1], hu=Math.sin(p.th), hv=Math.cos(p.th);
  const he=Math.atan2(hu*tv-hv*tu, hu*tu+hv*tv), err=(pilot.off+voie()/2)-d.d;
  return Math.max(-1,Math.min(1,(-kap-T.waste*0.004*err-0.126*he)*45)); }
function advance(mm){ let p=cur(); if(!p) return false; let left=mm;
  while(left>1e-6){ const ds=Math.min(1,left); left-=ds;
    if(pilot.on) st.steer=pilotSteer(p);
    const r=feedStep(p, ds, { blade:{ id:st.blade, rmin:rmin() }, drift:drift(), rec:{ hgOver:st.hg-p.H } });
    const md=feedMode(p);                                 // fin de passe sans poussoir : l'avance s'arrête à 150 mm (rappel), puis à 40 mm (la main est sur la lame)
    if((md==='fence'||md==='miter')&&!st.pouss&&cut.entered){ const r0=remaining(p);
      if(r0<=NEAR&&r0>ZONE&&cut.pauseRec!==cut.rec){ cut.pauseRec=cut.rec; st.feed=false; say(`Arrêt de l'avance : l'arrière de la pièce est à ${fmt(r0,0)} mm de la lame. Prenez le poussoir (bouton « Poussoir »), puis « Avance » pour finir la passe.`); app.ex.invalidate(); return false; }
      if(r0<=40){ st.feed=false; say('Arrêt : sans poussoir, la main arrive sur la lame. Prenez le poussoir pour finir la passe.','danger'); app.ex.invalidate(); return false; } }
    app.recordDangers();                                 // faute grave : alerte danger active pendant l'avance de la pièce
    if(r.done){ const out=finishCut(); st.feed=false;
      F.level='info'; F.msg= out.length>1? `Coupe terminée : ${out.length} morceaux. La pièce gardée est entourée en orange (cliquez une autre pièce pour la garder). ${spin()>0.02&&out.some(nearBlade)?'Chute contre la lame : poussoir, ou arrêt complet avant de la prendre.':''}` : 'La lame est sortie de la pièce.';
      app.ex.invalidate(); return false; }
    const e=extent(p); if(e.z1<-1100){ st.feed=false; return false; } }
  if(cut.sinceMesh>=10){ cut.sinceMesh=0; build(p); } else place(p);
  return true; }
function back(mm){ const p=cur(); if(!p) return;
  if(spin()>0.02){ if(inCurve()){ const t='RECUL DANS UNE COURBE LAME EN MARCHE : la lame se tord et peut sortir des volants. Arrêtez la lame, attendez l\'arrêt complet, puis reculez.'; app.recordDangers([['danger',t]]); backing=false; $('back').setAttribute('aria-pressed','false'); say('Refusé : '+t,'danger'); return; }
    if(cut.inWood&&F.msg.indexOf('Évitez')<0) say('Évitez de reculer la pièce lame en mouvement (risque de déjanter la lame).'); }
  const out_=backStep(p,mm); if(cut.entered&&out_){ const out=finishCut(); if(out.length>1) info(`La pièce est sortie de la lame : ${out.length} morceaux.`); } }

/* ---------- manipulations des pièces ---------- */
const CHUTE_FAULT='CHUTE DÉGAGÉE À LA MAIN LAME EN MOUVEMENT : une chute contre la lame ne se prend qu\'à l\'arrêt complet, ou se dégage au poussoir.';
function doOp(op){ const p=cur(), t=onTable();
  if(op==='reset'){ app.ex.setMode(app.ex.mode); return; }
  if(op==='pchute'){ const c=chutes(); if(!c.length) return info('Pas de chute sur la table.'); evacuate(); info('Chutes dégagées au poussoir et retirées de la table.'); debitKey=''; return; }
  if(st.feed||cut.inWood) return say('La lame est dans la pièce : finissez la coupe (ou arrêtez la lame et reculez la pièce).');
  if(op==='evac'||op==='aside'){ const hand=op==='evac'? chutes() : t;
    if(spin()>0.02 && hand.some(nearBlade)){ app.recordDangers([['danger',CHUTE_FAULT]]); return say('Refusé : '+CHUTE_FAULT,'danger'); }
    const why= op==='evac'? evacuate() : aside(); if(why) return say(why,'info'); F.msg=''; debitKey=''; app.ex.invalidate(); apply(); return; }
  if(!p) return say('Pas de pièce sur la table : « Nouvelle pièce » ou « Reprendre » dans « Pièces débitées ».');
  if(t.length>1) return say('Plusieurs pièces sur la table : évacuez d\'abord les chutes.');
  F.msg='';
  if(op==='reject'){ if(!p.round) return say('Seule une pièce ronde est à écarter pour un gabarit.'); reject(); debitKey=''; info('Rondin écarté : à scier dans un gabarit en vé, ou à fendre autrement.'); return; }
  if(op==='trace'){ const why=toTrace(p,0); if(why) return say(why); }
  else if(op==='fence'){ if(!st.fence) return say('Guide parallèle retiré : mettez-le en place (« Table et guides »).'); if(p.round) return say('Une pièce ronde ne se scie pas contre le guide : elle roule. Gabarit en vé.'); toFence(p); }
  else if(op==='miter'){ if(!st.mitOn) return say('Guide d\'onglet rangé : mettez-le en place.'); toMiter(p); }
  else if(op==='gab'){ if(!p.round) return say('Le gabarit en vé est fait pour les pièces rondes.'); if(st.fence&&voie()/2+st.fx<85) return say('Le guide parallèle gêne le gabarit : écartez-le à 85 mm au moins, ou retirez-le (« Table et guides »).'); toGab(p); }
  else if(op==='chant'){ const why=setChant(p,!p.chant); if(why) return say(why); if(st.fence&&p.chant) toFence(p); else place(p); }
  else { const d={xm1:[-1,0],xp1:[1,0],zm10:[0,-10],zp10:[0,10]}[op]; if(d){ if(p.gab&&d[0]) return say('La pièce est dans le gabarit.'); nudge(p,...d); } }
  app.ex.invalidate(); apply(); }
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>doOp(b.dataset.op));

/* ---------- démarrage ---------- */
window.__ruban={ st, cut, pieces, pilot, measure, extent, advance:mm=>{ const ok=!feedBlock(spin()); if(!ok) return feedBlock(spin()); if(!st.feed&&!startFeed()) return 'refus'; const r=advance(mm); st.feed=false; apply(); return r; },
  back:mm=>{ back(mm); apply(); }, spin, setSpin:v=>model.setSpin(v), startGap:()=>cur()&&startGap(cur()) };   // poignée pour les tests automatiques
let lastApply=0, lastSpinState='', lastTick;
app.start({
  update, alerts:()=>computeAlerts(spin()),
  steps:STEPS,
  loadMode(m){ LOADERS[m](); for(const k in rackInv) delete rackInv[k]; Object.assign(rackInv,RACK0); model.stopNow(); bladeKey=''; planKey=debitKey=guideKey=protKey=''; backing=false; if(m!=='libre') stage.setView(m==='lame'?'v34':'vop'); },
  renderExtra:renderDebit,
  panelKey:()=>[pieces.length,onTable().length,cut.keep,st.blade,st.feed,cut.inWood,ev.essai],
  onPick(hit){ const q=hit && pieces.find(x=>x.id===hit.object.userData.pieceId); if(!q) return false;
    if(setKeep(q.id)){ F.level='info'; F.msg=`Pièce gardée : ${label(q)} (contour orange).`; app.ex.invalidate(); apply(); }
    $('info').innerHTML=`<b>${q.name||'Pièce'}</b><span>${label(q)}</span>`; return true; },
  tick(dt,now){ const s=model.tick(dt, st.motor&&!st.au&&!broken.on); const rdt=Math.min(0.25,now-(lastTick??now)); lastTick=now;
    if(st.motor&&s>=0.99&&lame()&&!st.inv&&!broken.on&&!cut.inWood) ev.essai=true;
    let moved=false;
    if(st.feed&&!broken.on){ if(!st.motor||s<0.9){ st.feed=false; say('Lame arrêtée : l\'avance s\'arrête. Ne laissez jamais la lame coincée dans le bois.'); }
      else { advance(SPEED[st.speed]*rdt); moved=true; } }
    if(backing){ back(25*rdt); moved=true; }
    if(st.feed&&!onTable().length) st.feed=false;
    const ss=s>0.99?'f':s<0.02?'0':'m';
    if(moved||ss!==lastSpinState||(s>0.02&&s<0.99&&now-lastApply>0.4)){ lastSpinState=ss; lastApply=now; apply(); } },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, ignore:['piece'] },
});
