/* Bruit des machines (demandé par l'enseignant le 29/10/2026 ; valeurs proposées, À VALIDER) :
   son synthétisé dans le navigateur (Web Audio, AUCUN fichier : marche hors ligne, dans Moodle et dans le dossier
   d'entraînement), sonomètre dB(A) posé sur la vue 3D, bouton « Casque antibruit », bouton 🔇 / 🔊 de l'en-tête.

   Branché par app.js si la machine fournit le crochet `bruit` dans app.start :
     bruit:{
       niveaux:{ vide, coupe, rpm },   // dB(A) au poste de l'opérateur : à vide au régime rpm, en coupe (passe de référence) au régime rpm
       etat(){ return { on, rpm, spin, cut, charge, dents }; }
         on     : moteur commandé (marche) ;  rpm : régime affiché (tr/min) ;  spin : régime réel / rpm (0 à 1, montée et frein) ;
         cut    : 0 à 1, part de l'outil dans le bois ;  charge : 1 = passe de référence (plus forte, avance rapide, bois dur : > 1) ;
         dents  : nombre de dents de l'outil (fréquence de passage des dents)
     }
   La machine signale les bruits courts par app.bruit.bang('au' | 'choc' | 'coup' | 'rejet').

   Le son n'est JAMAIS nécessaire pour réussir : le sonomètre et l'alerte « attention » montrent la même chose.
   Son coupé par défaut (salle de 30 postes) ; le navigateur n'autorise le son qu'après un clic : l'AudioContext est créé
   au premier clic sur 🔊. Sans AudioContext (navigateur ancien), le sonomètre marche quand même. */

export const SEUILS = { inf:80, sup:85, vle:87 };     // Code du travail R4431-2 : valeurs d'exposition (LEX,8h) déclenchant l'action, VLE
export const FOND = 45;                               // salle calme, machine arrêtée (dB(A))
/* casque antibruit (serre-tête) : SNR d'un casque courant, décote INRS ED 133 (2021) pour le port réel d'un serre-tête : −5 dB */
export const CASQUE = { snr:30, decote:5 };
export const ATT = CASQUE.snr - CASQUE.decote;       // atténuation retenue : 25 dB
const K_RPM = 25;                                     // le bruit aérodynamique de l'outil croît vite avec la vitesse : +25 × log10 du régime
const K_CHARGE = 6;                                   // charge ×10 : +6 dB
const L_MAX = 108;                                    // plafond (pas de valeur absurde)
const STORE = 'atelier.son';

const lg = x=>Math.log10(Math.max(1e-6, x));
const sum = (...L)=>10*lg(L.reduce((s,l)=>s+(l==null? 0 : Math.pow(10,l/10)), 0));

/* niveaux calculés (dB(A)) : moteur seul, coupe, total au poste de l'opérateur (sans casque) */
export function niveau(N, e){
  const v = Math.max(0, e.spin||0) * (e.rpm||0) / (N.rpm||1);          // régime réel / régime de référence
  const Lm = v>0.002? Math.min(L_MAX, N.vide + K_RPM*lg(v)) : null;
  const cut = Math.max(0, Math.min(1, e.cut||0));
  const Lc = v>0.002 && cut>0? Math.min(L_MAX, N.coupe + K_CHARGE*lg(e.charge||1) + 10*lg(v)) : null;
  const total = Math.min(L_MAX, sum(FOND, Lm, Lc==null? null : Lc + 10*lg(cut)));
  return { moteur:Lm, coupe:Lc, total };
}
/* niveau à l'oreille : diminué de l'atténuation du casque (jamais sous 20 dB(A)) */
export const oreille = (L, casque)=> casque? Math.max(20, L-ATT) : L;
/* durée pour recevoir la dose de 8 h à 80 dB(A) (règle des 3 dB, INRS) */
export const dose = L=> 8*60 / Math.pow(2, (L-SEUILS.inf)/3);
export const zone = L=> L>=SEUILS.sup? 'rouge' : L>=SEUILS.inf? 'orange' : 'vert';
const fmtDur = m=> m>=120? `${Math.round(m/60)} h` : m>=60? `1 h ${String(Math.round(m-60)).padStart(2,'0')}` : m>=1? `${Math.round(m)} min` : `${Math.max(1,Math.round(m*60))} s`;

