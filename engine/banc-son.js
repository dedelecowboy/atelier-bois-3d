/* Banc d'écoute du bruit (pour l'enseignant, 29/10/2026) → dist/Ecoute_bruit.html (npm run build banc) :
   écouter au casque le moteur, l'aspiration et la coupe de la toupie (son « rugissement », choisi par l'enseignant le 29/10/2026),
   avec les mêmes calculs de niveau que le simulateur (engine/audio.js). Une page seule, sans three.js, qui marche hors ligne.
   Éditeur (demandé par l'enseignant le 29/10/2026) : curseurs des sons (SONS, synth.js) et des niveaux, réglés à l'écoute ;
   « Copier les réglages » donne un texte à coller dans la discussion, reporté dans synth.js (SONS), toupie/constants.js (BRUIT) et audio.js (ASP).
   Réglages en cours gardés dans le navigateur (localStorage atelier.son.reglages). */
import { createSynth, SONS } from './synth.js';
import { niveau, oreille, ASP, ATT, zone } from './audio.js';
import { BRUIT, BRUIT_DURETE, FEED } from '../machines/toupie/constants.js';

const $=id=>document.getElementById(id);
const PASSES=[
  { k:'leger',  t:'Sapin, passe de 1 mm',                     depth:1,  feed:FEED, wood:'sapin' },
  { k:'quart',  t:'Sapin, quart de rond R 10 (10 mm)',        depth:10, feed:FEED, wood:'sapin' },
  { k:'chene',  t:'Chêne, passe de 5 mm',                     depth:5,  feed:FEED, wood:'chene' },
  { k:'fort',   t:'Chêne, 10 mm, entraîneur à 16 m/min',     depth:10, feed:16,   wood:'chene' },
];
const charge=p=>Math.max(0.15,p.depth/3)*(p.feed/6)*(BRUIT_DURETE[p.wood]||1.3);
const NIV0={ vide:BRUIT.vide, coupe:BRUIT.coupe, aspiration:ASP };
const KEY='atelier.son.reglages', clone=o=>JSON.parse(JSON.stringify(o));
let REG={ sons:clone(SONS), niveaux:{...NIV0} };
try{ const r=JSON.parse(localStorage.getItem(KEY)||'null'); if(r&&r.sons&&r.niveaux){ for(const g of ['aspiration','coupe']) Object.assign(REG.sons[g], r.sons[g]||{}); Object.assign(REG.niveaux, r.niveaux); } }catch(e){}
const saveReg=()=>{ try{ localStorage.setItem(KEY, JSON.stringify(REG)); }catch(e){} };
/* curseurs de l'éditeur : [groupe, clé, libellé, min, max, pas, affichage] */
const pct=v=>`${Math.round(v*100)} %`, x=v=>`× ${v.toFixed(2).replace('.',',')}`, db=v=>`${v} dB(A)`;
const CURS={
  aspiration:[['sons.aspiration','ronron','Ronron grave (rotation du ventilateur)',0,1.2,0.01,x],['sons.aspiration','pales','Bruit des pales',0,1,0.01,x],
    ['sons.aspiration','souffle','Souffle d\'air',0,0.8,0.01,x],['sons.aspiration','electrique','Ronflement électrique',0,0.4,0.01,x],
    ['sons.aspiration','vitesse','Vitesse du ventilateur (ronron plus grave ou plus aigu)',1500,3600,50,v=>`${v} tr/min`],['niveaux','aspiration','Niveau au poste (sonomètre)',60,85,1,db]],
  coupe:[['sons.coupe','sifflement','Sifflement de l\'outil',0,2,0.05,x],['sons.coupe','copeaux','Copeaux (souffle aigu)',0,1.5,0.05,x],
    ['sons.coupe','grave','Corps grave (pièce, table)',0,1,0.05,x],['sons.coupe','peine','Le moteur peine (baisse du régime)',0,0.12,0.005,pct],
    ['sons.coupe','irregularite','Irrégularité (fil, nœuds)',0,0.5,0.01,x],['niveaux','coupe','Niveau de la passe de référence (sonomètre)',85,105,1,db]],
  moteur:[['niveaux','vide','Niveau à vide à 9 000 tr/min (sonomètre)',75,95,1,db]],
};
const getR=(g,k)=>g==='niveaux'? REG.niveaux[k] : REG.sons[g.split('.')[1]][k];
const setR=(g,k,v)=>{ if(g==='niveaux') REG.niveaux[k]=v; else REG.sons[g.split('.')[1]][k]=v; };
const S={ son:false, vol:60, casque:false, motor:false, rpm:9000, spin:0, asp:false, aspSp:0, passe:null, cut:0, t0:0 };
const SY=createSynth(REG.sons);

