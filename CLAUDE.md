# Consignes pour Claude – atelier-bois-3d

À lire en entier avant toute modification. Ce fichier garde ce que l'enseignant (Julien ANDRE, métiers du bois) a corrigé ou décidé : ne pas le contredire sans lui demander.

## Le projet

Simulateurs 3D web de machines à bois pour élèves de bac pro (et BTS DRB). Objectif : un atelier virtuel, une machine par module, chaque machine livrée aussi en paquetage SCORM 1.2 pour Moodle (une note par machine ; le déverrouillage progressif se fait par les restrictions d'accès Moodle). Une page « atelier » 3D servira d'entrée visuelle.

Langue de l'interface et des messages : français. Consignes simples et directes, niveau bac pro.

## Organisation actuelle

- `machines/scie-format/scie-format.html` : la scie à format, fichier HTML autonome (three.js par importmap depuis cdn.jsdelivr.net, three@0.160.0 ; logo du lycée en webp base64 dans `.stage::before`). Publiée aussi comme artifact claude.ai : https://claude.ai/artifact/5TrWcgiDVbvMBYtp78Sc6E (republier à cette URL, ne pas en créer une autre).
- `machines/scie-format/build_scorm.py` : fabrique le paquetage SCORM (copie three dans `lib/`, réécrit l'importmap, ajoute `window.PARCOURS=true`, zippe avec `imsmanifest.xml`). Prérequis : `npm install`.
- `tests/` : scénarios Playwright headless (chromium + swiftshader) qui jouent les exercices de bout en bout.

Étape suivante prévue : extraire un moteur commun (rendu, vues, sélection, alertes, étapes, parcours, SCORM, tests) et ne garder dans chaque machine que le modèle, les réglages, les règles et les données (organes, QCM, scénarios). Les QCM et listes d'organes doivent finir dans des fichiers de données lisibles que l'enseignant peut corriger lui-même. Ordre des machines envisagé : dégauchisseuse, raboteuse, scie à ruban, toupie.

## Scie à format : conventions géométriques

- Unités : mètres dans la scène, millimètres dans l'interface.
- X = sens d'avance. L'opérateur est côté +X ; la pièce avance vers −X.
- Chariot côté +Z (SLIDER_Z = 0.465) ; table fixe, guide parallèle et rallonge côté −Z.
- Plan de lame z = BLADE_Z = 0.255 ; TABLE_Y = 0.90 ; rayon de lame R = 0.2 (Ø 400).
- Trait de lame MAIN_KERF = 4,4 mm ; KERF = demi-trait (0.0022).
- Position du chariot : SLIDER_HOME + st.s/1000, st.s de −1500 à 1500.
- Pièces : polygones convexes en coordonnées locales (u, v) avec theta, flip, tx, tz ; découpe par clipHalf (Sutherland-Hodgman), métadonnées par chant {sawn, label, chips}, bandes de flache.

## Scie à format : règles validées par l'enseignant (ne pas régresser)

- Couteau diviseur DERRIÈRE la lame. Fixation du guide parallèle du bon côté ; la règle du guide est en miroir par rapport à son bloc de serrage.
- Sens de rotation : les dents du haut vont vers l'opérateur (+X). `blade.rotation.z -= w`, disque en miroir (scale.x = −1), inciseur en sens inverse. Rotation affichée ralentie (≈ 1,3 rad/s à 4000 tr/min) pour éviter l'effet stroboscopique.
- Pas de bague de protection autour de la lame : dents visibles, forme d'après une lame réelle.
- Le groupe d'inclinaison (secteurs compris) reste dans le bâti.
- Éclats de mélaminé : bord droit sur le chant, pointes vers l'intérieur du panneau.
- Cycle de coupe : aller seulement. Après l'aller, évacuer la chute avant le retour du chariot (pas d'aller-retour automatique), dans TOUS les modes, libre compris.
- Au retour, la pièce revient toujours côté chariot (décalée), jamais entre la lame et le guide parallèle.
- La pièce gardée n'est pas forcément la plus grande : c'est celle entourée en orange, l'élève peut cliquer l'autre avant d'évacuer.
- Alerte ROUGE dans tous les scénarios : tronçonnage avec la pièce en butée contre le guide parallèle (au lieu de la butée de la règle) quand la règle du guide n'est PAS en position courte → risque majeur de rejet.
- Alerte ROUGE : délignage d'une pièce étroite (< 120 mm) contre la règle du guide en position courte.
- Rive en flache contre le guide : danger. Délignage de rive d'abord au sabot (butée à griffes), après avoir retiré la pièce grise restée sur le chariot.
- Gaspillage au délignage de rive : trait à 10 mm au plus du point le plus profond de la flache.
- Flèches de décalage de la pièce calculées selon la caméra (direction réelle à l'écran), libellés « lame » / « chariot ».
- Marque fictive « KANAK 550 » sur le bâti (modèle réel : Format-4 kappa ; ne pas afficher la vraie marque).

## Nommage des chants

Chants bruts numérotés (1, 2, 3, 4 ; U = chant d'usine), chants sciés en lettres. En exercice guidé, la lettre est fixée par l'étape (`cut:'A'` dans STEPS_*) : une coupe d'essai avant l'étape prend la lettre de la prochaine coupe prévue ; une coupe refaite dans la même étape garde la lettre et l'ancien chant devient X, Y, Z… En mode libre, lettres à la suite.

## Interface

- Modes `data-ui` : `pres` (nomenclature | 3D | réglages), `ex` (3D | consigne + dock en bas), `parcours` (SCORM). Le bloc #settings est déplacé entre #presSlot et #dockSlot.
- Pas de barres de défilement sur ordinateur. Sous 900 px : une colonne. Ajouter CHAQUE nouveau `data-ui` dans la media query (bug déjà rencontré : 3D écrasée à 36 px sur Android).
- En portrait, le champ vertical de la caméra s'élargit (fov max 55°) pour que la machine tienne à l'écran.
- Repérage tactile : toucher = surbrillance SANS le nom, puis Valider / Annuler (barre au-dessus de la 3D). Tolérance de glissé : 14 px au doigt, 5 px à la souris.

## Parcours évalué (SCORM 1.2)

- Actif seulement si `window.PARCOURS` (le paquetage le définit ; la version web ne l'affiche pas).
- Repérage 15 organes (lame et couteau en vue rapprochée avec la lame montée à 80 mm ; inciseur, moteur, inclinaison en vue transparente), QCM 20 questions, 3 scénarios (format, planche, inciseur).
- Barème : repérage 20, QCM 20, 3 × 20 pour les scénarios (5 critères de 4 points dont « aucune faute grave »). Réussite : ≥ 70 ET aucune faute grave sur tout le module ; le module pose lui-même passed/failed (pas de masteryscore dans le manifeste).
- Faute grave = alerte danger active au moment où une coupe commence. Les fautes d'un scénario interrompu sont conservées à la reprise.
- SCORM : LMSInitialize, lesson_status incomplete au départ, suspend_data JSON (v:2, ≤ 4096 caractères), interactions (ids sans espaces ; types choice / numeric / performance), score.raw/min/max, session_time, exit=suspend.

## Pièges connus

- Jamais `emissive` sur un MeshBasicMaterial (écran du pupitre…) : le rendu plante à chaque image et toute la vue disparaît. Teinter la couleur à la place.
- Un commentaire `//` mal placé a déjà avalé une accolade : vérifier avec `node --check` sur le script module extrait.
- Le Raycaster de three r160 ignore `visible` : filtrer les hits (pièces, bâti/table en transparence).
- Ombres : `shadowMap.autoUpdate = false`, mises à jour seulement quand quelque chose bouge. Rendu dans try/catch, gestion de la perte de contexte WebGL (bouton Relancer).
- En headless (swiftshader), pertes de contexte et captures lentes : pas un bug utilisateur.
- Moodle sert les .js en `application/x-javascript` avec nosniff : accepté pour les modules ES.

## Vérifier avant de livrer

1. `node --check` du script module extrait.
2. Les trois exercices guidés de bout en bout (format → 800 × 450 ; planche → 160 sans flache ; inciseur → 800 × 400 sans éclat).
3. Le parcours complet avec une fausse API SCORM (note, statut, interactions, reprise).
4. Une capture en largeur ordinateur ET téléphone (412 px).
