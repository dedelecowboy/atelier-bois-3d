/* Modèle 3D de la scie à format « KANAK 550 » (d'après une Format-4 kappa 550).
   Règles validées par l'enseignant : couteau diviseur DERRIÈRE la lame ; dents du haut vers l'opérateur ;
   pas de bague de protection autour de la lame ; groupe d'inclinaison dans le bâti ; marque fictive KANAK 550. */
import * as THREE from 'three';
import { M, MI, rbox, add, cyl, link, setBetween, canvasTex, rulerTex, beltGeom, pulley, arcPlate } from '../../engine/kit.js';
import { TABLE_Y, BLADE_Z, R, SLIDER_Z, SLIDER_L, SLIDER_HOME, SABOT_FACE, SABOT_Z0, SABOT_Z1, FRAME_X0, FRAME_X1, FRAME_Z0, FRAME_Z1, REG_L, REG_X, REG_Z0 } from './constants.js';
import { st, guideFace, stopFace } from './state.js';

export function buildModel({ root, tagPart, partMeshes }){
let screenKey='';
/* ---------- 01 Bâti ---------- */
const bati = new THREE.Group(); root.add(bati);
add(bati, rbox(1.56,0.80,1.09,M.body,0.012), 0,0.44,0.095); // bâti prolongé sous le chariot
add(bati, rbox(1.50,0.05,1.05,M.dark,0.004), 0,0.025,0.095);
// front panels (graphite) on +Z face
add(bati, rbox(0.86,0.52,0.012,M.panel,0.004), -0.30,0.40,0.645);
add(bati, rbox(0.56,0.52,0.012,M.panel,0.004), 0.44,0.40,0.645);
add(bati, rbox(0.70,0.30,0.004,M.body,0.002), -0.32,0.42,0.652); // inset door
add(bati, rbox(0.42,0.012,0.006,M.aluDk,0.002), 0.44,0.62,0.654); // trim line
// side + rear details
add(bati, rbox(0.012,0.52,0.9,M.panel,0.004), 0.785,0.40,0.095);
const port = add(bati, cyl(0.06,0.12,M.dark,28,'z'), 0.35,0.55,-0.50);
add(bati, cyl(0.065,0.02,M.aluDk,28,'z'), 0.35,0.55,-0.45);
const warn = add(bati, new THREE.Mesh(new THREE.CircleGeometry(0.03,3), M.yellow), 0.792,0.62,0.45); warn.rotation.set(0,Math.PI/2,Math.PI/2);
// fixed slider carriage beam on the front face
add(bati, rbox(2.10,0.09,0.27,M.aluDk,0.01), 0.0,0.805,0.465);
add(bati, rbox(2.06,0.02,0.24,M.dark,0.003), 0.0,0.755,0.465);
add(bati, rbox(0.30,0.34,0.008,M.body,0.004), 0.30,0.40,-0.454); for(let i=0;i<7;i++) add(bati, rbox(0.18,0.012,0.004,M.panel,0), 0.30,0.30+i*0.03,-0.459); // trappe de changement de courroie
{ // marque fictive sur la façade
  const draw=(g,w,h)=>{ g.clearRect(0,0,w,h); g.textBaseline='alphabetic';
    const f1=z=>`italic 700 ${z}px "Barlow Condensed","Arial Narrow",sans-serif`, f2=z=>`700 ${z}px "Barlow Condensed","Arial Narrow",sans-serif`;
    let z=200; g.font=f1(z); let w1=g.measureText('KANAK').width; g.font=f2(z); let w2=g.measureText('550').width; const k=Math.min(1,(w-60)/(w1+w2+0.15*z)); z=Math.floor(z*k);
    g.font=f1(z); w1=g.measureText('KANAK').width; g.fillStyle='#ffffff'; g.fillText('KANAK',20,h/2+z*0.36); g.fillStyle='#f0b46a'; g.font=f2(z); g.fillText('550',20+w1+0.15*z,h/2+z*0.36); };
  const t=canvasTex(1024,256,draw);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(0.52,0.13),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false})); m.position.set(0.44,0.25,0.6525); bati.add(m);
  document.fonts?.ready.then(()=>{ draw(t.userData.canvas.getContext('2d'),1024,256); t.needsUpdate=true; }); }
tagPart(bati,'bati');
for(const m of partMeshes.bati) m.material=m.material.clone();

/* ---------- 02 Table fonte ---------- */
const table = new THREE.Group(); root.add(table);
const tTop = add(table, rbox(1.24,0.05,0.765,M.cast,0.006), 0,TABLE_Y-0.025,-0.1175);
for(let i=0;i<5;i++) add(table, rbox(1.2,0.002,0.006,M.aluDk,0), 0,TABLE_Y+0.0005,-0.42+i*0.07); // surface grooves
// plaque de lumière affleurante avec fente : la lame et l'inciseur sortent par la fente
for(const dz of [-0.0185,0.0185]) add(table, rbox(0.76,0.001,0.027,M.aluDk,0), 0.06,TABLE_Y+0.0004,BLADE_Z+dz);
add(table, rbox(0.76,0.0006,0.010,new THREE.MeshStandardMaterial({color:0x0b0d0f,roughness:1}),0), 0.06,TABLE_Y+0.0002,BLADE_Z); // fente
const MAT_LED=new THREE.MeshStandardMaterial({color:0x3a1512,emissive:0xff2a1a,emissiveIntensity:0,roughness:0.4});
add(table, rbox(0.10,0.0016,0.008,MAT_LED,0.0005), 0.45,TABLE_Y+0.0008,BLADE_Z-0.035); // ruban LED : inciseur en marche
tagPart(table,'table');
for(const m of partMeshes.table) m.material=m.material.clone(); // matériaux propres : la table peut devenir translucide en vue intérieure

