/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Configuration de la déligneuse multilames : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page. */
export default {
  id: 'deligneuse',
  pageTitle: 'Déligneuse multilames 3D',
  title: 'Déligneuse multilames',
  canvasLabel: 'Modèle 3D d\'une déligneuse multilames, à faire pivoter à la souris ou au doigt',
  info: { title: 'Déligneuse multilames', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer.' },
  note: 'Machine fictive « KANAK 300 M », d\'après une déligneuse multilames à tapis de 300 mm (arbre au-dessus du tapis, lames Ø 300, 4 200 tr/min, avance 6 à 48 m/min). Proportions intérieures estimées. La déligneuse refend le bois massif dans le sens du fil, aux largeurs brutes : les pièces passent ensuite à la dégauchisseuse et à la raboteuse.',
  parcoursTitle: 'Parcours évalué · déligneuse',

  modes: [
    { id: 'libre', label: 'Libre', title: 'Délignage libre',
      free: { k: 'Délignage libre', t: 'Plateau d\'épicéa 2 000 × 30 mm, rives en flache',
        c: 'Choisissez le manchon (lames à l\'arrêt), réglez le guide, les presseurs et la vitesse d\'avance, placez la pièce avec les outils ci-dessous, puis « Engager la pièce ». Les pièces sorties sont rangées dans « Pièces débitées » : « Reprendre » remet une pièce à l\'entrée pour une nouvelle passe.' } },
    { id: 'avive', label: 'Avivés', title: 'Délignage d\'avivés au guide' },
    { id: 'plot', label: 'Plot', title: 'Délignage d\'un plateau de plot (flache) au laser' },
    { id: 'multi', label: 'Multilames', title: 'Multidélignage : 4 tasseaux en une passe' },
  ],

  views: [
    { id: 'v34', label: '3/4', pos: [3.3,2.05,2.55], tgt: [0.35,0.78,0] },
    { id: 'vop', label: 'Entrée', title: 'Poste de l\'opérateur, à l\'entrée de la machine', pos: [2.55,1.62,0.85], tgt: [0.35,0.86,-0.05] },
    { id: 'vtop', label: 'Dessus', pos: [1.05,3.3,0.2], tgt: [1.05,0.75,0] },
    { id: 'vlames', label: 'Lames', title: 'Vue rapprochée des lames, des presseurs et des linguets', pos: [0.82,1.16,-0.98], tgt: [0.0,0.84,0.02],
      xray: true, toast: 'Vue « Lames » : vue intérieure activée, capot translucide. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vsortie', label: 'Sortie', title: 'Côté sortie des pièces', pos: [-2.6,1.6,1.7], tgt: [-0.5,0.85,0] },
    { id: 'vent', label: 'Rapprochée', hidden: true, pos: [1.35,1.05,0.55], tgt: [0.42,0.82,0] },   // ouverture d'entrée, de près
  ],

  xray: { parts: [['capot',0.12],['bati',0.15]], cam: { pos: [1.3,1.25,1.9], tgt: [0,0.75,0] } },

  scorm: {
    code: 'DELIGNEUSE',          // préfixe des traces Moodle (interactions, objectif)
    title: 'KANAK 300 M · Déligneuse multilames · Parcours évalué',
    zip: 'KANAK300M_deligneuse_SCORM12.zip',
    identifier: 'KANAK300M_DELIGNEUSE_PARCOURS',
    orgTitle: 'Déligneuse multilames KANAK 300 M – Parcours évalué',
    itemTitle: 'Déligneuse : repérage, QCM sécurité, avivés, plot, multidélignage',
  },
};
