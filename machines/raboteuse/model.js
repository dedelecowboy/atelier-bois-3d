/* Modèle 3D de la raboteuse « KANAK 630 E » (d'après une raboteuse de 630 mm à commande électronique de la cote,
   bâti acier-béton, table sur quatre colonnes, arbre à 4 lames réversibles). Marque fictive : ne pas afficher la marque réelle.
   L'arbre est fixe, au-dessus de la table ; la table monte et descend. Sens de rotation : les lames du bas vont vers
   l'opérateur (+X), contre l'avance. Rouleaux, presseur avant et linguets se soulèvent sur la pièce. */
import * as THREE from 'three';
import { M, MI, rbox, add, cyl, canvasTex, beltGeom, pulley } from '../../engine/kit.js';
import { CUT_Y, R_CUT, ARBRE_Y, TABLE_W, TABLE_X0, TABLE_X1, IN_X1, OUT_X0, HEAD_X, ROLL_R, X_IN, X_OUT, X_PAV, X_PAR, X_LING } from './constants.js';
import { st, tableY } from './state.js';

export function buildModel({ root, tagPart, partMeshes }){
  const TEAL = new THREE.MeshStandardMaterial({color:0x16969c, metalness:0.25, roughness:0.45});
  const BODY = new THREE.MeshStandardMaterial({color:0xdfe3e5, metalness:0.15, roughness:0.5});
  const CAST = new THREE.MeshStandardMaterial({color:0xb9bec3, metalness:0.55, roughness:0.32});
  const RUBBER = new THREE.MeshStandardMaterial({color:0xd8cfbd, metalness:0.0, roughness:0.75});
  const TOP = new THREE.MeshStandardMaterial({ roughness:0.95, map: canvasTex(512,512,(g,w,h)=>{ g.fillStyle='#4a4e52'; g.fillRect(0,0,w,h);
    let s=5; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; }; for(let i=0;i<9000;i++){ g.fillStyle=r()<0.5?'#6d7277':'#2c2f32'; g.fillRect(r()*w,r()*h,2,2); } }) });
  const CZ = 0.4325, CD = 0.175, ZW = 0.52;          // joues du bâti : centre, épaisseur, demi-largeur hors tout
  const TOPY = 1.16;                                  // dessus du carter de tête

  /* ---------- Bâti (acier-béton) : socle, joues, carter de tête avec bandeau ---------- */
  const bati = new THREE.Group(); root.add(bati);
  add(bati, rbox(1.00,0.54,0.69,BODY,0.01), 0,0.33,0);                       // caisson bas, entre les joues
  add(bati, rbox(0.98,0.06,1.02,M.dark,0.004), 0,0.03,0);                    // socle
  for(const sz of [1,-1]){ add(bati, rbox(1.00,1.10,CD,BODY,0.012), 0,0.61,sz*CZ); }   // joues
  add(bati, rbox(0.004,0.40,0.50,BODY,0.002), HEAD_X+0.001,0.34,0);          // porte avant du caisson
  // bandeau du carter de tête, tout autour, au-dessus du passage des pièces
  const BY0=CUT_Y+0.02, BH=TOPY-BY0;
  for(const sx of [1,-1]) add(bati, rbox(0.012,BH,2*ZW,TEAL,0.004), sx*(HEAD_X+0.004),BY0+BH/2,0);
  for(const sz of [1,-1]) add(bati, rbox(1.00,BH,0.012,TEAL,0.004), 0,BY0+BH/2,sz*(ZW+0.004));
  add(bati, rbox(0.28,0.012,2*ZW,BODY,0.004), 0.36,TOPY+0.006,0);             // dessus fixe, côté entrée (sous le pupitre)
  // marques : KANAK sur le bandeau d'entrée et sur le flanc, « 630 E » en grand sur le flanc (côté +Z)
  const label=(w,h,draw,pos,ry)=>{ const t=canvasTex(1024,Math.round(1024*h/w),draw); const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false}));
    m.position.set(...pos); m.rotation.y=ry; bati.add(m); document.fonts?.ready.then(()=>{ const g=t.userData.canvas.getContext('2d'); g.clearRect(0,0,t.userData.canvas.width,t.userData.canvas.height); draw(g,t.userData.canvas.width,t.userData.canvas.height); t.needsUpdate=true; }); return m; };
  const kanak=(col)=>(g,w,h)=>{ g.clearRect(0,0,w,h); g.font=`italic 700 ${h*0.82}px "Barlow Condensed","Arial Narrow",sans-serif`; g.fillStyle=col; g.fillText('KANAK',8,h*0.8); };
  label(0.40,0.10,kanak('#ffffff'),[HEAD_X+0.0115,BY0+BH/2,0.18],Math.PI/2);
  label(0.36,0.09,kanak('#ffffff'),[0.18,BY0+BH/2,ZW+0.0105],0);
  label(0.42,0.20,(g,w,h)=>{ g.clearRect(0,0,w,h); g.font=`700 ${h*0.9}px "Barlow Condensed","Arial Narrow",sans-serif`; g.fillStyle='#16191c'; g.fillText('630 E',8,h*0.86); },[0.05,0.44,ZW+0.001],0);
  label(0.18,0.11,(g,w,h)=>{ g.fillStyle='#c9ced2'; g.fillRect(0,0,w,h); g.fillStyle='#1b2228'; g.font='italic 700 120px "Barlow Condensed",sans-serif'; g.fillText('KANAK',30,140);
    g.font='48px sans-serif'; g.fillText('Raboteuse 630 E',30,250); g.fillText('5,5 kW · 5 000 tr/min · 4 lames',30,320); g.fillText('Cote 2,8 – 300 mm · 630 mm',30,390); g.fillText('Avance 5 – 25 m/min',30,460); },[-0.36,0.75,ZW+0.001],0);
  tagPart(bati,'bati');
  for(const m of partMeshes.bati) m.material=m.material.clone();

  /* ---------- Table de rabotage (monte et descend) + galets + rallonges ---------- */
  const tableG=new THREE.Group(); root.add(tableG);
  const tab=new THREE.Group(); tableG.add(tab);
  add(tab, rbox(TABLE_X1-TABLE_X0,0.06,TABLE_W,CAST,0.004), (TABLE_X0+TABLE_X1)/2,-0.03,0);
  for(let i=0;i<5;i++) add(tab, rbox(TABLE_X1-TABLE_X0-0.1,0.0012,0.004,M.aluDk,0), 0,0.0002,-0.24+i*0.12);
  for(const sz of [1,-1]) add(tab, rbox(0.70,0.10,0.03,CAST,0.004), 0,-0.10,sz*0.30);       // nervures et écrous des colonnes
  tagPart(tab,'table');
  const gal=new THREE.Group(); tableG.add(gal);
  for(const x of [X_IN,X_OUT[0]]){ add(gal, cyl(0.022,TABLE_W-0.02,M.steel,20,'z'), x,-0.0218,0); add(gal, rbox(0.05,0.0005,TABLE_W-0.03,M.dark,0), x,0.00005,0); }
  tagPart(gal,'galets');
  const ralIn=new THREE.Group(); tableG.add(ralIn);
  add(ralIn, rbox(IN_X1-TABLE_X1,0.02,TABLE_W-0.04,M.alu,0.003), (IN_X1+TABLE_X1)/2,-0.01,0);
  for(const sz of [1,-1]) add(ralIn, rbox(IN_X1-TABLE_X1,0.04,0.012,M.dark,0.003), (IN_X1+TABLE_X1)/2,-0.03,sz*(TABLE_W/2-0.02));
  tagPart(ralIn,'rallonge_entree');
  const ralOut=new THREE.Group(); tableG.add(ralOut);
  add(ralOut, rbox(TABLE_X0-OUT_X0,0.016,TABLE_W-0.04,M.alu,0.003), (OUT_X0+TABLE_X0)/2,-0.008,0);
  for(const sz of [1,-1]) add(ralOut, rbox(TABLE_X0-OUT_X0,0.03,0.012,M.dark,0.003), (OUT_X0+TABLE_X0)/2,-0.024,sz*(TABLE_W/2-0.02));
  { // console triangulaire sous la rallonge (d'après les photos)
    const sh=new THREE.Shape(); sh.moveTo(0,0); sh.lineTo(-0.95,0); sh.lineTo(0,-0.40); sh.closePath();
    const g=new THREE.ExtrudeGeometry(sh,{depth:0.012,bevelEnabled:false}); for(const sz of [1,-1]){ const m=new THREE.Mesh(g,BODY); m.position.set(TABLE_X0-0.08,-0.03,sz*0.25-0.006); ralOut.add(m); } }
  tagPart(ralOut,'rallonge_sortie');

  /* ---------- Colonnes de levage (4 vis) et motoréducteur de levage, dans le caisson ---------- */
  const cols=new THREE.Group(); root.add(cols); const colM=[];
  for(const x of [-0.30,0.30]) for(const z of [-0.24,0.24]){ const c=cyl(0.028,1,MI.zinc,16); c.position.set(x,0,z); cols.add(c); colM.push(c); add(cols, cyl(0.045,0.05,MI.cast,16), x,0.11,z); }
  tagPart(cols,'colonnes');
  const lev=new THREE.Group(); root.add(lev);
  add(lev, cyl(0.06,0.16,MI.motor,24,'z'), -0.18,0.22,0.05); add(lev, rbox(0.14,0.10,0.10,MI.cast,0.008), -0.18,0.16,-0.08);
  { const loop=[[-0.30,-0.24],[0.30,-0.24],[0.30,0.24],[-0.30,0.24]]; for(let i=0;i<4;i++){ const [x1,z1]=loop[i],[x2,z2]=loop[(i+1)%4]; const L=Math.hypot(x2-x1,z2-z1);
      const s=rbox(Math.abs(x2-x1)>0.01?L:0.012,0.012,Math.abs(z2-z1)>0.01?L:0.012,MI.belt,0); s.position.set((x1+x2)/2,0.13,(z1+z2)/2); lev.add(s); } }
  tagPart(lev,'levage');

  /* ---------- Arbre porte-lames (4 lames) ---------- */
  const arbreG=new THREE.Group(); arbreG.position.set(0,ARBRE_Y,0); root.add(arbreG);
  const rotor=new THREE.Group(); arbreG.add(rotor);
  rotor.add(cyl(R_CUT-0.008,TABLE_W-0.01,M.steel,40,'z'));
  for(let k=0;k<4;k++){ const a=k*Math.PI/2;
    const knife=rbox(0.003,0.024,TABLE_W-0.012,M.blade,0); knife.position.set(Math.cos(a)*(R_CUT-0.012),Math.sin(a)*(R_CUT-0.012),0); knife.rotation.z=a-0.35; rotor.add(knife);
    const wedge=rbox(0.012,0.018,TABLE_W-0.02,M.dark,0.002); wedge.position.set(Math.cos(a-0.25)*(R_CUT-0.022),Math.sin(a-0.25)*(R_CUT-0.022),0); wedge.rotation.z=a-0.35; rotor.add(wedge); }
  add(rotor, cyl(0.018,2*CZ+0.06,MI.zinc,16,'z'));
  tagPart(arbreG,'arbre');

  /* ---------- Organes d'entraînement et de pression (se soulèvent sur la pièce) ---------- */
  const striTex=canvasTex(512,64,(g,w,h)=>{ g.fillStyle='#6b7278'; g.fillRect(0,0,w,h); for(let x=0;x<w;x+=6){ g.fillStyle='#3d4247'; g.fillRect(x,0,2,h); } });
  striTex.wrapS=striTex.wrapT=THREE.RepeatWrapping; striTex.repeat.set(1,6);
  const STRI=new THREE.MeshStandardMaterial({map:striTex,metalness:0.8,roughness:0.35});
  const roller=(mat,part)=>{ const g=new THREE.Group(); const r=new THREE.Group(); g.add(r); r.add(cyl(ROLL_R,TABLE_W,mat,32,'z'));
    add(r, cyl(0.012,2*CZ+0.04,MI.zinc,12,'z'));
    for(const sz of [1,-1]) add(g, rbox(0.05,0.05,0.04,MI.cast,0.006), 0,0,sz*0.355);       // paliers sur ressorts
    for(const sz of [1,-1]){ const sp=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.05,8,1,true),M.steel); sp.position.set(0,0.05,sz*0.355); g.add(sp); }
    root.add(g); tagPart(g,part); return {g,r}; };
  const rIn=roller(STRI,'rouleau_entree'); rIn.g.position.x=X_IN;
  const rOut=X_OUT.map(x=>{ const o=roller(RUBBER,'rouleaux_sortie'); o.g.position.x=x; return o; });
  const pav=new THREE.Group(); root.add(pav); pav.position.x=X_PAV;
  add(pav, rbox(0.028,0.05,TABLE_W,M.steel,0.003), 0,0.025,0); add(pav, rbox(0.012,0.02,TABLE_W,M.dark,0.002), -0.012,0.06,0);
  tagPart(pav,'presseur_av');
  const par=new THREE.Group(); root.add(par); par.position.set(X_PAR,CUT_Y,0);
  add(par, rbox(0.028,0.05,TABLE_W,M.steel,0.003), 0,0.025,0);
  tagPart(par,'presseur_ar');
  // linguets anti-recul : rangée de griffes indépendantes, pivot au-dessus, pointes vers la sortie
  const ling=new THREE.Group(); root.add(ling); const fingers=[], NF=34, PIV=[X_LING+0.03, CUT_Y+0.038], FL=0.055;
  add(ling, cyl(0.007,TABLE_W+0.02,M.steel,12,'z'), PIV[0],PIV[1],0);
  for(let i=0;i<NF;i++){ const z=-0.31+i*0.62/(NF-1); const f=new THREE.Group(); f.position.set(PIV[0],PIV[1],z);
    const plate=rbox(FL,0.012,0.006,M.steel,0.001); plate.position.x=-FL/2; f.add(plate);
    const tooth=new THREE.Mesh(new THREE.ConeGeometry(0.005,0.012,4),M.steel); tooth.position.set(-FL,-0.004,0); tooth.rotation.z=Math.PI*0.8; f.add(tooth);
    ling.add(f); fingers.push(f); }
  tagPart(ling,'linguets');

  /* ---------- Moteur et transmission par courroies (côté +Z) ---------- */
  const MOT=[0.12,0.33], BZ=CZ+0.005;
  const moteur=new THREE.Group(); root.add(moteur);
  add(moteur, cyl(0.10,0.36,MI.motor,32,'z'), MOT[0],MOT[1],0.10);
  for(let i=0;i<10;i++) add(moteur, cyl(0.107,0.005,MI.motor,32,'z'), MOT[0],MOT[1],-0.06+i*0.035);
  add(moteur, rbox(0.22,0.03,0.36,MI.cast,0.004), MOT[0],MOT[1]-0.115,0.10);
  add(moteur, cyl(0.014,0.16,MI.zinc,12,'z'), MOT[0],MOT[1],BZ-0.08);
  tagPart(moteur,'moteur');
  const trans=new THREE.Group(); root.add(trans);
  const pA=pulley(0.045,0.03,MI.zinc); pA.position.set(0,ARBRE_Y,BZ); trans.add(pA);
  const pM=pulley(0.065,0.03,MI.zinc); pM.position.set(MOT[0],MOT[1],BZ); trans.add(pM);
  const belt=new THREE.Mesh(beltGeom([0,ARBRE_Y],0.045,MOT,0.065,0.026,0.006),MI.belt); belt.position.z=BZ; trans.add(belt);
  tagPart(trans,'transmission');

  /* ---------- Transmission de l'avance : moteur d'avance, chaîne et pignons (côté −Z, dans la joue) ---------- */
  const ch=new THREE.Group(); root.add(ch); const CHZ=-CZ, rollY=CUT_Y-0.0015+ROLL_R, FM=[-0.36,0.86];
  const sprocket=(x,y,r)=>{ const g=new THREE.Group(); g.position.set(x,y,CHZ); const geo=new THREE.CylinderGeometry(r,r,0.012,18); geo.rotateX(Math.PI/2); g.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x2a2c2f,metalness:0.6,roughness:0.5,flatShading:true})));
    add(g, cyl(r*0.4,0.03,MI.zinc,12,'z')); ch.add(g); return g; };
  const spr=[sprocket(X_IN,rollY,0.04), ...X_OUT.map(x=>sprocket(x,rollY,0.04)), sprocket(0.30,0.90,0.03), sprocket(FM[0],FM[1],0.03)];
  add(ch, cyl(0.055,0.12,MI.motor,24,'z'), FM[0],FM[1],CHZ+0.07);                       // moteur d'avance (motoréducteur)
  add(ch, rbox(0.12,0.10,0.07,MI.cast,0.008), FM[0],FM[1]-0.02,CHZ+0.02);
  { const circ=[[X_IN,rollY,0.04],...X_OUT.map(x=>[x,rollY,0.04]),[0.30,0.90,0.03],[FM[0],FM[1],0.03]];
    const pts=[]; for(const [x,y,r] of circ) for(let i=0;i<48;i++){ const a=i/48*Math.PI*2; pts.push([x+Math.cos(a)*(r+0.004),y+Math.sin(a)*(r+0.004)]); }
    pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]); const lo=[],up=[];
    for(const q of pts){ while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0) lo.pop(); lo.push(q); }
    for(const q of pts.slice().reverse()){ while(up.length>1&&cr(up[up.length-2],up[up.length-1],q)<=0) up.pop(); up.push(q); }
    const hull=lo.slice(0,-1).concat(up.slice(0,-1)).map(([x,y])=>new THREE.Vector3(x,y,CHZ));
    const curve=new THREE.CatmullRomCurve3(hull,true,'catmullrom',0.05);
    const chainTex=canvasTex(256,16,(g,w,h)=>{ g.fillStyle='#1d1f22'; g.fillRect(0,0,w,h); for(let x=0;x<w;x+=16){ g.fillStyle='#8a9097'; g.fillRect(x+2,3,9,h-6); } });
    chainTex.wrapS=THREE.RepeatWrapping; chainTex.repeat.set(140,1);
    ch.add(new THREE.Mesh(new THREE.TubeGeometry(curve,400,0.0045,6,true),new THREE.MeshStandardMaterial({map:chainTex,metalness:0.7,roughness:0.45}))); }
  tagPart(ch,'chaine');

  /* ---------- Capot de l'arbre (articulé côté sortie) + buse d'aspiration Ø 160 ---------- */
  const capot=new THREE.Group(); capot.position.set(-HEAD_X,TOPY,0); root.add(capot);
  const CL=HEAD_X+0.22;                                   // longueur du capot (jusqu'au pupitre)
  { const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(CL,0); s.lineTo(CL,0.035); s.quadraticCurveTo(CL,0.065,CL-0.03,0.065); s.lineTo(0.04,0.065); s.quadraticCurveTo(0,0.065,0,0.025); s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:2*ZW,bevelEnabled:true,bevelThickness:0.006,bevelSize:0.006,bevelSegments:2,curveSegments:10}); g.translate(0,0,-ZW);
    capot.add(new THREE.Mesh(g,BODY));
    const top=new THREE.Mesh(new THREE.PlaneGeometry(CL-0.08,2*ZW-0.06),TOP); top.rotation.x=-Math.PI/2; top.position.set(CL/2,0.0725,0); capot.add(top);
    for(const z of [0.10,0.30]){ const h=new THREE.Group(); h.position.set(CL+0.004,0.035,z); add(h, rbox(0.012,0.012,0.12,M.dark,0.004), 0.025,0,0); for(const dz of [-0.05,0.05]) add(h, rbox(0.03,0.012,0.012,M.dark,0.003), 0.012,0,dz); capot.add(h); } }
  tagPart(capot,'capot');
  for(const m of partMeshes.capot) m.material=m.material.clone();
  /* buse d'aspiration Ø 160 sur le côté du carter de tête (côté +Z), vers la sortie : le capot reste libre (les pièces y sont reposées) */
  const asp=new THREE.Group(); root.add(asp);
  { const AX=-0.34, AY=BY0+BH/2, AZ=ZW+0.006;
    add(asp, rbox(0.24,BH-0.01,0.03,M.dark,0.006), AX,AY,AZ+0.012);                          // hotte de raccordement sur le flanc
    add(asp, cyl(0.082,0.10,M.dark,32,'z'), AX,AY,AZ+0.07); add(asp, cyl(0.09,0.012,M.steel,32,'z'), AX,AY,AZ+0.12);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(AX,AY,AZ+0.12),new THREE.Vector3(AX,AY,AZ+0.30),new THREE.Vector3(AX-0.06,AY+0.22,AZ+0.42),new THREE.Vector3(AX-0.30,AY+0.55,AZ+0.48),new THREE.Vector3(AX-0.70,AY+0.75,AZ+0.50)]);
    const hoseTex=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#8e979f'; g.fillRect(0,0,w,h); g.fillStyle='#5e666d'; g.fillRect(0,0,w,14); }); hoseTex.wrapS=hoseTex.wrapT=THREE.RepeatWrapping; hoseTex.repeat.set(60,1);
    asp.add(new THREE.Mesh(new THREE.TubeGeometry(curve,80,0.082,20,false),new THREE.MeshStandardMaterial({map:hoseTex,roughness:0.6,metalness:0.1}))); }
  tagPart(asp,'aspiration');

  /* ---------- Pupitre de commande (fixe, à l'entrée, à droite de l'opérateur) ---------- */
  const pup=new THREE.Group(); pup.position.set(0.36,TOPY+0.012,-0.27); root.add(pup);
  { const s=new THREE.Shape(); s.moveTo(-0.12,0); s.lineTo(0.12,0); s.lineTo(0.12,0.035); s.lineTo(-0.10,0.12); s.lineTo(-0.12,0.12); s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:0.36,bevelEnabled:true,bevelThickness:0.006,bevelSize:0.006,bevelSegments:2}); g.translate(0,0,-0.18); pup.add(new THREE.Mesh(g,BODY)); }
  const SLOPE=Math.atan2(0.085,0.22), PW=0.23, PH=0.20;
  let panelH=-1; const panelTex=canvasTex(512,448,()=>{});
  function drawPanel(H){ const g=panelTex.userData.canvas.getContext('2d'), w=512, h=448;
    g.fillStyle='#cfd4d8'; g.fillRect(0,0,w,h); g.fillStyle='#e6e9eb'; g.fillRect(14,14,w-28,226);
    g.fillStyle='#1b1f22'; g.fillRect(34,30,w-68,60); g.fillStyle='#ff2a1c'; g.font='bold 46px monospace'; g.textAlign='right'; g.fillText(H.toFixed(1),w-50,76); g.textAlign='left';
    g.fillStyle='#1b2228'; g.font='italic 700 26px "Barlow Condensed",sans-serif'; g.fillText('KANAK',w-130,120);
    const keys=['1','2','3','4','5','6','7','8','9','C','0','.']; keys.forEach((k,i)=>{ const x=50+(i%3)*52, y=118+Math.floor(i/3)*30; g.fillStyle='#8fbf7a'; g.beginPath(); g.arc(x,y,13,0,7); g.fill(); g.fillStyle='#1b2228'; g.font='bold 15px sans-serif'; g.fillText(k,x-5,y+5); });
    for(const [t,x,y] of [['START',240,125],['STOP',240,160],['RESET',240,195]]){ g.fillStyle='#2b2f33'; g.beginPath(); g.arc(x,y,15,0,7); g.fill(); g.fillStyle='#fff'; g.font='9px sans-serif'; g.fillText(t,x-13,y+3); }
    for(const [t,x,y] of [['▲▲',320,125],['▲',380,125],['▼▼',320,175],['▼',380,175]]){ g.strokeStyle='#2b2f33'; g.lineWidth=2; g.beginPath(); g.arc(x,y,17,0,7); g.stroke(); g.fillStyle='#2b2f33'; g.font='14px sans-serif'; g.fillText(t,x-9,y+5); }
    g.fillStyle='#1b2228'; g.font='15px sans-serif'; g.fillText('cote mm',40,104);
    g.fillStyle='#b9bec3'; g.fillRect(14,252,w-28,182);
    g.fillStyle='#1b2228'; g.font='15px sans-serif'; g.fillText('m/min',300,420); g.fillText('5   10   15   20   25',262,300); g.fillText('0     I',418,330);
    panelTex.needsUpdate=true; }
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH),new THREE.MeshBasicMaterial({map:panelTex,toneMapped:false}));
  panel.position.set(0.013,0.087,0); panel.rotation.set(0,Math.PI/2,0); panel.rotateX(-(Math.PI/2-SLOPE)); pup.add(panel);
  document.fonts?.ready.then(()=>{ panelH=-1; });
  tagPart(pup,'pupitre');
  // organes de commande, sur la partie basse du panneau incliné
  const onPanel=(u,v)=>{ const p=new THREE.Vector3((u-0.5)*PW,(0.5-v)*PH,0.004); panel.updateMatrix(); return p.applyMatrix4(panel.matrix); };
  const nrm=new THREE.Vector3(0,0,1).applyQuaternion(panel.quaternion);
  const stick=(obj,u,v,lift=0)=>{ const p=onPanel(u,v).add(nrm.clone().multiplyScalar(lift)); obj.position.copy(p); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),nrm); pup.add(obj); return obj; };
  const au=new THREE.Group(); { const b=cyl(0.03,0.006,M.yellow,24); b.position.y=0.003; au.add(b); const m=cyl(0.022,0.022,M.red,24); m.position.y=0.017; au.add(m); } stick(au,0.17,0.78); tagPart(au,'arret');
  const mar=new THREE.Group(); { add(mar, rbox(0.05,0.006,0.026,M.steel,0.004), 0,0.003,0); add(mar, cyl(0.009,0.01,new THREE.MeshStandardMaterial({color:0x2f9a4e}),16), -0.011,0.009,0); add(mar, cyl(0.009,0.01,M.red,16), 0.011,0.009,0); }
  stick(mar,0.40,0.80); tagPart(mar,'marche');
  const vari=new THREE.Group(); { add(vari, cyl(0.016,0.016,M.dark,20), 0,0.008,0); add(vari, rbox(0.004,0.006,0.026,M.dark,0), 0,0.018,0); }
  const knob=stick(vari,0.62,0.80);
  const sw=new THREE.Group(); { add(sw, cyl(0.016,0.012,M.dark,20), 0,0.006,0); const lv=add(sw, rbox(0.008,0.01,0.03,M.dark,0.002), 0,0.016,0); sw.userData.lv=lv; }
  stick(sw,0.86,0.80);
  tagPart(vari,'variateur'); tagPart(sw,'variateur');

  /* ---------- Sectionneur (interrupteur général), face d'entrée de la joue droite ---------- */
  const sec=new THREE.Group(); root.add(sec); sec.position.set(HEAD_X+0.002,0.82,-CZ);
  { const pl=rbox(0.006,0.11,0.11,M.yellow,0.004); sec.add(pl); add(sec, cyl(0.03,0.02,M.red,20,'x'), 0.012,0,0); add(sec, rbox(0.03,0.07,0.016,M.red,0.004), 0.025,0,0); }
  tagPart(sec,'sectionneur');

  /* ---------- mise à jour d'après les réglages et les pièces ---------- */
  function update(topAt){
    const ty=tableY(); tableG.position.y=ty;
    for(const c of colM){ const h=Math.max(0.05,ty-0.13-0.06); c.scale.y=h; c.position.y=0.06+h/2; }
    const ride=(x,rest,z)=>Math.max(rest, ty+topAt(x,z));                 // bas de l'organe : repos ou dessus de la pièce
    rIn.g.position.y=ride(X_IN,CUT_Y-0.0015)+ROLL_R;
    rOut.forEach((o,i)=>{ o.g.position.y=ride(X_OUT[i],CUT_Y-0.001)+ROLL_R; });
    pav.position.y=ride(X_PAV,CUT_Y-0.001);
    for(const f of fingers){ const tipY=ride(X_LING-0.01,CUT_Y-0.004, f.position.z), drop=PIV[1]-tipY; f.rotation.z=Math.asin(Math.max(-1,Math.min(1,drop/FL))); }
    capot.rotation.z = st.capot? 1.0 : 0;
    sw.userData.lv.rotation.y = st.feed? -0.6 : 0.6;
    vari.rotation.set(0,0,0); vari.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),nrm); vari.rotateY(-(st.v-5)/20*2.4+1.2);
    if(panelH!==st.H){ panelH=st.H; drawPanel(st.H); }
  }
  /* rotation de l'arbre et des rouleaux, ralentie à l'affichage (lames du bas vers l'opérateur, rouleaux dans le sens d'avance) */
  let spin=0, roll=0;
  /* moteur freiné à l'arrêt */
  function tick(dt){ spin += ((st.motor?1:0)-spin)*Math.min(1,dt*(st.motor?1.2:2.2)); roll += (((st.motor&&st.feed)?1:0)-roll)*Math.min(1,dt*4);
    rotor.rotation.z += spin*dt*2.0; pA.rotation.z += spin*dt*2.0; pM.rotation.z += spin*dt*2.0*0.045/0.065;
    const w=roll*dt*st.v/10*1.5; rIn.r.rotation.z -= w; for(const o of rOut) o.r.rotation.z -= w; for(const s of spr) s.rotation.z -= w; }

  const pieceRoot=new THREE.Group(); root.add(pieceRoot);
  return { update, tick, pieceRoot, get spin(){ return spin; }, stopNow(){ spin=st.motor?1:0; roll=0; } };
}
