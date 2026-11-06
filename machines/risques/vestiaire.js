/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Le « vestiaire » des risques généraux (demandé par l'enseignant le 06/11/2026 ; prototype : 3 démonstrations) :
   l'élève (l'avatar du scénario « EPI ») enfile chaque équipement devant les consignes EPI de l'atelier, la caméra vient
   dessus ; chaque fiche (data/vestiaire.txt, lecture obligatoire : engine/fiches.js) peut montrer une démonstration
   « sans protection » puis « avec protection ».
   Mise en scène (choix proposé : « ne pas gâcher les personnages par une animation bon marché ») : cadrage serré, horloge
   réelle, ralenti au moment clé, le reste de l'image qui s'assombrit (vignette), son ; sans protection, la scène s'ARRÊTE
   juste avant le contact (écran rouge sobre, conséquence en une phrase, jamais de blessure montrée) ; avec, elle va au bout.
   Démonstrations du prototype : casque antibruit (raboteuse, son enregistré, sonomètre), lunettes (éclat projeté par
   l'outil de la toupie), écharpe (happée par l'outil de la toupie). Les vraies toupie et raboteuse des simulateurs
   (buildModel, comme la page atelier) remplacent leurs modèles simplifiés pendant le vestiaire. */
import * as THREE from 'three';
import { setEpi, setPose, POSES, reperes, placerObjets } from './figures.js';
import { buildModel as toupieModel } from '../toupie/model.js';
import { st as tst } from '../toupie/state.js';
import { buildModel as rabotModel } from '../raboteuse/model.js';
import { st as rst, tableY as rTableY } from '../raboteuse/state.js';
import { BRUIT as RBRUIT } from '../raboteuse/constants.js';

const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const ease=t=>t<0? 0 : t>1? 1 : t*t*(3-2*t);
/* équipements : code de la fiche → codes d'EPI de l'avatar (figures.js) */
const EQUIP=['chaussures','tenue','lunettes','auditif','masque','masque_a','gants_manut','gants_chim'];
const BASE=['tenue','chaussures'];
/* démonstrations du prototype */
const DEMOS={ auditif:'bruit', lunettes:'eclat', echarpe:'happe' };
const BTN={ sans:'▶ Voir sans protection', avec:'▶ Voir avec protection' }, BTN_D={ sans:'▶ Voir le danger', avec:'▶ Voir la bonne tenue' };

