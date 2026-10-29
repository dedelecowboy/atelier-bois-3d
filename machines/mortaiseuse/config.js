/* Configuration de la mortaiseuse : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page. */
export default {
  id: 'mortaiseuse',
  pageTitle: 'Mortaiseuse 3D',
  title: 'Mortaiseuse',
  canvasLabel: 'Modèle 3D d\'une mortaiseuse à bédane oscillant horizontal, à faire pivoter à la souris ou au doigt',
  info: { title: 'Mortaiseuse', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer.' },
  note: 'Machine fictive « KANAK 130 MB », d\'après la mortaiseuse à bédane horizontal de l\'atelier : bédane oscillant, table à mouvements hydrauliques (longueur : taquets de la table ; profondeur : taquets de côté, référence 71), quatre vérins de serrage commandés à deux mains, butées gauche et droite, capot interverrouillé. Proportions estimées.',
  parcoursTitle: 'Parcours évalué · mortaiseuse',

  modes: [
    { id: 'libre', label: 'Libre', title: 'Mortaisage libre',
      free: { k: 'Mortaisage libre', t: 'Montant de chêne corroyé 700 × 70 × 28, une chute d\'essai et une cale de 200 mm',
        c: 'Suivez la procédure : bédane (épaisseur), oscillation ou taquets de la table (longueur), taquets de côté (profondeur + 71), arasement (capot ouvert, clé de 27), taquets de la table (distance), vérins. Bouton vert, vérins en pression à deux mains, mode automatique, sélecteur du bédane sur 1. En manuel : bédane sur 1, « Plongée », « Table : taquet suivant ».' } },
    { id: 'bedane', label: 'Bédane', title: 'Changer le bédane (consignation)' },
    { id: 'simple', label: 'Mortaise', title: 'Mortaise simple à la cote' },
    { id: 'serie', label: 'Série', title: 'Série de mortaises en butée' },
  ],

  views: [
    { id: 'v34', label: '3/4', pos: [1.75,1.85,2.25], tgt: [0.0,0.92,-0.15] },
    { id: 'vop', label: 'Opérateur', title: 'Poste de travail, devant la table', pos: [0.05,1.62,1.35], tgt: [0.0,0.93,-0.05] },
    { id: 'vbed', label: 'Bédane', title: 'Vue rapprochée du bédane et de son porte-outil (capot translucide)', pos: [-0.22,1.16,0.32], tgt: [0.02,0.94,-0.16],
      xray: true, toast: 'Vue « Bédane » : vue intérieure activée, capot translucide. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vtable', label: 'Table', title: 'Vue de dessus de la table : pièce, vérins, butées', pos: [0.0,2.25,0.30], tgt: [0.0,0.92,0.0] },
    { id: 'vprof', label: 'Profondeur', title: 'Règle et taquets de profondeur, derrière le bâti à gauche', pos: [-1.05,1.10,-0.95], tgt: [-0.42,0.80,-0.35] },
    { id: 'vpup', label: 'Pupitre', title: 'Tableau de commande', pos: [0.55,1.85,0.35], tgt: [0.30,1.50,-0.34] },
    { id: 'vint', label: 'Intérieur', hidden: true, pos: [0.80,1.25,1.10], tgt: [0.0,0.95,-0.35] },
  ],

  xray: { parts: [['capot',0.12],['bati',0.25],['armoire',0.3],['portique',0.25],['verin_v',0.3]], cam: { pos: [0.80,1.25,1.10], tgt: [0.0,0.95,-0.35] } },

  scorm: {
    code: 'MORTAISE',            // préfixe des traces Moodle (interactions, objectif)
    title: 'KANAK 130 MB · Mortaiseuse · Parcours évalué',
    zip: 'KANAK130MB_mortaiseuse_SCORM12.zip',
    identifier: 'KANAK130MB_MORTAISEUSE_PARCOURS',
    orgTitle: 'Mortaiseuse KANAK 130 MB – Parcours évalué',
    itemTitle: 'Mortaiseuse : fiches, repérage, QCM sécurité, changer le bédane, mortaise à la cote, série en butée',
  },
};
