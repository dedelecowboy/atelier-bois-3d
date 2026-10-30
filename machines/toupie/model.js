/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Modèle 3D de la toupie « KANAK 130 T » (d'après la toupie SCM de l'atelier à arbre fixe et pupitre électronique, guide à
   lamelles avec capot orange, protège-mains à presseurs, entraîneur à 4 rouleaux). Marque fictive : ne pas afficher la marque réelle.
   Arbre vertical fixe (non inclinable), hauteur réglée au pupitre ; vitesse par poulies étagées dans le bâti.
   Vu de dessus, l'outil tourne dans le sens anti-horaire (rotation.y croissante) : ses dents vont vers +X devant le guide,
   contre l'avance de la pièce (de +X vers −X). Rotation ralentie à l'affichage (sens lisible). */
import * as THREE from 'three';
import { M, MI, rbox, add, cyl, canvasTex, beltGeom, setBetween } from '../../engine/kit.js';
import { TABLE_Y, TABLE_X, TABLE_Z, RAL_X, HOLE_R, GUIDE_LEN, GUIDE_H, RPMS } from './constants.js';
import { st, tool, zOut } from './state.js';
import { profilePts, Dmm, marking } from './tools.js';
import { LAM_N, LAM_D, lamBand, ENT_X, ENT_ROLL_R, ENT_ROLL_W, ENT_HALF_W, ENT_ROLL_OFF } from './guide.js';

