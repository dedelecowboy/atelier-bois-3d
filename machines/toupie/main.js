/* Toupie KANAK 130 T : assemblage du module (modèle, outils, pièces, règles, scénarios) sur le moteur commun. */
import { createApp } from '../../engine/app.js';
import { initSchema } from '../../engine/schema.js';
import { initFamilies } from '../../engine/families.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import fiches from './data/fiches.txt';
import { RPMS, RINGS, H_MIN, H_MAX, P_MIN, P_MAX, E_MAX, OPEN_MIN, OPEN_MAX, HV_MAX, DH_MAX, VARIATEUR, TABLE_Y, FEED, BRUIT, BRUIT_DURETE } from './constants.js';
import { st, ctx, $, tool, saillie } from './state.js';
import { LIB, toolById, Rmax, Dmm, marking, profilePts, speedCheck, advisedRpm } from './tools.js';
import { buildModel } from './model.js';
import * as C from '../../engine/corroyage.js';
import { initPieces, pieces, cut, entryPiece, exitPieces, butePiece, onMachine, selPiece, startPass, tickPass, placeAll, topAt, frontAt,
  measure, profileStats, setSel, bringBack, release, aside, take, setKind, orient, fmt, dims, appui, haut, sr1, sr2, newPiece, predict, FACE_NAME } from './piece.js';
import { ENT_ROLL_OFF, ENT_CLR, lamBand, LAM_D, closeLamelles, chordAtGuide, lamStatus, placeEntr, stowEntr, ENT_SPEEDS, ENT_DOWN, ENT_ANGLE } from './guide.js';
import { computeAlerts, passBlock, guideInfo, contacts, INTERV, CHOC, HANDS, prediction } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage, fiches });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
/* réglages par famille (couleurs, alertes dans leur panneau) et lien avec la 3D : organes de chaque famille */
initFamilies(app, {
  parts:{ machine:['bati','table','rallonges','sectionneur','aspiration','moteur'], outil:['outil','arbre','verrou','inverseur','transmission','porte'],
    guidage:['guide_entree','guide_sortie','lamelles','support_guide'], protection:['capot_guide','protecteur','presseur_v','presseur_h','bagues'],
    piece:['piece','poussoir','entraineur'], pupitre:['pupitre','marche','arret'] },
  summary:{
    machine:()=>`${st.cad?'consignée':st.main?'sous tension':'hors tension'} · aspiration ${st.asp?'en marche':'arrêtée'}`,
    outil:()=>{ const t=tool(); return t? `${t.short}${st.flip?' (retourné)':''} · ${st.rpm.toLocaleString('fr-FR')} tr/min · ${st.dir===1?'↺':st.dir===-1?'↻':'0'} · h ${fmt(st.h)} mm` : 'aucun outil'; },
    guidage:()=>{ const L=lamStatus(); return `saillie ${fmt(saillie())} · sortie ${fmt(st.e)} mm · lamelles ${!L.set?'ouvertes':L.contact?'à refermer':'fermées'}`; },
    protection:()=>`${st.ring<320?'bague Ø '+st.ring:'sans bague'} · ${st.entr.placed?'entraîneur en place':st.prot?`presseurs ${fmt(st.hv,0)} / ${fmt(st.dh,0)} mm`:'protecteur escamoté'}`,
    avance:()=> st.entr.placed? `entraîneur posé · ${st.entr.v} m/min${st.entr.on?' · en marche':''}` : 'entraîneur escamoté',
    piece:()=>{ const q=entryPiece()||selPiece(); return `${q? q.name+' · '+(q.state==='exit'?'à la sortie':'à l\'entrée') : 'aucune pièce'} · poussoir ${st.push?'en main':'posé'}`; } } });
initSchema({ sub:'coupe vue depuis l\'entrée : outil, guide, presseurs, pièce', svgs:['profSvg'], pinIn:'famBar' });
ctx.app = app; ctx.model = model;
initPieces(app, model);
const F = app.ex.flash;
const apply=()=>app.apply();
const say=(msg,level='warn')=>{ F.msg=msg; F.level=level; app.ex.invalidate(); apply(); };
const info=msg=>say(msg,'info');

