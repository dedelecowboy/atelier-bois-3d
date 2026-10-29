/* Synthèse des bruits de l'atelier (Web Audio, AUCUN fichier audio) : moteur et outil, coupe, aspiration, bruits courts.
   Utilisé par engine/audio.js (simulateurs) et par le banc d'écoute (engine/banc-son.js → dist/Ecoute_bruit.html).
   Rien n'est créé avant start() : le navigateur n'autorise le son qu'après un clic.

   set(p) à chaque image, p = {
     f0     : fréquence de rotation réelle de l'outil (Hz = tr/min réels / 60) ;  Z : nombre de dents ;
     spin   : régime réel / régime affiché (0 à 1) ;  on : moteur commandé ;  mot : gain du moteur à vide (amplitude relative) ;
     cut    : 0 à 1, outil dans le bois ;  cutAmp : gain de la coupe ;  charge : 1 = passe de référence ;
     asp    : régime du ventilateur d'aspiration (0 à 1) ;  aspAmp : gain de l'aspiration ;
     casque : son étouffé ;  vol : 0 à 100 } */

/* Son de coupe : « rugissement », choisi par l'enseignant le 29/10/2026 parmi trois essais (A rugissement, B râpe, C souffle) :
   le sifflement de l'outil se durcit, le moteur peine, copeaux en souffle aigu. Les essais B et C ont été retirés (moins de calcul). */

/* RÉGLAGES des sons (réglés par l'enseignant dans l'éditeur du banc d'écoute le 29/10/2026 ; modifiables dans cet éditeur,
   « Copier les réglages » donne ce même objet à reporter ici). Volumes en proportion (0 = coupé). */
export const SONS = {
  aspiration:{ ronron:0.3, pales:0.59, souffle:0.8, electrique:0.31, vitesse:2000 },   // vitesse : tr/min du ventilateur (7 pales)
  coupe:{ sifflement:1.6, copeaux:0.55, grave:0.45, peine:0.05, irregularite:0.18 },       // sifflement : ×1 = réglage d'origine ; peine : baisse du régime max (0,05 = 5 %)
};
const clone=o=>JSON.parse(JSON.stringify(o));