/* ---------- 10 Rallonge ---------- */
const ral = new THREE.Group(); root.add(ral);
add(ral, rbox(1.24,0.03,0.60,M.alu,0.004), 0,TABLE_Y-0.015,-0.80);
add(ral, rbox(1.20,0.06,0.04,M.aluDk,0.004), 0,TABLE_Y-0.06,-1.08);
for(const x of [-0.56,0.56]){ add(ral, rbox(0.05,TABLE_Y-0.06,0.05,M.body,0.006), x,(TABLE_Y-0.06)/2,-1.07); add(ral, rbox(0.12,0.02,0.1,M.dark,0.004), x,0.01,-1.07); }
add(ral, rbox(1.1,0.04,0.04,M.body,0.004), 0,0.25,-1.07);
// rallonge arrière : jusqu'à 1 200 mm derrière l'axe de lame
add(ral, rbox(0.58,0.03,1.36,M.alu,0.004), -0.91,TABLE_Y-0.015,-0.415);
for(let i=0;i<5;i++) add(ral, rbox(0.56,0.002,0.006,M.aluDk,0), -0.91,TABLE_Y+0.0005,-0.42+i*0.07);
add(ral, rbox(0.04,0.06,1.30,M.aluDk,0.004), -1.17,TABLE_Y-0.06,-0.415);
for(const z of [-1.0,0.18]){ add(ral, rbox(0.05,TABLE_Y-0.06,0.05,M.body,0.006), -1.16,(TABLE_Y-0.06)/2,z); add(ral, rbox(0.12,0.02,0.1,M.dark,0.004), -1.16,0.01,z); }
add(ral, rbox(0.04,0.04,1.1,M.body,0.004), -1.16,0.25,-0.41);
tagPart(ral,'rallonge');

/* ---------- 09 Guide parallèle ---------- */
const guideFixed = new THREE.Group(); root.add(guideFixed);
const RIP_X = 0.675; // bar on the operator (infeed) end of the table
add(guideFixed, cyl(0.022,1.36,M.alu,24,'z'), RIP_X,TABLE_Y-0.035,-0.44);
const ripScale = new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.022), new THREE.MeshStandardMaterial({map:rulerTex(1000),roughness:0.6}));
ripScale.rotation.set(-Math.PI/2,0,-Math.PI/2); ripScale.position.set(RIP_X+0.012,TABLE_Y-0.012,BLADE_Z-0.5-0.0); guideFixed.add(ripScale);
add(guideFixed, rbox(0.03,0.006,1.0,M.aluDk,0.002), RIP_X+0.012,TABLE_Y-0.016,BLADE_Z-0.5);
for(const z of [-1.08,0.2]) add(guideFixed, rbox(0.06,0.08,0.05,M.body,0.006), RIP_X-0.02,TABLE_Y-0.05,z);
const guide = new THREE.Group(); root.add(guide);
add(guide, rbox(0.12,0.10,0.11,M.body,0.012), RIP_X,TABLE_Y-0.01,0);
const guideProf=new THREE.Group(); guide.add(guideProf);
add(guideProf, rbox(1.20,0.10,0.06,M.alu,0.006), RIP_X-0.61,TABLE_Y+0.05,0.085);
add(guideProf, rbox(1.20,0.008,0.004,M.aluDk,0), RIP_X-0.61,TABLE_Y+0.06,0.117);
const lever = add(guide, cyl(0.009,0.14,M.dark,12), RIP_X+0.07,TABLE_Y+0.07,0); lever.rotation.z=-0.6;
add(guide, new THREE.Mesh(new THREE.SphereGeometry(0.018,16,12),M.dark), RIP_X+0.11,TABLE_Y+0.13,0);
add(guide, cyl(0.02,0.04,M.dark,16), RIP_X-0.03,TABLE_Y+0.065,0.04);
tagPart(guideFixed,'guide'); tagPart(guide,'guide');

/* ---------- 04 Lame + 05 couteau (tilt pivot at table line) ---------- */
const tiltPivot = new THREE.Group(); tiltPivot.position.set(0,TABLE_Y,BLADE_Z); root.add(tiltPivot);
const lift = new THREE.Group(); tiltPivot.add(lift);
const BLADE_Z_TEETH=72, PLATE=0.0032, KERF_T=0.0044;
function bladeGeom(){ const s=new THREE.Shape(), N=BLADE_Z_TEETH, st=Math.PI*2/N, P=(r,an)=>[Math.cos(an)*r,Math.sin(an)*r];
  // dent trapézoïdale : dos incliné, sommet plat, face d'attaque raide, creux arrondi (sens d'attaque = angle croissant ; le disque est ensuite mis en miroir)
  for(let i=0;i<N;i++){ const a=i*st;
    const pts=[P(R-0.0075,a),P(R-0.0072,a+st*0.08),P(R-0.0050,a+st*0.25),P(R-0.0012,a+st*0.62),P(R,a+st*0.70),P(R,a+st*0.76),P(R-0.0040,a+st*0.79),P(R-0.0068,a+st*0.86),P(R-0.0076,a+st*0.94)];
    pts.forEach(([x,y],k)=> (i===0&&k===0)? s.moveTo(x,y): s.lineTo(x,y)); }
  s.closePath();
  const hole=new THREE.Path(); hole.absarc(0,0,0.015,0,Math.PI*2,true); s.holes.push(hole);
  for(const sx of [-1,1]){ const pin=new THREE.Path(); pin.absarc(sx*0.027,0,0.0045,0,Math.PI*2,true); s.holes.push(pin); }   // trous d'entraînement
  for(let k=0;k<6;k++){ const a=k*Math.PI/3+0.26, w=0.0008, r1=R-0.040, r2=R-0.013;              // fentes de dilatation terminées par un trou
    const sl=new THREE.Path(), c=Math.cos(a), sn=Math.sin(a), px=-sn*w, py=c*w;
    sl.moveTo(c*r1+px,sn*r1+py); sl.lineTo(c*r2+px,sn*r2+py); sl.lineTo(c*r2-px,sn*r2-py); sl.lineTo(c*r1-px,sn*r1-py); s.holes.push(sl);
    const e=new THREE.Path(); e.absarc(c*(r1-0.0045),sn*(r1-0.0045),0.0032,0,Math.PI*2,true); s.holes.push(e); }
  const g=new THREE.ExtrudeGeometry(s,{depth:PLATE,bevelEnabled:false,curveSegments:10}); g.translate(0,0,-PLATE/2); return g; }
