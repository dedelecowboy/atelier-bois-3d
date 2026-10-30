/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Réglages de la machine (mm, m/min) et références partagées. */
import { B1Z, KERF, MANCHONS } from './constants.js';

export const st = {
  motor:false,   // lames en rotation
  tapis:false,   // tapis d'amenage en marche (la pièce ne s'engage que tapis en marche)
  asp:false,     // aspiration
  laser:false,   // laser de ligne de coupe
  v:24,          // vitesse d'avance du tapis (m/min)
  H:60,          // hauteur de passage sous les rouleaux presseurs (mm)
  gw:120,        // guide : largeur entre le guide et la première lame (mm)
  guideUp:true,  // guide en place (false : escamoté sous la table)
  man:'m1',      // manchon porte-lames monté
};
export const bladeZ = ()=> MANCHONS[st.man].off.map(o=>B1Z+o/1000);   // plans des lames (scène)
export const guideZ = ()=> B1Z - (KERF/2 + st.gw)/1000;                  // face de travail du guide
export const ctx = { app:null, model:null };
export const $ = id=>document.getElementById(id);
