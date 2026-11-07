/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Le « vestiaire » des risques généraux (demandé par l'enseignant le 06/11/2026 ; prototype de 3 démonstrations validé
   le même jour : « ça a l'air top, on peut y aller comme ça ») : l'élève (l'avatar du scénario « EPI ») enfile chaque
   équipement dans l'allée, la caméra vient dessus ; chaque fiche (data/vestiaire.txt, lecture obligatoire :
   engine/fiches.js) montre une démonstration « sans protection » puis « avec protection ».
   Mise en scène (demande : « ne pas gâcher les personnages par une animation bon marché ») : cadrage serré, horloge
   réelle, ralenti au moment clé, le tour de l'image qui s'assombrit (vignette), son ; sans protection, la scène
   s'ARRÊTE juste avant le contact (cercle ou anneau rouge, conséquence en une phrase, jamais de blessure montrée) ;
   avec, elle va au bout. Les vraies toupie et raboteuse des simulateurs (buildModel, comme la page atelier) remplacent
   leurs modèles simplifiés pendant le vestiaire ; un établi est posé à côté de l'élève pour les autres scènes.
   Démonstrations : casque (raboteuse, son, sonomètre), lunettes (éclat), écharpe, cheveux, sweat et tenue, bracelet,
   gants à la toupie (happés par l'outil), chaussures (planche qui tombe), FFP2 (poussière de ponçage), demi-masque
   (vapeurs de vernis), gants de manutention (écharde), gants chimiques (goutte de vernis). */
import * as THREE from 'three';
import { setEpi, setPose, POSES, reperes, placerObjets, setCibles } from './figures.js';
import { buildModel as toupieModel } from '../toupie/model.js';
import { st as tst } from '../toupie/state.js';
import { buildModel as rabotModel } from '../raboteuse/model.js';
import { st as rst, tableY as rTableY } from '../raboteuse/state.js';
import { BRUIT as RBRUIT } from '../raboteuse/constants.js';

const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const ease=t=>t<0? 0 : t>1? 1 : t*t*(3-2*t);
const clamp01=t=>t<0? 0 : t>1? 1 : t;
/* équipements : code de la fiche → codes d'EPI de l'avatar (figures.js) */
const EQUIP=['chaussures','tenue','lunettes','auditif','masque','masque_a','gants_manut','gants_chim'];
const BASE=['tenue','chaussures'];
/* démonstration de chaque fiche ; « happe » = un objet qui pend ou dépasse approche de l'outil de la toupie */
const DEMOS={ auditif:'bruit', lunettes:'eclat', echarpe:'happe', cheveux:'happe', sweat:'happe', tenue:'happe', bijoux:'happe',
  chaussures:'chute', masque:'poussiere', masque_a:'vapeur', gants_manut:'echarde', gants_chim:'goutte' };
const BTN={ sans:'▶ Voir sans protection', avec:'▶ Voir avec protection', toupie:'▶ Gants près d\'un outil qui tourne' },
  BTN_D={ sans:'▶ Voir le danger', avec:'▶ Voir la bonne tenue' };
const DANGER=new Set(['echarpe','bijoux','cheveux','sweat']);   // fiches « Ce qui est dangereux » : la fiche montre le danger

/* textes des cartes de conclusion : [titre, texte] sans protection (ko) et avec (ok) */
const TXT={
  echarpe:{ ko:['L\'écharpe va être happée par l\'outil','À quelques centimètres de l\'outil qui tourne à des milliers de tours par minute : en une fraction de seconde, l\'outil enroulerait l\'écharpe et entraînerait le cou vers la machine. Personne n\'a le temps de réagir : on retire écharpe, foulard et cordons AVANT d\'entrer à l\'atelier.'],
    ok:['Sans écharpe : rien ne pend près de l\'outil','Tenue fermée et ajustée, écharpe retirée, cheveux attachés : même penché au-dessus de la table, rien ne peut être happé par l\'outil qui tourne.'] },
  cheveux:{ ko:['Les cheveux vont être happés par l\'outil','Penchée pour regarder la coupe, les cheveux détachés tombent vers l\'outil. Happés, ils sont enroulés en une fraction de seconde : arrachement du cuir chevelu (scalp).'],
    ok:['Cheveux attachés : rien ne tombe vers l\'outil','Queue de cheval ou chignon, rentrés dans le col si besoin : les cheveux restent loin de l\'outil, même penché au-dessus de la table.'] },
  sweat:{ ko:['Le sweat ouvert va être happé','Ouvert et large, le sweat flotte au-dessus de la table : l\'outil qui tourne peut l\'accrocher et entraîner le buste vers la machine.'],
    ok:['Vêtement de travail fermé : rien ne flotte','Fermé et ajusté, le vêtement de travail reste plaqué contre le corps : rien ne peut être accroché par l\'outil.'] },
  tenue:{ ko:['Sans vêtement de travail : le sweat flotte vers l\'outil','Un sweat ouvert ou un vêtement large flotte près des machines et peut être happé par un outil qui tourne. Il ne protège pas non plus des échardes ni des arêtes vives.'],
    ok:['Avec le vêtement de travail : rien ne flotte','Fermé jusqu\'en haut, manches boutonnées aux poignets : rien ne pend près de l\'outil, et la peau est protégée des échardes.'] },
  bijoux:{ ko:['Le bracelet va s\'accrocher à l\'outil','Un bracelet ou une bague accroché par l\'outil ou par une pièce entraîne la main en une fraction de seconde : doigt arraché, poignet broyé.'],
    ok:['Sans bracelet ni bague, la main reste loin de l\'outil','Bijoux et montre rangés dans le casier. Et la main ne s\'approche jamais de l\'outil : en fin de passe, on pousse la pièce au poussoir.'] },
  toupie:{ ko:['Le gant va être happé par l\'outil','Le gant accroché par l\'outil tire la main avec lui : c\'est l\'accident le plus grave à la toupie. Près d\'un outil qui tourne (toupie, scies, dégauchisseuse, perceuse), JAMAIS de gants.'] },
  chaussures:{ ko:['Sans chaussures de sécurité : la planche tombe sur le pied','Une planche ou un panneau qui glisse des mains tombe sur le pied : la basket ne protège de rien. Écrasement des orteils, fractures.'],
    ok:['Avec les chaussures de sécurité : l\'embout protège','L\'embout de la chaussure de sécurité résiste à un choc de 200 joules : la planche rebondit, le pied est protégé.'] },
  masque:{ ko:['Sans masque : la poussière fine est respirée','Les poussières les plus fines ne se voient presque pas et vont jusqu\'au fond des poumons. Les poussières de bois sont cancérogènes (cancer des fosses nasales) : aspiration ET masque FFP2 au ponçage.'],
    ok:['Avec le FFP2 : la poussière est arrêtée','Bien pincé sur le nez, le masque FFP2 filtre les poussières fines. Jetable : un poste de travail au plus, et jamais avec une barbe (pas étanche).'] },
  masque_a:{ ko:['Avec un FFP2 : les vapeurs de vernis passent','Le masque FFP2 arrête les poussières, PAS les vapeurs de solvants : elles passent à travers le filtre et vont aux poumons et au cerveau (maux de tête, vertiges, atteinte du système nerveux).'],
    ok:['Avec le demi-masque à cartouches : les vapeurs sont retenues','Les cartouches « A » (bande marron) retiennent les vapeurs organiques des vernis, teintes et colles. Cartouches à la date, changées comme le dit la notice.'] },
  gants_manut:{ ko:['Sans gants : l\'écharde entre dans la main','En portant une planche brute, une écharde ou une arête vive entre dans la main : coupure, infection.'],
    ok:['Avec les gants de manutention : la main est protégée','Les gants de manutention (EN 388) arrêtent échardes et arêtes vives. Machines arrêtées seulement : jamais près d\'un outil qui tourne.'] },
  gants_chim:{ ko:['Sans gants : le vernis tombe sur la peau','Solvants et produits de finition traversent la peau : brûlures, eczéma, et le produit passe dans le sang.'],
    ok:['Avec les gants nitrile : la peau est protégée','Le gant arrête le produit (le bon matériau d\'après la fiche de données de sécurité). Il se jette après usage, retiré sans toucher l\'extérieur.'] },
};

export function createVestiaire({ app, model, stage, list }){
  const root=stage.root, P=()=>av.userData.P, cam=stage.camera, ctl=stage.controls;
  const $=id=>document.getElementById(id);
  let av=model.avatar;                              // l'élève de la fiche en cours (place())
  let active=false, cur=null, demo=null, built=false, T=null, R=null, B=null, fixedT=null, lastNow=null;
  const lastLh={};                                  // position atteinte « sans protection » : rejouée « avec »

  /* ---------- toupie et raboteuse des simulateurs, à la place des modèles simplifiés (construites au premier besoin) ---------- */
  function station(L, build, rest){ const g=new THREE.Group(); root.add(g); const pm=new Proxy({},{ get:(t,k)=>t[k]||(t[k]=[]) });
    const m=build({ root:g, tagPart:o=>o, partMeshes:pm }); rest(m);
    const strip=()=>g.traverse(o=>{ delete o.userData.part; });      // pas de nomenclature ni de clic sur ces modèles
    strip(); g.updateMatrixWorld(true);
    const c=new THREE.Box3().setFromObject(g).getCenter(V3()); const yaw=-L.rot*Math.PI/180;
    g.rotation.y=yaw; const off=c.clone().setY(0).applyAxisAngle(V3(0,1,0),yaw); g.position.set(L.x-off.x,0,L.z-off.z); g.visible=false;
    return { g, m, yaw, strip, w:(x,y,z)=>g.localToWorld(V3(x,y,z)) }; }
  const std=(c,o={})=>new THREE.MeshStandardMaterial({ color:c, roughness:.75, metalness:0, ...o });
  const mesh=(g,m)=>{ const o=new THREE.Mesh(g,m); o.castShadow=true; o.receiveShadow=true; return o; };
  /* texture de bois (fil) pour l'établi et les planches */
  function woodMat(base,dark){ const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d'); g.fillStyle=base; g.fillRect(0,0,256,64);
    for(let i=0;i<46;i++){ g.strokeStyle=dark; g.globalAlpha=0.08+Math.random()*0.12; g.lineWidth=0.6+Math.random()*1.4; const y=Math.random()*64; g.beginPath(); g.moveTo(0,y);
      for(let x=0;x<=256;x+=16) g.lineTo(x,y+Math.sin(x/40+i)*2.2); g.stroke(); }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; return std(0xffffff,{ map:t, roughness:.7 }); }
  /* nuage de particules (poussière, vapeurs) : sprites ronds et doux */
  function softTex(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'), r=g.createRadialGradient(32,32,0,32,32,32);
    r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(0.4,'rgba(255,255,255,.5)'); r.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=r; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }
  function cloud(n,size,color,opacity){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
    const p=new THREE.Points(g,new THREE.PointsMaterial({ size, map:softTex(), color, transparent:true, opacity, depthWrite:false, sizeAttenuation:true }));
    p.frustumCulled=false; p.visible=false; p.userData.seed=Array.from({ length:n },()=>[Math.random(),Math.random(),Math.random(),Math.random()]); root.add(p); return p; }

  function build(){ if(built) return; built=true;
    tst.motor=false; tst.dir=1; T=station(model.DEC.toupie.L, toupieModel, m=>m.update(()=>0,()=>0,null));
    rst.motor=false; rst.feed=false; rst.H=28; R=station(model.DEC.rabot.L, rabotModel, m=>m.update(()=>0));
    const wood=woodMat('#d2a76b','#7a5428'), woodL=woodMat('#e3c497','#9b7546');
    /* planche qui entre dans la raboteuse (démonstration du bruit) */
    R.plank=mesh(new THREE.BoxGeometry(0.9,0.030,0.14),wood); R.g.add(R.plank); R.plank.visible=false;
    /* éclat de bois (démonstration des lunettes) : un copeau irrégulier */
    const eg=new THREE.BoxGeometry(0.03,0.005,0.016,3,1,2), p=eg.attributes.position;
    for(let i=0;i<p.count;i++){ p.setX(i,p.getX(i)*(0.8+Math.random()*0.4)); p.setZ(i,p.getZ(i)*(0.7+Math.random()*0.6)); p.setY(i,p.getY(i)+Math.sin(p.getX(i)*300)*0.0008); }
    eg.computeVertexNormals();
    T.chip=new THREE.Mesh(eg,std(0xe2bd84,{ roughness:.7, emissive:0x3a2a10 })); T.chip.visible=false; root.add(T.chip);
    T.trail=new THREE.Mesh(new THREE.PlaneGeometry(1,0.004),new THREE.MeshBasicMaterial({ color:0xf3e4c4, transparent:true, opacity:.35, depthWrite:false, side:THREE.DoubleSide })); T.trail.visible=false; root.add(T.trail);
    /* repère du point d'arrivée (cercle fin face à la caméra : rouge sans protection, vert avec) */
    T.mark=new THREE.Mesh(new THREE.TorusGeometry(0.03,0.0018,6,40),new THREE.MeshBasicMaterial({ color:0xd0201c, transparent:true, opacity:0, depthTest:false, toneMapped:false }));
    T.mark.renderOrder=5; root.add(T.mark);
    /* anneau rouge discret autour de l'outil, au moment du danger */
    T.halo=new THREE.Mesh(new THREE.TorusGeometry(0.085,0.004,8,48),new THREE.MeshBasicMaterial({ color:0xd0201c, transparent:true, opacity:0, depthWrite:false, toneMapped:false }));
    T.halo.rotation.x=Math.PI/2; T.g.add(T.halo); T.halo.position.set(0,0.93,0);
    /* établi de démonstration, devant l'élève (allée), avec ses accessoires */
    B={ g:new THREE.Group() }; root.add(B.g); B.g.visible=false;
    const top=mesh(new THREE.BoxGeometry(1.4,0.06,0.62),wood); top.position.set(0,0.85,0); B.g.add(top);
    for(const [x,z] of [[-0.62,-0.25],[0.62,-0.25],[-0.62,0.25],[0.62,0.25]]){ const l=mesh(new THREE.BoxGeometry(0.07,0.82,0.07),wood); l.position.set(x,0.41,z); B.g.add(l); }
    const rail=mesh(new THREE.BoxGeometry(1.24,0.06,0.04),wood); rail.position.set(0,0.2,0.25); B.g.add(rail); const rail2=rail.clone(); rail2.position.z=-0.25; B.g.add(rail2);
    B.board=mesh(new THREE.BoxGeometry(0.9,0.022,0.22),woodL); B.board.visible=false; root.add(B.board);          // planche (chute, écharde)
    B.panel=mesh(new THREE.BoxGeometry(0.6,0.019,0.4),woodL); B.panel.visible=false; B.g.add(B.panel);         // panneau à poncer
    /* ponceuse orbitale */
    B.sander=new THREE.Group(); B.g.add(B.sander); B.sander.visible=false;
    { const base=mesh(new THREE.CylinderGeometry(0.075,0.075,0.03,32),std(0x2b2f33)); base.position.y=0.015; B.sander.add(base);
      const body=mesh(new THREE.CylinderGeometry(0.05,0.065,0.07,24),std(0x2e7d32,{ roughness:.5 })); body.position.y=0.065; B.sander.add(body);
      const hd=mesh(new THREE.BoxGeometry(0.06,0.05,0.16),std(0x2e7d32,{ roughness:.5 })); hd.position.set(0,0.12,-0.02); B.sander.add(hd);
      const hose=mesh(new THREE.CylinderGeometry(0.018,0.018,0.5,12),std(0x1d1f22)); hose.rotation.z=Math.PI/2.4; hose.position.set(0.22,0.08,0); B.sander.add(hose); }
    /* pot de vernis et pinceau */
    B.pot=new THREE.Group(); B.g.add(B.pot); B.pot.visible=false;
    { const can=mesh(new THREE.CylinderGeometry(0.06,0.06,0.12,28,1,true),std(0xb9c0c6,{ metalness:.7, roughness:.35, side:THREE.DoubleSide })); can.position.y=0.06; B.pot.add(can);
      const liq=mesh(new THREE.CircleGeometry(0.058,28),std(0x8a4b16,{ roughness:.15 })); liq.rotation.x=-Math.PI/2; liq.position.y=0.105; B.pot.add(liq);
      const lab=mesh(new THREE.CylinderGeometry(0.061,0.061,0.06,28,1,true),std(0xe8c22c)); lab.position.y=0.05; B.pot.add(lab); }
    /* pinceau plat (demandé par l'enseignant le 07/11/2026 : « soigner le pinceau et la goutte ») : manche tourné en
       hêtre verni (tour), virole en fer-blanc sertie, touffe de soies noires effilée, bout chargé de vernis brillant */
    const vernis=new THREE.MeshPhysicalMaterial({ color:0x7a3a0c, roughness:.06, metalness:0, clearcoat:1, clearcoatRoughness:.04, transparent:true, opacity:.93 });
    B.brush=new THREE.Group(); B.brush.visible=false; root.add(B.brush);
    { const prof=[[0,0.200],[0.0045,0.199],[0.0062,0.193],[0.0058,0.180],[0.0050,0.150],[0.0056,0.120],[0.0072,0.085],[0.0082,0.060],[0.0078,0.050],[0.0090,0.046],[0.0090,0.040],[0.0072,0.036],[0.0066,0.030]].map(([r,y])=>new THREE.Vector2(r,y));
      const h=mesh(new THREE.LatheGeometry(prof,24),std(0xc8894a,{ roughness:.35 })); B.brush.add(h);
      const ferr=mesh(new THREE.CylinderGeometry(0.0072,0.0088,0.032,28,1,false),new THREE.MeshStandardMaterial({ color:0xc9ced3, metalness:.85, roughness:.28 })); ferr.scale.set(2.3,1,0.85); ferr.position.y=0.016; B.brush.add(ferr);
      for(const y of [0.024,0.010]){ const sl=mesh(new THREE.TorusGeometry(0.0088,0.0008,6,28),new THREE.MeshStandardMaterial({ color:0x9aa1a7, metalness:.9, roughness:.3 })); sl.rotation.x=Math.PI/2; sl.scale.set(2.3,0.85,1); sl.position.y=y; B.brush.add(sl); }
      /* soies : boîte découpée, effilée vers le bout, légèrement irrégulière */
      const sg=new THREE.BoxGeometry(0.036,0.044,0.0135,10,8,3), p=sg.attributes.position;
      for(let i=0;i<p.count;i++){ const y=p.getY(i), k=(0.022-y)/0.044; p.setX(i,p.getX(i)*(1-0.10*k)+Math.sin(p.getX(i)*900)*0.0003*k); p.setZ(i,p.getZ(i)*(1-0.55*k*k)); if(y<-0.02) p.setY(i,y+Math.cos(p.getX(i)*160)*0.0012); }
      sg.computeVertexNormals(); const so=mesh(sg,std(0x1d1a17,{ roughness:.55 })); so.position.y=-0.022; B.brush.add(so);
      /* bout chargé de vernis : même forme, un peu plus large, sur le bas des soies */
      const vg=sg.clone(), q=vg.attributes.position; for(let i=0;i<q.count;i++){ const y=q.getY(i); q.setX(i,q.getX(i)*1.04); q.setZ(i,q.getZ(i)*1.12+0.0002); if(y>-0.004) q.setY(i,-0.004); }
      vg.computeVertexNormals(); const vo=mesh(vg,vernis); vo.position.y=-0.022; B.brush.add(vo); B.brushTip=V3(0,-0.045,0); }
    /* goutte de vernis : se forme au bout des soies (s'allonge), tombe en s'étirant, s'écrase et s'étale en flaque brillante */
    B.drop=mesh(new THREE.SphereGeometry(0.0055,20,14),vernis); B.drop.visible=false; root.add(B.drop);
    { const fg=new THREE.SphereGeometry(1,40,10,0,Math.PI*2,0,Math.PI/2), p=fg.attributes.position;
      for(let i=0;i<p.count;i++){ const x=p.getX(i), z=p.getZ(i), a=Math.atan2(z,x), r=1+0.10*Math.sin(3*a+0.6)+0.06*Math.sin(7*a+1.9); p.setX(i,x*r); p.setZ(i,z*r); }
      fg.computeVertexNormals(); B.splat=mesh(fg,vernis); B.splat.visible=false; root.add(B.splat); }
    /* écharde : une fine esquille qui dépasse du chant de la planche */
    B.spl=mesh(new THREE.ConeGeometry(0.0022,0.04,6),std(0xc49a62)); B.spl.visible=false; root.add(B.spl);
    model.addAppui?.(T.g); model.addAppui?.(R.g); model.addAppui?.(B.g);   // les mains de l'élève se posent sur ces plateaux (figures.js)
    B.dust=cloud(420,0.012,0xeadfc6,0.55); B.vap=cloud(110,0.10,0xa9bccb,0.3);
    stage.dirty(); }
  function showStations(on){ if(!built) return; T.g.visible=on; R.g.visible=on; B.g.visible=on; model.DEC.toupie.g.visible=!on; model.DEC.rabot.g.visible=!on; stage.dirty(); }

  /* ---------- l'élève dans l'allée jaune, établi devant lui ---------- */
  const HOME={ x:-2.6, z:-5.5, ry:Math.PI/2 };     // dans l'allée jaune devant la corroyeuse, tourné le long de l'allée (vers +X)
  const BENCH={ x:HOME.x+0.62, z:HOME.z };          // établi de démonstration (pas dans le champ des fiches : écarté pendant l'habillage)
  function place(x,z,ry,o){ model.placeAvatar(x,z,ry,o); av=model.avatar; }
  /* élève de chaque fiche (répartition validée par l'enseignant le 07/11/2026 : trois élèves, quatre fiches chacun) */
  const QUI={ lunettes:'fille', masque_a:'fille', cheveux:'fille', sweat:'fille', chaussures:'garcon', masque:'garcon', gants_chim:'garcon', bijoux:'garcon',
    tenue:'noir', auditif:'noir', gants_manut:'noir', echarpe:'noir' };
  const outfit=(k,on)=>{ const e=new Set(BASE); let hair='attache', echarpe=false, bijoux=false;
    if(EQUIP.includes(k)){ if(on) e.add(k); else e.delete(k); }
    if(k==='echarpe') echarpe=on; if(k==='bijoux') bijoux=on; if(k==='cheveux' && on) hair='long'; if(k==='sweat' && on){ e.delete('tenue'); e.delete('chaussures'); }   // sweat ouvert, baskets, queue de cheval : version Meshy fille_mq
    return { eleve:QUI[k]||'fille', epi:[...e], hair, echarpe, bijoux }; };

  /* ---------- caméra : glissement doux vers un cadrage (horloge réelle) ---------- */
  let move=null;
  function camTo(pos,tgt,dur=1.1){ move={ p0:cam.position.clone(), t0:ctl.target.clone(), p1:pos.clone(), t1:tgt.clone(), s:performance.now()/1000, d:dur }; }
  const bone=n=>P().B[n].getWorldPosition(V3());
  /* point de vue à `dist` du point visé, décalé de `side` radians de la direction regardée par l'élève, à la hauteur `dy` */
  function around(tgt,side,dist,dy){ const a=av.rotation.y+side; return V3(tgt.x+Math.sin(a)*dist, tgt.y+dy, tgt.z+Math.cos(a)*dist); }
  /* caméra de côté : perpendiculaire au segment a → b, du côté `side` (vecteur), à `d` m, relevée de `h` */
  function sideCam(a,b,d,h,side){ const mid=a.clone().add(b).multiplyScalar(0.5), dir=b.clone().sub(a).setY(0); if(dir.lengthSq()<1e-6) dir.set(1,0,0); dir.normalize();
    const perp=V3(-dir.z,0,dir.x), left=side||T.w(-1,0,0).sub(T.w(0,0,0)); if(perp.dot(left)<0) perp.negate(); return { pos:mid.clone().addScaledVector(perp,d).add(V3(0,h,0)), tgt:mid }; }
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
  function dress(k){ stopDemo(); cur=k; const d=DANGER.has(k); if(built) B.g.visible=false;
    place(HOME.x,HOME.z,HOME.ry,{ ...outfit(k, d), pose:k==='gants_manut'||k==='gants_chim'? 'machine' : 'debout' });
    if(!d){ setEpi(av,outfit(k,false)); clearTimeout(dressT); dressT=setTimeout(()=>{ if(cur===k && !demo) setEpi(av,outfit(k,true)); stage.dirty(); },650); }
    const f=list.find(x=>x.parts[0]===k), info=$('info'); if(info&&f) info.innerHTML=`<b>Vestiaire · ${f.t}</b><span>${DANGER.has(k)? 'Ce qui est dangereux à l\'atelier' : 'L\'élève l\'enfile'} : faites tourner et zoomez pour bien voir.</span>`;
    frameFor(k); stage.dirty(); }

  /* ---------- vignette et carte de la démonstration (sur la vue 3D) ---------- */
  const stageEl=document.querySelector('.stage');
  const vig=document.createElement('div'); vig.className='vvig'; vig.setAttribute('aria-hidden','true'); stageEl.appendChild(vig);
  const card=document.createElement('div'); card.className='vcard'; card.id='vcard'; card.hidden=true; card.setAttribute('role','status'); stageEl.appendChild(card);
  function showCard(level,title,text,k,mode){ const Bt=DANGER.has(k)? BTN_D : BTN;
    const others= mode==='toupie'? [] : [mode==='sans'? 'avec' : 'sans'];
    card.dataset.l=level; card.hidden=false;
    card.innerHTML=`<b>${title}</b><p>${text}</p><div class="vbtns"><button type="button" class="toggle mini" data-vd="${mode}">↻ Rejouer</button>${others.map(o=>`<button type="button" class="toggle mini" data-vd="${o}">${Bt[o]}</button>`).join('')}<button type="button" class="toggle mini" data-vd="x">Fermer</button></div>`;
    card.querySelectorAll('[data-vd]').forEach(b=>b.onclick=()=>{ const v=b.dataset.vd; if(v==='x'){ stopDemo(); dress(k); } else play(k,v); }); }
  function setVig(l){ vig.dataset.l=l||''; }

  /* ---------- démonstrations ---------- */
  function stopDemo(){ if(!demo) return; if(demo.cheveux){ demo.cheveux.m.material=demo.cheveux.mat0; } demo=null; card.hidden=true; setVig('');
    tst.motor=false; rst.motor=false; rst.feed=false; if(app.bruit) app.bruit.casque=false;
    av.userData.P.cibles=null;
    if(built){ for(const o of [T.chip,T.trail,R.plank,B.board,B.panel,B.sander,B.pot,B.brush,B.drop,B.splat,B.spl,B.dust,B.vap]) o.visible=false;
      if(B.brush.parent!==root) root.attach(B.brush);
      T.halo.material.opacity=0; T.mark.material.opacity=0; POSES.vest={ ...POSES.machine }; placerObjets(av); tst.prot=true; T.m.update(()=>0,()=>0,null); T.strip(); }
    const s=$('sono'); if(s) s.hidden=true; const info=$('info'); if(info) info.style.visibility=''; stage.dirty(); }

  /* l'élève à l'établi (dans l'allée) : établi devant lui, pose « machine » (mains sur le plan de travail) */
  function atBench(o){ B.g.position.set(BENCH.x+0.08,0,BENCH.z); B.g.rotation.y=Math.PI/2; B.g.visible=true; place(HOME.x,HOME.z,HOME.ry,{ ...o, pose:'machine' }); av.updateMatrixWorld(true); }
  const benchW=(x,y,z)=>B.g.localToWorld(V3(x,y,z));       // repère de l'établi : X le long, Z en travers (−Z vers l'élève)

  function play(k,mode){ build(); showStations(true); stopDemo(); clearTimeout(dressT); av.userData.P.cibles=null;
    const on=mode==='avec', kind=mode==='toupie'? 'happe' : DEMOS[k]; demo={ k, mode, kind, key:mode==='toupie'? 'toupie' : k, t0:performance.now()/1000, end:false };
    card.hidden=true; setVig('dim'); B.g.visible=false;
    if(kind==='bruit'){
      /* l'élève à l'entrée de la raboteuse (côté +X du modèle), face à la machine, DERRIÈRE la planche posée sur la
         rallonge d'entrée (bout de la rallonge en x = 0,90) : il la pousse les mains dessus, puis pose les mains sur la
         rallonge quand elle est engagée (corrigé le 07/11/2026 : la planche traversait l'élève, mains sous la table) */
      const o=R.w(1.32,0,0); place(o.x,o.z,R.yaw-Math.PI/2,{ ...outfit('auditif',on), pose:'machine' });
      if(app.bruit) app.bruit.casque=on;
      rst.motor=true; rst.feed=false; R.plank.visible=false;
      const h=bone('Head'), m=R.w(0.2,1.0,0); camTo(around(h.clone().lerp(m,0.4),2.2,1.6,0.25), h.clone().lerp(m,0.45), 1.4);
      const s=$('sono'); if(s) s.hidden=false; }
    else if(kind==='eclat'||kind==='happe'){ /* toupie : l'élève à son poste, ventre contre la table (+Z du modèle, bord avant en z = 0,34), face au guide */
      const o=T.w(0.0,0,kind==='happe'? 0.50 : 0.56);
      /* tenue « sans » de chaque scène : ce qui pend (écharpe, cheveux, sweat, bracelet) ou les gants */
      const look= mode==='toupie'? { ...outfit('gants_manut',true) } : DANGER.has(k)? outfit(k,!on) : k==='tenue'? outfit('tenue',on) : outfit(k,on);
      place(o.x,o.z,T.yaw+Math.PI,{ ...look, pose:'machine' });
      tst.motor=true; tst.dir=1; tst.prot=kind!=='happe'; tst.tool='moulure'; tst.zIn=60; tst.h=0; T.m.update(()=>0,()=>0,null); T.strip();
      demo.P=T.w(0,0.90,0.072);                                                  // l'outil, dans la lumière du guide
      if(kind==='eclat'){ /* point visé : l'œil droit de l'élève (repères du visage, repère du personnage au repos) */
        setPose(av,'debout'); av.updateMatrixWorld(true); const r=reperes(av), inner=P().inner, head=P().B.Head;
        demo.eyeL=head.worldToLocal(inner.localToWorld(V3(-0.032,r.oeil_y,r.oeil_z)));
        demo.fwdL=head.worldToLocal(inner.localToWorld(V3(-0.032,r.oeil_y,r.oeil_z+1))).sub(demo.eyeL).normalize();
        setPose(av,'machine'); av.updateMatrixWorld(true);
        const eye=head.localToWorld(demo.eyeL.clone()); demo.from=T.w(0.02,0.905,0.085);
        const c=sideCam(eye,demo.from,1.25,0.10); camTo(c.pos,c.tgt.clone().lerp(eye,0.18),1.2); }
      else { demo.sc0=null; demo.reach= k==='bijoux' || mode==='toupie'; POSES.vest={ ...POSES.machine }; setPose(av,'vest');
        if(k==='cheveux' && !on){ const m=Object.entries(P().L).find(([n,o])=>n.endsWith('|tete') && o.visible)?.[1]; if(m) demo.cheveux=cheveuxPendants(m); }
        const a= demo.reach? bone('RightHand') : bone('Head'), c=sideCam(a,demo.P,demo.reach? 0.95 : 1.15,demo.reach? 0.25 : 0.1, demo.reach? T.w(1,0,0).sub(T.w(0,0,0)) : null);   // la main droite : vue du côté droit de l'élève
        if(k==='bijoux') camTo(T.w(0.55,1.50,0.45),T.w(0.0,0.90,0.09),1.2);   /* bracelet : de haut, côté droit de l'élève : la main le long du guide et l'outil dans la lumière */ else if(demo.reach) camTo(T.w(1.05,1.75,-0.15),T.w(0.0,0.95,0.25),1.2);   /* de l'autre côté de la table, au-dessus du guide : on voit la main et l'outil */ else camTo(c.pos,c.tgt.clone().lerp(demo.P,0.2),1.2); } }
    else if(kind==='chute'){ /* l'élève porte une planche EN TRAVERS devant lui, une main à chaque bout (corrigé le 07/11/2026 :
         elle traversait l'élève) ; elle glisse des mains et tombe à plat sur la pointe des pieds */
      const fwd=V3(Math.sin(HOME.ry),0,Math.cos(HOME.ry)), left=V3(Math.cos(HOME.ry),0,-Math.sin(HOME.ry));
      const ch=V3(HOME.x,0.80,HOME.z).addScaledVector(fwd,0.30);                  // centre de la planche, devant la taille
      place(HOME.x,HOME.z,HOME.ry,{ ...outfit('chaussures',on), pose:'machine' });
      P().cibles={ G:ch.clone().addScaledVector(left,0.21), D:ch.clone().addScaledVector(left,-0.21) }; setPose(av,'machine'); av.updateMatrixWorld(true);
      demo.h0=ch.clone().add(V3(0,-0.012,0));        // dessus de la planche sous les paumes
      const fR=bone('RightFoot'), fL=bone('LeftFoot'); demo.toe=fR.clone().addScaledVector(fwd,0.13).setY(0.115);
      demo.toes=fR.clone().add(fL).multiplyScalar(0.5).addScaledVector(fwd,0.14); demo.left=left;
      demo.fwd=fwd; B.board.visible=true; B.board.position.copy(demo.h0); B.board.rotation.set(0,HOME.ry,0);
      const c=sideCam(demo.toe,demo.h0,1.35,0.05,V3(Math.cos(av.rotation.y),0,-Math.sin(av.rotation.y)).negate()); camTo(c.pos,c.tgt.clone().lerp(demo.toe,0.3),1.2); }
    else if(kind==='poussiere'){ /* ponçage d'un panneau sur l'établi, ponceuse raccordée mais poussière fine qui monte vers le visage */
      atBench({ ...outfit('masque',on) }); B.panel.visible=true; B.panel.position.set(0,0.89,-0.08); B.sander.visible=true; B.sander.position.set(0,0.9,-0.08);
      setCibles(av,{ D:benchW(0,1.0,-0.10) });                                       // main droite sur la ponceuse
      demo.src=benchW(0,0.93,-0.08); demo.mouth=mouthW(); B.dust.visible=true;
      const c=sideCam(demo.mouth,demo.src,0.95,0.12,V3(Math.cos(av.rotation.y),0,-Math.sin(av.rotation.y)).negate()); camTo(c.pos,c.tgt.clone().lerp(demo.mouth,0.35),1.2); }
    else if(kind==='vapeur'){ /* vernis au pinceau : vapeurs qui montent du pot ; sans = FFP2 (inefficace), avec = demi-masque */
      const o=outfit('masque_a',on); if(!on) o.epi.push('masque'); atBench(o); B.pot.visible=true; B.pot.position.set(0.05,0.88,-0.1);
      demo.src=benchW(0.05,1.0,-0.1); demo.mouth=mouthW(); B.vap.visible=true;
      const c=sideCam(demo.mouth,demo.src,1.0,0.1,V3(Math.cos(av.rotation.y),0,-Math.sin(av.rotation.y)).negate()); camTo(c.pos,c.tgt.clone().lerp(demo.mouth,0.35),1.2); }
    else if(kind==='goutte'){ /* le pinceau chargé de vernis, au-dessus de la main gauche posée sur l'établi : une goutte tombe */
      atBench({ ...outfit('gants_chim',on) }); B.pot.visible=true; B.pot.position.set(0.32,0.88,-0.05);
      const G=benchW(0.16,0.882,-0.17); setCibles(av,{ G }); av.updateMatrixWorld(true);     // main gauche à plat sur l'établi
      const hand=bone('LeftHand'), up=V3(0,1,0); demo.hand=hand.clone().add(V3(0,0.035,0));
      /* point d'impact : le dessus de la main (ou du gant) gauche, au milieu du dos de la main : centre des sommets de la main
         gauche (pièce « mains » de l'élève, os LeftHand), puis le plus haut sommet à moins de 2 cm de ce centre */
      { const m=Object.entries(P().L).find(([n,o])=>n.endsWith('|mains') && o.visible)?.[1];
        if(m){ const pa=m.geometry.attributes.position, si=m.geometry.attributes.skinIndex, sw=m.geometry.attributes.skinWeight, bi=m.skeleton.bones.indexOf(P().B.LeftHand), pts=[], c=V3();
          av.updateMatrixWorld(true); m.skeleton.update();
          for(let i=0;i<pa.count;i++){ let w=0; for(let d=0;d<4;d++) if(si.getComponent(i,d)===bi) w+=sw.getComponent(i,d); if(w<0.6) continue;
            const v=m.getVertexPosition(i,V3()).applyMatrix4(m.matrixWorld); pts.push(v); c.add(v); }
          if(pts.length){ c.divideScalar(pts.length); let top=null; for(const v of pts) if(Math.hypot(v.x-c.x,v.z-c.z)<0.02 && (!top||v.y>top.y)) top=v; if(top) demo.hand=top.clone(); } } }
      B.brush.visible=true; B.brush.rotation.set(0,av.rotation.y,0.22); B.brush.position.copy(demo.hand).add(V3(0,0.16,0));
      B.brush.updateMatrixWorld(true); const tip=B.brush.localToWorld(B.brushTip.clone()); B.brush.position.add(V3(demo.hand.x-tip.x,0,demo.hand.z-tip.z));
      B.brush.updateMatrixWorld(true); demo.tip=B.brush.localToWorld(B.brushTip.clone()).add(V3(0,-0.002,0)); B.drop.visible=false;
      setCibles(av,{ G, D:B.brush.localToWorld(V3(0,0.12,0)) });                         // main droite qui tient le pinceau (manche)
      const c=sideCam(demo.hand,demo.tip,0.8,0.18,V3(Math.cos(av.rotation.y),0,-Math.sin(av.rotation.y)).negate()); camTo(c.pos,c.tgt,1.2); }
    else if(kind==='echarde'){ /* l'élève tient une planche brute par son chant : elle glisse dans la main, l'écharde vers la paume */
      place(HOME.x,HOME.z,HOME.ry,{ ...outfit('gants_manut',on), pose:'machine' }); av.updateMatrixWorld(true);
      const hR=bone('RightHand'), side=V3(Math.cos(av.rotation.y),0,-Math.sin(av.rotation.y));    // vers la gauche de l'élève
      demo.palm=P().arms[1].palm.getWorldPosition(V3()); demo.side=side;
      B.board.visible=true; B.board.rotation.set(0,av.rotation.y,0);
      demo.b0=demo.palm.clone().addScaledVector(side,0.30).add(V3(0,-0.012,0)); B.spl.visible=true;
      const c=sideCam(demo.palm,demo.palm.clone().addScaledVector(side,0.1),0.42,0.16,V3(Math.sin(av.rotation.y),0,Math.cos(av.rotation.y))); camTo(c.pos,c.tgt,1.2); }
    const info=$('info'); if(info) info.style.visibility='hidden';
    stage.dirty(); }
  /* bouche de l'élève (repères du visage), en coordonnées monde, pour la pose en cours */
  function mouthW(){ const r=reperes(av), inner=P().inner, head=P().B.Head; setPose(av,'debout'); av.updateMatrixWorld(true);
    const L=head.worldToLocal(inner.localToWorld(V3(0,(r.nez_y+r.menton)/2,r.nez_z+0.005))); setPose(av,'machine'); av.updateMatrixWorld(true); return head.localToWorld(L); }

  /* bruit : état de la raboteuse pour le sonomètre et le son (engine/audio.js) */
  function bruitEtat(){ if(!demo||demo.kind!=='bruit') return { on:false, rpm:RBRUIT.rpm, spin:R?.m.spin||0, cut:0, charge:1, dents:4 };
    return { on:rst.motor, rpm:RBRUIT.rpm, spin:R.m.spin, cut:demo.cut||0, charge:1, dents:4 }; }

  function finish(level,title,text){ if(demo.end) return; demo.end=true; setVig(level==='ko'? 'ko' : 'ok'); showCard(level,title,text,demo.k,demo.mode); }
  const conclude=(ok)=>{ const x=TXT[demo.key]?.[ok?'ok':'ko']; if(x) finish(ok?'ok':'ko',x[0],x[1]); };
  const fmtMin=L=>{ const m=480/Math.pow(2,(L-80)/3); return m<1? 'moins d\'une minute' : m<60? `${Math.round(m)} minutes` : `${Math.round(m/60)} heures`; };
  function markAt(p,ok,a){ T.mark.position.copy(p); T.mark.lookAt(cam.position); T.mark.material.color.setHex(ok? 0x2e9d4f : 0xd0201c); T.mark.material.opacity=a; }

  /* distance (m) entre un point et l'objet ou la pièce du personnage qui risque d'être happé (sommets, peau comprise) */
  const _v=V3();
  function distTo(m,Pt,step,ch){ if(!m||!m.visible||!m.geometry) return 9; const pa=m.geometry.attributes.position; let d=9;
    for(let i=0;i<pa.count;i+=step){ if(m.isSkinnedMesh) m.getVertexPosition(i,_v); else _v.fromBufferAttribute(pa,i); if(ch) pendre(ch,_v,ch.w[i]); _v.applyMatrix4(m.matrixWorld); d=Math.min(d,_v.distanceTo(Pt)); } return d; }
  /* cheveux détachés qui PENDENT (demandé le 07/11/2026 : « la tête rentre dans la machine ») : les mèches sont liées à la
     tête par Meshy et suivent sa rotation ; pendant la démonstration, chaque point de mèche tourne autour du centre de la
     tête vers le bas (poids w : 0 au-dessus des yeux et sur le visage, 1 au bout des mèches), dans le shader et ici
     (même calcul, pour la distance à l'outil) */
  const _d=V3(), _g=V3();
  function pendre(ch,p,w){ if(!w||!ch.k) return p; _d.copy(p).sub(ch.root); const l=_d.length(); if(l<1e-6) return p;
    _d.divideScalar(l); _g.copy(_d).lerp(ch.down,Math.min(1,ch.k*w)).normalize(); return p.copy(ch.root).addScaledVector(_g,l); }
  function cheveuxPendants(m){ const g=m.geometry, pa=g.attributes.position, r=reperes(av), n=pa.count, w=new Float32Array(n);
    for(let i=0;i<n;i++){ const x=pa.getX(i), y=pa.getY(i), z=pa.getZ(i); if(Math.abs(x)<0.13 && z>r.oreille_z-0.01 && y<r.oeil_y) continue;   // visage, menton
      if(z<r.oreille_z-0.04) continue;                 // mèches du dos : elles restent (sinon la veste, non modelée dessous, se voit trouée)
      w[i]=ease((r.oeil_y-y)/0.35)*ease((z-r.oreille_z+0.04)/0.06); }
    g.setAttribute('cheveu',new THREE.BufferAttribute(w,1));
    const ch={ w, k:0, root:V3(), down:V3(0,-1,0), m, mat0:m.material, u:{ uRoot:{ value:V3() }, uDown:{ value:V3(0,-1,0) }, uK:{ value:0 } } };
    const mat=m.material.clone(); mat.onBeforeCompile=sh=>{ Object.assign(sh.uniforms,ch.u);
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float cheveu; uniform vec3 uRoot; uniform vec3 uDown; uniform float uK;')
        .replace('#include <skinning_vertex>','#include <skinning_vertex>\n{ vec3 d=transformed-uRoot; float l=length(d); if(l>1e-6 && cheveu>0.0){ transformed=uRoot+normalize(mix(d/l,uDown,min(1.0,uK*cheveu)))*l; } }'); };
    mat.customProgramCacheKey=()=>'cheveux'; m.material=mat; return ch; }
  /* centre de la tête et bas du monde, dans le repère du maillage (celui du personnage) */
  function majCheveux(ch){ const inv=new THREE.Matrix4().copy(ch.m.matrixWorld).invert(), H=P().B.Head.getWorldPosition(V3()).add(V3(0,0.06,0));
    ch.root.copy(H).applyMatrix4(inv); ch.down.copy(V3(0,-1,0)).transformDirection(inv);
    ch.u.uRoot.value.copy(ch.root); ch.u.uDown.value.copy(ch.down); ch.u.uK.value=ch.k; }
  /* distance (m) entre le bracelet et le cercle de coupe de l'outil (cylindre vertical d'axe x = z = 0 dans le repère de
     la toupie, rayon 80 mm, de la table à 60 mm au-dessus) */
  function braceletOutil(){ const b=P().bracelet; if(!b||!b.visible||!b.geometry) return 9; const pa=b.geometry.attributes.position, inv=new THREE.Matrix4().copy(T.g.matrixWorld).invert(); let d=9;
    b.updateMatrixWorld(true);
    for(let i=0;i<pa.count;i+=2){ _v.fromBufferAttribute(pa,i).applyMatrix4(b.matrixWorld).applyMatrix4(inv); if(_v.y<0.85||_v.y>0.95) continue; d=Math.min(d,Math.hypot(_v.x,_v.z)-0.08); } return d; }
  /* bracelet au droit de l'outil : distance (m) qui reste à parcourir le long du guide (repère de la toupie) */
  function braceletX(){ const b=P().bracelet; if(!b||!b.visible) return 9; const inv=new THREE.Matrix4().copy(T.g.matrixWorld).invert();
    return Math.max(0,-b.getWorldPosition(V3()).applyMatrix4(inv).x); }
  /* bracelet : vue de dessus, la main droite tournée de 90° (sens anti-horaire) autour du poignet, à plat, dans sa longueur
     parallèle au guide, doigts vers la sortie (demandé par l'enseignant le 07/11/2026) */
  function longerGuide(){ const h=P().B.RightHand, tip=h.userData.tip; if(!tip) return; h.updateMatrixWorld(true);
    const w=h.getWorldPosition(V3()), d=tip.getWorldPosition(V3()).sub(w).setY(0), c=T.w(-1,0,0).sub(T.w(0,0,0)).setY(0);
    if(d.lengthSq()<1e-8) return; d.normalize(); c.normalize(); const a=Math.atan2(d.z*c.x-d.x*c.z, d.x*c.x+d.z*c.z);
    const pw=h.parent.getWorldQuaternion(new THREE.Quaternion()), R=new THREE.Quaternion().setFromAxisAngle(V3(0,1,0),a);
    h.quaternion.premultiply(pw.clone()).premultiply(R).premultiply(pw.invert()); h.updateMatrixWorld(true); }
  function happeTarget(){ const p=P(), L=p.L, vis=s=>Object.entries(L).find(([n,m])=>n.endsWith('|'+s) && m.visible)?.[1];
    if(demo.key==='echarpe') return { m:p.scarf, thr:0.05, step:3 };
    if(demo.key==='bijoux'||demo.key==='toupie') return { m:vis('mains'), thr:0.025, step:2, P:T.w(0,0.895,0.085) };   // la main, au niveau de l'outil, s'arrête à 2 – 3 cm de ses tranchants
    if(demo.key==='cheveux') return { m:vis('tete'), thr:0.06, step:3, poids:demo.cheveux };
    return { m:vis('corps'), thr:0.06, step:4 }; }

  function tick(){ const now=performance.now()/1000, dt=Math.min(0.1, lastNow==null? 0 : now-lastNow); lastNow=now;
    if(move){ const k=ease((now-move.s)/move.d); cam.position.lerpVectors(move.p0,move.p1,k); ctl.target.lerpVectors(move.t0,move.t1,k); ctl.update(); if(k>=1) move=null; stage.dirty?.(); }
    if(!built) return active;
    T.m.tick(0); R.m.tick(dt);
    if(!demo) return active;
    const t=fixedT??(now-demo.t0), on=demo.mode==='avec';
    if(demo.kind==='bruit'){
      /* la planche avance sur la rallonge d'entrée puis passe sous l'arbre (de +X vers −X) */
      const t1=1.6, v=0.18, x=0.58-(t>t1? (t-t1)*v : 0), ty=rTableY();
      R.plank.visible=true; R.plank.position.set(x,ty+0.015,0); rst.feed=t>t1;
      demo.cut= (x-0.45<0 && x+0.45>0)? 1 : 0;
      R.m.update((px)=>Math.abs(px-x)<0.45? 0.030 : 0);
      /* mains : sur le bout de la planche tant qu'elle est à portée, puis à plat sur la rallonge (gauche de l'élève = +Z) */
      const hx=x+0.45-0.08, sur=hx>0.80, X=sur? hx : 0.80, Y=sur? ty+0.030+0.012 : ty+0.012, Z=sur? 0.045 : 0.13;
      P().cibles={ G:R.w(X,Y,Z), D:R.w(X,Y,-Z) }; setPose(av,'machine');
      if(t>7.5 && !demo.end){ const c=app.bruit?.calc(), L=Math.round(c? (c.enMarche??c.total) : RBRUIT.coupe), O=on? L-25 : L;   // niveau établi au poste (celui vers lequel va le sonomètre)
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
          markAt(demo.hp,true,Math.max(0,0.9-th*0.6));
          if(th>1.1) finish('ok','Avec les lunettes : l\'éclat rebondit','Le verre des lunettes de sécurité arrête l\'éclat. Marquage EN 166 « F » : il résiste à un éclat projeté à 45 m/s. Des lunettes de vue ne protègent pas.'); }
        else { c.position.copy(end); markAt(end,false,Math.min(0.9,th*4)); if(th>0.25) finish('ko','Sans lunettes : l\'éclat atteint l\'œil','Projeté par l\'outil, l\'éclat arrive en une fraction de seconde : impossible de fermer les yeux à temps. Blessure de la cornée, jusqu\'à la perte de l\'œil.'); } } }
    else if(demo.kind==='happe'){
      /* l'élève se penche au-dessus de la table vers l'outil qui tourne (pour regarder la coupe), ou avance la main droite
         (bracelet, gants) ; ce qui pend ou dépasse approche de la lumière du guide : la scène s'arrête juste avant le contact */
      /* l'écharpe pend sous le cou (pesanteur) : elle suit le cou en translation, sans tourner avec le buste */
      const sc=P().scarf, hang=()=>{ if(!sc.visible) return; const N=bone('Neck');
        if(!demo.sc0){ demo.sc0={ Mw:sc.matrixWorld.clone(), N:N.clone() }; return; }
        const Mw=new THREE.Matrix4().makeTranslation(N.x-demo.sc0.N.x,N.y-demo.sc0.N.y,N.z-demo.sc0.N.z).multiply(demo.sc0.Mw);
        new THREE.Matrix4().copy(sc.parent.matrixWorld).invert().multiply(Mw).decompose(sc.position,sc.quaternion,sc.scale); sc.updateMatrixWorld(true); };
      const lean=demo.key==='cheveux'? 1.15 : 0.8;
      /* mains posées sur la table de la toupie, devant l'élève (gauche du personnage = −X du modèle, il regarde vers −Z) ; la main droite avance seule (bracelet, gants) */
      P().cibles={ G:T.w(-0.20,0.889,0.22), D: demo.reach? null : T.w(0.20,0.889,0.22) };   // un peu au-dessus de la table (mains épaisses)
      /* bracelet (demandé par l'enseignant le 07/11/2026) : la main droite est allée chercher la pièce côté sortie et revient
         en GLISSANT LE LONG DU GUIDE vers la lumière ; le poignet passe devant la main : c'est le bracelet qui arrive le
         premier au droit de l'outil, s'y accroche, et la main est tirée contre l'outil et dans la lumière du guide */
      const glisse=demo.key==='bijoux', xG=L=>-0.24+0.36*L;
      const pose=L=>{ if(glisse) P().cibles.D=T.w(xG(L)+(demo.tire||0)*0.03,0.889,0.05-(demo.tire||0)*0.02);
        else if(demo.reach) P().cibles.D=T.w(0.20-0.17*L,0.889,0.30-0.20*L);     // la main droite glisse à plat sur la table vers l'outil
        if(demo.cheveux) demo.cheveux.k=0.5*Math.min(1,L*2.5);                                          // les mèches tombent à mesure qu'elle se penche
        if(demo.reach) POSES.vest={ ...POSES.machine, sp:0.14+0.25*L, sh:[[-0.4,0.28],[-0.55-0.75*L,-0.04]], el:[-1.05,-0.55+0.4*L], wr:[0,0.15] };
        else POSES.vest={ ...POSES.machine, sp:0.14+lean*L, hip:0.3*L, sh:[[-0.35-0.2*L,0.28],[-0.35-0.2*L,-0.28]], el:[-1.05,-1.05] };
        setPose(av,'vest'); av.updateMatrixWorld(true); if(glisse) longerGuide(); hang(); if(demo.cheveux) majCheveux(demo.cheveux); };
      if(!demo.sc0){ pose(0); }
      const tg=happeTarget(), dist=()=>{ if(glisse) return braceletOutil(); if(demo.cheveux) majCheveux(demo.cheveux); return distTo(tg.m,tg.P||demo.P,tg.step,tg.poids); };
      if(glisse) tg.thr=0.004;
      let L=ease((t-0.8)/3.0);
      /* cheveux : la tête s'arrête AVANT le capot et le guide (corrigé le 07/11/2026 : elle y entrait) ; ce sont les mèches
         qui pendent qui approchent de l'outil */
      const stop=()=>{ if(dist()<tg.thr) return true; if(demo.reach) return false; const H=bone('Head');          // toutes les scènes où l'élève se penche (corrigé le 07/11/2026 : la tête de l'élève noir entrait dans la toupie)
        return Math.hypot(H.x-demo.P.x,H.z-demo.P.z)<0.21 || H.y<demo.P.y+0.30; };
      if(!on){ if(demo.Lh==null){ pose(L); if(stop() || L>=1){ let a=0, b=L; for(let i=0;i<9;i++){ const m=(a+b)/2; pose(m); if(stop()) b=m; else a=m; } demo.Lh=b; demo.th=t; lastLh[demo.key]=b; } }
        if(demo.Lh!=null) L=Math.min(L,demo.Lh);
        if(glisse && demo.Lh!=null) demo.tire=ease((t-demo.th)/0.45);    // accroché : la main est tirée vers l'outil et la lumière du guide
        pose(L);
        T.halo.material.opacity= demo.Lh!=null? 0.65+0.25*Math.sin(t*8) : 0;
        if(demo.Lh!=null && t>demo.th+(glisse? 1.0 : 0.5)) conclude(false); }
      else { const cap=glisse? 0.15 : demo.reach? 0.12 : (lastLh[demo.key]??0.75);   // bracelet, gants : avec la bonne tenue, la main reste loin de l'outil
        pose(Math.min(L,cap)); if(t>4.0) conclude(true); } }
    else if(demo.kind==='chute'){
      /* la planche glisse des mains (0,9 s), puis tombe au ralenti, presque à plat, en travers des deux pointes de pied ;
         la main gauche la retient un peu plus longtemps : elle penche vers le pied droit */
      const t0=0.9, dur=1.4, u=clamp01((t-t0)/dur), b=B.board;
      const stop= on? 0 : 0.035, E=demo.toe.clone().add(V3(0,0.011+stop,0)), a=0.10;
      const end=E.clone().addScaledVector(demo.left,0.45*Math.cos(a)).add(V3(0,0.45*Math.sin(a),0)).addScaledVector(demo.fwd,0.02);   // bout droit posé sur la pointe du pied droit
      const g=u*u;                                                       // chute accélérée
      b.position.lerpVectors(demo.h0,end,g); b.rotation.set(0,HOME.ry,0); b.rotateZ(a*g);
      if(t>t0 && !demo.lache){ demo.lache=true; P().cibles=null; setPose(av,'debout'); }
      if(u>=1){ const th=t-t0-dur;
        if(on){ if(!demo.hit){ demo.hit=true; app.bruit?.bang?.('coup'); } const bo=Math.max(0,Math.sin(Math.min(th,0.6)*Math.PI/0.6))*0.02; b.position.y+=bo; markAt(E,true,Math.max(0,0.9-th*0.6)); if(th>1.0) conclude(true); }
        else { markAt(demo.toe.clone().setY(demo.toe.y+0.02),false,Math.min(0.9,th*4)); if(th>0.3) conclude(false); } }
      else if(t<t0){ b.position.copy(demo.h0).add(V3(0,-0.01*clamp01(t/t0),0)); } }
    else if(demo.kind==='poussiere'||demo.kind==='vapeur'){
      /* particules : de la source vers la bouche, avec un peu de dérive ; avec le bon masque, elles s'arrêtent sur le filtre */
      const C= demo.kind==='poussiere'? B.dust : B.vap, pa=C.geometry.attributes.position, S=C.userData.seed, n=S.length;
      const vapeur=demo.kind==='vapeur', life= vapeur? 3.2 : 2.4, filt= on? 1 : 0;
      const mask=demo.mouth.clone().add(V3(Math.sin(av.rotation.y),0,Math.cos(av.rotation.y)).multiplyScalar(0.03)), up=V3(0,1,0);
      const act=clamp01((t-0.5)/1.2);                                    // la ponceuse démarre
      if(demo.kind==='poussiere'){ B.sander.position.x=Math.sin(t*22)*0.004; B.sander.position.z=-0.08+Math.cos(t*22)*0.004; }
      for(let i=0;i<n;i++){ const s=S[i], ph=((t*0.9/life)+s[0])%1, k=ph;
        const on_=i/n<act; const ctrlP=demo.src.clone().lerp(mask,0.5).add(V3((s[1]-0.5)*0.25,0.08+s[2]*0.12,(s[3]-0.5)*0.25));
        let kk=k; if(filt && kk>0.9) kk=0.9+(kk-0.9)*0.1;                   // arrêtées sur le filtre
        const p=demo.src.clone().multiplyScalar((1-kk)*(1-kk)).addScaledVector(ctrlP,2*kk*(1-kk)).addScaledVector(mask,kk*kk);
        p.x+=Math.sin(t*1.7+s[1]*9)*0.01; p.z+=Math.cos(t*1.3+s[2]*9)*0.01; if(vapeur) p.addScaledVector(up,Math.sin(t+s[3]*6)*0.01);
        if(!on_){ p.set(0,-10,0); } pa.setXYZ(i,p.x,p.y,p.z); }
      pa.needsUpdate=true; C.material.opacity=(vapeur? 0.3 : 0.55)*act;
      if(t>4.2) conclude(on); }
    else if(demo.kind==='goutte'){
      /* la goutte grossit au bout des soies en s'allongeant (1,4 s), se détache, tombe au ralenti en s'étirant ; sur la peau :
         arrêt à 1 cm (rien n'est montré) ; sur le gant : elle s'écrase et s'étale en flaque brillante qui s'élargit */
      const d=B.drop, t0=1.4, dur=0.9, u=clamp01((t-t0)/dur), r=0.0055, stop=on? r*0.9 : 0.012;
      const end=demo.hand.clone().add(V3(0,stop,0));
      if(t<t0){ const k=ease(t/t0), s=0.35+0.65*k; d.visible=true; d.scale.set(s*0.92,s*(1+0.55*k),s*0.92); d.position.copy(demo.tip).add(V3(0,-r*s*(1+0.55*k)*0.9,0)); B.splat.visible=false; }
      else if(u<1){ const v=u*u, st=1+0.6*Math.min(1,u*3); d.visible=true; d.scale.set(1/Math.sqrt(st),st,1/Math.sqrt(st)); d.position.lerpVectors(demo.tip.clone().add(V3(0,-r*1.4,0)),end,v); }
      else { const th=t-t0-dur;
        if(on){ const k=ease(th/0.7); d.visible=th<0.12; d.scale.set(1+2*th*8,Math.max(0.2,1-th*8),1+2*th*8); d.position.copy(end);
          if(!demo.hit){ demo.hit=true; }
          B.splat.visible=true; B.splat.position.copy(demo.hand).add(V3(0,0.0035,0)); B.splat.rotation.set(0,0.7,0);
          const R_=0.005+0.011*k; B.splat.scale.set(R_,0.004*(1-0.5*k)+0.001,R_*0.86);
          markAt(demo.hand,true,Math.max(0,0.9-th*0.6)); if(th>1.1) conclude(true); }
        else { d.visible=true; d.scale.set(0.8,1.6,0.8); d.position.copy(end); markAt(end,false,Math.min(0.9,th*4)); if(th>0.3) conclude(false); } } }
    else if(demo.kind==='echarde'){
      /* la planche glisse de 5 cm dans la main droite : l'écharde du chant approche de la paume */
      const u=ease((t-0.8)/2.0), stop=on? 0.004 : 0.012, b=B.board, sp=B.spl;
      const tipEnd=demo.palm.clone().add(V3(0,-stop,0));
      const tip=tipEnd.clone().addScaledVector(demo.side,0.06*(1-u));
      b.position.copy(tip).addScaledVector(demo.side,0.43).add(V3(0,-0.034,0));
      sp.position.copy(tip).add(V3(0,-0.02,0)); sp.rotation.set(0,0,0);
      if(u>=1){ const th=t-2.8; if(on){ markAt(tipEnd,true,Math.max(0,0.9-th*0.6)); sp.rotation.z=0.5*Math.min(1,th*3); if(th>0.9) conclude(true); }
        else { markAt(tipEnd,false,Math.min(0.9,th*4)); if(th>0.3) conclude(false); } } }
    stage.dirty?.(); return true; }

  /* ---------- entrée et sortie du vestiaire ---------- */
  let saved=null;
  function enter(){ if(active) return; active=true; saved={ min:ctl.minDistance }; ctl.minDistance=0.25; build(); showStations(true); B.g.visible=false;
    const k=cur||list[Math.max(0,app.vestiaire?.open??0)]?.parts[0]||'chaussures'; dress(k); }
  function leave(){ if(!active) return; active=false; stopDemo(); clearTimeout(dressT); cur=null; model.hideAvatar(); showStations(false); move=null;
    if(saved){ ctl.minDistance=saved.min; } stage.dirty(); }

  return { enter, leave, dress, play, stopDemo, tick, bruitEtat, freeze:t=>{ fixedT=t; }, get active(){ return active; }, get demo(){ return demo; }, get T(){ return T; },
    extra:(f)=>{ const k=f.parts[0]; if(!DEMOS[k]) return `<button type="button" class="toggle mini" data-vk="${k}" data-vd="voir">Voir sur l'élève</button>`;
      const Bt=DANGER.has(k)? BTN_D : BTN;
      return `<button type="button" class="toggle mini vd-sans" data-vk="${k}" data-vd="sans">${Bt.sans}</button><button type="button" class="toggle mini vd-avec" data-vk="${k}" data-vd="avec">${Bt.avec}</button>`
        + (k==='gants_manut'? `<button type="button" class="toggle mini vd-sans" data-vk="${k}" data-vd="toupie">${BTN.toupie}</button>` : ''); } };
}
