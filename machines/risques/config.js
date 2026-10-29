/* Configuration du module « Risques généraux de l'atelier bois » : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page.
   La scène est la salle de l'atelier menuiserie (plan réel, atelier/plan.js) : repère de la salle, mètres,
   centre en (0, 0), X vers la droite du plan, Z vers le bas du plan (mur des portes en z = −10,8). */
export default {
  id: 'risques',
  pageTitle: 'Risques généraux de l\'atelier bois 3D',
  title: 'Risques généraux',
  canvasLabel: 'Vue 3D de l\'atelier menuiserie, à faire pivoter à la souris ou au doigt',
  info: { title: 'Atelier menuiserie', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer. Touchez un équipement pour le voir.' },
  note: 'Atelier du lycée d\'après le plan réel de la salle. Les emplacements des équipements de sécurité (extincteurs, armoire électrique, trousse de secours…) sont proposés : à vérifier sur le plan d\'évacuation affiché dans l\'atelier.',
  parcoursTitle: 'Parcours évalué · risques généraux',

  /* grande scène : toute la salle (21,9 × 21,6 m) */
  stage: { fov: 36, near: 0.1, far: 140, minDistance: 1.2, maxDistance: 48, maxPolar: Math.PI*0.47, sun: [-6,16,9], shadow: { ext: 15, size: 2048, far: 50 }, floor: false },

  modes: [
    { id: 'libre', label: 'Visite', title: 'Visite libre de l\'atelier',
      free: { k: 'Visite libre', t: 'L\'atelier menuiserie et ses équipements de sécurité',
        c: 'Faites le tour de l\'atelier : touchez un équipement (ou choisissez-le dans la liste à gauche) pour savoir à quoi il sert. Les fiches « Risques » à droite résument les règles ; le bouton « Voir dans l\'atelier » d\'une fiche montre les équipements dont elle parle.' } },
    { id: 'dangers', label: 'Dangers', title: 'Repérer les dangers dans l\'atelier' },
    { id: 'epi', label: 'EPI', title: 'Choisir ses équipements de protection individuelle avant une tâche' },
    { id: 'consignation', label: 'Consignation', title: 'Consigner une machine avant d\'intervenir, puis la déconsigner' },
    { id: 'feu', label: 'Départ de feu', title: 'Réagir à un départ de feu' },
  ],

  views: [
    { id: 'v34', label: 'Ensemble', title: 'Vue d\'ensemble de l\'atelier', pos: [3,22,23], tgt: [0,0,-0.3] },
    { id: 'vtop', label: 'Plan', title: 'Vue de dessus, comme le plan d\'évacuation', pos: [0,34,0.5], tgt: [0,0,0] },
    { id: 'vportes', label: 'Portes', title: 'Le mur des portes : issues, extincteurs, consignes', pos: [-1.5,5.5,-1.5], tgt: [-1.5,1.4,-10.6] },
    { id: 'velec', label: 'Électricité', title: 'Armoire électrique et arrêt d\'urgence général', pos: [-5.6,3.6,-1.6], tgt: [-10.7,1.3,-1.6] },
    { id: 'vsecours', label: 'Secours', title: 'Trousse de secours, lave-œil, numéros d\'urgence', pos: [6.2,2.3,-6.4], tgt: [6.2,1.4,-10.6] },
    { id: 'vproduits', label: 'Produits', title: 'Armoire de sécurité des produits', pos: [6.4,2.6,5.2], tgt: [10.6,1.0,5.5] },
    { id: 'vetablis', label: 'Établis', title: 'Zone de montage et de finition : établis, poubelle à chiffons, aspirateur', pos: [6.6,3.0,6.0], tgt: [6.8,0.7,9.9] },
    { id: 'vmachine', label: 'Scie à format', title: 'Poste de la scie à format (consignation)', pos: [4.4,3.0,4.6], tgt: [2.6,0.95,7.2] },
    { id: 'vposte', label: 'Poste', hidden: true, pos: [3,3,3], tgt: [0,1,0] },   // placée par le module (avatar, départ de feu)
  ],

  xray: { parts: [] },

  scorm: {
    code: 'RISQUES',          // préfixe des traces Moodle (interactions, objectif)
    title: 'Risques généraux de l\'atelier bois · Parcours évalué',
    zip: 'Risques_generaux_atelier_bois_SCORM12.zip',
    identifier: 'RISQUES_GENERAUX_ATELIER_BOIS',
    orgTitle: 'Risques généraux de l\'atelier bois – Parcours évalué',
    itemTitle: 'Risques généraux : repérage, QCM, dangers, EPI, consignation, départ de feu',
  },
};
