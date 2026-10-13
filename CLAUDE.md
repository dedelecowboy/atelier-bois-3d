# Consignes pour Claude – atelier-bois-3d

À lire en entier avant toute modification. Ce fichier garde ce que l'enseignant (Julien ANDRE, métiers du bois) a corrigé ou décidé : ne pas le contredire sans lui demander.

## Le projet

Simulateurs 3D web de machines à bois pour élèves de bac pro (et BTS DRB). Objectif : un atelier virtuel, une machine par module, chaque machine livrée aussi en paquetage SCORM 1.2 pour Moodle (une note par machine ; le déverrouillage progressif se fait par les restrictions d'accès Moodle). Une page « atelier » 3D servira d'entrée visuelle.

Langue de l'interface et des messages : français. Consignes simples et directes, niveau bac pro.

## Organisation actuelle

Étapes faites (octobre 2026) : 1. moteur commun extrait, la scie à format est le premier module construit dessus (comportement identique à l'ancien fichier unique) ; 2. dégauchisseuse ; 3. déligneuse multilames (PR #5) — toutes fusionnées dans main. Étape 4 en cours : scie radiale (`machines/scie-radiale/`, branche `scie-radiale`). Étapes suivantes envisagées : raboteuse, scie à ruban, toupie ; page « atelier » 3D d'entrée.

Chaîne de débit : scie radiale (tronçonnage des planches brutes, purge des défauts) → déligneuse (délignage) → dégauchisseuse, raboteuse (corroyage) ; la scie à format pour les panneaux et la mise au format.

Quatre modules sur le même moteur, même découpage de fichiers : `scie-format`, `degauchisseuse`, `deligneuse`, `scie-radiale`.

- `engine/` : moteur commun. `app.js` (assemblage, dispositions `data-ui`, démarrage ; liste des crochets qu'une machine fournit en tête de fichier), `stage.js` (rendu, caméra, vues, boucle, perte de contexte, plein écran, toast), `kit.js` (matériaux M / MI, rbox, cyl, link/setBetween, poulies, courroies, secteurs, textures bois et règle), `parts.js` (registre des organes, nomenclature, surbrillance, vue intérieure, clic/toucher dans la 3D), `exercise.js` (modes, étapes, contrôles, résultats, alertes), `parcours.js` + `scorm.js` (parcours évalué SCORM 1.2), `data.js` (lecture et contrôle des fichiers de données), `poly.js` (géométrie 2D des pièces), `shell.js` + `engine.css` (squelette HTML produit à la fabrication, styles communs).
- `machines/<id>/` : `config.js` (textes, modes, vues, xray, SCORM), `model.js` (modèle 3D + mise à jour + animation), un fichier pièce (`pieces.js` pour la scie à format, `piece.js` pour les autres : forme, orientation, passe, découpe), `rules.js` (alertes, mesures), `scenarios.js` (étapes guidées, pièces de départ, critères notés), `main.js` (commandes, assemblage), `constants.js`, `state.js` (état `st`), fragments `settings.html`, `dock.html`, `panel.html`, `style.css`.
- `machines/<id>/data/` : `organes.txt`, `qcm.txt`, `reperage.txt`, que l'enseignant corrige lui-même (mode d'emploi en tête de chaque fichier). Les codes entre crochets relient les organes au modèle 3D (`tagPart(obj,'code')`) : la fabrication vérifie que chaque code utilisé existe.
- Déligneuse : 21 organes, repérage 15, QCM 20 (sources INRS ED 6019 et cours « La déligneuse »), 3 scénarios (avivés, plot, multilames) ; paquetage `KANAK300M_deligneuse_SCORM12.zip`.
- Scie radiale : 23 organes, repérage 15, QCM 20 (sources : cours « La scie radiale » du lycée, fiche méthode « Débit des bois » 2MB, fiche « Scie radiale » du CCHST, catalogue constructeur ; pas encore de document INRS), 3 scénarios (débit en série à la butée, purge des défauts, coupe inclinée à 45°) ; paquetage `KANAK900R_scie_radiale_SCORM12.zip`.
- Moteur : `app.recordDangers(liste)` relève aussi une faute grave hors coupe (scie radiale : pièce touchée lame en avant) ; sans argument, comme avant (alertes « danger » actives).
- `tools/build.mjs` (`npm run build`) : contrôle des données (message « fichier, ligne N : … » en français), bundle esbuild (three externe, `.txt` en texte), puis dans `dist/` : `<machine>.html` (fragment autonome, three par importmap depuis cdn.jsdelivr.net, three@0.160.0) et le zip SCORM (three copié dans `lib/`, importmap réécrite, `window.PARCOURS=true`, manifeste généré). `dist/` n'est pas versionné.
- Pages publiées comme artifacts claude.ai (republier à ces URL, ne pas en créer d'autres) : `dist/scie-format.html` → https://claude.ai/artifact/5TrWcgiDVbvMBYtp78Sc6E ; `dist/degauchisseuse.html` → https://claude.ai/artifact/QJ3m6hcgjuP52HZeVi5vJH ; `dist/deligneuse.html` → https://claude.ai/artifact/2CfhFoe5awDPpfhjpwVfa7 ; `dist/scie-radiale.html` → https://claude.ai/artifact/TFWwCULVDt3Bfo4vrDUPQS. Logo du lycée en webp base64 dans `.stage::before` (engine.css).
- `tests/` : `harness.py` (banc commun, fausse API SCORM), `run.py` (`npm test`), `tests/<machine>/test_*.py` avec assertions (voir tests/README.md).

Ajouter une machine : `machines/<id>/config.js` + `data/` + `main.js` qui appelle `createApp(config, données)`, construit son modèle avec `app.parts.tagPart` et `app.stage.root`, puis `app.start(crochets)` ; `tests/<id>/` sur le modèle de la scie. Chaque nouvelle disposition `data-ui` va aussi dans la media query de `engine.css`.

Les textes des scénarios (consignes, libellés de contrôle) sont encore dans `scenarios.js` (ils sont liés au code des contrôles).

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

## Dégauchisseuse : conventions et choix (proposés, À VALIDER par l'enseignant)

- Machine fictive « KANAK 520 D » d'après une UTIS D52 (520 mm) avec protecteur à pont type SUVAMATIC et arbre Tersa 4 fers ; ne pas afficher la vraie marque. Ressources : fiche « Dégauchisseuse GUILLIET » (J. Gutierrez), fiche INRS A644, schéma des réglages de table de sortie.
- Repère : X = sens d'avance (opérateur côté +X, table d'entrée), pièce vers −X ; opérateur côté +Z, guide et carter côté −Z. Arbre d'axe Z en X = 0, cercle de coupe au niveau de la table de sortie (TABLE_Y = 0,86). Table d'entrée abaissée de la profondeur de passe. Fers du haut vers l'opérateur (contre l'avance).
- Pièce : 4 faces F1/F2 (plats) et C1/C2 (chants) décrites par des profils le long de la pièce ; une passe de profondeur d enlève la matière jusqu'à d au-dessus des points d'appui (une pièce cintrée se dresse en plusieurs passes). Orientation : k quarts de tour vers le guide + bout pour bout. Les écarts de forme sont exagérés ×3 à l'affichage seulement.
- Fil : bon sens si, depuis la face usinée, les fibres montent vers le bout qui passe en premier ; sinon arrachements, effacés par une passe dans le bon sens d'au moins 1 mm. Scénario « fil incliné » : fil incliné dans l'épaisseur seulement (avec une pente aussi dans la largeur, une seule des deux faces possibles pour SR1 permet un SR2 sans arrachement : trop subtil pour le bac pro).
- Angle de SR2 : celui du guide si la face contre le guide est dressée et plaquée ; sinon erreur d'angle.
- Protecteur SUVAMATIC (validé par l'enseignant, d'après la documentation SUVA) : pas de réglage manuel de hauteur ni d'écart. La couverture repose sur la table contre le guide, rappelée par ressort ; le seul réglage est le bec d'engagement : vertical pour le plat (la pièce soulève la couverture, qui glisse sur elle), horizontal pour le chant (la pièce l'écarte du guide de son épaisseur, elle la plaque contre le guide). Elle revient seule après le passage. Bec mal orienté pour le travail en cours = danger (faute grave si la passe commence).
- Autres dangers : pièce de moins de 320 mm, pièce posée sur son bombé (instable). Attention : passe > 2 mm, aspiration arrêtée, guide pas à 90° ou face non dressée contre le guide pour le chant.
- Après la passe, la pièce est ramenée en la soulevant (« Ramener la pièce ») : jamais tirée en arrière sur l'arbre.
- Repères (validé par l'enseignant) : boucle de parement sur SR1 ; repère d'angle = un petit trait sur SR1, côté angle droit, qui repart sur SR2 : les deux traits forment un petit V à cheval sur l'arête commune.
- « Repère au crayon » (demandé par l'enseignant) : la pièce est prise en main et réorientée (SR1 dessus ; pour le V, SR2 côté opérateur), la vue se rapproche du repère (arête SR1 / SR2 pour le V). On ne repère que des faces dressées ; la boucle de SR1 reste après le V.
- Aspect des faces (demandé par l'enseignant) : brut de sciage terne, grisé, traits de scie et fibres soulevées (relief) ; face dressée claire, lisse, léger brillant.
- Protecteur, forme d'après les photos fournies : boîtier noir à ressorts (pas de colonne verticale : supprimée à la demande de l'enseignant), bras jaune de section ovale continue qui traverse le boîtier, gardé entier et horizontal (sur la machine réelle, un bouton permet de raccourcir le bras et de replier son bout à 90° devant le bâti : non représenté), embout noir côté guide, bec jaune coudé à lumière qui pivote de 90°. Corrigé par l'enseignant : bec VERTICAL pour le plat (coudé vers le haut, la pièce fait monter le bras), HORIZONTAL pour le chant (coudé vers l'opérateur, la pièce repousse le bras). Ne pas inverser.
- Capot de courroie sur la transmission, contre le flanc arrière du bâti (dans le groupe « bâti », translucide en vue intérieure).
- Guide (validé par l'enseignant) : il s'incline vers l'arrière, loin de l'opérateur.
- Aspiration (d'après le détail fourni par l'enseignant) : bac ouvert sous l'arbre sur toute la largeur, fond incliné, conduit qui se resserre vers la buse Ø 120 mm sur le côté du bâti, côté table de sortie.
- Contrôle et barème des scénarios : SR1 dressé, SR2 dressé, angle 90 ± 0,2°, puis repères (rectiligne), épaisseur ≥ 29,5 mm (cintrée) ou absence d'arrachement (fil incliné), et « aucune faute grave ».

## Déligneuse multilames : conventions et choix (proposés, À VALIDER par l'enseignant)

- Machine fictive « KANAK 300 M » d'après la multilame à tapis SCM Class M3 du devis AMS (déc. 2024) : arbre AU-DESSUS du tapis, lames Ø 200 à 350 (Ø 300 au modèle), 4 200 tr/min, paquet de lames 300 mm, tapis 300 mm, avance 6 à 48 m/min, table à 750 mm, longueur mini 390 mm, aspiration Ø 200 (lames) + Ø 120 (tapis), laser, guide d'entrée, ampèremètre. Ne pas afficher la vraie marque. Ressources : catalogue SCM Class, photos fournies, INRS ED 6019, cours « La déligneuse » (déligneuse à chariot : utilisé pour le vocabulaire et la procédure, pas pour la machine).
- Repère : X = sens d'avance, opérateur à l'entrée côté +X, pièce vers −X ; guide côté −Z (à droite de l'opérateur), pupitre, moteur et transmission côté +Z. Plan du tapis TABLE_Y = 0,75. Lames en X = 0, première lame (côté guide) en z = −0,06.
- Rotation EN OPPOSITION (machine mono-arbre, arbre au-dessus) : les dents du bas vont vers l'opérateur (+X), contre l'avance → barrières anti-recul à l'entrée : 3 rangées de linguets à dents, 1 rangée de lamelles, 1 barrière inférieure fixe (catalogue : « trois supérieures et une inférieure »). Linguets, lamelles, rideau de sortie et rouleaux presseurs se soulèvent sur la pièce.
- Manchons préréglés (changés lames arrêtées et arbre immobile ; porte interverrouillée, sinon refus) : 1 lame ; 2 lames · 140 ; 4 lames · 45. Trait de scie 3,2 mm : entraxe = largeur + 3,2. Guide : largeur entre sa face et la première lame ; escamotable sous la table.
- Guide (corrigé par l'enseignant) : RIEN au-dessus de la table du côté de la pièce. Rail fixe sous la table, en bout de table, avec volant ; le coulisseau suit le guide le long du rail ; le profil et son équerre montent et descendent sur la colonne du coulisseau ; escamoté, tout passe sous le dessus de la table.
- Tapis (demandé par l'enseignant) : bouton Marche / Arrêt distinct des lames ; il tourne en continu quand il est en marche ; brin du dessus vers la sortie (−X), sens d'avance, opposé aux dents du bas des lames. La pièce ne s'engage que tapis en marche (sinon refus) ; tapis arrêté pendant la passe = pièce immobilisée.
- Pièces sciées (demandé par l'enseignant : comme à la scie à format) : à la sortie, la pièce gardée est entourée en orange (la plus large au départ ; clic sur une autre pour la garder). « Évacuer les chutes » range les autres dans « Pièces débitées » (Pièce / Chute modifiable), « Ramener la pièce » remet la pièce gardée à l'entrée (seulement si elle est seule à la sortie), « Mettre de côté » range tout. Nouvelle passe refusée tant que la sortie n'est pas dégagée ; « Reprendre » seulement machine libre. Étape Fin : pièces de la sortie rangées, tapis puis lames arrêtés.
- Pièce : profils le long de la pièce (21 stations) ; chaque rive est une droite entre l'arête de la face A et celle de la face B (avivé : a = b ; plateau : flache). Une coupe est un plan vertical. Orientation : retourner (face B sur le tapis), bout pour bout. Rendu de la passe : plans de coupure en X = 0 (pièce entière côté entrée, pièces sciées côté sortie) ; la pièce avance avec le tapis, 4 fois plus vite que l'avance réelle (temps réel, pas le pas d'image).
- Fautes graves (danger au moment d'engager la pièce) : pièce < 390 mm ; presseurs à l'épaisseur de la pièce ou plus haut (réglage correct : 1 à 4 mm sous l'épaisseur ; plus bas, la pièce bute et la passe est refusée) ; plateau posé sur sa petite face (petit découvert dessous, INRS fig. 23) ; rive en flache contre le guide. Attention : aspiration arrêtée, ampèremètre en surcharge, petit bout engagé en premier (INRS : par le gros bout), guide escamoté sans laser.
- Ampèremètre (choix pédagogique, coefficients à valider) : charge % = vitesse (m/min) × épaisseur (mm) × lames qui scient × dureté (sapin 0,8 ; hêtre 1,1 ; chêne 1,2) / 2 070 × 100. Zone verte 40 à 90 %, surcharge > 100 %. Le cadran montre la charge prévue (pointillés) et la charge en coupe ; la plus forte charge des passes est notée.
- Scénarios et barème (5 critères de 4 points dont « aucune faute grave ») : avivés (sapin 180 → 2 × 85 au guide en 2 passes, reprise de la chute de 91,8) ; plot (plateau de chêne 2 200 × 41, flache, conique, posé à l'envers et petit bout devant → avivé de 140 sans flache au laser, guide escamoté) ; multilames (hêtre 200 → 4 × 45 en une passe + délignure de 7,2, vitesse réduite).

## Scie radiale : conventions et choix (proposés, À VALIDER par l'enseignant)

- Machine fictive « KANAK 900 R » d'après la scie radiale de l'atelier (catalogue « classiques pour le tronçonnage », modèle à lame Ø 400) : 4 kW, 3 000 tr/min, capacité 900 × 120 mm, bras ±45°, lame 0 à 45°, table à 900 mm, aspiration Ø 120 + Ø 60, frein, retour à ressort, environ 300 kg. Ne pas afficher la vraie marque. Ressources : photos et caractéristiques fournies, cours « La scie radiale », fiche méthode « Débit des bois » (2MB), fiche CCHST « Scie radiale ».
- Repère : X le long du guide ; la planche arrive par la gauche (servante à rouleaux), les pièces débitées sortent à droite, entre la lame et la butée de longueur (table de sortie). Z : opérateur devant (+Z), guide (face avant en z = −0,30), colonne et bras derrière. Lame à 0° : plan x = 0 ; trait 4 mm ; TABLE_Y = 0,90 ; lame Ø 400, 5 mm dans la table en bois.
- Poste (validé par l'enseignant) : la main gauche tient TOUJOURS la planche, à gauche de la lame (pas de choix de côté) ; seule sa distance au trait se règle. Main droite sur la poignée (à droite du moteur). La pièce débitée, à droite, n'est pas tenue (la lame avalante la plaque contre le guide).
- Sens de rotation : en avalant, les dents de devant descendent dans le bois, celles du bas vont vers le guide (cours : « la pièce est toujours plaquée contre le guide », la lame tend à s'emballer).
- Tête : position arrière = lame entièrement derrière le guide, arrêtée par une butée de fin de course (caoutchouc, sous le bras) 15 mm avant la colonne (demandé par l'enseignant : pas de contact avec la colonne) ; colonne en z = −0,90. « Tirer la lame » : la tête traverse la pièce (course juste suffisante, animée en temps réel), la coupe se fait en fin de course ; « Ramener la lame » la remet en position arrière. Ressort de rappel présent sur la machine, mais l'élève accompagne toujours la tête (bouton obligatoire).
- Zone dangereuse (demandé par l'enseignant) : bandes rouges et blanches + fond rouge léger sur la table, qui suivent l'angle du bras et l'inclinaison : 150 mm à gauche du trait mesuré au-dessus de la pièce, 150 mm à droite du trait au ras de la table ; la même zone dans la vue de dessus et pour la règle « main dans la zone ».
- Pivot du bras (corrigé par l'enseignant) : sur l'axe de la colonne, mais colonne peu en retrait du guide (axe en z = −0,90, 600 mm derrière la face du guide) et table élargie à 2,60 m (±1,30) : la coupe à 45° reste bien sur la table, loin du bord. Position arrière de la lame à z = −0,58 (lame derrière le guide, carter Ø 440 à 15 mm de la colonne, butée de fin de course en caoutchouc). Traits de lame laissés dans la table et sur le dessus du guide pour −45, −30, −15, 0, 15, 30, 45° (droites issues de l'axe de la colonne). Essai précédent (pivot au droit du guide, bras sous une console) écarté par l'enseignant.
- Géométrie : la règle de la butée est graduée depuis le trait à 0° (aux autres angles, la coupe croise le guide plus loin : coupe d'essai) ; la lame s'incline autour de l'arête droite de son trait, au ras de la table (secteur courbe sous le chariot), le haut de la lame vers la gauche (côté planche) : la butée mesure toujours la face posée sur la table.
- Pièces : profil de la planche d'origine (rives ondulées, flache = face du dessus en retrait, bouts bruts hors d'équerre, défauts) limité par des plans (bouts bruts, coupes de la lame) ; une coupe d'onglet ou biaise est un plan quelconque. Défauts : nœud, fente en bout, gerce (en surface) ; un défaut compte s'il touche la pièce.
- Pièces sciées (comme les autres machines) : après la coupe, la pièce gardée (contour orange) est celle que tient la main, sinon celle de gauche (la planche) ; clic sur une autre pour la garder. « Évacuer les chutes » range les autres dans « Pièces débitées » (Pièce si ≥ 350 mm sans défaut, sinon Chute ; modifiable), « Mettre la pièce en butée » (nom demandé par l'enseignant) pousse la pièce gardée contre le guide et contre la butée en service (une seule pièce sur la table), « Mettre de côté » range tout, « Reprendre » seulement table libre. Nouvelle coupe refusée tant que la table n'est pas dégagée. Une pièce coupée qui était plaquée contre le guide le reste.
- Fautes graves (danger au moment de tirer la lame) : main à moins de 150 mm du trait (zone rouge peinte sur la table) ; main pas entièrement sur le bois (pièce non tenue) ; pièce pas plaquée contre le guide ; protecteur avant plus de 10 mm au-dessus de la pièce ; bras et tête non bloqués ; pièce de moins de 300 mm. Faute grave aussi, hors coupe : toucher une pièce (glisser, évacuer, ranger, reprendre) alors que la lame n'est pas revenue en position arrière (geste refusé). Attention : aspiration arrêtée.
- Blocages (pas des fautes) : lame arrêtée ; lame pas en position arrière ; deux pièces sur la table ; protecteur plus bas que la pièce ; angle du bras ou inclinaison changés lame en marche (ou pas encore arrêtée), tête débloquée exigée ; protecteur réglé lame en marche ; butée abaissée sur la planche.
- Scénarios et barème (5 critères de 4 points dont « aucune faute grave ») : série (plateau de sapin 2 500 × 180 × 27 en flache → bout brut affranchi avec une chute ≤ 50 mm, 4 montants de 550 ± 1 mm d'équerre, identiques à 0,5 mm) ; purge (plateau de chêne 2 400 × 200 × 27 : fente en bout de 130 mm, nœud Ø 34, gerce de 90 mm → chutes ≤ 160 / 100 / 150 mm, au moins 1 950 mm de bois sain de 350 mm et plus) ; biais (avivé de mélèze 2 400 × 120 × 22 → lame à 45°, bout affranchi ≤ 50 mm, 3 lames de bardage de 600 ± 1 mm sur la face posée, bouts à 45° parallèles).

## Nommage des chants

Chants bruts numérotés (1, 2, 3, 4 ; U = chant d'usine), chants sciés en lettres. En exercice guidé, la lettre est fixée par l'étape (`cut:'A'` dans STEPS_*) : une coupe d'essai avant l'étape prend la lettre de la prochaine coupe prévue ; une coupe refaite dans la même étape garde la lettre et l'ancien chant devient X, Y, Z… En mode libre, lettres à la suite.

## Interface

- Modes `data-ui` : `pres` (nomenclature | 3D | réglages), `ex` (3D | consigne + dock en bas), `parcours` (SCORM). Le bloc #settings est déplacé entre #presSlot et #dockSlot.
- Pas de barres de défilement sur ordinateur (`body{margin:0}` dans engine.css : la marge par défaut du navigateur en créait une). Sous 900 px : une colonne. Ajouter CHAQUE nouveau `data-ui` dans la media query (bug déjà rencontré : 3D écrasée à 36 px sur Android).
- En portrait, le champ vertical de la caméra s'élargit (fov max 55°) pour que la machine tienne à l'écran.
- Repérage tactile : toucher = surbrillance SANS le nom, puis Valider / Annuler (barre au-dessus de la 3D). Tolérance de glissé : 14 px au doigt, 5 px à la souris.

## Parcours évalué (SCORM 1.2)

- Actif seulement si `window.PARCOURS` (le paquetage le définit ; la version web ne l'affiche pas).
- Repérage 15 organes (lame et couteau en vue rapprochée avec la lame montée à 80 mm ; inciseur, moteur, inclinaison en vue transparente), QCM 20 questions, 3 scénarios (format, planche, inciseur).
- Barème : repérage 20, QCM 20, 3 × 20 pour les scénarios (5 critères de 4 points dont « aucune faute grave »). Réussite : ≥ 70 ET aucune faute grave sur tout le module ; le module pose lui-même passed/failed (pas de masteryscore dans le manifeste).
- Repérage : la vue intérieure est imposée par chaque question (remise à chaque question et à la sortie du repérage). Le bouton « Vue intérieure » est caché pendant le parcours : un bouton de vue (« Arbre ») ne fait que déplacer la caméra (bug corrigé : vue intérieure bloquée, tables et bâti plus cliquables).
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

`npm run build` puis `npm test` couvre les points 1 à 4 (compter une dizaine de minutes en headless) ; regarder les captures de `tests/out/`.

1. `node --check` du script module extrait.
2. Les trois exercices guidés de chaque machine de bout en bout (scie : format → 800 × 450, planche → 160 sans flache, inciseur → 800 × 400 sans éclat ; dégauchisseuse : rectiligne, cintrée, fil incliné ; déligneuse : 2 × 85, avivé de 140 sans flache, 4 × 45 en une passe ; scie radiale : 4 × 550 à la butée, purge fente / nœud / gerce, 3 × 600 à bouts biais).
3. Le parcours complet avec une fausse API SCORM (note, statut, interactions, reprise).
4. Une capture en largeur ordinateur ET téléphone (412 px).
