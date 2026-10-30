/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Cotes de la dégauchisseuse (mètres, repère de la scène).
   X = sens d'avance : l'opérateur est côté +X (table d'entrée), la pièce avance vers −X (table de sortie).
   Z : côté opérateur +Z (avant), guide et carter côté −Z (arrière). Arbre d'axe Z sous la lumière, en X = 0. */
export const TABLE_Y = 0.86;                 // dessus de la table de sortie = cercle de coupe des fers
export const R_CUT = 0.06;                   // rayon du cercle de coupe (arbre Ø 120 avec fers)
export const ARBRE_Y = TABLE_Y - R_CUT;      // axe de l'arbre
export const TABLE_W = 0.53;                 // largeur des tables (largeur de dégauchissage 520 mm)
export const TABLE_F = TABLE_W/2;            // bord avant des tables (côté opérateur)
export const TABLE_B = -TABLE_W/2;           // bord arrière (côté guide)
export const LIP = 0.035;                    // demi-largeur de la lumière (lèvres de table)
export const TABLE_L = 1.10;                 // longueur de chaque table
export const LEAD0 = 0.10;                   // bout avant de la pièce au départ (sur la table d'entrée)
export const KNIFE_X = 0.06;                 // la coupe commence quand le bout avant passe sous cette cote
export const MIN_LEN = 320;                  // longueur minimale d'une pièce (mm)
export const FLAT = 0.05;                    // planéité à atteindre (mm)

/* bruit au poste de l'opérateur, dB(A) (engine/audio.js ; valeurs PROPOSÉES, À VALIDER) : essai avec l'ENREGISTREMENT d'une raboteuse-dégauchisseuse
   fourni par l'enseignant le 30/10/2026 (engine/sons/rabotage-*.mp3, commun à la raboteuse et à la dégauchisseuse).
   Coupe 97 = bas de la fourchette HSE « planer thicknesser 97–101 dB » ; à vide 86 (arbre porte-lames qui siffle : déjà au-dessus de 85) : proposé. */
export const BRUIT = { vide:86, coupe:97, rpm:6000 };
export const BRUIT_DURETE = { sapin:1, epicea:1, pin:1.1, meleze:1.3, frene:1.6, hetre:1.6, chene:2 };
