/* Cotes de la scie à format (mètres, repère de la scène).
   X = sens d'avance : l'opérateur est côté +X, la pièce avance vers −X.
   Chariot côté +Z ; table fixe, guide parallèle et rallonge côté −Z. */
export const TABLE_Y = 0.90, BLADE_Z = 0.255, R = 0.2;          // dessus de table, plan de lame, rayon de lame (Ø 400)
export const KERF = 0.0022, MAIN_KERF = KERF*2000;               // demi-trait (m) ; trait de lame complet (mm) = 4,4
export const SLIDER_Z = 0.465, SLIDER_L = 3.0, SLIDER_HOME = 0.12; // chariot : position = SLIDER_HOME + st.s/1000
export const SABOT_FACE = 1.30, SABOT_Z0 = 0.30, SABOT_Z1 = 0.60;  // butée de délignage (repère chariot)
export const FRAME_X0 = -1.27, FRAME_X1 = -0.62, FRAME_Z0 = SLIDER_Z+0.16, FRAME_Z1 = FRAME_Z0+1.25; // table coulissante 1250 × 650
export const REG_L = 3.2, REG_X = FRAME_X0-0.01, REG_Z0 = SLIDER_Z-0.12; // règle de tronçonnage
export const FENCE_FACE = REG_X + 0.0325;                        // face de travail de la règle (repère chariot)
export const PIECE_Y = TABLE_Y + 0.004;

/* bruit (engine/audio.js ; enregistrements de scie circulaire engine/sons/scie-*.mp3, 30/10/2026) : dB(A) au poste, valeurs PROPOSÉES, À VALIDER
   (pas de fiche donnant le niveau d'une scie à format à vide et en coupe ; INRS, fiche « lames de scie silencieuses » : gain jusqu'à 9 dB(A) à vide
   et 7 en charge, donc des lames ordinaires nettement au-dessus de 85) : à vide 84 (sans alerte, comme la toupie), en coupe 93 (passe de référence). */
export const BRUIT = { vide:84, coupe:93, rpm:4000 };
