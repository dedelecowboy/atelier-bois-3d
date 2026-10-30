/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Atelier menuiserie du lycée (plan réel, atelier/plan.js) avec ses équipements de sécurité (repérables),
   les situations dangereuses du scénario « Repérer les dangers », l'avatar du scénario « EPI », le boîtier sectionneur
   de la scie à format (consignation) et le départ de feu.
   Repère de la salle : mètres, centre (0, 0), X vers la droite du plan, Z vers le bas du plan, sol y = 0.
   Mur des portes (haut du plan) : face intérieure en z = −10,7 ; mur de gauche : face intérieure en x = −10,83.
   EMPLACEMENTS DES ÉQUIPEMENTS PROPOSÉS (À VALIDER par l'enseignant d'après le plan d'évacuation de l'atelier). */
import * as THREE from 'three';
import { canvasTex } from '../../engine/kit.js';
import { buildHall, decorMachine } from '../../atelier/hall.js';
import { LAYOUT, PORTES } from '../../atelier/plan.js';
import { person, setEpi, setPose, soufflette, dustCloud } from './figures.js';

const mat=(c,o={})=>new THREE.MeshStandardMaterial({ color:c, roughness:.55, metalness:.1, ...o });
const K={ red:mat(0xc4261c,{roughness:.4}), black:mat(0x1d1f22), grey:mat(0x9aa3aa), greyD:mat(0x5d646b,{metalness:.5}), white:mat(0xf1f1ee), green:mat(0x1f9455),
  yellow:mat(0xe9c22c), wood:mat(0xc19a63,{roughness:.8}), woodD:mat(0x8a6a40,{roughness:.85}), steel:mat(0xb9c0c6,{metalness:.8,roughness:.3}), panel:mat(0xd9c9a3,{roughness:.8}),
  orange:mat(0xe0761a), blueSteel:mat(0x2b3f9e,{metalness:.2,roughness:.45}), chip:mat(0xd8b67c,{roughness:1}), rag:mat(0xe8e1d0,{roughness:1}), ragD:mat(0x9b7a4c,{roughness:1}) };
const box=(w,h,d,m)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.castShadow=o.receiveShadow=true; return o; };
const cyl=(r,h,m,s=20,r2=r)=>{ const o=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,h,s),m); o.castShadow=o.receiveShadow=true; return o; };
const at=(p,o,x,y,z)=>{ o.position.set(x,y,z); p.add(o); return o; };
const TOPZ=-10.69, LEFTX=-10.82;

