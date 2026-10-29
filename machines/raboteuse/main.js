/* Raboteuse KANAK 630 E : assemblage du module (modèle, pièces, règles, scénarios) sur le moteur commun. */
import { createApp } from '../../engine/app.js';
import { initSchema } from '../../engine/schema.js';
import { initFamilies } from '../../engine/families.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import fiches from './data/fiches.txt';
import { H_MIN, H_MAX, GRIP, PASS_MAX } from './constants.js';
import { st, ctx, $ } from './state.js';
import { buildModel } from './model.js';
import * as C from '../../engine/corroyage.js';
import { initPieces, pieces, cut, entryPieces, exitPieces, stuckPieces, onMachine, selPiece, keepPiece, startPass, tickPass, topAt, placeAll,
  measure, faceState, pressedH, passDepth, sr1, sr2, setSel, bringBack, aside, take, setKind, orient, pullOut, fmt, dims, FACE_NAME } from './piece.js';
import { computeAlerts, passBlock, wavePitch, HANDS } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage, fiches });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
/* réglages par famille (couleurs, alertes dans leur panneau) et lien avec la 3D */
initFamilies(app, {
  parts:{ machine:['bati','capot','moteur','transmission','aspiration','sectionneur','colonnes','levage','rallonge_entree','rallonge_sortie'],
    outil:['arbre','table','pupitre'], guidage:['rouleau_entree','rouleaux_sortie','chaine','variateur','galets','linguets','presseur_av','presseur_ar'],
    pupitre:['marche','arret'] },
  summary:{
    machine:()=>`aspiration ${st.asp?'en marche':'arrêtée'} · capot ${st.capot?'ouvert':'fermé'}`,
    outil:()=>`cote ${fmt(st.H)} mm`,
    avance:()=>`${st.v} m/min · avance ${st.feed?'en marche':'arrêtée'}`,
    piece:()=>{ const E=entryPieces(); return E.length? `${E.length} pièce${E.length>1?'s':''} à l'entrée` : exitPieces().length? 'pièces sur le capot' : 'aucune pièce'; } } });
initSchema({ pinIn:'famBar', sub:'vue de côté de l\'arbre et de la table',
  html:'<svg id="coteSvg" viewBox="0 0 300 168" role="img" aria-label="Vue de côté : arbre, rouleaux, table à la cote et pièce à l\'entrée"></svg>' });
ctx.app = app; ctx.model = model;
initPieces(app, model);
const F = app.ex.flash;
const apply=()=>app.apply();
const say=(msg,level='warn')=>{ F.msg=msg; F.level=level; app.ex.invalidate(); apply(); };

/* ---------- tableau des faces et mesure de la pièce en main ---------- */
let facesKey='';
const POS={};
function renderFaces(){ const q=selPiece()||cut.movers[0]||stuckPieces()[0];
  if(!q){ $('facesTab').innerHTML=''; $('dimN').textContent=''; $('pmes').innerHTML='Aucune pièce sur la table : « Reprendre » une pièce dans « Pièces débitées ».'; return; }
  const fc=C.faces(q), pos={[fc.down]:'sur la table',[fc.up]:'dessus',[fc.back]:'côté pupitre',[fc.front]:'côté opposé'}, m=measure(q);
  const key=JSON.stringify([q.id,pos,q.face,q.vmark,m.T,m.W,m.Tmax,m.Wmax,q.state]); if(key===facesKey) return; facesKey=key;
  $('dimN').textContent=`${q.name} · ${dims(q)}`;
  $('facesTab').innerHTML=['F1','F2','C1','C2'].map(f=>{ const s=q.face[f], e=faceState(q,f);
    const mk= s.mark==='loop'?' · SR1 (boucle)' : s.mark==='v'?' · SR2 (V)' : '';
    const col= e==='rabotée'||e==='dressée'?'var(--ok)': e==='arrachements'||e.includes('pas plane')?'var(--danger)':'var(--fg)';
    return `<tr><td>${FACE_NAME[f]}</td><td>${pos[f]}</td><td style="color:${col}">${e}${mk} · ${fmt(C.flatness(q,f),2)} mm</td></tr>`; }).join('');
  const plat=C.isF(fc.down), h=plat? [m.T,m.Tmax] : [m.W,m.Wmax], c=v=>fmt(Math.round(v*10)/10);
  $('pmes').innerHTML=`<b>${q.name}</b> ${q.L} mm, ${q.state==='exit'?'sur le capot':plat?'à plat':'sur chant'} · pied à coulisse : ${plat?'épaisseur':'largeur'} <b>${c(h[0])}</b> à <b>${c(h[1])}</b> mm, ${plat?'largeur':'épaisseur'} <b>${c(plat?m.W:m.T)}</b> mm`; }

