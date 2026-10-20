/* Tenonneuse KANAK 160 TN : assemblage du module (modèle, outils, pièces, règles, scénarios) sur le moteur commun. */
import { createApp } from '../../engine/app.js';
import { initSchema } from '../../engine/schema.js';
import { initFamilies } from '../../engine/families.js';
import config from './config.js';
import organes from './data/organes.txt';
import qcm from './data/qcm.txt';
import reperage from './data/reperage.txt';
import { HEADS, HEAD_NAME, HEAD_SHORT, N_HEAD, LT, HINF, EP, DEC, HT, PT, BUT, PROT, ANG, AVANCES, C_HOME } from './constants.js';
import { st, ctx, $, tool, anyRun, BL } from './state.js';
import { libFor, toolById, marking, speedCheck, edgesOk } from './tools.js';
import { buildModel } from './model.js';
import * as C from '../../engine/corroyage.js';
import { initPieces, pieces, cut, chariotPiece, atHome, startPass, tickPass, returnChariot, placeAll, pieceTop, aside, take, setKind, orient,
  setZ, zContact, overhang, endInfo, peKey, peRenew, fromFace, lenFace, betweenShoulders, vmap, predict, newPiece, H, D, fmt, dims, sr1, sr2, endName, FACE_NAME } from './piece.js';
import { computeAlerts, passBlock, prediction, CHARGE, INTERV, spinning } from './rules.js';
import { STEPS, LOADERS, SCENS, scenCriteria } from './scenarios.js';

const app = createApp(config, { organes, qcm, reperage });
const { stage } = app;
const model = buildModel({ root:stage.root, tagPart:app.parts.tagPart, partMeshes:app.parts.partMeshes });
ctx.app = app; ctx.model = model;
initPieces(app, model);
const F = app.ex.flash;
const apply=()=>app.apply();
const say=(msg,level='warn')=>{ F.msg=msg; F.level=level; app.ex.invalidate(); apply(); };
const info=msg=>say(msg,'info');

/* ---------- boutons générés ---------- */
$('heads').innerHTML=HEADS.map(h=>`<button class="toggle" type="button" data-head="${h}" aria-pressed="false">${HEAD_SHORT[h]}</button>`).join('');
$('avs').innerHTML=AVANCES.map(v=>`<button class="toggle" type="button" data-av="${v}">${v} m/min</button>`).join('');
function renderLib(){ $('toolLib').innerHTML=libFor(st.head).map(t=>`<button class="toggle" type="button" data-tool="${t.id}" aria-pressed="false" title="${t.desc.replace(/"/g,'&quot;')}">${t.short}<br><small>${marking(t)}</small></button>`).join('');
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>mountTool(b.dataset.tool)); }
renderLib();