export function createVestiaire({ app, model, stage, list }){
  const root=stage.root, av=model.avatar, P=()=>av.userData.P, cam=stage.camera, ctl=stage.controls;
  const $=id=>document.getElementById(id);
  let lastLh=null, active=false, cur=null, demo=null, built=false, T=null, R=null, fixedT=null, lastNow=null;

  /* ---------- toupie et raboteuse des simulateurs, à la place des modèles simplifiés (construites au premier besoin) ---------- */
  function station(L, build, rest){ const g=new THREE.Group(); root.add(g); const pm=new Proxy({},{ get:(t,k)=>t[k]||(t[k]=[]) });
    const m=build({ root:g, tagPart:o=>o, partMeshes:pm }); rest(m);
    const strip=()=>g.traverse(o=>{ delete o.userData.part; });      // pas de nomenclature ni de clic sur ces modèles
    strip(); g.updateMatrixWorld(true);
    const c=new THREE.Box3().setFromObject(g).getCenter(V3()); const yaw=-L.rot*Math.PI/180;
    g.rotation.y=yaw; const off=c.clone().setY(0).applyAxisAngle(V3(0,1,0),yaw); g.position.set(L.x-off.x,0,L.z-off.z); g.visible=false;
    return { g, m, yaw, strip, w:(x,y,z)=>g.localToWorld(V3(x,y,z)) }; }
  function build(){ if(built) return; built=true;
    tst.motor=false; tst.dir=1; T=station(model.DEC.toupie.L, toupieModel, m=>m.update(()=>0,()=>0,null));
    rst.motor=false; rst.feed=false; rst.H=28; R=station(model.DEC.rabot.L, rabotModel, m=>m.update(()=>0));
    /* planche qui entre dans la raboteuse (démonstration du bruit) */
    const wood=new THREE.MeshStandardMaterial({ color:0xc9a06a, roughness:.75 });
    R.plank=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.030,0.14),wood); R.plank.castShadow=true; R.g.add(R.plank); R.plank.visible=false;
    /* éclat de bois (démonstration des lunettes) : un copeau irrégulier */
    const eg=new THREE.BoxGeometry(0.03,0.005,0.016,3,1,2), p=eg.attributes.position;
    for(let i=0;i<p.count;i++){ p.setX(i,p.getX(i)*(0.8+Math.random()*0.4)); p.setZ(i,p.getZ(i)*(0.7+Math.random()*0.6)); p.setY(i,p.getY(i)+Math.sin(p.getX(i)*300)*0.0008); }
    eg.computeVertexNormals();
    T.chip=new THREE.Mesh(eg,new THREE.MeshStandardMaterial({ color:0xe2bd84, roughness:.7, emissive:0x3a2a10 })); T.chip.visible=false; root.add(T.chip);
    /* traînée légère derrière l'éclat (ralenti) */
    T.trail=new THREE.Mesh(new THREE.PlaneGeometry(1,0.004),new THREE.MeshBasicMaterial({ color:0xf3e4c4, transparent:true, opacity:.35, depthWrite:false, side:THREE.DoubleSide })); T.trail.visible=false; root.add(T.trail);
    /* repère du point d'arrivée de l'éclat (cercle fin face à la caméra : rouge sans lunettes, vert sur le verre) */
    T.mark=new THREE.Mesh(new THREE.TorusGeometry(0.03,0.0018,6,40),new THREE.MeshBasicMaterial({ color:0xd0201c, transparent:true, opacity:0, depthTest:false, toneMapped:false }));
    T.mark.renderOrder=5; root.add(T.mark);
    /* anneau rouge discret autour de l'outil, au moment du danger (écharpe) */
    T.halo=new THREE.Mesh(new THREE.TorusGeometry(0.085,0.004,8,48),new THREE.MeshBasicMaterial({ color:0xd0201c, transparent:true, opacity:0, depthWrite:false, toneMapped:false }));
    T.halo.rotation.x=Math.PI/2; T.g.add(T.halo); T.halo.position.set(0,0.93,0);
    stage.dirty(); }
  function showStations(on){ if(!built) return; T.g.visible=on; R.g.visible=on; model.DEC.toupie.g.visible=!on; model.DEC.rabot.g.visible=!on; stage.dirty(); }

  /* ---------- l'élève devant les consignes EPI (mur des portes, près de la porte A) ---------- */
  const HOME={ x:-2.6, z:-5.5, ry:Math.PI/2 };     // dans l'allée jaune devant la corroyeuse, tourné le long de l'allée (vers +X)
  function place(x,z,ry,o){ model.placeAvatar(x,z,ry,o); }
  const outfit=(k,on)=>{ const e=new Set(BASE); let hair='attache', echarpe=false, bijoux=false;
    if(EQUIP.includes(k)){ if(on) e.add(k); else e.delete(k); }
    if(k==='echarpe') echarpe=on; if(k==='bijoux') bijoux=on; if(k==='cheveux' && on) hair='long'; if(k==='sweat' && on) e.delete('tenue');
    return { epi:[...e], hair, echarpe, bijoux }; };
  /* fiches « Ce qui est dangereux » : la fiche montre le danger (on = l'élève porte l'écharpe…) */
  const DANGER=new Set(['echarpe','bijoux','cheveux','sweat']);

  /* ---------- caméra : glissement doux vers un cadrage (horloge réelle) ---------- */
  let move=null;
  function camTo(pos,tgt,dur=1.1){ move={ p0:cam.position.clone(), t0:ctl.target.clone(), p1:pos.clone(), t1:tgt.clone(), s:performance.now()/1000, d:dur }; }
  const bone=n=>P().B[n].getWorldPosition(V3());
  /* point de vue à `dist` du point visé, décalé de `side` radians de la direction regardée par l'élève, à la hauteur `dy` */
  function around(tgt,side,dist,dy){ const a=av.rotation.y+side; return V3(tgt.x+Math.sin(a)*dist, tgt.y+dy, tgt.z+Math.cos(a)*dist); }
  /* caméra de côté : perpendiculaire au segment a → b (vu du côté gauche de la toupie, −X du modèle), à `d` m, relevée de `h` */
  function sideCam(a,b,d,h){ const mid=a.clone().add(b).multiplyScalar(0.5), dir=b.clone().sub(a).setY(0).normalize(), perp=V3(-dir.z,0,dir.x);
    const left=T.w(-1,0,0).sub(T.w(0,0,0)); if(perp.dot(left)<0) perp.negate(); return { pos:mid.clone().addScaledVector(perp,d).add(V3(0,h,0)), tgt:mid }; }
  function frameFor(k){ av.updateMatrixWorld(true); let t, p;
    if(['lunettes','auditif','masque','masque_a'].includes(k)){ t=bone('Head').add(V3(0,0.06,0)); p=around(t,0.55,0.85,0.05); }
    else if(k==='cheveux'){ t=bone('Head').add(V3(0,0.02,0)); p=around(t,2.5,0.95,0.15); }
    else if(k==='chaussures'){ t=bone('LeftFoot').add(bone('RightFoot')).multiplyScalar(0.5).add(V3(0,0.02,0)); p=around(t,0.6,1.05,0.45); }
    else if(k==='gants_manut'||k==='gants_chim'||k==='bijoux'){ t=bone('RightHand'); p=around(t,-0.7,0.85,0.25); }
    else if(k==='echarpe'){ t=bone('Spine2'); p=around(t,0.45,1.05,0.1); }
    else { t=V3(av.position.x,0.95,av.position.z); p=around(t,0.4,2.9,0.45); }
    camTo(p,t); }

  /* ---------- habiller l'élève pour une fiche : sans l'équipement, puis il l'enfile ---------- */
  let dressT=null;
  function dress(k){ stopDemo(); cur=k; const d=DANGER.has(k);
    place(HOME.x,HOME.z,HOME.ry,{ ...outfit(k, d), pose:k==='gants_manut'||k==='gants_chim'? 'machine' : 'debout' });
    if(!d){ setEpi(av,outfit(k,false)); clearTimeout(dressT); dressT=setTimeout(()=>{ if(cur===k && !demo) setEpi(av,outfit(k,true)); stage.dirty(); },650); }
    const f=list.find(x=>x.parts[0]===k), info=$('info'); if(info&&f) info.innerHTML=`<b>Vestiaire · ${f.t}</b><span>${DANGER.has(k)? 'Ce qui est dangereux à l\'atelier' : 'L\'élève l\'enfile'} : faites tourner et zoomez pour bien voir.</span>`;
    frameFor(k); stage.dirty(); }

  /* ---------- vignette et carte de la démonstration (sur la vue 3D) ---------- */
  const stageEl=document.querySelector('.stage');
  const vig=document.createElement('div'); vig.className='vvig'; vig.setAttribute('aria-hidden','true'); stageEl.appendChild(vig);
  const card=document.createElement('div'); card.className='vcard'; card.id='vcard'; card.hidden=true; card.setAttribute('role','status'); stageEl.appendChild(card);
  function showCard(level,title,text,k,mode){ const other=mode==='sans'? 'avec' : 'sans', B=DANGER.has(k)? BTN_D : BTN;
    card.dataset.l=level; card.hidden=false;
    card.innerHTML=`<b>${title}</b><p>${text}</p><div class="vbtns"><button type="button" class="toggle mini" data-vd="${mode}">↻ Rejouer</button><button type="button" class="toggle mini" data-vd="${other}">${B[other]}</button><button type="button" class="toggle mini" data-vd="x">Fermer</button></div>`;
    card.querySelectorAll('[data-vd]').forEach(b=>b.onclick=()=>{ const v=b.dataset.vd; if(v==='x'){ stopDemo(); dress(k); } else play(k,v); }); }
  function setVig(l){ vig.dataset.l=l||''; }

  /* ---------- démonstrations ---------- */
  function stopDemo(){ if(!demo) return; demo=null; card.hidden=true; setVig('');
    tst.motor=false; rst.motor=false; rst.feed=false; if(app.bruit) app.bruit.casque=false;
    if(built){ T.chip.visible=false; T.trail.visible=false; R.plank.visible=false; T.halo.material.opacity=0; T.mark.material.opacity=0; POSES.vest={ ...POSES.machine }; placerObjets(av); tst.prot=true; T.m.update(()=>0,()=>0,null); T.strip(); }
    const s=$('sono'); if(s) s.hidden=true; const info=$('info'); if(info) info.style.visibility=''; stage.dirty(); }

  function play(k,mode){ build(); showStations(true); stopDemo(); clearTimeout(dressT);
    const on=mode==='avec', kind=DEMOS[k]; demo={ k, mode, kind, t0:performance.now()/1000, end:false };
    card.hidden=true; setVig('dim');
    if(kind==='bruit'){
      /* l'élève à l'entrée de la raboteuse (côté +X du modèle), face à la machine ; la planche part de la rallonge d'entrée */
      const o=R.w(1.25,0,0.05); place(o.x,o.z,R.yaw-Math.PI/2,{ ...outfit('auditif',on), pose:'machine' });
      if(app.bruit) app.bruit.casque=on;
      rst.motor=true; rst.feed=false; R.plank.visible=false;
      const h=bone('Head'), m=R.w(0.2,1.0,0); camTo(around(h.clone().lerp(m,0.4),2.2,1.6,0.25), h.clone().lerp(m,0.45), 1.4);
      const s=$('sono'); if(s) s.hidden=false; }
    else { /* toupie : l'élève à son poste, ventre contre la table (+Z du modèle, bord avant en z = 0,34), face au guide */
      const o=T.w(0.0,0,kind==='happe'? 0.50 : 0.56); place(o.x,o.z,T.yaw+Math.PI,{ ...outfit(k,kind==='happe'? !on : on), pose:'machine' });
      tst.motor=true; tst.dir=1; tst.prot=kind!=='happe'; tst.tool='moulure'; tst.zIn=60; tst.h=0; T.m.update(()=>0,()=>0,null); T.strip();
      demo.P=T.w(0,0.90,0.072);                                                  // l'outil, dans la lumière du guide
      if(kind==='eclat'){ /* point visé : l'œil droit de l'élève (repères du visage, repère du personnage au repos) */
        setPose(av,'debout'); av.updateMatrixWorld(true); const r=reperes(av), inner=P().inner, head=P().B.Head;
        demo.eyeL=head.worldToLocal(inner.localToWorld(V3(-0.032,r.oeil_y,r.oeil_z)));
        demo.fwdL=head.worldToLocal(inner.localToWorld(V3(-0.032,r.oeil_y,r.oeil_z+1))).sub(demo.eyeL).normalize();
        setPose(av,'machine'); av.updateMatrixWorld(true);
        const eye=head.localToWorld(demo.eyeL.clone()); demo.from=T.w(0.02,0.905,0.085);
        const c=sideCam(eye,demo.from,1.25,0.10); camTo(c.pos,c.tgt.clone().lerp(eye,0.18),1.2); }
      else { demo.sc0=null; POSES.vest={ ...POSES.machine }; setPose(av,'vest');
        const c=sideCam(bone('Head'),demo.P,1.15,0.1); camTo(c.pos,c.tgt.clone().lerp(demo.P,0.2),1.2); } }
    const info=$('info'); if(info) info.style.visibility='hidden';
    stage.dirty(); }

  /* bruit : état de la raboteuse pour le sonomètre et le son (engine/audio.js) */
  function bruitEtat(){ if(!demo||demo.kind!=='bruit') return { on:false, rpm:RBRUIT.rpm, spin:R?.m.spin||0, cut:0, charge:1, dents:4 };
    return { on:rst.motor, rpm:RBRUIT.rpm, spin:R.m.spin, cut:demo.cut||0, charge:1, dents:4 }; }

  function finish(level,title,text){ if(demo.end) return; demo.end=true; setVig(level==='ko'? 'ko' : 'ok'); showCard(level,title,text,demo.k,demo.mode); }
  const fmtMin=L=>{ const m=480/Math.pow(2,(L-80)/3); return m<1? 'moins d\'une minute' : m<60? `${Math.round(m)} minutes` : `${Math.round(m/60)} heures`; };

  function tick(){ const now=performance.now()/1000, dt=Math.min(0.1, lastNow==null? 0 : now-lastNow); lastNow=now;
    if(move){ const k=ease((now-move.s)/move.d); cam.position.lerpVectors(move.p0,move.p1,k); ctl.target.lerpVectors(move.t0,move.t1,k); ctl.update(); if(k>=1) move=null; stage.dirty?.(); }
    if(!built) return active;
    T.m.tick(0); R.m.tick(dt);
    if(!demo) return active;
    const t=fixedT??(now-demo.t0), on=demo.mode==='avec';
    if(demo.kind==='bruit'){
      /* la planche avance sur la rallonge d'entrée puis passe sous l'arbre (de +X vers −X) */
      const t1=1.6, v=0.18, x=0.95+0.45-(t>t1? (t-t1)*v : 0);
      R.plank.visible=true; R.plank.position.set(x,rTableY()+0.015,0); rst.feed=t>t1;
      demo.cut= (x-0.45<0 && x+0.45>0)? 1 : 0;
      R.m.update((px)=>Math.abs(px-x)<0.45? 0.030 : 0);
      if(t>7.5 && !demo.end){ const L=Math.round(app.bruit? app.bruit.shown : RBRUIT.coupe), O=on? L-25 : L;   // le niveau affiché par le sonomètre
        if(on) finish('ok',`Avec le casque : ${O} dB(A) à l'oreille`,`La raboteuse fait ${L} dB(A) au poste. Le casque ramène le bruit sous 80 dB(A) à l'oreille : l'oreille est protégée. Il se garde tout le temps que la machine tourne.${app.bruit?.on?'':' Activez le son 🔊 en haut pour entendre la différence.'}`);
        else finish('ko',`Sans casque : ${O} dB(A) à l'oreille`,`À ce niveau, la dose de bruit d'une journée entière (8 h à 80 dB(A)) est reçue en ${fmtMin(O)}. Le bruit détruit les cellules de l'oreille interne : la perte d'audition est définitive.${app.bruit?.on?'':' Activez le son 🔊 en haut pour entendre la différence.'}`); } }
    else if(demo.kind==='eclat'){
      const head=P().B.Head, eye=head.localToWorld(demo.eyeL.clone()), fwd=demo.fwdL.clone().transformDirection(head.matrixWorld);
      const t0=1.3, dur=1.5, u=(t-t0)/dur;                               // ralenti : 1,5 s pour un trajet réel de quelques centièmes
      const stopAt=on? 0.025 : 0.012, end=eye.clone().addScaledVector(fwd,stopAt);
      const c=T.chip, tr=T.trail;
      if(u<0){ c.visible=false; tr.visible=false; }
      else if(u<=1){ const k=u, ctrl=demo.from.clone().lerp(end,0.5).add(V3(0,0.10,0)), bez=k=>demo.from.clone().multiplyScalar((1-k)*(1-k)).addScaledVector(ctrl,2*k*(1-k)).addScaledVector(end,k*k);
        const p=bez(k), q=bez(Math.max(0,k-0.04)), dv=p.clone().sub(q); c.position.copy(p); c.visible=true; c.rotation.set(t*9,t*13,t*5);
        if(dv.length()>1e-5){ tr.visible=true; const L=Math.min(0.08,dv.length()*6); tr.scale.set(L,1,1); tr.quaternion.setFromUnitVectors(V3(1,0,0),dv.clone().normalize()); tr.position.copy(p).addScaledVector(dv.normalize(),-L/2); } }
      else { tr.visible=false; const th=t-(t0+dur);
        if(on){ if(!demo.hit){ demo.hit=true; demo.hp=end.clone(); demo.vel=fwd.clone().multiplyScalar(0.35).add(V3(0,0.25,0)); app.bruit?.bang?.('choc'); }
          const tt=Math.min(th,1.0)*0.5;   // ralenti
          c.position.copy(demo.hp).addScaledVector(demo.vel,tt).add(V3(0,-0.5*9.81*tt*tt,0)); c.rotation.set(t*9,t*13,t*5);
          T.mark.position.copy(demo.hp); T.mark.lookAt(cam.position); T.mark.material.color.setHex(0x2e9d4f); T.mark.material.opacity=Math.max(0,0.9-th*0.6);
          if(th>1.1) finish('ok','Avec les lunettes : l\'éclat rebondit','Le verre des lunettes de sécurité arrête l\'éclat. Marquage EN 166 « F » : il résiste à un éclat projeté à 45 m/s. Des lunettes de vue ne protègent pas.'); }
        else { c.position.copy(end); T.mark.position.copy(end); T.mark.lookAt(cam.position); T.mark.material.color.setHex(0xd0201c); T.mark.material.opacity=Math.min(0.9,th*4); if(th>0.25) finish('ko','Sans lunettes : l\'éclat atteint l\'œil','Projeté par l\'outil, l\'éclat arrive en une fraction de seconde : impossible de fermer les yeux à temps. Blessure de la cornée, jusqu\'à la perte de l\'œil.'); } } }
    else if(demo.kind==='happe'){
      /* l'élève se penche au-dessus de la table vers l'outil qui tourne (pour regarder la coupe) ; avec l'écharpe, le pan
         descend vers la lumière du guide : la scène s'arrête 3 cm avant le contact */
      /* l'écharpe pend sous le cou (pesanteur) : elle suit le cou en translation, sans tourner avec le buste */
      const sc=P().scarf, hang=()=>{ if(!sc.visible) return; const N=bone('Neck');
        if(!demo.sc0){ demo.sc0={ Mw:sc.matrixWorld.clone(), N:N.clone() }; return; }
        const Mw=new THREE.Matrix4().makeTranslation(N.x-demo.sc0.N.x,N.y-demo.sc0.N.y,N.z-demo.sc0.N.z).multiply(demo.sc0.Mw);
        new THREE.Matrix4().copy(sc.parent.matrixWorld).invert().multiply(Mw).decompose(sc.position,sc.quaternion,sc.scale); sc.updateMatrixWorld(true); };
      const pose=L=>{ POSES.vest={ ...POSES.machine, sp:0.14+0.8*L, hip:0.3*L, sh:[[-0.35-0.2*L,0.28],[-0.35-0.2*L,-0.28]], el:[-1.05,-1.05] }; setPose(av,'vest'); av.updateMatrixWorld(true); hang(); };
      if(!demo.sc0){ pose(0); }
      const dist=()=>{ const m=P().scarf; if(!m.visible||!m.geometry) return 9; const pa=m.geometry.attributes.position, w=V3(); let d=9;
        for(let i=0;i<pa.count;i+=3){ w.fromBufferAttribute(pa,i).applyMatrix4(m.matrixWorld); d=Math.min(d,w.distanceTo(demo.P)); } return d; };
      let L=ease((t-0.8)/3.0);
      if(!on){ if(demo.Lh==null){ pose(L); if(dist()<0.05 || L>=1){ let a=0, b=L; for(let i=0;i<10;i++){ const m=(a+b)/2; pose(m); if(dist()<0.05) b=m; else a=m; } demo.Lh=b; demo.th=t; lastLh=b; } }
        if(demo.Lh!=null) L=Math.min(L,demo.Lh); pose(L);
        T.halo.material.opacity= demo.Lh!=null? 0.65+0.25*Math.sin(t*8) : 0;
        if(demo.Lh!=null && t>demo.th+0.5) finish('ko','L\'écharpe va être happée par l\'outil','À quelques centimètres de l\'outil qui tourne à des milliers de tours par minute : en une fraction de seconde, l\'outil enroulerait l\'écharpe et entraînerait le cou vers la machine. Personne n\'a le temps de réagir : on retire écharpe, foulard et cordons AVANT d\'entrer à l\'atelier.'); }
      else { pose(Math.min(L,lastLh??0.75)); if(t>4.0) finish('ok','Sans écharpe : rien ne pend près de l\'outil','Tenue fermée et ajustée, écharpe retirée, cheveux attachés : même penché au-dessus de la table, rien ne peut être happé par l\'outil qui tourne.'); } }
    stage.dirty?.(); return true; }

  /* ---------- entrée et sortie du vestiaire ---------- */
  let saved=null;
  function enter(){ if(active) return; active=true; saved={ min:ctl.minDistance, pos:cam.position.clone(), tgt:ctl.target.clone() }; ctl.minDistance=0.3; build(); showStations(true);
    const k=cur||list[Math.max(0,app.vestiaire?.open??0)]?.parts[0]||'chaussures'; dress(k); }
  function leave(){ if(!active) return; active=false; stopDemo(); clearTimeout(dressT); cur=null; model.hideAvatar(); showStations(false); move=null;
    if(saved){ ctl.minDistance=saved.min; } stage.dirty(); }

  return { enter, leave, dress, play, stopDemo, tick, bruitEtat, freeze:t=>{ fixedT=t; }, get active(){ return active; }, get demo(){ return demo; },
    extra:(f)=>{ const k=f.parts[0]; if(!DEMOS[k]) return `<button type="button" class="toggle mini" data-vk="${k}" data-vd="voir">Voir sur l'élève</button>`;
      const B=DANGER.has(k)? BTN_D : BTN; return `<button type="button" class="toggle mini vd-sans" data-vk="${k}" data-vd="sans">${B.sans}</button><button type="button" class="toggle mini vd-avec" data-vk="${k}" data-vd="avec">${B.avec}</button>`; } };
}
