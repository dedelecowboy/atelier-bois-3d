# Atelier bois 3D

Simulateurs 3D de machines à bois pour la formation (bac pro / BTS DRB), utilisables dans un navigateur, sur ordinateur, tablette ou smartphone, et intégrables dans Moodle en paquetage SCORM 1.2 avec note.

Julien ANDRE – Lycée André MALRAUX – REMIREMONT

## Machines

| Machine | État | Dossier |
|---|---|---|
| Scie à format « KANAK 550 » | en service | `machines/scie-format/` |
| Dégauchisseuse | prévue | |
| Raboteuse | prévue | |
| Scie à ruban | prévue | |
| Toupie | prévue | |

## Scie à format KANAK 550

- **Présentation** : nomenclature de 22 organes, réglages, vue intérieure, vues prédéfinies, plein écran.
- **Exercices guidés** : coupe libre, mise au format 800 × 450, délignage d'une planche avec flache (sabot puis guide), mélaminé avec inciseur. Alertes de sécurité (danger / attention / info) et contrôle de la pièce obtenue.
- **Parcours évalué (SCORM)** : repérage de 15 organes, QCM de 20 questions, 3 scénarios notés. Note sur 100, réussite à 70 sans faute grave.

## Corriger les QCM, la nomenclature ou le repérage

Ces textes sont dans des fichiers simples, modifiables directement sur GitHub (bouton crayon) ou dans n'importe quel éditeur de texte :

| Fichier | Contenu |
|---|---|
| `machines/scie-format/data/qcm.txt` | les questions du QCM : `Q:` la question, `+` la bonne réponse, `-` les mauvaises, `=` l'explication |
| `machines/scie-format/data/organes.txt` | la nomenclature : `[code] repère Nom`, puis la description |
| `machines/scie-format/data/reperage.txt` | les organes demandés au repérage, dans l'ordre, et la vue utilisée |

Le mode d'emploi est écrit en tête de chaque fichier. Après une modification enregistrée sur GitHub, le module est refabriqué automatiquement : onglet **Actions** → dernière exécution « Fabrication » → **Artifacts** → `modules` (zip contenant la page web et le paquetage SCORM). Si l'exécution est en rouge, son journal indique le fichier et la ligne à corriger. On peut aussi fabriquer sur son ordinateur (ci-dessous).

## Fabriquer la page web et le paquetage Moodle

Prérequis : [Node.js](https://nodejs.org) (version 18 ou plus).

```
npm install
npm run build
```

Dans `dist/` :
- `scie-format.html` : la page autonome (three.js chargé depuis Internet), à ouvrir dans un navigateur ou à publier ;
- `KANAK550_scie_format_SCORM12.zip` : le paquetage SCORM. Dans Moodle : activité « Paquetage SCORM », affichage en nouvelle fenêtre, méthode d'évaluation « note la plus haute ».

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