// face du disque : acier brossé, anneau, fentes anti-bruit rouges, marquage et flèche de rotation (dessinés vus du côté chariot)
const bladeFaceTex=(()=>{ const N=1024, off=document.createElement('canvas'); off.width=off.height=N; const g=off.getContext('2d'), c=N/2, k=N/(2*R);
  const grd=g.createRadialGradient(c,c,20,c,c,c); grd.addColorStop(0,'#eef1f3'); grd.addColorStop(0.6,'#d6dbdf'); grd.addColorStop(1,'#c9ced3'); g.fillStyle=grd; g.fillRect(0,0,N,N);
  for(let i=0;i<260;i++){ const r=40+Math.random()*(c-50), a0=Math.random()*6.28; g.strokeStyle=`rgba(${Math.random()<.5?255:120},${Math.random()<.5?255:125},${Math.random()<.5?255:130},.10)`; g.lineWidth=1; g.beginPath(); g.arc(c,c,r,a0,a0+0.4+Math.random()*1.4); g.stroke(); }
  g.strokeStyle='rgba(120,128,136,.45)'; g.lineWidth=2; g.beginPath(); g.arc(c,c,0.60*R*k,0,7); g.stroke();
  for(let i=0;i<6;i++){ const a=i*Math.PI/3+0.26+Math.PI/6, rr=0.76*R*k; g.save(); g.translate(c+Math.cos(a)*rr,c+Math.sin(a)*rr); g.rotate(a);
    g.strokeStyle='#c7332b'; g.lineWidth=8; g.lineCap='round'; g.beginPath(); const L=86, A=20; g.moveTo(-A,-L/2);
    for(let t=0;t<=1.0001;t+=0.02){ g.lineTo(Math.sin(t*Math.PI*3)*A*(t<0.02||t>0.98?1:1),-L/2+t*L); } g.stroke();
    g.fillStyle='#c7332b'; for(const yy of [-L/2,L/2]){ g.beginPath(); g.arc(Math.sin((yy>0?1:0)*Math.PI*3)*A,yy,7,0,7); g.fill(); } g.restore(); }
  g.fillStyle='rgba(95,103,110,.85)'; g.textAlign='center'; g.font='600 30px "JetBrains Mono",monospace';
  g.fillText('Ø400 × 4,4/3,2 × 30  Z72  HW',c,c+0.36*R*k); g.font='500 24px "JetBrains Mono",monospace'; g.fillText('n max 6000 RPM',c,c+0.36*R*k+34);
  g.strokeStyle='rgba(95,103,110,.85)'; g.lineWidth=5; g.beginPath(); g.arc(c,c,0.47*R*k,Math.PI*0.62,Math.PI*0.38,true); g.stroke();   // flèche : sens horaire vu du côté chariot
  const ea=Math.PI*0.38, ex=c+Math.cos(ea)*0.47*R*k, ey=c+Math.sin(ea)*0.47*R*k; g.fillStyle='rgba(95,103,110,.85)'; g.save(); g.translate(ex,ey); g.rotate(ea-Math.PI/2); g.beginPath(); g.moveTo(-14,0); g.lineTo(14,0); g.lineTo(0,-22); g.closePath(); g.fill(); g.restore();
  const cv=document.createElement('canvas'); cv.width=cv.height=N; const h=cv.getContext('2d'); h.translate(N,0); h.scale(-1,1); h.drawImage(off,0,0); // pré-miroir (le disque est en miroir)
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; t.repeat.set(1/(2*R),1/(2*R)); t.offset.set(0.5,0.5); return t; })();
const MAT_BLADE_FACE=new THREE.MeshStandardMaterial({map:bladeFaceTex,metalness:0.55,roughness:0.32,side:THREE.DoubleSide});
const blade = new THREE.Group(); lift.add(blade);
{ // disque + plaquettes carbure ; miroir : les dents attaquent dans le sens de rotation (dents du haut vers l'opérateur)
  const disc=new THREE.Group(); disc.scale.x=-1; blade.add(disc);
  disc.add(new THREE.Mesh(bladeGeom(), [MAT_BLADE_FACE, M.blade]));
  const N=BLADE_Z_TEETH, st=Math.PI*2/N, tips=new THREE.InstancedMesh(new THREE.BoxGeometry(0.0055,0.0032,KERF_T), new THREE.MeshStandardMaterial({color:0x9aa2a9,metalness:0.7,roughness:0.35}), N), o=new THREE.Object3D();
  for(let i=0;i<N;i++){ const a=i*st+st*0.70; o.position.set(Math.cos(a)*(R-0.0016),Math.sin(a)*(R-0.0016),0); o.rotation.set(0,0,a+Math.PI/2); o.updateMatrix(); tips.setMatrixAt(i,o.matrix); }
  disc.add(tips); }
blade.add(cyl(0.06,0.012,M.steel,32,'z'));
blade.add(cyl(0.025,0.02,M.dark,6,'z'));
tagPart(blade,'lame');
const knifeG=(()=>{ const s=new THREE.Shape(); const a0=Math.PI-1.05,a1=Math.PI+0.5, ri=R+0.006, ro=R+0.045; const n=20;
  for(let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n; const x=Math.cos(a)*ro,y=Math.sin(a)*ro; i?s.lineTo(x,y):s.moveTo(x,y);}
  for(let i=n;i>=0;i--){ const a=a0+(a1-a0)*i/n; s.lineTo(Math.cos(a)*ri,Math.sin(a)*ri);} s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:0.004,bevelEnabled:false}); g.translate(0,0,-0.002); return g; })();
const knife = new THREE.Mesh(knifeG, M.steel); lift.add(knife); tagPart(knife,'couteau');

/* ================= INTÉRIEUR (architecture type, d'après les principes courants) ================= */
// 15 Moteur principal (dans le groupe de relevage : il suit hauteur et inclinaison)
const MOT_C=[0.10,-0.26], MOT_Z=-0.36, MOT_L=0.28;
const moteur=new THREE.Group(); lift.add(moteur);
add(moteur, cyl(0.105,MOT_L,MI.motor,40,'z'), MOT_C[0],MOT_C[1],MOT_Z);
for(let i=0;i<11;i++) add(moteur, cyl(0.113,0.006,MI.motor,40,'z'), MOT_C[0],MOT_C[1],MOT_Z-MOT_L/2+0.03+i*0.022);
add(moteur, cyl(0.09,0.03,MI.cast,32,'z'), MOT_C[0],MOT_C[1],MOT_Z-MOT_L/2-0.012);
add(moteur, rbox(0.09,0.05,0.1,MI.motor,0.008), MOT_C[0],MOT_C[1]+0.13,MOT_Z+0.02);
add(moteur, cyl(0.012,0.18,MI.zinc,16,'z'), MOT_C[0],MOT_C[1],-0.135);
add(moteur, rbox(0.05,0.03,0.24,MI.cast,0.006), MOT_C[0],MOT_C[1]-0.115,MOT_Z);
tagPart(moteur,'moteur');

