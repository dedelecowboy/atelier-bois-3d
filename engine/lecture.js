/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Confort de lecture (demandé par l'enseignant le 30/10/2026 : accessibilité, priorité « lecture / dys », pour les besoins réels
   des élèves, PAP / PPS). Bouton « Aa » de l'en-tête → panneau :
     - Police lisible : police sans empattement non condensée (Verdana, Tahoma…, installées sur les postes : RIEN à télécharger,
       marche hors ligne), pas de majuscules espacées ni d'italique, texte aéré (interligne 1,6, lettres et mots espacés) ;
     - Taille du texte : normale, grande (×1,15), très grande (×1,3) ; les colonnes s'élargissent d'autant sur ordinateur ;
     - Lecture à voix haute (synthèse vocale du navigateur, voix française de l'ordinateur ou du téléphone) : bouton 🔈 de l'en-tête
       = lire la consigne en cours (question du repérage, carte du parcours, consigne de l'étape, fiche ouverte) ; un clic sur un
       texte des panneaux le lit ; Échap ou un nouveau clic sur 🔈 arrête. Vitesse normale ou lente.
   Choix gardés dans le navigateur (localStorage `atelier.lecture`, dans un try/catch) : ils suivent l'élève d'une machine à l'autre
   sur le même poste. Rien n'est noté ni envoyé à Moodle. */
const STORE = 'atelier.lecture';
export const TAILLES = [1, 1.15, 1.3];
const DEF = { police:false, taille:0, voix:false, lent:false };

export function lirePrefs(){ try{ const s=JSON.parse(localStorage.getItem(STORE)||'null'); if(s&&typeof s==='object') return { ...DEF, police:!!s.police, taille:Math.max(0,Math.min(2,s.taille|0)), voix:!!s.voix, lent:!!s.lent }; }catch(e){} return { ...DEF }; }
export function appliquer(p, root=document.documentElement){
  root.dataset.lectPolice = p.police? '1' : '';
  root.dataset.lectTaille = String(p.taille||0);
  root.style.setProperty('--lz', String(TAILLES[p.taille||0]));
  root.dataset.lectVoix = p.voix? '1' : ''; }

/* texte écrit pour être lu, transformé pour être bien prononcé (unités, symboles) */
export function prononcer(t){
  return String(t||'')
    .replace(/[🔈🔊🔇🔒⛶✓✗✔✘●○◉▶◀↺↻→←↑↓⟶·•]/gu,' ')
    .replace(/(\d)\s*×\s*(\d)/g,'$1 par $2').replace(/×/g,' ')
    .replace(/Ø\s*/g,'diamètre ').replace(/±/g,' plus ou moins ').replace(/≥/g,' supérieur ou égal à ').replace(/≤/g,' inférieur ou égal à ')
    .replace(/(\d)\s*°/g,'$1 degrés').replace(/°/g,' degrés')
    .replace(/dB\(A\)/g,'décibels A').replace(/tr\/min/g,'tours par minute').replace(/m\/min/g,'mètres par minute').replace(/m\/s\b/g,'mètres par seconde')
    .replace(/(\d)\s*mm\b/g,'$1 millimètres').replace(/(\d)\s*kW\b/g,'$1 kilowatts').replace(/(\d)\s*%/g,'$1 pour cent')
    .replace(/\bSR1\b/g,'S R 1').replace(/\bSR2\b/g,'S R 2').replace(/\bEPI\b/g,'E P I').replace(/\bQCM\b/g,'Q C M')
    .replace(/\s+/g,' ').trim(); }

export function createLecture(opts={}){
  const $ = id=>document.getElementById(id);
  let P = lirePrefs(); appliquer(P);
  const save=()=>{ try{ localStorage.setItem(STORE, JSON.stringify(P)); }catch(e){} };
  const synth = typeof window!=='undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null;
  const L = { get prefs(){ return { ...P }; }, voixDispo:!!synth, parle:false, dernier:'' };

  /* ---------- en-tête : « Aa » (panneau) et 🔈 (lire la consigne) ---------- */
  const views = document.querySelector(opts.slot||'.top .views') || document.querySelector('.top');
  const wrap = document.createElement('div'); wrap.className='lect'; wrap.id='lect';
  wrap.innerHTML = `<button type="button" class="toggle lect-btn" id="lectBtn" aria-expanded="false" aria-controls="lectPanel" title="Confort de lecture : police, taille du texte, lecture à voix haute">Aa</button>
    <button type="button" class="toggle lect-lire" id="lectLire" hidden title="Lire la consigne à voix haute (Échap pour arrêter)" aria-label="Lire la consigne à voix haute">🔈 Lire</button>
    <div class="lect-panel" id="lectPanel" role="dialog" aria-label="Confort de lecture" hidden>
      <p class="lect-t">Confort de lecture</p>
      <button type="button" class="toggle" id="lectPolice" aria-pressed="false">Police lisible et texte aéré</button>
      <div class="lect-row" role="group" aria-label="Taille du texte"><span>Taille du texte</span>
        <button type="button" class="toggle" data-taille="0" aria-label="Texte normal">A</button><button type="button" class="toggle" data-taille="1" aria-label="Texte grand">A+</button><button type="button" class="toggle" data-taille="2" aria-label="Texte très grand">A++</button></div>
      <button type="button" class="toggle" id="lectVoix" aria-pressed="false"${synth?'':' disabled'}>🔈 Lecture à voix haute</button>
      <button type="button" class="toggle" id="lectLent" aria-pressed="false"${synth?'':' disabled'}>Voix lente</button>
      <p class="lect-d" id="lectD">${synth? 'Avec la lecture à voix haute : le bouton « 🔈 Lire » lit la consigne, un clic sur un texte le lit, Échap arrête.' : 'Lecture à voix haute indisponible dans ce navigateur.'}</p>
      <button type="button" class="toggle" id="lectFin">Fermer</button>
    </div>`;
  if(views) views.prepend(wrap);
  const panel=$('lectPanel'), btn=$('lectBtn');
  function paint(){
    $('lectPolice').setAttribute('aria-pressed',String(P.police));
    document.querySelectorAll('#lectPanel [data-taille]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.taille===P.taille)));
    $('lectVoix').setAttribute('aria-pressed',String(P.voix)); $('lectLent').setAttribute('aria-pressed',String(P.lent)); $('lectLent').hidden=!P.voix;
    $('lectLire').hidden=!(P.voix&&synth);
    btn.classList.toggle('on', P.police||P.taille>0||P.voix); }
  function set(k,v){ P[k]=v; appliquer(P); save(); paint(); if(k==='voix'&&!v) stop(); opts.onChange?.(P); window.dispatchEvent(new Event('resize')); }
  const open=o=>{ panel.hidden=!o; btn.setAttribute('aria-expanded',String(o)); if(o) $('lectPolice').focus(); };
  btn.onclick=()=>open(panel.hidden);
  $('lectFin').onclick=()=>{ open(false); btn.focus(); };
  $('lectPolice').onclick=()=>set('police',!P.police);
  document.querySelectorAll('#lectPanel [data-taille]').forEach(b=>b.onclick=()=>set('taille',+b.dataset.taille));
  $('lectVoix').onclick=()=>{ set('voix',!P.voix); if(P.voix) dire('Lecture à voix haute activée.'); };
  $('lectLent').onclick=()=>set('lent',!P.lent);
  document.addEventListener('pointerdown',e=>{ if(!panel.hidden && !wrap.contains(e.target)) open(false); },true);

  /* ---------- voix ---------- */
  let voixFr=null, actif=null;
  const choisir=()=>{ if(!synth) return; const V=synth.getVoices()||[]; voixFr=V.find(v=>/^fr(-|_)FR/i.test(v.lang)&&v.localService)||V.find(v=>/^fr(-|_)FR/i.test(v.lang))||V.find(v=>/^fr/i.test(v.lang))||null; };
  if(synth){ choisir(); try{ synth.addEventListener?.('voiceschanged',choisir); }catch(e){} }
  function marquer(el){ if(actif) actif.classList.remove('lect-actif'); actif=el||null; if(actif) actif.classList.add('lect-actif'); }
  function stop(){ if(synth) try{ synth.cancel(); }catch(e){} L.parle=false; marquer(null); $('lectLire').setAttribute('aria-pressed','false'); }
  function dire(texte, el){ const t=prononcer(texte); if(!t) return false; L.dernier=t; if(!synth) return false; stop();
    const u=new SpeechSynthesisUtterance(t); u.lang='fr-FR'; if(voixFr) u.voice=voixFr; u.rate=P.lent? 0.72 : 0.92;
    u.onend=u.onerror=()=>{ if(L.parle){ L.parle=false; marquer(null); $('lectLire').setAttribute('aria-pressed','false'); } };
    L.parle=true; marquer(el); $('lectLire').setAttribute('aria-pressed','true'); try{ synth.speak(u); }catch(e){ L.parle=false; marquer(null); return false; } return true; }
  L.dire=dire; L.stop=stop;

  /* texte d'un bloc sans le texte de ses boutons (fermer ×, Valider…) */
  const texte=el=>{ let t=el.innerText||''; el.querySelectorAll?.('button,select,[role=button]').forEach(b=>{ const bt=(b.innerText||'').trim(); if(bt) t=t.replace(bt,' '); }); return t; };
  L.texte=texte;
  /* la consigne en cours : ce que l'élève a sous les yeux, du plus précis au plus général */
  const vis=el=>!!el && !el.hidden && el.offsetParent!==null && (el.innerText||'').trim().length>0;
  function consigne(){
    const rep=$('repBar'); if(vis(rep)) return { el:$('repQ'), t:$('repQ').innerText };
    const ch=$('choice'); if(vis(ch)) return { el:ch.querySelector('.choice-card'), t:texte(ch) };
    const pc=$('parcCard'); if(vis(pc)&&vis($('parcoursPanel'))) return { el:pc, t:texte(pc) };
    const fo=document.querySelector('#fichesBox .open, #fichesBox [open], #fiches .open, #fiches [open]'); if(fo&&vis(fo)) return { el:fo, t:texte(fo) };
    const sc=$('stepCard'); if(vis(sc)&&vis($('exPanel'))) return { el:sc, t:[$('stepK'),$('stepN'),$('stepT'),$('stepC')].map(e=>e?.innerText||'').join('. ') };
    const ex=opts.consigne?.(); if(ex) return ex;
    const inf=$('info'); if(vis(inf)) return { el:inf, t:inf.innerText };
    return null; }
  L.consigne=consigne;
  $('lectLire').onclick=()=>{ if(L.parle){ stop(); return; } const c=consigne(); if(c) dire(c.t, c.el); };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(L.parle) stop(); if(!panel.hidden){ open(false); btn.focus(); } } });

  /* clic sur un texte des panneaux (pas sur une commande) : il est lu */
  const ZONES = opts.zones || '.left,.right,.dock,.repbar,.choice-card,.toast,.chip,.fiches-box,#fiches,.sono,.schema,.panel,.card,.fiche';
  const BLOCS = 'p,li,h1,h2,h3,h4,td,th,dt,dd,blockquote,figcaption,label,summary,legend,.chip,.toast';
  document.addEventListener('click',e=>{ if(!P.voix||!synth) return; const t=e.target;
    if(!t.closest || t.closest('button,a,input,select,textarea,canvas,[role=button],[role=tab],.lect,[contenteditable]')) return;
    if(!t.closest(ZONES)) return;
    const b=t.closest(BLOCS); if(!b) return; const txt=texte(b).trim(); if(!txt) return;
    if(L.parle&&actif===b){ stop(); return; } dire(txt, b); });

  paint();
  return L;
}
