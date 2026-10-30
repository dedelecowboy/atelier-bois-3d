/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Réglages de la machine (mm, degrés) et références partagées. */
import { TABLE_F } from './constants.js';

export const st = {
  motor:!matchMedia('(prefers-reduced-motion: reduce)').matches, asp:false, pass:false,
  t:0,          // avance de la pièce (mm parcourus depuis la position de départ)
  d:1.5,        // profondeur de passe (mm) = abaissement de la table d'entrée
  ga:90,        // angle du guide avec la table (°)
  gw:360,       // largeur de passage : du guide au bord avant des tables (mm)
  bec:'plat',   // protecteur SUVAMATIC : bec d'engagement vertical ('plat') ou horizontal ('chant')
};
export const guideZ = ()=> TABLE_F - st.gw/1000;          // face de travail du guide
export const ctx = { app:null, model:null };
export const $ = id=>document.getElementById(id);