// 16 Transmission : arbre de lame + poulies + courroie poly-V
const trans=new THREE.Group(); lift.add(trans);
const BELT_Z=-0.05;
add(trans, cyl(0.036,0.07,MI.cast,28,'z'), 0,0,-0.045);              // corps de palier
for(const z of [-0.015,-0.075]) add(trans, rbox(0.11,0.09,0.018,MI.cast,0.01), 0,-0.02,z);
const arbPul=pulley(0.045,0.022,MI.zinc); arbPul.position.z=BELT_Z; blade.add(arbPul); tagPart(arbPul,'transmission');
blade.add(Object.assign(cyl(0.014,0.08,MI.zinc,16,'z'),{}));       // arbre
const motPul=pulley(0.06,0.022,MI.zinc); motPul.position.set(MOT_C[0],MOT_C[1],BELT_Z); trans.add(motPul);
const belt=new THREE.Mesh(beltGeom([0,0],0.045,MOT_C,0.06,0.02,0.007),MI.belt); belt.position.z=BELT_Z; trans.add(belt);
tagPart(trans,'transmission');

// 17 Relevage : colonnes dans le berceau, chariot de lame dans le groupe lift, vis + motoréducteur
const relFix=new THREE.Group(); tiltPivot.add(relFix);
const relMob=new THREE.Group(); lift.add(relMob);
for(const x of [-0.16,0.16]){ add(relFix, rbox(0.03,0.32,0.022,MI.zinc,0.002), x,-0.33,-0.11); add(relFix, rbox(0.05,0.32,0.012,MI.cast,0.002), x,-0.33,-0.127); }
add(relFix, rbox(0.46,0.03,0.05,MI.cast,0.006), 0,-0.50,-0.10);
add(relFix, rbox(0.46,0.03,0.05,MI.cast,0.006), 0,-0.165,-0.11);
add(relFix, cyl(0.011,0.32,MI.zinc,12), -0.25,-0.33,-0.11);            // vis de relevage
add(relFix, rbox(0.08,0.07,0.09,MI.motor,0.008), -0.25,-0.53,-0.16);   // motoréducteur
add(relFix, cyl(0.03,0.08,MI.motor,20,'z'), -0.25,-0.53,-0.24);
add(relMob, rbox(0.52,0.07,0.035,MI.cast,0.008), -0.04,-0.12,-0.11);    // chariot de lame
for(const x of [-0.16,0.16]) add(relMob, rbox(0.06,0.10,0.04,MI.cast,0.006), x,-0.12,-0.095);
add(relMob, cyl(0.022,0.06,M.brass,16), -0.25,-0.12,-0.11);             // écrou
add(relMob, rbox(0.07,0.12,0.03,MI.cast,0.006), 0,-0.065,-0.095);       // bras porte-palier
tagPart(relFix,'relevage'); tagPart(relMob,'relevage');

// 18 Inclinaison : secteurs dentés (berceau, tourne avec tiltPivot) + galets et pignon fixes au bâti
const incMob=new THREE.Group(); tiltPivot.add(incMob);
const SR0=0.40, SR1=0.45, F0=-1.45, F1=-0.65; // arc behind the blade: stays inside the frame over the whole 0–46° travel
for(const x of [-0.44,0.44]){ const a=arcPlate(SR0,SR1,F0,F1,0.016,MI.cast); a.position.x=x; incMob.add(a); }
for(let i=0;i<34;i++){ const f=F0+0.02+(F1-F0-0.04)*i/33; const tooth=rbox(0.016,0.012,0.008,MI.cast,0); tooth.position.set(0.44,-(SR1+0.005)*Math.cos(f),(SR1+0.005)*Math.sin(f)); tooth.rotation.x=f; incMob.add(tooth); }
add(incMob, rbox(0.90,0.035,0.04,MI.cast,0.006), 0,-0.425*Math.cos(1.0),-0.425*Math.sin(1.0));
tagPart(incMob,'inclinaison');
const incFix=new THREE.Group(); root.add(incFix);
for(const x of [-0.465,0.465]) for(const f of [-0.69,-0.80]){ const g=cyl(0.022,0.03,MI.zinc,20,'x'); g.position.set(x,TABLE_Y-(SR0-0.024)*Math.cos(f),BLADE_Z+(SR0-0.024)*Math.sin(f)); incFix.add(g); add(incFix, rbox(0.03,0.05,0.04,MI.cast,0.004), x+(x>0?0.03:-0.03),g.position.y,g.position.z); }
add(incFix, cyl(0.022,0.03,MI.zinc,16,'x'), 0.44,TABLE_Y-0.475*Math.cos(0.66),BLADE_Z-0.475*Math.sin(0.66));        // pignon
add(incFix, cyl(0.045,0.14,MI.motor,24,'x'), 0.55,TABLE_Y-0.475*Math.cos(0.66),BLADE_Z-0.475*Math.sin(0.66));       // motoréducteur
add(incFix, rbox(0.08,0.10,0.10,MI.motor,0.008), 0.64,TABLE_Y-0.475*Math.cos(0.66),BLADE_Z-0.475*Math.sin(0.66));
tagPart(incFix,'inclinaison');