/* ---------- pièces débitées (et pièces du lot en attente) ---------- */
let debitKey='';
function renderDebit(){ const list=pieces.filter(q=>q.state==='stock');
  const key=JSON.stringify([list.map(q=>[q.id,q.kind,q.k,q.flip,measure(q).T]),cut.inProgress]); if(key===debitKey) return; debitKey=key;
  const nr=list.filter(q=>q.kind==='retour').length; $('debitN').textContent=list.length?`${list.length} pièce${list.length>1?'s':''}${nr?` · ${nr} à dégauchir`:''}`:'';
  $('debit').innerHTML= list.length? list.map(q=>{ const m=measure(q), rep=[m.s1?'SR1':'',m.s2?'SR2':''].filter(Boolean).join(' et ');
      return `<li data-k="${q.kind}"><div><b>${q.name} · ${dims(q)}</b> <small>${rep?`repères ${rep}`:'sans repère au crayon'} · ${m.planed.length? 'faces usinées : '+m.planed.map(f=>FACE_NAME[f].toLowerCase()).join(', ') : 'brute de sciage'}</small></div>
        <div class="d-act"><button class="toggle mini" type="button" data-kind="${q.id}" aria-pressed="${q.kind==='retour'}" title="Pièce à renvoyer à la dégauchisseuse">${q.kind==='retour'?'À dégauchir':'Pièce'}</button><button class="toggle mini" type="button" data-take="${q.id}" ${cut.inProgress?'disabled':''}>Reprendre</button></div></li>`; }).join('')
    : '<li class="debit-empty">Les pièces du lot en attente et les pièces mises de côté apparaissent ici.</li>';
  document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{ const why=take(+b.dataset.take); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); });
  document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ setKind(+b.dataset.kind); debitKey=''; app.ex.invalidate(); apply(); }); }
function renderExtra(){ renderFaces(); renderDebit(); }

/* ---------- schéma de principe : vue de côté, arbre fixe, table à la cote, pièce à l'entrée (épaisseurs agrandies) ---------- */
let coteKey='';
function drawCote(){ const E=entryPieces(), S=stuckPieces(), q=[...E,...S].sort((a,b)=>pressedH(b)-pressedH(a))[0]||null, h=q?pressedH(q):null;
  const key=[st.H,h,q&&q.k,cut.inProgress].join('|'); if(key===coteKey) return; coteKey=key;
  const yC=62, top=Math.max(st.H,h||0)+2, k=Math.min(2.4,78/top), yT=yC+st.H*k, ax=150, R=22, d=h===null?null:h-st.H;
  const pass=d!==null&&d>0, gr=d!==null&&d>-GRIP, big=pass&&d>PASS_MAX;
  let g=`<defs><pattern id="rbH" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--danger)" stroke-width="1.4"/></pattern>
    <marker id="rbA" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="var(--fg)"/></marker></defs>`;
  g+=`<rect x="20" y="${yT}" width="270" height="10" fill="var(--muted)" opacity=".5"/><text x="24" y="${yT+8}" font-size="7.5" fill="var(--fg)">table (elle monte et descend)</text>`;
  if(q){ const y0=yT-h*k; g+=`<rect x="168" y="${y0}" width="122" height="${h*k}" fill="#d9b98a" stroke="#8a6a40" stroke-width=".7"/>`;
    if(pass) g+=`<rect x="168" y="${y0}" width="122" height="${d*k}" fill="url(#rbH)" opacity=".85"/>`;
    g+=`<text x="286" y="${yT-4}" text-anchor="end" font-size="8.5" fill="#5a4020">pièce ${fmt(h)} mm ← avance</text>`; }
  g+=`<circle cx="${ax}" cy="${yC-R}" r="${R}" fill="none" stroke="var(--fg)" stroke-dasharray="3 2"/><circle cx="${ax}" cy="${yC-R}" r="6" fill="var(--fg)" opacity=".6"/><text x="${ax}" y="${yC-2*R-4}" text-anchor="middle" font-size="8" fill="var(--muted)">arbre (fixe)</text>`;
  const rl=(x,lab)=>`<circle cx="${x}" cy="${yC-9}" r="9" fill="none" stroke="var(--fg)" stroke-width="1.2" opacity=".7"/><text x="${x}" y="${yC-22}" text-anchor="middle" font-size="7.5" fill="var(--muted)">${lab}</text>`;
  g+=rl(214,'rouleau d\'entrée')+rl(96,'')+rl(62,'')+`<text x="79" y="${yC-22}" text-anchor="middle" font-size="7.5" fill="var(--muted)">rouleaux de sortie</text>`;
  g+=`<line x1="20" y1="${yC}" x2="290" y2="${yC}" stroke="var(--muted)" stroke-dasharray="3 3"/><text x="${ax}" y="${yC+10}" text-anchor="middle" font-size="7.5" fill="var(--muted)">bas du cercle de coupe</text>`;
  g+=`<line x1="34" y1="${yC}" x2="34" y2="${yT}" stroke="var(--fg)" stroke-width=".8" marker-start="url(#rbA)" marker-end="url(#rbA)"/><text x="40" y="${(yC+yT)/2+3}" font-size="10" font-weight="600" fill="var(--fg)">cote ${fmt(st.H)}</text>`;
  const msg= !q? 'aucune pièce à l\'entrée' : !gr? 'pièce plus mince que la cote : elle n\'avance pas' : !pass? 'aucune passe' : big? `passe ${fmt(d)} mm : ${PASS_MAX} mm au plus` : `passe ${fmt(d)} mm`;
  g+=`<text x="296" y="${yT+22}" text-anchor="end" font-size="9.5" font-weight="600" fill="${big?'var(--danger)':!q||!gr?'var(--muted)':'var(--fg)'}">${msg}</text>`;
  $('coteSvg').innerHTML=g; }

