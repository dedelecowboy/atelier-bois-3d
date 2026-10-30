/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Cotes et réglages de la toupie (mètres dans la scène, millimètres dans l'interface).
   X = sens d'avance : l'opérateur est devant la table (côté +Z), face au guide ; la pièce avance de sa droite (+X)
   vers sa gauche (−X), en opposition : vu de dessus, l'outil tourne dans le sens anti-horaire, ses dents vont vers +X
   devant le guide (contre l'avance).
   Arbre vertical d'axe (x = 0, z = 0). Le guide est derrière la pièce (−Z) : sa face est à zIn (mm) DEVANT l'axe de
   l'arbre ; l'outil dépasse de la face du guide de la saillie p = Rmax − zIn. */
export const TABLE_Y = 0.87;                 // dessus de la table
export const TABLE_X = [-0.60, 0.60];        // table en fonte
export const TABLE_Z = [-0.40, 0.34];        // arrière (guide) / avant (opérateur)
export const RAL_X = [-1.00, 1.00];          // bouts des rallonges (rouleau en bout)
export const HOLE_R = 0.160;                 // ouverture de la table sans bague (Ø 320)
export const RINGS = [160, 200, 260, 320];   // bagues de table (Ø intérieur, mm) ; 320 = sans bague
export const RPMS = [4000, 6000, 7000, 9000];   // vitesses par poulies étagées (machine de l'atelier)
export const VARIATEUR = false;              // true : variateur électronique (vitesse tapée au pupitre) à la place des poulies
export const H_MIN = -60, H_MAX = 90;        // hauteur du bas du tranchant au-dessus de la table (mm)
export const P_MIN = -25, P_MAX = 35;        // saillie de l'outil devant le demi-guide d'entrée (mm)
export const E_MAX = 20;                     // avance du demi-guide de sortie (mm)
export const OPEN_MIN = 20, OPEN_MAX = 320;  // écart des demi-guides au droit de l'outil (mm)
export const HV_MAX = 150, DH_MAX = 250;     // presseur vertical (hauteur au-dessus de la table), presseur horizontal (distance au guide)
export const GUIDE_LEN = 0.42;               // longueur d'un demi-guide
export const GUIDE_H = 0.15;                 // hauteur des cassettes de lamelles (10 lamelles au pas de 15 mm)
export const LEAD0 = 0.16;                   // bout avant de la pièce posée à l'entrée (devant l'outil)
export const EXIT_X = -0.16;                 // la pièce sortie s'arrête, bout arrière ici
export const FEED = 6;                       // avance manuelle (m/min) ; l'animation va 4 fois plus vite

/* règles de sécurité et de travail (propositions, À VALIDER par l'enseignant) */
export const MIN_LEN = 300;                  // longueur minimale au guide (mm)
export const MIN_BASE = 30;                  // appui minimal sur la table, en travers du guide (mm)
export const RATIO = 4;                      // hauteur ≤ 4 × appui (pièce stable)
export const PASS_MAX = 10;                  // profondeur de passe maximale en une passe (mm)
export const JEU_MIN = 1, JEU_OK = 5, JEU_MAX = 10;   // jeu entre l'outil et chaque demi-guide (lamelles) au plan du guide (mm)
export const E_TOL = 0.3, E_SNIPE = 1;       // demi-guide de sortie : tolérance ; au-delà de 1 mm en retrait, entaille en fin de passe
export const PRESS_DOWN = 6;                 // presseurs : 0,5 à 6 mm sous la cote de la pièce ; plus bas, la pièce ne passe pas
export const RING_JEU = 3;                   // jeu mini entre l'outil et la bague de table (mm, de chaque côté)
export const RING_WIDE = 35;                 // au-delà de ce jeu, la lumière de table n'est pas réduite (mm, de chaque côté)

/* modes de travail : seul le travail au guide est simulé dans le lot 1 */
export const WORK_MODES = [
  { id:'guide', label:'Au guide', lot:1 },
  { id:'arbre', label:'À l\'arbre (bague de copiage)', lot:2 },
  { id:'tenon', label:'Tenonnage au chariot', lot:2 },
  { id:'entraineur', label:'Au guide avec entraîneur', lot:1 },
];

/* bruit au poste de l'opérateur, dB(A) (engine/audio.js ; valeurs proposées, À VALIDER par l'enseignant, sources dans CLAUDE.md « Bruit ») :
   à vide au régime de référence (outil Ø 125 à 9 000 tr/min) : 84 = notice Felder F 3 e-classic, LpA à vide 80 dB(A) + incertitude 4 dB ;
   en coupe, passe de référence (3 mm, 6 m/min, résineux) : 95 = bas de la fourchette HSE pour une toupie (95 à 100 dB(A)) ;
   la notice Felder donne 85 + 4 en usinage normalisé (passe légère, outil neuf) : l'atelier réel est plus bruyant. */
export const BRUIT = { vide:84, coupe:95, rpm:9000 };
/* dureté pour le bruit de coupe (charge ×) : résineux 1, feuillus durs plus */
export const BRUIT_DURETE = { sapin:1, epicea:1, pin:1.1, meleze:1.3, frene:1.6, hetre:1.6, chene:2 };