export function createBruit(app, hook){
  const N = hook.niveaux, $ = id=>document.getElementById(id);
  let pref = { on:false, vol:60 };
  try{ const s=JSON.parse(localStorage.getItem(STORE)||'null'); if(s&&typeof s==='object') pref={ on:!!s.on, vol:Math.max(0,Math.min(100,+s.vol||0)) }; }catch(e){}
  const save=()=>{ try{ localStorage.setItem(STORE, JSON.stringify(pref)); }catch(e){} };
  const B = { casque:false, on:false, vol:pref.vol, shown:FOND, ctx:null, err:'' };
  let wantOn = pref.on;      // choix gardé : le son ne démarre qu'au premier clic (règle des navigateurs)

  /* ---------- interface : sonomètre sur la vue 3D, bouton casque, son dans l'en-tête ---------- */
  const stageEl = document.querySelector('.stage');
  const box = document.createElement('div'); box.className='sono'; box.id='sono'; box.setAttribute('role','group'); box.setAttribute('aria-label','Sonomètre');
  box.innerHTML = `<div class="sono-row"><span class="sono-k">Sonomètre</span><b class="sono-v" id="sonoV">${FOND}</b><span class="sono-u">dB(A)</span></div>
    <div class="sono-bar" aria-hidden="true"><i class="z1"></i><i class="z2"></i><i class="z3"></i><em id="sonoM"></em><em class="ear" id="sonoE"></em></div>
    <div class="sono-row ear"><span class="sono-k">À l'oreille</span><b class="sono-o" id="sonoO">${FOND}</b><span class="sono-u" id="sonoOu">sans casque</span></div>
    <button type="button" class="toggle mini sono-c" id="casque" aria-pressed="false" title="Mettre le casque antibruit (atténuation retenue : ${ATT} dB)">🎧 Casque antibruit</button>
    <p class="sono-d" id="sonoD"></p>`;
  stageEl?.appendChild(box);
  const snd = $('snd'); if(snd) snd.hidden=false;
  const sndBtn=$('sndBtn'), sndVol=$('sndVol');
  if(sndVol) sndVol.value=B.vol;

  const pos = L=> `${Math.max(0,Math.min(100,(L-40)/(110-40)*100)).toFixed(1)}%`;   // échelle 40 à 110 dB(A)
  function paint(){
    const L=B.shown, O=oreille(L,B.casque), zL=zone(L), zO=zone(O);
    const v=$('sonoV'), o=$('sonoO');
    if(v){ v.textContent=Math.round(L); v.dataset.z=zL; }
    if(o){ o.textContent=Math.round(O); o.dataset.z=zO; }
    $('sonoOu').textContent= B.casque? `casque −${ATT} dB` : 'sans casque';
    $('sonoM').style.left=pos(L); const e=$('sonoE'); e.style.left=pos(O); e.hidden=!B.casque;
    const d=$('sonoD'); d.dataset.z=zO;
    d.textContent= O>=SEUILS.inf? `À ce niveau, la dose de la journée (8 h à 80 dB(A)) est reçue en ${fmtDur(dose(O))}.` : B.casque&&L>=SEUILS.inf? 'Casque porté : l\'oreille est protégée.' : '';
    box.dataset.z=zO;
    $('casque').setAttribute('aria-pressed',String(B.casque));
    if(sndBtn){ sndBtn.textContent= B.on? '🔊' : '🔇'; sndBtn.setAttribute('aria-pressed',String(B.on));
      sndBtn.title= B.on? 'Couper le son' : 'Activer le son (machines bruyantes : réglez le volume)'; sndBtn.setAttribute('aria-label',sndBtn.title); }
    if(sndVol) sndVol.hidden=!B.on;
  }

  /* ---------- calcul ---------- */
  const etat = ()=>{ try{ return hook.etat()||{}; }catch(e){ return {}; } };
  function calc(){ const e=etat(), n=niveau(N,e), steady=niveau(N,{...e, spin:e.on? 1 : e.spin});
    return { e, ...n, oreille:oreille(n.total,B.casque), marche:!!e.on, enMarche:e.on? steady.total : null }; }
  /* alerte « attention » (pas une faute) : en marche au-dessus de 85 dB(A) sans casque */
  function alerte(){ if(B.casque) return null; const c=calc(); if(!c.marche || c.enMarche<SEUILS.sup) return null;
    return ['warn', `BRUIT : ${Math.round(c.enMarche)} dB(A) au poste, au-dessus de ${SEUILS.sup} dB(A). Portez le casque antibruit (bouton « Casque antibruit » du sonomètre).`, 'machine']; }

  /* ---------- son (Web Audio) ---------- */
  let A=null;   // graphe
  function noiseBuffer(ctx){ const n=ctx.sampleRate*2, b=ctx.createBuffer(1,n,ctx.sampleRate), d=b.getChannelData(0); let p=0;
    for(let i=0;i<n;i++){ const w=Math.random()*2-1; p=0.97*p+0.03*w; d[i]=0.6*w+2.5*p; } return b; }   // bruit blanc + un peu de bruit « brun » (moins strident)
  function build(){
    const C=window.AudioContext||window.webkitAudioContext; if(!C) throw new Error('AudioContext absent');
    const ctx=new C(), nb=noiseBuffer(ctx);
    const src=()=>{ const s=ctx.createBufferSource(); s.buffer=nb; s.loop=true; s.start(); return s; };
    const gain=v=>{ const g=ctx.createGain(); g.gain.value=v; return g; };
    const filt=(type,f,Q=0.7)=>{ const b=ctx.createBiquadFilter(); b.type=type; b.frequency.value=f; b.Q.value=Q; return b; };
    const osc=(type,f)=>{ const o=ctx.createOscillator(); o.type=type; o.frequency.value=f; o.start(); return o; };
    const master=gain(0), muffle=filt('lowpass',16000,0.5), comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-14; comp.ratio.value=4; comp.attack.value=0.01; comp.release.value=0.25;
    master.connect(muffle); muffle.connect(comp); comp.connect(ctx.destination);
    const hush=filt('lowpass',7000,0.5); hush.connect(master);                 // rien de strident : tout passe sous 7 kHz
    /* moteur et outil à vide : rotation (f0), passage des dents (f0 × Z), ronflement électrique, souffle de l'outil */
    const mot=gain(0); mot.connect(hush);
    const o1=osc('sawtooth',100), l1=filt('lowpass',700,0.8), g1=gain(0.22); o1.connect(l1); l1.connect(g1); g1.connect(mot);
    const o2=osc('triangle',200), g2=gain(0.30); o2.connect(g2); g2.connect(mot);
    const o3=osc('sine',100), g3=gain(0); o3.connect(g3); g3.connect(mot);
    const ws=src(), wb=filt('bandpass',800,0.7), wg=gain(0.9); ws.connect(wb); wb.connect(wg); wg.connect(mot);
    /* coupe : bruit filtré (plus aigu quand la charge monte), haché au rythme du passage des dents */
    const cutG=gain(0); cutG.connect(hush);
    const cs=src(), cb=filt('bandpass',1400,1.1), am=gain(0.55), lfo=osc('square',200), lfoG=gain(0.45);
    lfo.connect(lfoG); lfoG.connect(am.gain); cs.connect(cb); cb.connect(am); am.connect(cutG);
    const cs2=src(), cl=filt('lowpass',380,0.7), cg2=gain(0.5); cs2.connect(cl); cl.connect(cg2); cg2.connect(cutG);   // corps grave du bois
    A={ ctx, master, muffle, mot, o1, o2, o3, g3, wb, wg, cutG, cb, lfo, nb };
  }
  const T=(p,v,tc=0.06)=>{ try{ p.setTargetAtTime(v, A.ctx.currentTime, tc); }catch(e){ p.value=v; } };
  const amp = L=> L==null? 0 : Math.pow(10,(L-100)/20);     // niveau → gain relatif (100 dB(A) = 1)
  function audioTick(c){ if(!A||!B.on) return;
    const e=c.e, f0=Math.max(1,(e.spin||0)*(e.rpm||0)/60), Z=e.dents||2, sp=Math.max(0,Math.min(1,e.spin||0));
    T(A.o1.frequency,f0); T(A.o2.frequency,Math.max(1,f0*Z)); T(A.lfo.frequency,Math.max(1,f0*Z));
    T(A.o3.frequency,100); T(A.g3.gain, e.on? 0.08 : 0);
    T(A.wb.frequency, 300+900*sp); T(A.wg.gain, 0.4+0.6*sp*sp);
    T(A.mot.gain, amp(c.moteur)*0.9);
    const ch=Math.max(0.2,Math.min(4,e.charge||1));
    T(A.cb.frequency, Math.min(3600, 1000+700*ch)); T(A.cutG.gain, amp(c.coupe)*Math.max(0,Math.min(1,e.cut||0))*1.1, 0.04);
    /* casque : son étouffé (passe-bas) et plus faible ; à l'écoute, −16 dB seulement pour rester audible (le sonomètre donne −25) */
    T(A.muffle.frequency, B.casque? 650 : 16000, 0.08);
    T(A.master.gain, (B.vol/100)**2 * 0.9 * (B.casque? 0.16 : 1), 0.08);
  }
  /* bruits courts */
  function bang(type){ if(!A||!B.on) return; const ctx=A.ctx, t0=ctx.currentTime, out=ctx.createGain(); out.connect(A.master);
    const env=(g,a,peak,d)=>{ g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(peak,t0+a); g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d); };
    const burst=(f,Q,peak,d,type2='bandpass')=>{ const s=ctx.createBufferSource(); s.buffer=A.nb; const b=ctx.createBiquadFilter(); b.type=type2; b.frequency.value=f; b.Q.value=Q;
      const g=ctx.createGain(); env(g,0.004,peak,d); s.connect(b); b.connect(g); g.connect(out); s.start(t0, Math.random()); s.stop(t0+d+0.1); };
    const ring=(fs,peak,d)=>{ for(const [f,k] of fs){ const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f; const g=ctx.createGain(); env(g,0.003,peak*k,d*(0.6+0.4*k)); o.connect(g); g.connect(out); o.start(t0); o.stop(t0+d+0.1); } };
    if(type==='au'){ burst(900,0.8,0.5,0.06); burst(160,0.7,0.6,0.12,'lowpass'); }                 // coup de poing frappé : « clac »
    else if(type==='choc'){ burst(2200,1.2,0.35,0.05); ring([[870,1],[1390,0.6],[2230,0.35]],0.18,0.7); }   // outil contre l'acier : tintement court
    else if(type==='coup'){ burst(220,0.8,0.7,0.16,'lowpass'); burst(1200,1,0.2,0.05); }             // pièce qui bute : coup sourd
    else if(type==='rejet'){ burst(180,0.7,0.8,0.2,'lowpass'); burst(1800,0.9,0.4,0.35); }          // pièce rejetée : coup + sifflement
  }
  async function setOn(on){
    if(on){ try{ if(!A) build(); if(A.ctx.state==='suspended') await A.ctx.resume(); B.on=true; B.err=''; }
      catch(e){ B.on=false; B.err=String(e&&e.message||e); app.toast('Son indisponible dans ce navigateur : le sonomètre reste affiché.'); } }
    else { B.on=false; if(A){ try{ T(A.master.gain,0,0.03); }catch(e){} } }
    pref.on=on; save(); paint(); }

  let first=null;
  if(sndBtn) sndBtn.onclick=()=>{ if(first){ document.removeEventListener('pointerdown',first,true); first=null; } setOn(!B.on); };
  if(sndVol) sndVol.addEventListener('input',e=>{ B.vol=+e.target.value; pref.vol=B.vol; save(); });
  $('casque').onclick=()=>{ B.casque=!B.casque; paint(); app.apply(); };
  /* son choisi lors d'une visite précédente : il démarre au premier clic dans la page (règle des navigateurs) */
  if(wantOn){ first=ev=>{ if(ev.target&&ev.target.closest&&ev.target.closest('#sndBtn')) return; document.removeEventListener('pointerdown',first,true); first=null; if(!B.on) setOn(true); };
    document.addEventListener('pointerdown',first,true); }

  /* ---------- boucle : lissage du sonomètre (≈ 0,3 s, horloge réelle), son ---------- */
  let tPrev=null, lastR='';
  function tick(){ const now=performance.now()/1000, dt=Math.min(0.5, tPrev==null? 0 : now-tPrev); tPrev=now;
    const c=calc(); B.shown += (c.total-B.shown)*Math.min(1, dt/0.3);
    if(Math.abs(c.total-B.shown)<0.05) B.shown=c.total;
    const r=[Math.round(B.shown),B.casque,B.on].join(); if(r!==lastR){ lastR=r; paint(); }
    audioTick(c); }
  paint();
  return { tick, bang, alerte, calc, setOn, niveau:e=>niveau(N,e), get casque(){ return B.casque; }, set casque(v){ B.casque=!!v; paint(); },
    get on(){ return B.on; }, get shown(){ return B.shown; }, get err(){ return B.err; }, get ctx(){ return A&&A.ctx; }, niveaux:N };
}