/* ---------- boutons générés : bibliothèque d'outils, vitesses, bagues ---------- */
$('toolLib').innerHTML=LIB.map(t=>`<button class="toggle" type="button" data-tool="${t.id}" aria-pressed="false" title="${t.desc.replace(/"/g,'&quot;')}">${t.short}<br><small>${marking(t)}</small></button>`).join('');
$('rpms').innerHTML= VARIATEUR? '<input id="rpmv" type="range" min="3000" max="10000" step="100">' : RPMS.map(n=>`<button class="toggle" type="button" data-rpm="${n}">${n.toLocaleString('fr-FR')}</button>`).join('');
$('rings').innerHTML=RINGS.map(d=>`<button class="toggle" type="button" data-ring="${d}">${d<320?'Ø '+d:'Sans'}</button>`).join('');

/* ---------- coupe : outil, guide, table, presseurs, pièce (vue depuis l'entrée : guide à droite) ---------- */
let svgKey='';
function pieceSectionMachine(q){ const im=(C.N-1)>>1, fc=C.faces(q), S=C.section(q,im);
  const v1=q.v1[im], v2=q.v2[im], w1=q.w1[im], w2=q.w2[im];
  const dist=(f,P)=>({F1:P.w-w1, F2:w2-P.w, C1:P.v-v1, C2:v2-P.v}[f]);
  return S.map(P=>[st.zIn+dist(fc.back,P), dist(fc.down,P)]); }
