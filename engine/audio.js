/* Bruit des machines (demandé par l'enseignant le 29/10/2026 ; valeurs proposées, À VALIDER) :
   son synthétisé dans le navigateur (Web Audio, AUCUN fichier : marche hors ligne, dans Moodle et dans le dossier
   d'entraînement), sonomètre dB(A) posé sur la vue 3D, bouton « Casque antibruit », bouton 🔇 / 🔊 de l'en-tête.

   Branché par app.js si la machine fournit le crochet `bruit` dans app.start :
     bruit:{
       aspiration(){ return st.asp; }, // aspiration en marche (son commun à toutes les machines qui ont une aspiration)
       niveaux:{ vide, coupe, rpm },   // (facultatif) dB(A) au poste de l'opérateur : à vide au régime rpm, en coupe (passe de référence) ;
                                       //   sans niveaux : pas de sonomètre ni de son de la machine, seulement l'aspiration
       etat(){ return { on, rpm, spin, cut, charge, dents }; }   // (avec niveaux)
       echantillons:{ demarrage, vide, coupe, arret }            // (facultatif) enregistrements MP3 en base64 à la place du son synthétisé
         on     : moteur commandé (marche) ;  rpm : régime affiché (tr/min) ;  spin : régime réel / rpm (0 à 1, montée et frein) ;
         cut    : 0 à 1, part de l'outil dans le bois ;  charge : 1 = passe de référence (plus forte, avance rapide, bois dur : > 1) ;
         dents  : nombre de dents de l'outil (fréquence de passage des dents)
     }
   Machine à plusieurs outils (tenonneuse, 30/10/2026) : à la place de niveaux / etat / echantillons, une liste
     sources:[ { nom, niveaux, etat, echantillons }, … ]   chaque outil son niveau, son état, ses enregistrements (ou le son
     synthétisé : UNE source au plus sans enregistrements) ; le sonomètre fait la somme énergétique de toutes les sources.
   La machine signale les bruits courts par app.bruit.bang('au' | 'choc' | 'coup' | 'rejet').

   Le son n'est JAMAIS nécessaire pour réussir : le sonomètre et l'alerte « attention » montrent la même chose.
   Son coupé par défaut (salle de 30 postes) ; le navigateur n'autorise le son qu'après un clic : l'AudioContext est créé
   au premier clic sur 🔊. Sans AudioContext (navigateur ancien), le sonomètre marche quand même. */

export const SEUILS = { inf:80, sup:85, vle:87 };     // Code du travail R4431-2 : valeurs d'exposition (LEX,8h) déclenchant l'action, VLE
export const FOND = 45;                               // salle calme, machine arrêtée (dB(A))
export const ASP = 78;                                // aspiration seule, au poste (dB(A)) : réglé à l'oreille par l'enseignant le 29/10/2026 (sans mesure)
/* casque antibruit (serre-tête) : SNR d'un casque courant, décote INRS ED 133 (2021) pour le port réel d'un serre-tête : −5 dB */
export const CASQUE = { snr:30, decote:5 };
export const ATT = CASQUE.snr - CASQUE.decote;       // atténuation retenue : 25 dB
const K_RPM = 25;                                     // le bruit aérodynamique de l'outil croît vite avec la vitesse : +25 × log10 du régime
const K_CHARGE = 6;                                   // charge ×10 : +6 dB
const L_MAX = 108;                                    // plafond (pas de valeur absurde)
const STORE = 'atelier.son';
import { createSynth } from './synth.js';
/* aspiration enregistrée (fournie par l'enseignant le 29/10/2026, tools/sons.py aspiration) : commune à toutes les machines */
import sonAsp from './sons/aspiration.mp3';
import sonAspArret from './sons/aspiration-arret.mp3';

const lg = x=>Math.log10(Math.max(1e-6, x));
const sum = (...L)=>10*lg(L.reduce((s,l)=>s+(l==null? 0 : Math.pow(10,l/10)), 0));

