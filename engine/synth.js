/* Synthèse des bruits de l'atelier (Web Audio, AUCUN fichier audio) : moteur et outil, coupe, aspiration, bruits courts.
   Utilisé par engine/audio.js (simulateurs) et par le banc d'écoute (engine/banc-son.js → dist/Ecoute_bruit.html).
   Rien n'est créé avant start() : le navigateur n'autorise le son qu'après un clic.

   set(p) à chaque image, p = {
     f0     : fréquence de rotation réelle de l'outil (Hz = tr/min réels / 60) ;  Z : nombre de dents ;
     spin   : régime réel / régime affiché (0 à 1) ;  on : moteur commandé ;  mot : gain du moteur à vide (amplitude relative) ;
     cut    : 0 à 1, outil dans le bois ;  cutAmp : gain de la coupe ;  charge : 1 = passe de référence ;
     asp    : régime du ventilateur d'aspiration (0 à 1) ;  aspAmp : gain de l'aspiration ;
     casque : son étouffé ;  vol : 0 à 100 ;  variante : son de coupe 'A' | 'B' | 'C' (voir VARIANTES) } */

export const VARIANTES = {
  A:'Rugissement : le sifflement de l\'outil se durcit, le moteur peine, copeaux en souffle aigu',
  B:'Râpe : impacts des dents dans le bois, plus « grrr », le moteur peine',
  C:'Souffle : le bruit à vide plus fort et plus clair, peu d\'impacts',
};
export const VARIANTE_DEFAUT = 'A';