export function createSynth(reglages=SONS){
  let A=null, R=clone(reglages);
  const S={ get ctx(){ return A&&A.ctx; }, get ready(){ return !!A; }, get reglages(){ return clone(R); } };
  /* changer les réglages pendant l'écoute */
  S.regler=function(r){ for(const k of Object.keys(r||{})) R[k]={ ...(R[k]||{}), ...r[k] }; applyReg(); };
  function applyReg(){ if(!A) return; const t=A.ctx.currentTime, c=R.coupe, a=R.aspiration;
    const set=(g,v)=>{ try{ g.gain.setTargetAtTime(Math.max(0,v), t, 0.05); }catch(e){ g.gain.value=Math.max(0,v); } };
    set(A.aTg,0.34*c.sifflement); set(A.aT2g,0.16*c.sifflement); set(A.chipG,c.copeaux); set(A.bodyG,c.grave); set(A.roughG,c.irregularite);
    set(A.souffleG,a.souffle); }

  function noiseBuffer(ctx, sec=2){ const n=Math.floor(ctx.sampleRate*sec), b=ctx.createBuffer(1,n,ctx.sampleRate), d=b.getChannelData(0); let p=0;
    for(let i=0;i<n;i++){ const w=Math.random()*2-1; p=0.97*p+0.03*w; d[i]=0.6*w+2.5*p; } return b; }   // bruit blanc + un peu de bruit « brun » (moins strident)
  function whiteBuffer(ctx){ const n=ctx.sampleRate*2, b=ctx.createBuffer(1,n,ctx.sampleRate), d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; return b; }

  S.start=function(){
    if(A) return S;
    const C=window.AudioContext||window.webkitAudioContext; if(!C) throw new Error('AudioContext absent');
    const ctx=new C(), nb=noiseBuffer(ctx), wb=whiteBuffer(ctx);
    const src=(buf=nb,rate=1)=>{ const s=ctx.createBufferSource(); s.buffer=buf; s.loop=true; s.playbackRate.value=rate; s.start(0, Math.random()*1.5); return s; };
    const gain=v=>{ const g=ctx.createGain(); g.gain.value=v; return g; };
    const filt=(type,f,Q=0.7,dB=0)=>{ const b=ctx.createBiquadFilter(); b.type=type; b.frequency.value=f; b.Q.value=Q; b.gain.value=dB; return b; };
    const osc=(type,f)=>{ const o=ctx.createOscillator(); o.type=type; o.frequency.value=f; o.start(); return o; };
    const chain=(...n)=>{ for(let i=0;i<n.length-1;i++) n[i].connect(n[i+1]); return n[n.length-1]; };
    /* impulsions étroites (passage d'une dent) : série de cosinus, 24 harmoniques décroissantes */
    const pulseWave=(()=>{ const N=24, re=new Float32Array(N+1), im=new Float32Array(N+1); for(let k=1;k<=N;k++) re[k]=Math.pow(1-k/(N+1),1.5); return ctx.createPeriodicWave(re,im); })();
    const pulse=f=>{ const o=ctx.createOscillator(); o.setPeriodicWave(pulseWave); o.frequency.value=f; o.start(); return o; };
    /* sortie : volume → étouffement (casque) → compresseur doux → haut-parleur ; tout passe sous 7 kHz (pas strident) */
    const master=gain(0), muffle=filt('lowpass',16000,0.5), comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-12; comp.knee.value=12; comp.ratio.value=3; comp.attack.value=0.02; comp.release.value=0.3;
    chain(master,muffle,comp,ctx.destination);
    const hush=filt('lowpass',7000,0.5); hush.connect(master);
    const hushIn=gain(1); hushIn.connect(master);                         // entrée des enregistrements (déjà sous 7 kHz par le codage)
    /* rugosité lente commune (fil du bois, nœuds, main de l'opérateur) : bruit lu très lentement puis filtré, 0 ± 1 */
    const rough=chain(src(wb,0.0008), filt('lowpass',5,0.5), gain(3));

    /* --- moteur et outil à vide (le son validé par l'enseignant le 29/10/2026 : ne pas le changer) --- */
    const mot=gain(0); mot.connect(hush);
    const o1=osc('sawtooth',100), o2=osc('triangle',200), o3=osc('sine',100);
    chain(o1, filt('lowpass',700,0.8), gain(0.22), mot);
    chain(o2, gain(0.30), mot);
    const g3=gain(0); chain(o3, g3, mot);
    const wbp=filt('bandpass',800,0.7), wg=gain(0.9); chain(src(), wbp, wg, mot);

    /* --- coupe (« rugissement ») --- */
    const cutBus=gain(0); cutBus.connect(hush);
    const fluct=gain(1), roughG=gain(0.18); fluct.connect(cutBus); chain(rough, roughG, fluct.gain);      // ± 1,5 dB environ, lent
    // outil « chargé » : passage des dents en dents de scie + harmoniques, copeaux en souffle aigu légèrement haché
    const vA=gain(1); vA.connect(fluct);
    const aT=osc('sawtooth',200), aT2=osc('triangle',400);
    const aTg=gain(0.34), aT2g=gain(0.16), chipG=gain(0.55), bodyG=gain(0.35);
    chain(aT, filt('lowpass',1800,0.9), filt('peaking',900,1.2,6), aTg, vA);
    chain(aT2, aT2g, vA);
    const aChipAM=gain(0.7), aP=pulse(200); chain(aP, gain(0.12), aChipAM.gain);
    chain(src(), filt('highpass',1800,0.7), filt('lowpass',5200,0.6), aChipAM, chipG, vA);
    chain(src(), filt('bandpass',260,0.9), bodyG, vA);                                 // corps grave (pièce, table)

    /* --- aspiration (commune à toutes les machines) : un « ronron » régulier (demandé par l'enseignant le 29/10/2026 : moins de vent
       aléatoire) : rotation du ventilateur (grave), passage des pales et son harmonique, un souffle régulier et discret --- */
    const aspBus=gain(0); aspBus.connect(hush);
    const fanR=osc('sawtooth',48), fanRG=gain(0); chain(fanR, filt('lowpass',260,0.8), fanRG, aspBus);      // rotation du ventilateur : ronron grave
    const fan=osc('triangle',340), fanG=gain(0); chain(fan, filt('lowpass',900,0.7), fanG, aspBus);       // passage des pales
    const fan2=osc('sine',680), fan2G=gain(0); chain(fan2, fan2G, aspBus);
    const hum=osc('sine',100), humG=gain(0); chain(hum, humG, aspBus);                                    // ronflement électrique
    const aspLow=filt('lowpass',600,0.5), souffleG=gain(0.22); chain(src(wb,1), aspLow, souffleG, aspBus);                   // souffle régulier (bruit blanc filtré, sans dérive)

    A={ ctx, hushIn, master, muffle, mot, o1, o2, o3, g3, wbp, wg, cutBus, vA, aT, aT2, aP, aTg, aT2g, chipG, bodyG, roughG, souffleG,
      aspBus, aspLow, fanR, fanRG, fan, fanG, fan2, fan2G, humG, nb };
    applyReg();
    return S;
  };

  const T=(p,v,tc=0.06)=>{ try{ p.setTargetAtTime(v, A.ctx.currentTime, tc); }catch(e){ p.value=v; } };
  S.set=function(p){ if(!A) return;
    const Z=p.Z||2, sp=Math.max(0,Math.min(1,p.spin||0)), cut=Math.max(0,Math.min(1,p.cut||0)), ch=Math.max(0.2,Math.min(20,p.charge||1));
    /* le moteur peine en coupe : le régime baisse un peu (jusqu'à −5 % avec une passe forte) */
    const drop=1-cut*Math.min(R.coupe.peine, 0.012*Math.sqrt(ch)*R.coupe.peine/0.05), f0=Math.max(1,(p.f0||0)*drop), ft=Math.max(1,f0*Z);
    T(A.o1.frequency,f0,0.12); T(A.o2.frequency,ft,0.12);
    T(A.g3.gain, p.on? 0.08 : 0);
    T(A.wbp.frequency, 300+900*sp); T(A.wg.gain, 0.4+0.6*sp*sp);
    const E=A.ech;                                                   // enregistrements de la machine (s'ils sont chargés) à la place du son synthétisé
    T(A.mot.gain, E? 0 : (p.mot||0)*0.9);
    for(const o of [A.aT,A.aP]) T(o.frequency, ft, 0.12);
    T(A.aT2.frequency, ft*2, 0.12);
    T(A.cutBus.gain, E? 0 : (p.cutAmp||0)*cut, 0.05);
    if(E) jouerEch(E, p, cut, ch);
    const as=Math.max(0,Math.min(1,p.asp||0));
    const a=R.aspiration, fr=Math.max(1, a.vitesse/60*as);                // ventilateur (tr/min réglables), 7 pales
    T(A.aspBus.gain, (p.aspAmp||0), 0.1); T(A.aspLow.frequency, 200+400*as, 0.1);
    T(A.fanR.frequency, fr, 0.1); T(A.fanRG.gain, a.ronron*as, 0.1);
    T(A.fan.frequency, fr*7, 0.1); T(A.fanG.gain, a.pales*as, 0.1);
    T(A.fan2.frequency, fr*14, 0.1); T(A.fan2G.gain, a.pales*0.19*as, 0.1);
    T(A.humG.gain, as>0.02? a.electrique : 0, 0.1);
    /* casque : son étouffé (passe-bas) et plus faible ; à l'écoute, −16 dB seulement pour rester audible */
    T(A.muffle.frequency, p.casque? 650 : 16000, 0.08);
    T(A.master.gain, ((p.vol??60)/100)**2 * 0.9 * (p.casque? 0.16 : 1), 0.08);
  };
  S.mute=function(){ if(A) T(A.master.gain,0,0.03); };

  /* ---------- enregistrements (essai sur la scie à ruban, 29/10/2026) ----------
     ech = { demarrage, vide, coupe, arret } : MP3 en base64 (data:audio/mpeg;base64,…), intégrés à la page (hors ligne).
     vide et coupe tournent en boucle ; demarrage est joué à la mise en marche puis fondu dans « vide » ; arret au freinage.
     Le volume suit les mêmes niveaux (dB(A)) que le son synthétisé ; « vide » ralentit avec le régime réel (plus grave au freinage). */
  const K_ECH=2.8;                                                     // enregistrements normalisés à −20 dBFS : même volume à l'écoute que la synthèse
  S.chargerEchantillons=async function(ech){ if(!A||!ech) return; const ctx=A.ctx, out={};
    const dec=async url=>{ const b64=url.split(',')[1], bin=atob(b64), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
      const buf=await new Promise((ok,ko)=>{ const r=ctx.decodeAudioData(u.buffer,ok,ko); if(r&&r.then) r.then(ok,ko); });
      /* bornes de la boucle : sans le silence ajouté par le codage MP3 au début et à la fin */
      const d=buf.getChannelData(0); let a=0, z=d.length-1; while(a<z&&Math.abs(d[a])<1e-4) a++; while(z>a&&Math.abs(d[z])<1e-4) z--;
      return { buf, a:a/buf.sampleRate, z:(z+1)/buf.sampleRate }; };
    for(const k of ['demarrage','vide','coupe','arret']) if(ech[k]) out[k]=await dec(ech[k]);
    const loopV=(e)=>{ const s=ctx.createBufferSource(); s.buffer=e.buf; s.loop=true; s.loopStart=e.a; s.loopEnd=e.z; const g=ctx.createGain(); g.gain.value=0; s.connect(g); g.connect(A.hushIn); s.start(0, e.a); return { s, g }; };
    A.ech={ d:out, vide:out.vide&&loopV(out.vide), coupe:out.coupe&&loopV(out.coupe), on:false, t0:-1, one:null }; };
  S.echantillons=()=>!!(A&&A.ech);
  function unCoup(e, gain){ const ctx=A.ctx, s=ctx.createBufferSource(); s.buffer=e.buf; const g=ctx.createGain(); g.gain.value=gain; s.connect(g); g.connect(A.hushIn); s.start(0, e.a); return { s, g }; }
  function jouerEch(E, p, cut, ch){ const ctx=A.ctx, now=ctx.currentTime, on=!!p.on, sp=Math.max(0,Math.min(1,p.spin||0)), lv=(p.mot||0)*K_ECH;
    const stopOne=()=>{ if(E.one){ const o=E.one; try{ o.g.gain.setTargetAtTime(0,now,0.08); o.s.stop(now+0.5); }catch(e){} E.one=null; } };
    if(on&&!E.on){ stopOne(); if(E.d.demarrage&&sp<0.5){ E.one=unCoup(E.d.demarrage, (p.motFull||p.mot||0)*K_ECH); E.t0=now; } else E.t0=-1; }   // mise en marche
    if(!on&&E.on){ stopOne(); if(E.d.arret&&sp>0.5){ E.one=unCoup(E.d.arret, (p.motFull||p.mot||0)*K_ECH); E.t0=-2; } }                      // freinage
    E.on=on;
    let gV;
    if(on){ const dur=E.d.demarrage? E.d.demarrage.z-E.d.demarrage.a : 0;
      gV= E.t0>=0 && now-E.t0 < dur-0.5 ? 0 : (p.motFull||p.mot||0)*K_ECH; }                 // pendant le démarrage enregistré, la boucle attend
    else gV= E.t0===-2 ? 0 : lv;                                                                 // freinage enregistré : la boucle se tait
    if(E.vide){ T(E.vide.g.gain, gV, 0.25); T(E.vide.s.playbackRate, Math.max(0.3, sp), 0.1); }
    if(E.coupe){ T(E.coupe.g.gain, (p.cutAmp||0)*cut*K_ECH, 0.06); T(E.coupe.s.playbackRate, 1-cut*Math.min(R.coupe.peine, 0.012*Math.sqrt(ch)*R.coupe.peine/0.05), 0.12); } }
  /* bruits courts */
  S.bang=function(type){ if(!A) return; const ctx=A.ctx, t0=ctx.currentTime, out=ctx.createGain(); out.connect(A.master);
    const env=(g,a,peak,d)=>{ g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(peak,t0+a); g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d); };
    const burst=(f,Q,peak,d,type2='bandpass')=>{ const s=ctx.createBufferSource(); s.buffer=A.nb; const b=ctx.createBiquadFilter(); b.type=type2; b.frequency.value=f; b.Q.value=Q;
      const g=ctx.createGain(); env(g,0.004,peak,d); s.connect(b); b.connect(g); g.connect(out); s.start(t0, Math.random()); s.stop(t0+d+0.1); };
    const ring=(fs,peak,d)=>{ for(const [f,k] of fs){ const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f; const g=ctx.createGain(); env(g,0.003,peak*k,d*(0.6+0.4*k)); o.connect(g); g.connect(out); o.start(t0); o.stop(t0+d+0.1); } };
    if(type==='au'){ burst(900,0.8,0.5,0.06); burst(160,0.7,0.6,0.12,'lowpass'); }                 // coup de poing frappé : « clac »
    else if(type==='choc'){ burst(2200,1.2,0.35,0.05); ring([[870,1],[1390,0.6],[2230,0.35]],0.18,0.7); }   // outil contre l'acier : tintement court
    else if(type==='coup'){ burst(220,0.8,0.7,0.16,'lowpass'); burst(1200,1,0.2,0.05); }             // pièce qui bute : coup sourd
    else if(type==='rejet'){ burst(180,0.7,0.8,0.2,'lowpass'); burst(1800,0.9,0.4,0.35); }          // pièce rejetée : coup + sifflement
    else if(type==='attaque'){ burst(700,0.9,0.35,0.09); burst(200,0.8,0.4,0.12,'lowpass'); }        // l'outil mord dans le bois
  };
  return S;
}
