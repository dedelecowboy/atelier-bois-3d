/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Cotes et réglages de la mortaiseuse à bédane oscillant horizontal (mètres dans la scène, millimètres dans l'interface).
   PROPORTIONS ESTIMÉES d'après les photos et le catalogue de la machine de l'atelier (aucune cote relevée sur la machine).
   X = le long de la table (course longitudinale) ; opérateur devant (+Z) ; la tête de mortaisage est derrière le guide (−Z)
   et le bédane, horizontal, avance vers l'opérateur (+Z) dans le chant de la pièce posée à plat contre le guide.
   La table (et le portique des vérins) se déplace en X ; le guide, ses rallonges et les butées sont fixes (bâti).
   Pièce : face posée sur la table (SR1), face arrière contre le guide (z = FENCE_Z) : c'est elle que le bédane usine. */
export const TABLE_Y = 0.915;                 // dessus de la table
export const TABLE_W = 1.0, TABLE_D = 0.31;   // table 1 000 × 310
export const TABLE_Z0 = -0.12;                // bord arrière de la table (contre le guide)
export const FENCE_Z = -0.12;                 // face avant du guide : la face arrière de la pièce s'y appuie
export const XC0 = -0.01;                     // bord gauche de la course du bédane (oscillation vers +X)
export const XBG = XC0 - 0.40;                // butée gauche (bout gauche de la pièce au chargement, table sur le taquet 1)
export const XBD = XC0 + 0.42;                // butée droite (bout droit de la pièce au chargement)
export const BED_T = 20;                      // largeur de coupe du bédane (le long de X), mm

/* règle de profondeur (derrière le bâti, à gauche) : 3 rails, 2 taquets réglables. Référence 0 = 71 mm :
   quand le curseur est à 71 mm sur la règle, le bédane touche la pièce (fiche « Profondeur mortaise » de l'atelier). */
export const REF0 = 71;
export const RULE_P = [0, 220];               // règle de profondeur (mm)
export const DEP_MAX_OK = REF0;               // taquet de départ : avant 71 (le bédane prend sa vitesse avant le bois)
export const PROF_MAX = 130;                  // profondeur maximale (taquet d'arrêt à 71 + 130 = 201)
export const DEB_END = 220;                   // mortaise débouchante : la tête va au bout de sa course (taquet d'arrêt ignoré)
/* règle de la table : 4 taquets (clé Allen de 3). Taquet 1 = origine (sur 0) ; les suivants = début de chaque plongée */
export const RULE_T = [0, 350];
/* oscillation du bédane (vernier) : longueur usinée en une plongée, de la largeur du bédane (sans oscillation) à 50 mm */
export const OSC = [BED_T, 50];
export const ARAS = [0, 120];                 // arasement : hauteur du bas du bédane au-dessus de la table (compteur, clé de 27)
export const VER = [0, 1200];                 // vérins : position le long de la table, depuis la butée gauche (mm)
export const PAD_R = 20;                      // rayon des patins des vérins (mm)

/* règles de travail (propositions, À VALIDER par l'enseignant) */
export const MIN_LEN = 300;                   // longueur minimale : deux vérins de chaque côté de la mortaise
export const MIN_H = 15;                      // épaisseur minimale de la pièce posée
export const JOUE_MIN = 5;                    // joue (bois de chaque côté de la mortaise) : 5 mm au moins
export const VER_MARGE = 25;                  // un patin à moins de 25 mm de la course du bédane = « vérin devant le bédane »
export const SPEEDUP = 3;                     // animation du cycle 3 fois plus rapide que la machine
export const V_TETE = 0.06, V_TABLE = 0.12;   // vitesses réelles proposées : tête 60 mm/s, table 120 mm/s

/* bédanes du râtelier (épaisseur E = largeur de la mortaise ; largeur de coupe 20 mm) ; état : 'ok' ou 'ebreche' */
export const BEDANES = [
  { id:'b6',  E:6,  n:'Bédane 6 mm',  etat:'ok' },
  { id:'b8',  E:8,  n:'Bédane 8 mm',  etat:'ok' },
  { id:'b10a',E:10, n:'Bédane 10 mm n° 1', etat:'ebreche' },
  { id:'b10', E:10, n:'Bédane 10 mm n° 2', etat:'ok' },
  { id:'b12', E:12, n:'Bédane 12 mm', etat:'ok' },
  { id:'b16', E:16, n:'Bédane 16 mm', etat:'ok' },
];
export const bedById = id=>BEDANES.find(b=>b.id===id)||null;

/* bruit (engine/audio.js ; enregistrement d'une mortaiseuse à bédane oscillant fourni par l'enseignant le 30/10/2026, engine/sons/mortaise-*.mp3) :
   deux sources, dB(A) au poste PROPOSÉS, À VALIDER (sans mesure ; écarts relevés dans l'enregistrement : bédane à vide ≈ pompe + 16 dB,
   pompe qui force au serrage ≈ bédane − 5 dB, usinage ≈ bédane à vide + 3 dB) :
   groupe hydraulique (pompe) à vide 66, au serrage des vérins 77 ; bédane à vide 82, en usinage 88 (passe de référence : hêtre). */
export const BRUIT = { pompe:{ vide:66, coupe:77, rpm:1500 }, bed:{ vide:82, coupe:88, rpm:1500 } };
export const BRUIT_DURETE = { sapin:0.6, epicea:0.6, pin:0.7, meleze:0.8, frene:1, hetre:1, chene:1.25 };
export const SERRAGE_S = 2.2;                    // la pompe force pendant le serrage des vérins (s)