// 19 Inciseur (dans le berceau, en avant de la lame côté opérateur)
const INC_X=0.30, INC_R=0.06, INC_Y=-INC_R+0.003;
const inciseur=new THREE.Group(); tiltPivot.add(inciseur);
const incBlade=new THREE.Group(); incBlade.position.set(INC_X,INC_Y,0); inciseur.add(incBlade);
{ const sh=new THREE.Shape(); const N=24; for(let i=0;i<N;i++){ const a=i/N*Math.PI*2, st=Math.PI*2/N; const P=(r,an)=>[Math.cos(an)*r,Math.sin(an)*r]; [P(INC_R-0.006,a),P(INC_R,a+st*0.6),P(INC_R-0.002,a+st*0.95)].forEach(([x,y],j)=>(i===0&&j===0)?sh.moveTo(x,y):sh.lineTo(x,y)); } sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:0.0045,bevelEnabled:false}); g.translate(0,0,-0.00225); incBlade.add(new THREE.Mesh(g,M.blade)); incBlade.add(cyl(0.02,0.012,M.steel,20,'z')); }
const incPul=pulley(0.022,0.016,MI.zinc); incPul.position.z=BELT_Z; incBlade.add(incPul);
const IM=[INC_X,-0.22];
add(inciseur, cyl(0.055,0.15,MI.motor,28,'z'), IM[0],IM[1],-0.14);
for(let i=0;i<6;i++) add(inciseur, cyl(0.06,0.005,MI.motor,28,'z'), IM[0],IM[1],-0.19+i*0.02);
const incMotPul=pulley(0.028,0.016,MI.zinc); incMotPul.position.set(IM[0],IM[1],BELT_Z); inciseur.add(incMotPul);
const incBelt=new THREE.Mesh(beltGeom([INC_X,INC_Y],0.022,IM,0.028,0.014,0.005),MI.belt); incBelt.position.z=BELT_Z; inciseur.add(incBelt);
add(inciseur, rbox(0.05,0.20,0.03,MI.cast,0.006), INC_X+0.07,-0.14,-0.08);
tagPart(inciseur,'inciseur');

// 20 Aspiration basse : carter autour du bas de lame + flexible vers la buse arrière
const asp=new THREE.Group(); lift.add(asp);
{ const rim=new THREE.Mesh(new THREE.CylinderGeometry(0.235,0.235,0.075,40,1,true,-Math.PI*0.5,Math.PI).rotateX(Math.PI/2),MI.plast); rim.material=MI.plast; asp.add(rim);
  const back=new THREE.Mesh(new THREE.CircleGeometry(0.235,40,Math.PI,Math.PI),MI.plast); back.position.z=-0.0375; back.material=MI.plast.clone(); back.material.side=THREE.DoubleSide; asp.add(back);
  add(asp, cyl(0.045,0.06,MI.plast,24), 0.05,-0.255,-0.01); }
const hose=link(new THREE.CylinderGeometry(0.042,0.042,1,20,8).rotateX(Math.PI/2), MI.hose); root.add(hose);
const hoseRings=[]; for(let i=0;i<9;i++){ const r=new THREE.Mesh(new THREE.TorusGeometry(0.044,0.004,6,20),MI.hose); root.add(r); hoseRings.push(r); }
tagPart(asp,'aspiration'); tagPart(hose,'aspiration'); hoseRings.forEach(r=>tagPart(r,'aspiration'));
const hoseOut=new THREE.Object3D(); hoseOut.position.set(0.05,-0.29,-0.01); asp.add(hoseOut);
const HOSE_END=new THREE.Vector3(0.35,0.55,-0.42);

// 21 Armoire électrique (contre la paroi arrière)
const armo=new THREE.Group(); root.add(armo);
add(armo, rbox(0.36,0.46,0.02,M.panel,0.004), -0.50,0.42,-0.43);
add(armo, rbox(0.34,0.012,0.02,MI.zinc,0), -0.50,0.52,-0.41);
add(armo, rbox(0.34,0.012,0.02,MI.zinc,0), -0.50,0.34,-0.41);
for(let i=0;i<5;i++){ add(armo, rbox(0.045,0.075,0.06,MI.plast,0.004), -0.62+i*0.058,0.52,-0.39); add(armo, rbox(0.03,0.01,0.004,i%2?M.yellow:new THREE.MeshStandardMaterial({color:0x2b64c6}),0), -0.62+i*0.058,0.55,-0.359); }
for(let i=0;i<3;i++) add(armo, rbox(0.08,0.11,0.07,M.dark,0.006), -0.60+i*0.10,0.33,-0.39);
add(armo, rbox(0.34,0.035,0.04,MI.plast,0.003), -0.50,0.62,-0.40);
add(armo, rbox(0.34,0.035,0.04,MI.plast,0.003), -0.50,0.23,-0.40);
tagPart(armo,'armoire');


/* ---------- 07 Colonne et bras ---------- */
const bras = new THREE.Group(); root.add(bras);
const COL = new THREE.Vector3(0.80,0,-0.64), ARM_Y = 1.58;
add(bras, rbox(0.16,0.16,0.16,M.body,0.01), COL.x,TABLE_Y-0.1,COL.z);
add(bras, cyl(0.045,ARM_Y-TABLE_Y+0.04,M.body,24), COL.x,(ARM_Y+TABLE_Y)/2,COL.z);
const armEnd = new THREE.Vector3(0,ARM_Y,BLADE_Z);
const arm = link(new THREE.CylinderGeometry(0.032,0.032,1,24).rotateX(Math.PI/2), M.alu); bras.add(arm);
setBetween(arm, new THREE.Vector3(COL.x,ARM_Y,COL.z), armEnd);
add(bras, rbox(0.11,0.09,0.11,M.body,0.01), COL.x,ARM_Y,COL.z);
add(bras, rbox(0.09,0.08,0.09,M.body,0.01), armEnd.x,armEnd.y,armEnd.z);
const hanger = link(new THREE.CylinderGeometry(0.016,0.016,1,16).rotateX(Math.PI/2), M.aluDk); bras.add(hanger);
tagPart(bras,'bras');