document.body.innerHTML=`<main class="banc">
  <h1>Écoute du bruit · toupie</h1>
  <p class="sub">Mettez votre casque d'écoute : moteur, aspiration, passes de sapin à chêne, casque antibruit, bruits courts.</p>
  <section><button id="son" class="big">🔇 Activer le son</button> <label>Volume <input id="vol" type="range" min="0" max="100" step="5" value="60"></label>
    <button id="casque" aria-pressed="false">🎧 Casque antibruit</button></section>
  <section><h2>Machine</h2>
    <button id="motor" aria-pressed="false">I · Moteur</button> <span id="rpms"></span>
    <button id="asp" aria-pressed="false">Aspiration</button></section>
  <section><h2>Passer une pièce (4 s dans le bois)</h2><div id="passes"></div></section>
  <section><h2>Bruits courts</h2><button data-bang="attaque">Outil qui mord</button> <button data-bang="au">Arrêt d'urgence</button> <button data-bang="choc">Choc outil / lamelles</button> <button data-bang="coup">Pièce qui bute</button></section>
  <section><h2>Coupe en continu</h2><label><input type="checkbox" id="sansfin"> Pièce sans fin : la passe choisie dure tant que la case est cochée (pour régler la coupe)</label></section>
  <section class="edit"><h2>Éditeur des sons</h2>
    <p class="sub">Réglez à l'oreille pendant l'écoute. Quand c'est bon, « Copier les réglages » et collez le texte dans la discussion avec Claude.</p>
    <h3>Aspiration (toutes les machines)</h3><div id="ed-aspiration"></div>
    <h3>Coupe de la toupie (« rugissement »)</h3><div id="ed-coupe"></div>
    <h3>Moteur à vide (son validé : seulement le niveau)</h3><div id="ed-moteur"></div>
    <div class="ed-act"><button id="reset">Revenir aux réglages actuels</button><button id="copy" class="main">Copier les réglages</button><span id="copied"></span></div>
    <textarea id="regTxt" readonly rows="6" hidden></textarea></section>
  <section class="meter"><div><span>Sonomètre</span><b id="lv">45</b> dB(A)</div><div><span>À l'oreille</span><b id="ear">45</b> dB(A)</div><p id="det"></p></section>
</main>`;
const st=document.createElement('style'); st.textContent=`
:root{--bg:#f6f7f8;--fg:#1b2228;--muted:#5d6872;--line:#cdd3d8;--accent:#c76a14;--ok:#2f7d4f;--warn:#c98a0c;--danger:#c4261c;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#1a1f23;--fg:#e4e8eb;--muted:#9aa5ae;--line:#323a41;--accent:#e8892f;--ok:#5cbf86;--warn:#e3a72f;--danger:#ef5a4c}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 system-ui,sans-serif}
.banc{max-width:760px;margin:0 auto;padding:16px}
h1{font-size:24px;margin:4px 0}h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 6px}
.sub{color:var(--muted);margin:0 0 12px}
section{border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:10px 0}
button{font:600 14px system-ui;border:1px solid var(--line);background:transparent;color:var(--fg);padding:8px 11px;border-radius:6px;cursor:pointer;margin:2px}
button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
button.big{font-size:16px}
.edit h3{font-size:15px;margin:12px 0 4px}
.cur{display:grid;grid-template-columns:minmax(0,1fr) 170px 86px;gap:8px;align-items:center;margin:4px 0;font-size:14px}
.cur input{width:100%}.cur output{font-variant-numeric:tabular-nums;text-align:right;color:var(--muted)}
.cur.chg output{color:var(--accent);font-weight:600}
.ed-act{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:10px}
button.main{background:var(--accent);border-color:var(--accent);color:#fff}
#copied{color:var(--ok);font-size:13px}
textarea{width:100%;box-sizing:border-box;margin-top:8px;font:12px ui-monospace,monospace;background:transparent;color:var(--fg);border:1px solid var(--line);border-radius:6px}
@media (max-width:560px){.cur{grid-template-columns:1fr 80px}.cur span{grid-column:1/-1}}
.meter{display:flex;gap:24px;flex-wrap:wrap;align-items:baseline;position:sticky;bottom:8px;background:var(--bg);box-shadow:0 4px 16px rgb(0 0 0 / .15)}.meter span{color:var(--muted);margin-right:6px}.meter b{font-size:30px}
.meter p{flex-basis:100%;margin:0;color:var(--muted);font-size:13px}
[data-z="vert"]{color:var(--ok)}[data-z="orange"]{color:var(--warn)}[data-z="rouge"]{color:var(--danger)}
input[type=range]{vertical-align:middle;accent-color:var(--accent)}`; document.head.appendChild(st);