export function createSynth(){
  let A=null;
  const S={ get ctx(){ return A&&A.ctx; }, get ready(){ return !!A; } };

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
    /* rugosité lente commune (fil du bois, nœuds, main de l'opérateur) : bruit lu très lentement puis filtré, 0 ± 1 */
    const rough=chain(src(wb,0.0008), filt('lowpass',5,0.5), gain(3));

    /* --- moteur et outil à vide (le son validé par l'enseignant le 29/10/2026 : ne pas le changer) --- */
    const mot=gain(0); mot.connect(hush);
    const o1=osc('sawtooth',100), o2=osc('triangle',200), o3=osc('sine',100);
    chain(o1, filt('lowpass',700,0.8), gain(0.22), mot);
    chain(o2, gain(0.30), mot);
    const g3=gain(0); chain(o3, g3, mot);
    const wbp=filt('bandpass',800,0.7), wg=gain(0.9); chain(src(), wbp, wg, mot);

    /* --- coupe : trois sons possibles (banc d'écoute), un seul actif --- */
    const cutBus=gain(0); cutBus.connect(hush);
    const fluct=gain(1); fluct.connect(cutBus); chain(rough, gain(0.18), fluct.gain);      // ± 1,5 dB environ, lent
    // A : outil « chargé » : passage des dents en dents de scie + harmoniques, copeaux en souffle aigu légèrement haché
    const vA=gain(0); vA.connect(fluct);
    const aT=osc('sawtooth',200), aT2=osc('triangle',400);
    chain(aT, filt('lowpass',1800,0.9), filt('peaking',900,1.2,6), gain(0.34), vA);
    chain(aT2, gain(0.16), vA);
    const aChipAM=gain(0.7), aP=pulse(200); chain(aP, gain(0.12), aChipAM.gain);
    chain(src(), filt('highpass',1800,0.7), filt('lowpass',5200,0.6), aChipAM, gain(0.55), vA);
    chain(src(), filt('bandpass',260,0.9), gain(0.35), vA);                                 // corps grave (pièce, table)
    // B : râpe : bruit coloré multiplié par les impulsions des dents, résonance du bois
    const vB=gain(0); vB.connect(fluct);
    const bAM=gain(0.15), bP=pulse(200); chain(bP, gain(0.6), bAM.gain);
    const bRes=filt('bandpass',1200,1.6);
    chain(src(), bRes, bAM, gain(4.0), vB);
    const bT=osc('sawtooth',200); chain(bT, filt('lowpass',1200,0.8), gain(0.18), vB);
    chain(src(), filt('lowpass',320,0.7), gain(0.35), vB);
    // C : souffle : le bruit à vide plus fort et plus clair (souffle de l'outil qui monte en fréquence), un peu de copeaux
    const vC=gain(0); vC.connect(fluct);
    const cW=filt('bandpass',1400,0.6); chain(src(), cW, gain(1.0), vC);
    const cT=osc('triangle',200); chain(cT, gain(0.25), vC);
    chain(src(), filt('highpass',2500,0.7), gain(0.25), vC);

    /* --- aspiration (commune à toutes les machines) : souffle large, grave dominant, raie du ventilateur, ronflement --- */
    const aspBus=gain(0); aspBus.connect(hush);
    const aspLow=filt('lowpass',900,0.6), aspPk=filt('peaking',380,1.0,5);
    chain(src(nb,1), aspLow, aspPk, gain(1.0), aspBus);
    const aspHi=filt('bandpass',2200,0.5); chain(src(wb,1), aspHi, gain(0.07), aspBus);   // sifflement d'air à la buse, faible
    const fan=osc('sine',300), fanG=gain(0); chain(fan, fanG, aspBus);                       // raie du ventilateur (pales)
    const hum=osc('sine',100), humG=gain(0); chain(hum, humG, aspBus);

    A={ ctx, master, muffle, mot, o1, o2, o3, g3, wbp, wg, cutBus, vA, vB, vC, aT, aT2, aP, bP, bT, bRes, cW, cT,
      aspBus, aspLow, fan, fanG, humG, nb };
    return S;
  };

  const T=(p,v,tc=0.06)=>{ try{ p.setTargetAtTime(v, A.ctx.currentTime, tc); }catch(e){ p.value=v; } };
  S.set=function(p){ if(!A) return;
    const Z=p.Z||2, sp=Math.max(0,Math.min(1,p.spin||0)), cut=Math.max(0,Math.min(1,p.cut||0)), ch=Math.max(0.2,Math.min(20,p.charge||1));
    /* le moteur peine en coupe : le régime baisse un peu (jusqu'à −5 % avec une passe forte) */
    const drop=1-cut*Math.min(0.05, 0.012*Math.sqrt(ch)), f0=Math.max(1,(p.f0||0)*drop), ft=Math.max(1,f0*Z);
    T(A.o1.frequency,f0,0.12); T(A.o2.frequency,ft,0.12);
    T(A.g3.gain, p.on? 0.08 : 0);
    T(A.wbp.frequency, 300+900*sp); T(A.wg.gain, 0.4+0.6*sp*sp);
    T(A.mot.gain, (p.mot||0)*0.9);
    for(const o of [A.aT,A.aP,A.bP,A.bT,A.cT]) T(o.frequency, ft, 0.12);
    T(A.aT2.frequency, ft*2, 0.12);
    const bright=Math.min(1, Math.log10(ch*3)/1.3);                 // passe forte, bois dur : plus aigu
    T(A.bRes.frequency, 900+1300*bright); T(A.cW.frequency, 900+1600*bright);
    const v=p.variante||VARIANTE_DEFAUT;
    T(A.vA.gain, v==='A'?1:0, 0.03); T(A.vB.gain, v==='B'?1:0, 0.03); T(A.vC.gain, v==='C'?1:0, 0.03);
    T(A.cutBus.gain, (p.cutAmp||0)*cut, 0.05);
    const as=Math.max(0,Math.min(1,p.asp||0));
    T(A.aspBus.gain, (p.aspAmp||0), 0.1); T(A.aspLow.frequency, 300+700*as, 0.1);
    T(A.fan.frequency, Math.max(1, 2900/60*7*as), 0.1); T(A.fanG.gain, 0.05*as, 0.1); T(A.humG.gain, as>0.02? 0.04 : 0, 0.1);
    /* casque : son étouffé (passe-bas) et plus faible ; à l'écoute, −16 dB seulement pour rester audible */
    T(A.muffle.frequency, p.casque? 650 : 16000, 0.08);
    T(A.master.gain, ((p.vol??60)/100)**2 * 0.9 * (p.casque? 0.16 : 1), 0.08);
  };
  S.mute=function(){ if(A) T(A.master.gain,0,0.03); };
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