/* ---------- 06 Protecteur ---------- */
const guard = new THREE.Group(); root.add(guard);
(function(){
  const W=0.13;
  const s=new THREE.Shape(); s.moveTo(-0.34,0); s.lineTo(0.30,0); s.lineTo(0.31,0.06); s.quadraticCurveTo(0.24,0.33,-0.02,0.36); s.lineTo(-0.10,0.355); s.lineTo(-0.34,0.09); s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:W,bevelEnabled:true,bevelSize:0.006,bevelThickness:0.006,bevelSegments:2}); g.translate(0,0,-W/2);
  const hood=new THREE.Mesh(g,M.guard); hood.position.y=0.07; guard.add(hood);
  // ribs on top
  for(let i=0;i<6;i++){ const rib=rbox(0.012,0.012,W+0.016,M.guard,0.004); const t=i/6; rib.position.set(-0.10+t*0.0, 0, 0);
    const x=0.30-0.06-i*0.045, y=0.07+0.08+i*0.045; rib.position.set(x+0.02,y+0.06,0); rib.rotation.z=-0.5; guard.add(rib);}
  // accent stripes following the slope
  const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.30,0.12,0),new THREE.Vector3(0.22,0.33,0),new THREE.Vector3(-0.02,0.40,0));
  for(const z of [W/2+0.0075,-W/2-0.0075]){ const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,24,0.009,8,false),M.accent); tube.position.z=z; tube.scale.z=0.35; guard.add(tube);}
  const visor=rbox(0.60,0.07,W-0.01,M.clear,0.01); visor.position.set(-0.02,0.035,0); guard.add(visor);
  for(const x of [-0.31,0.28]){ const rl=cyl(0.022,W+0.04,M.dark,20,'z'); rl.position.set(x,0.03,0); guard.add(rl);}
  const hub=cyl(0.05,0.02,M.aluDk,24,'z'); hub.position.set(-0.03,0.36,0); guard.add(hub);
  const extr=cyl(0.045,0.08,M.aluDk,24); extr.position.set(-0.04,0.42,0); guard.add(extr);
})();
tagPart(guard,'protecteur');

/* ---------- 08 Pupitre ---------- */
const pupitre = new THREE.Group(); root.add(pupitre);
pupitre.position.set(COL.x+0.08,ARM_Y+0.22,COL.z+0.10); pupitre.rotation.y=0.65;
add(pupitre, rbox(0.62,0.38,0.05,M.body,0.012), 0,0,0);
add(pupitre, rbox(0.08,0.24,0.05,M.dark,0.004), 0,-0.25,-0.02);
const screenTex = canvasTex(1024,576,()=>{});
const screen = add(pupitre, new THREE.Mesh(new THREE.PlaneGeometry(0.46,0.26), new THREE.MeshBasicMaterial({map:screenTex, toneMapped:false})), -0.055,0.01,0.031);
add(pupitre, rbox(0.48,0.28,0.004,M.dark,0.002), -0.055,0.01,0.0245);
const btn=(c,y)=>{ const b=cyl(0.016,0.012,new THREE.MeshStandardMaterial({color:c,roughness:0.35}),20,'z'); b.position.set(0.245,y,0.03); pupitre.add(b); };
btn(0x2b64c6,0.12); btn(0x2f9a4e,0.06); btn(0xc4261c,0.0);
add(pupitre, cyl(0.035,0.01,M.yellow,24,'z'), 0.245,-0.10,0.028);
add(pupitre, cyl(0.026,0.03,M.red,24,'z'), 0.245,-0.10,0.045);
tagPart(pupitre,'pupitre');
function drawScreen(st){ const key=[st.motor,Math.round(st.h),st.t.toFixed(1),Math.round(st.r),st.rpm].join('|'); if(key===screenKey) return; screenKey=key; const c=screenTex.userData.canvas, g=c.getContext('2d'); const w=c.width,h=c.height;
  g.fillStyle='#0d1216'; g.fillRect(0,0,w,h); g.fillStyle='#1f2a33'; g.fillRect(0,0,w,64);
  g.fillStyle='#9fb3c2'; g.font='600 30px monospace'; g.fillText('RÉGLAGE DES AXES',24,43);
  g.fillStyle=st.motor?'#5cd18c':'#c45a4a'; g.beginPath(); g.arc(w-40,32,12,0,7); g.fill();
  const rows=[['Hauteur',st.h.toFixed(0),'mm'],['Angle',st.t.toFixed(1),'°'],['Guide',st.r.toFixed(0),'mm'],['Vitesse',String(st.rpm),'tr/min']];
  rows.forEach(([k,v,u],i)=>{ const y=96+i*112; g.fillStyle='#16212a'; g.fillRect(24,y,w-48,96);
    g.fillStyle='#7f93a3'; g.font='500 34px sans-serif'; g.fillText(k,48,y+60);
    g.fillStyle='#f0f4f6'; g.font='600 58px monospace'; const t=v+' '+u; g.fillText(t,w-60-g.measureText(t).width,y+68); });
  screenTex.needsUpdate=true; }

/* ---------- 03 Chariot + 11 cadre + 12 règle ---------- */
const slider = new THREE.Group(); root.add(slider);
const chariot = new THREE.Group(); slider.add(chariot);
(function(){
  const W=0.38,H=0.10, s=new THREE.Shape();
  s.moveTo(-W/2,-H); s.lineTo(W/2,-H); s.lineTo(W/2,0);
  const grooves=[0.11,0.04,-0.04,-0.11]; // T-slots along the top
  let x=W/2; for(const gz of grooves){ s.lineTo(gz+0.008,0); s.lineTo(gz+0.008,-0.012); s.lineTo(gz-0.008,-0.012); s.lineTo(gz-0.008,0); }
  s.lineTo(-W/2,0); s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:SLIDER_L,bevelEnabled:true,bevelSize:0.003,bevelThickness:0.003,bevelSegments:1}); g.translate(0,0,-SLIDER_L/2); g.rotateY(Math.PI/2);
  const prof=new THREE.Mesh(g,M.alu); prof.position.set(0,TABLE_Y+0.003,SLIDER_Z); chariot.add(prof);
  add(chariot, rbox(SLIDER_L-0.04,0.05,0.30,M.aluDk,0.008), 0,TABLE_Y-0.12,SLIDER_Z);
  for(const xe of [-SLIDER_L/2-0.015, SLIDER_L/2+0.015]) add(chariot, rbox(0.03,0.13,0.40,M.dark,0.008), xe,TABLE_Y-0.05,SLIDER_Z);
  // pull handle at the far (+X) end
  const hd=new THREE.Mesh(new THREE.TorusGeometry(0.085,0.02,14,32,Math.PI),M.dark); hd.rotation.set(-Math.PI/2,0,-Math.PI/2); hd.position.set(SLIDER_L/2+0.03,TABLE_Y-0.03,SLIDER_Z+0.02); chariot.add(hd);
  add(chariot, rbox(0.10,0.05,0.24,M.dark,0.01), SLIDER_L/2+0.06,TABLE_Y-0.04,SLIDER_Z+0.02);
  const knob=add(chariot, cyl(0.012,0.09,M.dark,12,'z'), SLIDER_L/2-0.15,TABLE_Y-0.06,SLIDER_Z+0.24);
  add(chariot, new THREE.Mesh(new THREE.SphereGeometry(0.02,14,10),M.dark), SLIDER_L/2-0.15,TABLE_Y-0.06,SLIDER_Z+0.29);
})();
tagPart(chariot,'chariot');

