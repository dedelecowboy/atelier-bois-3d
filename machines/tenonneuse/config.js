/* Configuration de la tenonneuse : textes de l'interface, modes, vues, paquetage SCORM.
   Fichier sans dépendance : lu à la fabrication (squelette HTML) et dans la page. */
export default {
  id: 'tenonneuse',
  pageTitle: 'Tenonneuse 3D',
  title: 'Tenonneuse',
  canvasLabel: 'Modèle 3D d\'une tenonneuse à dérouleurs, à faire pivoter à la souris ou au doigt',
  info: { title: 'Tenonneuse', text: 'Faites glisser pour tourner, molette ou pincement pour zoomer.' },
  note: 'Machine fictive « KANAK 160 TN », d\'après la tenonneuse simple de l\'atelier : chariot roulant à presse-pièce pneumatique, guide orientable avec butée de longueur d\'arasement, scie d\'affranchissement, dérouleurs supérieur et inférieur, unité de toupillage (enfourchement), capot de protection interverrouillé, filin de sécurité. Proportions estimées. Les tenons biais (guide orienté) et le contre-profil ne sont pas simulés.',
  parcoursTitle: 'Parcours évalué · tenonneuse',

  modes: [
    { id: 'libre', label: 'Libre', title: 'Tenonnage libre',
      free: { k: 'Tenonnage libre', t: 'Traverses de chêne corroyées 600 × 70 × 27, une cale de 180 mm',
        c: 'Réglez la scie (longueur du tenon), les dérouleurs (hauteur de la joue, épaisseur), l\'unité de toupillage, la butée, le pare-éclat et le protecteur, outils arrêtés. Serrez la pièce, mains sur la poignée, « Pousser le chariot », puis « Ramener le chariot ». Le bout usiné s\'affiche à droite, en coupe et en cotes.' } },
    { id: 'tenon', label: 'Tenon simple', title: 'Tenon simple sur une traverse corroyée' },
    { id: 'serie', label: 'Série', title: 'Série de traverses tenonnées aux deux bouts' },
    { id: 'enfourchement', label: 'Enfourchement', title: 'Enfourchements, machine et lot à contrôler' },
  ],

  views: [
    { id: 'v34', label: '3/4', pos: [2.05,2.05,2.85], tgt: [-0.45,0.95,0.15] },
    { id: 'vop', label: 'Opérateur', title: 'Poste de chargement, derrière le chariot', pos: [1.55,1.70,1.85], tgt: [0.20,0.92,0.35] },
    { id: 'voutil', label: 'Outils', title: 'Vue rapprochée de la scie, des dérouleurs et de l\'unité de toupillage (capot et carters translucides)', pos: [-0.30,1.20,1.05], tgt: [-0.50,0.92,-0.12],
      xray: true, toast: 'Vue « Outils » : vue intérieure activée, capot et carters translucides. Recliquez « Vue intérieure » pour revenir.' },
    { id: 'vchariot', label: 'Chariot', title: 'Vue de dessus du chariot : guide, pare-éclat, presse-pièce, butée de longueur', pos: [0.36,2.45,0.62], tgt: [0.36,0.86,0.60] },
    { id: 'vtenon', label: 'Bout', title: 'Bout usiné de la pièce, chariot en position de chargement', pos: [0.86,1.02,-0.30], tgt: [0.47,0.88,-0.03] },
    { id: 'vpup', label: 'Pupitre', title: 'Tableau de commande, boîtier du filin de sécurité', pos: [0.55,1.38,1.05], tgt: [0.02,1.10,0.10] },
    { id: 'vint', label: 'Intérieur', hidden: true, pos: [0.70,1.10,1.70], tgt: [-0.55,0.70,-0.40] },
  ],

  xray: { parts: [['bati',0.12],['capot',0.10],['carters',0.18],['aspiration',0.15],['protecteur',0.5]], cam: { pos: [0.70,1.10,1.70], tgt: [-0.55,0.70,-0.40] } },

  scorm: {
    title: 'KANAK 160 TN · Tenonneuse · Parcours évalué',
    zip: 'KANAK160TN_tenonneuse_SCORM12.zip',
    identifier: 'KANAK160TN_TENONNEUSE_PARCOURS',
    orgTitle: 'Tenonneuse KANAK 160 TN – Parcours évalué',
    itemTitle: 'Tenonneuse : repérage, QCM sécurité, tenon simple, série aux deux bouts, enfourchement',
  },
};
