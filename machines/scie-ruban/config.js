/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Configuration de la scie à ruban : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page. */
export default {
  id: 'scie-ruban',
  pageTitle: 'Scie à ruban 3D',
  title: 'Scie à ruban',
  canvasLabel: 'Modèle 3D d\'une scie à ruban de menuiserie, à faire pivoter à la souris ou au doigt',
  info: { title: 'Scie à ruban', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer.' },
  note: 'Machine fictive « KANAK 800 RB », de synthèse d\'après des scies à ruban de menuiserie : volants Ø 800, moteur-frein 5,5 kW, lame de 5,5 m, épaisseur 0,8 mm au plus, vitesse de coupe environ 25 m/s, hauteur de passage 500 mm, table 1 100 × 850 mm inclinable à 45°. Proportions estimées. La scie à ruban chantourne les pièces cintrées, refend et débite les pièces de forme.',
  parcoursTitle: 'Parcours évalué · scie à ruban',

  modes: [
    { id: 'libre', label: 'Libre', title: 'Travail libre',
      free: { k: 'Travail libre', t: 'Panneau de hêtre 400 × 300 × 27 mm tracé (rayon 100 mm)',
        c: 'Réglez la machine lame arrêtée (lame, tension, guide-lames, protecteur au plus près de la pièce). Présentez la pièce, démarrez la lame, puis « Avance » et ↺ ↻ (ou les flèches du clavier) pour suivre le trait (ou contre le guide parallèle, ou au guide d\'onglet). Poussoir en fin de passe ; arrêt complet avant de dégager une chute à la main. « Rupture de la lame » montre la conduite à tenir.' } },
    { id: 'lame', label: 'Lame', title: 'Changer la lame et régler la machine' },
    { id: 'chant', label: 'Chantourner', title: 'Chantourner une pièce suivant un tracé' },
    { id: 'refente', label: 'Refendre', title: 'Refendre un avivé au guide parallèle' },
  ],

  views: [
    { id: 'v34', label: '3/4', pos: [3.05,2.20,3.75], tgt: [-0.05,1.20,-0.10] },
    { id: 'vop', label: 'Opérateur', title: 'Poste de l\'opérateur, devant la table', pos: [0.42,1.86,1.62], tgt: [0.0,1.02,-0.02] },
    { id: 'vtable', label: 'Table', title: 'Table vue d\'au-dessus : la lame, la pièce, le guide parallèle', pos: [0.06,2.20,0.80], tgt: [0.03,0.96,0.04] },
    { id: 'vguide', label: 'Guide-lame', title: 'Guide-lame supérieur et protecteur, de près', pos: [0.34,1.30,0.42], tgt: [0.0,1.07,-0.03] },
    { id: 'vvol', label: 'Volants', title: 'Volants et lame derrière les portes (portes translucides)', pos: [-0.20,1.40,3.0], tgt: [-0.40,1.25,0.0],
      xray: true, toast: 'Vue « Volants » : vue intérieure activée, portes et bâti translucides. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vcol', label: 'Colonne', hidden: true, pos: [-0.30,1.40,1.20], tgt: [-0.82,1.25,0.05] },   // commandes, indicateur, sectionneur, de près
    { id: 'varr', label: 'Arrière', hidden: true, pos: [0.90,1.80,-1.70], tgt: [-0.40,1.30,-0.20] },  // dévers, moteur, aspiration
  ],

  xray: { parts: [['porte_sup',0.12],['porte_inf',0.12],['bati',0.30],['carter_montant',0.2]], cam: { pos: [-0.20,1.40,3.0], tgt: [-0.40,1.25,0.0] } },

  scorm: {
    code: 'RUBAN',
    title: 'KANAK 800 RB · Scie à ruban · Parcours évalué',
    zip: 'KANAK800RB_scie_ruban_SCORM12.zip',
    identifier: 'KANAK800RB_SCIE_RUBAN_PARCOURS',
    orgTitle: 'Scie à ruban KANAK 800 RB – Parcours évalué',
    itemTitle: 'Scie à ruban : repérage, QCM sécurité, changement et réglage de la lame, chantournage, refente',
  },
};
