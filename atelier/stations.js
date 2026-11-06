/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
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
import { buildModel as ruban } from '../machines/scie-ruban/model.js';
import { buildModel as mortaise } from '../machines/mortaiseuse/model.js';
import * as R from '../machines/scie-radiale/state.js';
import * as D from '../machines/deligneuse/state.js';
import * as G from '../machines/degauchisseuse/state.js';
import * as B from '../machines/scie-ruban/state.js';

const PI = Math.PI;

export const STATIONS = [
  { id:'scie-radiale', n:1, nom:'Scie radiale', ref:'KANAK 900 R', etat:'service', famille:'debit',
    role:'Tronçonnage des planches brutes à longueur et purge des défauts (fente, nœud, gerce).',
    url:'https://claude.ai/artifact/TFWwCULVDt3Bfo4vrDUPQS', build:radiale, rest:m=>m.update({ alpha:R.st.alpha, beta:R.st.beta, s:0, prot:R.st.prot, stopX:R.stopX(), stopOn:R.st.stopOn, zone:null, hand:{show:false} }) },
  { id:'deligneuse', n:2, nom:'Déligneuse multilames', ref:'KANAK 300 M', etat:'service', famille:'debit',
    role:'Délignage : avivés à la largeur, suppression de la flache, multidélignage.',
    url:'https://claude.ai/artifact/2CfhFoe5awDPpfhjpwVfa7', build:deligneuse, rest:m=>{ m.setManchon(D.bladeZ()); m.update({ H:D.st.H, guideZ:D.guideZ(), guideUp:D.st.guideUp, under:()=>0, laser:false, bladeZs:D.bladeZ(), surf:()=>0, laserKey:'', amp:0 }); } },
  { id:'degauchisseuse', n:3, nom:'Dégauchisseuse', ref:'KANAK 520 D', etat:'service', famille:'corroyage',
    role:'Dressage des surfaces de référence : SR1 sur le plat, SR2 sur le chant, d\'équerre.',
    url:'https://claude.ai/artifact/QJ3m6hcgjuP52HZeVi5vJH', build:degau, rest:m=>m.update({ y:0, zTip:G.guideZ() }) },
  { id:'raboteuse', n:4, nom:'Raboteuse', ref:'KANAK 630 E', etat:'service', famille:'corroyage',
    role:'Mise à largeur puis à épaisseur, parallèle aux surfaces de référence.',
    url:'https://claude.ai/artifact/SMTMfYfT2i61MrQyD78z36', build:rabot, rest:m=>m.update(()=>0) },
  { id:'toupie', n:5, nom:'Toupie', ref:'KANAK 130 T', etat:'service', famille:'usinage',
    role:'Profils au guide : quarts de rond, feuillures, moulures.',
    url:'https://claude.ai/artifact/RD38t4edhpubi6Q28nYJj5', build:toupie, rest:m=>m.update(()=>0,()=>0,null) },
  { id:'mortaiseuse', n:6, nom:'Mortaiseuse', ref:'KANAK 130 MB', etat:'service', famille:'usinage',
    role:'Mortaises au bédane oscillant : à la cote, en série à la butée, avant les tenons (on ajuste le tenon à la mortaise).',
    url:'https://claude.ai/artifact/EwBc8rBaSxnTSVygBq9jJb', build:mortaise, rest:m=>m.update(null) },
  { id:'tenonneuse', n:7, nom:'Tenonneuse', ref:'KANAK 160 TN', etat:'service', famille:'usinage',
    role:'Usinage des bouts : tenons ajustés aux mortaises, enfourchements, en série à la butée.',
    url:'https://claude.ai/artifact/YLwEUxq35PKaHPYjm13DnH', build:tenon, rest:m=>m.update(0) },
  { id:'scie-format', n:8, nom:'Scie à format', ref:'KANAK 550', etat:'service', famille:'panneaux',
    role:'Débit et mise au format des panneaux, délignage au sabot, coupes d\'onglet et biaises.',
    url:'https://claude.ai/artifact/5TrWcgiDVbvMBYtp78Sc6E', build:format, rest:m=>m.update(), clip:[-1.6,3.4,-1.4,3.8] },
  { id:'scie-ruban', n:9, nom:'Scie à ruban', ref:'KANAK 800 RB', etat:'service', famille:'debit',
    role:'Chantournage des pièces cintrées, refente au guide parallèle ; changement et réglage de la lame.',
    url:'https://claude.ai/artifact/1peSTcP1ktVKmT7UQ9YrnC', build:ruban, rest:m=>{ m.setBlade(B.lame(),false); m.update({ hg:B.st.hg, tilt:0, fence:true, fx:0.05, rack:false, mitOn:false, mit:0, serv:false, doors:false, cad:false, main:true, au:false, ten:B.st.ten,
      guide:{ L:B.st.gL, B:B.st.gB, F:B.st.gF, Li:B.st.gLi, Bi:B.st.gBi, Fi:B.st.gFi }, e:B.lame()?.e||0.7, hands:[], pouss:null }); } },
];

