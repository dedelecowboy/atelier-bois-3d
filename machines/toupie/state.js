/* Réglages de la toupie (mm, tr/min) et références partagées. */
import { toolById, Rmax } from './tools.js';

export const st = {
  main:true,     // interrupteur général (sectionneur) sur I
  cad:false,     // machine consignée : sectionneur sur 0 et cadenassé (montage de l'outil)
  au:false,      // arrêt d'urgence enfoncé
  motor:false,   // moteur de l'arbre en marche
  asp:false,     // aspiration
  dir:1,         // inverseur : 1 = anti-horaire (normal), 0 = arrêt, −1 = horaire (rotation inversée)
  rpm:9000,      // vitesse de rotation (poulies étagées)
  lock:false,    // arbre verrouillé en rotation (serrage de l'écrou)
  hlock:true,    // hauteur de l'arbre bloquée
  tool:'quart',  // outil monté (id) ou null
  flip:false,    // outil monté retourné (dessus dessous)
  h:0,           // bas du tranchant au-dessus de la table (mm), positif vers le haut
  ring:200,      // bague de table : Ø intérieur (mm), 320 = sans bague
  zIn:60,        // face du demi-guide d'entrée : distance à l'axe de l'arbre (mm)
  e:0,           // demi-guide de sortie avancé (vers l'opérateur) par rapport à celui d'entrée (mm)
  open:80,       // ouverture des lamelles autour de l'outil (mm)
  prot:true,     // protège-mains à presseurs en place (sinon escamoté)
  hv:30,         // presseur vertical : hauteur de son patin au-dessus de la table (mm)
  dh:80,         // presseur horizontal : distance de son patin à la face du guide d'entrée (mm)
  push:false,    // poussoir en main pour la fin de passe
  /* préparé pour le lot 2 (non simulé) */
  work:'guide',  // mode de travail : guide | arbre | tenon | entraineur
  feedDir:-1,    // sens d'avance : −1 = de droite à gauche (seul sens simulé)
  entr:{ on:false, y:0, z:0, angle:0, v:8 },     // entraîneur : marche, hauteur, position, angle, vitesse (m/min)
  chariot:{ on:false, x:0, angle:0 },            // chariot de tenonnage
};
export const tool = ()=>toolById(st.tool);
/* saillie de l'outil devant le demi-guide d'entrée (mm) */
export const saillie = ()=>tool()? Rmax(tool())-st.zIn : 0;
export const zOut = ()=>st.zIn+st.e;
export const ctx = { app:null, model:null };
export const $ = id=>document.getElementById(id);
