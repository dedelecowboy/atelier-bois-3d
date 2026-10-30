/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Cotes de la raboteuse (mètres, repère de la scène).
   X = sens d'avance : l'opérateur est à l'entrée, côté +X ; la pièce avance vers −X (sortie, rallonge de 1 200 mm).
   Z : pupitre et transmission d'avance côté −Z (à droite de l'opérateur), courroies de l'arbre côté +Z.
   Arbre porte-lames d'axe Z AU-DESSUS de la table, en X = 0 ; il est fixe : c'est la table qui monte et descend.
   Travail en opposition : les lames du bas vont vers l'opérateur (+X), contre l'avance. */
export const CUT_Y = 1.00;                   // bas du cercle de coupe (fixe)
export const R_CUT = 0.0625;                 // arbre Ø 125 mm avec lames
export const ARBRE_Y = CUT_Y + R_CUT;        // axe de l'arbre
export const TABLE_W = 0.66;                 // table de rabotage (largeur utile 630 mm)
export const USE_W = 630;                    // largeur de rabotage (mm)
export const TABLE_X0 = -0.45, TABLE_X1 = 0.45;   // table (sortie / entrée)
export const IN_X1 = 0.90;                   // bout de la rallonge d'entrée (450 mm)
export const OUT_X0 = -1.65;                 // bout de la rallonge de sortie (1 200 mm)
export const HEAD_X = 0.50;                  // faces d'entrée et de sortie du carter de tête (±)
export const H_MIN = 2.8, H_MAX = 300;       // cote de rabotage (mm) : épaisseur finale réglée
export const ROLL_R = 0.035;                 // rayon des rouleaux d'entraînement
export const X_IN = 0.13;                    // rouleau d'entrée (strié, monobloc)
export const X_OUT = [-0.13, -0.24];         // rouleaux de sortie (caoutchouc lisse)
export const X_PAV = 0.065, X_PAR = -0.065;  // presseur avant (brise-copeaux), presseur arrière
export const X_LING = 0.215;                 // linguets anti-recul (griffes), devant le rouleau d'entrée
export const GRIP = 1.5;                     // écrasement des rouleaux : la pièce est entraînée si elle dépasse la cote de plus de −1,5 mm
export const LEAD0 = HEAD_X + 0.03;          // bout avant de la pièce posée à l'entrée, devant l'ouverture
export const EXIT_TRAIL = -0.32;             // la pièce sortie s'arrête, bout arrière ici (après le dernier rouleau)
export const MIN_LEN = 350;                  // longueur minimale (mm, consigne de l'atelier) : bien plus que l'entraxe des rouleaux (260 mm)
export const ENTRAXE = Math.round((X_IN - X_OUT[0]) * 1000);
export const PASS_MAX = 5;                   // profondeur de passe maximale (mm, consigne de l'atelier)
export const PASS_WIDE = 4;                  // passe conseillée sur une pièce large (> 200 mm)
export const THICK_TOL = 0.5;                // écart d'épaisseur toléré entre des pièces passées de front (rouleau d'entrée monobloc)
export const CHANT_RATIO = 4;                // sur chant : hauteur ≤ 4 × épaisseur, sinon la pièce bascule
export const HOOD_Y = 1.237;                 // dessus du capot : l'aide en sortie y repose les pièces rabotées
export const HOOD_X = [-0.48, 0.20];         // étendue du capot le long de X
export const RPM = 5000, Z_KNIVES = 4;       // arbre TERSA à 4 lames, 5 000 tr/min

/* bruit au poste de l'opérateur, dB(A) (engine/audio.js ; valeurs PROPOSÉES, À VALIDER) : essai avec l'ENREGISTREMENT d'une raboteuse-dégauchisseuse
   fourni par l'enseignant le 30/10/2026 (engine/sons/rabotage-*.mp3, commun à la raboteuse et à la dégauchisseuse).
   Coupe 97 = bas de la fourchette HSE « planer thicknesser 97–101 dB » ; à vide 86 (arbre porte-lames qui siffle : déjà au-dessus de 85) : proposé. */
export const BRUIT = { vide:86, coupe:97, rpm:5000 };
export const BRUIT_DURETE = { sapin:1, epicea:1, pin:1.1, meleze:1.3, frene:1.6, hetre:1.6, chene:2 };
