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

## Fabriquer le paquetage Moodle

```
npm install
python3 machines/scie-format/build_scorm.py
```

Le zip `KANAK550_scie_format_SCORM12.zip` apparaît dans `machines/scie-format/`. Dans Moodle : activité « Paquetage SCORM », affichage en nouvelle fenêtre, méthode d'évaluation « note la plus haute ».

## Licence

Voir `LICENSE`. La bibliothèque 3D three.js (MIT) est incluse dans les paquetages SCORM.