$('rpms').innerHTML=[4000,6000,7000,9000].map(n=>`<button data-rpm="${n}" aria-pressed="${n===S.rpm}">${n.toLocaleString('fr-FR')} tr/min</button>`).join('');
$('passes').innerHTML=PASSES.map(p=>`<button data-passe="${p.k}">${p.t}</button>`).join('');

/* éditeur */
const DEF={ sons:clone(SONS), niveaux:{...NIV0} };
function renderEd(){ for(const [sec,list] of Object.entries(CURS)) $('ed-'+sec).innerHTML=list.map(([g,k,t,mi,ma,st])=>
  `<label class="cur" data-g="${g}" data-k="${k}"><span>${t}</span><input type="range" min="${mi}" max="${ma}" step="${st}" value="${getR(g,k)}"><output></output></label>`).join('');
  document.querySelectorAll('.cur').forEach(l=>{ const g=l.dataset.g, k=l.dataset.k, f=Object.values(CURS).flat().find(c=>c[0]===g&&c[1]===k)[6], i=l.querySelector('input'), o=l.querySelector('output');
    const show=()=>{ const v=+i.value; o.textContent=f(v); const d=g==='niveaux'? DEF.niveaux[k] : DEF.sons[g.split('.')[1]][k]; l.classList.toggle('chg', Math.abs(v-d)>1e-9); };
    i.oninput=()=>{ setR(g,k,+i.value); show(); SY.regler(REG.sons); saveReg(); $('copied').textContent=''; }; show(); }); }
function texte(){ const r=v=>Math.round(v*1000)/1000; const o={ sons:{}, niveaux:{} };
  for(const g of ['aspiration','coupe']){ o.sons[g]={}; for(const [k,v] of Object.entries(REG.sons[g])) o.sons[g][k]=r(v); }
  for(const [k,v] of Object.entries(REG.niveaux)) o.niveaux[k]=r(v);
  return 'Réglages des sons (banc d\'écoute) : '+JSON.stringify(o); }
$('reset').onclick=()=>{ REG=clone(DEF); SY.regler(REG.sons); saveReg(); renderEd(); $('copied').textContent='Réglages actuels remis.'; $('regTxt').hidden=true; };
$('copy').onclick=async()=>{ const t=texte(), ta=$('regTxt'); ta.value=t; ta.hidden=false;
  try{ await navigator.clipboard.writeText(t); $('copied').textContent='Copié : collez-le dans la discussion.'; }
  catch(e){ ta.focus(); ta.select(); $('copied').textContent='Sélectionnez le texte ci-dessous et copiez-le (Ctrl + C).'; } };
$('sansfin').onchange=()=>{ if(!$('sansfin').checked&&S.passe) S.t0=performance.now()/1000-4.25; };
renderEd();