function renderSvg(){ const t=tool(), q=cut.mover||entryPiece(), R=q&&t? prediction(q) : null;
  const key=JSON.stringify([st.tool,st.flip,st.h,st.zIn,st.e,st.ring,st.hv,st.dh,st.prot,st.lam,st.entr.placed,st.entr.y,q&&[q.id,q.k,q.flip,(q.cuts||[]).length,q.log.length]]); if(key===svgKey) return; svgKey=key;
  const A=q? appui(q):60, Hp=q? haut(q):30, H=t? t.H:0, R0=t? Rmax(t):60;
  const z0=-12, z1=Math.max(st.zIn+A+18, R0+20), y0=Math.min(-8, st.h-6), y1=Math.max(Hp+12, st.h+H+8, st.prot?Math.min(st.hv,Hp+30)+8:0);
  const s=Math.min(284/(z1-z0), 136/(y1-y0)), X=z=>292-(z-z0)*s, Y=y=>142-(y-y0)*s;
  const pts=a=>a.map(([z,y])=>`${X(z).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
  let g='';
  // table (ouverture de la bague autour de l'arbre)
  const rr=st.ring/2; g+=`<rect x="${X(z1)}" y="${Y(0)}" width="${X(rr)-X(z1)}" height="${6*s}" fill="#4a4e52"/>`;
  g+=`<line x1="${X(0)}" y1="${Y(y0)}" x2="${X(0)}" y2="${Y(y1)}" stroke="#888" stroke-dasharray="6 3 1 3" stroke-width="1"/>`;
  // guide d'entrée (plein, derrière) et de sortie (tirets)
  g+=`<rect x="${X(st.zIn)}" y="${Y(130)}" width="${X(st.zIn-40)-X(st.zIn)}" height="${Y(0)-Y(130)}" fill="#c9ced3" fill-opacity=".45" stroke="#6b737a"/>`;
  // outil (demi-coupe)
  if(t){ const P=profilePts(t,st.flip).map(([y,r])=>[r,st.h+y]); g+=`<polygon points="${pts([[0,st.h],...P,[0,st.h+H]])}" fill="#8a9097" fill-opacity=".55" stroke="#3a3f45" stroke-width="1"/>`; }
  // pièce
  if(q){ g+=`<polygon points="${pts(pieceSectionMachine(q))}" fill="#d9b483" fill-opacity=".8" stroke="#7a5428" stroke-width="1"/>`;
    if(R&&R.any){ const im=(C.N-1)>>1; const r={...C.makePiece(C.pieceJSON(q))}; const f=R.f; const c=C.cutOf(r,f); const row=R.d[im];
      if(c) c.d=c.d.map(()=>row.slice()); else (r.cuts=r.cuts||[]).push({f,d:Array.from({length:C.N},()=>row.slice()),g:[],tear:false});
      g+=`<polygon points="${pts(pieceSectionMachine(r))}" fill="none" stroke="#c76a14" stroke-width="1.4" stroke-dasharray="3 2"/>`; } }
  if(st.e>0.05) g+=`<line x1="${X(st.zIn+st.e)}" y1="${Y(0)}" x2="${X(st.zIn+st.e)}" y2="${Y(Math.min(130,y1))}" stroke="#2f7d4f" stroke-width="1.4" stroke-dasharray="4 2"/>`;
  // lamelles passées (guide intégral), dans le plan du guide
  if(st.lam) st.lam.forEach((b,k)=>{ if(!b) return; const [a,c]=lamBand(k); if(a>y1) return; g+=`<rect x="${X(st.zIn)}" y="${Y(Math.min(c,y1))}" width="${X(st.zIn-LAM_D)-X(st.zIn)}" height="${Y(a)-Y(Math.min(c,y1))}" fill="#6b737a"/>`; });
  // entraîneur : rouleau posé sur la pièce
  if(st.entr.placed){ const yb=Math.max(st.entr.y, q? Hp : st.entr.y), zc=st.entr.z+ENT_ROLL_OFF; g+=`<rect x="${X(zc+30)}" y="${Y(Math.min(y1,yb+60))}" width="${X(zc-30)-X(zc+30)}" height="${Y(yb)-Y(Math.min(y1,yb+60))}" rx="4" fill="#c8442a" fill-opacity=".75"/><text x="${X(zc+30)}" y="${Y(Math.min(y1,yb+60))+10}">entraîneur</text>`; }
  // presseurs
  if(st.prot){ g+=`<line x1="${X(st.zIn+2)}" y1="${Y(st.hv)}" x2="${X(st.zIn+Math.min(60,A))}" y2="${Y(st.hv)}" stroke="#d6a800" stroke-width="3"/>`;
    g+=`<line x1="${X(st.zIn+st.dh)}" y1="${Y(3)}" x2="${X(st.zIn+st.dh)}" y2="${Y(Math.min(55,y1-4))}" stroke="#d6a800" stroke-width="3"/>`; }
  g+=`<text x="${X(st.zIn-38)}" y="${Y(Math.min(125,y1-2))+10}">guide</text><text x="${X(z1)+2}" y="${Y(0)+14}">table</text>`;
  if(t) g+=`<text x="4" y="12">saillie ${fmt(saillie())} · h ${fmt(st.h)} mm</text>`;
  if(R&&R.any) g+=`<text x="4" y="24" style="fill:#c76a14">après la passe (tirets) : ${fmt(R.depth)} mm</text>`;
  $('profSvg').innerHTML=g; }

/* ---------- profil de la pièce et mesure ---------- */
let profKey='';
function renderProfile(){ const q=cut.mover||entryPiece()||butePiece()||selPiece();
  if(!q){ $('profTab').innerHTML=''; $('profN').textContent=''; $('pmes').innerHTML='Aucune pièce sur la machine : « Reprendre » une pièce dans « Pièces débitées ».'; return; }
  const fc=C.faces(q), m=measure(q), key=JSON.stringify([q.id,q.k,q.flip,q.state,(q.cuts||[]).map(c=>[c.f,c.tear,c.g[100]]),q.log.length]); if(key===profKey) return; profKey=key;
  $('profN').textContent=`${q.name} · ${dims(q)}`;
  const mk=f=>q.face[f].mark==='loop'?' (SR1)':q.face[f].mark==='v'?' (SR2)':'';
  const rows=(q.cuts||[]).map(c=>{ const s=profileStats(q,c.f,'lo'); const lo=C.isF(c.f)?'C1':'F1';
    return `<tr><td>${FACE_NAME[c.f]}${mk(c.f)}</td><td>${s.full?'toute la face':`de ${fmt(s.from)} à ${fmt(s.to)} mm depuis le ${FACE_NAME[lo].toLowerCase()}`} · profondeur ${fmt(s.depth)} mm (arêtes ${fmt(s.edge)} / ${fmt(c.g[c.g.length-1])})</td><td style="color:${s.reg<=0.2&&!s.tear?'var(--ok)':'var(--danger)'}">${s.tear?'arrachements':s.reg<=0.2?'régulier':'irrégulier '+fmt(s.reg)+' mm'}</td></tr>`; });
  $('profTab').innerHTML= rows.length? rows.join('') : '<tr><td colspan="3">Pas encore de profil.</td></tr>';
  $('pmes').innerHTML=`<b>${q.name}</b> ${q.L} mm · sur la table : ${FACE_NAME[fc.down].toLowerCase()}${mk(fc.down)} · contre le guide : ${FACE_NAME[fc.back].toLowerCase()}${mk(fc.back)} · ${fmt(appui(q),0)} × ${fmt(haut(q),0)} mm${q.state==='exit'?' · à la sortie':''}`; }

/* ---------- pièces débitées ---------- */
let debitKey='';
function renderDebit(){ const list=pieces.filter(q=>q.state==='stock');
  const key=JSON.stringify([list.map(q=>[q.id,q.kind,q.k,q.flip,(q.cuts||[]).length]),cut.inProgress]); if(key===debitKey) return; debitKey=key;
  const ni=list.filter(q=>q.kind==='interdite').length; $('debitN').textContent=list.length?`${list.length} pièce${list.length>1?'s':''}${ni?` · ${ni} interdite${ni>1?'s':''} au guide`:''}`:'';
  $('debit').innerHTML= list.length? list.map(q=>{ const m=measure(q), rep=[m.s1?'SR1':'',m.s2?'SR2':''].filter(Boolean).join(' et ');
      return `<li data-k="${q.kind}"><div><b>${q.name} · ${dims(q)}</b> <small>${rep?`repères ${rep}`:'sans repère'} · ${m.profiled.length? 'profilée : '+m.profiled.map(f=>FACE_NAME[f].toLowerCase()).join(', ') : 'corroyée'}</small></div>
        <div class="d-act"><button class="toggle mini" type="button" data-kind="${q.id}" aria-pressed="${q.kind==='interdite'}" title="Pièce à ne pas usiner au guide (trop courte ou trop étroite)">${q.kind==='interdite'?'Interdite au guide':'Pièce'}</button><button class="toggle mini" type="button" data-take="${q.id}" ${cut.inProgress?'disabled':''}>Reprendre</button></div></li>`; }).join('')
    : '<li class="debit-empty">Les pièces du lot en attente et les pièces mises de côté apparaissent ici.</li>';
  document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{ const why=take(+b.dataset.take); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); });
  document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ setKind(+b.dataset.kind); debitKey=''; app.ex.invalidate(); apply(); }); }
function renderExtra(){ renderProfile(); renderDebit(); renderSvg(); }

/* ---------- mise à jour complète ---------- */
function pushPos(){ if(!st.push||st.entr.placed) return null; const q=cut.mover||entryPiece(); if(!q||!q.group) return null; return { x:q.x+q.L/1000, z:q.z }; }
function update(){
  placeAll();
  model.update(topAt, frontAt, pushPos());
  for(const k of ['main','cad','motor','au','asp','lock','hlock','prot']) $(k).setAttribute('aria-pressed',String(st[k]));
  $('main').textContent= st.main? 'Interrupteur général : I' : 'Interrupteur général : 0';
  $('cad').textContent= st.cad? 'Consignée (cadenas)' : 'Consigner';
  $('au').textContent= st.au? 'Arrêt d\'urgence enfoncé' : 'Arrêt d\'urgence';
  $('lock').textContent= st.lock? 'Arbre verrouillé' : 'Verrouiller l\'arbre';
  $('hlock').textContent= st.hlock? 'Hauteur bloquée' : 'Hauteur débloquée';
  $('prot').textContent= st.prot? 'En place' : 'Escamoté';
  { const L=lamStatus(); $('lam').setAttribute('aria-pressed',String(L.set&&!L.contact&&!L.loose)); }
  $('entrPlace').setAttribute('aria-pressed',String(st.entr.placed)); $('entrPlace').textContent= st.entr.placed? 'Escamoter' : 'Placer sur la pièce';
  $('entrOn').setAttribute('aria-pressed',String(st.entr.on));
  document.querySelectorAll('[data-ev]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.ev===st.entr.v)));
  $('o-entr').textContent= st.entr.placed? `posé · ${st.entr.v} m/min` : 'escamoté';
  $('pass').setAttribute('aria-pressed',String(cut.inProgress));
  $('motor').textContent= st.motor? 'O · Moteur' : 'I · Moteur'; $('entrOn').textContent= st.entr.on? 'O · Entraîneur' : 'I · Entraîneur';
  $('pupH').textContent=(st.h<0?'−':'')+fmt(Math.abs(st.h)); $('pupN').textContent= st.motor? st.rpm.toLocaleString('fr-FR') : '0';
  document.querySelector('[data-op=push]').setAttribute('aria-pressed',String(st.push));
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===st.tool)));
  document.querySelectorAll('[data-dir]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.dir===st.dir)));
  document.querySelectorAll('[data-rpm]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.rpm===st.rpm)));
  document.querySelectorAll('[data-ring]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.ring===st.ring)));
  if(VARIATEUR&&$('rpmv')) $('rpmv').value=st.rpm;
  const t=tool();
  $('o-outil').textContent= t? (st.flip?'retourné':'monté') : 'aucun';
  $('toolInfo').textContent= t? `${t.name} · ${marking(t)} · hauteur de coupe ${t.H} mm${st.flip?' · RETOURNÉ (flèche dessous)':''}` : 'Aucun outil sur l\'arbre.';
  $('o-dir').textContent= st.dir===1? '↺ anti-horaire' : st.dir===-1? '↻ horaire' : '0';
  { const sp=speedCheck(t,st.rpm); $('o-vc').textContent= t? `${st.rpm.toLocaleString('fr-FR')} tr/min · Vc ${fmt(sp.v,0)} m/s${sp.over?' > n max !':''}` : `${st.rpm.toLocaleString('fr-FR')} tr/min`; }
  $('o-ring').textContent= st.ring<320? `Ø ${st.ring}` : 'sans bague (Ø 320)';
  const setRange=(id,v)=>{ $(id).value=v; if(document.activeElement!==$(id+'-n')) $(id+'-n').value=(+v).toFixed(1); };
  setRange('haut',st.h); setRange('sail',+saillie().toFixed(1)); setRange('esor',st.e);
  for(const [id,v] of [['hv-n',st.hv],['dh-n',st.dh]]) if(document.activeElement!==$(id)) $(id).value=v.toFixed(1);
  $('hInfo').textContent= t? `Tranchant de ${fmt(st.h)} à ${fmt(st.h+t.H)} mm au-dessus de la table` : '';
  $('guideInfo').textContent= guideInfo();
  for(const id of ['haut','haut-n','sail','sail-n','esor','esor-n','hv-n','dh-n']) $(id).disabled=cut.inProgress;
}

/* ---------- gardes : réglages seulement arbre arrêté ---------- */
const spinning=()=>model.spin>0.03;
/* intervention sur l'outil, le guide, les presseurs… : moteur en marche = faute grave (geste refusé) ; arbre qui ralentit = attendre */
function guard(what){ if(st.motor||cut.inProgress){ app.recordDangers([['danger',INTERV]]); say('Geste refusé : '+INTERV+'.','danger'); return false; }
  if(spinning()){ say(`Attendez l'arrêt complet de l'arbre (frein) avant de ${what}.`); return false; } return true; }
/* montage de l'outil : machine consignée et arbre verrouillé (écrou) */
function toolGuard(what){ if(!guard(what)) return false;
  if(!st.cad){ say(`Consignez d'abord la machine (interrupteur général sur 0, puis cadenas) avant de ${what}.`); return false; }
  if(!st.lock){ say(`Verrouillez l'arbre en rotation pour desserrer et serrer l'écrou avant de ${what}.`); return false; } return true; }

/* ---------- commandes de la machine ---------- */
$('main').onclick=()=>{ if(st.main){ st.main=false; st.motor=false; st.entr.on=false; apply(); return; }
  if(st.cad) return say('Machine consignée : retirez le cadenas (« Consignée ») avant de remettre sous tension.'); st.main=true; F.msg=''; apply(); };
$('cad').onclick=()=>{ if(st.cad){ st.cad=false; F.msg=''; apply(); return; }
  if(st.main) return say('Pour consigner : interrupteur général sur 0 d\'abord, puis le cadenas.');
  if(spinning()) return say('Attendez l\'arrêt complet de l\'arbre.'); st.cad=true; info('Machine consignée : interrupteur général sur 0, cadenassé. Vous pouvez verrouiller l\'arbre et monter l\'outil.'); };
$('motor').onclick=()=>{
  if(st.motor){ if(cut.inProgress) return say('Pièce en cours d\'usinage : finissez la passe avant d\'arrêter (ou arrêt d\'urgence en cas de problème).'); st.motor=false; st.entr.on=false; apply(); return; }
  if(st.au) return say('Arrêt d\'urgence enfoncé : réarmez-le avant de démarrer.');
  if(st.cad||!st.main) return say('Machine hors tension ou consignée : retirez le cadenas et mettez l\'interrupteur général sur I.');
  if(st.lock) return say('Arbre verrouillé en rotation : le moteur ne démarre pas. Déverrouillez l\'arbre.');
  if(st.dir===0) return say('Inverseur sur 0 : choisissez le sens de rotation (↺ anti-horaire pour l\'avance de droite à gauche).');
  const c=contacts(); if(c.length){ app.recordDangers([['danger',CHOC]]); app.bruit?.bang('choc'); return say(`Démarrage interrompu : l'outil touche ${c.join(' et ')}. ${CHOC}.`,'danger'); }
  st.motor=true; F.msg=''; apply(); };
$('au').onclick=()=>{ if(st.au){ st.au=false; F.msg=''; apply(); return; } st.au=true; app.bruit?.bang('au'); st.motor=false; st.entr.on=false; info('Arrêt d\'urgence : moteur coupé et freiné. Réarmez le coup de poing quand tout est en ordre.'); };
$('asp').onclick=()=>{ st.asp=!st.asp; apply(); };
$('lock').onclick=()=>{ if(!guard(st.lock?'déverrouiller l\'arbre':'verrouiller l\'arbre')) return; st.lock=!st.lock; F.msg=''; apply(); };
$('hlock').onclick=()=>{ st.hlock=!st.hlock; apply(); };
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{ const id=b.dataset.tool; if(id===st.tool&&!st.flip) return;
  if(!toolGuard('changer d\'outil')) return; const t=toolById(id); st.tool=id; st.flip=false;
  info(`${t.name} monté, flèche ↺ dessus. Marquage : ${marking(t)}. Serrez l'écrou, déverrouillez l'arbre, faites tourner l'outil à la main.`); });