export function buildModel({ root, tagPart, partMeshes }){
  const CREAM = new THREE.MeshStandardMaterial({color:0xe9e7e0, metalness:0.12, roughness:0.55});
  const GREY  = new THREE.MeshStandardMaterial({color:0x8d9399, metalness:0.3, roughness:0.45});
  const ORANGE= new THREE.MeshStandardMaterial({color:0xe8702a, metalness:0.15, roughness:0.45});
  const BROWN = new THREE.MeshStandardMaterial({color:0x6b3a22, metalness:0.05, roughness:0.6});
  const YELROL= new THREE.MeshStandardMaterial({color:0xe6c46a, roughness:0.7});
  const PLEX  = new THREE.MeshStandardMaterial({color:0xdde8ee, metalness:0.1, roughness:0.1, transparent:true, opacity:0.42, side:THREE.DoubleSide, depthWrite:false});
  const BODYD = new THREE.MeshStandardMaterial({color:0x3a3f45, metalness:0.7, roughness:0.4});
  const TOPM  = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.55, metalness:0.35, map: canvasTex(1024,512,(g,w,h)=>{ g.fillStyle='#2e3236'; g.fillRect(0,0,w,h);
    for(let y=0;y<h;y+=4){ g.fillStyle= y%8? '#373c41' : '#24282b'; g.fillRect(0,y,w,2); } }) });
  const ZB=0.30, ZK=-0.36, XB=0.42;                 // bâti : face avant, face arrière, demi-largeur

  /* ---------- étiquettes ---------- */
  const label=(parent,w,h,draw,pos,ry=0)=>{ const t=canvasTex(1024,Math.round(1024*h/w),draw); const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false}));
    m.position.set(...pos); m.rotation.y=ry; parent.add(m); document.fonts?.ready.then(()=>{ const g=t.userData.canvas.getContext('2d'); g.clearRect(0,0,t.userData.canvas.width,t.userData.canvas.height); draw(g,t.userData.canvas.width,t.userData.canvas.height); t.needsUpdate=true; }); return m; };

  /* ---------- Bâti ---------- */
  const bati=new THREE.Group(); root.add(bati);
  add(bati, rbox(2*XB,0.74,ZB-ZK,CREAM,0.012), 0,0.45,(ZB+ZK)/2);
  add(bati, rbox(2*XB-0.06,0.08,ZB-ZK-0.06,GREY,0.006), 0,0.04,(ZB+ZK)/2);                 // socle en retrait
  add(bati, rbox(2*XB+0.004,0.035,ZB-ZK+0.004,GREY,0.004), 0,0.80,(ZB+ZK)/2);              // ceinture sous la table
  // bandeau gris à grille, sous le pupitre, avec la marque
  const grille=canvasTex(1024,128,(g,w,h)=>{ g.fillStyle='#9aa0a6'; g.fillRect(0,0,w,h); for(let y=6;y<h;y+=14) for(let x=(y/14%2)*7;x<w;x+=14){ g.fillStyle='#d9dcdf'; g.beginPath(); g.moveTo(x,y); g.lineTo(x+5,y+5); g.lineTo(x,y+10); g.lineTo(x-5,y+5); g.fill(); }
    g.fillStyle='#c4261c'; g.fillRect(0,h-10,w,10); });
  const band=new THREE.Mesh(new THREE.PlaneGeometry(2*XB-0.02,0.09),new THREE.MeshStandardMaterial({map:grille,roughness:0.6})); band.position.set(0,0.545,ZB+0.0015); bati.add(band);
  const kanak=(col)=>(g,w,h)=>{ g.clearRect(0,0,w,h); g.font=`italic 700 ${h*0.8}px "Barlow Condensed","Arial Narrow",sans-serif`; g.fillStyle=col; g.fillText('KANAK',10,h*0.78); };
  label(bati,0.22,0.06,kanak('#c4261c'),[-0.28,0.545,ZB+0.003]);
  label(bati,0.20,0.06,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='rgba(255,255,255,.92)'; g.fillRect(0,0,w,h); g.font=`700 ${h*0.72}px "Barlow Condensed",sans-serif`; g.fillStyle='#2a2f34'; g.fillText('130 T',w*0.22,h*0.75); },[0.30,0.545,ZB+0.003]);
  label(bati,0.20,0.12,(g,w,h)=>{ g.fillStyle='#d4d7da'; g.fillRect(0,0,w,h); g.fillStyle='#1b2228'; g.font='italic 700 110px "Barlow Condensed",sans-serif'; g.fillText('KANAK',30,120);
    g.font='44px sans-serif'; g.fillText('Toupie 130 T · arbre Ø 30',30,215); g.fillText('5,5 kW · 4 000 / 6 000 / 7 000 / 9 000',30,280); g.fillText('tr/min · arbre fixe 90°',30,345); g.fillText('Outils Ø 250 max.',30,410); },[-XB-0.001,0.66,-0.10],-Math.PI/2);
  // pictogramme électrique sur la porte
  label(bati,0.07,0.06,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#f2c200'; g.beginPath(); g.moveTo(w/2,4); g.lineTo(w-4,h-4); g.lineTo(4,h-4); g.closePath(); g.fill(); g.strokeStyle='#111'; g.lineWidth=8; g.stroke(); g.fillStyle='#111'; g.font=`bold ${h*0.55}px sans-serif`; g.fillText('⚡',w*0.34,h*0.86); },[-0.30,0.36,ZB+0.0035]);
  // cuve sous l'ouverture de la table (logement de l'arbre)
  const cuve=new THREE.Mesh(new THREE.CylinderGeometry(HOLE_R-0.004,HOLE_R-0.004,0.30,40,1,true),new THREE.MeshStandardMaterial({color:0x2a2d30,roughness:0.9,side:THREE.DoubleSide})); cuve.position.set(0,TABLE_Y-0.17,0); bati.add(cuve);
  add(bati, cyl(HOLE_R-0.004,0.01,new THREE.MeshStandardMaterial({color:0x202326,roughness:0.95}),40), 0,TABLE_Y-0.31,0);
  tagPart(bati,'bati');
  for(const m of partMeshes.bati) m.material=m.material.clone();

  /* ---------- Porte de visite (transmission), interverrouillée ---------- */
  const porte=new THREE.Group(); root.add(porte);
  add(porte, rbox(0.46,0.34,0.006,CREAM,0.004), -0.12,0.30,ZB+0.003);
  add(porte, rbox(0.03,0.05,0.012,M.dark,0.004), 0.06,0.36,ZB+0.008);
  tagPart(porte,'porte');
  for(const m of partMeshes.porte) m.material=m.material.clone();

  /* ---------- Table en fonte rainurée, ouverture Ø 320 ---------- */
  const table=new THREE.Group(); root.add(table);
  { const s=new THREE.Shape(); s.moveTo(TABLE_X[0],-TABLE_Z[1]); s.lineTo(TABLE_X[1],-TABLE_Z[1]); s.lineTo(TABLE_X[1],-TABLE_Z[0]); s.lineTo(TABLE_X[0],-TABLE_Z[0]); s.closePath();
    const hole=new THREE.Path(); hole.absarc(0,0,HOLE_R,0,Math.PI*2,true); s.holes.push(hole);
    const g=new THREE.ExtrudeGeometry(s,{depth:0.05,bevelEnabled:false,curveSegments:48}); g.rotateX(-Math.PI/2);
    // UV en plan pour les rainures
    const p=g.attributes.position, uv=g.attributes.uv; for(let i=0;i<p.count;i++) uv.setXY(i,(p.getX(i)+1)/2,(p.getZ(i)+1)/2);
    const m=new THREE.Mesh(g,TOPM); m.position.y=TABLE_Y-0.05; table.add(m); }
  add(table, rbox(2.0,0.03,0.03,M.alu,0.006), 0,TABLE_Y-0.02,TABLE_Z[1]+0.02);              // profil avant (rail du chariot, lot 2)
  tagPart(table,'table');

  /* ---------- Rallonges et rouleaux de bout ---------- */
  const ral=new THREE.Group(); root.add(ral);
  for(const sx of [1,-1]){ const x0=sx>0?TABLE_X[1]:RAL_X[0], x1=sx>0?RAL_X[1]:TABLE_X[0];
    add(ral, rbox(x1-x0-0.04,0.02,TABLE_Z[1]-TABLE_Z[0]-0.10,M.alu,0.004), (x0+x1)/2-sx*0.0,TABLE_Y-0.01,(TABLE_Z[0]+TABLE_Z[1])/2+0.03);
    add(ral, cyl(0.025,TABLE_Z[1]-TABLE_Z[0]-0.10,M.aluDk,20,'z'), sx*(Math.abs(sx>0?x1:x0)-0.01),TABLE_Y-0.022,(TABLE_Z[0]+TABLE_Z[1])/2+0.03);
    for(const z of [TABLE_Z[0]+0.06,TABLE_Z[1]-0.02]) add(ral, rbox(x1-x0,0.04,0.015,M.dark,0.003), (x0+x1)/2,TABLE_Y-0.04,z); }
  tagPart(ral,'rallonges');

  /* ---------- Bagues de table (réduction de la lumière) ---------- */
  const bag=new THREE.Group(); root.add(bag); let ringKey=-1;
  function buildRing(id){ while(bag.children.length){ const c=bag.children.pop(); c.geometry.dispose(); }
    if(id>=320) return;
    const s=new THREE.Shape(); s.absarc(0,0,HOLE_R-0.0005,0,Math.PI*2,false); const h=new THREE.Path(); h.absarc(0,0,id/2000,0,Math.PI*2,true); s.holes.push(h);
    const g=new THREE.ExtrudeGeometry(s,{depth:0.012,bevelEnabled:false,curveSegments:64}); g.rotateX(-Math.PI/2);
    const m=new THREE.Mesh(g,BROWN); m.position.y=TABLE_Y-0.0118; bag.add(m);
    bag.traverse(o=>{ if(o.isMesh){ o.castShadow=o.receiveShadow=true; o.userData.part='bagues'; } }); partMeshes.bagues=[...bag.children]; }
  tagPart(bag,'bagues');

  /* ---------- Arbre, bagues entretoises, écrou ; outil ---------- */
  const arbreG=new THREE.Group(); root.add(arbreG);              // y = bas du tranchant
  const spinG=new THREE.Group(); arbreG.add(spinG);
  const shaft=cyl(0.015,1,M.steel,20); spinG.add(shaft);
  const spacers=new THREE.Group(); spinG.add(spacers);
  const nut=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.022,6),M.steel); spinG.add(nut);
  const flange=cyl(0.04,0.012,MI.cast,32); spinG.add(flange);
  const cart=cyl(0.055,0.30,MI.cast,32); arbreG.add(cart);        // cartouche de l'arbre (monte et descend), sous la table
  tagPart(arbreG,'arbre');
  const outilG=new THREE.Group(); spinG.add(outilG); let toolKey='';
  function buildTool(){ while(outilG.children.length){ const c=outilG.children.pop(); c.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }
    const t=tool(); if(!t) return; const pts=profilePts(t,st.flip), H=t.H/1000, rIn=0.016, rMin=Math.min(...pts.map(p=>p[1]))/1000;
    const body=pts.map(([y,r])=>new THREE.Vector2(Math.max(rIn+0.004,r/1000-0.007),y/1000));
    const lathe=new THREE.LatheGeometry([new THREE.Vector2(rIn,0),...body,new THREE.Vector2(rIn,H)],72);
    outilG.add(new THREE.Mesh(lathe,BODYD));
    const s=new THREE.Shape(); const rk=Math.max(rIn+0.006,rMin-0.014); s.moveTo(rk,0); for(const [y,r] of pts) s.lineTo(r/1000,y/1000); s.lineTo(rk,H); s.closePath();
    const kg=new THREE.ExtrudeGeometry(s,{depth:0.004,bevelEnabled:false}); kg.translate(0,0,-0.002);
    const wg=new THREE.BoxGeometry(0.012,H*0.92,0.008); const sens=st.flip?-1:1;
    for(let i=0;i<t.Z;i++){ const a=i*2*Math.PI/t.Z;
      const k=new THREE.Mesh(kg,M.blade); k.rotation.y=a; outilG.add(k);
      const w=new THREE.Mesh(wg,M.dark); const aw=a-sens*0.16, rw=rk+0.006; w.position.set(Math.cos(aw)*rw,H/2,-Math.sin(aw)*rw); w.rotation.y=aw; outilG.add(w); }
    // marquage sur la face du dessus : flèche du sens de coupe (vue à l'envers si l'outil est retourné), n max, diamètre
    const tex=canvasTex(512,512,(g,w,h)=>{ g.fillStyle='#4a5057'; g.beginPath(); g.arc(w/2,h/2,w/2,0,7); g.fill(); g.strokeStyle='#e9edf0'; g.lineWidth=14;
      const cw=st.flip; g.beginPath(); g.arc(w/2,h/2,w*0.36,cw?-2.6:-0.5,cw?-0.5:-2.6,!cw); g.stroke();
      const ax=cw? w/2+Math.cos(-0.5)*w*0.36 : w/2+Math.cos(-2.6)*w*0.36, ay=cw? h/2+Math.sin(-0.5)*h*0.36 : h/2+Math.sin(-2.6)*h*0.36;
      g.fillStyle='#e9edf0'; g.beginPath(); g.arc(ax,ay,22,0,7); g.fill();
      g.font='bold 34px sans-serif'; g.textAlign='center'; g.fillText(st.flip?'(dessous)':`n max ${t.nmax}`,w/2,h*0.62); g.fillText(st.flip?'':`Ø ${Dmm(t)} · MAN`,w/2,h*0.72); });
    const disc=new THREE.Mesh(new THREE.CircleGeometry(Math.max(rIn+0.01,rMin-0.009),48),new THREE.MeshStandardMaterial({map:tex,roughness:0.5,metalness:0.3}));
    disc.rotation.x=-Math.PI/2; disc.position.y=H+0.0006; outilG.add(disc);
    outilG.traverse(o=>{ if(o.isMesh){ o.castShadow=o.receiveShadow=true; o.userData.part='outil'; } }); partMeshes.outil=outilG.children.filter(o=>o.isMesh); }
  tagPart(outilG,'outil');

  /* ---------- Guide à lamelles Guide intégral à lamelles (type AIGNER) : deux cassettes, lamelles passées au-dessus et au-dessous de l'outil ---------- */
  const SLAT=new THREE.MeshStandardMaterial({color:0xc9ced3,metalness:0.6,roughness:0.3});
  const CASS=new THREE.MeshStandardMaterial({color:0x8e959c,metalness:0.55,roughness:0.4});
  const PLATE=new THREE.MeshStandardMaterial({color:0x26292c,metalness:0.2,roughness:0.6});
  const half=(sx)=>{ const g=new THREE.Group(); root.add(g); const L=GUIDE_LEN, H=GUIDE_H;
    for(let k=0;k<LAM_N;k++){ const [a,b]=lamBand(k); add(g, rbox(L-0.09,(b-a)/1000,LAM_D/1000,SLAT,0.0015), sx*(L-0.09)/2,(a+b)/2000,-LAM_D/2000); }   // lamelles (face avant au plan du guide, z = 0)
    add(g, rbox(0.09,H,0.05,CASS,0.004), sx*(L-0.045),H/2,-0.025);                                    // bout plein de la cassette (côté extérieur)
    add(g, rbox(L,H-0.01,0.05,CASS,0.004), sx*L/2,H/2,-LAM_D/1000-0.026);                             // cassette, derrière les lamelles
    add(g, rbox(L,0.014,0.07,PLATE,0.003), sx*L/2,H+0.007,-0.035);                                    // plaque noire du dessus
    add(g, cyl(0.013,0.018,M.dark,16), sx*L*0.55,H+0.023,-0.02); add(g, cyl(0.009,0.016,M.dark,12), sx*L*0.68,H+0.022,-0.02);   // boutons à oreilles (lamelles, hauteur)
    for(let i=0;i<7;i++) add(g, rbox(0.006,0.006,0.012,SLAT,0.001), sx*(L-0.004),0.015+i*0.018,-0.008);       // crans de fixation en bout
    return g; };
  const gIn=half(1), gOut=half(-1);
  tagPart(gIn,'guide_entree'); tagPart(gOut,'guide_sortie');
  label(gIn,0.08,0.014,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#d9dcdf'; g.font=`italic 700 ${h*0.85}px "Barlow Condensed",sans-serif`; g.fillText('KANAK',4,h*0.82); },[GUIDE_LEN*0.30,GUIDE_H+0.007,0.0006]);
  /* lamelles passées d'un demi-guide à l'autre (largeur ajustée à l'écart des demi-guides ; rentrées = repliées dans leur cassette) */
  const bridges=new THREE.Group(); root.add(bridges); const bridgeM=[];
  for(let k=0;k<LAM_N;k++){ const [a,b]=lamBand(k); const m=rbox(1,(b-a)/1000,LAM_D/1000,SLAT,0); m.position.y=(a+b)/2000; bridges.add(m); bridgeM.push(m); }
  tagPart(bridges,'lamelles');
  const sup=new THREE.Group(); root.add(sup);
  add(sup, rbox(0.70,0.06,0.18,CREAM,0.01), 0,TABLE_Y+0.03,-0.30);                                // pont du support, fixé sur la table
  for(const sx of [1,-1]) add(sup, rbox(0.06,0.05,0.24,GREY,0.006), sx*0.26,TABLE_Y+0.03,-0.18);   // glissières
  const hw=new THREE.Group(); hw.position.set(0.30,TABLE_Y+0.20,-0.20); sup.add(hw);               // volant de réglage du demi-guide d'entrée + compteur
  { const wheel=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.008,10,36),M.dark); wheel.rotation.x=Math.PI/2; hw.add(wheel); hw.add(cyl(0.05,0.012,M.dark,30));
    add(hw, cyl(0.008,0.06,M.dark,10), 0.045,0.04,0); add(hw, rbox(0.06,0.04,0.035,M.dark,0.004), 0,-0.06,0.02); add(hw, cyl(0.012,0.14,M.steel,10), 0,-0.12,0); }
  label(sup,0.05,0.022,(g,w,h)=>{ g.fillStyle='#111'; g.fillRect(0,0,w,h); g.fillStyle='#eee'; g.font=`bold ${h*0.7}px monospace`; g.fillText('0 0 0 0',w*0.08,h*0.75); },[0.30,TABLE_Y+0.14,-0.181]);
  add(sup, cyl(0.02,0.04,M.dark,16), -0.30,TABLE_Y+0.16,-0.20);                                     // bouton de réglage du demi-guide de sortie
  tagPart(sup,'support_guide');
  const capot=new THREE.Group(); root.add(capot);
  { const CW=0.30, CD=0.20, CH=0.10;
    add(capot, rbox(CW,CH,CD,ORANGE,0.012), 0,GUIDE_H+CH/2-0.005,-CD/2-0.004);
    for(const sx of [1,-1]) add(capot, rbox(0.012,GUIDE_H,CD-0.03,ORANGE,0.003), sx*(CW/2-0.006),GUIDE_H/2,-CD/2-0.02);
    add(capot, rbox(CW-0.02,GUIDE_H,0.01,ORANGE,0.003), 0,GUIDE_H/2,-CD-0.0);
    for(const [x,z] of [[-0.11,-0.03],[0.11,-0.03],[-0.11,-0.17],[0.11,-0.17]]) add(capot, cyl(0.012,0.012,M.dark,14), x,GUIDE_H+CH+0.001,z);
    label(capot,0.05,0.045,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#f2c200'; g.beginPath(); g.moveTo(w/2,4); g.lineTo(w-4,h-4); g.lineTo(4,h-4); g.closePath(); g.fill(); g.strokeStyle='#111'; g.lineWidth=7; g.stroke(); g.fillStyle='#111'; g.font=`bold ${h*0.42}px sans-serif`; g.fillText('✋',w*0.3,h*0.84); },[0,GUIDE_H+CH/2,-0.003]); }
  tagPart(capot,'capot_guide');
  for(const m of partMeshes.capot_guide) m.material=m.material.clone();

  /* ---------- Aspiration : buse du capot (Ø 120), buse sous la table, flexibles ---------- */
  const asp=new THREE.Group(); root.add(asp);
  const hoseTex=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#e8eef2'; g.fillRect(0,0,w,h); g.fillStyle='#b9c4cc'; g.fillRect(0,0,w,14); }); hoseTex.wrapS=hoseTex.wrapT=THREE.RepeatWrapping; hoseTex.repeat.set(50,1);
  const HOSE=new THREE.MeshStandardMaterial({map:hoseTex,roughness:0.5,transparent:true,opacity:0.92});
  const aspTop=new THREE.Group(); asp.add(aspTop);
  add(aspTop, cyl(0.06,0.06,M.dark,28), 0,0,0);
  aspTop.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0.02,0),new THREE.Vector3(0,0.16,-0.04),new THREE.Vector3(-0.05,0.30,-0.40),new THREE.Vector3(-0.10,0.45,-0.95)]),60,0.058,18,false),HOSE));
  add(asp, cyl(0.05,0.08,M.dark,24,'z'), 0.0,0.62,ZK-0.04);
  asp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0.62,ZK-0.08),new THREE.Vector3(0,0.65,ZK-0.35),new THREE.Vector3(-0.15,0.90,ZK-0.55),new THREE.Vector3(-0.20,1.10,ZK-0.80)]),60,0.048,16,false),HOSE));
  tagPart(asp,'aspiration');

  /* ---------- Protège-mains à presseurs (presseur vertical et presseur horizontal) ---------- */
  const prot=new THREE.Group(); root.add(prot);
  const protSup=new THREE.Group(); prot.add(protSup);
  const AY=TABLE_Y+0.30;                                                                             // hauteur du bras
  add(protSup, cyl(0.016,0.30,M.steel,14), 0.20,TABLE_Y+0.16,-0.17);                                // colonne sur le support du guide
  add(protSup, rbox(0.05,0.05,0.05,M.alu,0.006), 0.20,AY,-0.17);
  add(protSup, rbox(0.03,0.03,0.42,M.alu,0.004), 0.20,AY,0.04);                                     // bras vers l'avant
  const colV=rbox(0.04,0.04,0.04,M.alu,0.005), colH=rbox(0.04,0.04,0.04,M.alu,0.005); protSup.add(colV,colH);   // coulisseaux sur le bras
  const rodV=cyl(0.008,1,M.steel,10), rodH=cyl(0.008,1,M.steel,10); protSup.add(rodV,rodH);         // tiges des presseurs
  const linkV=rbox(0.08,0.012,0.012,M.steel,0.002), linkH=rbox(0.04,0.012,0.012,M.steel,0.002); protSup.add(linkV,linkH);
  const knobs=[0,1].map(()=>{ const k=cyl(0.014,0.02,M.dark,12,'x'); protSup.add(k); return k; });
  tagPart(protSup,'protecteur');
  const pv=new THREE.Group(); prot.add(pv);
  add(pv, rbox(0.24,0.008,0.07,PLEX,0.003), 0,0.004,0.035);                                         // patin du presseur vertical, sur la pièce
  add(pv, rbox(0.20,0.004,0.004,M.yellow,0), 0,0.009,0.07);
  add(pv, rbox(0.03,0.02,0.03,M.alu,0.004), 0.12,0.012,0.035);
  tagPart(pv,'presseur_v');
  const ph=new THREE.Group(); prot.add(ph);
  add(ph, rbox(0.28,0.06,0.01,PLEX,0.003), 0,0.035,0.005);                                          // patin du presseur horizontal, contre la pièce
  add(ph, rbox(0.28,0.004,0.012,M.yellow,0), 0,0.067,0.005);
  add(ph, rbox(0.03,0.02,0.03,M.alu,0.004), 0.16,0.075,0.012);
  tagPart(ph,'presseur_h');

  /* ---------- Poussoir (bois), sur la rallonge d'entrée ou en main ---------- */
  const pous=new THREE.Group(); root.add(pous);
  { const sh=new THREE.Shape(); sh.moveTo(0,0); sh.lineTo(0.30,0); sh.lineTo(0.30,0.03); sh.lineTo(0.20,0.06); sh.lineTo(0.12,0.10); sh.lineTo(0.06,0.10); sh.lineTo(0.08,0.05); sh.lineTo(0.02,0.03); sh.lineTo(0,0.012); sh.closePath();
    const g=new THREE.ExtrudeGeometry(sh,{depth:0.018,bevelEnabled:true,bevelThickness:0.002,bevelSize:0.002,bevelSegments:1}); g.translate(0,0,-0.009); g.scale(0.8,0.8,1);
    pous.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xc99b62,roughness:0.75}))); }
  tagPart(pous,'poussoir');

  /* ---------- Pupitre de commande (face avant du bâti) ---------- */
  const pup=new THREE.Group(); pup.position.set(0.06,0.70,ZB+0.002); root.add(pup);
  const PW=0.36, PH=0.20;
  add(pup, rbox(PW+0.02,PH+0.02,0.006,new THREE.MeshStandardMaterial({color:0xd5d8da,roughness:0.5}),0.004), 0,0,0.0);
  const panelTex=canvasTex(720,400,()=>{}); let panelK='';
  function drawPanel(){ const g=panelTex.userData.canvas.getContext('2d'), w=720, h=400;
    g.fillStyle='#3a3e43'; g.fillRect(0,0,w,h); g.fillStyle='#2b2e32'; g.fillRect(14,14,470,180);
    const disp=(x,y,txt,lbl)=>{ g.fillStyle='#1a0c0c'; g.fillRect(x,y,190,54); g.fillStyle='#ff3b2f'; g.font='bold 40px monospace'; g.textAlign='right'; g.fillText(txt,x+182,y+42); g.textAlign='left'; g.fillStyle='#e8e8e8'; g.font='15px sans-serif'; g.fillText(lbl,x+200,y+32); };
    disp(28,28,(st.h>=0?'':'−')+Math.abs(st.h).toFixed(1),'h mm'); disp(28,122,st.motor? String(st.rpm) : '0','tr/min');
    g.fillStyle='#ff6a8a'; g.fillRect(270,40,150,36); g.fillStyle='#401020'; g.font='16px monospace'; g.fillText('EV1  KANAK',282,64);
    const keys=['7','8','9','4','5','6','1','2','3','C','0','=']; keys.forEach((k,i)=>{ const x=500+(i%3)*44, y=26+Math.floor(i/3)*42; g.fillStyle=k==='='?'#2f9a4e':'#eef0f2'; g.fillRect(x,y,38,34); g.fillStyle='#1b2228'; g.font='bold 20px sans-serif'; g.fillText(k,x+12,y+25); });
    g.fillStyle='#c4261c'; g.fillRect(636,68,64,34); g.fillStyle='#fff'; g.font='bold 15px sans-serif'; g.fillText('STOP',648,91);
    g.fillStyle='#e8e8e8'; g.font='15px sans-serif'; g.fillText('START',642,128);
    // libellés des commandes du bas
    g.fillStyle='#e8e8e8'; g.font='bold 18px sans-serif'; g.fillText('I',62,226); g.fillText('I',152,226); g.fillText('0',62,378); g.fillText('0',152,378);
    g.font='13px sans-serif'; g.fillText('arbre',40,300); g.fillText('entraîneur',122,300);
    g.font='bold 22px sans-serif'; g.fillText('↺  0  ↻',300,226); g.font='13px sans-serif'; g.fillText('inverseur',318,372);
    g.fillStyle=st.dir===1?'#7dff8a':'#555'; g.beginPath(); g.arc(290,250,6,0,7); g.fill(); g.fillStyle=st.dir===-1?'#ffb03b':'#555'; g.beginPath(); g.arc(420,250,6,0,7); g.fill();
    panelTex.needsUpdate=true; }
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH),new THREE.MeshBasicMaterial({map:panelTex,toneMapped:false})); panel.position.z=0.0035; pup.add(panel);
  const toXY=(u,v)=>[(u/720-0.5)*PW,(0.5-v/400)*PH];
  const START=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.012,20),new THREE.MeshStandardMaterial({color:0x2a59b8,roughness:0.3})); START.rotation.x=Math.PI/2; START.position.set(...toXY(668,150),0.01); pup.add(START);
  tagPart(pup,'pupitre');
  const mar=new THREE.Group(); pup.add(mar);
  for(const [u,v,c] of [[70,262,0xe8eaec],[160,262,0xe8eaec],[70,330,0x1d2125],[160,330,0x1d2125]]){ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.0115,0.0115,0.012,20),new THREE.MeshStandardMaterial({color:c,roughness:0.35,metalness:0.2})); b.rotation.x=Math.PI/2; b.position.set(...toXY(u,v),0.01); mar.add(b);
    const r=new THREE.Mesh(new THREE.TorusGeometry(0.013,0.002,8,24),M.alu); r.position.set(...toXY(u,v),0.006); mar.add(r); }
  tagPart(mar,'marche');
  const inv=new THREE.Group(); inv.position.set(...toXY(355,300),0.008); pup.add(inv);
  { const b=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.008,24),M.dark); b.rotation.x=Math.PI/2; inv.add(b); const lv=rbox(0.008,0.03,0.014,M.yellow,0.002); lv.position.z=0.01; inv.add(lv); }
  tagPart(inv,'inverseur');
  const au=new THREE.Group(); au.position.set(...toXY(620,300),0.004); pup.add(au);
  { const p=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.004,30),M.yellow); p.rotation.x=Math.PI/2; au.add(p);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.02,0.022,30),M.red); m.rotation.x=Math.PI/2; m.position.z=0.014; au.add(m); }
  tagPart(au,'arret');

  /* ---------- Verrouillage de l'arbre (changement d'outil) : tirette à droite du pupitre ---------- */
  const ver=new THREE.Group(); ver.position.set(0.32,0.72,ZB+0.002); root.add(ver);
  { const b=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.006,24),M.yellow); b.rotation.x=Math.PI/2; ver.add(b);
    const k=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.04,16),M.dark); k.rotation.x=Math.PI/2; k.position.z=0.02; ver.add(k); ver.userData.k=k;
    const t=new THREE.Mesh(new THREE.SphereGeometry(0.016,16,12),M.dark); t.position.z=0.04; ver.add(t); ver.userData.t=t; }
  label(ver,0.07,0.02,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#1b2228'; g.font=`${h*0.7}px sans-serif`; g.fillText('🔒 arbre',4,h*0.75); },[0,-0.035,0.001]);
  tagPart(ver,'verrou');

  /* ---------- Sectionneur (interrupteur général, cadenassable), flanc droit ---------- */
  const sec=new THREE.Group(); sec.position.set(XB+0.002,0.62,0.16); root.add(sec);
  { const b=rbox(0.008,0.10,0.10,M.dark,0.004); sec.add(b); const h=new THREE.Group(); h.position.x=0.012; sec.add(h); add(h, cyl(0.022,0.012,M.red,20,'x'));
    const lv=rbox(0.016,0.075,0.018,M.red,0.004); lv.position.x=0.01; h.add(lv); sec.userData.h=h;
    const pad=new THREE.Group(); pad.position.set(0.03,-0.04,0.03); add(pad, rbox(0.012,0.03,0.025,M.yellow,0.003)); const sh=new THREE.Mesh(new THREE.TorusGeometry(0.009,0.002,6,16,Math.PI),M.steel); sh.position.y=0.015; sh.rotation.y=Math.PI/2; pad.add(sh); sec.add(pad); sec.userData.pad=pad; }
  tagPart(sec,'sectionneur');

  /* ---------- Moteur-frein et transmission par poulies étagées (dans le bâti) ---------- */
  const mot=new THREE.Group(); root.add(mot);
  const MX=-0.20, MZ=-0.08;
  add(mot, cyl(0.10,0.30,MI.motor,32), MX,0.32,MZ);
  for(let i=0;i<8;i++) add(mot, cyl(0.106,0.006,MI.motor,32), MX,0.20+i*0.035,MZ);
  add(mot, rbox(0.08,0.06,0.06,MI.cast,0.006), MX+0.10,0.30,MZ);
  tagPart(mot,'moteur');
  const tr=new THREE.Group(); root.add(tr);
  const RM=[0.040,0.050,0.055,0.060], ratio=RPMS.map(n=>n/3000), RA=RM.map((r,i)=>r/ratio[i]);     // moteur 3 000 tr/min
  const stepY=i=>0.50+i*0.022;
  const pm=new THREE.Group(); pm.position.set(MX,0,MZ); tr.add(pm); RM.forEach((r,i)=>add(pm, cyl(r,0.02,MI.zinc,32), 0,stepY(i),0));
  const pa=new THREE.Group(); tr.add(pa); RA.forEach((r,i)=>add(pa, cyl(r,0.02,MI.zinc,32), 0,stepY(i),0));
  const belt=new THREE.Mesh(new THREE.BufferGeometry(),MI.belt); tr.add(belt); let beltK=-1;
  tagPart(tr,'transmission');

  /* ---------- Entraîneur à 4 rouleaux (d'après un entraîneur 4 rouleaux sur pied : colonne Ø 75, bras Ø 58 de 1 050 mm) ----------
     Bloc : moteur vertical sur un carter de transmission (chaîne), 4 rouleaux caoutchouc Ø 120 × 60 sur ressorts, au pas de
     133, 143 et 145 mm. Repère du bloc : x le long de l'avance (rouleaux en ENT_X), y = 0 au bas des rouleaux, centré en z. */
  const ent=new THREE.Group(); root.add(ent);
  const COLX=0.66, COLZ=-0.46, WHITE=new THREE.MeshStandardMaterial({color:0xe9ebec,metalness:0.2,roughness:0.45});
  const RUB=new THREE.MeshStandardMaterial({color:0xc8442a,roughness:0.75}), HUB=new THREE.MeshStandardMaterial({color:0x9aa1a7,metalness:0.6,roughness:0.35});
  add(ent, rbox(0.20,0.025,0.16,M.dark,0.004), COLX,TABLE_Y+0.0125,COLZ);                           // embase vissée sur la table (rallonge arrière)
  const col=cyl(0.0375,1,WHITE,24); ent.add(col);                                                   // colonne Ø 75 (monte et descend)
  const colTop=new THREE.Group(); ent.add(colTop);
  add(colTop, rbox(0.10,0.09,0.10,WHITE,0.01), 0,0,0);                                               // coulisseau du bras
  { const w=new THREE.Mesh(new THREE.TorusGeometry(0.05,0.006,8,28),M.dark); w.rotation.x=Math.PI/2; w.position.y=0.10; colTop.add(w); add(colTop, cyl(0.008,0.06,M.steel,8), 0,0.07,0); add(colTop, cyl(0.006,0.04,M.dark,8), 0.04,0.12,0); }   // volant de hauteur
  add(colTop, cyl(0.007,0.09,M.dark,8,'x'), 0.07,-0.02,0);                                           // levier de blocage
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.029,0.029,1,20).rotateX(Math.PI/2),M.aluDk); ent.add(arm);   // bras Ø 58
  const knuckle=new THREE.Group(); ent.add(knuckle);                                                 // rotule : collier sur le bras, coude vers le bloc
  add(knuckle, rbox(0.09,0.08,0.09,WHITE,0.012), 0,0,0); add(knuckle, cyl(0.006,0.10,M.steel,8,'z'), 0,0.05,0); add(knuckle, cyl(0.006,0.10,M.steel,8,'x'), 0,-0.05,0);
  const drop=cyl(0.03,1,new THREE.MeshStandardMaterial({color:0x3a3e42,metalness:0.4,roughness:0.5}),18); ent.add(drop);
  const head=new THREE.Group(); ent.add(head);
  { const body=new THREE.Group(); body.position.y=0.035; head.add(body);   // carter au-dessus des axes : les rouleaux dépassent dessous
    // carter (profil en trapèze arrondi, vu de côté), sur toute la longueur des rouleaux
    const s=new THREE.Shape(); s.moveTo(-0.29,0.045); s.lineTo(0.29,0.045); s.lineTo(0.27,0.11); s.quadraticCurveTo(0.24,0.15,0.17,0.15); s.lineTo(-0.15,0.16); s.quadraticCurveTo(-0.23,0.16,-0.26,0.12); s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:2*ENT_HALF_W/1000-0.012,bevelEnabled:true,bevelThickness:0.006,bevelSize:0.006,bevelSegments:2}); g.translate(0,0,-(ENT_HALF_W/1000-0.006)); body.add(new THREE.Mesh(g,WHITE));
    add(body, rbox(0.56,0.012,0.008,M.dark,0.002), 0,0.048,ENT_HALF_W/1000-0.004); add(body, rbox(0.56,0.012,0.008,M.dark,0.002), 0,0.048,-ENT_HALF_W/1000+0.004);
    const mot=new THREE.Group(); mot.position.z=0.035; body.add(mot);                                  // moteur décalé côté opérateur : il passe au-dessus du capot du guide
    add(mot, rbox(0.10,0.04,0.07,M.dark,0.006), 0.0,0.18,0);                                         // réducteur
    add(mot, cyl(0.065,0.16,new THREE.MeshStandardMaterial({color:0x2d3135,metalness:0.5,roughness:0.4}),28), 0.0,0.28,0);   // moteur vertical
    for(let i=0;i<9;i++) add(mot, cyl(0.069,0.006,MI.zinc,28), 0,0.215+i*0.013,0);                    // ailettes
    add(mot, cyl(0.066,0.03,M.dark,28), 0,0.375,0);                                                    // capot du ventilateur
    add(mot, rbox(0.06,0.07,0.05,M.dark,0.006), -0.085,0.28,0);                                        // boîte de commande
    const sel=cyl(0.017,0.012,M.red,18,'x'); sel.position.set(-0.118,0.29,0); mot.add(sel); }      // sélecteur 0 / 1 / 2 (vitesse, sens)
  const rolls=ENT_X.map(x=>{ const r=new THREE.Group(); r.position.set(x,ENT_ROLL_R/1000,ENT_ROLL_OFF/1000); head.add(r);                // rouleaux affleurant le côté guide du carter
    r.add(cyl(ENT_ROLL_R/1000,ENT_ROLL_W/1000,RUB,30,'z')); add(r, cyl(0.032,ENT_ROLL_W/1000+0.004,HUB,18,'z'));
    for(let i=0;i<3;i++){ const sp=rbox(0.012,0.05,ENT_ROLL_W/1000+0.006,HUB,0.002); sp.rotation.z=i*Math.PI/3*2; sp.position.set(Math.cos(i*2.09)*0.02,Math.sin(i*2.09)*0.02,0); r.add(sp); }
    return r; });
  tagPart(ent,'entraineur');
  const pieceRoot=new THREE.Group(); root.add(pieceRoot);

  /* ---------- mise à jour d'après les réglages ---------- */
  function update(topAt, frontAt, push){
    const yb=TABLE_Y+st.h/1000, t=tool(), H=t? t.H/1000 : 0.02;
    arbreG.position.y=yb;
    const key=(st.tool||'')+'|'+st.flip; if(key!==toolKey){ toolKey=key; buildTool();
      const top=H+0.06; shaft.scale.y=top+0.20; shaft.position.y=(top-0.20)/2;            // arbre : de 0,20 m sous le tranchant à l'écrou
      nut.position.y=H+0.05; flange.position.y=-0.006; cart.position.y=-0.22;
      while(spacers.children.length){ const c=spacers.children.pop(); c.geometry.dispose(); }
      const sp=cyl(0.025,0.036,MI.zinc,24); sp.position.y=H+0.022; sp.castShadow=true; sp.userData.part='arbre'; spacers.add(sp); }
    if(ringKey!==st.ring){ ringKey=st.ring; buildRing(st.ring); }
    // guide
    const zi=st.zIn/1000, zo=zOut()/1000, o=st.open/2000;
    gIn.position.set(o,TABLE_Y+0.002,zi); gOut.position.set(-o,TABLE_Y+0.002,zo);
    capot.position.set(0,TABLE_Y+0.002,Math.min(zi,zo)-0.002);
    aspTop.position.set(0,TABLE_Y+GUIDE_H+0.10+0.03,Math.min(zi,zo)-0.11);
    bridges.position.set(0,TABLE_Y+0.002,zi-LAM_D/2000);
    bridgeM.forEach((m,k)=>{ const on=!!(st.lam&&st.lam[k]); m.scale.x= on? 2*o+0.012 : 1e-4; });     // rentrée : repliée (le Raycaster ignore « visible »)
    // entraîneur : posé sur la pièce (rouleaux sur ressorts, ENT_DOWN mm sous le dessus, bloc tourné vers le guide) ou escamoté
    { const E=st.entr; let hx=0.32, hy=TABLE_Y+0.30, hz=-0.24, ry=0;
      if(E.placed){ hx=0; hy=TABLE_Y+Math.max(E.y/1000, topAt(0)); hz=E.z/1000; ry=-E.angle*Math.PI/180; }
      head.position.set(hx,hy,hz); head.rotation.y=ry;
      const mz=hz+0.035*Math.cos(ry), mx=hx-0.035*Math.sin(ry);                                // axe du moteur (décalé côté opérateur)
      const K=new THREE.Vector3(mx,hy+0.505,mz); knuckle.position.copy(K);
      const dl=K.y-0.04-(hy+0.425); drop.scale.y=Math.max(0.02,dl); drop.position.set(mx,hy+0.425+dl/2,mz);
      const C=new THREE.Vector3(COLX,K.y,COLZ); setBetween(arm,C,K); colTop.position.copy(C);
      const cl=C.y-0.045-(TABLE_Y+0.025); col.scale.y=cl; col.position.set(COLX,TABLE_Y+0.025+cl/2,COLZ); }
    // protecteur
    const pieceTop=topAt(0), front=frontAt(0);
    const hv=Math.max(st.hv/1000, pieceTop), dh=Math.max(st.dh/1000, front-zi);
    if(st.prot){ prot.rotation.set(0,0,0); prot.position.set(0,0,0); } else { prot.position.set(0,0.30,-0.18); }
    pv.position.set(0,TABLE_Y+hv,zi+0.004); ph.position.set(0,TABLE_Y+0.004,zi+dh);
    { const zv=zi+0.039, zh=zi+dh+0.012, y0v=TABLE_Y+hv+0.022, y0h=TABLE_Y+0.089;
      colV.position.set(0.20,AY,Math.min(zv,0.24)); colH.position.set(0.20,AY,Math.min(zh,0.24));
      const rod=(r,x0,y0,z)=>{ const L=Math.max(0.02,AY-y0); r.scale.y=L; r.position.set(x0,y0+L/2,z); };
      rod(rodV,0.12,y0v,zv); rod(rodH,0.16,y0h,zh);
      linkV.position.set(0.16,AY,zv); linkH.position.set(0.18,AY,zh);
      knobs[0].position.set(0.235,AY,Math.min(zv,0.24)); knobs[1].position.set(0.235,AY,Math.min(zh,0.24)); }
    // poussoir : sur la rallonge, ou en main au bout arrière de la pièce
    if(push&&push.x!=null){ pous.position.set(push.x+0.002,TABLE_Y,push.z+0.03); pous.rotation.set(0,0,0); }
    else { pous.position.set(0.30,TABLE_Y,0.27); pous.rotation.set(0,0,0); }
    // commandes
    inv.rotation.z = st.dir===1? 0.6 : st.dir===-1? -0.6 : 0;
    au.children[1].position.z = st.au? 0.008 : 0.014;
    ver.userData.k.position.z = st.lock? 0.012 : 0.02; ver.userData.t.position.z = st.lock? 0.032 : 0.04;
    sec.userData.h.rotation.x = st.main? Math.PI/2 : 0; sec.userData.pad.visible = st.cad;
    const pk=[st.h,st.rpm,st.motor,st.dir].join('|'); if(pk!==panelK){ panelK=pk; drawPanel(); }
    // courroie sur l'étage de la vitesse choisie
    const si=Math.max(0,RPMS.indexOf(st.rpm)); if(beltK!==si){ beltK=si;
      belt.geometry.dispose(); const g=beltGeom([MX,MZ],RM[si],[0,0],RA[si],0.016,0.005); g.rotateX(Math.PI/2); belt.geometry=g; belt.position.y=stepY(si); }
  }
  /* rotation (ralentie à l'affichage) ; moteur freiné à l'arrêt (frein électrique) */
  let spin=0;
  let tPrev=null;
  function tick(_dt){ const now=performance.now()/1000, dt=Math.min(0.5, tPrev==null? 0 : now-tPrev); tPrev=now; const on=st.motor&&st.dir!==0; spin += ((on?1:0)-spin)*Math.min(1,dt*(on?2.5:2.6)); if(!on&&spin<0.002) spin=0;
    const w=spin*dt*1.4*(st.dir||lastDir); spinG.rotation.y+=w; pm.rotation.y+=w*0.4; if(on) lastDir=st.dir;
    if(st.entr.on) for(const r of rolls) r.rotation.z-=dt*st.entr.v*0.25; }
  let lastDir=1;
  return { update, tick, pieceRoot, get spin(){ return spin; }, stopNow(){ spin=0; } };
}
