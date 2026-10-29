/* Modèle 3D de la scie à ruban « KANAK 800 RB » (machine fictive de synthèse, volants Ø 800 ; proportions estimées
   d'après les photos de scies à ruban de menuiserie fournies par l'enseignant et l'affiche INRS « Scie à ruban à table »).
   Ne pas afficher de marque réelle.
   Bâti en col-de-cygne à gauche de l'opérateur, volants dans des carters fermés par deux portes interverrouillées,
   brin montant dans la colonne, brin descendant protégé au-dessus du guide-lame supérieur par un protecteur télescopique
   (type Lutrac) solidaire du guide, levier de réglage de la hauteur ; table inclinable avec guide parallèle et guide d'onglet.
   Organes animés : volants (rotation ralentie à l'affichage), dents de la lame (défilement), portes, guide-lame
   supérieur et protecteur (hauteur), table (inclinaison), guide parallèle, guide d'onglet, servante, mains, poussoir. */
import * as THREE from 'three';
import { M, MI, rbox, add, cyl, canvasTex } from '../../engine/kit.js';
import { TABLE_Y, RV, XW, YL, YU, TABLE_X0, TABLE_X1, TABLE_Z0, TABLE_Z1, BRAKE_S } from './constants.js';
import { buildBand } from './lame.js';

/* le Raycaster de three r160 ignore « visible » : un groupe caché ne doit pas intercepter les clics */
function pickable(g){ g.traverse(o=>{ if(o.isMesh){ const rc=o.raycast.bind(o); o.raycast=(r,i)=>{ if(g.visible) rc(r,i); }; } }); }

