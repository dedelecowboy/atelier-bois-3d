/* Configuration de la scie à format : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page. */
export default {
  id: 'scie-format',
  pageTitle: 'Scie à format 3D',
  title: 'Scie à format',
  canvasLabel: 'Modèle 3D d\'une scie à format, à faire pivoter à la souris ou au doigt',
  info: { title: 'Scie circulaire à format', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer.' },
  note: 'Silhouette reconstruite d\'après une photo. Cotes et caractéristiques reprises de la documentation constructeur (brochure kappa 550, notice kappa 30/40) : règle 3 200 mm, table coulissante 1 250 × 650 mm, guide parallèle 1 200 mm, moteur 7,35 kW. L\'intérieur suit l\'architecture décrite dans ces documents, avec des proportions estimées. La vitesse de coupe Vc est calculée pour la lame Ø 400.',
  parcoursTitle: 'Parcours évalué · scie à format',

  /* modes d'exercice ; le premier est celui affiché au démarrage */
  modes: [
    { id: 'libre', label: 'Libre', title: 'Coupe libre',
      free: { k: 'Coupe libre', t: 'Planche de chêne 1 050 × 300 × 22',
        c: 'Placez la pièce avec les outils ci-dessous, réglez la machine et lancez la passe. Chaque coupe complète sépare la pièce ; les chants sciés sont repérés A, B, C…' } },
    { id: 'format', label: 'Format', title: 'Mise au format d\'un panneau' },
    { id: 'planche', label: 'Délignage', title: 'Délignage d\'une planche brute' },
    { id: 'inciseur', label: 'Inciseur', title: 'Mélaminé et inciseur', btnId: 'inc' },
  ],

  /* vues caméra (la première est la vue de départ) ; hidden = sans bouton (utilisée par le repérage) */
  views: [
    { id: 'v34', label: '3/4', pos: [3.9,2.7,4.4], tgt: [-0.15,0.75,0.35] },
    { id: 'vop', label: 'Opérateur', pos: [3.6,1.75,1.2], tgt: [-0.2,0.9,0.2] },
    { id: 'vtop', label: 'Dessus', pos: [0.01,6.2,0.6], tgt: [0,0.9,0.5] },
    { id: 'vblade', label: 'Lames', title: 'Vue rapprochée de la lame et de l\'inciseur', pos: [0.12,1.25,-0.55], tgt: [0.12,0.86,0.255],
      xray: true, toast: 'Vue « Lames » : vue intérieure activée, table translucide. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vrep', label: 'Rapprochée', hidden: true, pos: [0.75,1.3,-0.75], tgt: [0.12,0.86,0.255] },
  ],

  /* vue intérieure : organes rendus translucides (opacité) et position de caméra */
  xray: { parts: [['bati',0.1],['table',0.3]], cam: { pos: [0.9,1.0,-3.3], tgt: [0.05,0.48,0.0] } },

  /* paquetage SCORM 1.2 */
  scorm: {
    title: 'KANAK 550 · Scie à format · Parcours évalué',
    zip: 'KANAK550_scie_format_SCORM12.zip',
    identifier: 'KANAK550_SCIE_FORMAT_PARCOURS',
    orgTitle: 'Scie à format KANAK 550 – Parcours évalué',
    itemTitle: 'Scie à format : repérage, QCM sécurité, mise au format',
  },
};