/* niveaux calculés (dB(A)) : moteur seul, coupe, total au poste de l'opérateur (sans casque) */
export function niveau(N, e){
  const v = Math.max(0, e.spin||0) * (e.rpm||0) / (N.rpm||1);          // régime réel / régime de référence
  const Lm = v>0.002? Math.min(L_MAX, N.vide + K_RPM*lg(v)) : null;
  const cut = Math.max(0, Math.min(1, e.cut||0));
  const Lc = v>0.002 && cut>0? Math.min(L_MAX, N.coupe + K_CHARGE*lg(e.charge||1) + 10*lg(v)) : null;
  const as = Math.max(0, Math.min(1, e.asp||0));
  const La = as>0.002? (N.asp??ASP) + K_RPM*lg(as) : null;                        // aspiration : ventilateur qui monte en régime ou ralentit
  const total = Math.min(L_MAX, sum(FOND, La, Lm, Lc==null? null : Lc + 10*lg(cut)));
  return { moteur:Lm, coupe:Lc, asp:La, total };
}
/* niveau à l'oreille : diminué de l'atténuation du casque (jamais sous 20 dB(A)) */
export const oreille = (L, casque)=> casque? Math.max(20, L-ATT) : L;
/* durée pour recevoir la dose de 8 h à 80 dB(A) (règle des 3 dB, INRS) */
export const dose = L=> 8*60 / Math.pow(2, (L-SEUILS.inf)/3);
export const zone = L=> L>=SEUILS.sup? 'rouge' : L>=SEUILS.inf? 'orange' : 'vert';
const fmtDur = m=> m>=120? `${Math.round(m/60)} h` : m>=60? `1 h ${String(Math.round(m-60)).padStart(2,'0')}` : m>=1? `${Math.round(m)} min` : `${Math.max(1,Math.round(m*60))} s`;

