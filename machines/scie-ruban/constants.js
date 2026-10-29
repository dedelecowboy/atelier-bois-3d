/* Cotes de la scie à ruban KANAK 800 RB (mètres dans la scène, millimètres dans l'interface).
   Machine fictive de synthèse d'après des scies à ruban de menuiserie à volants de 800 mm (photos et schémas fournis par
   l'enseignant, affiche INRS « Scie à ruban à table », INRS ED 6316) : proportions ESTIMÉES (voir CLAUDE.md).

   Repère : l'opérateur est devant la table (+Z) et regarde la machine ; le bâti en col-de-cygne est à sa gauche (−X).
   Les volants tournent dans le plan XY (axe Z) ; le brin descendant (partie travaillante) est en x = 0, le brin
   montant dans la colonne du bâti, en x = −0,80. La lame a sa largeur le long de Z : pointes des dents en z = 0
   (côté opérateur), dos de la lame en z = −largeur. La pièce avance de l'opérateur vers le bâti (vers −Z). */
export const TABLE_Y = 0.96;           // dessus de la table (960 mm du sol)
export const RV = 0.40;                // rayon des volants (Ø 800, jante garnie)
export const XW = -0.40;               // axe des volants : le brin descendant passe en x = 0
export const YL = 0.50, YU = 2.00;     // axes du volant inférieur et du volant supérieur
export const RIM_W = 45;               // largeur du bandage des volants (mm) : la lame ne doit jamais être plus large
export const PASSAGE = 500;            // hauteur de passage maximale sous le guide-lame supérieur (mm)
export const TABLE_X0 = -0.58, TABLE_X1 = 0.52, TABLE_Z0 = -0.42, TABLE_Z1 = 0.43;   // table 1 100 × 850 mm
export const MOTOR_KW = 5.5;
export const RPM = 600;                // volants : 600 tr/min → vitesse de coupe π × 0,8 × 600 / 60 ≈ 25 m/s
export const VC = Math.PI * 2 * RV * RPM / 60;
export const BLADE_LEN = Math.round(Math.PI * 2 * RV * 1000 + 2 * (YU - YL) * 1000);   // L = π D + 2 H (ED 6316)
export const E_MAX = 0.8;              // épaisseur maximale de lame : D / 1000 (ED 6316)

/* sécurité et réglages (sources dans data/sources.txt ; valeurs proposées, À VALIDER par l'enseignant) */
export const PROT_GAP = [3, 10];       // guide-lame supérieur et protecteur : 3 à 10 mm au-dessus de la pièce
export const ZONE = 120;               // fin de passe : à moins de 120 mm de la lame, poussoir obligatoire
export const NEAR = 150;               // chute à moins de 150 mm de la lame : ne la dégager qu'à l'arrêt complet (ou au poussoir)
export const GUIDE_LAT = [0.1, 0.3];   // galets latéraux : quelques dixièmes de mm de la lame
export const GUIDE_BACK = [0.5, 2];    // galet arrière : 0,5 à 2 mm derrière le dos de la lame (OPPBTP fig. 5, TB 2-3)
export const GUIDE_FRONT = [1, 4];     // avant des galets : 1 à 4 mm en arrière du fond de denture
export const TENSION_TOL = 2;          // tension : indicateur réglé sur la largeur de la lame, ± 2 mm
export const MIN_TEETH = 3;            // au moins 3 dents en prise dans le bois (document technique LEMAN 2026)
export const MAX_TEETH = 16;           // au-delà, la denture fine bourre et chauffe (valeur proposée)
export const STAB = 4;                 // pièce sur chant : hauteur au plus 4 fois l'appui (comme aux autres machines)
export const DEV_STEP = 3;             // dévers : un quart de tour de la manivelle déplace la lame de 3 mm sur le bandage
export const DEV_MAX = 8;
export const BRAKE_S = 6;              // temps d'arrêt avec le frein (ED 6316 : 10 s au plus)
export const RES = 0.5;                // grille des pièces (mm par case)

/* bruit au poste de l'opérateur, dB(A) (engine/audio.js ; valeurs PROPOSÉES, À VALIDER) : essai avec ENREGISTREMENTS (sons/*.mp3)
   fournis par l'enseignant le 29/10/2026. Coupe 91 : bas de la fourchette HSE « band resaws 90–105 dB » ; à vide 82 = coupe − 9 dB,
   écart relevé entre la marche à vide et la coupe dans l'enregistrement fourni. */
export const BRUIT = { vide:82, coupe:91, rpm:600 };
export const BRUIT_DURETE = { sapin:1, epicea:1, pin:1.1, meleze:1.3, frene:1.6, hetre:1.6, chene:2 };