/* panneau dessiné (pictogramme) : plan vertical, face vers +Z du groupe */
function sign(w,h,draw,px=256){ const H=Math.round(px*h/w); const t=canvasTex(px,H,(c,W,HH)=>draw(c,W,HH));
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({ map:t, toneMapped:false })); return m; }
const T={
  baes:(c,w,h)=>{ c.fillStyle='#fff'; c.fillRect(0,0,w,h); c.fillStyle='#14904c'; c.fillRect(4,4,w-8,h-8); c.fillStyle='#fff';
    c.fillRect(w*0.62,h*0.18,w*0.2,h*0.64); c.fillStyle='#14904c'; c.fillRect(w*0.66,h*0.24,w*0.12,h*0.52); c.fillStyle='#fff';
    c.beginPath(); c.arc(w*0.36,h*0.26,h*0.09,0,7); c.fill(); c.lineWidth=h*0.09; c.strokeStyle='#fff'; c.lineCap='round';
    c.beginPath(); c.moveTo(w*0.34,h*0.38); c.lineTo(w*0.3,h*0.6); c.lineTo(w*0.18,h*0.8); c.moveTo(w*0.3,h*0.6); c.lineTo(w*0.42,h*0.8); c.moveTo(w*0.22,h*0.46); c.lineTo(w*0.42,h*0.44); c.stroke();
    c.beginPath(); c.moveTo(w*0.46,h*0.5); c.lineTo(w*0.58,h*0.5); c.stroke(); },
  ext:(c,w,h)=>{ c.fillStyle='#c4261c'; c.fillRect(0,0,w,h); c.fillStyle='#fff'; c.fillRect(w*0.38,h*0.3,w*0.24,h*0.56); c.fillRect(w*0.42,h*0.18,w*0.12,h*0.14);
    c.lineWidth=w*0.05; c.strokeStyle='#fff'; c.beginPath(); c.moveTo(w*0.54,h*0.22); c.quadraticCurveTo(w*0.8,h*0.2,w*0.74,h*0.5); c.stroke(); },
  label:(txt,col)=>(c,w,h)=>{ c.fillStyle=col||'#fff'; c.fillRect(0,0,w,h); c.fillStyle='#111'; c.font=`bold ${Math.round(h*0.42)}px sans-serif`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(txt,w/2,h/2); },
  alarme:(c,w,h)=>{ c.fillStyle='#c4261c'; c.fillRect(0,0,w,h); c.fillStyle='#fff'; c.fillRect(w*0.18,h*0.18,w*0.64,h*0.64); c.fillStyle='#c4261c'; c.beginPath(); c.arc(w/2,h/2,w*0.18,0,7); c.fill(); },
  croix:(c,w,h)=>{ c.fillStyle='#14904c'; c.fillRect(0,0,w,h); c.fillStyle='#fff'; c.fillRect(w*0.4,h*0.18,w*0.2,h*0.64); c.fillRect(w*0.18,h*0.4,w*0.64,h*0.2); },
  oeil:(c,w,h)=>{ c.fillStyle='#14904c'; c.fillRect(0,0,w,h); c.fillStyle='#fff'; c.beginPath(); c.ellipse(w/2,h*0.42,w*0.3,h*0.14,0,0,7); c.fill(); c.fillStyle='#14904c'; c.beginPath(); c.arc(w/2,h*0.42,h*0.09,0,7); c.fill();
    c.fillStyle='#fff'; for(let i=0;i<3;i++){ c.fillRect(w*(0.36+i*0.12),h*0.62,w*0.04,h*0.2); } },
  elec:(c,w,h)=>{ c.fillStyle='#fff'; c.fillRect(0,0,w,h); c.fillStyle='#f2c200'; c.strokeStyle='#111'; c.lineWidth=w*0.05; c.beginPath(); c.moveTo(w/2,h*0.08); c.lineTo(w*0.94,h*0.9); c.lineTo(w*0.06,h*0.9); c.closePath(); c.fill(); c.stroke();
    c.fillStyle='#111'; c.beginPath(); c.moveTo(w*0.55,h*0.3); c.lineTo(w*0.4,h*0.6); c.lineTo(w*0.52,h*0.6); c.lineTo(w*0.44,h*0.82); c.lineTo(w*0.62,h*0.52); c.lineTo(w*0.5,h*0.52); c.closePath(); c.fill(); },
  au:(c,w,h)=>{ c.fillStyle='#e9c22c'; c.fillRect(0,0,w,h); c.fillStyle='#111'; c.font=`bold ${Math.round(h*0.2)}px sans-serif`; c.textAlign='center'; c.fillText('ARRÊT',w/2,h*0.42); c.fillText('D\'URGENCE',w/2,h*0.68); c.font=`${Math.round(h*0.13)}px sans-serif`; c.fillText('général',w/2,h*0.88); },
  flamme:(c,w,h)=>{ c.fillStyle='#fff'; c.fillRect(0,0,w,h); c.save(); c.translate(w/2,h/2); c.rotate(Math.PI/4); c.strokeStyle='#d0201c'; c.lineWidth=w*0.06; c.fillStyle='#fff'; c.fillRect(-w*0.3,-h*0.3,w*0.6,h*0.6); c.strokeRect(-w*0.3,-h*0.3,w*0.6,h*0.6); c.restore();
    c.fillStyle='#111'; c.beginPath(); c.moveTo(w*0.5,h*0.24); c.quadraticCurveTo(w*0.7,h*0.5,w*0.6,h*0.68); c.lineTo(w*0.4,h*0.68); c.quadraticCurveTo(w*0.32,h*0.46,w*0.5,h*0.24); c.fill(); c.fillRect(w*0.36,h*0.7,w*0.28,h*0.05); },
  obl:icon=>(c,w,h)=>{ c.fillStyle='#fff'; c.fillRect(0,0,w,h); c.fillStyle='#1f5fae'; c.beginPath(); c.arc(w/2,w/2,w*0.44,0,7); c.fill(); c.fillStyle='#fff'; c.strokeStyle='#fff'; icon(c,w);
    c.fillStyle='#111'; c.font=`bold ${Math.round(w*0.1)}px sans-serif`; c.textAlign='center'; },
  plan:(c,w,h)=>{ c.fillStyle='#fff'; c.fillRect(0,0,w,h); c.fillStyle='#14904c'; c.fillRect(0,0,w,h*0.14); c.fillStyle='#fff'; c.font=`bold ${Math.round(h*0.09)}px sans-serif`; c.textAlign='center'; c.fillText('PLAN D\'ÉVACUATION',w/2,h*0.1);
    c.strokeStyle='#333'; c.lineWidth=3; c.strokeRect(w*0.1,h*0.22,w*0.8,h*0.68); c.fillStyle='#bbb'; for(const [x,y,a,b] of [[.2,.3,.12,.08],[.4,.3,.16,.08],[.65,.3,.1,.1],[.2,.5,.6,.15],[.3,.75,.1,.1],[.55,.72,.15,.12]]) c.fillRect(w*x,h*y,w*a,h*b);
    c.strokeStyle='#14904c'; c.lineWidth=6; c.beginPath(); c.moveTo(w*0.5,h*0.85); c.lineTo(w*0.5,h*0.42); c.lineTo(w*0.58,h*0.42); c.lineTo(w*0.58,h*0.24); c.stroke();
    c.fillStyle='#d0201c'; c.beginPath(); c.arc(w*0.52,h*0.62,h*0.04,0,7); c.fill(); c.fillStyle='#111'; c.font=`${Math.round(h*0.06)}px sans-serif`; c.fillText('Vous êtes ici',w*0.52,h*0.97); },
  urgence:(c,w,h)=>{ c.fillStyle='#fff'; c.fillRect(0,0,w,h); c.fillStyle='#c4261c'; c.fillRect(0,0,w,h*0.16); c.fillStyle='#fff'; c.font=`bold ${Math.round(h*0.09)}px sans-serif`; c.textAlign='center'; c.fillText('NUMÉROS D\'URGENCE',w/2,h*0.11);
    c.textAlign='left'; c.fillStyle='#111'; const L=[['15','SAMU'],['18','Pompiers'],['112','Urgences (Europe)'],['114','Par SMS'],['','Infirmerie du lycée']]; L.forEach(([n,t],i)=>{ c.font=`bold ${Math.round(h*0.11)}px sans-serif`; c.fillStyle='#c4261c'; c.fillText(n,w*0.08,h*(0.32+i*0.15)); c.font=`${Math.round(h*0.08)}px sans-serif`; c.fillStyle='#111'; c.fillText(t,w*0.32,h*(0.31+i*0.15)); }); },
  nePas:(c,w,h)=>{ c.fillStyle='#fff'; c.fillRect(0,0,w,h); c.strokeStyle='#c4261c'; c.lineWidth=h*0.07; c.strokeRect(h*0.04,h*0.04,w-h*0.08,h-h*0.08); c.fillStyle='#c4261c'; c.font=`bold ${Math.round(h*0.15)}px sans-serif`; c.textAlign='center';
    c.fillText('NE PAS MANŒUVRER',w/2,h*0.32); c.fillStyle='#111'; c.font=`bold ${Math.round(h*0.12)}px sans-serif`; c.fillText('Travaux en cours',w/2,h*0.55); c.font=`${Math.round(h*0.1)}px sans-serif`; c.fillText('Consigné par : l\'élève',w/2,h*0.78); },
};
const ICON={
  lunettes:(c,w)=>{ c.fillRect(w*0.2,w*0.42,w*0.24,w*0.16); c.fillRect(w*0.56,w*0.42,w*0.24,w*0.16); c.fillRect(w*0.42,w*0.46,w*0.16,w*0.05); },
  casque:(c,w)=>{ c.lineWidth=w*0.06; c.beginPath(); c.arc(w/2,w*0.52,w*0.22,Math.PI,0); c.stroke(); c.fillRect(w*0.22,w*0.48,w*0.12,w*0.18); c.fillRect(w*0.66,w*0.48,w*0.12,w*0.18); },
  chaussure:(c,w)=>{ c.beginPath(); c.moveTo(w*0.3,w*0.3); c.lineTo(w*0.46,w*0.3); c.lineTo(w*0.48,w*0.52); c.lineTo(w*0.76,w*0.6); c.lineTo(w*0.76,w*0.7); c.lineTo(w*0.3,w*0.7); c.closePath(); c.fill(); },
  masque:(c,w)=>{ c.beginPath(); c.ellipse(w/2,w*0.55,w*0.2,w*0.15,0,0,7); c.fill(); c.fillRect(w*0.2,w*0.42,w*0.6,w*0.03); },
};

