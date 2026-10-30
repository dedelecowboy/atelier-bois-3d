/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Cotes de la scie radiale (mètres, repère de la scène).
   X = le long du guide (sens de la longueur des planches) : la planche arrive par la gauche (−X, servante à rouleaux),
   les pièces débitées sortent à droite (+X), entre la lame et la butée de longueur.
   Z = profondeur : l'opérateur est devant (+Z), le guide et la colonne derrière (−Z).
   Lame à 0° : plan x = 0. La tête coulisse le long du bras, de la position arrière (derrière le guide)
   vers l'opérateur. Travail en avalant : les dents de devant descendent dans le bois, celles du bas vont vers le guide. */
export const TABLE_Y = 0.90;               // plan de travail (900 mm du sol)
export const R = 0.20;                     // lame Ø 400
export const DROP = 0.005;                 // la lame descend 5 mm dans la table en bois
export const KERF = 4.0;                   // trait de scie (mm)
export const FENCE_Z = -0.30;              // face avant du guide
export const FENCE_T = 0.04, FENCE_H = 0.07;
export const Z_COL = -0.90;                // axe de la colonne = pivot du bras, 600 mm derrière la face du guide (la tête en position arrière s'arrête 15 mm avant elle)
export const Z_PIV = Z_COL;                // pivot du bras (sur la colonne)
export const ANGLE_MARKS = [-45, -30, -15, 0, 15, 30, 45];   // traits de lame laissés dans la table et le guide
export const Z_PARK = -0.58;               // centre de la lame en position arrière : lame entièrement derrière le guide
export const STROKE = 0.90;                // course de la tête le long du bras
export const ARM_Y = 1.62;                 // axe du bras
export const TABLE_X0 = -1.30, TABLE_X1 = 1.30, TABLE_Z0 = -0.66, TABLE_Z1 = 0.45;
export const SERV_X0 = -3.10;              // bout de la servante à rouleaux (gauche)
export const EXT_X1 = 2.55;                // bout de la table de sortie (droite)
export const STOP_MIN = 150, STOP_MAX = 2000;   // course de la butée de longueur (mm depuis la face droite du trait)
export const ZONE = 150;                   // zone dangereuse marquée sur la table : 150 mm de part et d'autre du trait
export const MIN_LEN = 300;                // longueur minimale d'une pièce à tronçonner (tenue à la main hors de la zone)
export const MIN_USE = 350;                // longueur minimale d'une pièce utile (passage en raboteuse)
export const PROT_GAP = [1, 10];           // protecteur : 1 à 10 mm au-dessus de la pièce
export const ANGLES = [-45, -30, -15, 0, 15, 30, 45];   // rotation du bras (positions indexées)
export const TILTS = [0, 15, 30, 45];      // inclinaison de la lame

/* bruit (engine/audio.js ; enregistrements de scie circulaire engine/sons/scie-*.mp3, 30/10/2026) : dB(A) au poste, PROPOSÉS, À VALIDER
   (pas de mesure ni de fiche donnant le niveau d'une scie radiale) : à vide 84 (sans alerte), en coupe 93 (passe de référence). */
export const BRUIT = { vide:84, coupe:93, rpm:3000 };
