# Atelier bois 3D

Simulateurs 3D de machines à bois pour la formation (bac pro / BTS DRB), utilisables dans un navigateur, sur ordinateur, tablette ou smartphone, et intégrables dans Moodle en paquetage SCORM 1.2 avec note.

Julien ANDRE – Lycée André MALRAUX – REMIREMONT

## Machines

| Machine | État | Dossier |
|---|---|---|
| Scie à format « KANAK 550 » | en service | `machines/scie-format/` |
| Dégauchisseuse « KANAK 520 D » | en essai | `machines/degauchisseuse/` |
| Déligneuse multilames « KANAK 300 M » | en essai | `machines/deligneuse/` |
| Scie radiale « KANAK 900 R » | en essai | `machines/scie-radiale/` |
| Raboteuse | prévue | |
| Scie à ruban | prévue | |
| Toupie | prévue | |

## Scie à format KANAK 550

- **Présentation** : nomenclature de 22 organes, réglages, vue intérieure, vues prédéfinies, plein écran.
- **Exercices guidés** : coupe libre (y compris coupes d'onglet avec la règle de tronçonnage orientée et coupes biaises lame inclinée jusqu'à 46°), mise au format 800 × 450, délignage d'une planche avec flache (sabot puis guide), mélaminé avec inciseur. Alertes de sécurité (danger / attention / info) et contrôle de la pièce obtenue.
- **Parcours évalué (SCORM)** : repérage de 15 organes, QCM de 20 questions, 3 scénarios notés. Note sur 100, réussite à 70 sans faute grave.

## Dégauchisseuse KANAK 520 D

- **Présentation** : nomenclature de 15 organes (arbre à 4 fers, protecteur SUVAMATIC à bec d'engagement orientable, guide inclinable, carter derrière le guide…), vue intérieure.
- **Exercices guidés** : SR1 (plat) puis SR2 (chant d'équerre contre SR1), bec du protecteur orienté selon le travail, repère de parement puis repère d'angle en V. Trois pièces : rectiligne, cintrée (creux sur la table, plusieurs passes), fil incliné (sens d'usinage, arrachements).
- **Parcours évalué (SCORM)** : repérage de 13 organes, QCM de 20 questions, 3 scénarios notés. Note sur 100, réussite à 70 sans faute grave.

## Déligneuse multilames KANAK 300 M

- **Présentation** : nomenclature de 21 organes (lames au-dessus du tapis, manchon porte-lames, rouleaux presseurs, barrières anti-recul, guide escamotable, laser, ampèremètre, rideau de sortie…), vue intérieure.
- **Exercices guidés** : délignage d'avivés au guide (2 pièces de 85 mm en deux passes), délignage d'un plateau de plot en flache au laser (guide escamoté, petit découvert dessus, gros bout en premier → avivé de 140 mm sans flache), multidélignage (4 tasseaux de 45 mm en une passe, vitesse d'avance réglée à l'ampèremètre). Manchon changé lames arrêtées, presseurs réglés à l'épaisseur, pièces débitées reprises pour une nouvelle passe.
- **Parcours évalué (SCORM)** : repérage de 15 organes, QCM de 20 questions, 3 scénarios notés. Note sur 100, réussite à 70 sans faute grave.

## Scie radiale KANAK 900 R

Première machine de la chaîne de débit : elle tronçonne les planches brutes à longueur et purge leurs défauts, avant la déligneuse.

- **Présentation** : nomenclature de 23 organes (bras pivotant sur la colonne, chariot porte-lame et ressort de rappel, lame Ø 400 travaillant en avalant, carter, protecteur avant réglable, inclinaison de la lame, butée de longueur escamotable, servante à rouleaux…), zone dangereuse peinte sur la table, vue intérieure.
- **Exercices guidés** : débit en série à la butée d'après une fiche de débit (bout brut affranchi, 4 montants de 550 mm), purge des défauts au plus près (fente en bout, nœud, gerce), coupe inclinée à 45° (lames de bardage à bouts biais parallèles). La main gauche tient la planche hors de la zone rouge, la lame est ramenée en arrière après chaque coupe avant de toucher aux pièces, pièce gardée entourée en orange, pièces débitées listées.
- **Parcours évalué (SCORM)** : repérage de 15 organes, QCM de 20 questions, 3 scénarios notés. Note sur 100, réussite à 70 sans faute grave.

## Corriger les QCM, la nomenclature ou le repérage

Ces textes sont dans des fichiers simples, modifiables directement sur GitHub (bouton crayon) ou dans n'importe quel éditeur de texte :

| Fichier | Contenu |
|---|---|
| `machines/scie-format/data/qcm.txt` | les questions du QCM : `Q:` la question, `+` la bonne réponse, `-` les mauvaises, `=` l'explication |
| `machines/scie-format/data/organes.txt` | la nomenclature : `[code] repère Nom`, puis la description |
| `machines/scie-format/data/reperage.txt` | les organes demandés au repérage, dans l'ordre, et la vue utilisée |
| `machines/degauchisseuse/data/…`, `machines/deligneuse/data/…`, `machines/scie-radiale/data/…` | les mêmes trois fichiers pour la dégauchisseuse, la déligneuse et la scie radiale |

Le mode d'emploi est écrit en tête de chaque fichier. Après une modification enregistrée sur GitHub, le module est refabriqué automatiquement : onglet **Actions** → dernière exécution « Fabrication » → **Artifacts** → `modules` (zip contenant la page web et le paquetage SCORM). Si l'exécution est en rouge, son journal indique le fichier et la ligne à corriger. On peut aussi fabriquer sur son ordinateur (ci-dessous).

## Fabriquer la page web et le paquetage Moodle

Prérequis : [Node.js](https://nodejs.org) (version 18 ou plus).

```
npm install
npm run build
```

Dans `dist/` :
- `scie-format.html`, `degauchisseuse.html`, `deligneuse.html`, `scie-radiale.html` : les pages autonomes (three.js chargé depuis Internet), à ouvrir dans un navigateur ou à publier ;
- `KANAK550_scie_format_SCORM12.zip`, `KANAK520D_degauchisseuse_SCORM12.zip`, `KANAK300M_deligneuse_SCORM12.zip`, `KANAK900R_scie_radiale_SCORM12.zip` : les paquetages SCORM. Dans Moodle : activité « Paquetage SCORM », affichage en nouvelle fenêtre, méthode d'évaluation « note la plus haute ».

Pour une seule machine : `npm run build -- scie-format`.

## Organisation du code

```
engine/                  moteur commun à toutes les machines
  app.js                 assemblage d'un module (dispositions, démarrage)
  stage.js               scène 3D, caméra et vues, boucle de rendu, plein écran
  kit.js                 outils de modélisation (matériaux, profilés, poulies, courroies…)
  parts.js               organes : nomenclature, surbrillance, vue intérieure, clic dans la 3D
  exercise.js            exercices guidés : étapes, contrôles, alertes, résultats
  parcours.js, scorm.js  parcours évalué et dialogue SCORM 1.2 avec Moodle
  data.js                lecture des fichiers organes / QCM / repérage
  poly.js                géométrie 2D des pièces (découpe, mesures)
  shell.js, engine.css   squelette HTML et feuille de style communs
machines/<machine>/      une machine : modèle 3D, réglages, règles, scénarios, données
tools/build.mjs          fabrication de dist/
tests/                   tests automatiques (voir tests/README.md)
```

## Licence

Voir `LICENSE`. La bibliothèque 3D three.js (MIT) est incluse dans les paquetages SCORM.
