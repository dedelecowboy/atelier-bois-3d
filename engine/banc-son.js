/* Banc d'écoute du bruit (pour l'enseignant, 29/10/2026) → dist/Ecoute_bruit.html (npm run build banc) :
   écouter au casque le moteur, l'aspiration et les trois sons de coupe possibles de la toupie (variantes A, B, C, engine/synth.js),
   avec les mêmes calculs de niveau que le simulateur (engine/audio.js). Une page seule, sans three.js, qui marche hors ligne. */
import { createSynth, VARIANTES, VARIANTE_DEFAUT } from './synth.js';
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
const S={ son:false, vol:60, casque:false, motor:false, rpm:9000, spin:0, asp:false, aspSp:0, variante:VARIANTE_DEFAUT, passe:null, cut:0, t0:0 };
const SY=createSynth();

document.body.innerHTML=`<main class="banc">
  <h1>Écoute du bruit · toupie</h1>
  <p class="sub">Mettez votre casque d'écoute. Comparez les trois sons de coupe et dites-moi lequel est le plus proche de la toupie de l'atelier (A, B ou C), et ce qui ne va pas.</p>
  <section><button id="son" class="big">🔇 Activer le son</button> <label>Volume <input id="vol" type="range" min="0" max="100" step="5" value="60"></label>
    <button id="casque" aria-pressed="false">🎧 Casque antibruit</button></section>
  <section><h2>Machine</h2>
    <button id="motor" aria-pressed="false">I · Moteur</button> <span id="rpms"></span>
    <button id="asp" aria-pressed="false">Aspiration</button></section>
  <section><h2>Son de coupe</h2><div id="vars"></div></section>
  <section><h2>Passer une pièce (4 s dans le bois)</h2><div id="passes"></div></section>
  <section><h2>Bruits courts</h2><button data-bang="attaque">Outil qui mord</button> <button data-bang="au">Arrêt d'urgence</button> <button data-bang="choc">Choc outil / lamelles</button> <button data-bang="coup">Pièce qui bute</button></section>
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
.var{display:flex;gap:8px;align-items:center;margin:3px 0}.var small{color:var(--muted)}
.meter{display:flex;gap:24px;flex-wrap:wrap;align-items:baseline}.meter span{color:var(--muted);margin-right:6px}.meter b{font-size:30px}
.meter p{flex-basis:100%;margin:0;color:var(--muted);font-size:13px}
[data-z="vert"]{color:var(--ok)}[data-z="orange"]{color:var(--warn)}[data-z="rouge"]{color:var(--danger)}
input[type=range]{vertical-align:middle;accent-color:var(--accent)}`; document.head.appendChild(st);

$('rpms').innerHTML=[4000,6000,7000,9000].map(n=>`<button data-rpm="${n}" aria-pressed="${n===S.rpm}">${n.toLocaleString('fr-FR')} tr/min</button>`).join('');
$('vars').innerHTML=Object.entries(VARIANTES).map(([k,t])=>`<div class="var"><button data-var="${k}" aria-pressed="${k===S.variante}">${k}</button><small>${t}</small></div>`).join('');
$('passes').innerHTML=PASSES.map(p=>`<button data-passe="${p.k}">${p.t}</button>`).join('');

function paint(){
  $('son').textContent=S.son?'🔊 Son activé':'🔇 Activer le son'; $('son').setAttribute('aria-pressed',String(S.son));
  $('casque').setAttribute('aria-pressed',String(S.casque)); $('motor').setAttribute('aria-pressed',String(S.motor)); $('motor').textContent=S.motor?'O · Moteur':'I · Moteur';
  $('asp').setAttribute('aria-pressed',String(S.asp));
  document.querySelectorAll('[data-rpm]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.rpm===S.rpm)));
  document.querySelectorAll('[data-var]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.var===S.variante)));
  document.querySelectorAll('[data-passe]').forEach(b=>b.setAttribute('aria-pressed',String(S.passe&&b.dataset.passe===S.passe.k)));
}
$('son').onclick=()=>{ try{ if(!S.son){ SY.start(); SY.ctx.resume?.(); } else SY.mute(); S.son=!S.son; }catch(e){ alert('Son indisponible dans ce navigateur.'); } paint(); };
$('vol').oninput=e=>{ S.vol=+e.target.value; };
$('casque').onclick=()=>{ S.casque=!S.casque; paint(); };
$('motor').onclick=()=>{ S.motor=!S.motor; if(!S.motor) S.passe=null; paint(); };
$('asp').onclick=()=>{ S.asp=!S.asp; paint(); };
document.querySelectorAll('[data-rpm]').forEach(b=>b.onclick=()=>{ if(S.spin>0.03) return alert('Arrêtez le moteur pour changer la vitesse.'); S.rpm=+b.dataset.rpm; paint(); });
document.querySelectorAll('[data-var]').forEach(b=>b.onclick=()=>{ S.variante=b.dataset.var; paint(); });
document.querySelectorAll('[data-passe]').forEach(b=>b.onclick=()=>{ if(!S.motor||S.spin<0.9) return alert('Démarrez le moteur et attendez qu\'il soit à sa vitesse.');
  S.passe=PASSES.find(p=>p.k===b.dataset.passe); S.t0=performance.now()/1000; paint(); });
document.querySelectorAll('[data-bang]').forEach(b=>b.onclick=()=>SY.bang(b.dataset.bang));

let tPrev=performance.now()/1000, wasCut=false;
function frame(){ requestAnimationFrame(frame);
  const now=performance.now()/1000, dt=Math.min(0.1,now-tPrev); tPrev=now;
  S.spin+=((S.motor?1:0)-S.spin)*Math.min(1,dt*(S.motor?2.5:2.6)); if(!S.motor&&S.spin<0.002) S.spin=0;          // même montée et frein que la toupie
  S.aspSp+=((S.asp?1:0)-S.aspSp)*Math.min(1,dt/(S.asp?1.0:2.5)); if(!S.asp&&S.aspSp<0.003) S.aspSp=0;
  let cut=0; if(S.passe){ const t=now-S.t0; cut= t<0.25? t/0.25 : t<4.25? 1 : t<4.5? (4.5-t)/0.25 : 0; if(t>=4.5){ S.passe=null; paint(); } }
  const ch=S.passe? charge(S.passe) : 1;
  const e={ on:S.motor, rpm:S.rpm, spin:S.spin, cut, charge:ch, dents:2, asp:S.aspSp }, n=niveau(BRUIT,e);
  const amp=L=>L==null?0:Math.pow(10,(L-100)/20);
  if(cut>0.05&&!wasCut) SY.bang('attaque'); wasCut=cut>0.05;
  if(S.son) SY.set({ f0:S.spin*S.rpm/60, Z:2, spin:S.spin, on:S.motor, mot:amp(n.moteur), cut, cutAmp:amp(n.coupe), charge:ch, asp:S.aspSp, aspAmp:amp(ASP)*0.9, casque:S.casque, vol:S.vol, variante:S.variante });
  const O=oreille(n.total,S.casque);
  $('lv').textContent=Math.round(n.total); $('lv').dataset.z=zone(n.total); $('ear').textContent=Math.round(O); $('ear').dataset.z=zone(O);
  $('det').textContent=`${S.casque?`casque −${ATT} dB · `:''}${S.passe?`${S.passe.t} · charge ${ch.toFixed(1)}`:S.motor?'à vide':'machine arrêtée'}${S.asp?' · aspiration en marche':''}`;
}
paint(); frame();
window.__banc={ S, SY, mk:createSynth };