/* ---------- vue de côté du bout : outils, pièce et, en tirets, ce que fera la passe ---------- */
let svgKey='';
function bandY(q,c){ const m=vmap(q); if(m.ax!==c.ax) return null; const inv=x=>{ const a=m.f(0), b=m.f(1); return (x-a)/(b-a); }; const y0=inv(c.a), y1=inv(c.b); return [Math.min(y0,y1),Math.max(y0,y1)]; }
function renderSvg(){ const q=chariotPiece(), R=q? prediction(q) : null, ti=tool('inf'), ts=tool('sup'), tt=tool('tou');
  const key=JSON.stringify([st.lt,st.hInf,st.ep,st.dec,st.ht,st.pt,st.tools,st.flips,st.bl,q&&[q.id,q.k,q.flip,q.L,q.zEnd,q.ends]]); if(key===svgKey) return; svgKey=key;
  /* vue de côté : z (le long de la pièce) horizontal, outils à gauche, chariot à droite ; y = hauteur au-dessus du chariot */
  const Hp=q? H(q) : 40, z0=-(st.lt+38), z1=Math.max(45,st.lt*0.6), y0=-22, y1=Hp+22;
  const W=300, Hs=160, s=Math.min((W-50)/(z1-z0), (Hs-34)/(y1-y0)), X=z=>42+(z-z0)*s, Y=y=>Hs-14-(y-y0)*s;
  const f1=v=>v.toFixed(1);
  const rect=(za,zb,ya,yb,attr)=>{ const xa=X(Math.max(z0,Math.min(za,zb))), xb=X(Math.min(z1,Math.max(za,zb))), yA=Y(Math.min(y1,Math.max(ya,yb))), yB=Y(Math.max(y0,Math.min(ya,yb))); return xb>xa&&yB>yA? `<rect x="${f1(xa)}" y="${f1(yA)}" width="${f1(xb-xa)}" height="${f1(yB-yA)}" ${attr}/>` : ''; };
  const line=(za,ya,zb,yb,attr)=>`<line x1="${f1(X(za))}" y1="${f1(Y(ya))}" x2="${f1(X(zb))}" y2="${f1(Y(yb))}" ${attr}/>`;
  const txt=(x,y,t,attr='')=>`<text x="${f1(x)}" y="${f1(y)}" ${attr}>${t}</text>`;
  /* cote : trait fin avec flèches et valeur */
  const coteH=(za,zb,y,t)=>line(za,y,zb,y,'stroke="var(--fg)" stroke-width=".8" marker-start="url(#ar)" marker-end="url(#ar)"')+txt((X(za)+X(zb))/2,Y(y)-3,t,'text-anchor="middle" class="c"');
  const coteV=(z,ya,yb,t,left)=>line(z,ya,z,yb,'stroke="var(--fg)" stroke-width=".8" marker-start="url(#ar)" marker-end="url(#ar)"')+txt(X(z)+(left?-3:3),(Y(ya)+Y(yb))/2+3,t,`text-anchor="${left?'end':'start'}" class="c"`);
  let g='<defs><marker id="ar" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L6,3L0,6z" fill="var(--fg)"/></marker><pattern id="hz" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#c76a14" fill-opacity=".18"/><line x1="0" y1="0" x2="0" y2="5" stroke="#c76a14" stroke-width="1.6"/></pattern></defs>';
  g+=rect(30,z1+5,-8,0,'fill="#9aa1a7"')+txt(X(z1)-2,Y(-8)+10,'chariot','text-anchor="end"');                      // table du chariot
  g+=line(0,y0,0,y1,'stroke="var(--muted)" stroke-dasharray="4 3" stroke-width="1"')+txt(X(0)+3,Y(y1)+9,'arasement');
  // pièce (bouts déjà usinés creusés) et, hachuré, ce que la passe va enlever
  if(q){ const z=q.zEnd; g+=rect(z,z1+10,0,Hp,'fill="#e2c294" stroke="#7a5428" stroke-width="1"');
    const E=q.ends&&q.ends[endName(q)]; if(E) for(const c of E.cuts){ const yy=bandY(q,c); if(yy) g+=rect(z+c.d0,z+c.d1,yy[0],yy[1],'fill="var(--bg)"'); }
    if(R){ if(R.chute>0) g+=rect(z,z+R.chute,0,Hp,'fill="url(#hz)"');
      for(const c of R.cuts){ const yy=bandY(q,c); if(yy) g+=rect(R.zEnd+c.d0,R.zEnd+c.d1,Math.max(0,yy[0]),Math.min(Hp,yy[1]),'fill="url(#hz)"'); } } }
  // outils : arête de coupe en trait fort, corps en clair
  const TOOL='fill="#6b737a" fill-opacity=".22" stroke="#3a3f45" stroke-width="1"';
  if(ti){ g+=rect(-ti.Lc,0,st.hInf-9,st.hInf,TOOL)+line(-ti.Lc,st.hInf,0,st.hInf,'stroke="#3a3f45" stroke-width="2.2"')+txt(X(Math.max(z0,-ti.Lc))+3,Y(st.hInf-9)+8,'dérouleur inf.','class="t"'); }
  if(ts){ const yb=st.hInf+st.ep; g+=rect(-st.dec-ts.Lc,-st.dec,yb,yb+9,TOOL)+line(-st.dec-ts.Lc,yb,-st.dec,yb,'stroke="#3a3f45" stroke-width="2.2"')+txt(X(Math.max(z0,-st.dec-ts.Lc))+3,Y(yb+9)-2,'dérouleur sup.','class="t"'); }
  if(tt&&st.pt>0) g+=rect(-st.lt+st.pt-40,-st.lt+st.pt,st.ht,st.ht+tt.Lc,'fill="#3a6fb0" fill-opacity=".55" stroke="#2a5590"');
  g+=line(-st.lt,y0+4,-st.lt,y1,'stroke="#c4261c" stroke-width="1.8"')+txt(X(-st.lt)-3,Y(y1)+9,'scie','text-anchor="end" style="fill:#c4261c"');
  // cotes du réglage : longueur du tenon (scie → arasement), joue (hauteur du dérouleur inférieur), épaisseur
  g+=coteH(-st.lt,0,y0+6,`${fmt(st.lt)}`);
  const zc=-st.lt-12; g+=coteV(zc,0,st.hInf,`${fmt(st.hInf)}`,true)+coteV(zc+6,st.hInf,st.hInf+st.ep,`${fmt(st.ep)}`,false);
  if(st.dec) g+=txt(X(-st.dec)+3,Y(st.hInf+st.ep+9)+8,`décalage ${fmt(st.dec)}`,'class="c"');
  g+=txt(4,10,R&&(R.cuts.length||R.chute)? 'hachuré : matière enlevée par la passe' : 'aucun outil ne touchera la pièce','style="fill:#c76a14"');
  $('profSvg').innerHTML=g; }

