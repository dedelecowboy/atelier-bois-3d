/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Réglages de la scie radiale (mm, degrés) et plan de la lame. */
import { TABLE_Y, Z_PIV, KERF } from './constants.js';

export const st = {
  motor:false,     // lame en rotation
  asp:false,       // aspiration
  lock:true,       // bras et tête bloqués (rotation du bras, inclinaison de la lame)
  alpha:0,         // rotation du bras (°) : > 0, l'avant de la lame part vers la droite
  beta:0,          // inclinaison de la lame (°) : le haut de la lame penche vers la gauche (côté planche)
  prot:60,         // protecteur avant : hauteur de son bord bas au-dessus de la table (mm)
  stopOn:false,    // butée de longueur en service (abaissée)
  stopL:550,       // butée : longueur de la pièce débitée (mm, depuis la face droite du trait de scie)
  handD:250,       // main gauche de maintien, toujours à gauche de la lame : distance au trait de scie (mm)
};
/* tête porte-lame : s = course (0 position arrière, 1 au bout du bras) ; mode park | pull | front | back */
export const head = { s:0, mode:'park', target:0 };
export const parked = ()=> head.mode==='park';

const rad = d=>d*Math.PI/180;
/* plan de la lame dans la scène : N·P = D (N unitaire) ; côté gauche N·P < D.
   Il contient la ligne de course au niveau de la table, qui passe par le pivot du bras, au droit de la face du guide
   (toutes les coupes d'onglet passent par le même point du guide). La lame s'incline
   autour de l'arête droite de son trait, au ras de la table : la butée mesure toujours la face posée sur la table. */
export function bladePlane(alpha=st.alpha, beta=st.beta){ const a=rad(alpha), b=rad(beta);
  const N=[Math.cos(b)*Math.cos(a), Math.sin(b), -Math.cos(b)*Math.sin(a)];
  const D=N[1]*TABLE_Y + N[2]*Z_PIV + KERF/2000*(Math.cos(b)-1); return { N, D }; }
/* abscisse du trait de scie (face gauche si side<0, face droite si side>0, milieu sinon) à la hauteur y et à la profondeur z */
export function bladeX(y, z, side=0){ const { N, D }=bladePlane(); return (D + side*KERF/2000 - N[1]*y - N[2]*z)/N[0]; }
/* face droite du trait au guide, lame droite : zéro de la règle de la butée */
export const stopX = ()=> (KERF/2 + st.stopL)/1000;

export const ctx = { app:null, model:null };
export const $ = id=>document.getElementById(id);
