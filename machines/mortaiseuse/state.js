/* Réglages et état de la mortaiseuse (mm), références partagées. */
import { bedById } from './constants.js';

export const st = {
  main:true,       // interrupteur général (armoire électrique) sur I
  cad:false,       // machine consignée : interrupteur général sur 0 et cadenassé
  essai:false,     // essai de démarrage fait machine consignée (vérification de la consignation)
  au:false,        // arrêt d'urgence enfoncé
  on:false,        // machine en route (bouton vert : groupe hydraulique)
  bed:false,       // sélecteur « mise en route du bédane » sur 1
  auto:true,       // sélecteur automatique (true) / manuel (false)
  deb:false,       // sélecteur mortaise débouchante (true) / non débouchante (false)
  press:false,     // vérins en pression (les deux boutons blancs, à deux mains)
  capot:false,     // capot de protection de la tête ouvert
  asp:false,       // aspiration
  tool:'b10',      // bédane monté (null : aucun)
  tight:true,      // bédane serré dans son porte-outil
  osc:50,          // oscillation : longueur usinée en une plongée (mm)
  ar:9,            // arasement : bas du bédane au-dessus de la table (compteur, mm)
  dep:50,          // taquet de départ (rail 1), lu sur la règle de profondeur (mm)
  arr:101,         // taquet d'arrêt (rail 2) : profondeur + 71 (mm)
  tq:[0,60,null,null],   // taquets de la table (mm) ; null = taquet retiré (hors service)
  butG:true,       // butée gauche abaissée
  butD:false,      // butée droite abaissée
  ver:{ v1:120, v2:520, h1:120, h2:520 },   // patins des vérins (verticaux v, horizontaux h), depuis la butée gauche (mm)
  X:0,             // déplacement de la table (m, 0 = position de chargement, table sur le taquet 1)
  R:50,            // position de la tête lue sur la règle de profondeur (mm)
};
export const tool = ()=>bedById(st.tool);
export const ctx = { app:null, model:null };
export const $ = id=>document.getElementById(id);
/* taquets en service, dans l'ordre (le premier est l'origine) */
export const taquets = ()=>st.tq.map((v,i)=>({i,v})).filter(t=>t.v!==null&&t.v!==undefined);
