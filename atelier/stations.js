/* Postes de l'atelier : une entrée par machine, dans l'ordre du parcours.
   pos : [x, z] du centre du poste dans le hall (m) ; yaw : rotation de la machine (rad) autour de Y.
   Repère du hall : X vers la droite (est), Z vers l'avant (sud, côté de la vue d'ensemble), sol en y = 0.
   rest(model) : met la machine dans sa position de repos (mêmes arguments que son main.js, sans pièce).
   clip : [x0, x1, z0, z1] (repère de la machine) : organes cachés hors de ce rectangle (raccords vers la page de la machine).
   url : simulateur publié (artifact) ; etat : 'service' | 'essai' | 'avenir'.
   Implantation PROPOSÉE (à remplacer par le plan réel de l'atelier du lycée). */
import { buildModel as radiale } from '../machines/scie-radiale/model.js';
import { buildModel as deligneuse } from '../machines/deligneuse/model.js';
import { buildModel as degau } from '../machines/degauchisseuse/model.js';
import { buildModel as rabot } from '../machines/raboteuse/model.js';
import { buildModel as toupie } from '../machines/toupie/model.js';
import { buildModel as tenon } from '../machines/tenonneuse/model.js';
import { buildModel as format } from '../machines/scie-format/model.js';
import * as R from '../machines/scie-radiale/state.js';
import * as D from '../machines/deligneuse/state.js';
import * as G from '../machines/degauchisseuse/state.js';

const PI = Math.PI;

export const STATIONS = [
  { id:'scie-radiale', n:1, nom:'Scie radiale', ref:'KANAK 900 R', etat:'essai', famille:'debit',
    role:'Tronçonnage des planches brutes à longueur et purge des défauts (fente, nœud, gerce).',
    url:'https://claude.ai/artifact/TFWwCULVDt3Bfo4vrDUPQS', build:radiale, rest:m=>m.update({ alpha:R.st.alpha, beta:R.st.beta, s:0, prot:R.st.prot, stopX:R.stopX(), stopOn:R.st.stopOn, zone:null, hand:{show:false} }), pos:[-9.0,-5.9], yaw:0 },
  { id:'deligneuse', n:2, nom:'Déligneuse multilames', ref:'KANAK 300 M', etat:'essai', famille:'debit',
    role:'Délignage : avivés à la largeur, suppression de la flache, multidélignage.',
    url:'https://claude.ai/artifact/2CfhFoe5awDPpfhjpwVfa7', build:deligneuse, rest:m=>{ m.setManchon(D.bladeZ()); m.update({ H:D.st.H, guideZ:D.guideZ(), guideUp:D.st.guideUp, under:()=>0, laser:false, bladeZs:D.bladeZ(), surf:()=>0, laserKey:'', amp:0 }); }, pos:[-2.4,-5.2], yaw:PI },
  { id:'degauchisseuse', n:3, nom:'Dégauchisseuse', ref:'KANAK 520 D', etat:'essai', famille:'corroyage',
    role:'Dressage des surfaces de référence : SR1 sur le plat, SR2 sur le chant, d\'équerre.',
    url:'https://claude.ai/artifact/QJ3m6hcgjuP52HZeVi5vJH', build:degau, rest:m=>m.update({ y:0, zTip:G.guideZ() }), pos:[3.6,-5.2], yaw:PI },
  { id:'raboteuse', n:4, nom:'Raboteuse', ref:'KANAK 630 E', etat:'essai', famille:'corroyage',
    role:'Mise à largeur puis à épaisseur, parallèle aux surfaces de référence.',
    url:'https://claude.ai/artifact/SMTMfYfT2i61MrQyD78z36', build:rabot, rest:m=>m.update(()=>0), pos:[8.6,-5.0], yaw:PI },
  { id:'toupie', n:5, nom:'Toupie', ref:'KANAK 130 T', etat:'essai', famille:'usinage',
    role:'Profils au guide : quarts de rond, feuillures, moulures.',
    url:'https://claude.ai/artifact/RD38t4edhpubi6Q28nYJj5', build:toupie, rest:m=>m.update(()=>0,()=>0,null), pos:[8.0,2.9], yaw:0 },
  { id:'tenonneuse', n:6, nom:'Tenonneuse', ref:'KANAK 160 TN', etat:'essai', famille:'usinage',
    role:'Usinage des bouts : tenons, enfourchements, en série à la butée.',
    url:'https://claude.ai/artifact/YLwEUxq35PKaHPYjm13DnH', build:tenon, rest:m=>m.update(0), pos:[2.6,2.5], yaw:0 },
  { id:'scie-format', n:7, nom:'Scie à format', ref:'KANAK 550', etat:'service', famille:'panneaux',
    role:'Débit et mise au format des panneaux, délignage au sabot, coupes d\'onglet et biaises.',
    url:'https://claude.ai/artifact/5TrWcgiDVbvMBYtp78Sc6E', build:format, rest:m=>m.update(), clip:[-1.6,3.4,-1.4,3.8], pos:[-9.4,1.3], yaw:0 },
  { id:'scie-ruban', n:8, nom:'Scie à ruban', ref:'à venir', etat:'avenir', famille:'debit',
    role:'Chantournage et débit de pièces cintrées. Module prévu.',
    url:null, build:null, pos:[-4.6,1.9], yaw:0, foot:[1.1,1.0,2.0] },
];

export const FAMILLES = {
  debit:{ nom:'Débit', col:'#c76a14' },
  corroyage:{ nom:'Corroyage', col:'#2f7d6f' },
  usinage:{ nom:'Usinage', col:'#5a5fb0' },
  panneaux:{ nom:'Panneaux', col:'#8a6a3a' },
};

/* chaîne de débit des bois massifs, peinte au sol : stock → 1 → 2 → 3 → 4 → 5 → 6 → établis (points [x, z]) */
export const FLOW = [[-11.7,-3.7],[-8,-3.65],[-3,-3.65],[2,-3.65],[7,-3.65],[10.6,-3.5],[11.4,-2.2],[11.5,1.5],[11.0,4.4],[9.5,4.95],[6,4.95],[2.5,5.0],[1.2,5.3]];
