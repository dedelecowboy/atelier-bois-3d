/* Modèle 3D de la dégauchisseuse « KANAK 520 D » (d'après une dégauchisseuse de 520 mm type UTIS D52
   avec protecteur SUVAMATIC). Marque fictive : ne pas afficher la marque réelle.
   Arbre porte-outils à 4 fers ; sens de rotation : les fers du haut vont vers l'opérateur (+X), contre l'avance. */
import * as THREE from 'three';
import { M, MI, rbox, add, cyl, link, setBetween, canvasTex, rulerTex, beltGeom, pulley } from '../../engine/kit.js';
import { TABLE_Y, R_CUT, ARBRE_Y, TABLE_W, TABLE_F, TABLE_B, LIP, TABLE_L } from './constants.js';
import { st, guideZ } from './state.js';

export function buildModel({ root, tagPart, partMeshes }){
  const YEL = new THREE.MeshStandardMaterial({color:0xf0b323, metalness:0.15, roughness:0.45});
  const CAST = new THREE.MeshStandardMaterial({color:0xb9bec3, metalness:0.55, roughness:0.32});
  const TX = (TABLE_L/2)+LIP;           // centre X d'une table

  /* ---------- Bâti ---------- */
  const bati = new THREE.Group(); root.add(bati);
  add(bati, rbox(1.30,0.74,0.60,M.body,0.012), 0,0.43,0);
  add(bati, rbox(1.24,0.06,0.56,M.dark,0.004), 0,0.03,0);
  add(bati, rbox(1.32,0.18,0.012,M.panel,0.004), 0,0.66,0.306);            // bandeau sombre en façade
  add(bati, rbox(0.012,0.18,0.56,M.panel,0.004), 0.656,0.66,0);
  add(bati, rbox(0.012,0.18,0.56,M.panel,0.004), -0.656,0.66,0);
  add(bati, rbox(0.50,0.28,0.004,M.body,0.002), -0.25,0.36,0.302);          // trappe
  { const draw=(g,w,h)=>{ g.clearRect(0,0,w,h);
      const f1=z=>`italic 700 ${z}px "Barlow Condensed","Arial Narrow",sans-serif`, f2=z=>`700 ${z}px "Barlow Condensed","Arial Narrow",sans-serif`;
      let z=170; g.font=f1(z); const w1=g.measureText('KANAK').width; g.fillStyle='#ffffff'; g.fillText('KANAK',16,h/2+z*0.36);
      g.font=f2(z*0.8); g.fillStyle='#f0b46a'; g.fillText('520 D',16+w1+0.12*z,h/2+z*0.33); };
    const t=canvasTex(1024,256,draw);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.52,0.13),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false})); m.position.set(-0.30,0.66,0.3135); bati.add(m);
    document.fonts?.ready.then(()=>{ draw(t.userData.canvas.getContext('2d'),1024,256); t.needsUpdate=true; }); }
  for(const x of [-0.45,0.45]) add(bati, rbox(0.14,0.10,0.40,CAST,0.01), x,0.80,0);   // consoles des tables
  tagPart(bati,'bati');
  for(const m of partMeshes.bati) m.material=m.material.clone();

  /* ---------- Tables (fonte) avec lèvres près de la lumière ---------- */
  function table(sign){ const g=new THREE.Group();
    add(g, rbox(TABLE_L-0.03,0.055,TABLE_W,CAST,0.004), sign*(TX+0.015),-0.0275,0);
    add(g, rbox(0.035,0.012,TABLE_W,CAST,0.002), sign*(LIP+0.0175),-0.006,0);          // lèvre
    add(g, rbox(TABLE_L-0.03,0.045,0.008,M.panel,0.002), sign*(TX+0.015),-0.03,TABLE_F+0.004); // chant avant noir
    for(let i=0;i<6;i++) add(g, rbox(TABLE_L-0.1,0.0015,0.004,M.aluDk,0), sign*(TX+0.02),0.0003,TABLE_B+0.06+i*0.08);
    return g; }
  const tIn=table(1); root.add(tIn); tagPart(tIn,'table_entree');
  const tOut=table(-1); tOut.position.y=TABLE_Y; root.add(tOut); tagPart(tOut,'table_sortie');
  for(const k of ['table_entree','table_sortie']) for(const m of partMeshes[k]) m.material=m.material.clone();

  /* ---------- Arbre porte-outils (4 fers) ---------- */
  const arbreG=new THREE.Group(); arbreG.position.set(0,ARBRE_Y,0); root.add(arbreG);
  const rotor=new THREE.Group(); arbreG.add(rotor);
  rotor.add(cyl(R_CUT-0.008,TABLE_W-0.01,M.steel,40,'z'));
  for(let k=0;k<4;k++){ const a=k*Math.PI/2;
    const knife=rbox(0.003,0.024,TABLE_W-0.012,M.blade,0); knife.position.set(Math.cos(a)*(R_CUT-0.012),Math.sin(a)*(R_CUT-0.012),0); knife.rotation.z=a+0.35; rotor.add(knife);
    const wedge=rbox(0.012,0.018,TABLE_W-0.02,M.dark,0.002); wedge.position.set(Math.cos(a+0.25)*(R_CUT-0.022),Math.sin(a+0.25)*(R_CUT-0.022),0); wedge.rotation.z=a+0.35; rotor.add(wedge); }
  add(rotor, cyl(0.016,TABLE_W+0.10,MI.zinc,16,'z'));
  tagPart(arbreG,'arbre');
  const bearings=new THREE.Group(); root.add(bearings);
  for(const z of [TABLE_B-0.03,TABLE_F+0.03]) add(bearings, rbox(0.10,0.09,0.04,MI.cast,0.006), 0,ARBRE_Y-0.01,z);
  tagPart(bearings,'arbre');

  /* ---------- Moteur et transmission (intérieur) ---------- */
  const MOT=[0.10,0.36], BZ=TABLE_B-0.065;
  const moteur=new THREE.Group(); root.add(moteur);
  add(moteur, cyl(0.09,0.30,MI.motor,32,'z'), MOT[0],MOT[1],-0.09);
  for(let i=0;i<9;i++) add(moteur, cyl(0.097,0.005,MI.motor,32,'z'), MOT[0],MOT[1],-0.21+i*0.03);
  add(moteur, rbox(0.08,0.05,0.09,MI.motor,0.006), MOT[0],MOT[1]+0.11,-0.05);
  add(moteur, rbox(0.22,0.03,0.30,MI.cast,0.004), MOT[0],MOT[1]-0.105,-0.09);
  add(moteur, cyl(0.012,0.12,MI.zinc,12,'z'), MOT[0],MOT[1],BZ+0.05);
  tagPart(moteur,'moteur');
  const trans=new THREE.Group(); root.add(trans);
  const pA=pulley(0.035,0.02,MI.zinc); pA.position.set(0,ARBRE_Y,BZ); trans.add(pA);
  const pM=pulley(0.055,0.02,MI.zinc); pM.position.set(MOT[0],MOT[1],BZ); trans.add(pM);
  const belt=new THREE.Mesh(beltGeom([0,ARBRE_Y],0.035,MOT,0.055,0.018,0.006),MI.belt); belt.position.z=BZ; trans.add(belt);
  tagPart(trans,'transmission');

  /* ---------- Aspiration : bac sous l'arbre + conduit qui se resserre vers la buse Ø 120 mm, sur le côté du bâti (côté table de sortie) ---------- */
  const asp=new THREE.Group(); root.add(asp);
  { const BLUE=new THREE.MeshStandardMaterial({color:0x2c4aa8,metalness:0.3,roughness:0.55,side:THREE.DoubleSide});
    // 1) bac ouvert sous l'arbre, sur toute la largeur, fond incliné vers la sortie (côté table de sortie, −X)
    const OUT=[-0.62,0.42], RO=0.06, XF=0.12, XB=-0.12, ZW=TABLE_W/2-0.012, Y0=TABLE_Y-0.058, YB1=Y0-0.10, YB2=Y0-0.25;
    const pos=[], idx=[]; const quad=(...P)=>{ const n=pos.length/3; for(const q of P) pos.push(...q); idx.push(n,n+1,n+2, n,n+2,n+3); };
    quad([XF,Y0,-ZW],[XF,Y0,ZW],[XF,YB1,ZW],[XF,YB1,-ZW]);                       // paroi côté entrée
    quad([XF,YB1,-ZW],[XF,YB1,ZW],[XB,YB2,ZW],[XB,YB2,-ZW]);                     // fond incliné
    for(const z of [-ZW,ZW]) quad([XF,Y0,z],[XF,YB1,z],[XB,YB2,z],[XB,Y0,z]);    // joues
    // 2) conduit qui se resserre du bac (rectangle) à la buse ronde Ø 120
    const NS=20, NK=48, sq=(c,e)=>Math.sign(c)*Math.pow(Math.abs(c),e), yc=(Y0+YB2)/2, hy=(Y0-YB2)/2;
    const base=pos.length/3;
    for(let i=0;i<=NS;i++){ const t=i/NS, s=t*t*(3-2*t), x=XB+(OUT[0]-XB)*t;
      for(let k=0;k<NK;k++){ const f=k/NK*Math.PI*2, c=Math.cos(f), sn=Math.sin(f);
        const ry=yc+hy*sq(c,0.15), rz=ZW*sq(sn,0.15), cy=OUT[1]+RO*c, cz=RO*sn;
        pos.push(x, ry+(cy-ry)*s, rz+(cz-rz)*s); } }
    for(let i=0;i<NS;i++) for(let k=0;k<NK;k++){ const a2=base+i*NK+k, b2=base+i*NK+(k+1)%NK; idx.push(a2,a2+NK,b2, b2,a2+NK,b2+NK); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
    asp.add(new THREE.Mesh(g,BLUE));
    add(asp, cyl(RO+0.004,0.10,M.dark,32,'x'), -0.68,OUT[1],0);                    // buse à travers le bâti
    add(asp, cyl(RO+0.016,0.012,M.steel,32,'x'), -0.73,OUT[1],0); }                 // collerette (raccord du flexible)
  tagPart(asp,'aspiration');

  /* ---------- Réglage de profondeur de passe : volant + échelle sur la table d'entrée ---------- */
  const prof=new THREE.Group(); root.add(prof);
  { const wheel=new THREE.Mesh(new THREE.TorusGeometry(0.055,0.009,10,28),M.dark); wheel.position.set(0.48,0.70,0.36); prof.add(wheel);
    for(let k=0;k<3;k++){ const s=rbox(0.006,0.05,0.006,M.dark,0); s.position.set(0.48,0.70,0.36); s.rotation.z=k*Math.PI*2/3; s.translateY(0.025); prof.add(s); }
    add(prof, cyl(0.012,0.06,M.steel,12,'z'), 0.48,0.70,0.33);
    add(prof, cyl(0.008,0.05,M.dark,10,'z'), 0.533,0.70,0.39);
    add(prof, rbox(0.10,0.04,0.006,M.body,0.002), 0.30,TABLE_Y-0.03,TABLE_F+0.012); }
  const scaleTex=canvasTex(256,96,(g,w,h)=>{ g.fillStyle='#f1f2ee'; g.fillRect(0,0,w,h); g.fillStyle='#1b1f22'; g.font='bold 22px monospace';
    for(let mm=0;mm<=5;mm++){ const x=20+mm*42; g.fillRect(x,0,2,30); g.fillText(String(mm),x-6,58); } g.font='16px sans-serif'; g.fillText('mm',200,86); });
  const scale=new THREE.Mesh(new THREE.PlaneGeometry(0.09,0.034),new THREE.MeshBasicMaterial({map:scaleTex,toneMapped:false})); scale.position.set(0.30,TABLE_Y-0.03,TABLE_F+0.0155); prof.add(scale);
  const pointer=new THREE.Mesh(new THREE.ConeGeometry(0.004,0.012,3),M.red); pointer.rotation.z=Math.PI; tIn.add(pointer);
  tagPart(prof,'profondeur'); tagPart(pointer,'profondeur');

  /* ---------- Guide de dégauchissage (inclinable) + dispositif de réglage ---------- */
  const guide=new THREE.Group(); root.add(guide);           // translaté en Z selon la largeur de passage
  const tilt=new THREE.Group(); guide.add(tilt);            // pivote autour de l'arête basse de la face de travail
  add(tilt, rbox(1.10,0.16,0.014,M.alu,0.004), -0.05,0.081,-0.007);
  add(tilt, rbox(1.10,0.012,0.03,M.aluDk,0.003), -0.05,0.155,-0.022);
  add(tilt, rbox(0.12,0.10,0.05,M.dark,0.006), 0.20,0.07,-0.04);                   // patin de fixation
  const gArm=link(new THREE.BoxGeometry(0.05,0.035,1),M.dark); guide.add(gArm);
  tagPart(guide,'guide');
  const reg=new THREE.Group(); root.add(reg);
  add(reg, rbox(0.80,0.05,0.05,M.dark,0.006), -0.05,TABLE_Y-0.06,TABLE_B-0.15);  // barre arrière
  add(reg, rbox(0.14,0.12,0.08,M.body,0.008), 0.20,TABLE_Y-0.03,TABLE_B-0.15);   // coulisseau
  for(const [x,y,len] of [[0.16,TABLE_Y+0.07,0.10],[0.25,TABLE_Y+0.05,0.08]]){ const lv=add(reg, cyl(0.007,len,M.dark,10), x,y,TABLE_B-0.15); lv.rotation.z=-0.5; add(reg, new THREE.Mesh(new THREE.SphereGeometry(0.016,14,10),M.dark), x+len*0.24,y+len*0.44,TABLE_B-0.15); }
  const angTex=canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#e6e8e4'; g.fillRect(0,0,w,h); g.strokeStyle='#1b1f22'; g.lineWidth=3; g.beginPath(); g.arc(w/2,h-6,h-20,Math.PI,2*Math.PI); g.stroke();
    g.font='bold 20px monospace'; g.fillStyle='#1b1f22'; g.fillText('45',24,h-14); g.fillText('90',w/2-12,30); });
  const ang=new THREE.Mesh(new THREE.PlaneGeometry(0.09,0.045),new THREE.MeshBasicMaterial({map:angTex,toneMapped:false})); ang.position.set(0.20,TABLE_Y-0.01,TABLE_B-0.109); reg.add(ang);
  tagPart(reg,'reglage_guide');

  /* ---------- Carter recouvrant l'arbre derrière le guide (suit le guide) ---------- */
  const carter=new THREE.Group(); root.add(carter);
  const carterPlate=add(carter, rbox(0.15,0.006,1,YEL,0), 0,TABLE_Y+0.004,0);
  tagPart(carter,'carter');

  /* ---------- Protecteur SUVAMATIC : boîtier côté opérateur, couverture rappelée par ressort, bec d'engagement orientable ----------
     La couverture repose sur la table, contre le guide. Bec horizontal (plat) : la pièce la soulève, elle glisse sur la pièce.
     Bec vertical (chant) : la pièce l'écarte du guide de son épaisseur, elle plaque la pièce contre le guide. Elle revient seule. */
  const PZ=TABLE_F+0.07, PX=0.0;
  const prot=new THREE.Group(); root.add(prot);
  add(prot, rbox(0.06,0.30,0.03,YEL,0.006), PX,TABLE_Y-0.20,TABLE_F+0.025);        // console jaune fixée au chant de la table
  add(prot, rbox(0.13,0.22,0.10,M.dark,0.012), PX,TABLE_Y-0.07,PZ);                // boîtier (ressorts de rappel)
  add(prot, cyl(0.007,0.05,M.dark,10,'x'), PX+0.09,TABLE_Y-0.10,PZ); add(prot, new THREE.Mesh(new THREE.SphereGeometry(0.014,12,8),M.dark), PX+0.12,TABLE_Y-0.10,PZ); // blocage pour travaux de série
  const slide=new THREE.Group(); prot.add(slide);                                   // tête mobile : monte avec la couverture
  add(slide, rbox(0.14,0.035,0.11,YEL,0.006), 0,0.0175,0);
  const post=add(prot, rbox(0.05,1,0.05,M.steel,0), PX,0,PZ);                    // tige de guidage de la tête (sort du boîtier)
  const cover=add(prot, rbox(0.10,0.012,1,YEL,0.003), 0,0,0);                      // couverture, étirée en Z
  const coverEdge=add(prot, rbox(0.004,0.010,1,M.dark,0), 0,0,0);                  // bord crénelé côté entrée
  const becG=new THREE.Group(); prot.add(becG);                                     // bec d'engagement, pivote de 90°
  const flap=add(becG, rbox(0.07,0.004,0.06,YEL,0.002), 0.03,0,0.03); flap.rotation.z=0.45;
  add(becG, cyl(0.006,0.064,M.dark,10,'z'), 0,0,0.03);
  tagPart(prot,'protecteur');

  /* ---------- Boîtier de commande + arrêt d'urgence ---------- */
  const pup=new THREE.Group(); root.add(pup); pup.position.set(0.66,TABLE_Y+0.02,TABLE_B-0.16);
  add(pup, rbox(0.06,0.30,0.06,M.body,0.008), 0,-0.16,0);
  add(pup, rbox(0.12,0.20,0.22,M.body,0.012), 0,0.08,0);
  const plate=canvasTex(256,384,(g,w,h)=>{ g.fillStyle='#c9ced2'; g.fillRect(0,0,w,h); g.fillStyle='#1b2228'; g.font='italic 700 54px "Barlow Condensed",sans-serif'; g.fillText('KANAK',24,62);
    g.font='16px sans-serif'; g.fillText('Dégauchisseuse 520 D',24,92); g.fillText('5 600 tr/min · 4 fers',24,116); g.fillStyle='#2f9a4e'; g.beginPath(); g.arc(70,300,30,0,7); g.fill(); g.fillStyle='#c4261c'; g.beginPath(); g.arc(186,300,30,0,7); g.fill();
    g.fillStyle='#1b2228'; g.font='bold 18px sans-serif'; g.fillText('I',64,306); g.fillText('O',180,306); });
  const pl=new THREE.Mesh(new THREE.PlaneGeometry(0.15,0.19),new THREE.MeshBasicMaterial({map:plate,toneMapped:false})); pl.rotation.y=Math.PI/2; pl.position.set(0.061,0.08,0); pup.add(pl);
  add(pup, cyl(0.03,0.04,M.dark,20,'x'), 0.0,0.08,-0.14);                       // sectionneur (côté)
  tagPart(pup,'pupitre');
  const au=new THREE.Group(); pup.add(au);
  add(au, cyl(0.036,0.008,M.yellow,24,'x'), 0.064,0.13,0.0);
  add(au, cyl(0.026,0.03,M.red,24,'x'), 0.08,0.13,0.0);
  tagPart(au,'arret');

  /* ---------- mise à jour d'après les réglages ---------- */
  const tmpA=new THREE.Vector3(), tmpB=new THREE.Vector3();
  function update(pose){
    tIn.position.y = TABLE_Y - st.d/1000;
    pointer.position.set(0.30-0.0445+ (Math.min(5,st.d)/5)*0.0835*0.82 + 0.004, -0.008, TABLE_F+0.019);
    const zg=guideZ();
    guide.position.set(0,TABLE_Y,zg);
    tilt.rotation.x = -THREE.MathUtils.degToRad(90-st.ga);   // le guide s'incline vers l'arrière, loin de l'opérateur
    setBetween(gArm, tmpA.set(0.20,-0.03,-0.06), tmpB.set(0.20,-0.03,TABLE_B-0.15-zg));
    // carter : de la face du guide jusqu'au bord arrière des tables
    const cz0=TABLE_B-0.02, cz1=zg-0.002; carterPlate.scale.z=Math.max(0.001,cz1-cz0); carterPlate.position.z=(cz0+cz1)/2;
    // protecteur : pose = {y : hauteur du dessous de la couverture au-dessus de la table (m), zTip : bout côté guide}
    const P=pose||{y:0,zTip:zg}, hy=TABLE_Y+P.y, zt=Math.min(PZ-0.09,P.zTip);
    slide.position.set(PX,hy,PZ);
    const py0=TABLE_Y+0.03; post.scale.y=Math.max(0.001,hy-py0); post.position.y=(hy+py0)/2;
    const z1=PZ-0.055; cover.scale.z=Math.max(0.001,z1-zt); cover.position.set(PX,hy+0.006,(zt+z1)/2);
    coverEdge.scale.z=cover.scale.z; coverEdge.position.set(PX+0.05,hy+0.006,(zt+z1)/2);
    becG.position.set(PX+0.05,hy+0.012,zt); becG.rotation.x= st.bec==='chant'? -Math.PI/2 : 0;
  }
  /* rotation de l'arbre, ralentie à l'affichage (les fers du haut vont vers l'opérateur) */
  let spin=st.motor?1:0;
  function tick(dt){ spin += ((st.motor?1:0)-spin)*Math.min(1,dt*1.2); const w=spin*dt*2.0; rotor.rotation.z -= w; pA.rotation.z -= w; pM.rotation.z -= w*0.035/0.055; }

  const pieceRoot=new THREE.Group(); root.add(pieceRoot);
  return { update, tick, pieceRoot };
}
