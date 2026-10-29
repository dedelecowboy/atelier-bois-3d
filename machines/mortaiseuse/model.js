/* Modèle 3D de la mortaiseuse à bédane oscillant horizontal « KANAK 130 MB » (d'après la mortaiseuse de l'atelier et le
   catalogue du constructeur : bâti gris clair à plaque bleue, table mobile en X, portique noir à deux vérins verticaux,
   deux vérins horizontaux, tête de mortaisage derrière le guide sous un capot insonorisé, hotte d'aspiration jaune, tableau
   de commande bleu, armoire électrique et groupe hydraulique à droite). Marque fictive : ne pas afficher la marque réelle.
   PROPORTIONS ESTIMÉES. Le bédane n'a pas de sens de rotation : il oscille (balancier) le long de X pendant qu'il avance
   vers l'opérateur (+Z) dans la pièce ; l'oscillation est ralentie à l'affichage. */
import * as THREE from 'three';
import { M, MI, rbox, add, cyl, canvasTex, rulerTex } from '../../engine/kit.js';
import { TABLE_Y, TABLE_W, TABLE_D, TABLE_Z0, FENCE_Z, XC0, XBG, XBD, BED_T, REF0, BEDANES } from './constants.js';
import { st, tool } from './state.js';

export function buildModel({ root, tagPart, partMeshes }){
  const GREYW = new THREE.MeshStandardMaterial({color:0xdde2e6, metalness:0.15, roughness:0.5});
  const BLUE  = new THREE.MeshStandardMaterial({color:0x1f5fa8, metalness:0.25, roughness:0.45});
  const BLUEL = new THREE.MeshStandardMaterial({color:0x2c7fd0, metalness:0.2, roughness:0.4});
  const BLACK = new THREE.MeshStandardMaterial({color:0x22262a, metalness:0.35, roughness:0.55});
  const STEELT= new THREE.MeshStandardMaterial({color:0x4b5157, metalness:0.7, roughness:0.45});
  const BEIGE = new THREE.MeshStandardMaterial({color:0xd9d4c4, metalness:0.1, roughness:0.55});
  const YEL   = new THREE.MeshStandardMaterial({color:0xf2c418, metalness:0.1, roughness:0.45});
  const RED   = new THREE.MeshStandardMaterial({color:0xd8261c, roughness:0.45});
  const FOAM  = new THREE.MeshStandardMaterial({color:0x3a3d40, roughness:0.95});
  const CHROME= new THREE.MeshStandardMaterial({color:0xd7dde2, metalness:0.95, roughness:0.18});
  const regPart=(g,code)=>{ partMeshes[code]=[]; g.traverse(o=>{ if(o.isMesh){ o.castShadow=o.receiveShadow=true; o.userData.part=code; partMeshes[code].push(o); } }); };
  const box=(p,w,h,d,mat,x,y,z,r=0.004)=>add(p,rbox(w,h,d,mat,r),x,y,z);
  const label=(parent,w,h,draw,pos,rot=[0,0,0])=>{ const t=canvasTex(1024,Math.max(16,Math.round(1024*h/w)),draw); const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false}));
    m.position.set(...pos); m.rotation.set(...rot); parent.add(m); document.fonts?.ready.then(()=>{ const g=t.userData.canvas.getContext('2d'); g.clearRect(0,0,t.userData.canvas.width,t.userData.canvas.height); draw(g,t.userData.canvas.width,t.userData.canvas.height); t.needsUpdate=true; }); return m; };
  const TZ1=TABLE_Z0+TABLE_D;                         // bord avant de la table

  /* ---------- Bâti ---------- */
  const bati=new THREE.Group(); root.add(bati);
  box(bati,0.84,0.76,0.82,GREYW,0,0.42,-0.29,0.012);                       // caisson
  box(bati,0.80,0.05,0.78,BLACK,0,0.025,-0.29,0.006);                      // socle
  box(bati,0.52,0.08,0.30,GREYW,0,0.84,0.0,0.006);                         // glissières de la table
  box(bati,0.60,0.012,0.03,STEELT,0,0.885,0.13,0.002); box(bati,0.60,0.012,0.03,STEELT,0,0.885,-0.10,0.002);
  box(bati,0.56,0.52,0.42,GREYW,0.02,1.06,-0.50,0.01);                    // colonne de la tête, derrière le guide
  box(bati,0.03,0.03,0.40,STEELT,-0.16,0.93,-0.42,0.003); box(bati,0.03,0.03,0.40,STEELT,0.20,0.93,-0.42,0.003);   // glissières de la tête
  // plaque bleue « KANAK » en façade
  box(bati,0.40,0.36,0.006,BLUE,-0.02,0.40,0.123,0.004);
  label(bati,0.30,0.14,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#fff'; g.font=`italic 700 ${h*0.52}px "Barlow Condensed","Arial Narrow",sans-serif`; g.fillText('KANAK',w*0.06,h*0.55);
    g.font=`600 ${h*0.30}px "Barlow Condensed",sans-serif`; g.fillText('130 MB',w*0.08,h*0.92); },[-0.02,0.49,0.127]);
  label(bati,0.30,0.05,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#e8f0fa'; g.font=`${h*0.55}px sans-serif`; g.fillText('Mortaiseuse à bédane oscillant',w*0.04,h*0.7); },[-0.02,0.37,0.127]);
  label(bati,0.22,0.12,(g,w,h)=>{ g.fillStyle='#d4d7da'; g.fillRect(0,0,w,h); g.fillStyle='#1b2228'; g.font='italic 700 96px "Barlow Condensed",sans-serif'; g.fillText('KANAK 130 MB',24,104);
    g.font='38px sans-serif'; g.fillText('Mortaise 275 × 160 max · profondeur 130',24,190); g.fillText('table 1 000 × 310 · course 400 / 150',24,250); g.fillText('2,2 kW + groupe hydraulique 0,75 kW · 400 V',24,310); g.fillText('Air 6 à 8 bar · aspiration Ø 80',24,370); },[-0.421,0.55,-0.10],[0,-Math.PI/2,0]);
  tagPart(bati,'bati');
  for(const m of partMeshes.bati) m.material=m.material.clone();

  /* ---------- Groupe hydraulique (bleu, à droite) ---------- */
  const hyd=new THREE.Group(); root.add(hyd);
  box(hyd,0.20,0.52,0.42,BLUE,0.52,0.36,-0.32,0.01);
  for(let i=0;i<8;i++) box(hyd,0.004,0.012,0.30,BLACK,0.621,0.20+i*0.035,-0.32,0.001);
  add(hyd, cyl(0.03,0.10,STEELT,16), 0.52,0.66,-0.40);
  tagPart(hyd,'hydraulique');

  /* ---------- Armoire électrique et interrupteur général cadenassable ---------- */
  const arm=new THREE.Group(); root.add(arm);
  box(arm,0.22,0.52,0.30,BEIGE,0.43,1.10,-0.44,0.008);
  label(arm,0.06,0.09,(g,w,h)=>{ g.fillStyle='#f2c200'; g.fillRect(0,0,w,h); g.fillStyle='#111'; g.beginPath(); g.moveTo(w/2,h*0.12); g.lineTo(w*0.88,h*0.82); g.lineTo(w*0.12,h*0.82); g.closePath(); g.lineWidth=10; g.strokeStyle='#111'; g.stroke(); g.font=`bold ${h*0.4}px sans-serif`; g.fillText('⚡',w*0.34,h*0.72); },[0.48,1.26,-0.289]);
  tagPart(arm,'armoire');
  const secG=new THREE.Group(); secG.position.set(0.541,1.12,-0.40); root.add(secG);
  { add(secG, rbox(0.006,0.10,0.10,M.yellow,0.003)); const h=new THREE.Group(); h.position.x=0.006; secG.add(h); add(h, cyl(0.025,0.014,M.red,20,'x')); const lv=rbox(0.018,0.075,0.02,M.red,0.004); lv.position.x=0.012; h.add(lv); secG.userData.h=h;
    const pad=new THREE.Group(); pad.position.set(0.03,-0.035,0.035); add(pad, rbox(0.014,0.03,0.026,M.yellow,0.003)); const sh=new THREE.Mesh(new THREE.TorusGeometry(0.009,0.0022,6,16,Math.PI),M.steel); sh.rotation.y=Math.PI/2; sh.position.y=0.016; pad.add(sh); secG.add(pad); secG.userData.pad=pad; }
  tagPart(secG,'sectionneur');

  /* ---------- Guide (fixe) et rallonges, avec la fenêtre du bédane ---------- */
  const guide=new THREE.Group(); root.add(guide);
  const GX0=-1.70, GX1=1.70, WIN=[-0.075,0.105], GH=0.06;
  const ALU=new THREE.MeshStandardMaterial({ color:0xffffff, metalness:0.5, roughness:0.4, map: canvasTex(512,128,(g,w,h)=>{ g.fillStyle='#cbd0d4'; g.fillRect(0,0,w,h);
    for(let i=0;i<900;i++){ g.fillStyle=`rgba(${130+Math.random()*80|0},${135+Math.random()*80|0},${140+Math.random()*80|0},.25)`; g.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*6,1); } }) });
  for(const [a,b] of [[GX0,WIN[0]],[WIN[1],GX1]]){ box(guide,b-a,GH,0.045,ALU,(a+b)/2,TABLE_Y+GH/2,FENCE_Z-0.0225,0.003);
    const r=new THREE.Mesh(new THREE.PlaneGeometry(b-a,0.025),new THREE.MeshStandardMaterial({map:rulerTex(Math.round((b-a)*1000)),roughness:0.6})); r.rotation.x=-Math.PI/2; r.position.set((a+b)/2,TABLE_Y+GH+0.0006,FENCE_Z-0.015); guide.add(r); }
  for(const x of [GX0+0.10,-0.62,0.62,GX1-0.10]){ box(guide,0.05,0.10,0.05,STEELT,x,TABLE_Y-0.05,FENCE_Z-0.03,0.004); }
  for(const x of [GX0+0.10,GX1-0.10]) box(guide,0.04,TABLE_Y-0.06,0.04,STEELT,x,(TABLE_Y-0.06)/2,FENCE_Z-0.03,0.004);   // pieds des rallonges
  tagPart(guide,'guide');
  // support perforé du pare-éclat, autour de la fenêtre du bédane
  const pe=new THREE.Group(); root.add(pe);
  const PERF=new THREE.MeshStandardMaterial({ color:0xffffff, metalness:0.6, roughness:0.4, map: canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#b9c0c6'; g.fillRect(0,0,w,h); g.fillStyle='#5b636a'; for(let y=8;y<h;y+=16) for(let x=(y/16%2)*8+8;x<w;x+=16){ g.beginPath(); g.arc(x,y,4,0,7); g.fill(); } }) });
  box(pe,0.40,0.08,0.006,PERF,0.015,TABLE_Y+GH+0.18,FENCE_Z-0.05,0.002); box(pe,0.12,0.16,0.006,PERF,-0.135,TABLE_Y+GH+0.06,FENCE_Z-0.05,0.002); box(pe,0.11,0.16,0.006,PERF,0.16,TABLE_Y+GH+0.06,FENCE_Z-0.05,0.002);
  tagPart(pe,'guide');

  /* ---------- Butées gauche et droite (doigts relevables sur le guide), cale de référence ---------- */
  const butee=(x,side)=>{ const g=new THREE.Group(); g.position.set(x,TABLE_Y+GH+0.01,FENCE_Z-0.02); root.add(g);
    box(g,0.05,0.04,0.05,BLACK,-side*0.03,0.01,0,0.006);
    const piv=new THREE.Group(); piv.position.set(-side*0.006,0.0,0.012); g.add(piv);
    const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(0.015,0); s.lineTo(0.015,-0.06); s.lineTo(0.045,-0.10); s.lineTo(0,-0.10); s.closePath();
    const geo=new THREE.ExtrudeGeometry(s,{depth:0.012,bevelEnabled:false}); geo.translate(0,0,-0.006); geo.rotateY(-Math.PI/2);
    const f=new THREE.Mesh(geo,BLACK); f.scale.x=side; piv.add(f); g.userData.piv=piv; return g; };
  const bG=butee(XBG,-1), bD=butee(XBD,1);
  // doigts : ils descendent devant le guide, contre le bout de la pièce (bord du doigt sur la butée)
  tagPart(bG,'butee_g'); tagPart(bD,'butee_d');

  /* ---------- Table mobile, règle et taquets de la table, cale de référence, portique et vérins ---------- */
  const tbl=new THREE.Group(); root.add(tbl);
  const TOP=new THREE.MeshStandardMaterial({ color:0xffffff, metalness:0.6, roughness:0.5, map: canvasTex(512,256,(g,w,h)=>{ g.fillStyle='#5a6066'; g.fillRect(0,0,w,h);
    for(let i=0;i<2600;i++){ g.fillStyle=`rgba(${70+Math.random()*60|0},${75+Math.random()*60|0},${80+Math.random()*60|0},.35)`; g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*4,1); } }) });
  const tableTop=new THREE.Group(); tbl.add(tableTop);
  box(tableTop,TABLE_W,0.035,TABLE_D,TOP,0,TABLE_Y-0.0175,(TABLE_Z0+TZ1)/2,0.003);
  box(tableTop,TABLE_W,0.05,0.02,ALU,0,TABLE_Y-0.06,TZ1-0.01,0.003);
  box(tableTop,0.34,0.10,0.24,GREYW,0,TABLE_Y-0.09,0.03,0.006);
  tagPart(tableTop,'table');
  // règle et taquets de la table (sous le bord avant) : distance de la mortaise
  const rT=new THREE.Group(); tbl.add(rT);
  { const r=new THREE.Mesh(new THREE.PlaneGeometry(0.40,0.03),new THREE.MeshStandardMaterial({map:rulerTex(400),roughness:0.6})); r.position.set(0.0,TABLE_Y-0.065,TZ1+0.0012); rT.add(r);
    box(rT,0.44,0.012,0.01,STEELT,0,TABLE_Y-0.088,TZ1+0.004,0.002); }
  const tqM=[0x2f9a4e,0xe8a020,0xc4261c,0x2a7bd8].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:0.5}));
  const tq=[0,1,2,3].map(i=>{ const g=new THREE.Group(); rT.add(g); box(g,0.016,0.014,0.016,tqM[i],0,0,0,0.002); add(g, cyl(0.003,0.006,M.dark,8,'z'),0,0,0.009); return g; });
  tagPart(rT,'regle_table');
  // cale de référence (rouge), à gauche, devant la butée gauche
  const cale=new THREE.Group(); tbl.add(cale); box(cale,0.16,0.006,0.10,RED,XBG-0.085,TABLE_Y+0.003,FENCE_Z+0.055,0.002); tagPart(cale,'cale');
  // portique noir des vérins verticaux (porté par la table)
  const port=new THREE.Group(); tbl.add(port);
  const PZ=FENCE_Z+0.035, PH=0.34;
  for(const x of [-0.46,0.46]){ box(port,0.04,PH,0.04,BLACK,x,TABLE_Y+PH/2,FENCE_Z+0.005,0.004); }
  box(port,0.96,0.05,0.035,BLACK,0,TABLE_Y+PH-0.02,PZ-0.005,0.004);
  for(const x of [-0.46,0.46]) for(const y of [0.05,0.29]) add(port, cyl(0.006,0.006,CHROME,10,'z'),x,TABLE_Y+y,FENCE_Z+0.026);
  tagPart(port,'portique');
  const vertG=new THREE.Group(); tbl.add(vertG); const horG=new THREE.Group(); tbl.add(horG);
  const vers={};
  const mkV=k=>{ const g=new THREE.Group(); vertG.add(g);
    box(g,0.05,0.05,0.06,BLUEL,0,TABLE_Y+PH-0.02,PZ,0.006);                 // bride sur la poutre
    add(g, cyl(0.022,0.17,CHROME,20), 0,TABLE_Y+PH+0.06,PZ);                // corps du vérin
    add(g, cyl(0.024,0.015,BLACK,20), 0,TABLE_Y+PH+0.15,PZ);
    const lev=rbox(0.008,0.05,0.008,BLACK,0.002); lev.position.set(0.035,TABLE_Y+PH+0.0,PZ); lev.rotation.z=-0.6; g.add(lev);
    const rod=cyl(0.008,1,CHROME,12); g.add(rod); const pad=new THREE.Group(); g.add(pad);
    add(pad, cyl(0.02,0.018,BLUEL,24),0,0.009,0); add(pad, cyl(0.016,0.006,YEL,24),0,0.0,0);
    return {g,rod,pad}; };
  const mkH=k=>{ const g=new THREE.Group(); horG.add(g);
    box(g,0.06,0.05,0.04,BLUEL,0,TABLE_Y+0.025,TZ1-0.02,0.006);             // bride au bord avant
    add(g, cyl(0.02,0.14,CHROME,20,'z'), 0,TABLE_Y+0.022,TZ1-0.11);
    const rod=cyl(0.007,1,CHROME,12,'z'); g.add(rod); const pad=new THREE.Group(); g.add(pad);
    add(pad, cyl(0.02,0.016,BLUEL,24,'z'),0,0,0.008); add(pad, cyl(0.016,0.006,YEL,24,'z'),0,0,0);
    return {g,rod,pad}; };
  vers.v1=mkV(); vers.v2=mkV(); vers.h1=mkH(); vers.h2=mkH();
  tagPart(vertG,'verin_v'); tagPart(horG,'verin_h');
  // flexibles hydrauliques des vérins (noirs), le long du portique
  const hoses=new THREE.Group(); tbl.add(hoses); const HOSE=new THREE.MeshStandardMaterial({color:0x1a1c1e,roughness:0.6});
  for(const sx of [-1,1]) hoses.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sx*0.20,TABLE_Y+PH+0.16,PZ),new THREE.Vector3(sx*0.40,TABLE_Y+PH+0.10,PZ+0.01),new THREE.Vector3(sx*0.47,TABLE_Y+PH-0.05,FENCE_Z+0.03),new THREE.Vector3(sx*0.47,TABLE_Y+0.02,FENCE_Z+0.03)]),30,0.005,8,false),HOSE));
  tagPart(hoses,'portique');

  /* ---------- Tête de mortaisage (avance en Z, hauteur = arasement), porte-bédane oscillant, bédane ---------- */
  const tete=new THREE.Group(); root.add(tete);
  box(tete,0.26,0.17,0.24,BLUE,0.02,0.03,-0.30,0.008);                       // carter de la tête (moteur, excentrique)
  box(tete,0.30,0.05,0.30,GREYW,0.02,-0.075,-0.28,0.006);                    // chariot sur les glissières
  add(tete, cyl(0.07,0.18,MI.motor,24,'x'), 0.02,0.06,-0.47);                // moteur 2,2 kW
  tagPart(tete,'tete');
  // vernier d'oscillation (sur le flanc gauche de la tête)
  const vern=new THREE.Group(); tete.add(vern);
  add(vern, cyl(0.03,0.012,CHROME,24,'x'), -0.116,0.04,-0.26);
  label(vern,0.05,0.05,(g,w,h)=>{ g.fillStyle='#e9ecee'; g.beginPath(); g.arc(w/2,h/2,w/2,0,7); g.fill(); g.strokeStyle='#222'; g.lineWidth=6;
    for(let i=0;i<=10;i++){ const a=Math.PI*(0.8+i*0.14); g.beginPath(); g.moveTo(w/2+Math.cos(a)*w*0.42,h/2+Math.sin(a)*h*0.42); g.lineTo(w/2+Math.cos(a)*w*(i%5?0.34:0.28),h/2+Math.sin(a)*h*(i%5?0.34:0.28)); g.stroke(); } },[-0.1235,0.04,-0.26],[0,-Math.PI/2,0]);
  const vNeedle=rbox(0.002,0.004,0.02,RED,0); vNeedle.position.set(-0.125,0.04,-0.26); vern.add(vNeedle);
  tagPart(vern,'vernier');
  // réglage de la hauteur (arasement) : écrou de 27 et compteur, sur le dessus de la tête, sous le capot
  const regH=new THREE.Group(); tete.add(regH);
  box(regH,0.05,0.035,0.045,BLACK,-0.05,0.135,-0.25,0.004);
  add(regH, new THREE.Mesh(new THREE.CylinderGeometry(0.0155,0.0155,0.03,6),STEELT), -0.05,0.168,-0.25);      // écrou de 27
  const cTex=canvasTex(256,64,()=>{}); const cDisp=new THREE.Mesh(new THREE.PlaneGeometry(0.04,0.01),new THREE.MeshBasicMaterial({map:cTex,toneMapped:false})); cDisp.position.set(-0.05,0.135,-0.2272); regH.add(cDisp);
  let cLast=null; const setCounter=v=>{ const n=Math.round(Math.max(0,v)*10), s=String(Math.floor(n/10)).padStart(4,'0')+String(n%10); if(s===cLast) return; cLast=s;
    const c=cTex.userData.canvas.getContext('2d'); c.fillStyle='#111'; c.fillRect(0,0,256,64); c.font='bold 44px monospace'; c.fillStyle='#f0f0f0'; c.fillText(s.slice(0,4).split('').join(' '),10,48); c.fillStyle='#e02818'; c.fillRect(196,6,54,52); c.fillStyle='#fff'; c.fillText(s[4],210,48); cTex.needsUpdate=true; };
  tagPart(regH,'reglage_haut');
  /* bédane monobloc (d'après les photos fournies par l'enseignant) : pointe en fourche (deux éperons et un V),
     dents en escalier sur un chant (évacuation des copeaux), col évasé, talon plus épais percé de 2 trous (Ø 15 et Ø 14), marquage gravé.
     Repère local : pointe en z = 0, corps vers −Z, épaisseur E le long de +Y (de 0 à E), largeur de coupe le long de X. */
  const BEDS=new THREE.MeshStandardMaterial({color:0xaeb6bd, metalness:0.45, roughness:0.38}), EDGE=new THREE.MeshStandardMaterial({color:0xdfe4e8, metalness:0.5, roughness:0.2});
  function bedMesh(t){ const g=new THREE.Group(), E=t.E/1000, w=BED_T/2000, S=0.0195, Z1=-0.150, Z2=-0.168, Z3=-0.240, br=t.etat==='ebreche';
    const s=new THREE.Shape(); s.moveTo(-w,Z1); s.lineTo(-w,0); s.lineTo(-w+0.004,-0.004); s.lineTo(0,-0.011);
    if(br){ s.lineTo(w-0.005,-0.008); s.lineTo(w-0.003,-0.012); s.lineTo(w,-0.016); }      // éperon cassé
    else { s.lineTo(w-0.004,-0.004); s.lineTo(w,0); s.lineTo(w,-0.007); }
    for(let i=0;i<11;i++){ const z0=-0.015-i*0.0103; if(br&&i<2){ if(i===1) s.lineTo(w-0.0005,z0-0.002); continue; } s.lineTo(w+0.0009,z0); s.lineTo(w-0.0025,z0-0.0022); }
    s.lineTo(w,-0.130); s.lineTo(w,Z1); s.quadraticCurveTo(w,Z2+0.004,S,Z2); s.lineTo(-S,Z2); s.quadraticCurveTo(-w,Z2+0.004,-w,Z1);
    const bg=new THREE.ExtrudeGeometry(s,{depth:E,bevelEnabled:false,curveSegments:6}); bg.rotateX(Math.PI/2); bg.translate(0,E,0);
    g.add(new THREE.Mesh(bg,[BEDS,EDGE]));
    const Es=Math.max(0.014,E+0.002), k=new THREE.Shape(); k.moveTo(-S,Z2+0.002); k.lineTo(-S,Z3); k.lineTo(S,Z3); k.lineTo(S,Z2+0.002); k.lineTo(-S,Z2+0.002);
    for(const [z,r] of [[-0.184,0.0075],[-0.214,0.007]]){ const h=new THREE.Path(); h.absarc(0,z,r,0,Math.PI*2,true); k.holes.push(h); }
    const kg=new THREE.ExtrudeGeometry(k,{depth:Es-0.0012,bevelEnabled:true,bevelThickness:0.0006,bevelSize:0.0006,bevelSegments:1,curveSegments:16}); kg.rotateX(Math.PI/2); kg.translate(0,E/2+Es/2-0.0006,0);
    g.add(new THREE.Mesh(kg,BEDS));
    const tx=canvasTex(512,64,(c,W,H)=>{ c.clearRect(0,0,W,H); c.font='bold 40px monospace'; c.fillStyle='rgba(40,44,48,0.85)'; c.fillText(`${t.E}/20/150`,14,46); });
    const lab=new THREE.Mesh(new THREE.PlaneGeometry(0.056,0.007).rotateX(-Math.PI/2).rotateY(-Math.PI/2),new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false}));
    lab.position.set(-0.003,E+0.0003,-0.085); g.add(lab);
    return g; }
  // porte-bédane (oscille en X) et bédane
  const osc=new THREE.Group(); tete.add(osc);
  const holder=new THREE.Group(); osc.add(holder);
  box(holder,0.05,0.07,0.06,STEELT,0,0.02,-0.23,0.005);
  const bolt=new THREE.Group(); bolt.position.set(0,0.06,-0.22); holder.add(bolt);
  bolt.add(new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.012,6),CHROME)); add(bolt, cyl(0.004,0.03,CHROME,8),0,-0.018,0);
  tagPart(holder,'porte_outil');
  const bedG=new THREE.Group(); osc.add(bedG);
  let bedKey='';
  function buildBed(){ while(bedG.children.length){ const c=bedG.children.pop(); c.traverse(o=>{ o.geometry?.dispose(); if(o.material&&!Array.isArray(o.material)) o.material.map?.dispose(); }); } const t=tool(); if(!t){ regPart(bedG,'bedane'); return; }
    bedG.add(bedMesh(t)); regPart(bedG,'bedane'); }
  tagPart(bedG,'bedane');

  /* ---------- Capot de protection insonorisé (relevable, interverrouillé) ---------- */
  const capot=new THREE.Group(); capot.position.set(0,TABLE_Y+0.46,-0.68); root.add(capot);
  { const W=0.50, cx=0.02;
    box(capot,W,0.015,0.55,GREYW,cx,0,0.275,0.004);                        // dessus
    box(capot,W,0.30,0.015,GREYW,cx,-0.15,0.545,0.004);                    // face avant (au-dessus du guide)
    for(const x of [cx-W/2,cx+W/2]) box(capot,0.015,0.30,0.55,GREYW,x,-0.15,0.275,0.004);
    // mousse insonorisante (alvéoles) à l'intérieur
    const foamT=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#2a2d30'; g.fillRect(0,0,w,h); for(let y=0;y<h;y+=32) for(let x=0;x<w;x+=32){ const gr=g.createRadialGradient(x+16,y+16,2,x+16,y+16,16); gr.addColorStop(0,'#55595d'); gr.addColorStop(1,'#232527'); g.fillStyle=gr; g.fillRect(x,y,32,32); } });
    foamT.wrapS=foamT.wrapT=THREE.RepeatWrapping; foamT.repeat.set(4,4);
    const fm=new THREE.MeshStandardMaterial({map:foamT,roughness:1}); box(capot,W-0.04,0.012,0.50,fm,cx,-0.012,0.27,0.002); box(capot,W-0.04,0.26,0.012,fm,cx,-0.14,0.53,0.002);
    const hb=cyl(0.01,0.16,BLACK,12,'x'); hb.position.set(cx,-0.04,0.565); capot.add(hb);
    label(capot,0.09,0.06,(g,w,h)=>{ g.fillStyle='#f2c200'; g.fillRect(0,0,w,h); g.fillStyle='#111'; g.font=`bold ${h*0.26}px sans-serif`; g.fillText('CAPOT',w*0.1,h*0.4); g.fillText('VERROUILLÉ',w*0.04,h*0.78); },[cx+0.17,-0.12,0.5535]); }
  tagPart(capot,'capot');
  for(const m of partMeshes.capot) m.material=m.material.clone();

  /* ---------- Aspiration : hotte jaune à droite du bédane, flexible ; soufflerie ---------- */
  const asp=new THREE.Group(); root.add(asp);
  { const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(0.17,0); s.lineTo(0.17,0.06); s.lineTo(0.06,0.13); s.lineTo(0,0.13); s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:0.12,bevelEnabled:false}); g.translate(0,0,-0.06); const m=new THREE.Mesh(g,YEL); m.position.set(0.11,TABLE_Y+GH+0.005,FENCE_Z-0.13); asp.add(m);
    add(asp, cyl(0.042,0.12,YEL,24), 0.14,TABLE_Y+GH+0.19,FENCE_Z-0.13);
    const hoseTex=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#c9ccc9'; g.fillRect(0,0,w,h); g.fillStyle='#8d918e'; g.fillRect(0,0,w,14); }); hoseTex.wrapS=hoseTex.wrapT=THREE.RepeatWrapping; hoseTex.repeat.set(70,1);
    asp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.14,TABLE_Y+GH+0.24,FENCE_Z-0.13),new THREE.Vector3(0.15,TABLE_Y+0.55,-0.40),new THREE.Vector3(0.30,1.95,-0.90),new THREE.Vector3(0.30,2.70,-1.05)]),60,0.042,14,false),new THREE.MeshStandardMaterial({map:hoseTex,roughness:0.55,transparent:true,opacity:0.92}))); }
  tagPart(asp,'aspiration');
  const souf=new THREE.Group(); root.add(souf);
  souf.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.20,TABLE_Y+0.30,-0.30),new THREE.Vector3(-0.12,TABLE_Y+0.16,-0.22),new THREE.Vector3(-0.07,TABLE_Y+0.09,FENCE_Z-0.06)]),24,0.004,8,false),new THREE.MeshStandardMaterial({color:0x2a6fd0,roughness:0.5})));
  add(souf, cyl(0.006,0.025,CHROME,10,'z'), -0.07,TABLE_Y+0.09,FENCE_Z-0.05);
  tagPart(souf,'aspiration');

  /* ---------- Règle et taquets de profondeur (derrière le bâti, à gauche) ---------- */
  const rP=new THREE.Group(); root.add(rP);
  const RPX=-0.423, RPY=0.80, RPZ0=-0.24, rz=r=>RPZ0-r/1000*1.0;
  { box(rP,0.006,0.11,0.26,GREYW,RPX,RPY,RPZ0-0.11,0.002);
    const r=new THREE.Mesh(new THREE.PlaneGeometry(0.22,0.022),new THREE.MeshStandardMaterial({map:rulerTex(220),roughness:0.6})); r.rotation.y=-Math.PI/2; r.position.set(RPX-0.0035,RPY+0.042,RPZ0-0.11); rP.add(r);
    for(let i=0;i<3;i++) box(rP,0.008,0.012,0.24,BLACK,RPX-0.006,RPY+0.012-i*0.026,RPZ0-0.11,0.001);
    label(rP,0.12,0.03,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#333'; g.font=`${h*0.6}px sans-serif`; g.fillText('PROFONDEUR · réf. 0 = 71',4,h*0.75); },[RPX-0.004,RPY+0.075,RPZ0-0.11],[0,-Math.PI/2,0]); }
  const tqD=new THREE.Group(), tqA=new THREE.Group(); rP.add(tqD,tqA);
  for(const [g,y,c] of [[tqD,RPY+0.012,0x9aa1a7],[tqA,RPY-0.014,0x9aa1a7]]){ box(g,0.02,0.02,0.022,new THREE.MeshStandardMaterial({color:c,metalness:0.6,roughness:0.4}),RPX-0.014,y,0,0.002); add(g, cyl(0.004,0.006,M.dark,8,'x'),RPX-0.025,y,0); }
  const curs=new THREE.Group(); rP.add(curs); box(curs,0.012,0.07,0.004,RED,RPX-0.016,RPY+0.005,0,0.001);
  tagPart(rP,'taquets_prof');

  /* ---------- Tableau de commande (boîtier bleu sur colonne, à droite) ---------- */
  const pup=new THREE.Group(); pup.position.set(0.30,1.52,-0.34); pup.rotation.x=-0.45; root.add(pup);
  add(root, cyl(0.025,0.22,GREYW,14), 0.30,1.38,-0.40);
  box(pup,0.36,0.22,0.10,BLUE,0,0,-0.05,0.01);
  const PW=0.32, PHh=0.18;
  const panTex=canvasTex(640,360,(g,w,h)=>{ g.fillStyle='#2a74c4'; g.fillRect(0,0,w,h); g.strokeStyle='#e9eef4'; g.lineWidth=3;
    g.fillStyle='#f2f4f6'; g.font='italic 700 30px "Barlow Condensed",sans-serif'; g.fillText('KANAK',22,42);
    const ic=(x,y,t)=>{ g.fillStyle='#f2f4f6'; g.font='bold 20px sans-serif'; g.textAlign='center'; g.fillText(t,x,y); g.textAlign='left'; };
    ic(250,92,'▯▯ / ▯|▯'); ic(390,92,'⇕ bédane'); ic(530,92,'⇔ table'); ic(110,212,'⇩'); ic(250,212,'AUTO / MAN'); ic(390,212,'⟳'); ic(470,212,'⇧'); ic(560,212,'⇩'); });
  const pan=new THREE.Mesh(new THREE.PlaneGeometry(PW,PHh),new THREE.MeshBasicMaterial({map:panTex,toneMapped:false})); pan.position.z=0.0005; pup.add(pan);
  const P2=(u,v)=>[(u/640-0.5)*PW,(0.5-v/360)*PHh,0.002];
  tagPart(pup,'pupitre');
  const knob=(code,u,v)=>{ const g=new THREE.Group(); g.position.set(...P2(u,v)); pup.add(g); add(g, cyl(0.016,0.012,BLACK,20,'z'),0,0,0.006);
    const lv=rbox(0.006,0.024,0.008,new THREE.MeshStandardMaterial({color:0xf4f4f4,roughness:0.4}),0.001); lv.position.z=0.014; g.add(lv); tagPart(g,code); return g; };
  const push=(code,u,v,col)=>{ const g=new THREE.Group(); g.position.set(...P2(u,v)); pup.add(g); const ring=new THREE.Mesh(new THREE.TorusGeometry(0.016,0.002,8,24),M.alu); ring.position.z=0.002; g.add(ring);
    const b=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,0.012,20),new THREE.MeshStandardMaterial({color:col,roughness:0.3,metalness:0.1})); b.rotation.x=Math.PI/2; b.position.z=0.008; g.add(b); tagPart(g,code); return b; };
  const auG=new THREE.Group(); auG.position.set(...P2(110,140)); pup.add(auG);
  { const p=new THREE.Mesh(new THREE.CylinderGeometry(0.036,0.036,0.004,30),M.yellow); p.rotation.x=Math.PI/2; auG.add(p); const m=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.022,0.022,30),M.red); m.rotation.x=Math.PI/2; m.position.z=0.014; auG.add(m); auG.userData.m=m; }
  tagPart(auG,'arret_urgence');
  const kDeb=knob('pupitre',250,130), kBed=knob('sel_bedane',390,130), kTab=knob('pupitre',530,130);
  const kAuto=knob('sel_auto',250,250);
  const wL=push('btn_verins',110,260,0xf2f2f2), wR=push('btn_verins',560,260,0xf2f2f2);
  const greenB=push('marche',390,260,0x1f9a4a), blackB=push('btn_depression',470,260,0x1c1c1c);

  /* ---------- Pompe de graissage manuelle, râtelier des bédanes, clé du porte-bédane ---------- */
  const gr=new THREE.Group(); root.add(gr); box(gr,0.05,0.05,0.03,M.yellow,-0.30,0.66,0.13,0.006); add(gr, cyl(0.012,0.03,BLACK,14,'z'),-0.30,0.66,0.155);
  for(const x of [-0.355,-0.34]) add(gr, cyl(0.004,0.004,BLACK,8,'z'),x,0.60,0.124);
  tagPart(gr,'bati');
  const rack=new THREE.Group(); root.add(rack);
  box(rack,0.012,0.10,0.30,GREYW,-0.427,0.66,-0.40,0.003);
  // bédanes accrochés pointe en bas, à plat contre le panneau (la place du bédane monté reste vide)
  const rackBed=BEDANES.map((b,i)=>{ const m=bedMesh(b), Es=Math.max(0.014,b.E/1000+0.002);
    m.setRotationFromMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,-1,0)));
    m.position.set(-0.4335-Math.max(0,Es/2-b.E/2000),0.475,-0.525+i*0.047); rack.add(m); add(rack, cyl(0.0045,0.03,CHROME,10,'x'),-0.44,0.475+0.184,-0.525+i*0.047); return {id:b.id,m}; });
  tagPart(rack,'ratelier');
  const cle=new THREE.Group(); root.add(cle);
  { const T=new THREE.MeshStandardMaterial({color:0x2c2f33,metalness:0.6,roughness:0.5}); const c=new THREE.Group(); c.position.set(-0.44,1.10,-0.62); cle.add(c);
    add(c, cyl(0.008,0.16,T,10),0,0,0); const a=cyl(0.007,0.12,T,10); a.position.set(0,0.11,0.04); a.rotation.x=0.9; c.add(a); const b=cyl(0.007,0.12,T,10); b.position.set(0,0.11,-0.04); b.rotation.x=-0.9; c.add(b);
    add(c, cyl(0.013,0.06,CHROME,12),0,-0.11,0); }
  tagPart(cle,'cle');

  const pieceRoot=new THREE.Group(); root.add(pieceRoot);

  /* ---------- mise à jour d'après les réglages ---------- */
  const verX=v=>XBG+v/1000;                         // patins des vérins : repère de la table (depuis la butée gauche)
  function update(piece){ const t=tool(), Hp=piece? piece.H/1000 : 0, Dp=piece? piece.D/1000 : 0;
    tbl.position.x=st.X;
    // taquets de la table (sous le bord avant) : position lue sur la règle (0 à droite, la table part vers la droite)
    st.tq.forEach((v,i)=>{ const g=tq[i]; g.visible=v!==null&&v!==undefined; if(g.visible) g.position.set(0.20-v/1000,TABLE_Y-0.07+i*0.0,TZ1+0.009); });
    // vérins : patins sur la pièce (en pression) ou relevés de 30 mm
    for(const k of ['v1','v2']){ const V=vers[k], x=verX(st.ver[k]); V.g.position.x=x; const yb=TABLE_Y+(piece? Hp : 0.05)+(st.press&&piece?0:0.03), y1=TABLE_Y+PH-0.02;
      V.pad.position.set(0,yb,PZ); V.rod.scale.y=Math.max(0.01,y1-yb-0.012); V.rod.position.set(0,(y1+yb+0.012)/2,PZ); }
    for(const k of ['h1','h2']){ const V=vers[k], x=verX(st.ver[k]); V.g.position.x=x; const zf=FENCE_Z+(piece? Dp : 0.10)+(st.press&&piece?0:0.03), z1=TZ1-0.18;
      const y=TABLE_Y+Math.min(0.022,Math.max(0.012,Hp/2));
      V.pad.position.set(0,y,zf); V.rod.scale.z=Math.max(0.01,z1-zf-0.016); V.rod.position.set(0,y,(z1+zf+0.016)/2); }
    // tête : hauteur = arasement (bas du bédane), avance = position lue sur la règle de profondeur
    if(bedKey!==st.tool){ bedKey=st.tool; buildBed(); for(const r of rackBed) r.m.visible=r.id!==st.tool; }
    const zt=FENCE_Z+(st.R-REF0)/1000;
    tete.position.set(XC0+BED_T/2000,TABLE_Y+st.ar/1000,zt);
    bedG.visible=!!t;
    bolt.rotation.y= st.tight? 0 : 0.9; bolt.position.y= st.tight? 0.06 : 0.068;
    setCounter(st.ar);
    vNeedle.rotation.x=(st.osc-20)/30*2.4-1.2;
    // butées : doigt abaissé contre le bout de la pièce, ou relevé
    bG.userData.piv.rotation.z= st.butG? 0 : -1.3; bD.userData.piv.rotation.z= st.butD? 0 : 1.3;
    // règle de profondeur : taquets de départ et d'arrêt, curseur de la tête
    tqD.position.z=rz(st.dep); tqA.position.z=rz(st.deb? 220 : st.arr); curs.position.z=rz(st.R);
    // commandes
    auG.userData.m.position.z= st.au? 0.008 : 0.014;
    kDeb.rotation.z= st.deb? -0.8 : 0.8; kBed.rotation.z= st.bed? -0.8 : 0.8; kAuto.rotation.z= st.auto? 0.8 : -0.8;
    greenB.material.emissive?.setHex(st.on&&!st.au? 0x1f8a3a : 0); wL.material.emissive?.setHex(st.press? 0x555555 : 0); wR.material.emissive?.setHex(st.press? 0x555555 : 0);
    secG.userData.h.rotation.x= st.main? Math.PI/2 : 0; secG.userData.pad.visible=st.cad;
    capTarget= st.capot? 1.0 : 0;
  }
  /* oscillation du bédane (ralentie à l'affichage), arrêt freiné ; capot */
  let amp=0, ph=0, capTarget=0, capCur=0, tPrev=null;
  function tick(){ const now=performance.now()/1000, dt=Math.min(0.5, tPrev==null? 0 : now-tPrev); tPrev=now; let moved=false;
    const on=st.bed&&st.on&&!st.au&&st.main&&!st.cad, a0=amp; amp+=((on?1:0)-amp)*Math.min(1,dt*(on?2.6:2.2)); if(!on&&amp<0.003) amp=0;
    if((a0>0.02)!==(amp>0.02)||(a0>0.9)!==(amp>0.9)) moved=true;
    if(amp>0){ ph+=dt*6*amp; const sw=Math.max(0,(st.osc-BED_T))/1000; osc.position.x=sw*(0.5+0.5*Math.sin(ph))*Math.min(1,amp*1.2); moved=true; }
    else if(osc.position.x!==0){ osc.position.x=0; moved=true; }
    if(Math.abs(capCur-capTarget)>1e-3){ capCur+=(capTarget-capCur)*Math.min(1,dt*3); if(Math.abs(capCur-capTarget)<2e-3) capCur=capTarget; capot.rotation.x=-capCur; moved=true; }
    return moved; }
  return { update, tick, pieceRoot, get amp(){ return amp; }, stopNow(){ amp=0; osc.position.x=0; capCur=st.capot?1.0:0; capot.rotation.x=-capCur; } };
}
