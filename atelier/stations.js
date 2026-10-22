/* Postes de l'atelier : une entrée par machine, dans l'ordre du parcours.
   pos : [x, z] du centre du poste dans le hall (m) ; yaw : rotation de la machine (rad) autour de Y.
   Repère du hall : X vers la droite (est), Z vers l'avant (sud, côté de la vue d'ensemble), sol en y = 0.
   rest(model) : met la machine dans sa position de repos (mêmes arguments que son main.js, sans pièce).
   clip : [x0, x1, z0, z1] (repère de la machine) : organes cachés hors de ce rectangle (raccords vers la page de la machine).
   url : simulateur publié (artifact) ; etat : 'service' | 'essai' | 'avenir'.
   Place de chaque poste : celle de sa machine dans le plan réel (plan.js, MODULE_SLOT) ; pos et yaw en sont calculés. */
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
import { LAYOUT, MODULE_SLOT } from './plan.js';

const PI = Math.PI;

export const STATIONS = [
  { id:'scie-radiale', n:1, nom:'Scie radiale', ref:'KANAK 900 R', etat:'essai', famille:'debit',
    role:'Tronçonnage des planches brutes à longueur et purge des défauts (fente, nœud, gerce).',
    url:'https://claude.ai/artifact/TFWwCULVDt3Bfo4vrDUPQS', build:radiale, rest:m=>m.update({ alpha:R.st.alpha, beta:R.st.beta, s:0, prot:R.st.prot, stopX:R.stopX(), stopOn:R.st.stopOn, zone:null, hand:{show:false} }) },
  { id:'deligneuse', n:2, nom:'Déligneuse multilames', ref:'KANAK 300 M', etat:'essai', famille:'debit',
    role:'Délignage : avivés à la largeur, suppression de la flache, multidélignage.',
    url:'https://claude.ai/artifact/2CfhFoe5awDPpfhjpwVfa7', build:deligneuse, rest:m=>{ m.setManchon(D.bladeZ()); m.update({ H:D.st.H, guideZ:D.guideZ(), guideUp:D.st.guideUp, under:()=>0, laser:false, bladeZs:D.bladeZ(), surf:()=>0, laserKey:'', amp:0 }); } },
  { id:'degauchisseuse', n:3, nom:'Dégauchisseuse', ref:'KANAK 520 D', etat:'essai', famille:'corroyage',
    role:'Dressage des surfaces de référence : SR1 sur le plat, SR2 sur le chant, d\'équerre.',
    url:'https://claude.ai/artifact/QJ3m6hcgjuP52HZeVi5vJH', build:degau, rest:m=>m.update({ y:0, zTip:G.guideZ() }) },
  { id:'raboteuse', n:4, nom:'Raboteuse', ref:'KANAK 630 E', etat:'essai', famille:'corroyage',
    role:'Mise à largeur puis à épaisseur, parallèle aux surfaces de référence.',
    url:'https://claude.ai/artifact/SMTMfYfT2i61MrQyD78z36', build:rabot, rest:m=>m.update(()=>0) },
  { id:'toupie', n:5, nom:'Toupie', ref:'KANAK 130 T', etat:'essai', famille:'usinage',
    role:'Profils au guide : quarts de rond, feuillures, moulures.',
    url:'https://claude.ai/artifact/RD38t4edhpubi6Q28nYJj5', build:toupie, rest:m=>m.update(()=>0,()=>0,null) },
  { id:'tenonneuse', n:6, nom:'Tenonneuse', ref:'KANAK 160 TN', etat:'essai', famille:'usinage',
    role:'Usinage des bouts : tenons, enfourchements, en série à la butée.',
    url:'https://claude.ai/artifact/YLwEUxq35PKaHPYjm13DnH', build:tenon, rest:m=>m.update(0) },
  { id:'scie-format', n:7, nom:'Scie à format', ref:'KANAK 550', etat:'service', famille:'panneaux',
    role:'Débit et mise au format des panneaux, délignage au sabot, coupes d\'onglet et biaises.',
    url:'https://claude.ai/artifact/5TrWcgiDVbvMBYtp78Sc6E', build:format, rest:m=>m.update(), clip:[-1.6,3.4,-1.4,3.8] },
  { id:'scie-ruban', n:8, nom:'Scie à ruban', ref:'à venir', etat:'avenir', famille:'debit',
    role:'Chantournage et débit de pièces cintrées. Module prévu.',
    url:null, build:null },
];

/* place réelle : position et orientation de la machine du plan ; pour un poste à venir, son encombrement (l, h, p) */
for(const s of STATIONS){ const L=LAYOUT.machines.find(m=>m.id===MODULE_SLOT[s.id]);
  s.pos=[L.x,L.z]; s.yaw=-L.rot*Math.PI/180; s.slot=L; if(!s.build) s.foot=[L.l,L.h,L.p]; }
/* machines du plan sans module : modèles simplifiés */
export const AUTRES = LAYOUT.machines.filter(m=>!Object.values(MODULE_SLOT).includes(m.id));

export const FAMILLES = {
  debit:{ nom:'Débit', col:'#c76a14' },
  corroyage:{ nom:'Corroyage', col:'#2f7d6f' },
  usinage:{ nom:'Usinage', col:'#5a5fb0' },
  panneaux:{ nom:'Panneaux', col:'#8a6a3a' },
};

/* chaîne de débit des bois massifs, peinte au sol dans les passages du plan :
   scie radiale → déligneuse → dégauchisseuse → raboteuse → toupie → tenonneuse (points [x, z]) */
export const FLOW = [[9.6,-5.6],[7.6,-5.7],[3.9,-5.5],[-1,-5.3],[-6,-5.3],[-9.7,-4.6],[-10.1,-1.6],[-9.5,1.4],[-6.6,2.25],[-3,2.35],[0.7,2.5],[2.9,2.8],[3.1,6.2],[0,6.7],[-3,6.9],[-5.1,7.2]];
