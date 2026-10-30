/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Bibliothèque d'outils de la tenonneuse et règle de la vitesse de rotation.

   Chaque arbre reçoit un type d'outil : 'scie' (lame), 'der' (dérouleur, supérieur ou inférieur), 'tou' (unité de toupillage).
   Coupe 2D d'un outil (section dans un plan qui contient l'axe) : un rectangle, rayon de coupe R = D / 2 sur une longueur de
   coupe Lc le long de l'axe (dérouleur : de son arasement vers le bout de la pièce ; fraise à enfourcher : épaisseur e = Lc).
   Les dérouleurs ont des fers droits avec araseurs : ils dressent la joue sur Lc et coupent l'arasement d'équerre ; au-delà de
   Lc depuis l'arasement, le bout de la pièce n'est pas atteint (joue incomplète).
   sens : sens de coupe de l'outil monté normalement (+1 = anti-horaire vu de l'opérateur, ou de dessus pour l'unité de
   toupillage). Monté retourné, le sens s'inverse. L'arbre impose son sens (HEAD_SENS) : un outil dont les tranchants tournent
   à l'envers frotte, chauffe et rejette la pièce (il ne coupe pas).
   Vitesse de coupe Vc (m/s) = π × D × n / 60 000 ; n de l'arbre jamais au-dessus de n max marqué sur l'outil. */
import { N_HEAD, HEAD_SENS, VC_MIN, VC_MAX } from './constants.js';

export const TOOLS = [
  { id:'lame400', type:'scie', name:'Lame carbure Ø 400 × 4,4, 60 dents', short:'Lame Ø 400', D:400, Lc:4.4, nmax:4500, Z:60, sens:1, avance:'MAN',
    desc:'Lame à dents carbure alternées pour l\'affranchissement (coupe en bout, à longueur). Trait de 4,4 mm.' },
  { id:'dsup180', type:'der', name:'Dérouleur Ø 180 × 120, à droite (↺)', short:'Dérouleur ↺ Ø 180', D:180, Lc:120, nmax:7000, Z:4, sens:1, avance:'MAN',
    desc:'Porte-outil à plaquettes réversibles et araseurs, tranchants à droite (↺ vu de l\'opérateur) : pour le dérouleur SUPÉRIEUR. Joue de 120 mm au plus.' },
  { id:'dinf180', type:'der', name:'Dérouleur Ø 180 × 120, à gauche (↻)', short:'Dérouleur ↻ Ø 180', D:180, Lc:120, nmax:7000, Z:4, sens:-1, avance:'MAN',
    desc:'Même porte-outil, tranchants à gauche (↻ vu de l\'opérateur) : pour le dérouleur INFÉRIEUR.' },
  { id:'dsup200', type:'der', name:'Dérouleur à fers rapportés Ø 200 × 100 (↺)', short:'Dérouleur ancien Ø 200', D:200, Lc:100, nmax:4500, Z:2, sens:1, avance:'MAN',
    desc:'Ancien porte-outil à fers rapportés, n max 4 500 tr/min : trop lent pour les dérouleurs de cette machine (6 000 tr/min).' },
  { id:'enf9', type:'tou', name:'Fraise à enfourcher Ø 200 × 9', short:'Enfourcher 9', D:200, Lc:9, nmax:7000, Z:4, sens:1, avance:'MAN',
    desc:'Fraise disque à plaquettes et araseurs, largeur de coupe 9 mm : enfourchements (mortaises ouvertes en bout).' },
  { id:'enf12', type:'tou', name:'Fraise à enfourcher Ø 200 × 12', short:'Enfourcher 12', D:200, Lc:12, nmax:7000, Z:4, sens:1, avance:'MAN',
    desc:'Même fraise, largeur de coupe 12 mm.' },
  { id:'rain250', type:'tou', name:'Fraise à rainer Ø 250 × 10', short:'Rainer Ø 250', D:250, Lc:10, nmax:4500, Z:4, sens:1, avance:'MAN',
    desc:'Fraise de toupie Ø 250, n max 4 500 tr/min : trop lente pour l\'unité de toupillage de cette machine (6 000 tr/min).' },
];
export const toolById = id=>TOOLS.find(t=>t.id===id)||null;
export const typeOf = h=>h==='scie'?'scie':h==='tou'?'tou':'der';
export const libFor = h=>TOOLS.filter(t=>t.type===typeOf(h));
export const vc = (D, n)=>Math.PI*D*n/60000;
/* contrôle de vitesse d'un outil monté sur l'arbre h */
export function speedCheck(t, h){ if(!t) return {ok:true, over:false, v:0}; const n=N_HEAD[h], v=vc(t.D,n), over=n>t.nmax;
  return { n, v, over, low:v<VC_MIN, high:v>VC_MAX, ok:!over&&v>=VC_MIN&&v<=VC_MAX }; }
/* les tranchants tournent-ils dans le sens de l'arbre ? */
export const edgesOk = (t, flip, h)=>!!t && t.sens*(flip?-1:1)===HEAD_SENS[h];
export const marking = t=>`Ø ${t.D} · n max ${t.nmax.toLocaleString('fr-FR')} · ${t.avance} · ${t.sens>0?'↺':'↻'}`;