/* ---------- bouts de la pièce (mesures) ---------- */
let profKey='';
function renderProfile(){ const q=chariotPiece();
  if(!q){ $('profTab').innerHTML=''; $('profN').textContent=''; $('pmes').innerHTML='Aucune pièce sur le chariot : « Reprendre » une pièce dans « Pièces débitées ».'; return; }
  const fc=C.faces(q), key=JSON.stringify([q.id,q.k,q.flip,q.L,q.zEnd,q.ends,st.butOn,st.but,st.lt]); if(key===profKey) return; profKey=key;
  $('profN').textContent=`${q.name} · ${dims(q)}`;
  const mk=f=>q.face[f].mark==='loop'?' (SR1)':q.face[f].mark==='v'?' (SR2)':'';
  const s1=sr1(q)||'F1', s2=sr2(q)||'C1', rows=[];
  for(const e of ['A','B']){ const I=endInfo(q,e); if(!I) continue;
    for(const it of I.items){
      if(it.type==='tenon'||it.type==='joue'){ const ref=it.ax==='w'?s1:s2, two=it.type==='tenon';
        rows.push(`<tr><td>Bout ${e} : ${two?'tenon':'joue seule'}${it.ax==='v'?' (épaulements)':''}</td><td>épaisseur ${fmt(it.th)} · à ${fmt(fromFace(it,ref))} mm de ${ref==='F1'||ref==='F2'?'SR1':'SR2'} · joues ${fmt(it.lenLo)} / ${fmt(it.lenHi)} mm${it.inc?' · joue incomplète':''}</td><td style="color:${I.ec?'var(--danger)':'var(--ok)'}">${I.ec?'éclats':'net'}</td></tr>`); }
      else if(it.type==='enf') rows.push(`<tr><td>Bout ${e} : enfourchement</td><td>largeur ${fmt(it.width)} · à ${fmt(fromFace(it,s1))} mm de SR1 · profondeur ${fmt(it.depth)} mm</td><td style="color:${I.ec?'var(--danger)':'var(--ok)'}">${I.ec?'éclats':'net'}</td></tr>`);
      else rows.push(`<tr><td>Bout ${e}</td><td>bout entièrement enlevé</td><td></td></tr>`); } }
  const bs=betweenShoulders(q); if(bs!==null) rows.push(`<tr><td>Entre arasements (côté SR1)</td><td>${fmt(bs)} mm</td><td></td></tr>`);
  $('profTab').innerHTML= rows.length? rows.join('') : '<tr><td colspan="3">Bouts bruts : pas encore de tenon.</td></tr>';
  const g=st.butOn? zContact(q)-q.zEnd : null;
  $('pmes').innerHTML=`<b>${q.name}</b> ${fmt(q.L,0)} mm · sur le chariot : ${FACE_NAME[fc.down].toLowerCase()}${mk(fc.down)} · contre le guide : ${FACE_NAME[fc.back].toLowerCase()}${mk(fc.back)} · bout ${endName(q)} vers les outils · dépasse de ${fmt(overhang(q))} mm le trait de scie${g!==null?(g<=0.3?' · en butée':` · à ${fmt(g)} mm de la butée`):''}`; }

/* ---------- pièces débitées ---------- */
let debitKey='';
function renderDebit(){ const list=pieces.filter(q=>q.state==='stock');
  const key=JSON.stringify([list.map(q=>[q.id,q.kind,q.L,q.ends]),cut.inProgress,cut.phase]); if(key===debitKey) return; debitKey=key;
  const ni=list.filter(q=>q.kind==='interdite').length; $('debitN').textContent=list.length?`${list.length} pièce${list.length>1?'s':''}${ni?` · ${ni} écartée${ni>1?'s':''}`:''}`:'';
  $('debit').innerHTML= list.length? list.map(q=>{ const ends=['A','B'].filter(e=>q.ends&&q.ends[e]&&q.ends[e].cuts.length);
      return `<li data-k="${q.kind}"><div><b>${q.name} · ${dims(q)}</b> <small>${ends.length? 'usinée au bout '+ends.join(' et ') : 'bouts bruts'}${cut.chutes&&q===list[0]?'':''}</small></div>
        <div class="d-act"><button class="toggle mini" type="button" data-kind="${q.id}" aria-pressed="${q.kind==='interdite'}" title="Pièce à ne pas usiner à la tenonneuse (trop courte ou trop étroite)">${q.kind==='interdite'?'Pas à la tenonneuse':'Pièce'}</button><button class="toggle mini" type="button" data-take="${q.id}" ${cut.inProgress?'disabled':''}>Reprendre</button></div></li>`; }).join('')
    : '<li class="debit-empty">Les pièces du lot en attente et les pièces mises de côté apparaissent ici.</li>';
  document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{ if(!loadGuard()) return; const why=take(+b.dataset.take); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); });
  document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{ setKind(+b.dataset.kind); debitKey=''; app.ex.invalidate(); apply(); }); }
function renderExtra(){ renderProfile(); renderDebit(); renderSvg(); }

