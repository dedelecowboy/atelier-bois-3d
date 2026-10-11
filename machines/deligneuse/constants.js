/* Cotes de la déligneuse multilames (mètres, repère de la scène).
   X = sens d'avance : l'opérateur est à l'entrée, côté +X ; la pièce avance vers −X (sortie).
   Z : guide d'entrée côté −Z (à droite de l'opérateur), moteur et pupitre côté +Z.
   Arbre porte-lames d'axe Z AU-DESSUS du tapis, en X = 0 ; travail en opposition :
   les dents du bas vont vers l'opérateur (+X), contre l'avance. */
export const TABLE_Y = 0.75;                 // dessus du tapis = plan de travail (750 mm du sol)
export const CHAIN_W = 0.30;                 // largeur du tapis
export const R_BLADE = 0.15;                 // lames Ø 300
export const SHAFT_Y = TABLE_Y + R_BLADE - 0.002;   // les dents descendent au ras des patins du tapis
export const KERF = 3.2;                     // trait de scie (mm)
export const B1Z = -0.06;                    // première lame (côté guide)
export const HOOD_X0 = -0.60, HOOD_X1 = 0.45;  // capot : sortie / entrée
export const CHAIN_X0 = -0.52, CHAIN_X1 = 0.50;
export const LEAD0 = 0.52;                   // bout avant de la pièce posée sur la table d'entrée
export const EXIT_X = -0.66;                 // la pièce sortie s'arrête, bout arrière ici
export const MIN_LEN = 390;                  // longueur minimale des pièces (mm)
export const ROLLERS = [0.25, 0.15, -0.15, -0.25];   // rouleaux presseurs : 2 avant, 2 après les lames
/* manchons porte-lames préréglés : décalage de chaque lame depuis la première (mm) */
export const MANCHONS = {
  m1: { label: '1 lame', off: [0] },
  m2: { label: '2 lames · 140', off: [0, 140 + KERF] },
  m4: { label: '4 lames · 45', off: [0, 1, 2, 3].map(i => i * (45 + KERF)) },
};
/* ampèremètre : charge (%) = vitesse × épaisseur × nombre de lames × dureté / CAP */
export const CAP = 2070;
export const HARD = { sapin: 0.8, hetre: 1.1, chene: 1.2 };
export const GREEN = [40, 90];
