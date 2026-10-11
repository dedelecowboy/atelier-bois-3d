/* État des réglages de la machine (mm, degrés, tr/min) et références partagées entre les fichiers. */
import { BLADE_Z, KERF } from './constants.js';

export const st = { s:1450, h:80, t:0, r:320, rpm:4000, stop:955, guideShort:false, sabot:false, inc:false, incH:0, incW:3.8, incOff:0.4,
  motor:!matchMedia('(prefers-reduced-motion: reduce)').matches, pass:false };
export const guideFace = ()=> BLADE_Z - KERF - st.r/1000;   // la cote affichée = largeur obtenue
export const stopFace  = ()=> BLADE_Z + KERF + st.stop/1000; // la cote affichée = longueur obtenue
export const ctx = { app:null, model:null };                 // renseignés par main.js
export const $ = id=>document.getElementById(id);