/* ---------- réglages par famille (couleurs, alertes dans leur panneau) et lien avec la 3D ---------- */
const mm=v=>fmt(v,v%1?1:0);
initFamilies(app, {
  parts:{ machine:['bati','aspiration','capot','carters','filin','boitier','sectionneur','armoire','moteurs'],
    outil:['scie','der_sup','der_inf','toupie'], cotes:['regl_scie','regl_dec','regl_inf','regl_ep','regl_tou_h','regl_tou_p'],
    guidage:['guide','graduation','butee90','butee'], protection:['presse','protecteur','pare_eclat'],
    chariot:['chariot','table_chariot','verrou_chariot','rail'], piece:['piece'],
    pupitre:['pupitre','arret_urgence','ouverture_capot','arret','rearmement','marche'] },
  summary:{
    machine:()=> st.cad? 'consignée' : !st.main? 'hors tension' : st.capot? 'capot ouvert' : st.armed? 'réarmée' : 'non réarmée',
    outil:()=> HEADS.map(h=>HEAD_SHORT[h]+(tool(h)?'':' : —')).join(' · '),
    cotes:()=>`tenon ${mm(st.ep)} × ${mm(st.lt)} mm · joue ${mm(st.hInf)} mm`,
    guidage:()=>`${st.ang>0.05? 'guide à '+fmt(st.ang,0)+'°' : 'guide d\'équerre'} · butée ${st.butOn? 'à '+mm(st.but)+' mm' : 'relevée'}`,
    protection:()=>`${st.presse?'presse serrée':'presse desserrée'} · protecteur ${mm(st.protH)} mm`,
    chariot:()=>`${st.lockC?'verrouillé':'déverrouillé'} · ${st.av} m/min`,
    piece:()=>{ const q=chariotPiece(); return q? dims(q) : 'aucune pièce sur le chariot'; } } });

/* ---------- schéma de principe sur la vue 3D (engine/schema.js) ---------- */
initSchema({ pinIn:'famBar', sub:'vue de côté du bout de la pièce',
  html:'<svg class="prof-svg" id="profSvg" viewBox="0 0 300 160" role="img" aria-label="Vue de côté du bout de la pièce : scie, dérouleurs, unité de toupillage et tenon obtenu"></svg>' });

