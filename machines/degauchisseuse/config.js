/* Configuration de la dégauchisseuse : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page. */
export default {
  id: 'degauchisseuse',
  pageTitle: 'Dégauchisseuse 3D',
  title: 'Dégauchisseuse',
  canvasLabel: 'Modèle 3D d\'une dégauchisseuse, à faire pivoter à la souris ou au doigt',
  info: { title: 'Dégauchisseuse', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer.' },
  note: 'Machine fictive « KANAK 520 D », d\'après une dégauchisseuse de 520 mm à protecteur SUVAMATIC et arbre à 4 fers. Proportions intérieures estimées. Le dégauchissage dresse la face de référence (SR1) puis le chant de référence (SR2) d\'équerre : c\'est le début du corroyage, qui se poursuit à la raboteuse.',
  parcoursTitle: 'Parcours évalué · dégauchisseuse',

  modes: [
    { id: 'libre', label: 'Libre', title: 'Dégauchissage libre',
      free: { k: 'Dégauchissage libre', t: 'Planche de chêne 1 000 × 140 × 27',
        c: 'Placez la pièce avec les outils ci-dessous, réglez la machine, orientez le bec du protecteur (horizontal à plat, vertical sur chant), puis lancez la passe. Ramenez la pièce en la soulevant après chaque passe. Le tableau « Faces de la pièce » indique l\'état de chaque face.' } },
    { id: 'rect', label: 'Rectiligne', title: 'Pièce rectiligne : SR1 puis SR2' },
    { id: 'courbe', label: 'Cintrée', title: 'Pièce cintrée sur le plat' },
    { id: 'fil', label: 'Fil incliné', title: 'Pièce au fil incliné : sens d\'usinage' },
  ],

  views: [
    { id: 'v34', label: '3/4', pos: [2.3,1.75,2.2], tgt: [-0.05,0.72,0] },
    { id: 'vop', label: 'Opérateur', pos: [1.85,1.5,0.95], tgt: [-0.15,0.86,-0.05] },
    { id: 'vtop', label: 'Dessus', pos: [0.01,3.0,0.25], tgt: [0,0.86,0] },
    { id: 'varbre', label: 'Arbre', title: 'Vue rapprochée de l\'arbre porte-outils', pos: [-0.50,1.02,0.50], tgt: [0,0.80,0],
      xray: true, toast: 'Vue « Arbre » : vue intérieure activée, tables translucides. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vrep', label: 'Rapprochée', hidden: true, pos: [0.30,1.40,-0.80], tgt: [0,0.86,-0.18] },   // de dessus, derrière le guide
  ],

  xray: { parts: [['bati',0.1],['table_entree',0.3],['table_sortie',0.3]], cam: { pos: [1.3,1.0,1.9], tgt: [0,0.55,0] } },

  scorm: {
    title: 'KANAK 520 D · Dégauchisseuse · Parcours évalué',
    zip: 'KANAK520D_degauchisseuse_SCORM12.zip',
    identifier: 'KANAK520D_DEGAUCHISSEUSE_PARCOURS',
    orgTitle: 'Dégauchisseuse KANAK 520 D – Parcours évalué',
    itemTitle: 'Dégauchisseuse : repérage, QCM sécurité, SR1 et SR2',
  },
};
