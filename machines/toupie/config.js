/* Configuration de la toupie : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page. */
export default {
  id: 'toupie',
  pageTitle: 'Toupie 3D',
  title: 'Toupie',
  canvasLabel: 'Modèle 3D d\'une toupie, à faire pivoter à la souris ou au doigt',
  info: { title: 'Toupie', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer.' },
  note: 'Machine fictive « KANAK 130 T », d\'après la toupie de l\'atelier : arbre fixe Ø 30 (non inclinable), hauteur réglée au pupitre électronique, 4 vitesses par poulies étagées (4 000, 6 000, 7 000, 9 000 tr/min), inverseur ↺ 0 ↻, frein, guide à lamelles avec capot d\'aspiration, protège-mains à presseurs, entraîneur à 4 rouleaux. Proportions estimées. Lot 1 : travail au guide ; le travail à l\'arbre, le tenonnage et l\'entraîneur viendront au lot 2.',
  parcoursTitle: 'Parcours évalué · toupie',

  modes: [
    { id: 'libre', label: 'Libre', title: 'Travail au guide libre',
      free: { k: 'Toupillage libre', t: 'Avivé de sapin corroyé 1 000 × 70 × 27, une cale de 220 mm et un frêne au fil incliné',
        c: 'Choisissez l\'outil (machine consignée, arbre verrouillé), la vitesse, la hauteur, la saillie, les demi-guides, les lamelles et les presseurs, puis « Passer la pièce ». La pièce sortie : « Ramener la pièce » pour une autre passe, « Mettre de côté » pour la ranger ; « Reprendre » une pièce de « Pièces débitées ». Le profil obtenu s\'affiche à droite, en coupe.' } },
    { id: 'quart', label: 'Quart de rond', title: 'Quart de rond R 10 sur une traverse corroyée' },
    { id: 'feuillure', label: 'Feuillure', title: 'Feuillure 12 × 15 en deux passes' },
    { id: 'serie', label: 'Série', title: 'Série de baguettes moulurées, machine et lot à contrôler' },
  ],

  views: [
    { id: 'v34', label: '3/4', pos: [1.95,1.80,2.25], tgt: [0,0.95,0] },
    { id: 'vop', label: 'Opérateur', title: 'Poste de l\'opérateur, devant la table', pos: [0.95,1.58,1.35], tgt: [0,0.92,0.05] },
    { id: 'voutil', label: 'Outil', title: 'Vue rapprochée de l\'outil, du guide et des presseurs (capot translucide)', pos: [-0.14,1.00,0.38], tgt: [0.0,0.885,0.03],
      xray: true, toast: 'Vue « Outil » : vue intérieure activée, capot du guide translucide. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vdessus', label: 'Guide', title: 'Vue de dessus du guide, des lamelles et de l\'outil (capot translucide)', pos: [0.0,1.80,0.13], tgt: [0,0.87,0.06],
      xray: true, toast: 'Vue de dessus du guide : capot translucide. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vsortie', label: 'Sortie', title: 'Côté sortie : le bout de la pièce usinée montre le profil', pos: [-1.62,1.08,0.42], tgt: [-1.05,0.89,0.08] },
    { id: 'vpup', label: 'Pupitre', title: 'Pupitre de commande, verrouillage de l\'arbre et sectionneur', pos: [0.62,0.92,1.10], tgt: [0.12,0.68,0.30] },
    { id: 'vint', label: 'Intérieur', hidden: true, pos: [0.85,0.75,1.25], tgt: [-0.08,0.45,0] },
  ],

  xray: { parts: [['bati',0.12],['porte',0.12],['capot_guide',0.18],['aspiration',0.15],['presseur_v',0.6],['presseur_h',0.6]], cam: { pos: [0.85,0.85,1.30], tgt: [-0.08,0.50,0] } },

  scorm: {
    code: 'TOUPIE',          // préfixe des traces Moodle (interactions, objectif)
    title: 'KANAK 130 T · Toupie · Parcours évalué',
    zip: 'KANAK130T_toupie_SCORM12.zip',
    identifier: 'KANAK130T_TOUPIE_PARCOURS',
    orgTitle: 'Toupie KANAK 130 T – Parcours évalué',
    itemTitle: 'Toupie (travail au guide) : repérage, QCM sécurité, quart de rond, feuillure, série',
  },
};