/* ---------- mise à jour complète ---------- */
function update(){
  placeAll();
  model.update(pieceTop());
  for(const k of ['main','cad','au','filin','asp','capot','carters','lockC','presse']) $(k).setAttribute('aria-pressed',String(!!st[k]));
  $('rearm').setAttribute('aria-pressed',String(st.armed&&st.main&&!st.cad));
  $('main').textContent= st.main? 'Interrupteur général : I' : 'Interrupteur général : 0';
  $('cad').textContent= st.cad? 'Consignée (cadenas)' : 'Consigner';
  $('au').textContent= st.au? 'Arrêt d\'urgence enfoncé' : 'Arrêt d\'urgence';
  $('filin').textContent= st.filin? 'Filin tiré (boîtier déclenché)' : 'Filin de sécurité';
  $('rearm').textContent= st.armed&&st.main&&!st.cad? 'Réarmée' : 'Réarmement';
  $('sel').setAttribute('aria-pressed',String(!!st.sel)); $('sel').textContent=`Ouverture capot : ${st.sel?1:0}`;
  $('capot').textContent= st.capot? 'Capot ouvert' : 'Capot fermé';
  $('carters').textContent= st.carters? 'Carters en place' : 'Carters déposés';
  $('lockC').textContent= st.lockC? 'Verrouillé' : 'Déverrouillé';
  $('presse').textContent= st.presse? 'Presse serrée' : 'Presse desserrée';
  $('butOn').setAttribute('aria-pressed',String(st.butOn)); $('butOn').textContent= st.butOn? 'Abaissée' : 'Relevée';
  $('peOn').setAttribute('aria-pressed',String(st.pe.on)); $('peOn').textContent= st.pe.on? 'Pare-éclat en place' : 'Pare-éclat retiré';
  $('lock').setAttribute('aria-pressed',String(st.locks[st.head])); $('lock').textContent= st.locks[st.head]? 'Arbre bloqué' : 'Bloquer l\'arbre';
  $('pass').setAttribute('aria-pressed',String(cut.inProgress));
  $('pupL').textContent=fmt(st.lt); $('pupE').textContent=fmt(st.ep);
  const RUNL={scie:'Scie',inf:'Dér. inf.',sup:'Dér. sup.',tou:'Toupie'};
  document.querySelectorAll('[data-run]').forEach(b=>{ const on=!!st.run[b.dataset.run]; b.setAttribute('aria-pressed',String(on)); b.textContent=(on?'O · ':'I · ')+RUNL[b.dataset.run]; });
  document.querySelectorAll('[data-head]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.head===st.head)));
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===st.tools[st.head])));
  document.querySelectorAll('[data-av]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.av===st.av)));
  document.querySelectorAll('[data-mains]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mains===st.mains)));
  const t=tool(st.head);
  $('o-outil').textContent= HEAD_SHORT[st.head]+' : '+(t? (st.flips[st.head]?'retourné':'monté') : 'aucun');
  { const sp=speedCheck(t,st.head); $('toolInfo').textContent= t? `${HEAD_NAME[st.head]} (${N_HEAD[st.head].toLocaleString('fr-FR')} tr/min) : ${t.name} · ${marking(t)} · Vc ${fmt(sp.v,0)} m/s${sp.over?' · n max dépassé !':''}${st.flips[st.head]?' · RETOURNÉ':''}${edgesOk(t,st.flips[st.head],st.head)?'':' · tranchants à l\'envers'}` : `${HEAD_NAME[st.head]} : aucun outil.`; }
  const setRange=(id,v)=>{ $(id).value=v; if(document.activeElement!==$(id+'-n')) $(id+'-n').value=(+v).toFixed(1); };
  setRange('lt',st.lt); setRange('hinf',st.hInf); setRange('ep',st.ep); setRange('dec',st.dec); setRange('ht',st.ht); setRange('pt',st.pt); setRange('ang',st.ang);
  for(const [id,v] of [['but-n',st.but],['prot-n',st.protH]]) if(document.activeElement!==$(id)) $(id).value=v.toFixed(1);
  { const q=chariotPiece(); if(document.activeElement!==$('over-n')) $('over-n').value= q? overhang(q).toFixed(1) : ''; }
  $('setInfo').textContent=`Trait de scie à ${fmt(st.lt)} mm de l'arasement · tenon de ${fmt(st.ep)} mm, joue du dessous ${fmt(st.hInf)} mm${st.dec?` · arasements décalés de ${fmt(st.dec)} mm`:''}${(st.bl.hInf||st.bl.ep||st.bl.ht)?' · réglé en descendant : jeu non rattrapé':''}`;
  $('peInfo').textContent= !st.pe.on? 'Pare-éclat retiré : éclats à la sortie des outils.' : st.pe.key===null? 'Pare-éclat neuf : la prochaine passe l\'usine.' : 'Pare-éclat usiné'+(prediction0()?'':' (avec d\'autres réglages : à renouveler)');
  for(const id of ['lt','lt-n','hinf','hinf-n','ep','ep-n','dec','dec-n','ht','ht-n','pt','pt-n','ang','ang-n','but-n','prot-n','over-n']) $(id).disabled=cut.inProgress;
}
const prediction0=()=>st.pe.key===peKey();

/* ---------- gardes ---------- */
/* réglage : outils arrêtés (blocage, pas une faute) ; les compteurs de la scie, du décalage et de la profondeur de toupillage sont sous le capot */
function setGuard(what, needCapot){
  if(cut.inProgress) { say('Chariot en mouvement : attendez la fin de la passe.'); return false; }
  if(anyRun()){ say(`Arrêtez les outils avant de ${what} : les réglages se font outils arrêtés.`); return false; }
  if(spinning()){ say(`Attendez l'arrêt complet des outils (frein) avant de ${what}.`); return false; }
  if(needCapot && !st.capot){ say(`Ce réglage est sous le capot : sélecteur « Ouverture capot » sur 1, attendez la temporisation, ouvrez le capot avant de ${what}.`); return false; }
  return true; }
/* montage des outils : capot ouvert, machine consignée, carters déposés, arbre bloqué */
function toolGuard(what){ if(!setGuard(what,true)) return false;
  if(!st.cad){ say(`Consignez d'abord la machine (interrupteur général sur 0, puis cadenas) avant de ${what}.`); return false; }
  if(st.carters){ say(`Déposez d'abord les carters des outils avant de ${what}.`); return false; }
  if(!st.locks[st.head]){ say(`Bloquez l'arbre (${HEAD_NAME[st.head]}) pour desserrer et serrer l'outil avant de ${what}.`); return false; } return true; }
/* pièce : chariot ramené en position de chargement (sinon faute grave, geste refusé) */
function loadGuard(){ if(cut.inProgress){ say('Chariot en mouvement : attendez la fin de la passe.'); return false; }
  if(!atHome()){ app.recordDangers([['danger',CHARGE]]); say('Geste refusé : '+CHARGE+'.','danger'); return false; } return true; }
const stopAll=()=>{ for(const h of HEADS) st.run[h]=false; };

/* ---------- commandes de la machine ---------- */
$('main').onclick=()=>{ if(st.main){ st.main=false; stopAll(); st.armed=false; apply(); return; }
  if(st.cad) return say('Machine consignée : retirez le cadenas (« Consignée ») avant de remettre sous tension.'); st.main=true; info('Machine sous tension : réarmez (bouton bleu) avant de démarrer les outils.'); };
$('cad').onclick=()=>{ if(st.cad){ st.cad=false; F.msg=''; apply(); return; }
  if(st.main) return say('Pour consigner : interrupteur général sur 0 d\'abord, puis le cadenas.');
  if(spinning()) return say('Attendez l\'arrêt complet des outils.'); st.cad=true; info('Machine consignée : interrupteur général sur 0, cadenassé. Capot ouvert, vous pouvez déposer les carters, bloquer l\'arbre et changer l\'outil.'); };
$('au').onclick=()=>{ if(st.au){ st.au=false; info('Coup de poing déverrouillé : réarmez (bouton bleu) avant de redémarrer.'); return; } st.au=true; stopAll(); st.armed=false; info('Arrêt d\'urgence : tous les outils sont coupés et freinés.'); };
$('filin').onclick=()=>{ if(st.filin){ st.filin=false; info('Bouton bleu du boîtier tiré : le filin est réarmé (partie verte visible). Réarmez la machine au pupitre.'); return; }
  st.filin=true; stopAll(); st.armed=false; info('Filin tiré : le boîtier sectionneur a coupé la machine (bouton bleu enfoncé).'); };
$('rearm').onclick=()=>{ if(!st.main||st.cad) return say('Machine hors tension ou consignée.'); if(st.au) return say('Arrêt d\'urgence enfoncé : déverrouillez-le d\'abord.');
  if(st.filin) return say('Filin de sécurité déclenché : tirez d\'abord le bouton bleu du boîtier sectionneur.');
  if(st.sel||st.capot) return say('Capot ouvert ou sélecteur « Ouverture capot » sur 1 : fermez le capot, sélecteur sur 0, puis réarmez.');
  st.armed=true; F.msg=''; apply(); };
$('asp').onclick=()=>{ st.asp=!st.asp; apply(); };
$('stop').onclick=()=>{ if(cut.inProgress) return say('Chariot en mouvement : finissez la passe avant d\'arrêter (ou arrêt d\'urgence en cas de problème).'); stopAll(); apply(); };
document.querySelectorAll('[data-run]').forEach(b=>b.onclick=()=>{ const h=b.dataset.run; if(st.run[h]){ if(cut.inProgress) return say('Chariot en mouvement : finissez la passe.'); st.run[h]=false; apply(); return; }
  if(!st.main||st.cad) return say('Machine hors tension ou consignée : retirez le cadenas, interrupteur général sur I.');
  if(st.au) return say('Arrêt d\'urgence enfoncé : déverrouillez-le et réarmez.');
  if(st.filin) return say('Filin de sécurité déclenché : tirez le bouton bleu du boîtier, puis réarmez.');
  if(st.sel||st.capot) return say('Capot ouvert ou sélecteur « Ouverture capot » sur 1 : la machine ne démarre pas (interverrouillage).');
  if(!st.armed) return say('Machine non réarmée : appuyez sur « Réarmement » (bouton bleu).');
  if(!tool(h)) return say(`Aucun outil sur ${HEAD_NAME[h]==='scie d\'affranchissement'?'la scie':'l\'arbre ('+HEAD_NAME[h]+')'}.`);
  if(st.locks[h]) return say(`Arbre bloqué (${HEAD_NAME[h]}) : débloquez-le avant de démarrer.`);
  st.run[h]=true; F.msg=''; apply(); });
$('sel').onclick=()=>{ if(st.sel){ if(st.capot) return say('Refermez d\'abord le capot, puis remettez le sélecteur sur 0.'); st.sel=0; info('Sélecteur sur 0 : capot verrouillé. Réarmez (bouton bleu) avant de démarrer.'); return; }
  if(cut.inProgress) return say('Chariot en mouvement : attendez la fin de la passe.');
  st.sel=1; stopAll(); st.armed=false; info('Ouverture du capot demandée : les outils s\'arrêtent. Temporisation : le capot se déverrouille à l\'arrêt complet des outils (voyant allumé).'); };
$('capot').onclick=()=>{ if(st.capot){ st.capot=false; info('Capot refermé. Sélecteur « Ouverture capot » sur 0, puis réarmez.'); return; }
  if(!st.sel) return say('Capot verrouillé : tournez d\'abord le sélecteur « Ouverture capot » sur 1.');
  if(spinning()) return say('Temporisation : le capot reste verrouillé jusqu\'à l\'arrêt complet des outils.');
  st.capot=true; F.msg=''; apply(); };
$('carters').onclick=()=>{ if(!st.capot) return say('Les carters sont sous le capot : ouvrez-le d\'abord.');
  if(anyRun()||spinning()){ app.recordDangers([['danger',INTERV]]); return say('Geste refusé : '+INTERV+'.','danger'); }
  if(!st.cad) return say('Consignez la machine (interrupteur général sur 0, cadenas) avant de déposer ou de remonter les carters.');
  st.carters=!st.carters; info(st.carters? 'Carters remontés autour de la scie, des dérouleurs et de l\'unité de toupillage.' : 'Carters déposés : bloquez l\'arbre, changez l\'outil, puis remontez les carters.'); };
document.querySelectorAll('[data-head]').forEach(b=>b.onclick=()=>{ st.head=b.dataset.head; renderLib(); apply(); });
$('lock').onclick=()=>{ if(!st.capot) return say('Le blocage de l\'arbre se fait capot ouvert.'); if(anyRun()||spinning()) return say('Attendez l\'arrêt complet des outils.'); st.locks[st.head]=!st.locks[st.head]; F.msg=''; apply(); };
function mountTool(id){ if(id===st.tools[st.head]&&!st.flips[st.head]) return; if(!toolGuard('changer l\'outil')) return; const t=toolById(id); st.tools[st.head]=id; st.flips[st.head]=false;
  info(`${t.name} monté sur ${HEAD_NAME[st.head]}. Marquage : ${marking(t)} ; l'arbre tourne à ${N_HEAD[st.head].toLocaleString('fr-FR')} tr/min, sens ${st.head==='inf'?'↻':'↺'}. Serrez, débloquez l'arbre, remontez les carters.`); }
$('flipT').onclick=()=>{ if(!tool(st.head)) return say('Aucun outil sur cet arbre.'); if(!toolGuard('retourner l\'outil')) return; st.flips[st.head]=!st.flips[st.head];
  info(st.flips[st.head]? 'Outil retourné sur son arbre : ses tranchants tournent maintenant dans l\'autre sens.' : 'Outil remis à l\'endroit.'); };
$('unmount').onclick=()=>{ if(!tool(st.head)) return; if(!toolGuard('démonter l\'outil')) return; st.tools[st.head]=null; st.flips[st.head]=false; info('Outil démonté et rangé.'); };
/* réglages numériques (curseur + champ) : refusés outils en marche ; la valeur revient à l'état */
const clamp=(v,[a,b])=>Math.max(a,Math.min(b,v));
function numCtl(id, set, what, capot){ const h=v=>{ if(!setGuard(what,capot)){ apply(); return; } set(+v); F.msg=''; apply(); };
  $(id)?.addEventListener('input',e=>h(e.target.value)); $(id+'-n')?.addEventListener('change',e=>h(e.target.value)); }
const r1=v=>Math.round(v*10)/10;
/* réglage d'un dérouleur ou de l'outil de toupillage : en descendant, le jeu de la vis n'est pas rattrapé */
const upDown=(k,rg)=>v=>{ const n=r1(clamp(v,rg)); if(n<=rg[0]+1e-9) st.bl[k]=false; else if(Math.abs(n-st[k])>1e-9) st.bl[k]= n<st[k]; st[k]=n; };
numCtl('lt', v=>{ st.lt=r1(clamp(v,LT)); }, 'régler la position de la scie', true);
numCtl('hinf', upDown('hInf',HINF), 'régler la hauteur du dérouleur inférieur', false);
numCtl('ep', upDown('ep',EP), 'régler l\'épaisseur du tenon', false);
numCtl('dec', v=>{ st.dec=r1(clamp(v,DEC)); }, 'régler le décalage des arasements', true);
numCtl('ht', upDown('ht',HT), 'régler la hauteur de l\'outil de toupillage', false);
numCtl('pt', v=>{ st.pt=r1(clamp(v,PT)); }, 'régler la profondeur de toupillage', true);
numCtl('ang', v=>{ st.ang=Math.round(clamp(v,ANG)*2)/2; }, 'orienter le guide', false);
$('but-n').addEventListener('change',e=>{ if(!setGuard('régler la butée',false)) return apply(); const v=r1(clamp(+e.target.value,BUT)), q=chariotPiece(), old=st.but; st.but=v;
  if(st.butOn&&q&&q.zEnd>zContact(q)+0.01){ st.but=old; return say('La butée viendrait dans la pièce : relevez la butée, réglez-la, puis abaissez-la.'); } F.msg=''; apply(); });
$('prot-n').addEventListener('change',e=>{ if(!setGuard('régler le protecteur avant',false)) return apply(); st.protH=r1(clamp(+e.target.value,PROT)); F.msg=''; apply(); });
$('butOn').onclick=()=>{ if(!setGuard(st.butOn?'relever la butée':'abaisser la butée',false)) return;
  const q=chariotPiece(); if(!st.butOn && q && q.zEnd>zContact(q)+0.01) return say('La butée tomberait sur la pièce : reculez la pièce (moins de dépassement) ou éloignez la butée.');
  st.butOn=!st.butOn; F.msg=''; apply(); };
$('peNew').onclick=()=>{ if(!setGuard('renouveler le pare-éclat',false)) return; st.pe={on:true,key:null}; peRenew(); info('Pare-éclat renouvelé (bois neuf au ras du trait de scie) : usinez-le par une passe à vide, outils en marche, avant la pièce d\'essai.'); };
$('peOn').onclick=()=>{ if(!setGuard(st.pe.on?'retirer le pare-éclat':'remettre le pare-éclat',false)) return; st.pe={on:!st.pe.on,key:null}; peRenew(); F.msg=''; apply(); };
$('lockC').onclick=()=>{ if(cut.inProgress) return; if(!st.lockC && !atHome()) return say('Le chariot se verrouille seulement en position de chargement : ramenez-le.'); st.lockC=!st.lockC; F.msg=''; apply(); };
document.querySelectorAll('[data-av]').forEach(b=>b.onclick=()=>{ if(cut.inProgress) return; st.av=+b.dataset.av; apply(); });
document.querySelectorAll('[data-mains]').forEach(b=>b.onclick=()=>{ if(cut.inProgress) return; st.mains=b.dataset.mains; apply(); });
$('presse').onclick=()=>{ if(!loadGuard()) return; const q=chariotPiece(); if(!st.presse&&!q) return say('Pas de pièce sous la presse.'); st.presse=!st.presse; F.msg=''; apply(); };
$('pass').onclick=()=>{ if(cut.inProgress) return; const why=startPass(passBlock); if(why) return say(why); F.msg=''; app.ex.invalidate(); apply(); };
$('back').onclick=()=>{ const why=returnChariot(); if(why) return say(why); F.msg=''; apply(); };

/* ---------- manipulations de la pièce ---------- */
function doOp(op){
  if(op==='reset'){ app.ex.setMode(app.ex.mode); return; }
  if(op==='wedge'){ if(!st.wedge) return say('Aucune chute coincée.');
    if(st.run.scie||model.spin.scie>0.02){ app.recordDangers([['danger',INTERV]]); return say('Geste refusé : '+INTERV+'.','danger'); }
    if(!st.capot) return say('La chute est sous le capot : sélecteur sur 1, temporisation, ouvrez le capot.');
    st.wedge=false; return info('Chute retirée. Refermez le capot, sélecteur sur 0, réarmez.'); }
  if(!loadGuard()) return;
  const q=chariotPiece();
  if(!q) return say('Pas de pièce sur le chariot : « Reprendre » une pièce dans « Pièces débitées ».');
  if(st.presse) return say('Desserrez d\'abord la presse.');
  if(op==='aside'){ const why=aside(); if(why) return say(why); F.msg=''; debitKey=''; app.ex.invalidate(); apply(); return; }
  if(op==='butee'){ if(!st.butOn) return say('Butée relevée : abaissez-la d\'abord (outils arrêtés).'); q.zEnd=zContact(q); F.msg=''; apply(); return; }
  orient(q,op); F.msg=''; app.ex.invalidate(); apply(); }
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>doOp(b.dataset.op));
$('over-n').addEventListener('change',e=>{ const q=chariotPiece(); if(!q) return apply(); if(!loadGuard()) return apply(); if(st.presse){ say('Desserrez d\'abord la presse.'); return apply(); }
  setZ(q,-st.lt-Math.max(-50,Math.min(200,+e.target.value))); F.msg=''; apply(); });