$('flipT').onclick=()=>{ if(!tool()) return say('Aucun outil sur l\'arbre.'); if(!toolGuard('retourner l\'outil')) return; st.flip=!st.flip;
  info(st.flip? 'Outil retourné : la flèche est dessous, les tranchants tournent dans l\'autre sens, le profil est inversé en hauteur.' : 'Outil remis à l\'endroit, flèche ↺ dessus.'); };
$('unmount').onclick=()=>{ if(!tool()) return; if(!toolGuard('démonter l\'outil')) return; st.tool=null; st.flip=false; info('Outil démonté et rangé.'); };
$('hand').onclick=()=>{ if(!tool()) return say('Aucun outil sur l\'arbre.'); if(!st.cad) return say('Faites tourner l\'outil à la main seulement machine consignée.');
  if(st.lock) return say('L\'arbre est verrouillé : déverrouillez-le pour le faire tourner à la main.');
  const c=contacts(); return c.length? say(`En tournant l'outil à la main : il touche ${c.join(' et ')}. Corrigez avant de démarrer.`) : info('En tournant l\'outil à la main : il ne touche ni les lamelles, ni la bague de table.'); };
document.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>{ const v=+b.dataset.dir; if(v===st.dir) return; if(!guard('changer le sens de rotation')) return; st.dir=v; F.msg=''; apply(); });
const setRpm=v=>{ if(st.motor||spinning()) return say('Porte de la transmission interverrouillée : arrêtez le moteur et attendez l\'arrêt de l\'arbre pour changer la courroie d\'étage.'); st.rpm=v; F.msg=''; apply(); };
document.querySelectorAll('[data-rpm]').forEach(b=>b.onclick=()=>setRpm(+b.dataset.rpm));
if(VARIATEUR) $('rpmv').addEventListener('change',e=>{ st.rpm=+e.target.value; apply(); });
document.querySelectorAll('[data-ring]').forEach(b=>b.onclick=()=>{ const v=+b.dataset.ring; if(v===st.ring) return; if(!guard('changer la bague de table')) return; st.ring=v; F.msg=''; apply(); });
/* réglages numériques (curseur + champ) : refusés moteur en marche ; la valeur revient à l'état */
function numCtl(id, set, what, extra){ const h=v=>{ if(!guard(what)||(extra&&!extra())){ apply(); return; } set(+v); F.msg=''; apply(); };
  $(id)?.addEventListener('input',e=>h(e.target.value)); $(id+'-n')?.addEventListener('change',e=>h(e.target.value)); }
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
numCtl('haut', v=>{ st.h=Math.round(clamp(v,H_MIN,H_MAX)*10)/10; }, 'régler la hauteur de l\'outil', ()=>{ if(st.hlock){ say('Hauteur bloquée : débloquez-la avant de la régler (puis rebloquez-la).'); return false; } return true; });
numCtl('sail', v=>{ const t=tool(); if(!t) return; st.zIn=Math.round((Rmax(t)-clamp(v,P_MIN,P_MAX))*10)/10; }, 'régler le guide');
numCtl('esor', v=>{ st.e=Math.round(clamp(v,0,E_MAX)*10)/10; }, 'régler le demi-guide de sortie');
/* guide intégral : une seule action, la fermeture automatique des lamelles autour de l'outil */
$('lam').onclick=()=>{ if(!tool()) return say('Montez d\'abord l\'outil.'); if(!guard('fermer les lamelles du guide')) return; closeLamelles(); const L=lamStatus();
  info(`Lamelles fermées : demi-guides à ${fmt((st.open-chordAtGuide())/2,0)} mm de l'outil, ${L.n} lamelles sur ${st.lam.length} passées au-dessus et au-dessous de l'outil. À refaire si vous changez l'outil, sa hauteur ou la saillie.`); };