function paint(){
  $('son').textContent=S.son?'🔊 Son activé':'🔇 Activer le son'; $('son').setAttribute('aria-pressed',String(S.son));
  $('casque').setAttribute('aria-pressed',String(S.casque)); $('motor').setAttribute('aria-pressed',String(S.motor)); $('motor').textContent=S.motor?'O · Moteur':'I · Moteur';
  $('asp').setAttribute('aria-pressed',String(S.asp));
  document.querySelectorAll('[data-rpm]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.rpm===S.rpm)));
  document.querySelectorAll('[data-passe]').forEach(b=>b.setAttribute('aria-pressed',String(S.passe&&b.dataset.passe===S.passe.k)));
}
$('son').onclick=()=>{ try{ if(!S.son){ SY.start(); SY.ctx.resume?.(); } else SY.mute(); S.son=!S.son; }catch(e){ alert('Son indisponible dans ce navigateur.'); } paint(); };
$('vol').oninput=e=>{ S.vol=+e.target.value; };
$('casque').onclick=()=>{ S.casque=!S.casque; paint(); };
$('motor').onclick=()=>{ S.motor=!S.motor; if(!S.motor) S.passe=null; paint(); };
$('asp').onclick=()=>{ S.asp=!S.asp; paint(); };
document.querySelectorAll('[data-rpm]').forEach(b=>b.onclick=()=>{ if(S.spin>0.03) return alert('Arrêtez le moteur pour changer la vitesse.'); S.rpm=+b.dataset.rpm; paint(); });
document.querySelectorAll('[data-passe]').forEach(b=>b.onclick=()=>{ if(!S.motor||S.spin<0.9) return alert('Démarrez le moteur et attendez qu\'il soit à sa vitesse.');
  S.passe=PASSES.find(p=>p.k===b.dataset.passe); S.t0=performance.now()/1000; paint(); });
document.querySelectorAll('[data-bang]').forEach(b=>b.onclick=()=>SY.bang(b.dataset.bang));

let tPrev=performance.now()/1000, wasCut=false;
function frame(){ requestAnimationFrame(frame);
  const now=performance.now()/1000, dt=Math.min(0.1,now-tPrev); tPrev=now;
  S.spin+=((S.motor?1:0)-S.spin)*Math.min(1,dt*(S.motor?2.5:2.6)); if(!S.motor&&S.spin<0.002) S.spin=0;          // même montée et frein que la toupie
  S.aspSp+=((S.asp?1:0)-S.aspSp)*Math.min(1,dt/(S.asp?1.0:2.5)); if(!S.asp&&S.aspSp<0.003) S.aspSp=0;
  if(S.passe&&$('sansfin').checked&&now-S.t0>2) S.t0=now-1;         // pièce sans fin
  let cut=0; if(S.passe){ const t=now-S.t0; cut= t<0.25? t/0.25 : t<4.25? 1 : t<4.5? (4.5-t)/0.25 : 0; if(t>=4.5){ S.passe=null; paint(); } }
  const ch=S.passe? charge(S.passe) : 1;
  const e={ on:S.motor, rpm:S.rpm, spin:S.spin, cut, charge:ch, dents:2, asp:S.aspSp }, n=niveau({ ...BRUIT, vide:REG.niveaux.vide, coupe:REG.niveaux.coupe, asp:REG.niveaux.aspiration },e);
  const amp=L=>L==null?0:Math.pow(10,(L-100)/20);
  if(cut>0.05&&!wasCut) SY.bang('attaque'); wasCut=cut>0.05;
  if(S.son) SY.set({ f0:S.spin*S.rpm/60, Z:2, spin:S.spin, on:S.motor, mot:amp(n.moteur), cut, cutAmp:amp(n.coupe), charge:ch, asp:S.aspSp, aspAmp:amp(REG.niveaux.aspiration)*0.9, casque:S.casque, vol:S.vol });
  const O=oreille(n.total,S.casque);
  $('lv').textContent=Math.round(n.total); $('lv').dataset.z=zone(n.total); $('ear').textContent=Math.round(O); $('ear').dataset.z=zone(O);
  $('det').textContent=`${S.casque?`casque −${ATT} dB · `:''}${S.passe?`${S.passe.t} · charge ${ch.toFixed(1)}`:S.motor?'à vide':'machine arrêtée'}${S.asp?' · aspiration en marche':''}`;
}
paint(); frame();
window.__banc={ S, SY, mk:createSynth, get REG(){ return REG; }, texte };
