/* Modèle 3D de la scie radiale « KANAK 900 R » (d'après une scie radiale de débit Ø 400, 900 × 120 mm).
   Marque fictive : ne pas afficher la marque réelle.
   Hiérarchie de la tête : bras (pivote sur la colonne, angle α) → chariot (coulisse le long du bras, course s)
   → groupe incliné (pivote autour de la ligne de course au ras de la table, angle β) → moteur, lame, carter,
   protecteur, poignée. Sens de rotation : en avalant, les dents de devant descendent dans le bois.
   Organes animés : lame (rotation ralentie à l'affichage), tête (course), bras (angle), inclinaison,
   protecteur (hauteur), butée (position, relevée / abaissée), main de maintien. */
import * as THREE from 'three';
import { M, MI, rbox, add, cyl, link, setBetween, canvasTex, rulerTex, sawBlade } from '../../engine/kit.js';
import { TABLE_Y, R, DROP, FENCE_Z, FENCE_T, FENCE_H, Z_COL, Z_PIV, ANGLE_MARKS, Z_PARK, STROKE, ARM_Y, TABLE_X0, TABLE_X1, TABLE_Z0, TABLE_Z1, SERV_X0, EXT_X1, KERF, ZONE } from './constants.js';

export function buildModel({ root, tagPart, partMeshes }){
  const WHITE = new THREE.MeshStandardMaterial({color:0xeceeec, metalness:0.15, roughness:0.48});
  const WHITE2 = new THREE.MeshStandardMaterial({color:0xd8dbd9, metalness:0.15, roughness:0.55});
  const GRAPH = new THREE.MeshStandardMaterial({color:0x353b42, metalness:0.3, roughness:0.45});
  const BLUE = new THREE.MeshStandardMaterial({color:0x1d3c78, metalness:0.25, roughness:0.45});
  const BEECH = new THREE.MeshStandardMaterial({color:0xd8b483, roughness:0.75});
  const SKIN = new THREE.MeshStandardMaterial({color:0xe2ad8b, roughness:0.62});
  const HY = TABLE_Y + R - DROP;                 // axe de la lame au-dessus de la table (dans le groupe incliné : HY − TABLE_Y)
  const zc0 = Z_PARK - Z_PIV;                    // centre de la lame le long du bras (depuis le pivot), position arrière

  /* ---------- 01 Châssis ---------- */
  const bati = new THREE.Group(); root.add(bati);
  for(const x of [-1.20,1.20]) for(const z of [-0.58,0.36]){ add(bati, rbox(0.08,TABLE_Y-0.07,0.07,WHITE,0.01), x,(TABLE_Y-0.07)/2,z); add(bati, rbox(0.12,0.02,0.11,M.dark,0.004), x,0.01,z); }
  for(const z of [-0.58,0.36]) add(bati, rbox(2.48,0.09,0.05,WHITE2,0.006), 0,TABLE_Y-0.085,z);
  for(const x of [-1.20,0,1.20]) add(bati, rbox(0.05,0.09,0.90,WHITE2,0.006), x,TABLE_Y-0.085,-0.11);
  add(bati, rbox(2.40,0.05,0.05,WHITE2,0.006), 0,0.18,-0.58);
  // support de colonne, à l'arrière
  add(bati, rbox(0.30,0.86,0.28,WHITE,0.02), 0,0.43,Z_COL-0.01);
  add(bati, rbox(0.42,0.03,0.40,M.dark,0.006), 0,0.015,Z_COL-0.01);
  add(bati, rbox(0.22,0.12,0.30,WHITE2,0.01), 0,TABLE_Y-0.10,(Z_COL+TABLE_Z0)/2+0.02);
  tagPart(bati,'bati');

  /* ---------- 02 Table en bois : traits de lame ; zone dangereuse peinte (suit l'angle du bras et l'inclinaison) ---------- */
  const table = new THREE.Group(); root.add(table);
  const TW=TABLE_X1-TABLE_X0, TD=TABLE_Z1-TABLE_Z0;
  add(table, rbox(TW,0.034,TD,new THREE.MeshStandardMaterial({color:0xb99b70,roughness:0.85}),0.004), 0,TABLE_Y-0.017,(TABLE_Z0+TABLE_Z1)/2);
  { const px=1024/TW, X=x=>(x-TABLE_X0)*px, Z=z=>(z-TABLE_Z0)*px;
    const t=canvasTex(1024,Math.round(TD*px),(g,w,h)=>{ let s=11; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
      g.fillStyle='#c4a678'; g.fillRect(0,0,w,h);
      for(let i=0;i<5000;i++){ g.fillStyle=`rgba(${rnd()<0.5?90:240},${rnd()<0.5?66:215},40,${0.05+rnd()*0.08})`; g.fillRect(rnd()*w,rnd()*h,1+rnd()*2,1+rnd()*2); }
      // traits de lame laissés dans la table pour les positions caractéristiques du bras (droites issues de l'axe de la colonne)
      for(const a of ANGLE_MARKS){ const r=a*Math.PI/180, sa=Math.sin(r), ca=Math.cos(r), t0=Z_PARK-Z_PIV-0.05, t1=(TABLE_Z1-Z_PIV)/ca;
        g.strokeStyle='#2a1d10'; g.lineWidth=KERF/1000*px+(a?0.4:0.8);
        g.beginPath(); g.moveTo(X(t0*sa),Z(Z_PIV+t0*ca)); g.lineTo(X(t1*sa),Z(Z_PIV+t1*ca)); g.stroke(); } });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(TW,TD),new THREE.MeshStandardMaterial({map:t,roughness:0.85})); m.rotation.x=-Math.PI/2; m.position.set(0,TABLE_Y+0.0004,(TABLE_Z0+TABLE_Z1)/2); m.receiveShadow=true; table.add(m); }
  tagPart(table,'table');
  const zoneClip=[new THREE.Plane(new THREE.Vector3(1,0,0),-TABLE_X0),new THREE.Plane(new THREE.Vector3(-1,0,0),TABLE_X1),new THREE.Plane(new THREE.Vector3(0,0,-1),TABLE_Z1-0.004)];
  const stripeT=canvasTex(32,256,(g,w,h)=>{ g.fillStyle='#f4f1ea'; g.fillRect(0,0,w,h); g.fillStyle='#c4261c'; for(let y=-40;y<h+40;y+=28){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y-20); g.lineTo(w,y-6); g.lineTo(0,y+14); g.fill(); } });
  stripeT.wrapT=THREE.RepeatWrapping;
  const zoneG=new THREE.Group(); zoneG.position.y=TABLE_Y+0.0008; table.add(zoneG);
  const quad=(mat)=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3)); g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2)); g.setIndex([0,2,1,0,3,2]);
    const m=new THREE.Mesh(g,mat); m.receiveShadow=true; zoneG.add(m); return m; };
  const zFill=quad(new THREE.MeshBasicMaterial({color:0xc4261c,transparent:true,opacity:0.13,depthWrite:false,clippingPlanes:zoneClip,side:THREE.DoubleSide}));
  const zStripes=[0,1].map(()=>quad(new THREE.MeshBasicMaterial({map:stripeT,toneMapped:false,clippingPlanes:zoneClip,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1})));
  const zText=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.05),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,clippingPlanes:zoneClip,map:canvasTex(256,108,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='rgba(160,24,18,0.8)'; g.font='bold 34px sans-serif'; g.textAlign='center'; g.fillText('ZONE',w/2,44); g.fillText('DANGEREUSE',w/2,92); })}));
  zText.rotation.x=-Math.PI/2; zoneG.add(zText);
  /* zone : quadrilatère [[x,z]…] (arrière gauche, arrière droit, avant droit, avant gauche), bandes de 16 mm sur ses deux bords */
  function setZone(P){ const set=(m,Q)=>{ const a=m.geometry.attributes.position; Q.forEach(([x,z],i)=>a.setXYZ(i,x,0,z)); a.needsUpdate=true; m.geometry.computeBoundingSphere(); };
    set(zFill,P); const w=0.016, len=Math.hypot(P[3][0]-P[0][0],P[3][1]-P[0][1]);
    set(zStripes[0],[[P[0][0]-w,P[0][1]],P[0],P[3],[P[3][0]-w,P[3][1]]]); set(zStripes[1],[P[1],[P[1][0]+w,P[1][1]],[P[2][0]+w,P[2][1]],P[2]]);
    for(const m of zStripes){ const u=m.geometry.attributes.uv; u.setXY(2,1,len/0.18); u.setXY(3,0,len/0.18); u.needsUpdate=true; }
    const t=0.86, cx=(P[0][0]+P[1][0])/2+((P[3][0]+P[2][0])-(P[0][0]+P[1][0]))/2*t, cz=P[0][1]+(P[3][1]-P[0][1])*t;
    zText.position.set(cx,0.0002,cz); zText.rotation.z=-Math.atan2(P[3][0]-P[0][0],P[3][1]-P[0][1]); }

  /* ---------- 03 Guide en bois, entaillé par la lame ---------- */
  const guide = new THREE.Group(); root.add(guide);
  { const gap=KERF/2000+0.001; for(const [x0,x1] of [[SERV_X0,-gap],[gap,EXT_X1]]) add(guide, rbox(x1-x0,FENCE_H,FENCE_T,BEECH,0.003), (x0+x1)/2,TABLE_Y+FENCE_H/2,FENCE_Z-FENCE_T/2);
    for(const x of [-0.55,0.55,-1.6,1.6]) add(guide, rbox(0.06,0.05,0.05,M.steel,0.006), x,TABLE_Y+0.03,FENCE_Z-FENCE_T-0.025); }
  { const KM=new THREE.MeshBasicMaterial({color:0x2a1d10});   // traits de lame dans le guide (dessus et face avant)
    for(const a of ANGLE_MARKS){ const r=a*Math.PI/180, L=FENCE_T/Math.cos(r)+0.002, m=new THREE.Mesh(new THREE.PlaneGeometry(0.0045,L),KM);
      m.rotation.set(-Math.PI/2,0,-r); m.position.set(Math.tan(r)*(FENCE_Z-FENCE_T/2-Z_PIV),TABLE_Y+FENCE_H+0.0006,FENCE_Z-FENCE_T/2); guide.add(m); } }
  tagPart(guide,'guide');

  /* ---------- 19 Servante à rouleaux (gauche) et 20 table de sortie (droite) ---------- */
  function rollerTable(x0,x1,part){ const g=new THREE.Group(); root.add(g); const z0=FENCE_Z+0.005, z1=FENCE_Z+0.42, L=Math.abs(x1-x0), xm=(x0+x1)/2;
    for(const z of [z0+0.01,z1-0.01]) add(g, rbox(L,0.06,0.03,WHITE2,0.005), xm,TABLE_Y-0.065,z);
    for(let x=Math.min(x0,x1)+0.12;x<Math.max(x0,x1)-0.05;x+=0.25) add(g, cyl(0.03,z1-z0-0.06,M.alu,18,'z'), x,TABLE_Y-0.03,(z0+z1)/2);
    for(const x of [Math.min(x0,x1)+0.20,Math.max(x0,x1)-0.15]){ add(g, rbox(0.05,TABLE_Y-0.10,0.05,WHITE2,0.006), x,(TABLE_Y-0.10)/2,(z0+z1)/2); add(g, rbox(0.06,0.04,z1-z0,WHITE2,0.006), x,TABLE_Y-0.12,(z0+z1)/2); add(g, rbox(0.10,0.02,0.40,M.dark,0.004), x,0.01,(z0+z1)/2); }
    tagPart(g,part); return g; }
  rollerTable(TABLE_X0-0.03,SERV_X0,'servante');
  rollerTable(TABLE_X1+0.03,EXT_X1,'table_sortie');

  /* ---------- 18 Règle de la butée (sur le guide, côté sortie) ---------- */
  const regle = new THREE.Group(); root.add(regle);
  add(regle, rbox(EXT_X1-0.05,0.018,0.034,M.alu,0.003), (0.05+EXT_X1)/2,TABLE_Y+FENCE_H+0.009,FENCE_Z-FENCE_T/2);
  { const r=new THREE.Mesh(new THREE.PlaneGeometry(2.0,0.026),new THREE.MeshBasicMaterial({map:rulerTex(2000),toneMapped:false})); r.rotation.x=-Math.PI/2; r.position.set(KERF/2000+1.0,TABLE_Y+FENCE_H+0.0185,FENCE_Z-FENCE_T/2); regle.add(r); }
  tagPart(regle,'regle_butee');

  /* ---------- 17 Butée de longueur escamotable ---------- */
  const butee = new THREE.Group(); root.add(butee);
  add(butee, rbox(0.07,0.035,0.05,M.dark,0.006), 0.035,TABLE_Y+FENCE_H+0.03,FENCE_Z-FENCE_T/2);
  add(butee, cyl(0.012,0.03,M.red,12,'z'), 0.06,TABLE_Y+FENCE_H+0.03,FENCE_Z+0.012);
  add(butee, rbox(0.004,0.004,0.03,M.red,0), 0.0,TABLE_Y+FENCE_H+0.0195,FENCE_Z-FENCE_T/2);            // index sur la règle
  const flip = new THREE.Group(); flip.position.set(0,TABLE_Y+FENCE_H+0.02,FENCE_Z+0.002); butee.add(flip);
  add(flip, rbox(0.014,0.085,0.10,M.dark,0.003), 0.007,-0.0425-0.003,0.05);
  add(flip, rbox(0.03,0.016,0.02,M.steel,0.003), 0.015,0,0.005);
  tagPart(butee,'butee');

  /* ---------- 04 Colonne ; 15 réglage de l'angle (secteur fixe en haut de la colonne) : le bras pivote sur l'axe de la colonne ---------- */
  const colonne = new THREE.Group(); root.add(colonne);
  add(colonne, cyl(0.105,0.12,WHITE,32), 0,0.86+0.06,Z_COL);
  add(colonne, cyl(0.085,ARM_Y-0.075-0.98,M.cast,32), 0,(ARM_Y-0.075+0.98)/2,Z_COL);
  add(colonne, cyl(0.11,0.02,M.steel,32), 0,0.985,Z_COL);
  tagPart(colonne,'colonne');
  const rot = new THREE.Group(); root.add(rot);
  { const t=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#e9ebe7'; g.beginPath(); g.arc(w/2,h/2,w/2,0,7); g.fill(); g.fillStyle='#1b1f22'; g.font='bold 15px sans-serif'; g.textAlign='center';
      for(let a=-60;a<=60;a+=5){ const r=a*Math.PI/180, L=a%15===0?26:12; g.save(); g.translate(w/2,h/2); g.rotate(r); g.fillRect(-1,-w/2+2,2,L); if(a%15===0) g.fillText(String(Math.abs(a)),0,-w/2+44); g.restore(); } });
    const d=new THREE.Mesh(new THREE.CircleGeometry(0.15,48),new THREE.MeshBasicMaterial({map:t,toneMapped:false})); d.rotation.x=-Math.PI/2; d.rotation.z=Math.PI; d.position.set(0,ARM_Y-0.0905,Z_COL); rot.add(d);
    add(rot, cyl(0.152,0.012,M.steel,48), 0,ARM_Y-0.098,Z_COL); }
  tagPart(rot,'rotation');

  /* ---------- 05 Bras (pivote sur la colonne) ---------- */
  const armG = new THREE.Group(); armG.position.set(0,0,Z_PIV); root.add(armG);
  const bras = new THREE.Group(); armG.add(bras);
  const A0=-0.12, A1=zc0+STROKE+0.15, AL=A1-A0, AZ=(A0+A1)/2;
  add(bras, rbox(0.17,0.15,AL,WHITE,0.02), 0,ARM_Y,AZ);
  add(bras, rbox(0.06,0.012,AL-0.10,M.dark,0.002), 0,ARM_Y-0.076,AZ+0.02);            // fente du chariot, dessous
  add(bras, rbox(0.172,0.03,0.30,BLUE,0.006), 0,ARM_Y+0.05,A1-0.25);                  // bandeau
  { const draw=(g,w,h)=>{ g.clearRect(0,0,w,h); g.font='italic 700 150px "Barlow Condensed","Arial Narrow",sans-serif'; const w1=g.measureText('KANAK').width; g.fillStyle='#1d3c78'; g.fillText('KANAK',16,h/2+52);
      g.font='italic 500 104px "Barlow Condensed","Arial Narrow",sans-serif'; g.fillStyle='#2b2f33'; g.fillText('900 R',16+w1+30,h/2+48); };
    const t=canvasTex(1024,256,draw); const mat=new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false});
    for(const s of [1,-1]){ const m=new THREE.Mesh(new THREE.PlaneGeometry(0.40,0.10),mat); m.position.set(s*0.0855,ARM_Y+0.005,A1-0.55); m.rotation.y=s*Math.PI/2; bras.add(m); }
    document.fonts?.ready.then(()=>{ draw(t.userData.canvas.getContext('2d'),1024,256); t.needsUpdate=true; }); }
  add(bras, cyl(0.13,0.10,WHITE2,36), 0,ARM_Y-0.03,0);                                // tourelle sur la colonne
  add(bras, rbox(0.004,0.012,0.012,M.red,0), 0,ARM_Y-0.088,0.135);                    // index de l'angle, sur le secteur
  tagPart(bras,'bras');
  for(const m of partMeshes.bras) m.material=m.material.clone();
  // 15 levier de blocage de l'angle (tourne avec le bras)
  const rotLev = new THREE.Group(); armG.add(rotLev);
  add(rotLev, cyl(0.012,0.12,M.steel,12,'x'), 0.13,ARM_Y-0.03,0.11);
  add(rotLev, new THREE.Mesh(new THREE.SphereGeometry(0.022,14,10),M.red), 0.20,ARM_Y-0.03,0.11);
  // 14 manivelle de hauteur, sur le bras au-dessus de la colonne
  const man = new THREE.Group(); armG.add(man);
  add(man, cyl(0.016,0.07,M.steel,14), 0,ARM_Y+0.11,0);
  add(man, rbox(0.16,0.018,0.03,M.dark,0.006), 0.06,ARM_Y+0.15,0);
  add(man, cyl(0.014,0.07,M.dark,12), 0.13,ARM_Y+0.19,0);
  add(man, cyl(0.04,0.03,M.dark,24), 0,ARM_Y+0.15,0);
  tagPart(man,'manivelle');
  tagPart(rotLev,'rotation');

  /* ---------- 06 Chariot (dans le bras), 07 ressort de rappel ---------- */
  const carriage = new THREE.Group(); armG.add(carriage);
  const chariot = new THREE.Group(); carriage.add(chariot);
  add(chariot, rbox(0.12,0.09,0.24,MI.cast,0.01), 0,ARM_Y-0.005,0);
  for(const z of [-0.09,-0.03,0.03,0.09]) for(const x of [-0.07,0.07]) add(chariot, cyl(0.022,0.02,M.steel,16,'x'), x,ARM_Y+0.02*Math.sign(z),z);
  add(chariot, rbox(0.11,0.075,0.17,MI.cast,0.01), 0,ARM_Y-0.115,0);                   // partie sous le bras
  tagPart(chariot,'chariot');
  const ressort = new THREE.Group(); armG.add(ressort);
  const helix=link((()=>{ const pts=[]; for(let i=0;i<=400;i++){ const t=i/400, a=t*Math.PI*2*22; pts.push(new THREE.Vector3(Math.cos(a)*0.018,Math.sin(a)*0.018,t-0.5)); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),400,0.0028,6,false); })(), new THREE.MeshStandardMaterial({color:0xb9b23a,metalness:0.7,roughness:0.35}));
  ressort.add(helix);
  add(ressort, rbox(0.05,0.04,0.02,M.steel,0.004), 0,ARM_Y+0.035,A0+0.03);
  // butée de fin de course arrière (caoutchouc) : la tête s'arrête avant la colonne
  add(ressort, rbox(0.07,0.035,0.04,M.dark,0.008), 0,ARM_Y-0.09,zc0-0.145);
  tagPart(ressort,'ressort');

  /* ---------- 16 Inclinaison : secteur courbe sous le chariot, coulisseau et levier (dans le groupe incliné) ---------- */
  const incl = new THREE.Group(); carriage.add(incl);
  const RA=0.56;
  { const s=new THREE.Shape(), n=36, f0=-4*Math.PI/180, f1=50*Math.PI/180, r0=RA-0.022, r1=RA+0.022;
    for(let i=0;i<=n;i++){ const f=f0+(f1-f0)*i/n, p=[-r1*Math.sin(f),r1*Math.cos(f)]; i?s.lineTo(...p):s.moveTo(...p); }
    for(let i=n;i>=0;i--){ const f=f0+(f1-f0)*i/n; s.lineTo(-r0*Math.sin(f),r0*Math.cos(f)); } s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:0.03,bevelEnabled:false}); g.translate(0,0,-0.015);
    const arc=new THREE.Mesh(g,MI.cast); arc.position.set(0,TABLE_Y,-0.10); incl.add(arc);
    const t=canvasTex(512,64,(gg,w,h)=>{ gg.fillStyle='#e9ebe7'; gg.fillRect(0,0,w,h); gg.fillStyle='#1b1f22'; gg.font='bold 22px sans-serif';
      for(let a=0;a<=45;a+=5){ const x=12+a/45*(w-40); gg.fillRect(x,0,2,a%15===0?30:16); if(a%15===0) gg.fillText(String(a),x-8,56); } });
    const sc=new THREE.Mesh(new THREE.RingGeometry(r0+0.004,r1-0.004,40,1,Math.PI/2,Math.PI/4+0.02),new THREE.MeshBasicMaterial({map:t,toneMapped:false,side:THREE.DoubleSide}));
    sc.position.set(0,TABLE_Y,-0.10+0.0155); incl.add(sc);
    add(incl, rbox(0.07,0.05,0.06,MI.cast,0.006), 0,ARM_Y-0.165,-0.04); }
  tagPart(incl,'inclinaison');

  /* ---------- groupe incliné : moteur, lame, carter, protecteur, poignée ---------- */
  const tilt = new THREE.Group(); tilt.position.set(0,TABLE_Y,0); carriage.add(tilt);
  const hy=HY-TABLE_Y;
  const slider = new THREE.Group(); tilt.add(slider);
  add(slider, rbox(0.08,0.06,0.07,M.dark,0.008), 0,RA,-0.10);
  add(slider, rbox(0.05,RA-hy-0.08,0.06,MI.cast,0.008), 0.08,(RA+hy+0.08)/2,-0.10);
  add(slider, cyl(0.011,0.10,M.steel,10,'x'), 0.08,RA,-0.05); add(slider, new THREE.Mesh(new THREE.SphereGeometry(0.02,12,8),M.red), 0.135,RA,-0.05);
  tagPart(slider,'inclinaison');
  // 08 moteur
  const moteur = new THREE.Group(); tilt.add(moteur);
  add(moteur, cyl(0.10,0.24,GRAPH,32,'x'), 0.16,hy,0);
  for(let i=0;i<8;i++) add(moteur, cyl(0.104,0.006,GRAPH,32,'x'), 0.075+i*0.024,hy,0);
  add(moteur, cyl(0.085,0.04,M.dark,32,'x'), 0.30,hy,0);
  add(moteur, rbox(0.09,0.06,0.08,GRAPH,0.008), 0.17,hy+0.12,0);
  add(moteur, cyl(0.045,0.035,M.steel,24,'x'), 0.035,hy,0);
  add(moteur, rbox(0.10,0.06,0.10,M.dark,0.008), 0.09,hy+0.075,-0.10);                  // attache au coulisseau
  tagPart(moteur,'moteur');
  // 09 lame (géométrie dans XY, tournée pour que son plan soit YZ) ; les dents de devant descendent
  const bladeO = new THREE.Group(); bladeO.position.set(0,hy,0); bladeO.rotation.y=Math.PI/2; tilt.add(bladeO);
  const bladeSpin = new THREE.Group(); bladeO.add(bladeSpin);
  // lame carbure commune (engine/kit.js, d'après la lame de la scie à format) ; elle tourne dans le sens rotation.z croissant
  bladeSpin.add(sawBlade({ R, Z:72, plate:0.0028, kerf:0.004, bore:0.03, pins:true, dir:1, mark:['Ø400 × 4,0/2,8 × 30  Z72  HW','n max 6000 RPM'] }));
  tagPart(bladeSpin,'lame');
  // 10 fixation : flasques et écrou, côté gauche de la lame
  const fix = new THREE.Group(); tilt.add(fix);
  add(fix, cyl(0.05,0.006,M.steel,32,'x'), -0.0045,hy,0);
  add(fix, cyl(0.026,0.016,M.dark,6,'x'), -0.015,hy,0);
  add(fix, cyl(0.05,0.006,M.steel,32,'x'), 0.0045,hy,0);
  tagPart(fix,'fixation');
  // 11 carter supérieur (demi-cylindre), avec étiquette « ramener la lame »
  const carter = new THREE.Group(); tilt.add(carter);
  { const g=new THREE.CylinderGeometry(R+0.02,R+0.02,0.08,48,1,false,-0.06,Math.PI+0.12); g.rotateZ(Math.PI/2);
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x2f353c,metalness:0.3,roughness:0.45,side:THREE.DoubleSide})); m.position.set(0.0,hy,0); carter.add(m);
    const lab=canvasTex(512,128,(gg,w,h)=>{ gg.fillStyle='#f0b323'; gg.fillRect(0,0,w,h); gg.fillStyle='#14181c'; gg.font='bold 34px sans-serif'; gg.fillText('⚠ RAMENER LA LAME',18,52); gg.font='bold 30px sans-serif'; gg.fillText('EN ARRIÈRE APRÈS CHAQUE COUPE',18,100); });
    const l=new THREE.Mesh(new THREE.PlaneGeometry(0.16,0.04),new THREE.MeshBasicMaterial({map:lab,toneMapped:false})); l.rotation.y=-Math.PI/2; l.position.set(-0.0405,hy+0.12,-0.02); carter.add(l);
    add(carter, rbox(0.082,0.012,0.012,M.red,0.003), 0,hy+R+0.02,0.0); }
  tagPart(carter,'carter');
  for(const m of partMeshes.carter) m.material=m.material.clone();
  // 21 aspiration : buse Ø 120 sur le carter, buse Ø 60 derrière la lame, flexible
  const asp = new THREE.Group(); tilt.add(asp);
  { const b=cyl(0.06,0.16,M.dark,28); b.rotation.x=-0.35; b.position.set(0,hy+R+0.06,-0.12); asp.add(b);
    const f=cyl(0.064,0.14,MI.hose,24); f.rotation.x=-0.05; f.position.set(0,hy+R+0.17,-0.15); asp.add(f);
    const s=cyl(0.03,0.09,M.dark,20,'x'); s.position.set(-0.08,hy-0.06,-0.15); asp.add(s); }
  tagPart(asp,'aspiration');
  // 12 protecteur avant transparent, réglable en hauteur (bord bas à prot mm de la table)
  const prot = new THREE.Group(); tilt.add(prot);
  const PZ0=0.03, PZ1=R+0.025;
  const protSides=[], CLEAR=new THREE.MeshPhysicalMaterial({color:0xcfe2ec,metalness:0,roughness:0.08,transmission:0.5,transparent:true,opacity:0.42,side:THREE.DoubleSide});
  for(const x of [-0.042,0.042]){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.004,1,PZ1-PZ0),CLEAR); m.position.set(x,0.5,(PZ0+PZ1)/2); prot.add(m); protSides.push(m); }
  { const m=new THREE.Mesh(new THREE.BoxGeometry(0.088,1,0.004),CLEAR); m.position.set(0,0.5,PZ1); prot.add(m); protSides.push(m); }
  const protEdge=new THREE.Group(); prot.add(protEdge);
  add(protEdge, rbox(0.09,0.008,0.012,M.alu,0.002), 0,0,PZ1); for(const x of [-0.044,0.044]) add(protEdge, rbox(0.006,0.008,PZ1-PZ0,M.alu,0.002), x,0,(PZ0+PZ1)/2);
  add(prot, rbox(0.012,0.14,0.016,M.alu,0.003), 0.05,hy+0.02,PZ1-0.02);                 // coulisse
  add(prot, cyl(0.016,0.016,M.dark,16,'x'), 0.062,hy+0.06,PZ1-0.02);                       // molette de serrage
  tagPart(prot,'protecteur');
  for(const m of partMeshes.protecteur) m.material=m.material.clone();
  // 13 poignée de manœuvre, devant à droite du moteur
  const poig = new THREE.Group(); tilt.add(poig);
  add(poig, cyl(0.017,0.15,M.dark,16,'x'), 0.23,hy+0.13,0.21);
  for(const x of [0.16,0.30]){ const l=link(new THREE.CylinderGeometry(0.012,0.012,1,10).rotateX(Math.PI/2),M.dark); setBetween(l,new THREE.Vector3(x,hy+0.13,0.21),new THREE.Vector3(x,hy+0.06,0.06)); poig.add(l); }
  add(poig, rbox(0.03,0.025,0.02,M.red,0.004), 0.21,hy+0.105,0.21);                       // gâchette
  tagPart(poig,'poignee');

  /* ---------- 22 Boîtier de commande, 23 arrêt d'urgence (devant, à gauche) ---------- */
  const cmd = new THREE.Group(); root.add(cmd);
  add(cmd, rbox(0.16,0.20,0.09,GRAPH,0.01), -0.52,TABLE_Y-0.17,TABLE_Z1-0.03);
  { const t=canvasTex(256,320,(g,w,h)=>{ g.fillStyle='#2f363d'; g.fillRect(0,0,w,h); g.fillStyle='#e9ecef'; g.font='italic 700 30px "Barlow Condensed",sans-serif'; g.fillText('KANAK 900 R',20,40);
      const b=(x,y,c,t)=>{ g.fillStyle='#14181c'; g.fillRect(x-34,y-34,68,68); g.fillStyle=c; g.beginPath(); g.arc(x,y,25,0,7); g.fill(); g.fillStyle=c==='#f2f2ee'?'#111':'#fff'; g.font='bold 24px sans-serif'; g.fillText(t,x-7,y+8); };
      b(70,110,'#f2f2ee','I'); b(180,110,'#14181c','O'); g.fillStyle='#e9ecef'; g.font='18px sans-serif'; g.fillText('lame',100,175); });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.15,0.19),new THREE.MeshBasicMaterial({map:t,toneMapped:false})); m.position.set(-0.52,TABLE_Y-0.17,TABLE_Z1+0.0155); cmd.add(m); }
  tagPart(cmd,'commande');
  const au = new THREE.Group(); root.add(au);
  add(au, rbox(0.10,0.10,0.03,M.yellow,0.006), -0.36,TABLE_Y-0.15,TABLE_Z1-0.01);
  add(au, cyl(0.03,0.035,M.red,24,'z'), -0.36,TABLE_Y-0.15,TABLE_Z1+0.02);
  add(au, cyl(0.018,0.02,M.dark,16,'z'), -0.36,TABLE_Y-0.15,TABLE_Z1+0.006);
  tagPart(au,'arret');

  /* ---------- main de maintien (pas un organe : non cliquable) ---------- */
  const hand = new THREE.Group(); root.add(hand);
  { const palm=rbox(0.085,0.026,0.095,SKIN,0.012); palm.position.set(0,0.016,0.03); hand.add(palm);
    [[-0.030,0.075],[-0.010,0.085],[0.010,0.083],[0.029,0.072]].forEach(([x,l])=>{ const f=new THREE.Mesh(new THREE.CapsuleGeometry(0.0085,l-0.017,4,10),SKIN); f.rotation.x=Math.PI/2; f.position.set(x,0.012,-0.017-l/2+0.008); hand.add(f); });
    const th=new THREE.Mesh(new THREE.CapsuleGeometry(0.010,0.04,4,10),SKIN); th.rotation.set(Math.PI/2,0,-0.9); th.position.set(0.055,0.012,0.03); hand.add(th);
    const wr=new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.032,0.16,16).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:0x34506e,roughness:0.8})); wr.position.set(0.0,0.045,0.15); wr.rotation.x=-0.42; hand.add(wr);
    hand.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } }); }
  const ringMat=new THREE.MeshBasicMaterial({color:0xc4261c,transparent:true,opacity:0.55,depthWrite:false});
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.075,0.09,40),ringMat); ring.rotation.x=-Math.PI/2; ring.position.y=0.001; hand.add(ring);

  /* ---------- mise à jour d'après les réglages ----------
     S = { alpha, beta (°), s (course 0 à 1), prot (mm), stopX (m), stopOn, hand:{x,y,z,show,bad}, zone:[[x,z]×4] } */
  function update(S){
    armG.rotation.y=S.alpha*Math.PI/180;
    if(S.zone) setZone(S.zone);
    const zc=zc0+S.s*STROKE; carriage.position.z=zc;
    tilt.rotation.z=S.beta*Math.PI/180;
    // ressort : de l'arrière du bras au chariot
    { const z0=A0+0.04, z1=zc-0.12; helix.position.set(0,ARM_Y+0.035,(z0+z1)/2); helix.rotation.set(0,0,0); helix.scale.set(1,1,Math.max(0.01,z1-z0)); }   // ressort dans le bras (repère du bras)
    // protecteur : bord bas à prot mm de la table
    const h=Math.min(hy-0.02,Math.max(0,S.prot/1000)), H=Math.max(0.005,hy-h);
    for(const m of protSides){ m.scale.y=H; m.position.y=h+H/2; } protEdge.position.y=h;
    // butée : position et relevage
    butee.position.x=S.stopX; flip.rotation.x= S.stopOn? 0 : -1.85;
    // main de maintien
    hand.visible=!!S.hand.show; if(S.hand.show){ hand.position.set(S.hand.x,S.hand.y,S.hand.z); ring.visible=!!S.hand.bad; }
  }
  /* animation de la lame (ralentie à l'affichage) ; rend la vitesse relative (0 à 1) */
  let spin=0;
  function tick(dt, motorOn){ spin+=((motorOn?1:0)-spin)*Math.min(1,dt*0.8); bladeSpin.rotation.z+=spin*dt*1.3; return spin; }
  const pieceRoot=new THREE.Group(); root.add(pieceRoot);
  return { update, tick, pieceRoot, get spin(){ return spin; }, stopNow(){ spin=0; } };
}