/* module « Risques généraux » : pas de poste dans la salle (il porte sur tout l'atelier), en tête de la liste ;
   dans le paquetage Moodle, il doit être réussi avant les machines (verrou). */
export const RISQUES = { id:'risques', n:0, nom:'Risques généraux', ref:'Tout l\'atelier', etat:'service', famille:'risques',
  role:'Poussières, bruit, incendie, électricité, manutention, circulation, produits, EPI, règles de l\'atelier : à valider avant les machines.',
  url:'https://claude.ai/artifact/9fVgRR2Uk3tJ6o3D3Tp6za' };

/* couleurs des familles : une seule source, engine/permis.js (badges du permis machine) */
export { FAMILLES } from '../engine/permis.js';

/* chemins peints au sol dans les passages du plan (points [x, z], flèches dans le sens du travail), aux couleurs des niveaux
   du permis machine (engine/permis.js, décidé par l'enseignant le 31/10/2026) :
   - niveau 1, JAUNE : chaîne de débit et de corroyage scie radiale → déligneuse → dégauchisseuse → raboteuse,
     et une petite branche vers la scie à ruban (juste à côté) ;
   - niveau 2, ORANGE FONCÉ : le chemin se divise après la raboteuse, sans ordre imposé (« c'est fonction des pièces ») :
     toupie, mortaiseuse, tenonneuse, scie à format.
   Les branches partent d'un point du chemin principal. Contrôlé par tests/atelier/test_atelier.py (hors des machines). */
export const FLOW = [[9.6,-5.9],[7.6,-6.0],[3.9,-5.6],[-1,-5.3],[-6,-5.3],[-9.7,-4.6],[-10.1,-1.6],[-9.3,1.5],[-7.25,1.85],[-5,2.05],[-3.85,2.15]];
export const FLOWS = [
  { niv:1, pts:FLOW },
  { niv:1, pts:[[-8.6,-4.95],[-8.95,-5.9],[-9.1,-6.85]] },                                        // scie à ruban
  { niv:2, pts:[[-2.35,2.25],[-1.2,2.45],[1,2.45],[3,2.35],[6.5,2.4],[8.55,3.1],[8.85,4.6],[8.85,6.2],[9.1,7.2]] },   // → mortaiseuse
  { niv:2, pts:[[-0.45,2.45],[0.25,2.7],[0.75,3.2]] },                                                 // → toupie
  { niv:2, pts:[[-1.45,2.55],[-1.6,3.8],[-1.75,5.2],[-1.7,6.3]] },                                // tronc vers le bas
  { niv:2, pts:[[-1.75,6.0],[-2.7,6.6],[-3.6,6.95],[-4.6,7.2]] },                                 // → tenonneuse
  { niv:2, pts:[[-1.6,6.3],[-1.3,7.1],[-0.9,7.7]] },                                              // → scie à format
];
/* verrous du paquetage Moodle (les mêmes que PKG_PREREQ dans tools/build.mjs), pour l'aperçu « Moodle » de cette page */
export const PREREQ = { 'scie-radiale':'risques', 'scie-format':'risques', 'scie-ruban':'risques', deligneuse:'scie-radiale', degauchisseuse:'deligneuse',
  raboteuse:'degauchisseuse', toupie:'raboteuse', mortaiseuse:'raboteuse', tenonneuse:'raboteuse' };