export function buildModel({ root, tagPart, partMeshes }){
  const GREEN = new THREE.MeshStandardMaterial({color:0x5f8a62, metalness:0.25, roughness:0.5});
  const GREEN2 = new THREE.MeshStandardMaterial({color:0x557c58, metalness:0.25, roughness:0.55});
  const GREENL = new THREE.MeshStandardMaterial({color:0x6f9c70, metalness:0.2, roughness:0.5});
  const YEL = new THREE.MeshStandardMaterial({color:0xe9c22c, metalness:0.2, roughness:0.45});
  const CAST = new THREE.MeshStandardMaterial({color:0x8d969c, metalness:0.55, roughness:0.4});
  const RUBBER = new THREE.MeshStandardMaterial({color:0x2b2d2f, roughness:0.85});
  const LEVER = new THREE.MeshStandardMaterial({color:0x58b84a, roughness:0.45});
  const CLEAR = new THREE.MeshStandardMaterial({color:0xd6e6ee, metalness:0, roughness:0.08, transparent:true, opacity:0.38, side:THREE.DoubleSide, depthWrite:false});
  const SKIN = new THREE.MeshStandardMaterial({color:0xe2ad8b, roughness:0.62});
  const BEECH = new THREE.MeshStandardMaterial({color:0xd8b483, roughness:0.75});
  const ZF = 0.10, ZB = -0.18;                   // face avant et fond des carters
  const HX0 = -1.00, HX1 = 0.08;                 // carters : de la colonne (gauche) à droite du brin descendant

  /* ---------- 01 Bâti en col-de-cygne : socle, colonne, fonds et côtés des carters ---------- */
  const bati = new THREE.Group(); root.add(bati);
  add(bati, rbox(1.20,0.08,0.46,GREEN2,0.01), (HX0+HX1)/2,0.04,-0.04);
  const shell=(y0,y1)=>{ const h=y1-y0, ym=(y0+y1)/2;
    add(bati, rbox(HX1-HX0,h,0.02,GREEN,0.004), (HX0+HX1)/2,ym,ZB+0.01);                       // fond
    add(bati, rbox(0.02,h,ZF-ZB,GREEN,0.004), HX0+0.01,ym,(ZF+ZB)/2);                           // côté gauche
    add(bati, rbox(0.02,h,ZF-ZB,GREEN,0.004), HX1-0.01,ym,(ZF+ZB)/2);                           // côté droit
    add(bati, rbox(HX1-HX0,0.02,ZF-ZB,GREEN,0.004), (HX0+HX1)/2,y1-0.01,(ZF+ZB)/2);             // dessus
    add(bati, rbox(HX1-HX0,0.02,ZF-ZB,GREEN,0.004), (HX0+HX1)/2,y0+0.01,(ZF+ZB)/2); };          // dessous
  shell(0.08,0.92); shell(1.56,2.48);
  add(bati, rbox(0.38,0.66,ZF-ZB,GREEN,0.01), -0.81,1.24,(ZF+ZB)/2);                           // colonne (le brin montant passe dedans)
  for(const y of [0.08,2.46]) add(bati, rbox(0.12,0.02,0.02,M.dark,0.003), HX1-0.03,y+(y<1?0.02:-0.02),ZF+0.005);
  tagPart(bati,'bati');
  for(const m of partMeshes.bati) m.material=m.material.clone();
  // carter du brin montant : face avant de la colonne, de la table au carter supérieur
  const carterM = new THREE.Group(); root.add(carterM);
  add(carterM, rbox(0.10,0.64,0.012,GREENL,0.003), -0.80,1.24,ZF+0.006);
  tagPart(carterM,'carter_montant');

  /* ---------- 02 / 03 Volants supérieur et inférieur (jante garnie d'un bandage), 04 bandage ---------- */
  function wheel(y){ const g=new THREE.Group(); g.position.set(XW,y,-0.0225); root.add(g);
    const spin=new THREE.Group(); g.add(spin);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(RV-0.004,RV-0.004,0.05,72,1,true).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:0x9aa2a8,metalness:0.6,roughness:0.4,side:THREE.DoubleSide}));
    spin.add(rim);
    add(spin, cyl(0.07,0.07,CAST,32,'z'), 0,0,0); add(spin, cyl(0.03,0.09,M.steel,20,'z'), 0,0,0);
    for(let i=0;i<6;i++){ const a=i*Math.PI/3, s=rbox(RV-0.08,0.035,0.022,CAST,0.008); s.position.set(Math.cos(a)*(RV/2+0.02),Math.sin(a)*(RV/2+0.02),0); s.rotation.z=a; spin.add(s); }
    const band=new THREE.Mesh(new THREE.CylinderGeometry(RV,RV,0.045,72,1,true).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:0x26282a,roughness:0.9,side:THREE.DoubleSide}));
    g.add(band);
    return { g, spin, band }; }
  const wU=wheel(YU), wL=wheel(YL);
  tagPart(wU.spin,'volant_sup'); tagPart(wL.spin,'volant_inf');
  const bandG=new THREE.Group(); bandG.add(wU.band, wL.band); root.add(bandG); wU.band.position.set(XW,YU,-0.0225); wL.band.position.set(XW,YL,-0.0225); wU.g.remove(wU.band); wL.g.remove(wL.band);
  tagPart(bandG,'bandage');
  // arbre du volant inférieur, poulie, courroie et moteur-frein (derrière le carter inférieur)
  const moteur=new THREE.Group(); root.add(moteur);
  add(moteur, cyl(0.035,0.18,M.steel,20,'z'), XW,YL,ZB-0.08);
  add(moteur, cyl(0.12,0.05,MI.cast,40,'z'), XW,YL,ZB-0.15);
  add(moteur, cyl(0.12,0.34,MI.motor,32,'x'), -0.30,0.22,ZB-0.17);
  add(moteur, cyl(0.06,0.05,MI.cast,32,'z'), -0.12,0.22,ZB-0.15);
  add(moteur, rbox(0.12,0.08,0.10,MI.motor,0.01), -0.32,0.36,ZB-0.17);
  { const pts=[[XW,YL+0.12],[-0.12,0.28],[-0.12,0.16],[XW,YL-0.12]]; const s=new THREE.Shape(); s.moveTo(...pts[0]); for(const p of pts.slice(1)) s.lineTo(...p); s.closePath();
    const m=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:0.03,bevelEnabled:false}),MI.belt); m.position.z=ZB-0.165; moteur.add(m); }
  tagPart(moteur,'moteur');
  // brosse de nettoyage du bandage du volant inférieur
  const brosse=new THREE.Group(); root.add(brosse);
  add(brosse, rbox(0.06,0.03,0.06,M.dark,0.004), -0.12,YL-RV-0.005,-0.0225);
  for(let i=0;i<6;i++) add(brosse, rbox(0.004,0.03,0.05,new THREE.MeshStandardMaterial({color:0x8a5a2a,roughness:0.9}),0), -0.145+i*0.01,YL-RV+0.012,-0.0225);
  tagPart(brosse,'brosse');

  /* ---------- 05 Lame (ruban sans fin) ---------- */
  const band=buildBand(); root.add(band.group);
  const lameG=new THREE.Group(); root.add(lameG); lameG.add(band.group);
  /* la lame est rattachée à l'organe « lame » à chaque montage (ses maillages changent) */
  function setBlade(b, inv){ band.set(b, inv); partMeshes.lame=[]; tagPart(lameG,'lame'); }

  /* ---------- 06 / 07 Portes des volants (charnières à gauche), 08 fenêtre de contrôle ---------- */
  function door(y0,y1,part){ const g=new THREE.Group(); g.position.set(-0.86,0,ZF+0.012); root.add(g);
    const w=HX1-(-0.86)+0.005, h=y1-y0;
    add(g, rbox(w,h,0.022,GREEN,0.012), w/2,(y0+y1)/2,0);
    add(g, rbox(0.03,0.10,0.03,M.dark,0.006), w-0.06,(y0+y1)/2,0.022);                        // poignée
    for(const yy of [y0+0.12,y1-0.12]) add(g, cyl(0.012,0.06,M.steel,12), -0.005,yy,0);       // charnières
    tagPart(g,part); return g; }
  const doorU=door(1.565,2.475,'porte_sup'), doorL=door(0.085,0.915,'porte_inf');
  for(const k of ['porte_sup','porte_inf']) for(const m of partMeshes[k]) m.material=m.material.clone();
  const fen=new THREE.Group(); doorU.add(fen);
  { const m=new THREE.Mesh(new THREE.PlaneGeometry(0.07,0.05),new THREE.MeshStandardMaterial({color:0x1a2a33,metalness:0.1,roughness:0.1,transparent:true,opacity:0.75}));
    m.position.set(0.70,2.30,0.0115); fen.add(m); add(fen, rbox(0.084,0.064,0.006,M.dark,0.002), 0.70,2.30,0.010); }
  tagPart(fen,'fenetre');
  // marque fictive sur la porte supérieure
  { const draw=(g,w,h)=>{ g.clearRect(0,0,w,h); g.font='italic 700 150px "Barlow Condensed","Arial Narrow",sans-serif'; const w1=g.measureText('KANAK').width; g.fillStyle='#f3f1e8'; g.fillText('KANAK',16,h/2+52);
      g.font='italic 500 104px "Barlow Condensed","Arial Narrow",sans-serif'; g.fillStyle='#1d2a1e'; g.fillText('800 RB',16+w1+30,h/2+48); };
    const t=canvasTex(1024,256,draw), m=new THREE.Mesh(new THREE.PlaneGeometry(0.40,0.10),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false}));
    m.position.set(0.40,2.38,0.0115); doorU.add(m); document.fonts?.ready.then(()=>{ draw(t.userData.canvas.getContext('2d'),1024,256); t.needsUpdate=true; }); }
  // pictogrammes et consignes sur la porte supérieure
  { const t=canvasTex(512,360,(g,w,h)=>{ g.fillStyle='#f6f3ea'; g.fillRect(0,0,w,h); g.fillStyle='#1a1a1a'; g.font='bold 34px sans-serif'; g.fillText('SCIE À RUBAN',24,52);
      const tri=(x,y)=>{ g.fillStyle='#f0b323'; g.beginPath(); g.moveTo(x,y+70); g.lineTo(x+40,y); g.lineTo(x+80,y+70); g.closePath(); g.fill(); g.fillStyle='#111'; g.font='bold 46px sans-serif'; g.fillText('!',x+33,y+62); };
      tri(24,80); g.fillStyle='#1a5fb4'; for(const x of [130,230,330]){ g.beginPath(); g.arc(x+36,118,36,0,7); g.fill(); }
      g.fillStyle='#fff'; g.font='bold 20px sans-serif'; g.fillText('lunettes',134,124); g.fillText('casque',236,124); g.fillText('poussoir',334,124);
      g.fillStyle='#c4261c'; g.fillRect(0,190,w,52); g.fillStyle='#fff'; g.font='bold 24px sans-serif'; g.fillText('N\'OUVREZ PAS AVANT L\'ARRÊT COMPLET',20,224);
      g.fillStyle='#1a5fb4'; g.fillRect(0,250,w,86); g.fillStyle='#fff'; g.font='bold 22px sans-serif'; g.fillText('PROTECTEUR AU PLUS BAS · POUSSOIR',20,284); g.fillText('EN FIN DE PASSE',20,316); });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.26,0.18),new THREE.MeshBasicMaterial({map:t,toneMapped:false})); m.position.set(0.32,1.86,0.0115); doorU.add(m); }

  /* ---------- 09 Volant de tension (sous le carter supérieur) et 10 indicateur de tension ---------- */
  const tension=new THREE.Group(); root.add(tension);
  add(tension, cyl(0.012,0.10,M.steel,16), -0.52,1.51,-0.04);
  add(tension, new THREE.Mesh(new THREE.TorusGeometry(0.075,0.009,10,36).rotateX(Math.PI/2),M.dark), -0.52,1.46,-0.04);
  for(let i=0;i<4;i++){ const s=rbox(0.15,0.012,0.012,M.dark,0.003); s.position.set(-0.52,1.46,-0.04); s.rotation.y=i*Math.PI/4; tension.add(s); }
  add(tension, cyl(0.022,0.03,M.dark,16), -0.52,1.46,-0.04);
  tagPart(tension,'tension');
  const indic=new THREE.Group(); root.add(indic);
  const indicT=canvasTex(128,384,(g,w,h)=>{ g.fillStyle='#f3f1e8'; g.fillRect(0,0,w,h); g.fillStyle='#1b1f22'; g.font='bold 26px sans-serif';
    for(let mm=0;mm<=50;mm+=5){ const y=h-20-mm/50*(h-50); g.fillRect(70,y,mm%10?24:44,3); if(mm%10===0&&mm) g.fillText(String(mm),10,y+9); } g.font='bold 20px sans-serif'; g.fillText('mm',72,24); });
  { const m=new THREE.Mesh(new THREE.PlaneGeometry(0.045,0.135),new THREE.MeshBasicMaterial({map:indicT,toneMapped:false})); m.position.set(-0.93,1.80,ZF+0.002); indic.add(m);
    add(indic, rbox(0.055,0.148,0.008,M.dark,0.002), -0.93,1.80,ZF-0.002); }
  const needle=add(indic, rbox(0.03,0.004,0.004,M.red,0), -0.925,1.80,ZF+0.005);
  tagPart(indic,'indicateur');
  /* ---------- 11 Réglage du dévers (inclinaison du volant supérieur), à l'arrière ---------- */
  const devers=new THREE.Group(); root.add(devers);
  add(devers, cyl(0.01,0.08,M.steel,12,'z'), XW,YU-0.12,ZB-0.04);
  add(devers, cyl(0.035,0.03,M.dark,16,'z'), XW,YU-0.12,ZB-0.085);
  add(devers, cyl(0.008,0.05,M.dark,10,'x'), XW+0.03,YU-0.12,ZB-0.10);
  tagPart(devers,'devers');

  /* ---------- 12 Guide-lame supérieur, 13 protecteur télescopique, 14 coulisseau et levier de hauteur ---------- */
  const upper=new THREE.Group(); root.add(upper);           // au bas du guide : y = TABLE_Y + hg
  const guideS=new THREE.Group(); upper.add(guideS);
  const prot=new THREE.Group(); upper.add(prot);
  const coul=new THREE.Group(); upper.add(coul);
  /* galets (axes le long de X) : latéraux de part et d'autre de la lame, arrière derrière le dos */
  function galets(parent, yy){ const o={};
    o.body=add(parent, rbox(0.11,0.05,0.06,YEL,0.006), 0,yy+0.035,-0.06);
    o.latL=new THREE.Group(); o.latR=new THREE.Group(); parent.add(o.latL,o.latR);
    for(const [G,s] of [[o.latL,-1],[o.latR,1]]){ add(G, cyl(0.013,0.026,M.steel,20,'x'), s*0.013,yy+0.02,0); add(G, cyl(0.008,0.05,MI.zinc,14,'x'), s*0.05,yy+0.02,0); add(G, cyl(0.012,0.012,M.brass,14,'x'), s*0.08,yy+0.02,0); }
    o.back=new THREE.Group(); parent.add(o.back); add(o.back, cyl(0.018,0.012,M.steel,24,'x'), 0,yy+0.02,0); add(o.back, cyl(0.006,0.05,MI.zinc,10,'x'), 0.025,yy+0.02,0);
    return o; }
  const gS=galets(guideS,0);
  tagPart(guideS,'guide_sup');
  // protecteur : écran transparent devant la lame (se rabat pour changer la lame) et canal télescopique au-dessus du guide
  add(prot, rbox(0.075,0.085,0.004,CLEAR,0.001), 0,0.045,0.035);
  for(const s of [-1,1]) add(prot, rbox(0.004,0.085,0.05,CLEAR,0.001), s*0.037,0.045,0.012);
  const chanIn=new THREE.Group(); prot.add(chanIn);
  add(chanIn, rbox(0.05,0.46,0.006,YEL,0.002), 0,0.30,0.022); for(const s of [-1,1]) add(chanIn, rbox(0.004,0.46,0.07,YEL,0.001), s*0.025,0.30,-0.012);
  tagPart(prot,'protecteur');
  const chanOut=new THREE.Group(); root.add(chanOut);
  add(chanOut, rbox(0.058,0.34,0.006,YEL,0.002), 0,1.56-0.17,0.028); for(const s of [-1,1]) add(chanOut, rbox(0.004,0.34,0.075,YEL,0.001), s*0.029,1.56-0.17,-0.01);
  tagPart(chanOut,'protecteur');
  // coulisseau (barre à crémaillère) et levier vert sur le flanc droit du carter supérieur
  add(coul, rbox(0.026,0.62,0.026,M.steel,0.004), 0.05,0.39,-0.07);
  add(coul, rbox(0.06,0.02,0.04,M.steel,0.004), 0.03,0.075,-0.07);
  const lever=new THREE.Group(); root.add(lever); lever.position.set(HX1+0.02,1.72,-0.02);
  add(lever, cyl(0.03,0.04,M.dark,20,'x'), 0,0,0);
  { const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.013,0.30,12),LEVER); arm.position.set(0.03,-0.14,0.045); arm.rotation.x=0.3; lever.add(arm);
    const kn=new THREE.Mesh(new THREE.CapsuleGeometry(0.018,0.05,4,10),M.dark); kn.position.set(0.03,-0.30,0.095); kn.rotation.x=0.3; lever.add(kn); }
  add(lever, cyl(0.018,0.03,M.dark,14,'x'), 0.025,0.06,0.03);   // molette de blocage
  tagPart(coul,'coulisseau'); tagPart(lever,'coulisseau');

  /* ---------- 15 Guide-lame inférieur (sous la table) ---------- */
  const guideI=new THREE.Group(); root.add(guideI); guideI.position.y=TABLE_Y-0.11;
  const gI=galets(guideI,0);
  tagPart(guideI,'guide_inf');

  /* ---------- table inclinable : plateau, bloc de table, rainure, règle et guide parallèle, guide d'onglet ---------- */
  const tilt=new THREE.Group(); tilt.position.set(0,TABLE_Y,0); root.add(tilt);
  const table=new THREE.Group(); tilt.add(table);
  const TW=TABLE_X1-TABLE_X0, TD=TABLE_Z1-TABLE_Z0;
  { const t=canvasTex(1024,Math.round(1024*TD/TW),(g,w,h)=>{ let s=5; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
      g.fillStyle='#9aa1a6'; g.fillRect(0,0,w,h); for(let i=0;i<9000;i++){ g.fillStyle=`rgba(${rnd()<.5?60:220},${rnd()<.5?64:225},70,${0.04+rnd()*0.06})`; g.fillRect(rnd()*w,rnd()*h,1+rnd()*2,1); }
      const X=x=>(x-TABLE_X0)/TW*w, Z=z=>(z-TABLE_Z0)/TD*h;
      g.fillStyle='#30353a'; g.fillRect(X(0),Z(-0.008),w-X(0),2);                                        // fente de la table (passage de la lame)
      g.fillStyle='#4a5157'; g.fillRect(X(-0.21),0,X(-0.19)-X(-0.21),h); });                            // rainure du guide d'onglet
    const top=new THREE.Mesh(new THREE.BoxGeometry(TW,0.05,TD),[CAST,CAST,new THREE.MeshStandardMaterial({map:t,metalness:0.5,roughness:0.42}),CAST,CAST,CAST]);
    top.position.set((TABLE_X0+TABLE_X1)/2,-0.025,(TABLE_Z0+TABLE_Z1)/2); table.add(top);
    for(const z of [TABLE_Z0+0.05,TABLE_Z1-0.05]) add(table, rbox(TW-0.06,0.06,0.03,CAST,0.004), (TABLE_X0+TABLE_X1)/2,-0.08,z); }
  tagPart(table,'table');
  const bloc=new THREE.Group(); table.add(bloc);
  { const m=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.0012,40),BEECH); m.position.set(0,0.0007,-0.015); bloc.add(m);
    const k=new THREE.Mesh(new THREE.BoxGeometry(0.003,0.0016,0.06),M.dark); k.position.set(0,0.0012,-0.015); bloc.add(k); }
  tagPart(bloc,'bloc_table');
  // règle et rail du guide parallèle (bord avant de la table), graduée depuis la lame
  const regle=new THREE.Group(); table.add(regle);
  add(regle, rbox(TW,0.04,0.035,M.alu,0.004), (TABLE_X0+TABLE_X1)/2,-0.03,TABLE_Z1+0.02);
  { const t=canvasTex(2048,64,(g,w,h)=>{ g.fillStyle='#e4e7e2'; g.fillRect(0,0,w,h); g.fillStyle='#1c1f22'; g.font='bold 24px monospace'; const px=w/500;
      for(let mm=0;mm<=500;mm+=5){ const x=mm*px, L=mm%50===0?40:mm%10===0?26:12; g.fillRect(x,0,2,L); if(mm%50===0&&mm>0&&mm<500) g.fillText(String(mm),x-14,60); } });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.50,0.022),new THREE.MeshBasicMaterial({map:t,toneMapped:false})); m.rotation.x=-Math.PI/2; m.position.set(0.25+0.0007,-0.0095,TABLE_Z1+0.02); regle.add(m); }
  tagPart(regle,'regle');
  const fence=new THREE.Group(); table.add(fence);
  add(fence, rbox(0.04,0.13,0.80,M.alu,0.004), 0.02,0.065,-0.0);
  add(fence, rbox(0.10,0.07,0.08,M.dark,0.008), 0.03,-0.02,TABLE_Z1+0.03);
  add(fence, cyl(0.014,0.07,M.red,12), 0.075,0.03,TABLE_Z1+0.03);
  add(fence, rbox(0.004,0.008,0.012,M.red,0), 0.0,-0.006,TABLE_Z1+0.02);                       // index sur la règle
  tagPart(fence,'guide_par');
  const onglet=new THREE.Group(); table.add(onglet);
  const ongHead=new THREE.Group(); ongHead.position.set(-0.20,0,0.16); onglet.add(ongHead);
  add(onglet, rbox(0.018,0.008,0.40,M.steel,0.002), -0.20,-0.002,0.05);
  { const s=new THREE.Shape(); s.absarc(0,0,0.075,0,Math.PI,false); s.closePath(); const g=new THREE.ExtrudeGeometry(s,{depth:0.012,bevelEnabled:false}); g.rotateX(-Math.PI/2);
    const m=new THREE.Mesh(g,M.alu); m.position.y=0.002; ongHead.add(m); }
  add(ongHead, rbox(0.30,0.05,0.02,M.alu,0.003), -0.10,0.035,-0.012);
  add(ongHead, cyl(0.012,0.05,M.red,12), 0,0.04,0.05);
  tagPart(onglet,'onglet');
  /* support de rangement sur pied, à droite de la machine, hors de la table : le guide parallèle et le guide d'onglet
     retirés y sont accrochés verticalement (la table est entièrement libre) */
  const rack=new THREE.Group(); rack.position.set(0.98,0,-0.88); root.add(rack);
  add(rack, rbox(0.30,0.02,0.30,M.dark,0.004), 0,0.01,0); add(rack, rbox(0.04,1.55,0.04,M.dark,0.004), 0,0.795,0);
  for(const [y,z] of [[1.50,0.07],[1.28,-0.07]]) add(rack, rbox(0.012,0.012,0.10,M.steel,0.002), -0.03,y,z);
  // 18 inclinaison : secteurs sous la table (pivot au ras de la table, au droit de la lame) et poignée de blocage
  const incl=new THREE.Group(); root.add(incl);
  for(const z of [-0.25,0.25]){ const s=new THREE.Shape(), r0=0.10, r1=0.16; s.absarc(0,0,r1,Math.PI*1.15,Math.PI*1.85,false); s.absarc(0,0,r0,Math.PI*1.85,Math.PI*1.15,true);
    const g=new THREE.ExtrudeGeometry(s,{depth:0.02,bevelEnabled:false}); const m=new THREE.Mesh(g,CAST); m.position.set(0.0,TABLE_Y-0.03,z-0.01); incl.add(m); }
  add(incl, rbox(0.06,0.06,0.56,CAST,0.008), 0.0,TABLE_Y-0.22,0);
  add(incl, cyl(0.01,0.12,M.steel,10,'z'), 0.06,TABLE_Y-0.17,TABLE_Z1-0.05);
  add(incl, new THREE.Mesh(new THREE.SphereGeometry(0.022,12,8),M.dark), 0.06,TABLE_Y-0.17,TABLE_Z1+0.02);
  tagPart(incl,'inclinaison');

  /* ---------- 19 Servante (pièces longues), 20 poussoir ---------- */
  const serv=new THREE.Group(); root.add(serv);
  add(serv, cyl(0.03,0.36,M.alu,18,'x'), 0,TABLE_Y-0.03,0); add(serv, rbox(0.40,0.03,0.04,M.dark,0.004), 0,TABLE_Y-0.065,0);
  add(serv, rbox(0.04,TABLE_Y-0.08,0.04,M.dark,0.004), 0,(TABLE_Y-0.08)/2,0); add(serv, rbox(0.40,0.02,0.40,M.dark,0.004), 0,0.01,0);
  tagPart(serv,'servante');
  const poussR=new THREE.Group(); root.add(poussR);           // poussoir accroché sur le côté droit de la table
  function poussoirMesh(){ const g=new THREE.Group(); const b=rbox(0.40,0.025,0.06,BEECH,0.004); b.position.set(0,0.035,0); g.add(b);
    const h=rbox(0.10,0.04,0.03,M.red,0.008); h.position.set(0.14,0.07,0); g.add(h); const k=rbox(0.03,0.025,0.06,BEECH,0.003); k.position.set(-0.185,0.012,0); g.add(k); return g; }
  const pHook=poussoirMesh(); pHook.rotation.z=Math.PI/2; pHook.position.set(TABLE_X1+0.04,TABLE_Y-0.22,0.12); poussR.add(pHook);
  const pHand=poussoirMesh(); tilt.add(pHand); pHand.visible=false;
  tagPart(poussR,'poussoir'); tagPart(pHand,'poussoir');
  /* gabarit en vé (pièces rondes) : deux cales à 45° de part et d'autre du rondin, traverse arrière fendue au droit de la lame,
     planchette de poussée et poignée ; il glisse avec le rondin et tient les mains loin de la lame. Dimensions en m, repère de la table. */
  const gab=new THREE.Group(); tilt.add(gab); gab.visible=false; pickable(gab);
  function wedge(sg){ const R=0.045, xa=0.0186, W=0.075, Hh=0.045, sh=new THREE.Shape();
    sh.moveTo(sg*xa,0); sh.lineTo(sg*W,0); sh.lineTo(sg*W,Hh); sh.lineTo(sg*(xa+Hh),Hh); sh.closePath();
    const g=new THREE.ExtrudeGeometry(sh,{depth:1,bevelEnabled:false}); const m=new THREE.Mesh(g,BEECH); m.castShadow=true; return m; }
  const gW=[wedge(1),wedge(-1)]; gW.forEach(m=>gab.add(m));
  const gBar=[rbox(0.072,0.05,0.04,BEECH,0.003),rbox(0.072,0.05,0.04,BEECH,0.003)]; gBar.forEach(m=>gab.add(m));
  const gBoard=rbox(0.16,0.02,0.16,BEECH,0.003); gab.add(gBoard);
  const gHandle=rbox(0.12,0.045,0.035,M.red,0.01); gab.add(gHandle);

  /* ---------- 21 Boîtier de commande, 22 arrêt d'urgence, 23 sectionneur cadenassable, 24 aspiration ---------- */
  const cmd=new THREE.Group(); root.add(cmd);
  add(cmd, rbox(0.17,0.20,0.08,M.panel,0.01), -0.81,1.13,ZF+0.04);
  { const t=canvasTex(256,300,(g,w,h)=>{ g.fillStyle='#2f363d'; g.fillRect(0,0,w,h); g.fillStyle='#e9ecef'; g.font='italic 700 28px "Barlow Condensed",sans-serif'; g.fillText('KANAK 800 RB',18,36);
      const b=(x,y,c,t)=>{ g.fillStyle='#14181c'; g.fillRect(x-34,y-34,68,68); g.fillStyle=c; g.beginPath(); g.arc(x,y,25,0,7); g.fill(); g.fillStyle=c==='#f2f2ee'?'#111':'#fff'; g.font='bold 24px sans-serif'; g.fillText(t,x-7,y+8); };
      b(70,110,'#f2f2ee','I'); b(180,110,'#14181c','O'); g.fillStyle='#e9ecef'; g.font='18px sans-serif'; g.fillText('lame (frein automatique)',22,180);
      g.fillStyle='#f0b323'; g.beginPath(); g.arc(60,240,14,0,7); g.fill(); g.fillStyle='#e9ecef'; g.fillText('défreinage',86,246); });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.16,0.19),new THREE.MeshBasicMaterial({map:t,toneMapped:false})); m.position.set(-0.81,1.13,ZF+0.0805); cmd.add(m); }
  tagPart(cmd,'commande');
  const au=new THREE.Group(); root.add(au);
  add(au, rbox(0.09,0.09,0.05,M.yellow,0.006), -0.81,0.98,ZF+0.025);
  const auBtn=add(au, cyl(0.03,0.03,M.red,24,'z'), -0.81,0.98,ZF+0.065);
  tagPart(au,'arret');
  const sect=new THREE.Group(); root.add(sect);
  add(sect, rbox(0.03,0.16,0.14,M.panel,0.008), HX0-0.015,1.30,-0.02);
  const sectH=new THREE.Group(); sectH.position.set(HX0-0.04,1.30,-0.02); sect.add(sectH);
  add(sectH, cyl(0.035,0.02,M.yellow,24,'x'), 0,0,0); add(sectH, rbox(0.03,0.10,0.025,M.red,0.006), -0.02,0,0);
  const padlock=new THREE.Group(); padlock.position.set(HX0-0.06,1.22,-0.02); sect.add(padlock);
  add(padlock, rbox(0.03,0.035,0.045,M.red,0.006), 0,0,0); add(padlock, new THREE.Mesh(new THREE.TorusGeometry(0.014,0.004,8,20,Math.PI).rotateY(Math.PI/2),M.steel), 0,0.017,0);
  tagPart(sect,'sectionneur');
  const asp=new THREE.Group(); root.add(asp);
  add(asp, cyl(0.06,0.20,M.dark,24,'z'), -0.05,0.80,ZB-0.08); add(asp, cyl(0.064,0.30,MI.hose,24), -0.05,0.62,ZB-0.20);
  add(asp, cyl(0.05,0.16,M.dark,24,'z'), -0.62,0.20,ZB-0.06);
  tagPart(asp,'aspiration');

  /* ---------- mains (pas un organe : non cliquables) ---------- */
  function handMesh(){ const h=new THREE.Group();
    const palm=rbox(0.085,0.026,0.095,SKIN,0.012); palm.position.set(0,0.016,0.03); h.add(palm);
    [[-0.030,0.075],[-0.010,0.085],[0.010,0.083],[0.029,0.072]].forEach(([x,l])=>{ const f=new THREE.Mesh(new THREE.CapsuleGeometry(0.0085,l-0.017,4,10),SKIN); f.rotation.x=Math.PI/2; f.position.set(x,0.012,-0.017-l/2+0.008); h.add(f); });
    const wr=new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.032,0.16,16).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:0x34506e,roughness:0.8})); wr.position.set(0,0.045,0.15); wr.rotation.x=-0.42; h.add(wr);
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.075,0.09,40),new THREE.MeshBasicMaterial({color:0xc4261c,transparent:true,opacity:0.55,depthWrite:false})); ring.rotation.x=-Math.PI/2; ring.position.y=0.001; h.add(ring); h.userData.ring=ring;
    h.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); return h; }
  const hands=[handMesh(),handMesh()]; for(const h of hands){ h.visible=false; tilt.add(h); pickable(h); }
  pickable(pHand);

  const pieceRoot=new THREE.Group(); tilt.add(pieceRoot);

  /* ---------- mise à jour ----------
     S = { hg (mm), tilt (°), fence, fx (m, face du guide), mitOn, mit (°), serv, doors, cad, au, rack (false : sans support de rangement), ten (mm), guide:{ L,B,F, Li,Bi,Fi } (mm),
           e (épaisseur de lame, mm), hands:[{x,z,y,bad,rot}] (m), pouss:{x,z,y,th,w}|null, gab:{z0,z1}|null } */
  function update(S){
    upper.position.y=TABLE_Y+S.hg/1000;
    chanIn.position.y=0;     // le canal intérieur suit le guide ; l'extérieur reste fixe : le brin descendant est toujours couvert
    tilt.rotation.z=-S.tilt*Math.PI/180;
    // guide parallèle retiré et guide d'onglet rangé : décrochés de la table, accrochés au support de rangement
    rack.visible=S.rack!==false; if(S.rack===false) rack.position.set(-0.4,0.3,-0.05); else rack.position.set(0.98,0,-0.88);   // poste de l'atelier : sans support (encombrement)
    if(S.fence){ if(fence.parent!==table) table.add(fence); fence.position.set(S.fx,0,0); fence.rotation.set(0,0,0); }
    else { if(fence.parent!==rack) rack.add(fence); fence.position.set(-0.06,1.04,0.11); fence.rotation.set(-Math.PI/2,0,0); }
    if(S.mitOn){ if(onglet.parent!==table) table.add(onglet); onglet.position.set(0,0,0); onglet.rotation.set(0,0,0); }
    else { if(onglet.parent!==rack) rack.add(onglet); onglet.position.set(0.18,1.20,-0.10); onglet.rotation.set(-Math.PI/2,0,0); }
    ongHead.rotation.y= S.mitOn? -(S.mit||0)*Math.PI/180 : 0;
    serv.position.set(S.serv? 0.05 : 0.95, 0, S.serv? -0.80 : -0.45); serv.rotation.y= S.serv? 0 : Math.PI/2;
    doorU.rotation.y= S.doors? -1.75 : 0; doorL.rotation.y= S.doors? -1.75 : 0;
    sectH.rotation.x= S.main? 0 : Math.PI/2; padlock.visible=!!S.cad;
    auBtn.position.z= ZF+(S.au? 0.055 : 0.065);
    needle.position.y=1.80-0.0675+0.0144+Math.min(50,Math.max(0,S.ten))/50*(0.135-0.0234);
    // guide-lames : galets latéraux (jeu), avant des galets et galet arrière (mm derrière la pointe des dents)
    const e=(S.e||0.8)/1000;
    for(const [o,L,B,F] of [[gS,S.guide.L,S.guide.B,S.guide.F],[gI,S.guide.Li,S.guide.Bi,S.guide.Fi]]){
      const zc=-F/1000-0.013; o.latL.position.set(-(e/2+L/1000),0,zc); o.latR.position.set(e/2+L/1000,0,zc);
      o.back.position.set(0,0,-B/1000-0.018); o.body.position.z=Math.min(-0.045,-B/1000-0.055); }
    // mains et poussoir (repère de la table inclinée)
    // objets cachés : non cliquables (pickable), le Raycaster ignorant « visible »
    hands.forEach((h,i)=>{ const d=S.hands?.[i]; h.visible=!!d; if(d){ h.position.set(d.x,d.y,d.z); h.rotation.y=d.rot||0; h.userData.ring.visible=!!d.bad; } });
    pHand.visible=!!S.pouss; if(S.pouss){ pHand.position.set(S.pouss.x,S.pouss.y,S.pouss.z); pHand.rotation.y=S.pouss.th||0;
      const k=(S.pouss.w||0.06)/0.06; pHand.children[0].scale.z=k; pHand.children[2].scale.z=k; }
    // gabarit : de l'avant du rondin (z0) à son arrière (z1), traverse et planchette derrière
    gab.visible=!!S.gab; if(S.gab){ const {z0,z1}=S.gab, L=z1-z0+0.03;
      gW.forEach(m=>{ m.scale.z=L; m.position.z=z0-0.01; });
      gBar[0].position.set(0.040,0.025,z1+0.022); gBar[1].position.set(-0.040,0.025,z1+0.022);
      gBoard.position.set(0,0.010,z1+0.12); gHandle.position.set(0,0.042,z1+0.15); }
    pHook.visible=!S.pouss;
  }
  /* animation : volants et dents (rotation ralentie à l'affichage) ; spin = vitesse relative 0 à 1, freinée en BRAKE_S */
  let spin=0;
  function tick(dt, motorOn){ if(motorOn) spin=Math.min(1,spin+dt/1.5); else spin=Math.max(0,spin-dt/BRAKE_S);
    wU.spin.rotation.z-=spin*dt*1.2; wL.spin.rotation.z-=spin*dt*1.2; band.advance(spin*dt*0.30); return spin; }
  return { update, tick, setBlade, pieceRoot, get spin(){ return spin; }, stopNow(){ spin=0; }, setSpin(v){ spin=v; } };
}