/* ---------- 22 Butée de délignage (sabot à griffes) en bout de chariot ---------- */
const sabot = new THREE.Group(); slider.add(sabot);
(function(){ const y0=TABLE_Y+0.003, zc=(SABOT_Z0+SABOT_Z1)/2, wz=SABOT_Z1-SABOT_Z0;
  add(sabot, rbox(0.17,0.012,wz,M.aluDk,0.003), SABOT_FACE+0.09,y0+0.006,zc);          // semelle
  add(sabot, rbox(0.014,0.065,wz,M.panel,0.003), SABOT_FACE+0.007,y0+0.032,zc);        // face d'appui
  const sl=rbox(0.16,0.008,wz,M.panel,0.003); sl.position.set(SABOT_FACE+0.075,y0+0.085,zc); sl.rotation.z=-0.42; sabot.add(sl); // tôle inclinée
  for(let i=0;i<16;i++){ const t=new THREE.Mesh(new THREE.ConeGeometry(0.004,0.012,4),M.steel); t.rotation.z=Math.PI/2; t.position.set(SABOT_FACE-0.004,y0+0.05,SABOT_Z0+0.012+i*(wz-0.024)/15); sabot.add(t); } // griffes
  add(sabot, cyl(0.009,0.10,M.dark,12), SABOT_FACE+0.10,y0+0.11,zc);
  add(sabot, rbox(0.024,0.024,0.09,M.dark,0.01), SABOT_FACE+0.10,y0+0.165,zc);          // poignée en T
})();
tagPart(sabot,'sabot');

const cadre = new THREE.Group(); slider.add(cadre);
(function(){
  const y=TABLE_Y-0.025;
  for(const x of [FRAME_X0+0.05,FRAME_X1]) add(cadre, rbox(0.05,0.05,FRAME_Z1-FRAME_Z0,M.alu,0.005), x,y,(FRAME_Z0+FRAME_Z1)/2);
  add(cadre, rbox(0.05,0.05,FRAME_Z1-FRAME_Z0,M.alu,0.005), (FRAME_X0+FRAME_X1)/2+0.08,y,(FRAME_Z0+FRAME_Z1)/2);
  add(cadre, rbox(FRAME_X1-FRAME_X0+0.06,0.06,0.06,M.aluDk,0.006), (FRAME_X0+FRAME_X1)/2+0.03,y-0.005,FRAME_Z1);
  add(cadre, rbox(FRAME_X1-FRAME_X0+0.06,0.05,0.05,M.aluDk,0.006), (FRAME_X0+FRAME_X1)/2+0.03,y-0.06,FRAME_Z0+0.03);
  const roll=cyl(0.03,FRAME_X1-FRAME_X0-0.02,M.alu,24,'x'); roll.position.set((FRAME_X0+FRAME_X1)/2+0.03,TABLE_Y-0.03,FRAME_Z1+0.07); cadre.add(roll);
  for(const x of [FRAME_X0+0.02,FRAME_X1+0.04]) add(cadre, rbox(0.02,0.07,0.1,M.dark,0.004), x,TABLE_Y-0.04,FRAME_Z1+0.06);
  for(const [x,z] of [[FRAME_X0+0.05,FRAME_Z0+0.4],[FRAME_X1,FRAME_Z0+0.4],[FRAME_X1,FRAME_Z1-0.2]]){ add(cadre, cyl(0.014,0.02,M.brass,14), x,TABLE_Y+0.005,z); add(cadre, cyl(0.016,0.05,M.dark,12), x,TABLE_Y-0.08,z); }
  add(cadre, rbox(0.06,0.10,0.06,M.dark,0.006), FRAME_X1,TABLE_Y-0.10,FRAME_Z1-0.04);
})();
tagPart(cadre,'cadre');

let stopA; const regle = new THREE.Group(); regle.position.set(REG_X,TABLE_Y,REG_Z0); regle.rotation.y=-Math.PI/2; slider.add(regle);
(function(){
  add(regle, rbox(REG_L,0.10,0.065,M.alu,0.006), REG_L/2,0.05,0);
  const sc=new THREE.Mesh(new THREE.PlaneGeometry(REG_L-0.1,0.03), new THREE.MeshStandardMaterial({map:rulerTex(3100),roughness:0.6}));
  sc.rotation.x=-Math.PI/2; sc.position.set(REG_L/2,0.1008,0.005); regle.add(sc);
  add(regle, rbox(REG_L-0.06,0.006,0.012,M.dark,0.002), REG_L/2,0.1,-0.022);
  // flip stops (butées escamotables) : A réglable, B fixe en bout
  const mkStop=(grp)=>{ add(grp, rbox(0.10,0.04,0.09,M.body,0.008), 0,0.12,0.0); add(grp, rbox(0.025,0.17,0.10,M.guard,0.012), 0.03,0.07,-0.08);
    for(const yy of [0.02,0.075,0.13]) { const hole=cyl(0.016,0.028,M.dark,18,'x'); hole.position.set(0.03,yy,-0.08); grp.add(hole); }
    add(grp, cyl(0.008,0.06,M.dark,10), -0.02,0.17,0.0); add(grp, new THREE.Mesh(new THREE.SphereGeometry(0.016,14,10),M.dark), -0.02,0.205,0); };
  stopA=new THREE.Group(); regle.add(stopA); mkStop(stopA);
  const stopB=new THREE.Group(); stopB.position.x=2.75; regle.add(stopB); mkStop(stopB);
  // digital readout at the outer end
  add(regle, rbox(0.12,0.11,0.11,M.body,0.012), REG_L+0.03,0.03,0);
  const lcd=new THREE.Mesh(new THREE.PlaneGeometry(0.07,0.035), new THREE.MeshBasicMaterial({color:0x9fb39a,toneMapped:false})); lcd.position.set(REG_L+0.091,0.05,0); lcd.rotation.y=Math.PI/2; regle.add(lcd);
  add(regle, rbox(0.06,0.04,0.06,M.dark,0.006), REG_L+0.05,-0.05,0);
  add(regle, cyl(0.025,0.012,M.dark,20), REG_L+0.05,-0.08,0);
})();
tagPart(regle,'regle');

