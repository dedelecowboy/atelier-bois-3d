/* Configuration de la raboteuse : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page. */
export default {
  id: 'raboteuse',
  pageTitle: 'Raboteuse 3D',
  title: 'Raboteuse',
  canvasLabel: 'Modèle 3D d\'une raboteuse, à faire pivoter à la souris ou au doigt',
  info: { title: 'Raboteuse', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer.' },
  note: 'Machine fictive « KANAK 630 E », d\'après une raboteuse de 630 mm à commande électronique de la cote (arbre Ø 125 à 4 lames, 5 000 tr/min, 5,5 kW, cote 2,8 à 300 mm, avance 5 à 25 m/min, aspiration Ø 160). Proportions intérieures estimées. La raboteuse vient après la dégauchisseuse : elle met la pièce à largeur d\'abord (sur chant, SR2 sur la table, plus stable), puis à épaisseur (à plat, SR1 sur la table). Contrôle au pied à coulisse, au dixième.',
  parcoursTitle: 'Parcours évalué · raboteuse',

  modes: [
    { id: 'libre', label: 'Libre', title: 'Rabotage libre',
      free: { k: 'Rabotage libre', t: 'Avivé de sapin 1 000 × 120 × 33 dégauchi, et une cale de 230 mm',
        c: 'Posez la face de référence sur la table (outils ci-dessous), réglez la cote et la vitesse d\'avance, démarrez le moteur puis l\'avance, et « Engager la pièce ». Les pièces rabotées sont reposées sur le capot par l\'aide en sortie : « Ramener la pièce » les remet à l\'entrée, « Mettre de côté » les range dans « Pièces débitées » ; « Reprendre » remet une pièce sur la table, à côté des autres. La cale de 230 mm est plus courte que l\'entraxe des rouleaux.' } },
    { id: 'lar', label: 'Largeur', title: 'Mise à largeur d\'une traverse sur chant (en premier)' },
    { id: 'ep', label: 'Épaisseur', title: 'Mise à épaisseur de deux montants (après la largeur)' },
    { id: 'controle', label: 'Contrôle', title: 'Contrôle du lot (pièce non dégauchie) et fil incliné' },
  ],

  views: [
    { id: 'v34', label: '3/4', pos: [2.45,1.85,2.3], tgt: [-0.2,0.85,0] },
    { id: 'vop', label: 'Entrée', title: 'Poste de l\'opérateur, à l\'entrée de la machine', pos: [2.15,1.70,0.95], tgt: [0.35,1.0,-0.05] },
    { id: 'vtop', label: 'Dessus', pos: [-0.35,3.9,0.25], tgt: [-0.35,0.95,0] },
    { id: 'varbre', label: 'Arbre', title: 'Vue de côté de l\'arbre, des rouleaux, des presseurs et des linguets', pos: [0.32,1.30,0.92], tgt: [0.0,1.0,0.0],
      xray: true, toast: 'Vue « Arbre » : vue intérieure activée, bâti et capot translucides. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vsortie', label: 'Sortie', title: 'Côté sortie et rallonge de 1 200 mm', pos: [-3.1,1.75,1.75], tgt: [-0.75,0.95,0] },
    { id: 'vrep', label: 'Rapprochée', hidden: true, pos: [1.05,1.14,0.42], tgt: [0.22,1.0,0] },   // ouverture d'entrée, de près
  ],

  xray: { parts: [['bati',0.12],['capot',0.15]], cam: { pos: [0.9,1.35,1.75], tgt: [0,0.95,0] } },

  scorm: {
    title: 'KANAK 630 E · Raboteuse · Parcours évalué',
    zip: 'KANAK630E_raboteuse_SCORM12.zip',
    identifier: 'KANAK630E_RABOTEUSE_PARCOURS',
    orgTitle: 'Raboteuse KANAK 630 E – Parcours évalué',
    itemTitle: 'Raboteuse : repérage, QCM sécurité, largeur, épaisseur, contrôle du lot',
  },
};