/* ---------- personnages dangereux / corrects du scénario « Repérer les dangers » ---------- */
function rag(){ const g=new THREE.Group(); for(let i=0;i<5;i++){ const s=new THREE.Mesh(new THREE.IcosahedronGeometry(0.07+Math.random()*0.04,0), i%2?K.rag:K.ragD); s.scale.set(1.4,0.5,1.1); s.position.set((Math.random()-.5)*0.25,0.03+i*0.015,(Math.random()-.5)*0.2); s.rotation.y=Math.random()*3; g.add(s); } return g; }
function can(m,open){ const g=new THREE.Group(); at(g,cyl(0.09,0.22,m,18),0,0.11,0); if(!open) at(g,cyl(0.092,0.02,K.greyD,18),0,0.225,0); else { const l=at(g,cyl(0.092,0.02,K.greyD,18),0.16,0.01,0.02); } return g; }
function boards(n,L,w,t){ const g=new THREE.Group(); for(let i=0;i<n;i++) at(g,box(L,t,w,i%2?K.wood:K.woodD),(Math.random()-.5)*0.08,t/2+i*t,(Math.random()-.5)*0.04); return g; }
function bench(){ const g=new THREE.Group(); at(g,box(2.0,0.08,0.75,K.wood),0,0.86,0); for(const [x,z] of [[-0.9,-0.3],[0.9,-0.3],[-0.9,0.3],[0.9,0.3]]) at(g,box(0.08,0.82,0.08,K.woodD),x,0.41,z); at(g,box(1.9,0.04,0.6,K.woodD),0,0.22,0); return g; }
function vacuum(){ const g=new THREE.Group(); at(g,cyl(0.24,0.62,K.grey,22),0,0.42,0); at(g,cyl(0.25,0.14,K.yellow,22),0,0.8,0); for(const [x,z] of [[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]]) at(g,cyl(0.04,0.06,K.black,10),x,0.04,z);
  const hose=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.2,0.6,0),new THREE.Vector3(0.6,0.5,0.2),new THREE.Vector3(0.9,0.15,0.3)]),20,0.03,8),K.black); g.add(hose); return g; }