/* ---------- mise à jour complète ---------- */
function update(){
  placeAll();
  model.update(topAt);
  for(const k of ['motor','feed','asp','capot']) $(k).setAttribute('aria-pressed',String(st[k]));
  $('pass').setAttribute('aria-pressed',String(cut.inProgress));
  $('motor').textContent= st.motor? 'O · Moteur' : 'I · Moteur'; $('feed').textContent= st.feed? 'O · Avance' : 'I · Avance';
  $('pupH').textContent=fmt(st.H); $('pupV').textContent= st.feed? String(st.v) : '0';
  $('cote').value=Math.min(+$('cote').max,st.H); if(document.activeElement!==$('cote-n')) $('cote-n').value=st.H.toFixed(1);
  $('o-speed').textContent=`${st.v} m/min`; $('speed').value=st.v;
  const E=entryPieces(), grip=E.filter(q=>pressedH(q)>=st.H-GRIP), d= grip.length? Math.max(...grip.map(passDepth)) : null;
  $('coteInfo').textContent=`Passe : ${d===null?'— (pièce plus mince que la cote)':d<=0?'aucune':fmt(d)+' mm'} · pas des ondes ${fmt(wavePitch(),2)} mm`;
  for(const id of ['cote','cote-n','speed']) $(id).disabled=cut.inProgress;
  drawCote();
}

/* ---------- manipulations de la pièce ---------- */
const running=()=>st.motor||st.feed||model.spin>0.03;
function doOp(op){
  if(op==='reset'){ app.ex.setMode(app.ex.mode); return; }
  if(op==='push'){ /* la main vers l'entrée ou les rouleaux : jamais, machine en marche */
    if(running()){ app.recordDangers([['danger',HANDS]]); return say('Geste refusé : '+HANDS+'.','danger'); }
    return say(stuckPieces().length? 'Ne mettez pas les mains vers les rouleaux : descendez la table (cote plus grande que la pièce), puis « Ramener la pièce » pour la ressortir.' : 'On ne pousse jamais une pièce dans la raboteuse : les rouleaux l\'entraînent. Si elle n\'avance pas, vérifiez l\'avance et la cote.'); }
  if(cut.inProgress) return say('Passe en cours : ne touchez plus la pièce, restez hors de l\'axe de l\'entrée. Récupérez-la à la sortie.');
  if(op==='back'){ const s=stuckPieces()[0];
    if(s){ if(running()){ app.recordDangers([['danger',HANDS]]); return say('Geste refusé : '+HANDS+'.','danger'); }
      if(st.H<pressedH(s)+1) return say('La pièce est encore serrée par les rouleaux : descendez la table (cote plus grande que la pièce d\'au moins 1 mm), puis ressortez-la.');
      pullOut(s); F.level='info'; F.msg=`Pièce ressortie par l'entrée. Elle est trop courte pour la raboteuse (${s.L} mm) : mettez-la de côté.`; app.ex.invalidate(); apply(); return; }
    const why=bringBack(); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); return; }
  if(op==='aside'){ if(stuckPieces().length) return say('Une pièce est coincée : ressortez-la d\'abord (machine arrêtée, table descendue, « Ramener la pièce »).');
    const why=aside(); if(why) return say(why); F.msg=''; debitKey=''; app.ex.invalidate(); apply(); return; }
  const q=selPiece();
  if(!q||q.state!=='entry') return say(exitPieces().length? 'La pièce est sur le capot : « Ramener la pièce » pour la poser sur la table d\'entrée, ou « Mettre de côté ».' : 'Pas de pièce sur la table d\'entrée : « Reprendre » une pièce dans « Pièces débitées ».');
  orient(q,op); F.msg=''; app.ex.invalidate(); apply(); }
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>doOp(b.dataset.op));
/* présentation : remettre la pièce de départ à l'entrée (machine arrêtée) */
$('resetPres').onclick=()=>{ if(cut.inProgress) return say('Passe en cours : attendez la sortie de la pièce.'); app.ex.setMode(app.ex.mode); F.level='info'; F.msg='Pièce remise sur la table d\'entrée, machine arrêtée.'; app.ex.invalidate(); apply(); };