/* entraîneur : mise en place automatique sur la pièce de l'entrée, marche, vitesse */
$('entrV').innerHTML=ENT_SPEEDS.map(v=>`<button class="toggle" type="button" data-ev="${v}">${v} m/min</button>`).join('');
$('entrPlace').onclick=()=>{ if(st.entr.placed){ if(!guard('escamoter l\'entraîneur')) return; stowEntr(); info('Entraîneur escamoté. Remettez le protège-mains à presseurs et réglez-le sur la pièce.'); return; }
  const q=entryPiece(); if(!q) return say('Posez d\'abord la pièce à l\'entrée, contre le guide : l\'entraîneur se règle sur elle.');
  if(!guard('placer l\'entraîneur')) return; placeEntr(haut(q),appui(q)); st.push=false;
  info(`Entraîneur posé sur la pièce : rouleaux ${ENT_DOWN} mm sous le dessus (ressorts), bloc tourné de ${ENT_ANGLE}° vers le guide pour plaquer la pièce, avancé pour rester à ${ENT_CLR} mm du guide sur toute sa longueur. Protège-mains escamoté. Démarrez l'arbre, puis l'entraîneur.`); };
$('entrOn').onclick=()=>{ if(st.entr.on){ st.entr.on=false; apply(); return; }
  if(!st.entr.placed) return say('Placez d\'abord l\'entraîneur sur la pièce.');
  if(!st.motor||model.spin<0.9) return say('Démarrez d\'abord l\'arbre et attendez qu\'il ait pris sa vitesse : l\'entraîneur se met en marche après.');
  st.entr.on=true; F.msg=''; apply(); };