/* ---------- feu de copeaux (animé) ---------- */
function fire(){ const g=new THREE.Group(); const F=[];
  at(g,box(1.0,0.18,0.8,K.chip),0,0.09,0).rotation.y=0.3;
  for(let i=0;i<9;i++){ const m=new THREE.MeshBasicMaterial({ color:i%3===0?0xffd34a:i%3===1?0xff8a1c:0xe5481c, transparent:true, opacity:.85, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false });
    const c=new THREE.Mesh(new THREE.ConeGeometry(0.12+Math.random()*0.1,0.5+Math.random()*0.5,8),m); c.position.set((Math.random()-.5)*0.7,0.35,(Math.random()-.5)*0.5); c.userData.ph=Math.random()*6; c.userData.h=c.geometry.parameters.height; g.add(c); F.push(c); }
  const smoke=[]; const sm=new THREE.MeshStandardMaterial({ color:0x3b3d40, transparent:true, opacity:.4, depthWrite:false, roughness:1 });
  for(let i=0;i<16;i++){ const s=new THREE.Mesh(new THREE.SphereGeometry(0.3+Math.random()*0.3,10,8),sm); s.userData.ph=Math.random(); g.add(s); smoke.push(s); }
  const light=new THREE.PointLight(0xff8a2c,0,6); light.position.set(0,0.8,0); g.add(light);
  let level=0;
  return { group:g, set(l){ level=l; g.visible=l>0; },
    tick(t){ if(!g.visible) return; for(const c of F){ const k=0.75+0.35*Math.sin(t*9+c.userData.ph); c.scale.set(level,level*k,level); c.position.y=c.userData.h*level*k/2+0.15; }
      for(const s of smoke){ const u=(t*0.12+s.userData.ph)%1; s.position.set(Math.sin(s.userData.ph*20)*0.5*u-0.8*u*u, 0.6+u*2.6*level, Math.cos(s.userData.ph*20)*0.4*u-1.6*u*u); s.scale.setScalar((0.6+u*1.6)*level); }
      light.intensity=3*level*(0.8+0.2*Math.sin(t*13)); } }; }

