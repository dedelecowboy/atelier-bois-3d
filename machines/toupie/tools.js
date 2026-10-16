/* Bibliothèque d'outils de la toupie (lot 1 : travail au guide) et règle de la vitesse de rotation.

   Un outil est décrit par sa coupe en 2D (section dans un plan qui contient l'axe de l'arbre) :
   - H : hauteur de coupe (mm), de y = 0 (bas du tranchant) à y = H ;
   - Rb : rayon de base (mm) ; d(y) ≥ 0 : saillie du profil au-dessus de la base, à la hauteur y ;
     rayon de coupe r(y) = Rb + d(y), diamètre maximal D = 2 × (Rb + max d).
   - nmax : vitesse maximale marquée sur l'outil (tr/min) ; sens : 'A' = anti-horaire vu de dessus
     (la flèche gravée sur la face du dessus, outil monté normalement) ; Z : nombre de dents ;
   - avance : 'MAN' (avance manuelle, seule autorisée ici) ; bague : Ø de la bague de copiage (lot 2, travail à l'arbre) ;
   - lot2 : outil préparé pour le lot 2, pas proposé dans la bibliothèque.
   Monté retourné (dessus dessous), le profil est inversé en hauteur et les tranchants tournent dans l'autre sens.

   Vitesse de coupe : Vc (m/s) = π × D (mm) × n (tr/min) / 60 000. Règle (niveau bac pro, à valider) :
   jamais plus que n max marqué sur l'outil, et Vc entre 40 et 70 m/s. Conseil : la plus grande vitesse
   de la machine qui respecte les deux. */

export const NS = 49;   // points du profil dessiné (de y = 0 à y = H)
const lin=(pts)=>y=>{ if(y<=pts[0][0]) return pts[0][1]; for(let i=1;i<pts.length;i++) if(y<=pts[i][0]){ const [a,da]=pts[i-1],[b,db]=pts[i]; return da+(db-da)*(y-a)/(b-a); } return pts[pts.length-1][1]; };

export const TOOLS = [
  { id:'droit', name:'Porte-outil droit Ø 125 × 50', short:'Outil droit', type:'porte-outil',
    usage:'Feuillures, dressage de rive', Rb:62.5, H:50, d:()=>0, nmax:9000, Z:2, sens:'A', avance:'MAN',
    desc:'Porte-outil à plaquettes droites réversibles et araseurs. Coupe droite sur 50 mm de haut : feuillures (outil en partie sous la table), dressage d\'une rive entière.' },
  { id:'chanfrein', name:'Porte-outil à chanfrein 45° Ø 125', short:'Chanfrein 45°', type:'porte-outil',
    usage:'Chanfreins', Rb:42.5, H:25, d:lin([[0,20],[20,0],[25,0]]), nmax:10000, Z:2, sens:'A', avance:'MAN',
    desc:'Plaquettes inclinées à 45° (rayon de coupe plus grand en bas) : chanfrein sur l\'arête du bas, outil sous la pièce. La taille du chanfrein se règle par la saillie.' },
  { id:'quart', name:'Fraise à quart de rond R 10 Ø 125', short:'Quart de rond R 10', type:'fraise',
    usage:'Arrondis (quart de rond)', Rb:52.5, H:16, d:y=>y>=10?0:10-Math.sqrt(Math.max(0,100-(10-y)*(10-y))), nmax:10000, Z:2, sens:'A', avance:'MAN',
    desc:'Profil concave de rayon 10 mm suivi d\'une lèvre droite. Outil au ras de la table et lèvre au ras du guide : quart de rond de 10 mm sur l\'arête du bas.' },
  { id:'rainure', name:'Fraise à rainer Ø 200 × 10', short:'Rainure 10', type:'fraise',
    usage:'Rainures', Rb:100, H:10, d:()=>0, nmax:6500, Z:4, sens:'A', avance:'MAN',
    desc:'Fraise disque à 4 dents et araseurs, largeur de coupe 10 mm. Grand diamètre : vitesse réduite (n max 6 500 tr/min).' },
  { id:'moulure', name:'Porte-outil à moulurer (doucine) Ø 160', short:'Moulure (doucine)', type:'porte-outil',
    usage:'Moulures', Rb:70, H:30, nmax:8000, Z:2, sens:'A', avance:'MAN',
    d:y=> y<=20? 2+4*(1+Math.cos(Math.PI*y/20)) : y<=22? 2*(22-y)/2 : 0,
    desc:'Fers profilés et contre-fers (refouleurs) : doucine de 20 mm de haut, 10 mm de saillie en bas et 2 mm en haut, puis lèvre. Sur une pièce de 20 mm d\'épaisseur, toute la rive est usinée.' },
  /* lot 2 (préparé, non proposé) : travail à l'arbre avec bague de copiage, tenonnage au chariot */
  { id:'arbre_bague', name:'Fraise à quart de rond R 6 avec bague de copiage Ø 100', short:'Quart de rond à bague', type:'fraise', lot2:true,
    Rb:44, H:12, d:y=>y>=6?0:6-Math.sqrt(Math.max(0,36-(6-y)*(6-y))), nmax:10000, Z:2, sens:'A', avance:'MAN', bague:100,
    desc:'Lot 2 : travail à l\'arbre de pièces cintrées, la bague de copiage roule contre le gabarit.' },
  { id:'tenon', name:'Fraise à tenonner Ø 250', short:'Tenonnage', type:'fraise', lot2:true,
    Rb:125, H:40, d:()=>0, nmax:6000, Z:4, sens:'A', avance:'MAN',
    desc:'Lot 2 : tenonnage au chariot.' },
];
export const LIB = TOOLS.filter(t=>!t.lot2);
export const toolById = id=>TOOLS.find(t=>t.id===id)||null;
export const dMax = t=>{ let m=0; for(let k=0;k<NS;k++) m=Math.max(m,t.d(k/(NS-1)*t.H)); return m; };
export const Rmax = t=>t? t.Rb+dMax(t) : 0;
export const Dmm = t=>t? Math.round(2*Rmax(t)) : 0;
/* rayon de coupe à la hauteur y du tranchant (mm, 0 = bas de la coupe), outil monté (retourné ou non) */
export const rTool = (t, y, flipped)=>{ if(!t||y<-1e-9||y>t.H+1e-9) return 0; return t.Rb+t.d(flipped? t.H-y : y); };
/* points de la section de l'outil, de bas en haut : [y, r] */
export const profilePts = (t, flipped)=>{ const out=[]; for(let k=0;k<NS;k++){ const y=k/(NS-1)*t.H; out.push([y, rTool(t,y,flipped)]); } return out; };

/* ---------- vitesse de rotation ---------- */
export const VC_MIN = 40, VC_MAX = 70;
export const vc = (Dmm_, n)=>Math.PI*Dmm_*n/60000;
export function speedCheck(t, n){ if(!t) return {ok:true, over:false, vc:0, low:false, high:false};
  const v=vc(Dmm(t),n), over=n>t.nmax; return { v, over, low:v<VC_MIN, high:v>VC_MAX, ok:!over&&v>=VC_MIN&&v<=VC_MAX }; }
export function advisedRpm(t, speeds){ if(!t) return null; const ok=speeds.filter(n=>n<=t.nmax&&vc(Dmm(t),n)<=VC_MAX&&vc(Dmm(t),n)>=VC_MIN); return ok.length? Math.max(...ok) : Math.min(...speeds); }
/* marquage de l'outil (texte court) */
export const marking = t=>`Ø ${Dmm(t)} · n max ${t.nmax.toLocaleString('fr-FR')} · ${t.avance} · ↺`;
