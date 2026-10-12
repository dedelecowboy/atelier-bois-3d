/* État des réglages de la machine (mm, degrés, tr/min) et références partagées entre les fichiers. */
import { BLADE_Z, KERF, REG_X, REG_Z0, TABLE_Y, PIECE_Y } from './constants.js';

export const st = { s:1450, h:80, t:0, r:320, rpm:4000, stop:955, guideShort:false, mit:0, sabot:false, inc:false, incH:0, incW:3.8, incOff:0.4,
  motor:!matchMedia('(prefers-reduced-motion: reduce)').matches, pass:false };
export const guideFace = ()=> BLADE_Z - KERF - st.r/1000;   // la cote affichée = largeur obtenue
export const stopFace  = ()=> BLADE_Z + KERF + st.stop/1000; // la cote affichée = longueur obtenue (règle à 0°)
/* Règle de tronçonnage orientable (coupes d'onglet) : elle pivote autour de son bout côté lame (REG_X, REG_Z0).
   n = normale de sa face de travail (vers la pièce), d = direction de la règle ; à 0° : n = +X, d = +Z. */
const rad=a=>a*Math.PI/180, FENCE_OFF=0.0325;
export const fenceN = ()=>[Math.cos(rad(st.mit)), -Math.sin(rad(st.mit))];
export const fenceD = ()=>[Math.sin(rad(st.mit)), Math.cos(rad(st.mit))];
/* distance d'un point (repère chariot) à la face de la règle : ≥ 0 du côté de la pièce */
export const fenceDist = q=>{ const n=fenceN(); return n[0]*(q[0]-REG_X)+n[1]*(q[1]-REG_Z0)-FENCE_OFF; };
/* abscisse le long de la règle */
export const fenceT = q=>{ const d=fenceD(); return d[0]*(q[0]-REG_X)+d[1]*(q[1]-REG_Z0); };
/* butée de longueur : lecture directe le long de la règle, depuis le point où la face de la règle croise le trait */
export const stopT = ()=>{ const g=rad(st.mit); return (BLADE_Z+KERF-REG_Z0+FENCE_OFF*Math.sin(g))/Math.cos(g) + st.stop/1000; };
/* lame inclinée (vers le guide, −Z) : position z du trait (face côté chariot si side>0, côté table si side<0) à la hauteur y (scène) */
export const kerfZ = (y, side=0)=>{ const t=rad(st.t); return BLADE_Z - (y-TABLE_Y)*Math.tan(t) + side*KERF/Math.cos(t); };
export const ctx = { app:null, model:null };                 // renseignés par main.js
export const $ = id=>document.getElementById(id);