$('resetPres').onclick=()=>{ if(cut.inProgress) return say('Chariot en mouvement : attendez la fin de la passe.'); app.ex.setMode(app.ex.mode); info('Pièce de départ remise sur le chariot, machine arrêtée.'); };

/* ---------- démarrage ---------- */
let lastSeq=0;
app.start({
  update, alerts:()=>{ if(cut.msgSeq!==lastSeq){ lastSeq=cut.msgSeq; F.msg=cut.lastMsg; F.level=/(Éclats|envers|interrompue|incomplète|coincée)/.test(cut.lastMsg)?'warn':'info'; }
    const a=computeAlerts(); if(st.bl.hInf||st.bl.ep||st.bl.ht) a.push(['warn',`Réglage fait en descendant : le jeu de la vis n'est pas rattrapé, l'outil reste environ ${fmt(BL)} mm plus haut que le compteur. Réglez toujours les dérouleurs en montant : descendez sous la cote, puis remontez.`]); return a; },
  steps:STEPS,
  loadMode(m){ LOADERS[m](); model.stopNow(); lastSeq=cut.msgSeq; profKey=debitKey=svgKey=''; F.msg=''; renderLib(); if(m!=='libre') stage.setView('vop'); },
  renderExtra,
  panelKey:()=>[cut.inProgress,cut.phase,pieces.map(q=>q.state+q.kind).join(),HEADS.map(h=>st.run[h]).join(),st.cad,st.capot,st.sel,model.anySpin(),HEADS.map(h=>model.spin[h]>0.9).join()],
  onPanel(){ document.querySelectorAll('#tools button').forEach(b=>b.disabled=cut.inProgress && b.dataset.op!=='reset'); },
  onPick(hit){ const q=hit && pieces.find(x=>x.id===hit.object.userData.pieceId); if(!q) return false; const fc=C.faces(q);
    $('info').innerHTML=`<b>${q.name} · ${dims(q)} mm</b><span>Sur le chariot : ${FACE_NAME[fc.down].toLowerCase()}${fc.down===sr1(q)?' (SR1)':''} · contre le guide : ${FACE_NAME[fc.back].toLowerCase()}${fc.back===sr2(q)?' (SR2)':''} · bout ${endName(q)} vers les outils</span>`; return true; },
  tick(dt,now){ const moved=tickPass(now, ()=>cut.res.cuts.every(c=>st.run[c.h]) && (!cut.res.chute||st.run.scie));
    if(model.tick(dt)||moved||cut.msgSeq!==lastSeq) apply(); },
  parcours:{ scenarios:SCENS, criteria:scenCriteria, ignore:['piece'] },
});
/* poignée pour les tests et pour la future page « atelier » : importPiece(pieceJSON d'une autre machine) pose la pièce sur le chariot */
window.__tenon={ st, pieces, cut, C, model, endInfo, betweenShoulders, predict, atHome,
  importPiece(json,name='Pièce'){ if(chariotPiece()) aside(); const q=newPiece({json,name}); apply(); return q.id; } };