document.querySelectorAll('[data-ev]').forEach(b=>b.onclick=()=>{ st.entr.v=+b.dataset.ev; apply(); });
numCtl('hv', v=>{ st.hv=Math.round(clamp(v,0,HV_MAX)*10)/10; }, 'régler le presseur vertical');
numCtl('dh', v=>{ st.dh=Math.round(clamp(v,0,DH_MAX)*10)/10; }, 'régler le presseur horizontal');
$('prot').onclick=()=>{ if(!st.prot&&st.entr.placed) return say('L\'entraîneur occupe la place du protège-mains : escamotez-le d\'abord.'); if(!guard(st.prot?'escamoter le protecteur':'mettre le protecteur en place')) return; st.prot=!st.prot; F.msg=''; apply(); };
$('pass').onclick=()=>{ if(cut.inProgress) return;
  const why=startPass(q=>passBlock(q,model.spin)); if(why) return say(why);
  F.msg=''; app.ex.invalidate(); apply(); };

/* ---------- manipulations de la pièce ---------- */
function doOp(op){
  if(op==='reset'){ app.ex.setMode(app.ex.mode); return; }
  if(op==='push'){ st.push=!st.push; F.msg=''; app.ex.invalidate(); apply(); return; }
  if(cut.inProgress) return say('Passe en cours : poussez jusqu\'au bout, sans revenir en arrière ; la pièce sort à gauche.');
  if(op==='back'){ if(butePiece()){ if(st.motor||spinning()){ app.recordDangers([['danger',HANDS]]); return say('Geste refusé : '+HANDS+'.','danger'); }
      const why=release(); if(why) return say(why); info('Pièce dégagée et remise à l\'entrée. Réglez le demi-guide de sortie avant de repasser.'); return; }
    const why=bringBack(); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); return; }
  if(op==='aside'){ if(butePiece()) return say('La pièce est arrêtée contre le demi-guide de sortie : machine arrêtée, « Ramener la pièce » pour la dégager.');
    const why=aside(); if(why) return say(why); F.msg=''; debitKey=''; app.ex.invalidate(); apply(); return; }
  const q=entryPiece();
  if(!q) return say(exitPieces().length? 'La pièce est à la sortie : « Ramener la pièce » pour la remettre à l\'entrée, ou « Mettre de côté ».' : 'Pas de pièce à l\'entrée : « Reprendre » une pièce dans « Pièces débitées ».');
  orient(q,op); F.msg=''; app.ex.invalidate(); apply(); }
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>doOp(b.dataset.op));
$('resetPres').onclick=()=>{ if(cut.inProgress) return say('Passe en cours : attendez la sortie de la pièce.'); app.ex.setMode(app.ex.mode); info('Pièce de départ remise à l\'entrée, machine arrêtée.'); };

