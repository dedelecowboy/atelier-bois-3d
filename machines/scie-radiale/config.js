/* Configuration de la scie radiale : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page. */
export default {
  id: 'scie-radiale',
  pageTitle: 'Scie radiale 3D',
  title: 'Scie radiale',
  canvasLabel: 'Modèle 3D d\'une scie radiale de tronçonnage, à faire pivoter à la souris ou au doigt',
  info: { title: 'Scie radiale', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer.' },
  note: 'Machine fictive « KANAK 900 R », d\'après une scie radiale de débit : lame Ø 400, 4 kW, 3 000 tr/min, capacité 900 × 120 mm, bras orientable ±45°, lame inclinable 0 à 45°, table à 900 mm. Proportions intérieures estimées. La scie radiale tronçonne les planches brutes à longueur et purge leurs défauts : les pièces passent ensuite à la déligneuse.',
  parcoursTitle: 'Parcours évalué · scie radiale',

  modes: [
    { id: 'libre', label: 'Libre', title: 'Tronçonnage libre',
      free: { k: 'Tronçonnage libre', t: 'Plateau de chêne 2 000 × 200 × 27 mm, avec défauts',
        c: 'Réglez la machine (lame arrêtée pour l\'angle du bras et l\'inclinaison), placez la planche avec les outils ci-dessous, tenez-la de la main gauche hors de la zone rouge, puis « Tirer la lame ». Ramenez toujours la lame en arrière avant de toucher aux pièces. Les pièces évacuées vont dans « Pièces débitées » : « Reprendre » remet une pièce sur la table.' } },
    { id: 'serie', label: 'Série', title: 'Tronçonnage à longueur en série, à la butée' },
    { id: 'purge', label: 'Purge', title: 'Purge des défauts : fente en bout, nœud, gerce' },
    { id: 'biais', label: 'Biais', title: 'Coupe inclinée à 45° : lames de bardage à bouts biais' },
  ],

  views: [
    { id: 'v34', label: '3/4', pos: [2.35,2.15,2.75], tgt: [0.05,1.02,-0.25] },
    { id: 'vop', label: 'Opérateur', title: 'Poste de l\'opérateur, devant la machine', pos: [-0.62,1.78,1.55], tgt: [0.05,0.93,-0.30] },
    { id: 'vtop', label: 'Dessus', pos: [-0.30,3.30,1.05], tgt: [-0.05,0.90,-0.12] },
    { id: 'vlame', label: 'Lame', title: 'Vue rapprochée de la lame, du carter et du protecteur', pos: [0.78,1.30,0.62], tgt: [0.0,1.06,-0.45],
      xray: true, toast: 'Vue « Lame » : vue intérieure activée, carter et bras translucides. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vbutee', label: 'Butée', title: 'Côté sortie des pièces : table de sortie et butée de longueur', pos: [1.75,1.65,1.35], tgt: [0.85,0.92,-0.30] },
    { id: 'vcol', label: 'Colonne', hidden: true, pos: [1.25,2.15,0.55], tgt: [0.0,1.55,-0.55] },   // colonne, console et réglages du bras, de près
  ],

  xray: { parts: [['carter',0.14],['bras',0.16],['protecteur',0.25]], cam: { pos: [0.95,1.55,0.35], tgt: [0.0,1.25,-0.55] } },

  scorm: {
    title: 'KANAK 900 R · Scie radiale · Parcours évalué',
    zip: 'KANAK900R_scie_radiale_SCORM12.zip',
    identifier: 'KANAK900R_SCIE_RADIALE_PARCOURS',
    orgTitle: 'Scie radiale KANAK 900 R – Parcours évalué',
    itemTitle: 'Scie radiale : repérage, QCM sécurité, débit en série, purge des défauts, coupe inclinée',
  },
};
