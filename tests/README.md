# Tests

Scénarios Playwright (Python) joués en headless avec chromium + swiftshader, sur les pages fabriquées dans `dist/`.
Les requêtes vers cdn.jsdelivr.net/npm/three@0.160.0 sont servies depuis `node_modules/three`.

```
npm install
npm run build
npm test                          # toutes les machines
python3 tests/run.py scie-format  # une machine
python3 tests/scie-format/test_exercices.py   # un seul fichier
```

- `harness.py` : banc commun (ouverture de la page, fausse API SCORM, outils JS `setR`, `op`, `checks`, `alerts`, `results`…).
- `run.py` : `node --check` du script module extrait, puis tous les `tests/<machine>/test_*.py`.
- `scie-format/` :
  - `jeux.py` : les trois exercices guidés joués comme un élève, résultats attendus ;
  - `test_exercices.py` : format → 800 × 450 ; planche → 160 sans flache ; inciseur → 800 × 400 sans éclat ;
  - `test_parcours.py` : parcours complet (94 / 100, passed, 50 interactions), reprise, faute grave relevée ;
  - `test_paquetage.py` : le zip SCORM servi comme par Moodle (three.js local, `application/x-javascript`) ;
  - `test_affichage.py` : ordinateur 1400 px et téléphone 412 px, captures dans `tests/out/`.

- `degauchisseuse/`, `deligneuse/` : mêmes fichiers. Déligneuse : avivés → 2 × 85 mm, plateau en flache → avivé de 140 mm sans flache, multilames → 4 × 45 mm en une passe ; parcours 94 / 100, 50 interactions ; faute grave « presseurs trop hauts ».
- `scie-format/test_angles.py` : mode libre, onglet à 30° (chant scié à 60° du chant voisin) et biais à 45° (chant marqué 45°, décalage = épaisseur) ; captures `scie-format_onglet30.png`, `scie-format_biais45*.png`. `window.__scie` donne l'état, les pièces et la caméra aux tests.
- `scie-radiale/` : mêmes fichiers. Série → bout affranchi + 4 × 550 mm à la butée ; purge → fente, nœud et gerce dans des chutes courtes ; biais → lame à 45°, 3 × 600 mm à bouts biais parallèles ; gestes refusés (pièce touchée lame en avant, réglages lame en marche, pièce non tenue) ; parcours 94 / 100, 50 interactions ; fautes graves « protecteur trop haut » et « pièce touchée lame en avant ». `window.__radiale` donne l'état (réglages, tête, pièces) aux tests.

- `raboteuse/` : mêmes fichiers. Une pièce → traverse à 70 × 27 (capot interverrouillé, SR1 dessus signalé) ; série → 3 montants à 70 × 27 (hauteurs différentes de front en rouge, de front sans alerte après une passe à la même cote) ; contrôle → chêne non dégauchi classé « À dégauchir » (« section de pièce non rectangulaire »), frêne à 22,0 mm (arrachements contre le fil, effacés bout pour bout) ; parcours 94 / 100, 50 interactions, « Pièces débitées » visibles en scénario ; fautes graves « passe trop forte » et « main vers l'entrée machine en marche ». `window.__rabot` donne l'état, les pièces et leurs mesures aux tests.

En headless, les pertes de contexte WebGL et les captures lentes ne sont pas des bugs utilisateur.
Le parcours complet prend plusieurs minutes (rendu logiciel).