/* ---------- bruit (engine/audio.js) : régime réel de l'arbre, outil dans le bois, charge de la passe ---------- */
function bruitEtat(){ const t=tool(), q=cut.mover, R=q&&q.res;
  let c=0, charge=1;
  if(cut.inProgress&&q&&R&&R.any&&q.state==='moving'){ const half=chordAtGuide()/2000+0.005;   // l'outil coupe sur la corde au plan du guide (m)
    const ov=Math.min(q.x+q.L/1000,half)-Math.max(q.x,-half); c=Math.max(0,Math.min(1,ov/(2*half)));
    const feed=st.entr.placed&&st.entr.on? st.entr.v : FEED;
    charge=Math.max(0.15,R.depth/3)*(feed/6)*(BRUIT_DURETE[q.wood]||1.3); }   // passe forte, avance rapide, bois dur : plus fort, plus aigu
  return { on:st.motor&&st.dir!==0, rpm:st.rpm, spin:model.spin, cut:c, charge, dents:t?.Z||2 }; }

/* ---------- démarrage ---------- */
let lastSeq=0, wasBute=false;
app.start({
  update, alerts:()=>{ if(cut.msgSeq!==lastSeq){ lastSeq=cut.msgSeq; F.msg=cut.lastMsg; F.level=/(bute|Arrachements|Entaille|n'a pas|avalant)/.test(cut.lastMsg)?'warn':'info'; } return computeAlerts(); },
  steps:STEPS,
  loadMode(m){ LOADERS[m](); model.stopNow(); lastSeq=cut.msgSeq; profKey=debitKey=svgKey=''; F.msg=''; if(m!=='libre') stage.setView('vop'); },
  renderExtra,
  panelKey:()=>[cut.inProgress,pieces.map(q=>q.state+q.kind).join(),cut.sel,st.motor,st.cad,st.lock,model.spin>0.03],
  onPanel(){ document.querySelectorAll('#tools button').forEach(b=>b.disabled=cut.inProgress && !['reset','push'].includes(b.dataset.op)); },
  onPick(hit){ const q=hit && pieces.find(x=>x.id===hit.object.userData.pieceId); if(!q) return false; const m=measure(q), fc=C.faces(q);
    if(!cut.inProgress && setSel(q.id)){ profKey=''; F.level='info'; F.msg=`Pièce en main : ${q.name.toLowerCase()} (contour orange).`; app.ex.invalidate(); apply(); }
    $('info').innerHTML=`<b>${q.name} · ${dims(q)} mm</b><span>Sur la table : ${FACE_NAME[fc.down].toLowerCase()}${fc.down===sr1(q)?' (SR1)':''} · contre le guide : ${FACE_NAME[fc.back].toLowerCase()}${fc.back===sr2(q)?' (SR2)':''} · repères : ${[m.s1?'SR1':'',m.s2?'SR2':''].filter(Boolean).join(', ')||'aucun'}</span>`; return true; },
  tick(dt,now){ const moved=tickPass(now, st.motor&&model.spin>0.5&&(!st.entr.placed||st.entr.on)); const s0=model.spin; model.tick(dt);
    const b=!!butePiece(); if(b&&!wasBute) app.bruit?.bang('coup'); wasBute=b;   // la pièce bute contre le demi-guide de sortie
    if(moved||cut.msgSeq!==lastSeq||(s0>0.03)!==(model.spin>0.03)) apply(); },
  bruit:{ niveaux:BRUIT, etat:bruitEtat },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, ignore:['piece'] },
});
/* poignée pour les tests et pour la future page « atelier » : importPiece(pieceJSON d'une autre machine) pose la pièce à l'entrée */
window.__toupie={ st, pieces, cut, C, model, setSel, profileStats, predict, measure,
  importPiece(json,name='Pièce'){ if(entryPiece()) aside(); const q=newPiece({json,name}); apply(); return q.id; } };
