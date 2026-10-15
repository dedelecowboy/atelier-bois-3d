/* Cotes et réglages de la tenonneuse (mètres dans la scène, millimètres dans l'interface).
   X = sens d'avance du chariot : l'opérateur charge la pièce à droite (+X), le chariot l'emmène vers la gauche (−X) devant
   la scie d'affranchissement, puis les dérouleurs, puis l'unité de toupillage. Opérateur côté +Z, derrière le chariot.
   La pièce est posée en travers (le long de Z), son bout dépasse du chariot vers les outils (−Z).
   Plan d'arasement z = 0 : bout du dérouleur inférieur (côté chariot). Le bout usiné de la pièce est en z = zEnd (mm, négatif).
   Le guide (avec son pare-éclat) est à l'arrière du chariot (+X) : la coupe en opposition plaque la pièce contre lui,
   et c'est de ce côté que les outils sortent de la pièce (éclats). */
export const TABLE_Y = 0.86;                    // dessus de la table du chariot
export const X_SAW = -0.12, X_DER = -0.50, X_TOU = -0.95;   // scie, dérouleurs, unité de toupillage (axe)
export const C_HOME = 0.35, C_END = -1.55;      // chariot : position de chargement, bout de course (x du milieu de la table)
export const C_HALF = 0.25;                     // demi-largeur de la table du chariot (le long de X)
export const GUIDE_DX = 0.20;                   // face du guide, depuis le milieu du chariot
export const PE_T = 20;                         // épaisseur du pare-éclat vissé sur le guide (mm) : la pièce s'appuie contre lui
export const TABLE_Z = [0.03, 0.78];            // table du chariot : bord côté outils, bord côté opérateur
export const BATI_X = [-1.20, 0.14], BATI_Z = [-0.82, -0.04];
export const SAW_Y = 0.13;                      // axe de la scie au-dessus de la table (m)

/* vitesses de rotation (moteurs de la machine, à confirmer par l'enseignant) */
export const N_HEAD = { scie:3000, sup:6000, inf:6000, tou:6000 };
/* sens de rotation des arbres (vu de l'opérateur pour la scie et les dérouleurs, de dessus pour l'unité de toupillage) :
   +1 = anti-horaire. Tous coupent en opposition (contre l'avance). */
export const HEAD_SENS = { scie:1, sup:1, inf:-1, tou:1 };
export const HEADS = ['scie','inf','sup','tou'];
export const HEAD_NAME = { scie:'scie d\'affranchissement', inf:'dérouleur inférieur', sup:'dérouleur supérieur', tou:'unité de toupillage' };
export const HEAD_SHORT = { scie:'Scie', inf:'Dér. inférieur', sup:'Dér. supérieur', tou:'Toupie' };

/* plages des réglages (compteurs, mm) */
export const LT = [10, 150];          // scie : longueur du tenon (trait de scie depuis le plan d'arasement)
export const HINF = [0, 80];          // dérouleur inférieur : hauteur de la joue (dessus de l'outil au-dessus du chariot)
export const EP = [3, 120];           // épaisseur du tenon (dérouleur supérieur au-dessus de l'inférieur)
export const DEC = [-30, 30];         // décalage de l'arasement du dérouleur supérieur (vers le bout : positif)
export const HT = [0, 100];           // unité de toupillage : bas de l'outil au-dessus du chariot
export const PT = [-20, 100];         // unité de toupillage : profondeur d'usinage depuis le trait de scie
export const BUT = [150, 1500];       // butée de longueur d'arasement, depuis le plan d'arasement
export const PROT = [5, 160];         // protecteur avant (bavette) : hauteur au-dessus du chariot
export const ANG = [0, 45];           // guide orientable (0 = 90°, butée à 90°)
export const AVANCES = [4, 8, 12, 20];   // avance du chariot poussé à la main (m/min)
export const OVER0 = 10;              // dépassement du bout au-delà du trait de scie à la pose (mm)

/* règles de sécurité et de travail (propositions, À VALIDER par l'enseignant) */
export const MIN_LEN = 250;           // longueur minimale au chariot (mm)
export const MIN_W = 25;              // largeur d'appui minimale contre le guide, sur le chariot (mm)
export const MIN_H = 12;              // épaisseur minimale de la pièce posée (mm)
export const RATIO = 4;               // hauteur ≤ 4 × appui (pièce stable sous la presse)
export const JOUE_MAX = 20;           // profondeur de passe : 20 mm au plus par dérouleur (épaisseur de joue enlevée)
export const PROT_JEU = 10;           // protecteur avant : au plus 10 mm au-dessus de la pièce
export const AV_WARN = 12, AV_MAX = 15;   // avance : à partir de 12 m/min en bois dur, attention ; plus de 15 m/min, danger
export const CHUTE_MIN = 5;           // chute d'affranchissement : 5 mm au moins (sinon chute fine projetée ou coincée)
export const VC_MIN = 40, VC_MAX = 80;    // vitesse de coupe conseillée (m/s)
export const SPEEDUP = 4;             // l'animation du chariot va 4 fois plus vite que l'avance réelle
