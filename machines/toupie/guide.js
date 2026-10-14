/* Guide intégral à lamelles (type AIGNER) et entraîneur : mises en place automatiques.

   Guide intégral : chaque demi-guide est une cassette de LAM_N lamelles (entretoises) horizontales, au pas de LAM_P mm depuis
   la table. « Fermer les lamelles » : les deux demi-guides viennent à OPEN_JEU mm de l'outil (au plan du guide), et chaque
   lamelle qui ne toucherait pas l'outil (jeu LAM_CLR mm en hauteur et en profondeur) passe d'un demi-guide à l'autre : la
   lumière est fermée au maximum au-dessus et au-dessous de l'outil ; seules restent ouvertes les lamelles de la zone de coupe.
   La mise en place est mémorisée (st.lam) : si l'outil, sa hauteur ou la saillie changent ensuite, elle peut ne plus convenir
   (contact, ou lumière plus fermée au maximum) : il faut refermer les lamelles.

   Entraîneur (4 rouleaux sur ressorts, au bout d'un bras sur colonne) : « Placer sur la pièce » le pose sur la pièce de l'entrée,
   rouleaux ENT_DOWN mm sous le dessus de la pièce (les ressorts assurent la pression), bloc tourné de ENT_ANGLE° vers le guide
   (vu de dessus) pour plaquer la pièce contre le guide pendant l'avance. Il prend la place du protège-mains à presseurs. */
import { st, tool } from './state.js';
import { Rmax, rTool } from './tools.js';
import { OPEN_MIN } from './constants.js';

export const LAM_N = 10, LAM_P = 15, LAM_T = 10, LAM_D = 12;    // lamelles : nombre, pas, épaisseur, profondeur (mm)
export const LAM_CLR = 2, OPEN_JEU = 3;                         // jeu mini lamelle / outil ; jeu des demi-guides à la fermeture
export const HUB_R = 30;                                        // bagues entretoises et écrou de l'arbre (rayon, mm)
export const lamBand = k=>[k*LAM_P+(LAM_P-LAM_T)/2, k*LAM_P+(LAM_P+LAM_T)/2];

/* plus grand rayon de l'outil (ou des bagues) entre les hauteurs y0 et y1 au-dessus de la table (mm) */
function rBetween(y0,y1){ const t=tool(); let r=HUB_R; if(!t) return r;
  const ys=[]; for(let i=0;i<=24;i++) ys.push(y0+(y1-y0)*i/24);
  for(const y of [st.h, st.h+t.H]) if(y>=y0&&y<=y1) ys.push(y);
  for(const y of ys) r=Math.max(r, rTool(t, y-st.h, st.flip));                 // 0 hors de la hauteur de coupe
  return r; }
/* la lamelle k toucherait-elle l'outil ? (sa face avant est au plan du guide, à zIn de l'axe ; profondeur LAM_D) */
export function lamHit(k){ const [a,b]=lamBand(k); return rBetween(a-LAM_CLR, b+LAM_CLR) > st.zIn-LAM_D-LAM_CLR; }
/* corde de l'outil au plan du guide (mm) */
export const chordAtGuide=()=>{ const t=tool(); if(!t) return 0; const R=Rmax(t), z=st.zIn; return z>=R? 0 : 2*Math.sqrt(R*R-z*z); };
/* « Fermer les lamelles » : demi-guides rapprochés de l'outil, lamelles passées partout où elles ne touchent pas l'outil */
export function closeLamelles(){ st.open=Math.max(OPEN_MIN, Math.ceil(chordAtGuide()+2*OPEN_JEU)); st.lam=Array.from({length:LAM_N},(_,k)=>!lamHit(k)); }
export function openLamelles(){ st.lam=null; }
/* état de la mise en place : set (lamelles fermées), contact (une lamelle passée touche l'outil), loose (une lamelle pourrait
   être passée : lumière pas fermée au maximum), n (lamelles passées) */
export function lamStatus(){ if(!st.lam) return {set:false, contact:false, loose:false, n:0};
  let contact=false, loose=false, n=0; st.lam.forEach((b,k)=>{ const h=lamHit(k); if(b){ n++; if(h) contact=true; } else if(!h) loose=true; });
  return {set:true, contact, loose, n}; }

/* ---------- entraîneur ---------- */
export const ENT_DOWN = 4, ENT_ANGLE = 3;                        // mm sous le dessus de la pièce ; degrés vers le guide (3° : à 5°, le bout d'entrée s'éloignait trop du guide)
export const ENT_SPEEDS = [4, 8, 12, 16];                        // vitesses d'avance (m/min)
export const ENT_ROLL_R = 60, ENT_ROLL_W = 60;                   // rouleaux Ø 120 × 60
export const ENT_X = [0.20, 0.067, -0.076, -0.221];              // axes des rouleaux le long de l'avance (m) : pas 133, 143, 145 mm
export const ENT_PRESS = [1, 8];                                 // écrasement des ressorts accepté (mm) : sinon, replacer l'entraîneur
/* pose l'entraîneur sur la pièce q (hauteur et appui en mm) */
/* encombrement du bloc vu de dessus (repère du bloc, mm) : demi-longueur du carter, demi-largeur côté guide (carter et rouleaux
   affleurants), décalage des rouleaux vers le guide ; jeu gardé entre le bloc et le plan du guide (cassettes, capot) */
export const ENT_HALF_L = 296, ENT_HALF_W = 40, ENT_ROLL_OFF = -10, ENT_CLR = 5;
/* axe du bloc en travers (mm depuis l'axe de l'arbre) : son coin le plus proche du guide (bout de sortie, tourné vers le guide)
   reste à ENT_CLR mm devant le plan du guide, sur toute la longueur (aucun contact avec les cassettes ni le capot) */
export function entrZ(angle=ENT_ANGLE){ const a=angle*Math.PI/180, zG=st.zIn+Math.max(0,st.e);
  return zG + ENT_HALF_L*Math.sin(a) + ENT_HALF_W*Math.cos(a) + ENT_CLR; }
/* largeur de pièce pressée par chaque rouleau (mm), pour une pièce d'appui A contre le guide d'entrée */
export function rollCover(A, z=st.entr.z, angle=st.entr.angle){ const a=angle*Math.PI/180;
  return ENT_X.map(x=>{ const c=z+x*1000*Math.sin(a)+ENT_ROLL_OFF*Math.cos(a), lo=c-ENT_ROLL_W/2, hi=c+ENT_ROLL_W/2; return Math.max(0, Math.min(hi, st.zIn+A)-Math.max(lo, st.zIn)); }); }
export function placeEntr(H, A){ Object.assign(st.entr,{ placed:true, on:false, y:Math.round((H-ENT_DOWN)*10)/10, z:Math.round(entrZ()*10)/10, angle:ENT_ANGLE, H, A }); st.prot=false; }
export function stowEntr(){ Object.assign(st.entr,{ placed:false, on:false }); }
/* écrasement des rouleaux sur une pièce de hauteur H (mm) */
export const entrPress=H=>H-st.entr.y;
