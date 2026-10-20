/* Modèle 3D de la déligneuse multilames « KANAK 300 M » (d'après une multilame à tapis de 300 mm,
   arbre au-dessus du tapis). Marque fictive : ne pas afficher la marque réelle.
   Sens de rotation : en opposition, les dents du bas vont vers l'opérateur (+X), contre l'avance.
   Organes animés : lames (rotation), tapis (patins), rouleaux presseurs et linguets (soulevés par la pièce),
   rideau de sortie, guide (position, escamotage), lignes laser projetées sur la pièce, aiguille de l'ampèremètre. */
import * as THREE from 'three';
import { M, MI, rbox, add, cyl, link, setBetween, canvasTex, beltGeom, pulley } from '../../engine/kit.js';
import { TABLE_Y, CHAIN_W, R_BLADE, SHAFT_Y, B1Z, HOOD_X0, HOOD_X1, CHAIN_X0, CHAIN_X1, ROLLERS, R_ROLL } from './constants.js';

export function buildModel({ root, tagPart, partMeshes }){
  const WHITE = new THREE.MeshStandardMaterial({color:0xe9e8e2, metalness:0.15, roughness:0.5});
  const WHITE2 = new THREE.MeshStandardMaterial({color:0xd9d8d1, metalness:0.15, roughness:0.55});
  const CASTT = new THREE.MeshStandardMaterial({color:0xaab0b5, metalness:0.6, roughness:0.3});
  const YEL = new THREE.MeshStandardMaterial({color:0xf0b323, metalness:0.15, roughness:0.45});
  const RUB = new THREE.MeshStandardMaterial({color:0x8a4a2c, roughness:0.85, side:THREE.DoubleSide});
  const OPEN_Z = 0.30, OPEN_H = 0.13;                       // ouverture d'entrée / de sortie du capot
  const ZB = -0.36, ZF = 0.48;                              // flancs du bâti : côté guide (−Z), côté moteur (+Z)

  /* ---------- Bâti ---------- */
  const bati = new THREE.Group(); root.add(bati);
  add(bati, rbox(1.08,0.62,ZF-ZB,WHITE,0.02), (HOOD_X0+0.02+0.50)/2,0.10+0.31,(ZB+ZF)/2);
  add(bati, rbox(0.98,0.10,ZF-ZB-0.08,WHITE2,0.01), (HOOD_X0+0.02+0.50)/2,0.05,(ZB+ZF)/2);           // socle
  // plateaux de part et d'autre du tapis (table d'usinage sous le capot)
  for(const [z0,z1] of [[ZB+0.02,-CHAIN_W/2-0.012],[CHAIN_W/2+0.012,ZF-0.01]]) add(bati, rbox(HOOD_X1-HOOD_X0,0.035,z1-z0,CASTT,0.003), (HOOD_X0+HOOD_X1)/2,TABLE_Y-0.0195,(z0+z1)/2);
  add(bati, rbox(0.30,0.36,0.006,WHITE2,0.003), -0.20,0.40,ZF+0.003);                                // porte d'accès moteur
  add(bati, rbox(0.012,0.10,0.02,M.dark,0.004), -0.08,0.40,ZF+0.014);
  // pied de la table d'entrée
  add(bati, rbox(0.62,0.58,0.62,WHITE,0.02), 0.82,0.10+0.29,-0.09);
  add(bati, rbox(0.56,0.10,0.56,WHITE2,0.01), 0.82,0.05,-0.09);
  { const plate=canvasTex(512,160,(g,w,h)=>{ g.fillStyle='#14181c'; g.fillRect(0,0,w,h); g.fillStyle='#ffffff'; g.font='bold 30px sans-serif';
      g.fillText('LONGUEUR MINI 390 mm',18,52); g.font='22px sans-serif'; g.fillText('Ne pas engager de pièces',18,96); g.fillText('plus courtes ni empilées',18,128); });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.22,0.07),new THREE.MeshBasicMaterial({map:plate,toneMapped:false})); m.position.set(1.131,0.60,0.10); m.rotation.y=Math.PI/2; bati.add(m); }
  tagPart(bati,'bati');
  for(const m of partMeshes.bati) m.material=m.material.clone();

  /* ---------- Capot des lames (translucide en vue intérieure) ---------- */
  const capot = new THREE.Group(); root.add(capot);
  const HT=1.18, yO=TABLE_Y+OPEN_H;
  add(capot, rbox(HOOD_X1-HOOD_X0+0.02,0.03,ZF-ZB+0.02,WHITE,0.012), (HOOD_X0+HOOD_X1)/2,HT,(ZB+ZF)/2);       // dessus
  for(const z of [ZB,ZF]) add(capot, rbox(HOOD_X1-HOOD_X0,HT-TABLE_Y+0.02,0.014,WHITE,0.005), (HOOD_X0+HOOD_X1)/2,(HT+TABLE_Y-0.02)/2,z);   // flancs
  for(const x of [HOOD_X1,HOOD_X0]){   // façades d'entrée et de sortie, avec l'ouverture de passage
    add(capot, rbox(0.014,HT-yO,ZF-ZB,WHITE,0.004), x,(HT+yO)/2,(ZB+ZF)/2);
    add(capot, rbox(0.014,OPEN_H+0.02,ZF-OPEN_Z,WHITE,0.004), x,TABLE_Y+OPEN_H/2-0.01,(ZF+OPEN_Z)/2);
    add(capot, rbox(0.014,OPEN_H+0.02,-OPEN_Z-ZB,WHITE,0.004), x,TABLE_Y+OPEN_H/2-0.01,(ZB-OPEN_Z)/2); }
  add(capot, rbox(0.36,0.026,0.03,M.panel,0.008), -0.22,0.98,ZF+0.034);                                  // poignée de porte
  for(const x of [-0.37,-0.07]) add(capot, rbox(0.02,0.02,0.03,M.panel,0.004), x,0.98,ZF+0.016);
  add(capot, rbox(0.016,0.10,0.016,M.dark,0.004), 0.05,0.98,ZF+0.012);                                // verrou interverrouillé
  { const draw=(g,w,h)=>{ g.clearRect(0,0,w,h);
      g.font='italic 700 150px "Barlow Condensed","Arial Narrow",sans-serif'; const w1=g.measureText('KANAK').width; g.fillStyle='#1d3c78'; g.fillText('KANAK',16,h/2+52);
      g.font='italic 500 104px "Barlow Condensed","Arial Narrow",sans-serif'; g.fillStyle='#2b2f33'; g.fillText('300 M',16+w1+30,h/2+48); };
    const t=canvasTex(1024,256,draw);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.48,0.12),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false})); m.position.set(0.10,1.06,ZF+0.0075); capot.add(m);
    document.fonts?.ready.then(()=>{ draw(t.userData.canvas.getContext('2d'),1024,256); t.needsUpdate=true; }); }
  tagPart(capot,'capot');
  for(const m of partMeshes.capot) m.material=m.material.clone();

  /* ---------- Aspiration : hotte Ø 200 sur les lames, buse Ø 120 sur le carter du tapis ---------- */
  const asp = new THREE.Group(); root.add(asp);
  { const fr=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.30,0.20,4,1,true),WHITE2); fr.rotation.y=Math.PI/4; fr.position.set(-0.06,HT+0.11,0.04); asp.add(fr);
    add(asp, cyl(0.10,0.34,WHITE,32), -0.06,HT+0.38,0.04);
    add(asp, cyl(0.106,0.03,M.steel,32), -0.06,HT+0.54,0.04);
    add(asp, cyl(0.06,0.12,M.dark,24,'z'), -0.40,0.52,ZB-0.06);
    add(asp, cyl(0.07,0.02,M.steel,24,'z'), -0.40,0.52,ZB-0.12); }
  tagPart(asp,'aspiration');

  /* ---------- Tapis d'amenage : patins en fonte à dents, sur deux pignons ---------- */
  const tapis = new THREE.Group(); root.add(tapis);
  const RS=0.09, SLAT=0.05, YT=TABLE_Y-0.011, LR=CHAIN_X1-CHAIN_X0, PER=2*LR+2*Math.PI*RS, NSL=Math.floor(PER/SLAT);
  const slatTex=canvasTex(64,256,(g,w,h)=>{ g.fillStyle='#4a5056'; g.fillRect(0,0,w,h);
    for(const x0 of [8,30,50]){ g.fillStyle='#262a2e'; g.fillRect(x0-3,0,8,h); for(let y=0;y<h;y+=8){ g.fillStyle='#9aa1a8'; g.beginPath(); g.moveTo(x0-3,y); g.lineTo(x0+1,y+4); g.lineTo(x0+5,y); g.fill(); } } });
  const slatMat=new THREE.MeshStandardMaterial({color:0xffffff,map:slatTex,metalness:0.6,roughness:0.45});
  const slats=new THREE.InstancedMesh(new THREE.BoxGeometry(SLAT-0.003,0.022,CHAIN_W),slatMat,NSL); tapis.add(slats);
  const sprockets=[CHAIN_X0,CHAIN_X1].map(x=>{ const g=new THREE.Group(); g.position.set(x,YT-RS,0); tapis.add(g); g.add(cyl(RS-0.012,CHAIN_W-0.02,M.steel,24,'z'));
    for(let k=0;k<6;k++){ const t=rbox(0.02,0.03,CHAIN_W-0.01,M.dark,0.003); t.rotation.z=k*Math.PI/3; t.translateY(RS-0.02); g.add(t); } return g; });
  for(const z of [-CHAIN_W/2-0.02,CHAIN_W/2+0.02]) add(tapis, rbox(LR+0.10,0.10,0.01,M.dark,0.004), (CHAIN_X0+CHAIN_X1)/2,YT-RS,z);   // flasques (carter de chaîne)
  let chainS=0;
  const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _p=new THREE.Vector3(), _s=new THREE.Vector3(1,1,1), _e=new THREE.Euler();
  function chainPose(s){ s=((s%PER)+PER)%PER; const a=Math.PI*RS;
    if(s<LR) return [CHAIN_X1-s,YT,0];
    if(s<LR+a){ const t=(s-LR)/RS; return [CHAIN_X0-RS*Math.sin(t),YT-RS+RS*Math.cos(t),t]; }
    if(s<2*LR+a) return [CHAIN_X0+(s-LR-a),YT-2*RS,Math.PI];
    const t=(s-2*LR-a)/RS; return [CHAIN_X1+RS*Math.sin(t),YT-RS-RS*Math.cos(t),Math.PI+t]; }
  function placeSlats(){ for(let i=0;i<NSL;i++){ const [x,y,r]=chainPose(i*PER/NSL+chainS); _p.set(x,y,0); _q.setFromEuler(_e.set(0,0,r)); slats.setMatrixAt(i,_m.compose(_p,_q,_s)); } slats.instanceMatrix.needsUpdate=true; }
  placeSlats();
  tagPart(tapis,'tapis');

  /* ---------- Arbre porte-lames : manchon, entretoises, lames ---------- */
  const rotor=new THREE.Group(); rotor.position.set(0,SHAFT_Y,0); root.add(rotor);
  const manG=new THREE.Group(); rotor.add(manG); const bladeG=new THREE.Group(); rotor.add(bladeG);
  const bearing=new THREE.Group(); root.add(bearing);
  add(bearing, rbox(0.16,0.16,0.07,MI.cast,0.01), 0,SHAFT_Y,0.40);
  add(bearing, cyl(0.03,0.12,MI.zinc,16,'z'), 0,SHAFT_Y,0.44);
  tagPart(bearing,'manchon');
  const CARB=new THREE.MeshStandardMaterial({color:0x3b3f44,metalness:0.7,roughness:0.35});
  const BLADE=new THREE.MeshStandardMaterial({color:0xdde2e6,metalness:0.7,roughness:0.28,side:THREE.DoubleSide});
  function bladeGeom(){ const n=24, r1=R_BLADE, r0=R_BLADE-0.018, step=Math.PI*2/n, s=new THREE.Shape();
    for(let k=0;k<n;k++){ const a=k*step;   // dos de la dent qui monte vers la pointe, face d'attaque radiale côté +θ (sens de rotation)
      const p=(rr,aa)=>[rr*Math.cos(aa),rr*Math.sin(aa)];
      const g0=p(r0,a), tip=p(r1,a+0.78*step), face=p(r0+0.004,a+0.80*step), gul=p(r0-0.006,a+0.92*step);
      if(k===0) s.moveTo(...g0); else s.lineTo(...g0); s.lineTo(...tip); s.lineTo(...face); s.quadraticCurveTo(...p(r0-0.012,a+0.86*step),...gul); }
    s.closePath(); const hole=new THREE.Path(); hole.absarc(0,0,0.035,0,Math.PI*2,true); s.holes.push(hole);
    const g=new THREE.ExtrudeGeometry(s,{depth:0.0024,bevelEnabled:false,curveSegments:4}); g.translate(0,0,-0.0012); return g; }
  const BG=bladeGeom();
  const tipGeo=new THREE.BoxGeometry(0.006,0.004,0.0034);
  const slotGeo=new THREE.BoxGeometry(0.03,0.003,0.0026);
  function setManchon(zs){
    for(const g of [bladeG,manG]) while(g.children.length){ const c=g.children.pop(); }
    const zmin=Math.min(...zs), zmax=Math.max(...zs);
    for(const z of zs){ const b=new THREE.Group(); b.position.z=z; bladeG.add(b);
      b.add(new THREE.Mesh(BG,BLADE));
      for(let k=0;k<24;k++){ const a=(k+0.78)*Math.PI*2/24; const t=new THREE.Mesh(tipGeo,CARB); t.position.set(Math.cos(a)*(R_BLADE-0.002),Math.sin(a)*(R_BLADE-0.002),0); t.rotation.z=a; b.add(t); }
      for(let k=0;k<4;k++){ const a=k*Math.PI/2+0.4; const sl=new THREE.Mesh(slotGeo,M.dark); sl.position.set(Math.cos(a)*0.10,Math.sin(a)*0.10,0); sl.rotation.z=a+Math.PI/2; b.add(sl); } }
    // manchon Ø 70 de la première lame jusqu'au palier, entretoises entre les lames, écrou de serrage côté guide
    const z0=zmin-0.03, z1=0.37; const man=cyl(0.035,z1-z0,MI.zinc,24,'z'); man.position.z=(z0+z1)/2; manG.add(man);
    const sz=[...zs].sort((a,b)=>a-b);
    for(let i=0;i<sz.length-1;i++){ const L=sz[i+1]-sz[i]-0.003; const e=cyl(0.055,L,M.alu,32,'z'); e.position.z=(sz[i]+sz[i+1])/2; manG.add(e); }
    { const e=cyl(0.055,z1-zmax-0.02,M.alu,32,'z'); e.position.z=(zmax+0.0015+z1-0.02)/2+0.0008; manG.add(e); }
    const nut=cyl(0.05,0.022,M.dark,6,'z'); nut.position.z=zmin-0.014; manG.add(nut);
    const fl=cyl(0.06,0.006,M.steel,32,'z'); fl.position.z=zmin-0.0045; manG.add(fl);
    partMeshes.lames=[]; partMeshes.manchon=partMeshes.manchon.filter(m=>!m.userData.dyn);
    tagPart(bladeG,'lames'); tagPart(manG,'manchon'); manG.traverse(o=>{ if(o.isMesh) o.userData.dyn=true; }); }

  /* ---------- Rouleaux presseurs : 2 avant, 2 après les lames (rappel par ressort) ---------- */
  const knurl=canvasTex(256,32,(g,w,h)=>{ g.fillStyle='#3a3f44'; g.fillRect(0,0,w,h); g.strokeStyle='#8b9298'; g.lineWidth=2; for(let x=0;x<w;x+=8){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke(); } });
  knurl.wrapS=knurl.wrapT=THREE.RepeatWrapping;
  const KN=new THREE.MeshStandardMaterial({map:knurl,metalness:0.7,roughness:0.4});
  const RR=R_ROLL, rollers=[];
  const pres=new THREE.Group(); root.add(pres);
  for(const x of ROLLERS){ const g=new THREE.Group(); g.position.x=x; pres.add(g);
    const r=cyl(RR,CHAIN_W+0.03,KN,28,'z'); g.add(r);
    for(const z of [-(CHAIN_W/2+0.03),CHAIN_W/2+0.03]){ add(g, rbox(0.035,0.075,0.012,M.dark,0.004), 0,0.03,z); add(g, cyl(0.009,0.05,M.steel,10), 0,0.09,z); }   // bras et ressort de rappel
    rollers.push({g,r,x,y:0}); }
  tagPart(pres,'presseurs');

  /* ---------- Barrières anti-recul : 3 rangées de linguets, 1 rangée de lamelles, barrière inférieure ---------- */
  const ling=new THREE.Group(); root.add(ling);
  function fingerGeom(w,len,th,tooth){ const s=new THREE.Shape(); s.moveTo(-w/2,0); s.lineTo(w/2,0); s.lineTo(w/2,-len); s.lineTo(-w/2+tooth*0.3,-len-tooth*0.3); s.lineTo(-w/2-tooth,-len-tooth); s.lineTo(-w/2,-len+tooth); s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:th,bevelEnabled:false}); g.translate(0,0,-th/2); return g; }
  // barrières anti-recul entre l'ouverture d'entrée et le rouleau presseur avant (linguets courts : leur bout reste devant ce rouleau)
  const LROWS=[{x:0.400,h:0.095,len:0.11,w:0.024,th:0.009,dz:0.0125,tooth:0.009,mat:M.steel},{x:0.370,h:0.095,len:0.11,w:0.024,th:0.009,dz:0.0125,tooth:0.009,mat:M.steel},
    {x:0.340,h:0.095,len:0.11,w:0.024,th:0.009,dz:0.0125,tooth:0.009,mat:M.steel},{x:0.428,h:0.095,len:0.105,w:0.016,th:0.0016,dz:0.0055,tooth:0.002,mat:M.aluDk}];
  for(const R of LROWS){ R.zs=[]; for(let z=-OPEN_Z+0.01;z<=OPEN_Z-0.01;z+=R.dz) R.zs.push(z);
    R.mesh=new THREE.InstancedMesh(fingerGeom(R.w,R.len,R.th,R.tooth),R.mat,R.zs.length); ling.add(R.mesh);
    add(ling, cyl(0.008,2*OPEN_Z,M.steel,10,'z'), R.x,TABLE_Y+R.h,0); R.ang=new Float32Array(R.zs.length).fill(-1); }
  // barrière inférieure : dents fixes dans une fente de la table, juste avant le tapis
  for(let z=-CHAIN_W/2+0.006;z<CHAIN_W/2;z+=0.015){ const t=rbox(0.02,0.012,0.008,M.steel,0); t.position.set(CHAIN_X1+0.03,TABLE_Y-0.007,z); t.rotation.z=-0.5; ling.add(t); }
  add(ling, rbox(0.04,0.008,CHAIN_W+0.02,M.dark,0.002), CHAIN_X1+0.03,TABLE_Y-0.012,0);
  tagPart(ling,'linguets');

  /* ---------- Rideau de sortie (bavettes) ---------- */
  const rideau=new THREE.Group(); root.add(rideau);
  const RID={x:HOOD_X0-0.012,h:0.135,len:0.132,w:0.095,th:0.004,dz:0.1,tooth:0.0001,mat:RUB}; RID.zs=[];
  for(let z=-OPEN_Z+0.05;z<OPEN_Z;z+=RID.dz) RID.zs.push(z);
  RID.mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(RID.th,RID.len,RID.w).translate(0,-RID.len/2,0),RUB,RID.zs.length); rideau.add(RID.mesh); RID.ang=new Float32Array(RID.zs.length).fill(-1);
  add(rideau, rbox(0.02,0.02,2*OPEN_Z+0.02,M.dark,0.004), RID.x,TABLE_Y+RID.h,0);
  tagPart(rideau,'rideau');

  /* ---------- Table d'entrée et servante à rouleau ---------- */
  const tIn=new THREE.Group(); root.add(tIn);
  add(tIn, rbox(1.30-0.505,0.045,0.82,CASTT,0.004), (1.30+0.505)/2,TABLE_Y-0.0225,-0.08);
  add(tIn, rbox(1.30-0.505,0.035,0.012,M.panel,0.003), (1.30+0.505)/2,TABLE_Y-0.025,0.326);
  { const sv=new THREE.Group(); sv.position.set(2.20,0,0); tIn.add(sv);
    add(sv, cyl(0.035,0.46,M.alu,20,'z'), 0,TABLE_Y-0.036,0);
    add(sv, rbox(0.03,0.04,0.50,M.dark,0.004), 0,TABLE_Y-0.075,0);
    add(sv, cyl(0.016,TABLE_Y-0.10,M.steel,12), 0,(TABLE_Y-0.10)/2+0.02,0);
    for(let k=0;k<3;k++){ const a=k*Math.PI*2/3, l=link(new THREE.BoxGeometry(0.025,0.02,1),M.dark); setBetween(l,new THREE.Vector3(0,0.08,0),new THREE.Vector3(Math.cos(a)*0.30,0.012,Math.sin(a)*0.30)); sv.add(l); } }
  tagPart(tIn,'table_entree');

  /* ---------- Table de sortie à rouleaux ---------- */
  const tOut=new THREE.Group(); root.add(tOut);
  { const x0=HOOD_X0-0.03, x1=-2.85;
    for(const z of [-0.33,0.33]) add(tOut, rbox(x0-x1,0.07,0.03,WHITE2,0.006), (x0+x1)/2,TABLE_Y-0.06,z);
    for(let x=x0-0.08;x>x1;x-=0.22) add(tOut, cyl(0.03,0.64,M.alu,18,'z'), x,TABLE_Y-0.031,0);
    for(const x of [x0-0.25,x1+0.12]) for(const z of [-0.30,0.30]) add(tOut, rbox(0.04,TABLE_Y-0.10,0.04,WHITE2,0.006), x,(TABLE_Y-0.10)/2,z); }
  tagPart(tOut,'table_sortie');

  /* ---------- Guide d'entrée escamotable, sur coulisseau ----------
     Rail fixe SOUS la table, en bout de table (rien au-dessus de la table du côté de la pièce).
     Le coulisseau suit le guide le long du rail (volant + vis) ; le guide et son équerre montent et descendent
     sur la colonne du coulisseau : escamoté, tout passe sous le dessus de la table. */
  const GX1=1.24, RX=1.335, RY=TABLE_Y-0.17;
  const guide=new THREE.Group(); root.add(guide);            // profil + équerre : translaté en Z, descend à l'escamotage
  const GL=GX1-0.47;
  add(guide, rbox(GL,0.075,0.03,M.alu,0.004), (GX1+0.47)/2,0.0375,-0.015);
  add(guide, rbox(GL,0.01,0.05,M.aluDk,0.003), (GX1+0.47)/2,0.075,-0.03);
  add(guide, rbox(RX-GX1+0.02,0.022,0.03,M.dark,0.004), (GX1+RX)/2,0.045,-0.045);          // équerre : bras au-dessus du bout de table, derrière la face
  add(guide, rbox(0.03,0.12,0.04,M.dark,0.005), RX,-0.005,-0.045);                          // équerre : patin vertical sur la colonne
  tagPart(guide,'guide');
  const gSlide=new THREE.Group(); root.add(gSlide);          // coulisseau : translaté en Z seulement
  add(gSlide, rbox(0.07,0.06,0.09,M.body,0.008), RX,RY,-0.045);
  add(gSlide, rbox(0.018,TABLE_Y-0.06-RY,0.018,M.steel,0.003), RX,(TABLE_Y-0.06+RY)/2,-0.045);   // colonne d'escamotage
  { const lv=add(gSlide, cyl(0.006,0.08,M.dark,10,'x'), RX+0.07,RY+0.01,-0.045); add(gSlide, new THREE.Mesh(new THREE.SphereGeometry(0.014,12,8),M.red), RX+0.11,RY+0.01,-0.045); }
  add(gSlide, rbox(0.03,0.0012,0.0016,M.red,0), 1.275,TABLE_Y+0.0008,0);                     // index sur la règle, au droit de la face du guide
  const regG=new THREE.Group(); root.add(regG);
  add(regG, cyl(0.014,0.74,M.steel,14,'z'), RX,RY,-0.20);                                     // rail
  for(const z of [-0.565,0.165]) add(regG, rbox(0.05,TABLE_Y-0.045-RY+0.02,0.03,WHITE2,0.004), RX-0.02,(TABLE_Y-0.045+RY)/2,z);   // supports sous la table
  { const c=[RX,RY,-0.62];
    const w=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.009,10,28),M.dark); w.position.set(...c); regG.add(w);
    for(let k=0;k<3;k++){ const sp=rbox(0.006,0.06,0.006,M.dark,0); sp.position.set(...c); sp.rotation.z=k*Math.PI*2/3; sp.translateY(0.03); regG.add(sp); }
    add(regG, cyl(0.012,0.06,M.steel,12,'z'), RX,RY,-0.59); add(regG, cyl(0.009,0.06,M.dark,10,'z'), RX+0.045,RY+0.025,-0.65); }
  const rulerT=canvasTex(1024,64,(g,w,h)=>{ g.fillStyle='#e4e7e2'; g.fillRect(0,0,w,h); g.fillStyle='#1c1f22'; g.font='bold 22px monospace';
    const px=w/250; for(let mm=0;mm<=250;mm+=5){ const x=w-mm*px; const L=mm%50===0?34:mm%10===0?22:12; g.fillRect(x-1,0,1.5,L); if(mm%50===0&&mm>0&&mm<250) g.fillText(String(mm),x-18,58); } });
  { const r=new THREE.Mesh(new THREE.PlaneGeometry(0.25,0.03),new THREE.MeshBasicMaterial({map:rulerT,toneMapped:false})); r.rotation.set(-Math.PI/2,0,-Math.PI/2); r.position.set(1.275,TABLE_Y+0.0006,B1Z-0.0016-0.125); regG.add(r); }
  tagPart(regG,'reglage_guide'); tagPart(gSlide,'reglage_guide');

  /* ---------- Pupitre de commande (entrée, côté moteur) + ampèremètre + arrêt d'urgence ---------- */
  const pup=new THREE.Group(); root.add(pup);
  const PX=HOOD_X1+0.045;
  add(pup, rbox(0.09,0.26,0.36,M.body,0.01), PX,1.04,0.25);
  const panelTex=canvasTex(512,370,(g,w,h)=>{ g.fillStyle='#2f363d'; g.fillRect(0,0,w,h); g.fillStyle='#e9ecef'; g.font='italic 700 34px "Barlow Condensed",sans-serif'; g.fillText('KANAK 300 M',18,40);
    // ampèremètre
    const cx=380, cy=150, r=78; g.fillStyle='#f4f4ef'; g.fillRect(cx-100,cy-100,200,130); g.lineWidth=12;
    const arc=(a0,a1,c)=>{ g.strokeStyle=c; g.beginPath(); g.arc(cx,cy,r,Math.PI+a0*Math.PI/150,Math.PI+a1*Math.PI/150); g.stroke(); };
    arc(0,40,'#9aa0a6'); arc(40,90,'#2f9a4e'); arc(90,100,'#e0a020'); arc(100,150,'#c4261c');
    g.fillStyle='#1b1f22'; g.font='bold 18px sans-serif'; g.fillText('A',cx-6,cy+20);
    const btn=(x,y,c,t)=>{ g.fillStyle='#14181c'; g.fillRect(x-34,y-34,68,68); g.fillStyle=c; g.beginPath(); g.arc(x,y,24,0,7); g.fill(); g.fillStyle=c==='#f2f2ee'?'#111':'#fff'; g.font='bold 20px sans-serif'; g.fillText(t,x-7,y+7); };
    btn(60,120,'#f2f2ee','I'); btn(150,120,'#14181c','O'); btn(60,230,'#f2f2ee','▶'); btn(150,230,'#14181c','■');
    g.fillStyle='#e9ecef'; g.font='16px sans-serif'; g.fillText('lames',75,175); g.fillText('tapis',78,285); g.fillText('laser',270,330);
    g.fillStyle='#f0b323'; g.fillRect(250,250,40,50); });
  { const m=new THREE.Mesh(new THREE.PlaneGeometry(0.34,0.245),new THREE.MeshBasicMaterial({map:panelTex,toneMapped:false})); m.rotation.y=Math.PI/2; m.position.set(PX+0.0455,1.04,0.25); pup.add(m); }
  const pz=cx=>0.25-0.34*(cx/512-0.5), py=cy=>1.04+0.245*(0.5-cy/370);   // coordonnées du dessin du pupitre → scène (face vers +X)
  const needle=new THREE.Group(); needle.position.set(PX+0.048,py(150),pz(380)); pup.add(needle);
  { const n=rbox(0.002,0.05,0.003,M.red,0); n.position.y=0.025; needle.add(n); add(needle, cyl(0.006,0.004,M.dark,12,'x')); }
  tagPart(pup,'pupitre');
  const au=new THREE.Group(); root.add(au);
  { const g=new THREE.Group(); g.position.set(PX+0.045,py(290),pz(410)); au.add(g);
    add(g, cyl(0.04,0.006,M.yellow,24,'x')); add(g, cyl(0.026,0.03,M.red,24,'x'), 0.016,0,0); }
  { const g=new THREE.Group(); g.position.set(HOOD_X0-0.012,1.00,0.40); au.add(g);
    add(g, rbox(0.03,0.11,0.11,M.yellow,0.006)); add(g, cyl(0.026,0.03,M.red,24,'x'), -0.025,0,0); }
  tagPart(au,'arret');

  /* ---------- Réglage des presseurs : volant sur la façade d'entrée ---------- */
  const regP=new THREE.Group(); root.add(regP);
  { const c=[HOOD_X1+0.03,1.02,-0.13];
    const disc=cyl(0.085,0.018,new THREE.MeshStandardMaterial({color:0x5f676e,metalness:0.6,roughness:0.4}),36,'x'); disc.position.set(...c); regP.add(disc);
    add(regP, rbox(0.006,0.012,0.15,M.dark,0.003), c[0]+0.012,c[1],c[2]);
    add(regP, cyl(0.01,0.05,M.dark,10,'x'), c[0]+0.03,c[1]+0.06,c[2]-0.04);
    add(regP, cyl(0.02,0.03,M.dark,12,'x'), c[0]+0.012,c[1],c[2]);
    const sc=canvasTex(128,256,(g,w,h)=>{ g.fillStyle='#f1f2ee'; g.fillRect(0,0,w,h); g.fillStyle='#1b1f22'; g.font='bold 18px monospace'; for(let mm=0;mm<=100;mm+=10){ const y=h-10-mm*2.3; g.fillRect(0,y,mm%50===0?40:24,2); if(mm%20===0) g.fillText(String(mm),48,y+7); } });
    const s=new THREE.Mesh(new THREE.PlaneGeometry(0.05,0.10),new THREE.MeshBasicMaterial({map:sc,toneMapped:false})); s.rotation.y=Math.PI/2; s.position.set(HOOD_X1+0.0075,1.02,-0.25); regP.add(s); }
  const presPtr=new THREE.Mesh(new THREE.ConeGeometry(0.005,0.014,3),M.red); presPtr.rotation.z=-Math.PI/2; regP.add(presPtr);
  tagPart(regP,'reglage_presseurs');

  /* ---------- Variateur de vitesse d'avance : volant sur le flanc du pied d'entrée ---------- */
  const vit=new THREE.Group(); root.add(vit);
  { const c=[0.82,0.48,0.225+0.012];
    add(vit, rbox(0.20,0.20,0.004,M.yellow,0.002), c[0],c[1],c[2]-0.008);
    const w=new THREE.Mesh(new THREE.TorusGeometry(0.07,0.01,10,28),M.dark); w.position.set(...c); vit.add(w);
    for(let k=0;k<3;k++){ const s=rbox(0.007,0.07,0.007,M.dark,0); s.position.set(...c); s.rotation.z=k*Math.PI*2/3; s.translateY(0.035); vit.add(s); }
    add(vit, cyl(0.016,0.04,M.steel,12,'z'), c[0],c[1],c[2]-0.01); add(vit, cyl(0.009,0.06,M.dark,10,'z'), c[0]+0.05,c[1]+0.03,c[2]+0.03); }
  tagPart(vit,'vitesse');

  /* ---------- Laser au-dessus de l'entrée ---------- */
  const laser=new THREE.Group(); root.add(laser);
  for(const z of [-0.24,0.24]) add(laser, rbox(0.02,0.16,0.02,M.dark,0.004), HOOD_X1+0.03,HT+0.08,z);
  add(laser, rbox(0.04,0.03,0.52,M.alu,0.006), HOOD_X1+0.10,HT+0.16,0);
  add(laser, rbox(0.08,0.02,0.03,M.dark,0.004), HOOD_X1+0.065,HT+0.16,-0.24); add(laser, rbox(0.08,0.02,0.03,M.dark,0.004), HOOD_X1+0.065,HT+0.16,0.24);
  { const u=new THREE.Group(); u.position.set(HOOD_X1+0.13,HT+0.10,0.0); laser.add(u);
    const body=cyl(0.026,0.12,YEL,20); body.rotation.z=0.5; u.add(body);
    const head=rbox(0.06,0.05,0.06,M.dark,0.008); head.position.set(-0.04,-0.06,0); u.add(head); }
  const laserDot=new THREE.Mesh(new THREE.SphereGeometry(0.008,10,8),new THREE.MeshBasicMaterial({color:0x550000,toneMapped:false})); laserDot.position.set(HOOD_X1+0.09,HT+0.015,0); laser.add(laserDot);
  tagPart(laser,'laser');
  const LASER_MAT=new THREE.MeshBasicMaterial({color:0xff2a14,toneMapped:false,transparent:true,opacity:0.95,depthWrite:false,side:THREE.DoubleSide});
  const laserLines=new THREE.Group(); root.add(laserLines);

  /* ---------- Moteur principal, transmission, moteur d'avance (intérieur) ---------- */
  const MOT=[-0.18,0.38];
  const moteur=new THREE.Group(); root.add(moteur);
  add(moteur, cyl(0.13,0.34,MI.motor,32,'z'), MOT[0],MOT[1],0.20);
  for(let i=0;i<10;i++) add(moteur, cyl(0.137,0.005,MI.motor,32,'z'), MOT[0],MOT[1],0.05+i*0.032);
  add(moteur, rbox(0.10,0.07,0.12,MI.motor,0.006), MOT[0],MOT[1]+0.16,0.16);
  add(moteur, rbox(0.30,0.03,0.36,MI.cast,0.004), MOT[0],MOT[1]-0.145,0.20);
  add(moteur, cyl(0.02,0.10,MI.zinc,12,'z'), MOT[0],MOT[1],0.41);
  tagPart(moteur,'moteur');
  const trans=new THREE.Group(); root.add(trans);
  const BZ=0.44;
  const pA=pulley(0.07,0.03,MI.zinc); pA.position.set(0,SHAFT_Y,BZ); trans.add(pA);
  const pM=pulley(0.09,0.03,MI.zinc); pM.position.set(MOT[0],MOT[1],BZ); trans.add(pM);
  const belt=new THREE.Mesh(beltGeom([0,SHAFT_Y],0.07,MOT,0.09,0.026,0.008),MI.belt); belt.position.z=BZ; trans.add(belt);
  tagPart(trans,'transmission');
  const mAv=new THREE.Group(); root.add(mAv);
  add(mAv, cyl(0.06,0.20,MI.motor,24,'z'), -0.40,0.40,-0.16);
  add(mAv, rbox(0.14,0.14,0.12,MI.cast,0.01), -0.40,0.40,-0.01);
  { const l=link(new THREE.BoxGeometry(0.02,0.04,1),MI.belt); setBetween(l,new THREE.Vector3(-0.40,0.40,0.06),new THREE.Vector3(CHAIN_X0,YT-RS,0.06)); mAv.add(l); }
  tagPart(mAv,'moteur_avance');

  /* ---------- mise à jour d'après les réglages et la position des pièces ----------
     S = { H (mm), guideZ, guideUp, under(x,z) → hauteur de pièce (m) au point, laser, bladeZs, surf(x,z) → hauteur de la pièce d'entrée (m), amp (%) } */
  const tmpA=new THREE.Vector3(), tmpB=new THREE.Vector3();
  function rowPose(R,under,lift){ let changed=false;
    for(let i=0;i<R.zs.length;i++){ const z=R.zs[i]; let a=0;
      // le linguet repose sur la table ou sur la pièce : on cherche l'angle où son bout touche la surface
      for(let k=0;k<6;k++){ const tipX=R.x-lift*R.len*Math.sin(a), h=under(tipX,z); const c=Math.max(-1,Math.min(1,(R.h-h)/R.len)); a=Math.acos(c); }
      if(Math.abs(a-R.ang[i])>1e-4){ R.ang[i]=a; _p.set(R.x,TABLE_Y+R.h,z); _q.setFromEuler(_e.set(0,0,-lift*a)); R.mesh.setMatrixAt(i,_m.compose(_p,_q,_s)); changed=true; } }
    if(changed) R.mesh.instanceMatrix.needsUpdate=true; return changed; }
  let laserKey='';
  function update(S){
    // guide
    const gy=S.guideUp?TABLE_Y:TABLE_Y-0.085;   // escamoté : profil et équerre sous le dessus de la table
    guide.position.set(0,gy,S.guideZ);
    gSlide.position.set(0,0,S.guideZ);
    // presseurs : hauteur de passage, soulevés par la pièce
    for(const R of rollers){ const h=Math.max(S.H/1000,S.under(R.x,-0.10),S.under(R.x,0),S.under(R.x,0.10)); R.y=h; R.g.position.y=TABLE_Y+h+RR; }
    presPtr.position.set(HOOD_X1+0.012,1.02-0.05+Math.min(100,S.H)*0.0009+0.005,-0.222);
    // linguets, lamelles, rideau
    for(const R of LROWS) rowPose(R,S.under,1);
    rowPose(RID,S.under,1);
    // laser
    const key=S.laser? JSON.stringify([S.bladeZs,S.laserKey]) : 'off';
    if(key!==laserKey){ laserKey=key; while(laserLines.children.length){ const c=laserLines.children.pop(); c.geometry.dispose(); }
      if(S.laser) for(const z of S.bladeZs){ const pos=[], idx=[]; const hw=0.0009; let n=0;
        for(let x=HOOD_X1+0.005;x<=1.30;x+=0.006){ const y=TABLE_Y+S.surf(x,z)+0.0007; pos.push(x,y,z-hw, x,y,z+hw); if(n){ const b=(n-1)*2; idx.push(b,b+1,b+2, b+1,b+3,b+2); } n++; }
        const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); laserLines.add(new THREE.Mesh(g,LASER_MAT)); } }
    laserDot.material.color.setHex(S.laser?0xff2a14:0x550000);
    // ampèremètre
    needle.rotation.x = Math.PI/2 - Math.min(150,Math.max(0,S.amp))/150*Math.PI;   // 0 % à gauche, 75 % en haut, 150 % à droite
  }
  /* animation : lames (ralenties à l'affichage), tapis et rouleaux pendant la passe */
  let spin=0, bladeAng=0;
  /* feed : distance parcourue par la pièce ; chain : distance parcourue par le tapis (en marche, avec ou sans pièce).
     Le brin du dessus va vers la sortie (−X), dans le sens d'avance ; les dents du bas des lames vont vers l'entrée (opposition). */
  function tick(dt, motorOn, feed, chain=0){ spin += ((motorOn?1:0)-spin)*Math.min(1,dt*0.8); const w=spin*dt*1.3; bladeAng+=w;
    if(chain){ chainS+=chain; placeSlats(); for(const g of sprockets) g.rotation.z += chain/RS; }
    rotor.rotation.z += w; pA.rotation.z += w; pM.rotation.z += w*0.07/0.09;   // opposition : les dents du bas vont vers +X
    if(feed){ for(const R of rollers) R.r.rotation.z -= feed/RR; }   // le bas du rouleau suit la pièce (−X)
    return spin; }
  const pieceRoot=new THREE.Group(); root.add(pieceRoot);
  return { update, tick, setManchon, pieceRoot, get spin(){ return spin; }, stopNow(){ spin=0; } };
}
