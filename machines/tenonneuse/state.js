/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Réglages de la tenonneuse (mm) et références partagées. */
import { C_HOME, HEADS } from './constants.js';
import { toolById } from './tools.js';

export const st = {
  main:true,      // interrupteur général (armoire électrique) sur I
  cad:false,      // machine consignée : interrupteur général sur 0 et cadenassé
  au:false,       // arrêt d'urgence enfoncé
  filin:false,    // filin de sécurité tiré : boîtier sectionneur déclenché (bouton bleu enfoncé)
  armed:true,     // machine réarmée (bouton bleu « Réarmement » du pupitre)
  asp:false,      // aspiration
  run:{ scie:false, inf:false, sup:false, tou:false },        // moteurs en marche
  sel:0,          // sélecteur « Ouverture capot » : 0 / 1
  capot:false,    // capot de protection ouvert
  carters:true,   // carters des outils en place
  tools:{ scie:'lame400', inf:'dinf180', sup:'dsup180', tou:'enf9' },
  flips:{ scie:false, inf:false, sup:false, tou:false },     // outil monté retourné
  locks:{ scie:false, inf:false, sup:false, tou:false },     // arbre bloqué (changement d'outil)
  head:'sup',     // arbre choisi dans la bibliothèque d'outils
  lt:40,          // scie : longueur du tenon (mm), trait de scie à lt du plan d'arasement
  hInf:9,         // dérouleur inférieur : hauteur de la joue au-dessus du chariot (mm)
  ep:9,           // épaisseur du tenon (mm) : dérouleur supérieur à hInf + ep
  dec:0,          // décalage de l'arasement du dérouleur supérieur vers le bout (mm)
  ht:9,           // unité de toupillage : bas de l'outil au-dessus du chariot (mm)
  pt:-10,         // unité de toupillage : profondeur d'usinage depuis le trait de scie (mm, ≤ 0 : ne touche pas)
  ang:0,          // guide orientable (°), 0 = d'équerre (butée à 90°)
  but:500,        // butée de longueur d'arasement : distance au plan d'arasement (mm)
  butOn:false,    // butée abaissée
  presse:false,   // presse-pièce serré
  protH:60,       // protecteur avant : hauteur au-dessus du chariot (mm)
  pe:{ on:true, key:null },   // pare-éclat en place ; key : réglages avec lesquels il a été usiné (null : neuf)
  cx:C_HOME,      // position du chariot (m)
  lockC:true,     // chariot verrouillé en position de chargement
  av:8,           // avance du chariot (m/min)
  mains:'poignee',// 'poignee' : mains sur la poignée du chariot ; 'piece' : une main sur la pièce
  wedge:false,    // chute fine coincée près de la lame
  bl:{ hInf:false, ep:false, ht:false },   // dernier réglage fait en descendant : jeu de la vis non rattrapé
};
/* « Il faut toujours régler les dérouleurs en montant » : réglé en descendant, l'outil reste BL mm plus haut que le compteur */
export const BL = 0.3;
export const eff = k=>st[k]+(st.bl[k]?BL:0);
export const tool = h=>toolById(st.tools[h]);
export const ctx = { app:null, model:null };
export const $ = id=>document.getElementById(id);
export const anyRun = ()=>HEADS.some(h=>st.run[h]);
