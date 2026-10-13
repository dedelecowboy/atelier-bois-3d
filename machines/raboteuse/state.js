/* Réglages de la machine (mm, m/min) et références partagées. */
import { CUT_Y } from './constants.js';

export const st = {
  motor:false,   // arbre porte-lames en rotation
  feed:false,    // avance (rouleaux d'entraînement) en marche
  asp:false,     // aspiration
  capot:false,   // capot de l'arbre ouvert (interverrouillé : moteur impossible capot ouvert)
  H:40,          // cote de rabotage (mm) : distance table – cercle de coupe = épaisseur finale
  v:10,          // vitesse d'avance (m/min), variateur 5 à 25
};
export const tableY = ()=> CUT_Y - st.H/1000;     // dessus de la table de rabotage
export const ctx = { app:null, model:null };
export const $ = id=>document.getElementById(id);