/* ---------- commandes de la machine ---------- */
const setH=v=>{ st.H=Math.round(Math.max(H_MIN,Math.min(H_MAX,+v||0))*10)/10; apply(); };
$('cote').addEventListener('input',e=>setH(e.target.value));
$('cote-n').addEventListener('change',e=>setH(e.target.value));
$('speed').addEventListener('input',e=>{ st.v=+e.target.value; apply(); });
$('motor').onclick=()=>{
  if(st.motor){ if(cut.inProgress) return say('Pièce en cours de rabotage : laissez-la sortir avant d\'arrêter l\'arbre (ou arrêt d\'urgence en cas de problème).'); st.motor=false; st.feed=false; apply(); return; }
  if(st.capot) return say('Capot ouvert : le moteur ne peut pas démarrer (interverrouillage). Fermez le capot.');
  st.motor=true; F.msg=''; apply(); };
$('feed').onclick=()=>{ if(!st.feed && !st.motor) return say('Démarrez d\'abord le moteur de l\'arbre : l\'avance ne se met en marche que lames en rotation.'); st.feed=!st.feed; apply(); };
$('asp').onclick=()=>{ st.asp=!st.asp; apply(); };
$('capot').onclick=()=>{ if(!st.capot && exitPieces().length) return say('Des pièces sont posées sur le capot : rangez-les (« Mettre de côté ») ou ramenez-les à l\'entrée avant de l\'ouvrir.');
  if(!st.capot && (st.motor||model.spin>0.03)) return say('Arrêtez le moteur et attendez l\'arrêt complet de l\'arbre : le capot reste verrouillé tant qu\'il tourne.');
  if(cut.inProgress) return; st.capot=!st.capot; F.level='info'; F.msg= st.capot? 'Capot ouvert : arbre, rouleaux, presseurs et linguets visibles. Le moteur ne peut pas démarrer capot ouvert.' : ''; app.ex.invalidate(); apply(); };
$('pass').onclick=()=>{ if(cut.inProgress) return;
  const why=startPass(passBlock); if(why){ if(why.trim()) return say(why); app.ex.invalidate(); apply(); return; }
  F.msg=''; app.ex.invalidate(); apply(); };

/* ---------- démarrage ---------- */
let lastSeq=0;
app.start({
  update, alerts:()=>{ if(cut.msgSeq!==lastSeq){ lastSeq=cut.msgSeq; F.msg=cut.lastMsg; F.level=/(s'est arrêtée|Arrachements|Pièce plus mince|n'avance pas)/.test(cut.lastMsg)?'warn':'info'; } return computeAlerts(); },
  steps:STEPS,
  loadMode(m){ LOADERS[m](); model.stopNow(); lastSeq=cut.msgSeq; facesKey=debitKey=''; F.msg=''; if(m!=='libre') stage.setView('vop'); },
  renderExtra,
  panelKey:()=>[cut.inProgress,pieces.map(q=>q.state+q.kind).join(),cut.sel,cut.keep,st.motor,st.feed],
  onPanel(){ document.querySelectorAll('#tools button').forEach(b=>b.disabled=cut.inProgress && !['reset','push'].includes(b.dataset.op)); },
  onPick(hit){ const q=hit && pieces.find(x=>x.id===hit.object.userData.pieceId); if(!q) return false; const m=measure(q), fc=C.faces(q);
    if(!cut.inProgress && setSel(q.id)){ facesKey=''; if(onMachine().length>1){ F.level='info'; F.msg=`Pièce en main : ${q.name.toLowerCase()} (contour orange).`; } app.ex.invalidate(); apply(); }
    $('info').innerHTML=`<b>${q.name} · ${dims(q)} mm</b><span>Sur la table : ${FACE_NAME[fc.down].toLowerCase()}${fc.down===sr1(q)?' (SR1)':fc.down===sr2(q)?' (SR2)':''} · dessus : ${FACE_NAME[fc.up].toLowerCase()} · repères : ${[m.s1?'SR1':'',m.s2?'SR2':''].filter(Boolean).join(', ')||'aucun'}</span>`; return true; },
  tick(dt,now){ const moved=tickPass(now); model.tick(dt); if(moved||cut.msgSeq!==lastSeq) apply(); },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, ignore:['piece'] },
});
window.__rabot={ st, pieces, cut, measure, C, model, setSel };