export function buildModel({ root, tagPart }){
  const hall=buildHall(root,{ safety:false });
  const DEC={}; for(const L of LAYOUT.machines){ const g=decorMachine(L); root.add(g); DEC[L.id]={ g, L }; }
  for(const m of [...new Set(Object.values(DEC).flatMap(d=>{ const a=[]; d.g.traverse(o=>{ if(o.isMesh) a.push(o.material); }); return a; }))]){ m.transparent=false; m.opacity=1; }

  /* ---------- équipements de sécurité (organes repérables) ---------- */
  const wallTop=(o,x,y)=>at(root,o,x,y,TOPZ);
  const wallLeft=(o,z,y)=>{ o.rotation.y=Math.PI/2; return at(root,o,LEFTX,y,z); };
  function extinguisher(kind){ const g=new THREE.Group();
    at(g,cyl(0.09,0.55,K.red,22),0,0.78,0.11);
    if(kind==='co2'){ at(g,cyl(0.07,0.06,K.black),0,1.08,0.11); const h=at(g,cyl(0.012,0.4,K.black,8),0.12,0.82,0.15); h.rotation.z=0.2; at(g,cyl(0.025,0.16,K.black,12,0.06),0.15,0.6,0.15); }
    else { at(g,cyl(0.03,0.1,K.black),0,1.1,0.11); at(g,box(0.12,0.03,0.04,K.black),0.04,1.15,0.11); const h=at(g,cyl(0.012,0.5,K.black,8),0.1,0.78,0.2); h.rotation.z=0.12;
      at(g,cyl(0.092,0.12,K.white,22),0,0.72,0.11); }
    at(g,box(0.06,0.18,0.02,K.greyD),0,1.0,0.01);
    const s=at(g,sign(0.22,0.22,T.ext),0,1.62,0.012);
    at(g,sign(0.22,0.07,T.label(kind==='co2'?'CO2 · B':'EAU + ADD. · A B','#fff'),256),0,1.47,0.012);
    return g; }
  const EXT=[];
  for(const [x,id] of [[-4.25,'e1'],[0.85,'e2']]){ const e=extinguisher('eau'); wallTop(e,x,0); e.userData.id=id; tagPart(e,'extincteur_eau'); EXT.push(e); }
  { const e=extinguisher('eau'); wallLeft(e,6.0,0); e.userData.id='e4'; tagPart(e,'extincteur_eau'); EXT.push(e);
    const e3=extinguisher('eau'); e3.rotation.y=-Math.PI/2; at(root,e3,10.82,0,3.45); e3.userData.id='e3'; tagPart(e3,'extincteur_eau'); EXT.push(e3); }
  const co2=extinguisher('co2'); wallLeft(co2,-3.0,0); tagPart(co2,'extincteur_co2');

  /* issues de secours : portes du plan + bloc autonome d'éclairage de sécurité (BAES) au-dessus */
  hall.doors.forEach((d,i)=>{ tagPart(d,'issue'); d.userData.door=['A','B','C'][i];
    const b=new THREE.Group(); at(b,box(0.38,0.14,0.08,K.white),0,0,0); at(b,sign(0.34,0.12,T.baes),0,0,0.041); b.position.set(0,2.55,0.18); d.add(b); tagPart(b,'baes'); });
  /* déclencheurs manuels d'alarme (boîtiers rouges), près des portes */
  const alarm=x=>{ const g=new THREE.Group(); at(g,box(0.14,0.14,0.06,K.red),0,0,0.03); at(g,sign(0.11,0.11,T.alarme),0,0,0.061); at(g,sign(0.2,0.06,T.label('ALARME INCENDIE','#c4261c')),0,0.13,0.01); return g; };
  for(const x of [-6.75,3.25]){ const a=alarm(); wallTop(a,x,1.35); tagPart(a,'alarme'); }
  { const a=alarm(); wallLeft(a,-3.95,1.35); tagPart(a,'alarme'); }
  /* plan d'évacuation, près de la porte B */
  { const p=sign(0.62,0.44,T.plan,512); wallTop(p,4.0,1.6); p.position.z+=0.012; tagPart(p,'plan_evac'); }
  /* armoire électrique (porte qui s'ouvre), arrêt d'urgence général, sur le mur de gauche */
  const arm=new THREE.Group(); wallLeft(arm,-1.8,0);
  at(arm,box(0.8,1.8,0.34,K.grey),0,1.0,0.17);
  const inside=new THREE.Group(); arm.add(inside); at(inside,box(0.7,1.6,0.02,K.white),0,1.0,0.33); for(let r=0;r<4;r++) for(let i=0;i<8;i++) at(inside,box(0.06,0.14,0.04,i%3?K.black:K.blueSteel),-0.26+i*0.075,1.5-r*0.32,0.35);
  const door=new THREE.Group(); door.position.set(-0.4,0,0.345); arm.add(door);
  at(door,box(0.8,1.78,0.025,K.grey),0.4,1.0,0); at(door,sign(0.24,0.21,T.elec),0.4,1.45,0.014); at(door,box(0.03,0.12,0.03,K.black),0.72,1.0,0.025);
  tagPart(arm,'armoire_elec');
  const au=new THREE.Group(); wallLeft(au,-0.95,1.25);
  at(au,box(0.16,0.16,0.08,K.yellow),0,0,0.04); const mush=at(au,cyl(0.05,0.05,K.red,20),0,0,0.1); mush.rotation.x=Math.PI/2; at(au,sign(0.2,0.12,T.au),0,0.16,0.01);
  tagPart(au,'arret_general');
  /* trousse de secours, lave-œil, affiche des numéros d'urgence (mur du haut, entre déligneuse et scie radiale) */
  { const t=new THREE.Group(); at(t,box(0.42,0.32,0.13,K.white),0,0,0.065); at(t,sign(0.2,0.2,T.croix),0,0,0.131); wallTop(t,5.55,1.45); tagPart(t,'trousse'); }
  { const o=new THREE.Group(); at(o,box(0.3,0.36,0.1,K.green),0,0,0.05); at(o,cyl(0.05,0.2,K.white,14),-0.07,-0.02,0.13); at(o,cyl(0.05,0.2,K.white,14),0.07,-0.02,0.13); at(o,sign(0.16,0.16,T.oeil),0,0.3,0.01); wallTop(o,6.2,1.25); tagPart(o,'lave_oeil'); }
  { const a=sign(0.36,0.5,T.urgence,320); wallTop(a,6.85,1.5); a.position.z+=0.01; tagPart(a,'affiche_urgence'); }
  /* armoire de sécurité des produits (inflammables), poubelle métallique à couvercle, sur le mur de droite */
  { const a=new THREE.Group(); at(a,box(0.95,1.9,0.55,K.yellow),0,0.95,0.275); at(a,box(0.01,1.8,0.01,K.black),0,0.95,0.552); at(a,sign(0.3,0.3,T.flamme),0,1.45,0.556);
    at(a,sign(0.5,0.08,T.label('PRODUITS INFLAMMABLES','#e9c22c'),400),0,1.18,0.556); a.rotation.y=-Math.PI/2; at(root,a,10.82,0,5.55); tagPart(a,'armoire_produits'); }
  { const p=new THREE.Group(); at(p,cyl(0.21,0.55,K.steel,22),0,0.28,0); at(p,cyl(0.225,0.04,K.red,22),0,0.57,0); at(p,cyl(0.03,0.04,K.black,8),0,0.6,0); at(p,cyl(0.05,0.06,K.black,10),0.24,0.06,0);
    const l=sign(0.2,0.1,T.label('CHIFFONS','#e9c22c'),256); l.position.set(0,0.35,0.212); p.add(l); at(root,p,7.3,0,10.25); tagPart(p,'poubelle_metal'); }
  /* consignes : port des EPI obligatoire (panneaux bleus) à l'entrée, près de la porte A */
  { const g=new THREE.Group(); [ICON.lunettes,ICON.casque,ICON.chaussure,ICON.masque].forEach((ic,i)=>{ const s=sign(0.36,0.46,T.obl(ic)); s.position.set(i*0.44,0,0); g.add(s); });
    { const l=sign(1.7,0.12,T.label('PORT OBLIGATOIRE DES EPI À L\'ATELIER','#fff'),900); l.position.set(0.66,-0.34,0); g.add(l); } wallTop(g,-3.9,1.95); g.position.z+=0.01; tagPart(g,'consignes_epi'); }
  /* allées de circulation : bandes jaunes au sol */
  { const g=new THREE.Group(), y=0.004, m=new THREE.MeshBasicMaterial({ color:0xf0c419, toneMapped:false, polygonOffset:true, polygonOffsetFactor:-2 });
    const strip=(x1,z1,x2,z2)=>{ const L=Math.hypot(x2-x1,z2-z1), s=new THREE.Mesh(new THREE.PlaneGeometry(L,0.1),m); s.rotation.x=-Math.PI/2; s.rotation.z=-Math.atan2(z2-z1,x2-x1); s.position.set((x1+x2)/2,y,(z1+z2)/2); s.receiveShadow=true; g.add(s); };
    strip(-10.8,-6.5,10.8,-6.5); strip(-10.8,-4.55,10.8,-4.55); strip(0.85,-10.65,0.85,-6.5); strip(3.3,-10.65,3.3,-6.5);
    root.add(g); tagPart(g,'allee'); }
  /* aspiration : descentes au-dessus des machines raccordées */
  { const g=new THREE.Group(); root.add(g);
    for(const id of ['toupie','m15','m16','rabot','m20','degau','m19','scie','m11','m21','m25','m5']){ const L=DEC[id]?.L; if(!L) continue; for(const m of hall.drop(L.x,L.z,L.h)) g.attach(m); }
    tagPart(g,'aspiration'); }
  /* établis de la zone de montage, aspirateur industriel, râtelier, chariot porte-panneaux, éclairage */
  const B1=bench(); at(root,B1,6.0,0,9.9); const B2=bench(); at(root,B2,8.6,0,9.9);
  { const v=vacuum(); at(root,v,4.6,0,9.7); tagPart(v,'aspirateur'); }
  { const r=new THREE.Group(); for(const z of [-1.4,0,1.4]){ at(r,box(0.1,2.2,0.1,K.blueSteel),0,1.1,z); for(const y of [0.5,1.1,1.7]) at(r,box(0.7,0.05,0.06,K.blueSteel),0.35,y,z); }
    for(const y of [0.5,1.1,1.7]){ const b=boards(3,3.4,0.2,0.03); b.rotation.y=Math.PI/2; at(r,b,0.38,y+0.03,0); }
    at(root,r,-10.7,0,6.9); r.position.x=-10.75; tagPart(r,'ratelier'); }
  { const c=new THREE.Group(); at(c,box(1.6,0.08,0.7,K.blueSteel),0,0.2,0); at(c,box(1.6,1.3,0.06,K.blueSteel),0,0.85,0); for(const [x,z] of [[-.7,-.28],[.7,-.28],[-.7,.28],[.7,.28]]) at(c,cyl(0.07,0.06,K.black,12),x,0.07,z).rotation.x=Math.PI/2;
    for(let i=0;i<4;i++){ const p=box(2.4,1.2,0.019,K.panel); p.position.set(0,0.86,0.06+i*0.022); p.rotation.x=-0.08; c.add(p); }
    c.rotation.y=Math.PI/2; at(root,c,5.1,0,8.0); tagPart(c,'chariot'); }
  { const g=new THREE.Group(), lm=new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xfff6e0, emissiveIntensity:0.8 });
    for(const x of [-7,-1.5,4,9]) for(const z of [-8,-2.5,3,8.5]){ at(g,box(1.4,0.06,0.2,lm),x,3.2,z); }
    root.add(g); tagPart(g,'eclairage'); }

  /* ---------- scie à format du plan : boîtier sectionneur, pupitre, lame (scénario « Consignation ») ---------- */
  const scie=DEC.scie, sb=new THREE.Box3().setFromObject(scie.g), sc=sb.getCenter(new THREE.Vector3());
  const sect=new THREE.Group(); sect.position.set(sb.max.x+0.25,0,sc.z+0.4); sect.rotation.y=Math.PI/2; root.add(sect);
  at(sect,box(0.08,1.0,0.08,K.greyD),0,0.5,-0.06); at(sect,box(0.26,0.32,0.16,K.grey),0,1.18,0.02);
  at(sect,box(0.16,0.16,0.01,K.yellow),0,1.18,0.105);
  const handle=new THREE.Group(); handle.position.set(0,1.18,0.12); sect.add(handle);
  at(handle,cyl(0.035,0.03,K.red,16),0,0,0).rotation.x=Math.PI/2; at(handle,box(0.12,0.035,0.035,K.red),0,0,0.03);
  const lab0=sign(0.05,0.04,T.label('0','#e9c22c'),64); lab0.position.set(-0.06,1.25,0.111); sect.add(lab0);
  const lab1=sign(0.05,0.04,T.label('1','#e9c22c'),64); lab1.position.set(0.06,1.25,0.111); sect.add(lab1);
  const lock=new THREE.Group(); lock.position.set(0.0,1.08,0.14); sect.add(lock);
  at(lock,box(0.06,0.06,0.025,mat(0xd09a2a,{metalness:.8,roughness:.3})),0,0,0); const sh=new THREE.Mesh(new THREE.TorusGeometry(0.022,0.006,6,14,Math.PI),K.steel); sh.position.y=0.03; lock.add(sh);
  const tag=sign(0.3,0.18,T.nePas,320); tag.position.set(0,0.82,0.13); sect.add(tag);
  tagPart(sect,'sectionneur');
  const pup=new THREE.Group(); pup.position.set(sb.max.x-0.05,0.95,sc.z+0.4); pup.rotation.y=Math.PI/2; root.add(pup);
  at(pup,box(0.3,0.18,0.1,K.black),0,0,0); const bI=at(pup,cyl(0.03,0.03,K.green,14),-0.07,0,0.06); bI.rotation.x=Math.PI/2; const bO=at(pup,cyl(0.03,0.03,K.red,14),0.07,0,0.06); bO.rotation.x=Math.PI/2;
  const lampOn=at(pup,cyl(0.012,0.02,new THREE.MeshBasicMaterial({ color:0xffffff }),10),0,0.065,0.04);
  const blade=new THREE.Group(); blade.position.set(sc.x,0.95,sc.z); root.add(blade);
  { const d=cyl(0.2,0.004,K.steel,48); d.rotation.x=Math.PI/2; blade.add(d); for(let i=0;i<24;i++){ const t=box(0.02,0.012,0.006,K.greyD); const a=i/24*Math.PI*2; t.position.set(Math.cos(a)*0.205,Math.sin(a)*0.205,0); t.rotation.z=a; blade.add(t); } }

  /* ---------- situations du scénario « Repérer les dangers » ---------- */
  const DANG={}, dGroup=new THREE.Group(); root.add(dGroup);
  const danger=(code,obj)=>{ obj.traverse(o=>{ o.userData.danger=code; if(o.isMesh){ o.castShadow=true; } }); obj.userData.danger=code; dGroup.add(obj); DANG[code]=obj; return obj; };
  const fig=(o,x,z,ry)=>{ const p=person(o); p.position.set(x,0,z); p.rotation.y=ry||0; return p; };
  const ticks=[];
  { const g=new THREE.Group(); const p=fig({ pose:'soufflette', epi:['chaussures','tenue','lunettes'], hair:'court' },0,0,Math.PI); g.add(p);
    const s=soufflette(); p.userData.P.handR.add(s); s.position.set(0,-0.07,0.02); s.rotation.x=Math.PI/2;
    const d=dustCloud(16,0.6); d.position.set(0.1,0.8,-0.9); g.add(d); ticks.push(d.userData.tick); g.position.set(4.95,0,1.85); danger('soufflette',g); }
  { const g=new THREE.Group(); const pts=[[-9.9,0.02,-7.0],[-9.4,0.02,-6.4],[-8.9,0.02,-5.6],[-8.6,0.02,-4.9],[-8.0,0.02,-4.2]].map(p=>new THREE.Vector3(...p));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),40,0.018,8),K.orange));
    const sander=new THREE.Group(); at(sander,box(0.28,0.1,0.16,mat(0x2e7d32)),0,0.05,0); at(sander,box(0.1,0.12,0.1,K.black),0,0.14,0); sander.position.set(-7.85,0,-4.1); g.add(sander); danger('cable',g); }
  { const g=new THREE.Group(); const r=rag(); r.position.set(-0.3,0.9,0.05); g.add(r); const c=can(mat(0x7a4a1c),true); c.position.set(0.25,0.9,0.1); g.add(c); g.position.set(6.0,0,9.9); danger('chiffons',g); }
  { const b=boards(5,2.6,0.18,0.027); b.rotation.y=0.15; b.position.set(4.6,0,-5.5); danger('allee_encombree',b); }
  { const p=fig({ pose:'machine', epi:['chaussures','tenue','lunettes','auditif','gants_manut'], hair:'court' },0.7,2.0,Math.PI); danger('gants_machine',p); }
  { const p=fig({ pose:'machine', epi:['chaussures','lunettes','auditif'], hair:'long', echarpe:true, bijoux:true },-9.95,3.6,Math.PI/2); danger('cheveux_echarpe',p); }
  { const g=new THREE.Group(); for(let i=0;i<4;i++){ const p=box(1.2,2.1,0.019,K.panel); p.position.set(0.32+i*0.03,1.02,0); p.rotation.z=-0.16; g.add(p); } g.rotation.y=Math.PI/2; g.position.set(LEFTX+0.05,0,6.0); danger('extincteur_masque',g); }
  { const g=new THREE.Group(); at(g,box(1.2,0.14,0.8,K.woodD),0,0.07,0); const b=boards(4,1.6,0.2,0.03); b.position.y=0.14; g.add(b); const p=box(1.25,1.0,0.6,mat(0xa0835a)); p.position.set(0.1,0.65,0); g.add(p);
    g.rotation.y=Math.PI/2; g.position.set(-10.15,0,-5.5); danger('issue_bloquee',g); }
  { const g=new THREE.Group(); const pile=new THREE.Mesh(new THREE.SphereGeometry(0.6,16,10,0,Math.PI*2,0,Math.PI/2),K.chip); pile.scale.set(1.3,0.45,1); g.add(pile); g.position.set(-4.2,0,6.75); danger('copeaux_sol',g); }
  { const g=new THREE.Group(); const c=can(mat(0x3366aa),true); g.add(c); g.position.set(8.9,0.9,10.0); danger('solvant_ouvert',g); }
  { const g=new THREE.Group(); const p=fig({ pose:'dos_courbe', epi:['chaussures','tenue'], hair:'court' },0,0,0); g.add(p);
    /* panneau soulevé d'un bord, l'autre bord au sol : le bord haut dans les mains de l'élève (dos courbé, jambes tendues) */
    p.updateMatrixWorld(true); const h=p.userData.P.arms.map(a=>a.palm.getWorldPosition(new THREE.Vector3())).reduce((a,b)=>a.add(b)).multiplyScalar(0.5);
    const D=1.25, y=Math.max(0.15,h.y-0.03), ang=Math.asin(Math.min(0.9,y/D)); const pn=box(2.5,0.019,D,K.panel); pn.position.set(h.x,y/2,h.z-0.02+D/2*Math.cos(ang)); pn.rotation.x=ang; g.add(pn);
    g.position.set(8.0,0,1.2); g.rotation.y=-Math.PI/2; danger('manutention_dos',g); }
  /* situations correctes (pièges) */
  { const p=fig({ pose:'machine', epi:['chaussures','tenue','lunettes','auditif'], hair:'attache' },sc.x,sb.max.z+0.45,Math.PI); danger('p_epi',p); }
  { const g=new THREE.Group(); const p=fig({ pose:'aspire', epi:['chaussures','tenue','masque','lunettes'], hair:'court' },0,0,0); g.add(p); const v=vacuum(); v.position.set(-0.6,0,0.3); g.add(v); g.position.set(6.1,0,-6.0); g.rotation.y=Math.PI*0.75; danger('p_aspirateur',g); }
  { const g=new THREE.Group(); const p=fig({ pose:'machine', epi:['chaussures','tenue','gants_manut'], hair:'court' },0,0,0); g.add(p); g.position.set(5.1,0,6.9); g.rotation.y=Math.PI; danger('p_chariot',g); }
  /* armoire électrique ouverte : la porte de l'armoire elle-même, comptée comme danger dans ce scénario */
  DANG.armoire_ouverte=arm;

  /* ---------- avatar du scénario « EPI » et départ de feu ---------- */
  const avatar=person({ pose:'debout', epi:[], hair:'long', echarpe:true, bijoux:true }); avatar.visible=false; root.add(avatar);
  const FIRE=fire(); FIRE.group.position.set(-6.4,0,-6.75); root.add(FIRE.group); FIRE.set(0);

  /* ---------- état et animation ---------- */
  let spin=0, bladeA=0, dangersOn=false, armOpen=false;
  const api={ hall, DEC, DANG, EXT, avatar, fire:FIRE, doors:hall.doors, scieBox:sb,
    /* situations dangereuses visibles (scénario « Dangers ») ; l'armoire ouverte en fait partie */
    showDangers(on){ dangersOn=on; dGroup.visible=on; api.setArmoire(on); },
    setArmoire(open){ armOpen=open; door.rotation.y= open? -1.9 : 0; inside.visible=open; arm.traverse(o=>{ if(open) o.userData.danger='armoire_ouverte'; else delete o.userData.danger; }); },
    /* sectionneur : pos 0 (ouvert) / 1 (fermé), cadenas, panneau ; machine en marche (lame) */
    setConsign(c){ handle.rotation.z= c.sect? 0 : Math.PI/2; lock.visible=!!c.lock; tag.visible=!!c.tag; lampOn.material.color.setHex(c.sect?0xffffff:0x555555); spin=c.on?1:spin; api._on=c.on; },
    placeAvatar(x,z,ry,o){ avatar.visible=true; avatar.position.set(x,0,z); avatar.rotation.y=ry; setEpi(avatar,o); setPose(avatar,o.pose||'debout'); },
    hideAvatar(){ avatar.visible=false; },
    get spin(){ return spin; },
    /* horloge réelle (t en secondes) : la lame met 4 s à s'arrêter, même à 1 image par seconde (headless) */
    tick(dt,t){ const rd=Math.min(1,Math.max(0,t-(api._t??t))); api._t=t; spin= api._on? Math.min(1,spin+rd*0.8) : Math.max(0,spin-rd/4); bladeA+=spin*dt*14; blade.rotation.z=-bladeA; for(const f of ticks) f(t); FIRE.tick(t); return spin>0 || FIRE.group.visible || dangersOn; } };
  api.showDangers(false); api.setConsign({ sect:true, lock:false, tag:false, on:false });
  return api;
}
