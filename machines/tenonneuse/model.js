/* Modèle 3D de la tenonneuse « KANAK 160 TN » (d'après la tenonneuse simple de l'atelier : chariot rouge à table aluminium,
   guide orientable, presse-pièce pneumatique, butée de longueur d'arasement à taquets de couleur, scie d'affranchissement,
   dérouleurs supérieur et inférieur, unité de toupillage verticale, capot blanc vitré relevable, filin de sécurité).
   Marque fictive : ne pas afficher la marque réelle. Proportions estimées.
   Rotation des outils ralentie à l'affichage (sens lisible) : scie et dérouleur supérieur ↺, dérouleur inférieur ↻ vus de
   l'opérateur, unité de toupillage ↺ vue de dessus : tous coupent contre l'avance du chariot (de +X vers −X). */
import * as THREE from 'three';
import { M, MI, rbox, add, cyl, canvasTex, rulerTex, sawBlade } from '../../engine/kit.js';
import { TABLE_Y, X_SAW, X_DER, X_TOU, C_HALF, GUIDE_DX, PE_T, TABLE_Z, BATI_X, BATI_Z, SAW_Y, HEADS, N_HEAD } from './constants.js';
import { st, tool } from './state.js';

export function buildModel({ root, tagPart, partMeshes }){
  const WHITE = new THREE.MeshStandardMaterial({color:0xeceae5, metalness:0.12, roughness:0.5});
  const BURG  = new THREE.MeshStandardMaterial({color:0x7a1f2b, roughness:0.5});
  const RED   = new THREE.MeshStandardMaterial({color:0xb8271f, metalness:0.15, roughness:0.45});
  const HAMM  = new THREE.MeshStandardMaterial({color:0x4a4f55, metalness:0.45, roughness:0.6});
  const DARKW = new THREE.MeshStandardMaterial({color:0x2a2d31, metalness:0.3, roughness:0.6});
  const ORANGE= new THREE.MeshStandardMaterial({color:0xe8702a, metalness:0.15, roughness:0.45});
  const GREEN = new THREE.MeshStandardMaterial({color:0x2f7a5a, metalness:0.35, roughness:0.5});
  const PLEX  = new THREE.MeshStandardMaterial({color:0xdde8ee, metalness:0.1, roughness:0.1, transparent:true, opacity:0.35, side:THREE.DoubleSide, depthWrite:false});
    const ALU   = new THREE.MeshStandardMaterial({ color:0xffffff, metalness:0.55, roughness:0.4, map: canvasTex(512,512,(g,w,h)=>{ g.fillStyle='#c9ced2'; g.fillRect(0,0,w,h);
    for(let i=0;i<2200;i++){ g.fillStyle=`rgba(${120+Math.random()*80|0},${125+Math.random()*80|0},${130+Math.random()*80|0},.25)`; g.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1); } }) });
  const [X0,X1]=BATI_X, [ZK,ZF]=BATI_Z, TOPY=1.33, HINGE_Z=-0.45, CAP_X1=0.16;
  /* ré-enregistre les maillages d'un organe reconstruit (outil changé) */
  const regPart=(g,code)=>{ partMeshes[code]=[]; g.traverse(o=>{ if(o.isMesh){ o.castShadow=o.receiveShadow=true; o.userData.part=code; partMeshes[code].push(o); } }); };

  /* ---------- étiquettes ---------- */
  const label=(parent,w,h,draw,pos,rot=[0,0,0])=>{ const t=canvasTex(1024,Math.max(16,Math.round(1024*h/w)),draw); const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false}));
    m.position.set(...pos); m.rotation.set(...rot); parent.add(m); document.fonts?.ready.then(()=>{ const g=t.userData.canvas.getContext('2d'); g.clearRect(0,0,t.userData.canvas.width,t.userData.canvas.height); draw(g,t.userData.canvas.width,t.userData.canvas.height); t.needsUpdate=true; }); return m; };

  /* ---------- Bâti ---------- */
  const bati=new THREE.Group(); root.add(bati);
  add(bati, rbox(X1-X0,0.56,ZF-ZK,WHITE,0.012), (X0+X1)/2,0.34,(ZK+ZF)/2);                       // caisson bas
  add(bati, rbox(X1-X0-0.06,0.07,ZF-ZK-0.06,HAMM,0.006), (X0+X1)/2,0.035,(ZK+ZF)/2);              // socle
  for(const y of [0.30,0.44]) add(bati, rbox(X1-X0-0.01,0.035,0.004,BURG,0), (X0+X1)/2,y,ZF+0.002);   // bandeaux bordeaux
  add(bati, rbox(X1-X0,0.012,ZF-ZK,HAMM,0.003), (X0+X1)/2,0.626,(ZK+ZF)/2);                       // tôle sous les outils
  add(bati, rbox(X1-X0,TOPY-0.63,0.02,HAMM,0.004), (X0+X1)/2,(TOPY+0.63)/2,ZK+0.01);               // fond de la chambre des outils
  for(const x of [X0+0.01,X1-0.01]) add(bati, rbox(0.02,TOPY-0.63,0.58,WHITE,0.004), x,(TOPY+0.63)/2,ZK+0.29);   // flancs (arrière)
  add(bati, rbox(X1-X0,0.025,HINGE_Z-ZK,WHITE,0.006), (X0+X1)/2,TOPY,(ZK+HINGE_Z)/2);              // dessus fixe (compteurs, buses)
  { // capot fixe de droite : il porte le tableau de commande
    const s=new THREE.Shape(); s.moveTo(HINGE_Z,0.79); s.lineTo(HINGE_Z,TOPY+0.012); s.lineTo(0.0,TOPY+0.012); s.lineTo(0.17,1.08); s.lineTo(0.17,0.99); s.lineTo(0.05,0.99); s.lineTo(-0.04,0.79); s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:X1-CAP_X1,bevelEnabled:false}); g.rotateY(-Math.PI/2); add(bati,new THREE.Mesh(g,WHITE),X1,0,0); }
  const kanak=(col)=>(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='rgba(255,255,255,.95)'; g.fillRect(0,0,w,h); g.fillStyle='#f2c200'; g.beginPath(); g.moveTo(w*0.36,h*0.08); g.lineTo(w*0.46,h*0.08); g.lineTo(w*0.41,h*0.42); g.fill();
    g.font=`italic 700 ${h*0.58}px "Barlow Condensed","Arial Narrow",sans-serif`; g.fillStyle=col; g.fillText('KANAK',w*0.06,h*0.66); g.font=`${h*0.2}px sans-serif`; g.fillStyle='#333'; g.fillText('Tenonneuse 160 TN',w*0.08,h*0.92); };
  label(bati,0.26,0.10,kanak('#1d3a6e'),[X0+0.22,0.53,ZF+0.003]);
  label(bati,0.14,0.06,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='rgba(255,255,255,.92)'; g.fillRect(0,0,w,h); g.font=`700 ${h*0.7}px "Barlow Condensed",sans-serif`; g.fillStyle='#2a2f34'; g.fillText('160 TN',w*0.12,h*0.76); },[X1-0.30,0.53,ZF+0.003]);
  label(bati,0.22,0.12,(g,w,h)=>{ g.fillStyle='#d4d7da'; g.fillRect(0,0,w,h); g.fillStyle='#1b2228'; g.font='italic 700 100px "Barlow Condensed",sans-serif'; g.fillText('KANAK',30,110);
    g.font='40px sans-serif'; g.fillText('Tenonneuse simple 160 TN',30,200); g.fillText('scie 3 000 · dérouleurs 6 000 tr/min',30,262); g.fillText('toupillage 6 000 tr/min · tenon 150 max.',30,324); g.fillText('400 V · 3 × 2,2 kW + 1,5 kW',30,386); },[X0-0.001,0.55,-0.45],[0,-Math.PI/2,0]);
  tagPart(bati,'bati');
  for(const m of partMeshes.bati) m.material=m.material.clone();

  /* ---------- Capot de protection (relevable, interverrouillé) ---------- */
  const capot=new THREE.Group(); capot.position.set(0,TOPY,HINGE_Z); root.add(capot);   // charnière à l'arrière du capot
  const capAng={cur:0};
  { const W=CAP_X1-X0, cx=(X0+CAP_X1)/2;
    const prof=[[HINGE_Z,TOPY+0.012],[0.0,TOPY+0.012],[0.17,1.08],[0.17,0.99]];
    const P=prof.map(([z,y])=>new THREE.Vector3(0,y-TOPY,z-HINGE_Z));
    const seg=(a,b,mat,th)=>{ const L=a.distanceTo(b), m=rbox(W,th,L,mat,0.003); m.position.copy(a).add(b).multiplyScalar(0.5); m.position.x=cx; m.rotation.x=-Math.atan2(b.y-a.y,b.z-a.z); capot.add(m); return m; };
    seg(P[0],P[1],WHITE,0.024); seg(P[2],P[3],WHITE,0.02);
    // pente vitrée : cadre blanc, vitre
    const a=P[1], b=P[2], Lp=a.distanceTo(b), ang=-Math.atan2(b.y-a.y,b.z-a.z), mid=a.clone().add(b).multiplyScalar(0.5);
    const frame=(dx,dy,w,h)=>{ const m=rbox(w,0.02,h,WHITE,0.003); m.position.set(cx+dx,0,0); const o=new THREE.Group(); o.position.copy(mid); o.position.x=0; o.rotation.x=ang; o.add(m); m.position.z=dy; capot.add(o); };
    frame(0,-Lp/2+0.02,W,0.04); frame(0,Lp/2-0.02,W,0.04); frame(-W/2+0.03,0,0.06,Lp); frame(W/2-0.03,0,0.06,Lp);
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(W-0.12,Lp-0.08),PLEX); const go=new THREE.Group(); go.position.copy(mid); go.rotation.x=ang-Math.PI/2; go.add(glass); glass.position.x=cx; capot.add(go);
    for(const x of [X0,CAP_X1]){ const s=new THREE.Shape(); s.moveTo(0,0.012); s.lineTo(-HINGE_Z+0.0,0.012); s.lineTo(0.17-HINGE_Z,1.08-TOPY); s.lineTo(0.17-HINGE_Z,0.99-TOPY); s.lineTo(0.12-HINGE_Z,0.99-TOPY); s.lineTo(0,-0.06); s.closePath();
      const g=new THREE.ExtrudeGeometry(s,{depth:0.012,bevelEnabled:false}); g.rotateY(-Math.PI/2); const m=new THREE.Mesh(g,WHITE); m.position.x=x+(x===X0?0.012:0); capot.add(m); }
    // barre de manœuvre rouge et pattes
    const hb=cyl(0.012,W-0.06,RED,14,'x'); hb.position.set(cx,1.05-TOPY,0.215-HINGE_Z); capot.add(hb);
    for(const dx of [-0.45,0,0.45]) add(capot, rbox(0.02,0.02,0.05,M.dark,0.004), cx+dx*W/1.4,1.05-TOPY,0.19-HINGE_Z);
    // vérins à gaz (de chaque côté)
    for(const x of [X0+0.10,CAP_X1-0.10]) add(capot, cyl(0.009,0.30,M.steel,10), x,-0.10,0.10).rotation.x=0.9;
    label(capot,0.07,0.08,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#111'; g.fillRect(0,0,w,h); g.fillStyle='#f2c200'; g.beginPath(); g.ellipse(w/2,h/2,w*0.3,h*0.22,0.4,0,7); g.fill(); g.fillStyle='#d42'; for(const s of [-1,1]){ g.beginPath(); g.moveTo(w/2,h/2+s*h*0.42); g.lineTo(w/2-w*0.15,h/2+s*h*0.26); g.lineTo(w/2+w*0.15,h/2+s*h*0.26); g.fill(); } },
      [CAP_X1-0.06,1.035-TOPY,0.172-HINGE_Z]); }
  tagPart(capot,'capot');
  for(const m of partMeshes.capot) m.material=m.material.clone();

  /* ---------- Protecteur avant (bavette sous le bord du capot), réglable en hauteur ---------- */
  const prot=new THREE.Group(); root.add(prot);
  const bav=rbox(CAP_X1-X0-0.06,1,0.008,new THREE.MeshStandardMaterial({color:0x2b2f33,roughness:0.85,transparent:true,opacity:0.92}),0); prot.add(bav);
  add(prot, rbox(0.04,0.10,0.03,M.alu,0.004), X0+0.10,1.00,0.15); add(prot, cyl(0.012,0.03,M.dark,12,'z'), X0+0.10,1.00,0.175);   // bouton de réglage
  tagPart(prot,'protecteur');

  /* ---------- Compteurs de réglage (orange, à tige six pans) ---------- */
  const counters={};
  /* horiz : tige six pans horizontale vers l'opérateur (+Z), afficheur sur le dessus (compteur de la scie, d'après la photo) */
  function counter(code,parent,pos,rot=[0,0,0],horiz=false){ const g=new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot); parent.add(g);
    add(g, rbox(0.055,0.035,0.045,ORANGE,0.006), 0,0,0);
    if(horiz) add(g, cyl(0.007,0.05,M.steel,6,'z'), 0,0,0.045); else add(g, cyl(0.007,0.05,M.steel,6), 0,0.04,-0.006);
    const tex=canvasTex(256,64,()=>{}); const disp=new THREE.Mesh(new THREE.PlaneGeometry(0.042,0.011),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));
    if(horiz){ disp.rotation.x=-Math.PI/2; disp.position.set(0,0.0177,0.004); } else disp.position.set(0,0.002,0.0226); g.add(disp);
    let last=null; const set=v=>{ const s=String(Math.round(Math.abs(v)*10)).padStart(5,'0'); if(s===last) return; last=s; const c=tex.userData.canvas.getContext('2d'); c.fillStyle='#111'; c.fillRect(0,0,256,64); c.fillStyle='#f0f0f0'; c.font='bold 46px monospace'; c.fillText(s.split('').join(' '),14,48); tex.needsUpdate=true; };
    tagPart(g,code); counters[code]={g,set}; return g; }
  const topY=TOPY+0.03;
  counter('regl_inf',root,[X_DER-0.04,topY,-0.62]); counter('regl_ep',root,[X_DER+0.04,topY,-0.58]);
  counter('regl_tou_h',root,[X_TOU,topY,-0.60]);
  label(root,0.10,0.025,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#333'; g.font=`${h*0.7}px sans-serif`; g.fillText('BAS   ÉP.',4,h*0.78); },[X_DER,TOPY+0.0135,-0.53],[-Math.PI/2,0,0]);

  /* ---------- Scie d'affranchissement (lame Ø 400, axe Z, coulisse en Z : longueur du tenon) ---------- */
  const sawG=new THREE.Group(); root.add(sawG);
  const sawSpin=new THREE.Group(); sawG.add(sawSpin);
  let sawKey='';
  function buildSaw(){ while(sawSpin.children.length){ const c=sawSpin.children.pop(); c.geometry?.dispose(); } const t=tool('scie'); if(!t){ regPart(sawG,'scie'); return; }
    // lame carbure commune (engine/kit.js, d'après la lame de la scie à format) ; retournée : en miroir (tranchants à l'envers)
    const R=t.D/2000, bl=sawBlade({ R, Z:t.Z, plate:0.0032, kerf:t.Lc/1000, bore:0.03, pins:true, dir:1, mark:[`Ø${t.D} × ${String(t.Lc).replace('.',',')}/3,2 × 30  Z${t.Z}  HW`,`n max ${t.nmax} RPM`] });
    if(st.flips.scie) bl.scale.y=-1; sawSpin.add(bl);
    add(sawSpin, cyl(0.05,0.012,MI.cast,28,'z'), 0,0,0.003); add(sawSpin, cyl(0.016,0.02,M.steel,6,'z'), 0,0,0.012);
    for(let i=0;i<3;i++){ const k=rbox(0.03,0.005,0.006,M.dark,0); k.rotation.z=i*Math.PI/3*2; sawSpin.add(k); } regPart(sawG,'scie'); }
  tagPart(sawG,'scie');
  const sawMot=new THREE.Group(); root.add(sawMot);
  add(sawMot, cyl(0.085,0.26,GREEN,28,'z'), 0,0,-0.17); add(sawMot, cyl(0.03,0.05,M.steel,16,'z'), 0,0,-0.025);
  for(let i=0;i<6;i++) add(sawMot, cyl(0.09,0.006,GREEN,28,'z'), 0,0,-0.07-i*0.035);
  add(sawMot, rbox(0.16,0.03,0.30,HAMM,0.004), 0,-0.10,-0.17);                                   // coulisseau
  // compteur de la longueur du tenon : devant la lame, contre le bord gauche de son carter, hors de la zone de coupe (au-dessus du passage des pièces)
  counter('regl_scie',sawMot,[-0.175,0.03,0.054],[0,0,0],true);

  /* ---------- Dérouleurs (porte-outils cylindriques d'axe Z) et leurs moteurs ---------- */
  const derTex=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#d8dde1'; g.beginPath(); g.arc(w/2,h/2,w/2,0,7); g.fill(); g.fillStyle='#8a9097'; g.beginPath(); g.arc(w/2,h/2,w*0.2,0,7); g.fill();
    g.fillStyle='#333'; for(const a of [0,2.1,4.2]){ g.beginPath(); g.arc(w/2+Math.cos(a)*w*0.09,h/2+Math.sin(a)*h*0.09,10,0,7); g.fill(); }
    g.fillStyle='#555'; g.font='bold 22px sans-serif'; g.fillText('KANAK',w*0.33,h*0.85); });
  const derFace=new THREE.MeshStandardMaterial({map:derTex,metalness:0.6,roughness:0.35});
  function derHead(code,h){ const G=new THREE.Group(); root.add(G); const spin=new THREE.Group(); G.add(spin);
    let key=''; const rebuild=()=>{ const t=tool(h), k=(t?t.id:'')+st.flips[h]; if(k===key) return; key=k; while(spin.children.length){ const c=spin.children.pop(); c.traverse(o=>o.geometry?.dispose()); }
      if(!t){ regPart(G,code); return; } const R=t.D/2000, L=t.Lc/1000, sens=(st.flips[h]?-1:1)*t.sens;
      const body=new THREE.Mesh(new THREE.CylinderGeometry(R-0.012,R-0.012,L,40).rotateX(Math.PI/2), [M.alu,derFace,derFace]); body.position.z=-L/2; spin.add(body);
      for(let i=0;i<t.Z;i++){ const a=i/t.Z*Math.PI*2; const k=rbox(0.006,0.014,L-0.004,M.blade,0.001); k.position.set(Math.cos(a)*(R-0.006),Math.sin(a)*(R-0.006),-L/2); k.rotation.z=a; spin.add(k);
        const ch=rbox(0.02,0.012,L-0.01,M.dark,0.001); const a2=a+sens*0.22; ch.position.set(Math.cos(a2)*(R-0.016),Math.sin(a2)*(R-0.016),-L/2); ch.rotation.z=a2; spin.add(ch); }
      regPart(G,code); };
    tagPart(G,code); return {G,spin,rebuild}; }
  const dInf=derHead('der_inf','inf'), dSup=derHead('der_sup','sup');
  const motor=()=>{ const g=new THREE.Group(); root.add(g); add(g, cyl(0.085,0.28,GREEN,28,'z'), 0,0,-0.14); for(let i=0;i<7;i++) add(g, cyl(0.09,0.006,GREEN,28,'z'), 0,0,-0.03-i*0.035);
    add(g, rbox(0.10,0.07,0.07,GREEN,0.006), 0,0.09,-0.12); add(g, cyl(0.02,0.04,M.steel,14,'z'), 0,0,0.02); return g; };
  const mInf=motor(), mSup=motor();
  counter('regl_dec',root,[X_DER+0.13,0,0],[0,0,0]);

  /* ---------- Unité de toupillage (arbre vertical, fraise disque) ---------- */
  const touG=new THREE.Group(); root.add(touG); const touSpin=new THREE.Group(); touG.add(touSpin);
  let touKey='';
  function buildTou(){ while(touSpin.children.length){ const c=touSpin.children.pop(); c.geometry?.dispose(); } const t=tool('tou');
    add(touSpin, cyl(0.015,0.16,M.steel,16), 0,-0.04,0); add(touSpin, new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.026,0.018,6),M.steel), 0,(t?t.Lc/1000:0)+0.02,0);
    if(!t){ regPart(touG,'toupie'); return; } const R=t.D/2000, e=t.Lc/1000, sens=(st.flips.tou?-1:1)*t.sens;
    add(touSpin, new THREE.Mesh(new THREE.CylinderGeometry(R-0.012,R-0.012,e*0.8,40),new THREE.MeshStandardMaterial({color:0x3a6fb0,metalness:0.4,roughness:0.4})), 0,e/2,0);
    for(let i=0;i<t.Z;i++){ const a=i/t.Z*Math.PI*2; const k=rbox(0.022,e,0.008,M.blade,0.001); k.position.set(Math.cos(a)*(R-0.011),e/2,-Math.sin(a)*(R-0.011)); k.rotation.y=a+sens*0.3; touSpin.add(k); }
    regPart(touG,'toupie'); }
  tagPart(touG,'toupie');
  const mTou=new THREE.Group(); root.add(mTou);
  add(mTou, cyl(0.10,0.24,GREEN,30), 0,-0.17,0); for(let i=0;i<6;i++) add(mTou, cyl(0.105,0.006,GREEN,30), 0,-0.26+i*0.035,0);
  add(mTou, rbox(0.08,0.08,0.09,GREEN,0.006), 0.11,-0.18,0); add(mTou, cyl(0.06,0.03,MI.cast,24), 0,-0.04,0);
  add(mTou, rbox(0.22,0.20,0.03,HAMM,0.004), 0,-0.20,-0.13);                                       // glissière de l'unité
  counter('regl_tou_p',mTou,[-0.15,-0.08,0.0],[0,-Math.PI/2,0]);
  tagPart(sawMot,'moteurs'); tagPart(mInf,'moteurs'); tagPart(mSup,'moteurs'); tagPart(mTou,'moteurs');
  // les compteurs portés par les moteurs restent des organes à part
  for(const k of ['regl_scie','regl_tou_p']) counters[k].g.traverse(o=>{ if(o.isMesh) o.userData.part=k; });
  partMeshes.moteurs=partMeshes.moteurs.filter(m=>!['regl_scie','regl_tou_p'].includes(m.userData.part));

  /* ---------- Carters des outils (gris martelé), déposables ---------- */
  const carters=new THREE.Group(); root.add(carters);
  const halfDisc=(r,depth,up)=>{ const s=new THREE.Shape(); s.absarc(0,0,r,up?0:Math.PI,up?Math.PI:Math.PI*2,false); s.closePath(); const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:32}); g.translate(0,0,-depth); return new THREE.Mesh(g,HAMM); };
  const cSaw=halfDisc(0.215,0.05,true); carters.add(cSaw);
  const cInf=halfDisc(0.11,0.14,false), cSup=halfDisc(0.11,0.14,true); carters.add(cInf,cSup);
  const cTou=new THREE.Group(); carters.add(cTou);
  { const s=new THREE.Shape(); s.absarc(0,0,0.14,Math.PI*0.05,Math.PI*0.95,true); s.lineTo(Math.cos(Math.PI*0.95)*0.125,Math.sin(Math.PI*0.95)*0.125); s.absarc(0,0,0.125,Math.PI*0.95,Math.PI*0.05,false); s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:0.06,bevelEnabled:false,curveSegments:28}); g.rotateX(Math.PI/2); g.translate(0,0.045,0); cTou.add(new THREE.Mesh(g,DARKW));
    const top=new THREE.Mesh(new THREE.CircleGeometry(0.14,32,Math.PI,Math.PI),DARKW); top.rotation.x=-Math.PI/2; top.position.y=0.046; cTou.add(top); }
  tagPart(carters,'carters');
  for(const m of partMeshes.carters) m.material=m.material.clone();

  /* ---------- Glissière du chariot (barres sur consoles, devant le bâti) ---------- */
  const rail=new THREE.Group(); root.add(rail);
  add(rail, cyl(0.022,2.85,M.steel,18,'x'), -0.55,0.62,0.06); add(rail, rbox(2.85,0.03,0.05,HAMM,0.004), -0.55,0.52,0.04);
  for(const x of [-1.85,-1.0,-0.2,0.6]){ add(rail, rbox(0.06,0.14,0.10,HAMM,0.006), x,0.57,0.0); add(rail, rbox(0.05,0.55,0.05,HAMM,0.004), x,0.26,0.03); }
  tagPart(rail,'rail');

  /* ---------- Chariot : embase rouge, table aluminium, guide, pare-éclat, butée, presse ---------- */
  const chG=new THREE.Group(); root.add(chG);
  const chBase=new THREE.Group(); chG.add(chBase);
  add(chBase, rbox(2*C_HALF-0.04,0.20,0.20,RED,0.01), 0,0.69,0.12);                                // embase sur la glissière
  { const s=new THREE.Shape(); s.moveTo(0.10,0.78); s.lineTo(0.78,0.78); s.lineTo(0.78,0.70); s.lineTo(0.40,0.30); s.lineTo(0.10,0.30); s.closePath();   // jambe rouge (profil)
    const g=new THREE.ExtrudeGeometry(s,{depth:0.012,bevelEnabled:false}); g.rotateY(-Math.PI/2); for(const x of [-C_HALF+0.06, C_HALF-0.05]) add(chBase,new THREE.Mesh(g,RED),x,0,0); }
  add(chBase, rbox(0.06,0.04,1.05,RED,0.006), GUIDE_DX+0.03,0.80,1.05);                            // bras de la rallonge du guide
  add(chBase, cyl(0.016,0.80,RED,12), GUIDE_DX+0.03,0.40,1.52); add(chBase, rbox(0.40,0.03,0.04,RED,0.004), GUIDE_DX+0.03,0.80,1.55);
  add(chBase, cyl(0.014,0.28,RED,12,'x'), 0,TABLE_Y-0.03,TABLE_Z[1]+0.03);                         // poignée de poussée
  for(const dx of [-0.13,0.13]) add(chBase, rbox(0.02,0.02,0.04,RED,0.004), dx,TABLE_Y-0.03,TABLE_Z[1]+0.01);
  tagPart(chBase,'chariot');
  const tbl=new THREE.Group(); chG.add(tbl);
  add(tbl, rbox(2*C_HALF,0.035,TABLE_Z[1]-TABLE_Z[0],ALU,0.004), 0,TABLE_Y-0.0175,(TABLE_Z[0]+TABLE_Z[1])/2);
  add(tbl, rbox(2*C_HALF,0.05,0.02,HAMM,0.003), 0,TABLE_Y-0.06,TABLE_Z[0]+0.01);
  tagPart(tbl,'table_chariot');
  const grad=new THREE.Group(); chG.add(grad);
  label(grad,0.30,0.03,(g,w,h)=>{ g.fillStyle='#d6dadd'; g.fillRect(0,0,w,h); g.fillStyle='#222'; for(let a=0;a<=45;a++){ const x=w-8-a*(w-40)/45; g.fillRect(x,0,a%5?1.5:3,a%10?h*0.35:h*0.6); if(a%10===0) { g.font=`${h*0.32}px sans-serif`; g.fillText(a+'°',x-20,h*0.95); } } },
    [GUIDE_DX-0.17,TABLE_Y+0.0008,0.42],[-Math.PI/2,0,0]);
  tagPart(grad,'graduation');
  const g90=new THREE.Group(); chG.add(g90); add(g90, cyl(0.012,0.05,M.dark,14,'z'), GUIDE_DX+0.03,TABLE_Y-0.03,TABLE_Z[0]-0.02); add(g90, cyl(0.02,0.012,RED,14,'z'), GUIDE_DX+0.03,TABLE_Y-0.03,TABLE_Z[0]-0.05);
  tagPart(g90,'butee90');
  const guide=new THREE.Group(); chG.add(guide);
  const GL=1.62;
  add(guide, rbox(0.06,0.075,GL,ALU,0.006), GUIDE_DX+0.03,TABLE_Y+0.0375,TABLE_Z[0]+GL/2);
  { const r=new THREE.Mesh(new THREE.PlaneGeometry(GL,0.02),new THREE.MeshStandardMaterial({map:rulerTex(1600),roughness:0.6})); r.rotation.set(-Math.PI/2,0,-Math.PI/2); r.position.set(GUIDE_DX+0.03,TABLE_Y+0.0756,TABLE_Z[0]+GL/2); guide.add(r); }
  tagPart(guide,'guide');
  const peG=new THREE.Group(); chG.add(peG);   // pare-éclat : pièce de bois usinée comme les pièces (construite par piece.js)
  const butG=new THREE.Group(); chG.add(butG);
  const butBar=new THREE.Group(); butG.add(butBar);
  add(butBar, rbox(0.07,0.035,0.15,new THREE.MeshStandardMaterial({color:0x5a3b2a,metalness:0.4,roughness:0.5}),0.004), GUIDE_DX+0.03,TABLE_Y+0.093,0);
  [0x2a7bd8,0x2f9a4e,0x555555,0xe8a020,0x222222,0xc4261c].forEach((c,i)=>add(butBar, rbox(0.012,0.012,0.012,new THREE.MeshStandardMaterial({color:c,roughness:0.5}),0.002), GUIDE_DX+0.07,TABLE_Y+0.093,-0.06+i*0.022));
  label(butBar,0.06,0.016,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='#e8e8e8'; g.font=`italic 700 ${h*0.8}px "Barlow Condensed",sans-serif`; g.fillText('KANAK',4,h*0.8); },[GUIDE_DX+0.03,TABLE_Y+0.1106,0.03],[-Math.PI/2,0,Math.PI/2]);
  const finger=new THREE.Group(); finger.position.set(GUIDE_DX,TABLE_Y+0.09,0); butG.add(finger);
  { const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(-0.02,0); s.lineTo(-0.16,-0.06); s.lineTo(-0.16,-0.088); s.lineTo(-0.12,-0.088); s.lineTo(0,-0.03); s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:0.006,bevelEnabled:false}); g.translate(0,0,-0.003); finger.add(new THREE.Mesh(g,M.alu)); }
  tagPart(butG,'butee');
  const presse=new THREE.Group(); chG.add(presse);
  const PX=GUIDE_DX+0.12, PZ=0.24, PAD_X=GUIDE_DX-PE_T/1000-0.04;
  add(presse, rbox(0.08,0.06,0.10,RED,0.008), PX,TABLE_Y+0.03,PZ);
  add(presse, cyl(0.022,0.36,M.dark,16), PX,TABLE_Y+0.24,PZ);                                      // colonne
  add(presse, rbox(0.07,0.07,0.07,RED,0.012), PX,TABLE_Y+0.20,PZ);
  add(presse, cyl(0.02,PX-PAD_X+0.02,RED,14,'x'), (PX+PAD_X)/2,TABLE_Y+0.20,PZ);                   // bras
  add(presse, cyl(0.04,0.06,RED,24), PAD_X,TABLE_Y+0.24,PZ); add(presse, cyl(0.042,0.008,RED,24), PAD_X,TABLE_Y+0.275,PZ);   // vérin pneumatique
  add(presse, cyl(0.007,0.18,new THREE.MeshStandardMaterial({color:0xd8261c,roughness:0.5}),8,'z'), PAD_X+0.05,TABLE_Y+0.25,PZ+0.08).rotation.x=0.4;   // tuyau d'air
  const rod=cyl(0.008,1,M.steel,10); presse.add(rod); const pad=cyl(0.03,0.02,new THREE.MeshStandardMaterial({color:0x5a4a3a,roughness:0.9}),24); presse.add(pad);
  tagPart(presse,'presse');
  const verC=new THREE.Group(); chG.add(verC); add(verC, rbox(0.03,0.05,0.03,M.dark,0.004), -C_HALF+0.10,0.66,0.23); const verL=rbox(0.012,0.09,0.012,RED,0.003); verL.position.set(-C_HALF+0.10,0.70,0.25); verC.add(verL);
  tagPart(verC,'verrou_chariot');

  /* ---------- Tableau de commande (capot fixe de droite, face inclinée) ---------- */
  const pup=new THREE.Group(); root.add(pup);
  { const a=Math.atan2(TOPY+0.012-1.08,0.17), o=new THREE.Vector3((CAP_X1+X1)/2,(TOPY+0.012+1.08)/2,0.085); pup.position.copy(o); pup.rotation.x=a; }
  const PW=0.17, PH=0.15;
  add(pup, rbox(PW+0.012,0.006,PH+0.012,new THREE.MeshStandardMaterial({color:0xdadcdd,roughness:0.5}),0.003), 0,0.012,0);
  const panTex=canvasTex(680,600,(g,w,h)=>{ g.fillStyle='#e8e9ea'; g.fillRect(0,0,w,h); g.fillStyle='#f2c200'; g.beginPath(); g.moveTo(340,20); g.lineTo(390,100); g.lineTo(290,100); g.closePath(); g.fill(); g.strokeStyle='#111'; g.lineWidth=5; g.stroke();
    g.fillStyle='#fff'; g.fillRect(470,20,140,80); g.fillStyle='#111'; g.font='bold 60px sans-serif'; g.fillText('08',500,85);
    const lab=(x,y,t)=>{ g.fillStyle='#111'; g.fillRect(x-62,y,124,40); g.fillStyle='#f4f4f4'; g.fillRect(x-58,y+3,116,34); g.fillStyle='#111'; g.font='bold 15px sans-serif'; g.textAlign='center'; t.split('\n').forEach((s,i,a)=>g.fillText(s,x,y+(a.length>1?17+i*16:25))); g.textAlign='left'; };
    lab(90,150,'SOUS\nTENSION'); lab(340,150,'OUVERTURE\n0 CAPOT 1'); lab(465,150,'ARRET'); lab(590,150,'REARMEMENT');
    lab(170,380,'TOUPIE'); lab(300,380,'DEROULEUR\nINFERIEUR'); lab(430,380,'DEROULEUR\nSUPERIEUR'); lab(560,380,'SCIE'); });
  const pan=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH),new THREE.MeshBasicMaterial({map:panTex,toneMapped:false})); pan.rotation.x=-Math.PI/2; pan.position.y=0.0155; pup.add(pan);
  const P2=(u,v)=>[(u/680-0.5)*PW,0.016,(v/600-0.5)*PH];
  tagPart(pup,'pupitre');
  const btn=(code,u,v,col,r=0.0095)=>{ const g=new THREE.Group(); g.position.set(...P2(u,v)); pup.add(g); const ring=new THREE.Mesh(new THREE.TorusGeometry(r+0.0015,0.0015,8,24),M.alu); ring.rotation.x=Math.PI/2; g.add(ring);
    const b=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.01,20),new THREE.MeshStandardMaterial({color:col,roughness:0.3,metalness:0.1})); b.position.y=0.005; g.add(b); if(code) tagPart(g,code); return b; };
  const lamp=btn(null,90,250,0xdddddd); tagPart(lamp,'pupitre');
  const auG=new THREE.Group(); auG.position.set(...P2(215,250)); pup.add(auG);
  { const p=new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.024,0.003,30),M.yellow); auG.add(p); const m=new THREE.Mesh(new THREE.CylinderGeometry(0.017,0.014,0.016,30),M.red); m.position.y=0.01; auG.add(m); auG.userData.m=m; }
  tagPart(auG,'arret_urgence');
  const selG=new THREE.Group(); selG.position.set(...P2(340,250)); pup.add(selG);
  { const b=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.008,20),new THREE.MeshStandardMaterial({color:0x1e5a5a,roughness:0.4})); selG.add(b); const lv=rbox(0.004,0.006,0.018,M.dark,0.001); lv.position.y=0.008; selG.add(lv);
    const wl=rbox(0.002,0.0065,0.012,new THREE.MeshBasicMaterial({color:0xffffff}),0); wl.position.y=0.0085; selG.add(wl); selG.userData.lamp=b; }
  tagPart(selG,'ouverture_capot');
  btn('arret',465,250,0xc4261c);
  const rearmB=btn('rearmement',590,250,0x2456c8);
  const startB={}; [['tou',170],['inf',300],['sup',430],['scie',560]].forEach(([h,u])=>{ startB[h]=btn('marche',u,470,0x1f7a4a); });

  /* ---------- Filin de sécurité et boîtier sectionneur ---------- */
  const fil=new THREE.Group(); root.add(fil);
  add(fil, cyl(0.004,X1-X0+0.05,new THREE.MeshStandardMaterial({color:0xd8261c,roughness:0.5}),8,'x'), (X0+X1)/2,0.76,ZF+0.035);
  for(const x of [X0+0.02,-0.6,0.0]) add(fil, rbox(0.01,0.03,0.04,M.steel,0.002), x,0.76,ZF+0.02);
  tagPart(fil,'filin');
  const boit=new THREE.Group(); boit.position.set(X1+0.06,0.76,ZF+0.03); root.add(boit);
  add(boit, rbox(0.08,0.07,0.06,RED,0.008), 0,0,0); add(boit, rbox(0.05,0.07,0.05,M.dark,0.006), 0.07,0,0);
  const blue=cyl(0.011,0.025,new THREE.MeshStandardMaterial({color:0x2456c8,roughness:0.4}),18,'x'); blue.position.set(0.11,0,0); boit.add(blue);
  const greenR=cyl(0.012,0.006,new THREE.MeshStandardMaterial({color:0x2fbf4f,roughness:0.4}),18,'x'); greenR.position.set(0.098,0,0); boit.add(greenR);
  tagPart(boit,'boitier');

  /* ---------- Armoire électrique et interrupteur général cadenassable (bout gauche) ---------- */
  const arm=new THREE.Group(); root.add(arm);
  add(arm, rbox(0.22,0.66,0.40,new THREE.MeshStandardMaterial({color:0xcfd6d4,roughness:0.5}),0.01), X0-0.13,0.43,-0.45);
  add(arm, cyl(0.012,0.03,M.dark,12,'z'), X0-0.08,0.60,-0.24);
  const secG=new THREE.Group(); secG.position.set(X0-0.16,0.55,-0.245); arm.add(secG);
  { add(secG, rbox(0.08,0.08,0.008,M.yellow,0.003)); const h=new THREE.Group(); h.position.z=0.01; secG.add(h); add(h, cyl(0.02,0.012,M.red,20,'z')); const lv=rbox(0.016,0.06,0.016,M.red,0.004); lv.position.z=0.01; h.add(lv); secG.userData.h=h;
    const pad=new THREE.Group(); pad.position.set(0.035,-0.03,0.03); add(pad, rbox(0.022,0.026,0.012,M.yellow,0.003)); const sh=new THREE.Mesh(new THREE.TorusGeometry(0.008,0.002,6,16,Math.PI),M.steel); sh.position.y=0.013; pad.add(sh); secG.add(pad); secG.userData.pad=pad; }
  tagPart(secG,'sectionneur');
  tagPart(arm,'armoire');

  /* ---------- Aspiration : buses sur le dessus, flexibles ---------- */
  const asp=new THREE.Group(); root.add(asp);
  const hoseTex=canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#4d5257'; g.fillRect(0,0,w,h); g.fillStyle='#2b2f33'; g.fillRect(0,0,w,18); }); hoseTex.wrapS=hoseTex.wrapT=THREE.RepeatWrapping; hoseTex.repeat.set(60,1);
  const HOSE=new THREE.MeshStandardMaterial({map:hoseTex,roughness:0.6});
  for(const [x,z] of [[X_SAW,-0.70],[X_DER,-0.70],[X_TOU,-0.68]]){ add(asp, cyl(0.065,0.05,M.alu,24), x,TOPY+0.03,z);
    asp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x,TOPY+0.04,z),new THREE.Vector3(x,TOPY+0.30,z-0.05),new THREE.Vector3(x*0.7-0.2,TOPY+0.55,-0.95),new THREE.Vector3(-0.55,2.6,-1.0)]),50,0.062,16,false),HOSE)); }
  add(asp, cyl(0.16,0.40,M.alu,28), -0.55,2.80,-1.0);
  tagPart(asp,'aspiration');

  const pieceRoot=new THREE.Group(); root.add(pieceRoot);

  /* ---------- mise à jour d'après les réglages ---------- */
  let derKey='';
  function update(pieceTop){
    // scie : la lame coulisse en Z (trait de scie à lt du plan d'arasement)
    const zs=-st.lt/1000, ys=TABLE_Y+SAW_Y;
    if(sawKey!==st.tools.scie+st.flips.scie){ sawKey=st.tools.scie+st.flips.scie; buildSaw(); }
    sawG.position.set(X_SAW,ys,zs); sawMot.position.set(X_SAW,ys,zs-0.004);
    // dérouleurs : inférieur sous la joue (dessus de l'outil à hInf), supérieur au-dessus (bas de l'outil à hInf + ep)
    dInf.rebuild(); dSup.rebuild();
    const ti=tool('inf'), ts=tool('sup'), Ri=(ti?ti.D:180)/2000, Rs=(ts?ts.D:180)/2000;
    const yi=TABLE_Y+st.hInf/1000-Ri, ysu=TABLE_Y+(st.hInf+st.ep)/1000+Rs, zsu=-st.dec/1000;
    dInf.G.position.set(X_DER,yi,0); dSup.G.position.set(X_DER,ysu,zsu);
    mInf.position.set(X_DER,yi,-(ti?ti.Lc:120)/1000-0.01); mSup.position.set(X_DER,ysu,zsu-(ts?ts.Lc:120)/1000-0.01);
    counters.regl_dec.g.position.set(X_DER+0.13,ysu,zsu-0.20);
    // unité de toupillage : fraise disque à ht, son bord avant à pt au-delà du trait de scie
    if(touKey!==st.tools.tou+st.flips.tou){ touKey=st.tools.tou+st.flips.tou; buildTou(); }
    const tt=tool('tou'), Rt=(tt?tt.D:200)/2000, zt=(-st.lt+st.pt)/1000-Rt;
    touG.position.set(X_TOU,TABLE_Y+st.ht/1000,zt); mTou.position.set(X_TOU,TABLE_Y+st.ht/1000,zt);
    // carters : en place autour des outils, ou déposés au pied de la machine
    if(st.carters){ cSaw.position.set(X_SAW,ys,zs+0.025); cSaw.rotation.set(0,0,0);
      cInf.position.set(X_DER,yi,0.01); cSup.position.set(X_DER,ysu,zsu+0.01); cInf.rotation.set(0,0,0); cSup.rotation.set(0,0,0);
      cTou.position.set(X_TOU,TABLE_Y+st.ht/1000,zt); cTou.rotation.set(0,0,0); }
    else { cSaw.position.set(X1+0.35,0.0,-0.55); cSaw.rotation.set(-Math.PI/2,0,0); cInf.position.set(X1+0.55,0.0,-0.50); cInf.rotation.set(Math.PI/2,0,0); cSup.position.set(X1+0.55,0.0,-0.25); cSup.rotation.set(-Math.PI/2,0,0); cTou.position.set(X1+0.40,0.0,-0.10); }
    // compteurs
    counters.regl_scie.set(st.lt); counters.regl_inf.set(st.hInf); counters.regl_ep.set(st.ep); counters.regl_dec.set(st.dec); counters.regl_tou_h.set(st.ht); counters.regl_tou_p.set(st.pt);
    // protecteur avant : bavette du bord du capot jusqu'à protH au-dessus du chariot
    { const yb=TABLE_Y+st.protH/1000, yt=1.02; bav.scale.y=Math.max(0.01,yt-yb); bav.position.set((X0+CAP_X1)/2,(yt+yb)/2,0.155); }
    // chariot
    chG.position.x=st.cx;
    butG.position.z=st.but/1000; finger.rotation.z= st.butOn? 0 : -1.25;
    { const top=st.presse? Math.max(0.005,pieceTop) : Math.max(pieceTop+0.05,0.09); pad.position.set(PAD_X,TABLE_Y+top+0.01,PZ); const y0=TABLE_Y+top+0.02, y1=TABLE_Y+0.24; rod.scale.y=Math.max(0.01,y1-y0); rod.position.set(PAD_X,(y0+y1)/2,PZ); }
    verL.rotation.z= st.lockC? 0 : 0.8;
    guide.rotation.y=0; grad.visible=true;
    // commandes
    auG.userData.m.position.y= st.au? 0.006 : 0.01;
    selG.rotation.y= st.sel? -0.8 : 0;
    blue.position.x= st.filin? 0.095 : 0.11; greenR.visible=!st.filin;
    secG.userData.h.rotation.z= st.main? Math.PI/2 : 0; secG.userData.pad.visible=st.cad;
    lamp.material.color.setHex(st.main&&!st.cad? 0xffffff : 0x777777); lamp.material.emissive?.setHex(st.main&&!st.cad? 0x666666 : 0);
    rearmB.material.emissive?.setHex(st.armed&&st.main&&!st.cad? 0x1a3a8a : 0);
    for(const h of HEADS){ startB[h].material.emissive?.setHex(st.run[h]? 0x2fbf4f : 0); }
    selG.userData.lamp.material.emissive?.setHex(st.sel&&!anySpin()? 0x3fdcdc : 0);
    capTarget= st.capot? 1.15 : 0;
  }
  /* rotation des outils (ralentie à l'affichage) ; moteurs-freins */
  const spin={ scie:0, inf:0, sup:0, tou:0 };
  const anySpin=()=>HEADS.some(h=>spin[h]>0.02);
  let capTarget=0, tPrev=null;
  function tick(){ const now=performance.now()/1000, dt=Math.min(0.5, tPrev==null? 0 : now-tPrev); tPrev=now; let moved=false;
    for(const h of HEADS){ const on=st.run[h], s0=spin[h]; spin[h]+=((on?1:0)-spin[h])*Math.min(1,dt*(on?2.5:2.2)); if(!on&&spin[h]<0.003) spin[h]=0; if((s0>0.02)!==(spin[h]>0.02)||(s0>0.9)!==(spin[h]>0.9)) moved=true; }
    sawSpin.rotation.z+=spin.scie*dt*1.4*(st.flips.scie?-1:1);
    dSup.spin.rotation.z+=spin.sup*dt*1.4; dInf.spin.rotation.z-=spin.inf*dt*1.4;
    touSpin.rotation.y+=spin.tou*dt*1.4;
    if(Math.abs(capAng.cur-capTarget)>1e-3){ capAng.cur+=(capTarget-capAng.cur)*Math.min(1,dt*3); if(Math.abs(capAng.cur-capTarget)<2e-3) capAng.cur=capTarget; capot.rotation.x=-capAng.cur; moved=true; }
    return moved; }
  return { update, tick, pieceRoot, peG, spin, anySpin, stopNow(){ for(const h of HEADS) spin[h]=0; capAng.cur=st.capot?1.15:0; capot.rotation.x=-capAng.cur; } };
}
