/* Réglages de la scie à ruban (mm, degrés) et état de la lame. */
import { bladeById, toothH, voie as voieOf, rmin as rminOf } from './lame.js';
import { RIM_W, DEV_STEP } from './constants.js';

export const st = {
  main:true,        // sectionneur (interrupteur général) sur I
  cad:false,        // machine consignée : sectionneur sur 0 et cadenassé
  motor:false,      // ordre de marche de la lame (la vitesse réelle est model.spin, freinée à l'arrêt)
  au:false,         // arrêt d'urgence enfoncé
  asp:false,        // aspiration
  doors:false,      // portes des volants ouvertes (interverrouillées : ouvrables lame arrêtée seulement)
  gants:false,      // gants de manutention portés (manipulation de la lame)
  blade:'r10',      // lame montée (id du râtelier), null si démontée
  inv:false,        // lame montée à l'envers (dents vers le haut sur le brin descendant)
  ten:10,           // indicateur de tension (gradué en largeur de lame, mm)
  dev:0,            // dévers du volant supérieur (quarts de tour de manivelle, −8 à 8)
  posDev:0,         // dévers pris en compte à la dernière rotation du volant à la main (la lame s'y place)
  posOk:true,       // la lame a été mise en place en tournant le volant à la main depuis le dernier changement
  gL:0.2, gB:11, gF:4,       // guide-lame supérieur : jeu latéral des galets, galet arrière et avant des galets (mm derrière la pointe des dents)
  gLi:0.2, gBi:11, gFi:4,    // guide-lame inférieur
  hg:60,            // hauteur du bas du guide-lame supérieur et du protecteur au-dessus de la table (mm)
  tilt:0,           // inclinaison de la table (°)
  fence:true,       // guide parallèle en place
  fx:50,            // guide parallèle : distance entre le trait de scie (côté guide) et le guide (mm)
  mitOn:false,      // guide d'onglet en place (dans la rainure, à gauche de la lame)
  mit:0,            // angle du guide d'onglet (°)
  serv:false,       // servante en sortie (pièces longues)
  pouss:false,      // poussoir en main (fin de passe)
  mains:'cote',     // position des mains : 'cote' (de part et d'autre de la lame, derrière la pointe des dents) | 'axe'
  feed:false,       // avance de la pièce en cours (poussée par l'opérateur)
  speed:2,          // vitesse d'avance : 1 lente, 2 normale, 3 rapide
  steer:0,          // orientation demandée pendant le chantournage : −1 (◀), 0, 1 (▶)
};
export const lame = ()=> st.blade? bladeById(st.blade) : null;
export const voie = ()=> voieOf(lame());
export const rmin = ()=> rminOf(lame());
export const dents = ()=> toothH(lame());
/* position de la lame sur le bandage du volant (mm) : centre de la lame par rapport au milieu du bandage (+ vers l'avant),
   débord des dents devant le bandage, part de la largeur qui porte sur le bandage */
export function rimPos(dev=st.posDev){ const b=lame(); if(!b) return null; const c=dev*DEV_STEP, w=b.w;
  const over=c+w/2-RIM_W/2, on=Math.max(0,Math.min(RIM_W/2,c+w/2)-Math.max(-RIM_W/2,c-w/2));
  return { c, over, on, frac:on/w }; }
/* lame large (dents hors du bandage) ou à chantourner (centrée) : ED 6316 fig. 6, OPPBTP fig. 3 et 4 */
export const wide = ()=> (lame()?.w||0)>=20;
export function rimOk(){ const r=rimPos(), b=lame(); if(!r||!st.posOk) return false;
  return wide()? r.over>=toothH(b) && r.frac>=0.6 : Math.abs(r.c)<=3; }
export const tensionOk = ()=> !!lame() && Math.abs(st.ten-lame().w)<=2;

export const ctx = { app:null, model:null };
export const $ = id=>document.getElementById(id);