export function createBruit(app, hook){
  const SRC = hook.sources || (hook.niveaux? [{ nom:'machine', niveaux:hook.niveaux, etat:hook.etat, echantillons:hook.echantillons }] : []);
  const N = SRC.length? SRC[0].niveaux : null, $ = id=>document.getElementById(id);   // sans niveaux : aspiration seule, pas de sonomètre
  const SYN = SRC.findIndex(s=>!s.echantillons);       // la source jouée par le son synthétisé (−1 : toutes enregistrées)
  const N0 = N || { vide:0, coupe:0, rpm:1 };
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
  if(N) stageEl?.appendChild(box);
  const snd = $('snd'); if(snd) snd.hidden=false;
  const sndBtn=$('sndBtn'), sndVol=$('sndVol');
  if(sndVol) sndVol.value=B.vol;

  const pos = L=> `${Math.max(0,Math.min(100,(L-40)/(110-40)*100)).toFixed(1)}%`;   // échelle 40 à 110 dB(A)
  function paint(){
    if(sndBtn){ sndBtn.textContent= B.on? '🔊' : '🔇'; sndBtn.setAttribute('aria-pressed',String(B.on));
      sndBtn.title= B.on? 'Couper le son' : 'Activer le son (machines bruyantes : réglez le volume)'; sndBtn.setAttribute('aria-label',sndBtn.title); }
    if(sndVol) sndVol.hidden=!B.on;
    if(!N) return;
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
  }

  /* ---------- calcul ---------- */
  let aspSp=0;    // régime du ventilateur d'aspiration (0 à 1) : monte en ≈ 1 s, ralentit en ≈ 2,5 s
  const aspOn = ()=>{ try{ return !!hook.aspiration?.(); }catch(e){ return false; } };
  const etats = ()=>SRC.map(s=>{ let e={}; try{ e=s.etat?.()||{}; }catch(err){ e={}; } return e; });
  /* somme des sources (une seule : exactement niveau()) */
  function somme(es, as){
    if(SRC.length<=1) return niveau(N0, { ...(es[0]||{}), asp:as });
    const P=SRC.map((s,i)=>niveau(s.niveaux, { ...es[i], asp:0 })), La=niveau(N0,{ asp:as }).asp;
    const cuts=P.map((n,i)=>n.coupe==null? null : n.coupe + 10*lg(Math.max(0,Math.min(1,es[i].cut||0))));
    const nn=L=>L.filter(v=>v!=null), opt=L=>nn(L).length? sum(...nn(L)) : null;
    return { moteur:opt(P.map(n=>n.moteur)), coupe:opt(cuts), asp:La, total:Math.min(L_MAX, sum(FOND, La, ...P.map(n=>n.moteur), ...cuts)), parts:P }; }
  function calc(){ const es=etats(), n=somme(es, aspSp), on=es.some(e=>e.on);
    const steady=somme(es.map(e=>({ ...e, spin:e.on? 1 : e.spin })), aspOn()? 1 : aspSp);
    return { e:{ ...(es[0]||{}), asp:aspSp }, es, ...n, oreille:oreille(n.total,B.casque), marche:on, enMarche:on? steady.total : null }; }
  /* alerte « attention » (pas une faute) : en marche au-dessus de 85 dB(A) sans casque */
  function alerte(){ if(B.casque||!N) return null; const c=calc(); if(!c.marche || c.enMarche<SEUILS.sup) return null;
    return ['warn', `BRUIT : ${Math.round(c.enMarche)} dB(A) au poste, au-dessus de ${SEUILS.sup} dB(A). Portez le casque antibruit (bouton « Casque antibruit » du sonomètre).`, 'machine']; }

  /* ---------- son (Web Audio, engine/synth.js) ---------- */
  const SY=createSynth(); let A=null, wasCut=false;
  const amp = L=> L==null? 0 : Math.pow(10,(L-100)/20);     // niveau → gain relatif (100 dB(A) = 1)
  /* paramètres du son d'une source : moteur (plein régime et réel), coupe */
  function voix(i, e){ const Ns=SRC[i].niveaux, n=niveau(Ns,{ ...e, asp:0 }), cut=Math.max(0,Math.min(1,e.cut||0));
    return { motFull:amp(niveau(Ns,{...e, spin:1, cut:0, asp:0}).moteur), f0:(e.spin||0)*(e.rpm||0)/60, Z:e.dents||2, spin:e.spin, on:e.on, mot:amp(n.moteur), cut, cutAmp:amp(n.coupe), charge:e.charge }; }
  function audioTick(c){ if(!A||!B.on) return;
    const cutNow=c.es.some(e=>(e.cut||0)>0.05);
    if(cutNow&&!wasCut) SY.bang('attaque'); wasCut=cutNow;   // un outil mord dans le bois
    c.es.forEach((e,i)=>{ if(i!==SYN) SY.setVoix(i, voix(i,e)); });
    SY.set({ ...(SYN>=0? voix(SYN, c.es[SYN]) : { mot:0, cutAmp:0, cut:0, f0:0, spin:0, on:false }),
      asp:aspSp, aspOn:aspOn(), aspAmp:amp(N0.asp??ASP)*0.9, casque:B.casque&&!!N, vol:B.vol }); }
  function bang(type){ if(A&&B.on) SY.bang(type); }
  async function setOn(on){
    if(on){ try{ if(!A){ A=SY.start(); SRC.forEach((s,i)=>{ if(s.echantillons) SY.chargerEchantillons(s.echantillons, i).catch(err=>{ B.err='enregistrements : '+(err&&err.message||err); }); });
        if(hook.aspiration) SY.chargerAspiration({ boucle:sonAsp, arret:sonAspArret }).catch(err=>{ B.err='aspiration : '+(err&&err.message||err); }); } if(A.ctx.state==='suspended') await A.ctx.resume(); B.on=true; B.err=''; }
      catch(e){ B.on=false; B.err=String(e&&e.message||e); app.toast(N? 'Son indisponible dans ce navigateur : le sonomètre reste affiché.' : 'Son indisponible dans ce navigateur.'); } }
    else { B.on=false; SY.mute(); }
    pref.on=on; save(); paint(); }

  let first=null;
  if(sndBtn) sndBtn.onclick=()=>{ if(first){ document.removeEventListener('pointerdown',first,true); first=null; } setOn(!B.on); };
  if(sndVol) sndVol.addEventListener('input',e=>{ B.vol=+e.target.value; pref.vol=B.vol; save(); });
  if(N) $('casque').onclick=()=>{ B.casque=!B.casque; paint(); app.apply(); };
  /* son choisi lors d'une visite précédente : il démarre au premier clic dans la page (règle des navigateurs) */
  if(wantOn){ first=ev=>{ if(ev.target&&ev.target.closest&&ev.target.closest('#sndBtn')) return; document.removeEventListener('pointerdown',first,true); first=null; if(!B.on) setOn(true); };
    document.addEventListener('pointerdown',first,true); }

  /* ---------- boucle : lissage du sonomètre (≈ 0,3 s, horloge réelle), son ---------- */
  let tPrev=null, lastR='';
  function tick(){ const now=performance.now()/1000, dt=Math.min(0.5, tPrev==null? 0 : now-tPrev); tPrev=now;
    const ao=aspOn(); aspSp += ((ao?1:0)-aspSp)*Math.min(1, dt/(ao? 1.0 : 2.5)); if(!ao&&aspSp<0.003) aspSp=0;
    const c=calc(); B.shown += (c.total-B.shown)*Math.min(1, dt/0.3);
    if(Math.abs(c.total-B.shown)<0.05) B.shown=c.total;
    const r=[Math.round(B.shown),B.casque,B.on].join(); if(r!==lastR){ lastR=r; paint(); }
    audioTick(c); }
  paint();
  const R = { tick, bang, alerte, calc, setOn, get enregistrements(){ return SY.echantillons(); }, get aspEnregistree(){ return SY.aspirationEnregistree(); }, niveau:e=>niveau(N0,e), sources:SRC.map(s=>s.nom), sonometre:!!N, get asp(){ return aspSp; }, get casque(){ return B.casque; }, set casque(v){ B.casque=!!v; paint(); },
    get on(){ return B.on; }, get shown(){ return B.shown; }, get err(){ return B.err; }, get ctx(){ return A&&A.ctx; }, niveaux:N0 };
  return R;
}
