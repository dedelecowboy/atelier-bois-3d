/* Postes de l'atelier : une entrée par machine, dans l'ordre du parcours.
   rest(model) : met la machine dans sa position de repos (mêmes arguments que son main.js, sans pièce).
   clip : [x0, x1, z0, z1] (repère de la machine) : organes cachés hors de ce rectangle (raccords vers la page de la machine).
   url : simulateur publié (artifact) ; etat : 'service' | 'essai' | 'avenir'.
   La place de chaque poste est celle de sa machine dans la disposition (plan.js, MODULE_SLOT ; modifiable dans la page). */
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

/* module « Risques généraux » : pas de poste dans la salle (il porte sur tout l'atelier), en tête de la liste ;
   dans le paquetage Moodle, il doit être réussi avant les machines (verrou). */
export const RISQUES = { id:'risques', n:0, nom:'Risques généraux', ref:'Tout l\'atelier', etat:'essai', famille:'risques',
  role:'Poussières, bruit, incendie, électricité, manutention, circulation, produits, EPI, règles de l\'atelier : à valider avant les machines.',
  url:'https://claude.ai/artifact/9fVgRR2Uk3tJ6o3D3Tp6za' };

export const FAMILLES = {
  risques:{ nom:'Sécurité', col:'#c4261c' },
  debit:{ nom:'Débit', col:'#c76a14' },
  corroyage:{ nom:'Corroyage', col:'#2f7d6f' },
  usinage:{ nom:'Usinage', col:'#5a5fb0' },
  panneaux:{ nom:'Panneaux', col:'#8a6a3a' },
};

/* chaîne de débit des bois massifs, peinte au sol dans les passages du plan :
   scie radiale → déligneuse → dégauchisseuse → raboteuse → toupie → tenonneuse (points [x, z]) */
export const FLOW = [[9.6,-5.9],[7.6,-6.0],[3.9,-5.6],[-1,-5.3],[-6,-5.3],[-9.7,-4.6],[-10.1,-1.6],[-9.3,1.5],[-7.25,1.85],[-5,2.05],[-3,2.2],[0.7,2.4],[2.4,3.2],[2.4,4.9],[0,5.25],[-2.6,5.4],[-3.2,6.6],[-4.6,7.2]];