/* ---------- 14 Pièces : groupe porté par le chariot (voir pieces.js) ---------- */
const pieceRoot = new THREE.Group(); slider.add(pieceRoot);

/* ---------- 13 Bras support ---------- */
const support = new THREE.Group(); root.add(support);
const PIVOT = new THREE.Vector3(-0.30,0.30,0.66);
add(support, rbox(0.16,0.20,0.06,M.body,0.008), PIVOT.x,PIVOT.y,PIVOT.z-0.01);
add(support, cyl(0.035,0.10,M.aluDk,20), PIVOT.x,PIVOT.y,PIVOT.z+0.03);
const swingArm = link(new THREE.BoxGeometry(0.11,0.05,1), M.body); support.add(swingArm);
const swingArmFace = link(new THREE.BoxGeometry(0.004,0.035,1), M.dark); support.add(swingArmFace);
const legOuter = link(new THREE.CylinderGeometry(0.03,0.03,1,18).rotateX(Math.PI/2), M.alu); support.add(legOuter);
const legInner = link(new THREE.CylinderGeometry(0.022,0.022,1,18).rotateX(Math.PI/2), M.aluDk); support.add(legInner);
const foot = add(support, rbox(0.14,0.05,0.10,M.body,0.008), 0,0,0);
const footPad = add(support, cyl(0.03,0.02,M.dark,16), 0,0,0);
const capEnd = add(support, rbox(0.12,0.08,0.06,M.dark,0.01), 0,0,0);
tagPart(support,'support');
/* ---------- mise à jour d'après les réglages (appelée à chaque apply) ---------- */
const tmpA=new THREE.Vector3(), tmpB=new THREE.Vector3();
let footLeg=null;
function update(){
  stopA.position.x = stopFace() - REG_Z0 - 0.0175;
  guideProf.position.x = st.guideShort ? 0.705 : 0;
  if(st.sabot!==!!sabot.parent){ if(st.sabot) slider.add(sabot); else slider.remove(sabot); }
  incBlade.position.y=-INC_R+st.incH/1000; incBlade.position.z=st.incOff/1000; incBlade.scale.z=st.incW/4.5;
  MAT_LED.emissiveIntensity=st.inc&&st.motor?2.2:0;
  slider.position.x = SLIDER_HOME + st.s/1000;
  lift.position.y = st.h/1000 - R;
  tiltPivot.rotation.x = -THREE.MathUtils.degToRad(st.t);
  guide.position.z = guideFace() - 0.115; // la face de travail du profilé est à la cote réglée
  root.updateMatrixWorld(true); const ho=hoseOut.getWorldPosition(new THREE.Vector3());
  setBetween(hose, ho, HOSE_END); hoseRings.forEach((r,i)=>{ const t=(i+1)/10; r.position.lerpVectors(ho,HOSE_END,t); r.lookAt(HOSE_END); });
  const gy = TABLE_Y + Math.max(0.012, st.h/1000*Math.cos(THREE.MathUtils.degToRad(st.t)) + 0.012);
  guard.position.set(0, gy - 0.0, BLADE_Z);
  setBetween(hanger, tmpA.set(armEnd.x-0.04,ARM_Y,BLADE_Z), tmpB.set(-0.04,gy+0.44,BLADE_Z));
  // le bras support suit la table coulissante
  const P = new THREE.Vector3(slider.position.x + FRAME_X1, PIVOT.y, FRAME_Z1-0.04);
  setBetween(swingArm, PIVOT, P);
  const off = new THREE.Vector3().subVectors(P,PIVOT).normalize(); const side=new THREE.Vector3(off.z,0,-off.x).multiplyScalar(0.056);
  setBetween(swingArmFace, tmpA.copy(PIVOT).add(side), tmpB.copy(P).add(side));
  const topY = TABLE_Y-0.15, midY = 0.62;
  setBetween(legOuter, tmpA.set(P.x,P.y+0.02,P.z), tmpB.set(P.x,midY,P.z));
  setBetween(legInner, tmpA.set(P.x,midY-0.02,P.z), tmpB.set(P.x,topY,P.z));
  foot.position.set(P.x,P.y,P.z); footPad.position.set(P.x,0.01,P.z); capEnd.position.set(P.x,midY,P.z);
  if(!footLeg){ footLeg=link(new THREE.CylinderGeometry(0.018,0.018,1,12).rotateX(Math.PI/2),M.aluDk); tagPart(footLeg,'support'); support.add(footLeg); }
  setBetween(footLeg, tmpA.set(P.x,P.y-0.02,P.z), tmpB.set(P.x,0.02,P.z));
  drawScreen(st);
}

/* ---------- rotation des lames (affichage volontairement ralenti : l'œil perçoit le vrai sens) ---------- */
let spin=st.motor?1:0;
function tick(dt){
  spin += ((st.motor?1:0)-spin)*Math.min(1,dt*1.2);
  const w=spin*dt*1.3*st.rpm/4000; blade.rotation.z -= w; // dents du haut vers l'opérateur (+X), contre l'avance
  motPul.rotation.z -= w*0.045/0.06;
  { const wi=spin*dt*2.2*(st.inc?1:0); incBlade.rotation.z += wi; incMotPul.rotation.z += wi*0.022/0.028; } // inciseur : sens inverse de la lame
}

return { slider, pieceRoot, update, tick, resetScreen(){ screenKey=''; } };
}
